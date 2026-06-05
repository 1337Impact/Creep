import React from 'react';
import { createRoot } from 'react-dom/client';
import SelectionPopup from './components/SelectionPopup';
import ChatInterface from './components/ChatInterface';
import { initAgentBridge } from './content/agent-bridge';
import { MSG, type ContentRequest } from '@/agent/protocol';
import type { ConversationData } from '@/types/chat';
import styles from './input.css?inline';

initAgentBridge();

let globalSetSelectedText: ((text: string) => void) | null = null;
let globalOpenChat: (() => void) | null = null;
let globalToggleChat: (() => void) | null = null;
let globalOpenChatWithVoice: (() => void) | null = null;
let globalAddMessagesToChat: ((conversation: ConversationData) => void) | null = null;

const App: React.FC = () => {
    const registerSetters = (
        setSelectedText: (text: string) => void,
        openChat: () => void,
        toggleChat: () => void,
        openChatWithVoice: () => void,
        addMessagesToChat: (conversation: ConversationData) => void
    ) => {
        globalSetSelectedText = setSelectedText;
        globalOpenChat = openChat;
        globalToggleChat = toggleChat;
        globalOpenChatWithVoice = openChatWithVoice;
        globalAddMessagesToChat = addMessagesToChat;
    };

    return (
        <>
            <ChatInterface
                registerSetters={registerSetters}
            />
            <SelectionPopupWrapper />
        </>
    );
}

// Wrapper to pass globals to SelectionPopup
const SelectionPopupWrapper: React.FC = () => {
    return <SelectionPopup
        globalSetSelectedText={(text) => globalSetSelectedText?.(text)}
        globalOpenChat={() => globalOpenChat?.()}
        globalAddMessagesToChat={(conversation) => globalAddMessagesToChat?.(conversation)}
    />;
};

// Injection Logic
const host = document.createElement('div');
host.id = 'chrome-ai-helper-host';
document.body.appendChild(host);

const shadowRoot = host.attachShadow({ mode: 'open' });

// Inject Styles
const styleElement = document.createElement('style');
styleElement.textContent = styles;
shadowRoot.appendChild(styleElement);

// Mount React App (Chat Interface + Selection Popup - both inside Shadow DOM for style isolation)
const rootContainer = document.createElement('div');
rootContainer.setAttribute('data-extension-root', '');

// Stop keyboard events from propagating to the host page
const stopKeyEvents = (e: KeyboardEvent) => {
    e.stopPropagation();
};
rootContainer.addEventListener('keydown', stopKeyEvents);
rootContainer.addEventListener('keyup', stopKeyEvents);
rootContainer.addEventListener('keypress', stopKeyEvents);

shadowRoot.appendChild(rootContainer);

const root = createRoot(rootContainer);
root.render(<App />);

chrome.runtime.onMessage.addListener((request: ContentRequest, _sender, sendResponse) => {
    if (request?.type === MSG.CHAT_TOGGLE) {
        globalToggleChat?.();
        sendResponse({ ok: true });
        return false;
    }

    if (request?.type === MSG.CHAT_OPEN_VOICE) {
        globalOpenChatWithVoice?.();
        sendResponse({ ok: true });
        return false;
    }

    return false;
});
