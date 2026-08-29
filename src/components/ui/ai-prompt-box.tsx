import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowUp,
  Square,
  X,
  StopCircle,
  Mic,
  Globe,
  BrainCog,
  Bot,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/utils";
import type { ChatModel } from "@/types/chat";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex w-full rounded-md border-none bg-transparent px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] resize-none scrollbar-thin scrollbar-thumb-muted-foreground scrollbar-track-transparent hover:scrollbar-thumb-accent",
        className
      )}
      ref={ref}
      rows={1}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-secondary bg-muted px-3 py-1.5 text-sm text-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-muted/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className="z-[10001] pointer-events-auto" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-[10002] pointer-events-auto grid w-full max-w-[90vw] md:max-w-[800px] translate-x-[-50%] translate-y-[-50%] gap-4 border border-secondary bg-muted p-0 shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-2xl",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full bg-accent/80 p-2 hover:bg-accent transition-all">
        <X className="h-5 w-5 text-accent-foreground hover:text-foreground" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-foreground",
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantClasses = {
      default: "bg-foreground hover:bg-foreground/80 text-background",
      outline: "border border-secondary bg-transparent hover:bg-accent",
      ghost: "bg-transparent hover:bg-accent",
    };
    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-sm",
      lg: "h-12 px-6",
      icon: "h-8 w-8 rounded-full aspect-[1/1]",
    };
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

interface VoiceRecorderProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: (duration: number) => void;
  visualizerBars?: number;
}
const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  visualizerBars = 32,
}) => {
  const [time, setTime] = React.useState(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (isRecording) {
      onStartRecording();
      timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      onStopRecording(time);
      setTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, time, onStartRecording, onStopRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center w-full transition-all duration-300 py-3",
        isRecording ? "opacity-100" : "opacity-0 h-0"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        <span className="font-mono text-sm text-foreground/80">{formatTime(time)}</span>
      </div>
      <div className="w-full h-10 flex items-center justify-center gap-0.5 px-4">
        {[...Array(visualizerBars)].map((_, i) => (
          <div
            key={i}
            className="w-0.5 rounded-full bg-foreground/50 animate-pulse"
            style={{
              height: `${Math.max(15, Math.random() * 100)}%`,
              animationDelay: `${i * 0.05}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

interface PromptInputContextType {
  isLoading: boolean;
  value: string;
  setValue: (value: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
}
const PromptInputContext = React.createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
});
function usePromptInput() {
  const context = React.useContext(PromptInputContext);
  if (!context) throw new Error("usePromptInput must be used within a PromptInput");
  return context;
}

interface PromptInputProps {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}
const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      className,
      isLoading = false,
      maxHeight = 240,
      value,
      onValueChange,
      onSubmit,
      children,
      disabled = false,
      onDragOver,
      onDragLeave,
      onDrop,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value || "");
    const handleChange = (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };
    return (
      <TooltipProvider>
        <PromptInputContext.Provider
          value={{
            isLoading,
            value: value ?? internalValue,
            setValue: onValueChange ?? handleChange,
            maxHeight,
            onSubmit,
            disabled,
          }}
        >
          <div
            ref={ref}
            className={cn(
              "rounded-3xl border border-secondary bg-muted p-2 shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300",
              isLoading && "border-red-500/70",
              className
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onKeyDown={(e) => {
              if (e.key === "Escape") return;
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onKeyUp={(e) => {
              if (e.key === "Escape") return;
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onKeyPress={(e) => {
              if (e.key === "Escape") return;
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
PromptInput.displayName = "PromptInput";

interface PromptInputTextareaProps {
  disableAutosize?: boolean;
  placeholder?: string;
}
const PromptInputTextarea = React.forwardRef<
  HTMLTextAreaElement,
  PromptInputTextareaProps & React.ComponentProps<typeof Textarea>
>(({ className, onKeyDown, disableAutosize = false, placeholder, ...props }, ref) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const setTextareaRef = (el: HTMLTextAreaElement | null) => {
    textareaRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  React.useEffect(() => {
    if (disableAutosize || !textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      typeof maxHeight === "number"
        ? `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
        : `min(${textareaRef.current.scrollHeight}px, ${maxHeight})`;
  }, [value, maxHeight, disableAutosize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
    onKeyDown?.(e);
  };

  return (
    <Textarea
      ref={setTextareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn("text-base", className)}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  );
});
PromptInputTextarea.displayName = "PromptInputTextarea";

interface PromptInputActionsProps extends React.HTMLAttributes<HTMLDivElement> {}
const PromptInputActions: React.FC<PromptInputActionsProps> = ({
  children,
  className,
  ...props
}) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);

interface PromptInputActionProps extends React.ComponentProps<typeof Tooltip> {
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}
const PromptInputAction: React.FC<PromptInputActionProps> = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}) => {
  const { disabled } = usePromptInput();
  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild disabled={disabled}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
};

const CustomDivider: React.FC = () => (
  <div className="relative h-6 w-[1.5px] mx-1">
    <div
      className="absolute inset-0 bg-gradient-to-t from-transparent via-primary/70 to-transparent rounded-full"
      style={{
        clipPath:
          "polygon(0% 0%, 100% 0%, 100% 40%, 140% 50%, 100% 60%, 100% 100%, 0% 100%, 0% 60%, -40% 50%, 0% 40%)",
      }}
    />
  </div>
);

export interface SendOptions {
  enableSearch?: boolean;
  attachPageContent?: boolean;
  attachScreenshot?: boolean;
  agentMode?: boolean;
}

export interface PromptInputBoxHandle {
  focus: () => void;
  startRecording: () => void;
}

export interface PromptInputBoxProps {
  onSend?: (message: string, options?: SendOptions) => void;
  onStop?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  models?: ChatModel[];
  selectedModel?: ChatModel;
  onModelChange?: (model: ChatModel) => void;
}

export const PromptInputBox = React.forwardRef<PromptInputBoxHandle, PromptInputBoxProps>(
  (props, ref) => {
    const {
      onSend = () => {},
      onStop = () => {},
      isLoading = false,
      placeholder = "Type your message here...",
      className,
      models = [],
      selectedModel,
      onModelChange,
    } = props;
    const [input, setInput] = React.useState("");
    const [isRecording, setIsRecording] = React.useState(false);
    const [showSearch, setShowSearch] = React.useState(false);
    const [attachPageContent, setAttachPageContent] = React.useState(false);
    const [attachScreenshot, setAttachScreenshot] = React.useState(false);
    const [agentMode, setAgentMode] = React.useState(false);
    const [modelDialogOpen, setModelDialogOpen] = React.useState(false);
    const modelMenuRef = React.useRef<HTMLDivElement>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const focusInput = () => {
      requestAnimationFrame(() => textareaRef.current?.focus());
    };

    React.useEffect(() => {
      if (!modelDialogOpen) return;

      const handleClickOutside = (e: MouseEvent) => {
        const path = e.composedPath();
        if (modelMenuRef.current && path.includes(modelMenuRef.current)) return;
        setModelDialogOpen(false);
      };

      document.addEventListener("click", handleClickOutside, true);
      return () => document.removeEventListener("click", handleClickOutside, true);
    }, [modelDialogOpen]);

    React.useImperativeHandle(ref, () => ({
      focus: focusInput,
      startRecording: () => {
        if (!isLoading) setIsRecording(true);
      },
    }));

    const handleSubmit = () => {
      if (canSubmit) {
        onSend(input, {
          enableSearch: showSearch,
          attachPageContent,
          attachScreenshot,
          agentMode,
        });
        setInput("");
        setShowSearch(false);
        setAttachPageContent(false);
        setAttachScreenshot(false);
        setAgentMode(false);
        focusInput();
      }
    };

    const handleStartRecording = () => {};

    const handleStopRecording = (_duration: number) => {
      setIsRecording(false);
      // Recording capture/transcription is not wired yet; keep UI-only behavior.
    };

    const hasText = input.trim() !== "";
    const canSubmit =
      agentMode ? hasText : hasText || attachPageContent || attachScreenshot;

    const activePlaceholder = agentMode
      ? "Describe a task for the agent..."
      : showSearch
        ? "Search the web..."
        : attachPageContent
          ? "Ask with page context..."
          : attachScreenshot
            ? "Ask about this page..."
            : placeholder;

    return (
      <>
        <PromptInput
          value={input}
          onValueChange={setInput}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          className={cn(
            "w-full bg-muted border-secondary shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300 ease-in-out",
            isRecording && "border-red-500/70",
            className
          )}
          disabled={isRecording}
        >
          <div
            className={cn(
              "transition-all duration-300",
              isRecording ? "h-0 overflow-hidden opacity-0" : "opacity-100"
            )}
          >
            <PromptInputTextarea
              ref={textareaRef}
              placeholder={activePlaceholder}
              className="text-base"
            />
          </div>

          {isRecording && (
            <VoiceRecorder
              isRecording={isRecording}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
            />
          )}

          <PromptInputActions
            className="flex items-center justify-between gap-2 p-0 pt-2"
            onMouseDown={(e) => e.preventDefault()}
            onKeyDownCapture={(e) => {
              if (isRecording || document.activeElement === textareaRef.current) return;
              if ((e.ctrlKey || e.metaKey) && e.key === "v") textareaRef.current?.focus();
            }}
          >
            <div
              className={cn(
                "flex items-center gap-1 transition-opacity duration-300",
                isRecording ? "opacity-0 invisible h-0" : "opacity-100 visible"
              )}
            >
              <PromptInputAction tooltip="Attach page content">
                <button
                  type="button"
                  onClick={() => {
                    setAttachPageContent((prev) => {
                      const next = !prev;
                      if (next) setAgentMode(false);
                      return next;
                    });
                  }}
                  className={cn(
                    "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors",
                    attachPageContent
                      ? "bg-primary/15 text-primary hover:bg-primary/25"
                      : "text-muted-foreground hover:bg-accent/30 hover:text-accent-foreground"
                  )}
                  disabled={isRecording}
                >
                  <FileText className="h-5 w-5 transition-colors" />
                </button>
              </PromptInputAction>

              <PromptInputAction tooltip="Agent mode">
                <button
                  type="button"
                  onClick={() => {
                    setAgentMode((prev) => {
                      const next = !prev;
                      if (next) {
                        setShowSearch(false);
                        setAttachPageContent(false);
                        setAttachScreenshot(false);
                      }
                      return next;
                    });
                  }}
                  className={cn(
                    "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors",
                    agentMode
                      ? "bg-primary/15 text-primary hover:bg-primary/25"
                      : "text-muted-foreground hover:bg-accent/30 hover:text-accent-foreground"
                  )}
                  disabled={isRecording}
                >
                  <Bot className="h-5 w-5 transition-colors" />
                </button>
              </PromptInputAction>

              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowSearch((prev) => {
                      const next = !prev;
                      if (next) setAgentMode(false);
                      return next;
                    });
                  }}
                  className={cn(
                    "rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
                    showSearch
                      ? "bg-primary/15 border-primary text-primary"
                      : "bg-transparent border-transparent text-muted-foreground hover:text-accent-foreground"
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <motion.div
                      animate={{ rotate: showSearch ? 360 : 0, scale: showSearch ? 1.1 : 1 }}
                      whileHover={{
                        rotate: showSearch ? 360 : 15,
                        scale: 1.1,
                        transition: { type: "spring", stiffness: 300, damping: 10 },
                      }}
                      transition={{ type: "spring", stiffness: 260, damping: 25 }}
                    >
                      <Globe
                        className={cn(
                          "w-4 h-4",
                          showSearch ? "text-primary" : "text-inherit"
                        )}
                      />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {showSearch && (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-xs overflow-hidden whitespace-nowrap text-primary flex-shrink-0"
                      >
                        Search
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <CustomDivider />

                <div ref={modelMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setModelDialogOpen((prev) => !prev)}
                    className={cn(
                      "rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
                      modelDialogOpen
                        ? "bg-primary/15 border-primary text-primary"
                        : "bg-transparent border-transparent text-muted-foreground hover:text-accent-foreground"
                    )}
                  >
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <motion.div
                        whileHover={{
                          rotate: 15,
                          scale: 1.1,
                          transition: { type: "spring", stiffness: 300, damping: 10 },
                        }}
                      >
                        <BrainCog
                          className={cn(
                            "w-4 h-4",
                            modelDialogOpen ? "text-primary" : "text-inherit"
                          )}
                        />
                      </motion.div>
                    </div>
                    {selectedModel && (
                      <span className="text-xs flex-shrink-0 text-primary">
                        {selectedModel.name}
                      </span>
                    )}
                  </button>

                  {modelDialogOpen && (
                    <div className="absolute bottom-full left-0 mb-1.5 z-50 w-[140px] rounded-xl border border-secondary bg-muted p-1 shadow-xl">
                      <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        Select model
                      </p>
                      {models.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-muted-foreground">No models available</p>
                      ) : (
                        models.map((model) => (
                          <button
                            key={model.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onModelChange?.(model);
                              setModelDialogOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center px-2 py-1.5 text-xs rounded-lg transition-colors text-left",
                              selectedModel?.id === model.id
                                ? "bg-primary/25 text-primary font-medium"
                                : "text-accent-foreground hover:bg-accent"
                            )}
                          >
                            {model.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <CustomDivider />

                <button
                  type="button"
                  onClick={() => {
                    setAttachScreenshot((prev) => {
                      const next = !prev;
                      if (next) setAgentMode(false);
                      return next;
                    });
                  }}
                  className={cn(
                    "rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
                    attachScreenshot
                      ? "bg-primary/15 border-primary text-primary"
                      : "bg-transparent border-transparent text-muted-foreground hover:text-accent-foreground"
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <motion.div
                      animate={{
                        rotate: attachScreenshot ? 360 : 0,
                        scale: attachScreenshot ? 1.1 : 1,
                      }}
                      whileHover={{
                        rotate: attachScreenshot ? 360 : 15,
                        scale: 1.1,
                        transition: { type: "spring", stiffness: 300, damping: 10 },
                      }}
                      transition={{ type: "spring", stiffness: 260, damping: 25 }}
                    >
                      <ImageIcon
                        className={cn(
                          "w-4 h-4",
                          attachScreenshot ? "text-primary" : "text-inherit"
                        )}
                      />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {attachScreenshot && (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-xs overflow-hidden whitespace-nowrap text-primary flex-shrink-0"
                      >
                        Screenshot
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            </div>

            <PromptInputAction
              tooltip={
                isLoading
                  ? "Stop generation"
                  : isRecording
                    ? "Stop recording"
                    : hasText
                      ? "Send message"
                      : "Voice message"
              }
            >
              <Button
                variant="default"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full transition-all duration-200",
                  isRecording
                    ? "bg-transparent hover:bg-accent/30 text-red-500 hover:text-red-400"
                    : hasText
                      ? "bg-foreground hover:bg-foreground/80 text-background"
                      : "bg-transparent hover:bg-accent/30 text-muted-foreground hover:text-accent-foreground"
                )}
                onClick={() => {
                  if (isLoading) onStop();
                  else if (isRecording) setIsRecording(false);
                  else if (canSubmit) handleSubmit();
                  else setIsRecording(true);
                }}
              >
                {isLoading ? (
                  <Square className="h-4 w-4 fill-background animate-pulse" />
                ) : isRecording ? (
                  <StopCircle className="h-5 w-5 text-red-500" />
                ) : hasText ? (
                  <ArrowUp className="h-4 w-4 text-background" />
                ) : (
                  <Mic className="h-5 w-5 transition-colors" />
                )}
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </>
    );
  }
);
PromptInputBox.displayName = "PromptInputBox";
