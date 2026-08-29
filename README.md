# Creep - Stop tab-switching. Start "Creeping." 👁️

AI assistant that sits in the corner of your screen, powered by Google Gemini.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API Key:**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and add your Gemini API key:
   ```
   VITE_GEMINI_API_KEY=your_actual_api_key_here
   ```
   Get your API key from: https://aistudio.google.com/apikey

3. **Build the extension:**
   ```bash
   npm run build
   ```

## Loading in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist` folder from this project
5. The extension should now be loaded and active

## After Making Changes

If you make code changes and rebuild:
1. Run `npm run build` again
2. Go to `chrome://extensions/`
3. Find your extension and click the "Refresh" icon 🔄
4. Reload any open tabs to see the changes

## Development Mode

For live development with hot reload:
```bash
npm run dev
```
Then load the `dist` folder in Chrome as described above. Changes will auto-reload.

## Features

- **Chat Interface**: AI assistant in a resizable floating window
- **Voice Input**: Hold the mic button to record and transcribe
- **Text Selection**: Select text on any page to ask questions or translate
- **Screenshot Context**: Attach page screenshots to your queries
- **Page Content**: Include page text in your prompts
- **Google Search**: Enable grounding with real-time search results
- **Multiple Models**: Choose between Gemini Flash Lite, Flash, or Pro

## Planning docs

- [Browser agent](docs/planning/browser-agent/index.md) — tool loop, DOM tools, run storage, APIs (backend implemented)
- [Multi-provider AI](docs/planning/multi-provider-ai/index.md) — chat provider architecture and `AiService`

## Architecture

- `src/content.tsx`: Main content script injected into web pages
- `src/agent/`: Browser agent loop, tools, and `agent_run_*` persistence (see planning doc above)
- `src/components/ChatInterface.tsx`: Main chat UI
- `src/components/ExpandedSelectionPopup.tsx`: Text selection popup
- `src/api/gemini.ts`: Gemini API integration
- `src/background.ts`: Service worker for screenshots
- `src/hooks/useChatTabs.ts`: Chat tab lifecycle and active-tab state
- `src/hooks/useChatPersistence.ts`: Host-scoped chat persistence/migration
- `src/hooks/useFloatingButton.ts`: Floating launcher drag/snap behavior
- `src/hooks/useSelectionAnchor.ts`: Shared text-selection anchoring logic
- `src/state/chatUpdates.ts`: Pure tab/message/history update helpers

## Troubleshooting

### "Could not load file" error
1. Make sure you've run `npm run build`
2. Go to `chrome://extensions/`
3. Remove the extension completely
4. Click "Load unpacked" and select the `dist` folder again
5. Hard refresh any open tabs (Cmd+Shift+R / Ctrl+Shift+R)

### Environment variable not loading
Make sure your `.env` file is in the root directory and run `npm run build` again.

### Extension not appearing on pages
1. Check that the extension is enabled in `chrome://extensions/`
2. Refresh the page you're testing on
3. Check the browser console for any errors
