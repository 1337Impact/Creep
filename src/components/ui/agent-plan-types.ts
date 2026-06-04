/** UI plan types for visualizing streamed agent steps (maps from AgentEvent). */

export type AgentPlanStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "need-help"
  | "failed";

export interface AgentPlanSubtask {
  id: string;
  title: string;
  description: string;
  status: AgentPlanStatus;
  /** Tool name(s) involved — e.g. observe_page, click */
  tools?: string[];
}

export interface AgentPlanTask {
  id: string;
  title: string;
  description: string;
  status: AgentPlanStatus;
  step: number;
  subtasks: AgentPlanSubtask[];
}
