import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, ArrowRight, Loader2 } from 'lucide-react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { aiService, getReadableAiError } from '@/ai';
import { cn } from '@/utils';
import { truncateText } from '@/utils/text';
import {
  SELECTION_PREVIEW_LENGTH,
  SELECTION_QUESTION_PREVIEW_LENGTH,
} from '@/constants/chat';
import { COMMANDS, Command } from '@/commands';
import AutocompleteDropdown, { AutocompleteDropdownHandle } from './AutocompleteDropdown';
import type { ConversationData } from '@/types/chat';
import { getSelectionAnchorPosition } from '@/utils/selection';

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
    const [position, setPosition] = useState(initialPosition);
    const [inputValue, setInputValue] = useState('');
    const [response, setResponse] = useState<string | null>(null);
    const [lastAskedQuestion, setLastAskedQuestion] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<AutocompleteDropdownHandle>(null);

    useEffect(() => {
        const handleScroll = () => {
            const anchor = getSelectionAnchorPosition();
            if (anchor) {
                setPosition(anchor);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const focusInput = () => {
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    useEffect(() => {
        focusInput();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const handleSelectCommand = (command: Command) => {
        setInputValue(command.id + ' ');
        focusInput();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();

        if (dropdownRef.current?.handleKeyDown(e)) {
            return;
        }

        if (e.key === 'Escape') {
            onClose();
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
        focusInput();

        let question = inputValue.trim();
        let displayQuestion = question;
        let useGoogleSearch = false;

        const matchedCommand = COMMANDS.find(cmd => question.startsWith(cmd.id));
        if (matchedCommand) {
            const args = question.replace(matchedCommand.id, '').trim() || 'English';
            displayQuestion = `${matchedCommand.label}: "${truncateText(currentSelection, SELECTION_PREVIEW_LENGTH)}"${args !== 'English' ? ` → ${args}` : ''}`;
            question = matchedCommand.prompt
                .replace('{text}', currentSelection)
                .replace('{args}', args);
            useGoogleSearch = matchedCommand.useGoogleSearch ?? false;
        } else {
            displayQuestion = `Re: "${truncateText(currentSelection, SELECTION_QUESTION_PREVIEW_LENGTH)}": ${question}`;
        }

        setLastAskedQuestion(displayQuestion);

        try {
            const result = await aiService.sendInlineQuestion(currentSelection, question, { enableSearch: useGoogleSearch });
            setResponse(result);
        } catch (err: unknown) {
            setResponse('Sorry — ' + getReadableAiError(err));
        } finally {
            setIsLoading(false);
            focusInput();
        }
    };

    const handleOpenInChat = () => {
        if (lastAskedQuestion && response) {
            onAddToChat({
                userMessage: lastAskedQuestion,
                modelResponse: response
            });
        } else {
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
                "fixed z-[10001] rounded-xl shadow-2xl w-[320px] text-sm font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200 bg-background text-foreground border border-secondary"
            )}
        >
            <div className={cn(
                "p-3 border-b flex gap-2 items-center rounded-t-xl border-secondary bg-secondary/50"
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
                            "w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all bg-secondary border border-secondary text-foreground placeholder:text-muted-foreground"
                        )}
                        autoFocus
                    />

                    <AutocompleteDropdown
                        ref={dropdownRef}
                        inputValue={inputValue}
                        onSelect={handleSelectCommand}
                        onClose={() => {}}
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
                        "bg-foreground text-background",
                        (isLoading || !inputValue.trim())
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-foreground/80 cursor-pointer"
                    )}
                    role="button"
                >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                </div>
            </div>

            {response && (
                <div className={cn(
                    "p-4 max-h-[200px] overflow-y-auto bg-background"
                )}>
                    <MarkdownPreview
                        source={response}
                        wrapperElement={{ 'data-color-mode': 'dark' }}
                        className={cn("!bg-transparent text-[13px] leading-6 !text-foreground")}
                    />
                </div>
            )}

            <div className={cn(
                "px-3 py-2 border-t flex justify-between items-center text-xs rounded-b-xl bg-secondary border-secondary text-muted-foreground"
            )}>
                <div className="flex gap-2">
                    <div onClick={onClose} className={cn("cursor-pointer hover:text-foreground")} role="button">Close</div>
                </div>
                <div onClick={handleOpenInChat} className="flex items-center gap-1 hover:text-primary font-medium cursor-pointer" role="button">
                    <MessageSquare size={12} />
                    Open in Chat
                </div>
            </div>
        </div>
    );
};

export default ExpandedSelectionPopup;
