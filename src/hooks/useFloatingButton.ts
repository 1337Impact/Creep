import { useEffect, useRef, useState } from "react";
import { FLOATING_BUTTON_Y_OFFSET } from "@/constants/chat";

export interface FloatingButtonPosition {
  x: number;
  y: number;
  side: "left" | "right";
}

export function useFloatingButton() {
  const [buttonPosition, setButtonPosition] = useState<FloatingButtonPosition>(
    () => ({
      x: window.innerWidth,
      y: window.innerHeight - FLOATING_BUTTON_Y_OFFSET,
      side: "right",
    })
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      hasDraggedRef.current = false;
      setIsDragging(true);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      hasDraggedRef.current = true;
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      const constrainedY = Math.max(
        0,
        Math.min(window.innerHeight - FLOATING_BUTTON_Y_OFFSET, newY)
      );

      setButtonPosition((prev) => ({
        ...prev,
        x: newX,
        y: constrainedY,
      }));
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsDragging(false);
      const windowWidth = window.innerWidth;
      const side = e.clientX < windowWidth / 2 ? "left" : "right";
      const snappedX = side === "left" ? 0 : windowWidth;

      setButtonPosition((prev) => ({
        x: snappedX,
        y: prev.y,
        side,
      }));
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = "none";
    } else {
      document.body.style.userSelect = "";
    }
    return () => {
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  return {
    buttonPosition,
    setButtonPosition,
    isDragging,
    buttonRef,
    hasDraggedRef,
    handleMouseDown,
  };
}
