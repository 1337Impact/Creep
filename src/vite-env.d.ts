/// <reference types="vite/client" />

declare module '*.css?inline' {
  const content: string;
  export default content;
}

declare module 're-resizable' {
  import * as React from 'react';
  
  export interface ResizableDelta {
    width: number;
    height: number;
  }
  
  export interface ResizableProps {
    size?: { width: number | string; height: number | string };
    minWidth?: number | string;
    minHeight?: number | string;
    maxWidth?: number | string;
    maxHeight?: number | string;
    defaultSize?: { width: number | string; height: number | string };
    enable?: {
      top?: boolean;
      right?: boolean;
      bottom?: boolean;
      left?: boolean;
      topRight?: boolean;
      bottomRight?: boolean;
      bottomLeft?: boolean;
      topLeft?: boolean;
    };
    onResizeStop?: (e: MouseEvent | TouchEvent, direction: string, ref: HTMLElement, d: ResizableDelta) => void;
    style?: React.CSSProperties;
    className?: string;
    children?: React.ReactNode;
  }
  
  export class Resizable extends React.Component<ResizableProps> {}
}
