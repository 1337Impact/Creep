import React, { useState, useEffect } from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';
import ExpandedSelectionPopup from './ExpandedSelectionPopup';
import type { ConversationData } from '@/types/chat';
import {
  clearBrowserSelection,
  getSelectionAnchorPosition,
} from '@/utils/selection';

interface SelectionPopupProps {
  globalSetSelectedText: ((text: string) => void) | null;
  globalSetIsOpen: ((open: boolean) => void) | null;
  globalAddMessagesToChat: ((conversation: ConversationData) => void) | null;
}

const SelectionPopup: React.FC<SelectionPopupProps> = ({
  globalSetSelectedText,
  globalSetIsOpen,
  globalAddMessagesToChat,
}) => {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [currentSelection, setCurrentSelection] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const syncFromSelection = () => {
    const anchor = getSelectionAnchorPosition();
    if (anchor) {
      setPosition(anchor);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && position && !isExpanded) {
        setPosition(null);
        setCurrentSelection('');
        setIsExpanded(false);
        clearBrowserSelection();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [position, isExpanded]);

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      const path = e.composedPath();
      const isInsideExtension = path.some((el) => {
        if (el instanceof HTMLElement) {
          return el.id === 'chrome-ai-selection-popup' || el.id === 'chrome-ai-helper-host';
        }
        return false;
      });

      if (isInsideExtension) {
        return;
      }

      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();

        if (text && text.length > 0) {
          syncFromSelection();
          setIsExpanded(false);
          setCurrentSelection(text);
        } else if (!isInsideExtension) {
          setPosition(null);
          setCurrentSelection('');
        }
      }, 10);
    };

    const handleMouseDown = (e: MouseEvent) => {
      const path = e.composedPath();
      const isInsidePopup = path.some((el) => {
        if (el instanceof HTMLElement) {
          return el.id === 'chrome-ai-selection-popup' || el.id === 'chrome-ai-helper-host';
        }
        return false;
      });

      if (!isInsidePopup) {
        setPosition(null);
        setCurrentSelection('');
        setIsExpanded(false);
      }
    };

    const handleScroll = () => {
      if (!isExpanded) {
        syncFromSelection();
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('scroll', handleScroll);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isExpanded]);

  const handleAddToChat = (conversation?: ConversationData) => {
    if (conversation && globalAddMessagesToChat && globalSetIsOpen) {
      globalAddMessagesToChat(conversation);
      globalSetIsOpen(true);
      setPosition(null);
      clearBrowserSelection();
    } else if (currentSelection && globalSetSelectedText && globalSetIsOpen) {
      globalSetSelectedText(currentSelection);
      globalSetIsOpen(true);
      setPosition(null);
      clearBrowserSelection();
    }
  };

  const handleClose = () => {
    setIsExpanded(false);
    setPosition(null);
    setCurrentSelection('');
  };

  if (!position) return null;

  if (isExpanded) {
    return (
      <ExpandedSelectionPopup
        currentSelection={currentSelection}
        initialPosition={position}
        onClose={handleClose}
        onAddToChat={handleAddToChat}
      />
    );
  }

  return (
    <div
      id="chrome-ai-selection-popup"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)',
      }}
      className="fixed z-[10001] flex items-center bg-black rounded-xl shadow-lg px-1 py-1 gap-[2px] font-sans"
    >
      <div
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-1.5 bg-transparent text-white px-2.5 py-1.5 cursor-pointer text-[13px] font-medium rounded-lg transition-colors hover:bg-neutral-800"
        role="button"
      >
        <Sparkles size={14} />
        <span>Ask AI</span>
      </div>

      <div className="w-px h-4 bg-neutral-800 mx-[2px]" />

      <div
        onClick={() => handleAddToChat()}
        className="flex items-center justify-center bg-transparent text-gray-300 px-2 py-1.5 cursor-pointer rounded-lg transition-all hover:bg-neutral-800 hover:text-white"
        title="Add to Chat"
        role="button"
      >
        <MessageSquare size={16} />
      </div>
    </div>
  );
};

export default SelectionPopup;
