import MarkdownPreview from "@uiw/react-markdown-preview";
import { Loader2 } from "lucide-react";
import { AgentPlan, agentEventsToPlanTasks } from "@/components/ui/agent-plan";
import { useAgentRunDisplay } from "@/hooks/useAgentRunDisplay";
import type { AgentChatMessage } from "@/types/chat";
import { cn } from "@/utils";

interface AgentMessageBubbleProps {
  message: AgentChatMessage;
}

export function AgentMessageBubble({ message }: AgentMessageBubbleProps) {
  const events = useAgentRunDisplay(message.agentId, message.status);
  const tasks = agentEventsToPlanTasks(events);
  const isRunning = message.status === "running";

  return (
    <div className="space-y-3">
      {tasks.length > 0 && <AgentPlan tasks={tasks} />}

      {isRunning && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          <span>
            {events.length === 0 ? "Starting agent run…" : "Running tools…"}
          </span>
        </div>
      )}

      {message.text && (
        <MarkdownPreview
          source={message.text}
          wrapperElement={{
            "data-color-mode": "dark",
          }}
          className={cn(message.status === "error" && "text-red-300")}
          style={{ backgroundColor: "transparent", color: "inherit" }}
        />
      )}

      {message.status === "done" && message.toolCallCount != null && message.toolCallCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {message.toolCallCount} tool{message.toolCallCount === 1 ? "" : "s"} used
        </p>
      )}

      {message.status === "error" && !message.text && (
        <p className="text-sm text-red-300">The agent run failed.</p>
      )}
    </div>
  );
}

export default AgentMessageBubble;
