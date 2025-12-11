import React from 'react';
import { createRoot } from 'react-dom/client';
import SelectionPopup from './components/SelectionPopup';
import ChatInterface from './components/ChatInterface';
import styles from './input.css?inline';

interface ConversationData {
    userMessage: string;
    modelResponse: string | null;
}

// Global state for selection popup communication (maintained for backward compatibility with logic structure)
let globalSetSelectedText: ((text: string) => void) | null = null;
let globalSetIsOpen: ((open: boolean) => void) | null = null;
let globalAddMessagesToChat: ((conversation: ConversationData) => void) | null = null;

const App: React.FC = () => {
    // We lift the setters registration to here so we can pass them to children or manage them
    const registerSetters = (
        setSelectedText: (text: string) => void,
        setIsOpen: (open: boolean) => void,
        addMessagesToChat: (conversation: ConversationData) => void
    ) => {
        globalSetSelectedText = setSelectedText;
        globalSetIsOpen = setIsOpen;
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
        globalSetIsOpen={(open) => globalSetIsOpen?.(open)}
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
shadowRoot.appendChild(rootContainer);
const root = createRoot(rootContainer);
root.render(<App />);
