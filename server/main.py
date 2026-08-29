"""FastAPI bridge that lets Creep talk to a Cursor agent.

Exposes a single streaming endpoint that runs a Cursor local agent and relays
its output (assistant text, tool calls, tool results) to the browser extension
as Server-Sent Events.

Run it with:

    export CURSOR_API_KEY="crsr_..."
    uvicorn main:app --port 8000

Optional environment variables:
    CREEP_AGENT_CWD   Working directory the agent operates on (default: cwd).
    CREEP_AGENT_MODEL Fallback model when the request omits one (default: composer-2.5).
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any, AsyncGenerator, Optional

from dotenv import load_dotenv

# Load environment variables (CURSOR_API_KEY, CREEP_AGENT_*) from the project
# root .env, then fall back to a local server/.env if present.
_ROOT_ENV = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ROOT_ENV)
load_dotenv()

from cursor_sdk import AsyncClient, LocalAgentOptions  # noqa: E402
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

DEFAULT_MODEL = os.environ.get("CREEP_AGENT_MODEL", "composer-2.5")
AGENT_CWD = os.environ.get("CREEP_AGENT_CWD", os.getcwd())

# Which on-disk .cursor settings layers the agent loads. "user" pulls in
# ~/.cursor (global skills, rules, MCP); "project" pulls in the workspace's
# .cursor. Without this, file-based skills like ~/.cursor/skills are ignored.
# Valid values: project, user, team, mdm, plugins, all.
SETTING_SOURCES = [
    s.strip()
    for s in os.environ.get("CREEP_AGENT_SETTING_SOURCES", "user,project").split(",")
    if s.strip()
]


def local_options() -> LocalAgentOptions:
    return LocalAgentOptions(cwd=AGENT_CWD, setting_sources=SETTING_SOURCES)

if not os.environ.get("CURSOR_API_KEY"):
    print(
        "[creep-bridge] Warning: CURSOR_API_KEY is not set. "
        f"Add it to {_ROOT_ENV} or export it before starting the server."
    )

app = FastAPI(title="Creep Cursor Bridge")

# The extension calls this from a content script, so the request Origin is the
# host page. Allow any origin; the server is meant to run locally.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AgentRequest(BaseModel):
    prompt: str
    model: Optional[str] = None
    # Stable id (the chat tab id) used to keep one Cursor agent per conversation
    # so follow-up messages retain context.
    conversation_id: Optional[str] = None


# One long-lived bridge client for the whole process. Agents are cached per
# conversation so multi-turn chats keep their history.
_client: Optional[AsyncClient] = None
_client_lock = asyncio.Lock()
_agents: dict[str, Any] = {}
_agents_lock = asyncio.Lock()


async def get_client() -> AsyncClient:
    global _client
    async with _client_lock:
        if _client is None:
            _client = await AsyncClient.launch_bridge(workspace=AGENT_CWD)
        return _client


async def get_agent(model: str, conversation_id: Optional[str]) -> Any:
    """Return a cached agent for the conversation, creating one if needed."""
    client = await get_client()
    if not conversation_id:
        return await client.agents.create(
            model=model, local=local_options()
        )

    async with _agents_lock:
        agent = _agents.get(conversation_id)
        if agent is None:
            agent = await client.agents.create(
                model=model, local=local_options()
            )
            _agents[conversation_id] = agent
        return agent


def sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event)}\n\n"


def to_plain(value: Any) -> Any:
    """Best-effort conversion of SDK objects (pydantic / dataclasses) to JSON."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {k: to_plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_plain(v) for v in value]
    for attr in ("model_dump", "dict"):
        method = getattr(value, attr, None)
        if callable(method):
            try:
                return to_plain(method())
            except Exception:  # noqa: BLE001 - fall through to other strategies
                pass
    if hasattr(value, "__dict__"):
        return {k: to_plain(v) for k, v in vars(value).items() if not k.startswith("_")}
    return str(value)


async def stream_agent(req: AgentRequest) -> AsyncGenerator[str, None]:
    model = req.model or DEFAULT_MODEL
    try:
        agent = await get_agent(model, req.conversation_id)
    except Exception as exc:  # noqa: BLE001 - surface setup failures to the client
        yield sse({"type": "error", "message": f"Failed to start agent: {exc}"})
        return

    summary_parts: list[str] = []
    try:
        run = await agent.send(req.prompt)

        async for message in run.messages():
            mtype = getattr(message, "type", None)

            if mtype == "assistant":
                content = getattr(getattr(message, "message", None), "content", []) or []
                for block in content:
                    if getattr(block, "type", None) == "text":
                        text = getattr(block, "text", "")
                        if text:
                            summary_parts.append(text)
                            yield sse({"type": "text", "text": text})

            elif mtype == "thinking":
                text = getattr(message, "text", "")
                if text:
                    yield sse({"type": "thinking", "text": text})

            elif mtype == "tool_call":
                status = getattr(message, "status", None)
                name = getattr(message, "name", "tool")
                call_id = getattr(message, "id", None)
                if status == "completed":
                    result = to_plain(getattr(message, "result", None))
                    yield sse(
                        {
                            "type": "tool_result",
                            "id": call_id,
                            "name": name,
                            "ok": True,
                            "result": result if isinstance(result, dict) else {"result": result},
                        }
                    )
                else:
                    yield sse(
                        {
                            "type": "tool_call",
                            "id": call_id,
                            "name": name,
                            "args": to_plain(getattr(message, "args", {})) or {},
                        }
                    )

        yield sse({"type": "done", "summary": "".join(summary_parts).strip()})
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001 - relay runtime failures
        yield sse({"type": "error", "message": str(exc)})


@app.post("/agent/stream")
async def agent_stream(req: AgentRequest) -> StreamingResponse:
    return StreamingResponse(
        stream_agent(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "model": DEFAULT_MODEL, "cwd": AGENT_CWD}
