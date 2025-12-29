# Chrome AI Helper Extension

## Overview
A minimal Chrome extension providing a persistent AI chat assistant injected into every webpage. It uses Google's Gemini models for text generation, voice transcription, and multimodal understanding (screenshots).

## Tech Stack
- **Framework**: React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui (@radix-ui)
- **Build Tool**: Vite with @crxjs/vite-plugin
- **AI Integration**: @google/genai SDK (Gemini Lite/Flash/Pro)
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

## Architecture
- `content.tsx`: Injects Shadow DOM into pages for style isolation. Both `ChatInterface` and `SelectionPopup` render inside Shadow DOM to prevent CSS leakage to/from host pages. Imports CSS as inline string for Shadow DOM injection.
- `background.ts`: Handles privileged Chrome APIs (screenshot capture).
- `gemini.ts`: wrapper for Google GenAI SDK.
- **Build**: Vite with @crxjs handles manifest processing, HMR, and automatic path resolution for content scripts and service workers.
- **Keyboard handling**: Input fields use `stopPropagation()` on keyboard events to prevent website shortcuts (like YouTube's space to pause) from interfering with user input.

## General Instructions
1. **Update this file**: Whenever a new feature is implemented, update this `AGENT.md` to reflect the current state.
2. **Keep it concise**: This file provides high-level context for AI agents.

