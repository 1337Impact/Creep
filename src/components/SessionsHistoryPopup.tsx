import React, { useEffect, useRef } from "react";
import { History, Trash2 } from "lucide-react";
import { cn } from "@/utils";
import type { ChatSessionEntry } from "@/types/chat";

interface SessionsHistoryPopupProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  sessions: ChatSessionEntry[];
  isSessionActive: (session: ChatSessionEntry) => boolean;
  onSelect: (session: ChatSessionEntry) => void;
  onDelete: (session: ChatSessionEntry) => void;
}

export const SessionsHistoryPopup: React.FC<SessionsHistoryPopupProps> = ({
  isOpen,
  onToggle,
  onClose,
  sessions,
  isSessionActive,
  onSelect,
  onDelete,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (panelRef.current && e.composedPath().includes(panelRef.current)) return;
      onClose();
    };
    document.addEventListener("mousedown", onOutside, true);
    return () => document.removeEventListener("mousedown", onOutside, true);
  }, [isOpen, onClose]);

  return (
    <div ref={panelRef} className="relative z-40 shrink-0">
      <div
        onClick={onToggle}
        className={cn(
          "p-1.5 rounded-md transition-colors cursor-pointer hover:bg-secondary text-muted-foreground hover:text-foreground",
          isOpen && "bg-secondary text-foreground"
        )}
        title="Session history"
        role="button"
      >
        <History className="w-4 h-4" />
      </div>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-[100] w-72 max-h-64 overflow-y-auto rounded-lg shadow-xl border bg-secondary border-secondary">
          {sessions.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">No saved sessions</p>
          ) : (
            <ul className="py-1">
              {sessions.map((session) => (
                <li
                  key={`${session.storageKey}-${session.tabId}`}
                  onClick={() => onSelect(session)}
                  className={cn(
                    "border-b border-secondary/80 last:border-b-0 px-3 py-2.5 cursor-pointer hover:bg-accent/60",
                    isSessionActive(session) && "bg-secondary/40"
                  )}
                  role="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-foreground truncate flex-1">
                      {session.title}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(session);
                      }}
                      className="shrink-0 p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-accent"
                      title="Delete session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                    {session.host}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
