# Browser Agent

## Purpose

Creep's **browser agent** runs a tool-calling loop against the active page: observe DOM, click, type, scroll, then signal completion. It lives in `src/agent/`, uses Gemini function calling via `src/ai/`, and persists minimal run metadata to `chrome.storage.local`. It is **separate from chat** (`AiService.streamChat`) until UI integration.

## Document Map

- [Overview](00-overview.md)
- [Requirements](01-requirements.md)
- [Product Discussion](02-product-discussion.md)
- [Architecture Plan](03-architecture-plan.md)
- [Data and APIs](04-data-and-apis.md)
- [User Experience](05-user-experience.md)
- [Risks and Weak Points](06-risks-and-weak-points.md)
- [Execution Plan](07-execution-plan.md)
- [Validation Plan](08-validation-plan.md)
- [Open Questions](open-questions.md)

### Decisions

- [0001 — Agent module separate from chat](decisions/0001-separate-from-chat.md)
- [0002 — Minimal agent run storage](decisions/0002-minimal-run-storage.md)

## Current Status

- **Status:** Background orchestrator + chat UI integration
- **Owner/context:** Creep Chrome extension — background loop, content-script tools
- **Last updated:** 2026-06-04

## Quick Reference

```
ChatInterface  →  AGENT_START (protocol)  →  AgentOrchestrator  →  runAgentLoop
                                                    ↓
                                            TabToolExecutor  →  AGENT_EXECUTE_TOOL
                                                    ↓
                                            BrowserToolExecutor (content script)
                                                    ↓
                    chrome.storage.local  agent_run_<uuid>  +  agent_active_session
```

**Default model:** `models/gemini-flash-lite-latest` (see `DEFAULT_AGENT_MODEL` in `src/agent/constants.ts`).

**Public entry:** `import { MSG, sendToRuntime } from "@/agent"` and `useAgentRunEvents` in the UI layer.
