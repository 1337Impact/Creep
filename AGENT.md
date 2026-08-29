# Chrome AI Helper Extension

## Overview
A minimal Chrome extension providing a persistent AI chat assistant injected into every webpage. It uses Google's Gemini models for text generation, voice transcription, and multimodal understanding (screenshots).

## Tech Stack
- **Framework**: React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui (@radix-ui)
- **Build Tool**: Vite with @crxjs/vite-plugin
- **AI Integration**: @google/genai SDK (Gemini Lite/Flash/Pro), OpenAI SDK (GPT-4o), Cursor agent via local bridge server
- **Manifest**: V3

## Setup
1. Copy `.env.example` to `.env`
2. Add your Gemini API key to `.env` as `VITE_GEMINI_API_KEY`
3. Run `npm install` and `npm run dev`

## Current Features
- **Floating UI**: Collapsible chat interface fixed to the bottom-right corner.
- **Chat Interface**: 
  - Text input with history.
  - Markdown rendering (basic).
  - Model selector (Flash Lite, Flash, Pro).
- **Voice Input**: Hold-to-record button; audio is transcribed via Gemini.
- **Inline Question**: Select text to ask questions directly or use commands:
  - `/fact-check`: Verify information using Google Search.
  - `/translate`: Translate text.
- **Context Awareness**: 
  - Toggle to attach current visible tab screenshot as context.
- **API**: Gemini API key loaded from `.env` file via `VITE_GEMINI_API_KEY` environment variable.
- **Cursor provider**: Selecting the "Cursor" model (`composer-2.5`) routes chats to a local FastAPI bridge (`server/`) that runs a Cursor agent and streams assistant text + tool calls back over SSE. The Cursor API key lives on the server (`CURSOR_API_KEY`), not in the extension. Server URL is `http://localhost:8000` (override with `VITE_CURSOR_SERVER_URL`). See `server/README.md`.

## Architecture
- `content.tsx`: Injects Shadow DOM into pages for style isolation. Both `ChatInterface` and `SelectionPopup` render inside Shadow DOM to prevent CSS leakage to/from host pages. Imports CSS as inline string for Shadow DOM injection.
- `background.ts`: Handles privileged Chrome APIs (screenshot capture).
- `gemini.ts`: wrapper for Google GenAI SDK.
- **Build**: Vite with @crxjs handles manifest processing, HMR, and automatic path resolution for content scripts and service workers.
- **Keyboard handling**: Input fields use `stopPropagation()` on keyboard events to prevent website shortcuts (like YouTube's space to pause) from interfering with user input.

## General Instructions
1. **Update this file**: Whenever a new feature is implemented, update this `AGENT.md` to reflect the current state.
2. **Keep it concise**: This file provides high-level context for AI agents.


# Behavioral guidelines
Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
