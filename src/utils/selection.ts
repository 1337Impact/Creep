export interface SelectionAnchorPosition {
  x: number;
  y: number;
}

export function getSelectionAnchorPosition(): SelectionAnchorPosition | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.toString().trim()) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top - 45,
  };
}

export function clearBrowserSelection(): void {
  window.getSelection()?.removeAllRanges();
}
