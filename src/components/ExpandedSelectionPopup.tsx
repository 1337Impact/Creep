import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, ArrowRight, Loader2 } from 'lucide-react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { sendInlineQuestion } from '../api/gemini';
import { useWebsiteDarkMode } from '../hooks/useWebsiteDarkMode';
import { cn } from '../utils';
import { COMMANDS, Command } from '../commands';
import AutocompleteDropdown, { AutocompleteDropdownHandle } from './AutocompleteDropdown';

interface ConversationData {
    userMessage: string;
    modelResponse: string | null;
}

interface ExpandedSelectionPopupProps {
    currentSelection: string;
    initialPosition: { x: number; y: number };
    onClose: () => void;
    onAddToChat: (conversation?: ConversationData) => void;
}

const ExpandedSelectionPopup: React.FC<ExpandedSelectionPopupProps> = ({
    currentSelection,
    initialPosition,
    onClose,
    onAddToChat,
}) => {
    // Position state managed locally for scroll responsiveness
    const [position, setPosition] = useState(initialPosition);

    // Input/response state
    const [inputValue, setInputValue] = useState('');
    const [response, setResponse] = useState<string | null>(null);
    const [lastAskedQuestion, setLastAskedQuestion] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<AutocompleteDropdownHandle>(null);
    const isDark = useWebsiteDarkMode();

    // Handle scroll to update position
    useEffect(() => {
        const handleScroll = () => {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0 && selection.toString().trim()) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setPosition({
                    x: rect.left + rect.width / 2,
                    y: rect.top - 45
                });
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const handleSelectCommand = (command: Command) => {
        setInputValue(command.id + ' ');
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Stop propagation to prevent webpage keyboard shortcuts from interfering
        e.stopPropagation();
        
        // Delegate to dropdown first
        if (dropdownRef.current?.handleKeyDown(e)) {
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAsk();
        }
    };

    const handleAsk = async () => {
        if (!inputValue.trim()) return;

        setIsLoading(true);
        setResponse(null);

        let question = inputValue.trim();
        let displayQuestion = question; // Keep original for display
        let useGoogleSearch = false;

        // Parse commands
        const matchedCommand = COMMANDS.find(cmd => question.startsWith(cmd.id));
        if (matchedCommand) {
            const args = question.replace(matchedCommand.id, '').trim() || 'English';
            displayQuestion = `${matchedCommand.label}: "${currentSelection.length > 50 ? currentSelection.substring(0, 50) + '...' : currentSelection}"${args !== 'English' ? ` → ${args}` : ''}`;
            question = matchedCommand.prompt
                .replace('{text}', currentSelection)
                .replace('{args}', args);
            useGoogleSearch = matchedCommand.useGoogleSearch ?? false;
        } else {
            // Regular question about selection
            displayQuestion = `Re: "${currentSelection.length > 30 ? currentSelection.substring(0, 30) + '...' : currentSelection}": ${question}`;
        }

        setLastAskedQuestion(displayQuestion);

        try {
            const result = await sendInlineQuestion(currentSelection, question, useGoogleSearch);
            setResponse(result);
        } catch (err: any) {
            setResponse('Error: ' + (err.message || 'Failed to get response'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenInChat = () => {
        // If we have a conversation (question + response), pass it along
        if (lastAskedQuestion && response) {
            onAddToChat({
                userMessage: lastAskedQuestion,
                modelResponse: response
            });
        } else {
            // No conversation yet, just add selection to chat
            onAddToChat();
        }
    };

    return (
        <div
            id="chrome-ai-selection-popup"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: 'translateX(-50%)',
            }}
            className={cn(
                "fixed z-[10001] rounded-xl shadow-2xl w-[320px] text-sm font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200",
                isDark
                    ? "bg-gray-900 text-white border border-gray-700"
                    : "bg-white text-black border border-gray-200"
            )}
        >
            {/* Input Area */}
            <div className={cn(
                "p-3 border-b flex gap-2 items-center rounded-t-xl",
                isDark ? "border-gray-700 bg-gray-800/50" : "border-gray-100 bg-gray-50/50"
            )}>
                <div className="relative flex-1">
                    <input
                        ref={inputRef}
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onKeyUp={(e) => e.stopPropagation()}
                        onKeyPress={(e) => e.stopPropagation()}
                        placeholder="Ask, /fact-check, /translate..."
                        className={cn(
                            "w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all",
                            isDark
                                ? "bg-gray-800 border border-gray-600 text-white placeholder:text-gray-500"
                                : "bg-white border border-gray-200 text-black placeholder:text-gray-400"
                        )}
                        autoFocus
                    />

                    <AutocompleteDropdown
                        ref={dropdownRef}
                        inputValue={inputValue}
                        onSelect={handleSelectCommand}
                        onClose={() => {}}
                        isDark={isDark}
                    />
                </div>

                <div
                    onClick={() => {
                        if (!(isLoading || !inputValue.trim())) {
                            handleAsk();
                        }
                    }}
                    className={cn(
                        "p-2 rounded-lg transition-colors flex items-center justify-center",
                        isDark ? "bg-white text-black" : "bg-black text-white",
                        (isLoading || !inputValue.trim())
                            ? "opacity-50 cursor-not-allowed"
                            : (isDark ? "hover:bg-gray-200 cursor-pointer" : "hover:bg-gray-800 cursor-pointer")
                    )}
                    role="button"
                >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                </div>
            </div>

            {/* Response Area */}
            {response && (
                <div className={cn(
                    "p-4 max-h-[200px] overflow-y-auto",
                    isDark ? "bg-gray-900" : "bg-white"
                )}>
                    <MarkdownPreview
                        source={response}
                        wrapperElement={{ 'data-color-mode': isDark ? 'dark' : 'light' }}
                        className={cn("!bg-transparent text-[13px] leading-6", isDark ? "!text-gray-200" : "!text-gray-800")}
                    />
                </div>
            )}

            {/* Footer/Actions */}
            <div className={cn(
                "px-3 py-2 border-t flex justify-between items-center text-xs rounded-b-xl",
                isDark
                    ? "bg-gray-800 border-gray-700 text-gray-400"
                    : "bg-gray-50 border-gray-100 text-gray-500"
            )}>
                <div className="flex gap-2">
                    <div onClick={onClose} className={cn("cursor-pointer", isDark ? "hover:text-white" : "hover:text-gray-900")} role="button">Close</div>
                </div>
                <div onClick={handleOpenInChat} className="flex items-center gap-1 hover:text-blue-500 font-medium cursor-pointer" role="button">
                    <MessageSquare size={12} />
                    Open in Chat
                </div>
            </div>
        </div>
    );
};

export default ExpandedSelectionPopup;
