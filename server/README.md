# Creep Cursor Bridge

A small FastAPI server that lets the Creep extension use a [Cursor agent](https://cursor.com/docs/sdk/python)
as an AI provider. It streams the agent's assistant text and tool calls back to
the extension over Server-Sent Events.

## Setup

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Configuration

The server reads its config from the project root `.env` file (one directory up
from `server/`). Add your Cursor API key there:

```bash
# .env (project root)
CURSOR_API_KEY=crsr_...        # from https://cursor.com/dashboard/api
# optional:
CREEP_AGENT_CWD=/path/to/repo  # directory the agent works on (default: cwd)
CREEP_AGENT_MODEL=composer-2.5 # default model
CREEP_AGENT_SETTING_SOURCES=user,project # .cursor layers to load (default: user,project)
```

### Skills, rules, and MCP

The agent loads on-disk `.cursor` settings (skills, rules, MCP servers) based on
`CREEP_AGENT_SETTING_SOURCES`. The default `user,project` loads:

- `user` → `~/.cursor` (your global skills, e.g. `~/.cursor/skills/use-mopedia`)
- `project` → the workspace's `.cursor`

Skills aren't enabled one-by-one — once its source is loaded, the agent
auto-invokes a skill when the request matches the skill's `description` / trigger
phrases. Valid sources: `project`, `user`, `team`, `mdm`, `plugins`, `all`.

Values can also be provided as real environment variables (which take precedence
is left to the shell — set them via `export` to override the `.env`).

## Run

```bash
uvicorn main:app --port 8000
```

The extension talks to `http://localhost:8000` by default (see
`src/ai/cursor/config.ts`). To point it elsewhere, set `VITE_CURSOR_SERVER_URL`
when building the extension.

## Endpoints

- `POST /agent/stream` — body `{ "prompt": str, "model"?: str, "conversation_id"?: str }`.
  Responds with an SSE stream of JSON events:
  - `{"type":"text","text":...}` — assistant text chunk
  - `{"type":"thinking","text":...}` — reasoning chunk
  - `{"type":"tool_call","id":...,"name":...,"args":{...}}` — a tool started
  - `{"type":"tool_result","id":...,"name":...,"ok":bool,"result":{...}}` — a tool finished
  - `{"type":"done","summary":...}` — run finished
  - `{"type":"error","message":...}` — run failed
- `GET /health` — basic status.

`conversation_id` (the chat tab id) keeps one Cursor agent per conversation so
follow-up messages retain context.
