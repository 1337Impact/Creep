import React from "react";
import { cn } from "@/utils";
import { OwlIcon } from "@/components/OwlIcon";
import type { FloatingButtonPosition } from "@/hooks/useFloatingButton";

interface FloatingOwlButtonProps {
  buttonPosition: FloatingButtonPosition;
  isDragging: boolean;
  buttonRef: React.RefObject<HTMLDivElement | null>;
  hasDraggedRef: React.MutableRefObject<boolean>;
  onMouseDown: (e: React.MouseEvent) => void;
  onOpen: () => void;
}

export const FloatingOwlButton: React.FC<FloatingOwlButtonProps> = ({
  buttonPosition,
  isDragging,
  buttonRef,
  hasDraggedRef,
  onMouseDown,
  onOpen,
}) => {
  const buttonStyle: React.CSSProperties = {
    position: "fixed",
    left: buttonPosition.side === "left" ? `${buttonPosition.x}px` : "auto",
    right:
      buttonPosition.side === "right"
        ? `${window.innerWidth - buttonPosition.x}px`
        : "auto",
    top: `${buttonPosition.y}px`,
    zIndex: 9999,
    transform:
      buttonPosition.side === "left" ? "translateX(-20%)" : "translateX(20%)",
    transition: isDragging ? "none" : "transform 0.3s",
  };

  const buttonClasses = isDragging
    ? "rounded-full"
    : buttonPosition.side === "left"
      ? "rounded-r-full"
      : "rounded-l-full";

  return (
    <div
      ref={buttonRef}
      onMouseDown={onMouseDown}
      onClick={() => {
        if (!hasDraggedRef.current) {
          onOpen();
        }
        hasDraggedRef.current = false;
      }}
      style={buttonStyle}
      className={cn(
        "z-[9999] group bg-muted text-foreground border border-secondary p-[12px] hover:translate-x-0 transition-transform duration-300 shadow-lg flex items-center gap-2 font-sans group",
        buttonClasses
      )}
      role="button"
    >
      <OwlIcon className="w-6 h-6" />
    </div>
  );
};
