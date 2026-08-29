import MarkdownPreview from "@uiw/react-markdown-preview";
import { Loader2 } from "lucide-react";
import { AgentPlan, agentEventsToPlanTasks } from "@/components/ui/agent-plan";
import type { CursorChatMessage } from "@/types/chat";
import { cn } from "@/utils";

interface CursorMessageBubbleProps {
  message: CursorChatMessage;
}

export function CursorMessageBubble({ message }: CursorMessageBubbleProps) {
  const tasks = agentEventsToPlanTasks(message.events);
  const isRunning = message.status === "running";

  return (
    <div className="space-y-3">
      {tasks.length > 0 && <AgentPlan tasks={tasks} />}

      {isRunning && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          <span>
            {message.events.length === 0 ? "Starting Cursor agent…" : "Running tools…"}
          </span>
        </div>
      )}

      {message.text && (
        <MarkdownPreview
          source={message.text}
          wrapperElement={{ "data-color-mode": "dark" }}
          className={cn(message.status === "error" && "text-red-300")}
          style={{ backgroundColor: "transparent", color: "inherit" }}
        />
      )}

      {message.status === "error" && !message.text && (
        <p className="text-sm text-red-300">The Cursor agent run failed.</p>
      )}
    </div>
  );
}

export default CursorMessageBubble;
