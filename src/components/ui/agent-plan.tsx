"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { cn } from "@/utils";
import type { AgentPlanStatus, AgentPlanTask } from "./agent-plan-types";

export type { AgentPlanStatus, AgentPlanSubtask, AgentPlanTask } from "./agent-plan-types";
export { agentEventsToPlanTasks } from "./agent-plan-mapper";

export interface AgentPlanProps {
  tasks: AgentPlanTask[];
  defaultExpandedTaskIds?: string[];
  className?: string;
}

function StatusIcon({
  status,
  size = "md",
}: {
  status: AgentPlanStatus;
  size?: "sm" | "md";
}) {
  const className = size === "sm" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]";

  switch (status) {
    case "completed":
      return <CheckCircle2 className={cn(className, "text-green-500")} />;
    case "in-progress":
      return <CircleDotDashed className={cn(className, "text-blue-400")} />;
    case "need-help":
      return <CircleAlert className={cn(className, "text-yellow-500")} />;
    case "failed":
      return <CircleX className={cn(className, "text-red-500")} />;
    default:
      return <Circle className={cn(className, "text-gray-500")} />;
  }
}

function statusBadgeClass(status: AgentPlanStatus): string {
  switch (status) {
    case "completed":
      return "bg-green-900/40 text-green-400";
    case "in-progress":
      return "bg-blue-900/40 text-blue-300";
    case "need-help":
      return "bg-yellow-900/40 text-yellow-400";
    case "failed":
      return "bg-red-900/40 text-red-400";
    default:
      return "bg-gray-700 text-gray-400";
  }
}

export function AgentPlan({
  tasks,
  defaultExpandedTaskIds,
  className,
}: AgentPlanProps) {
  const initialExpanded = useMemo(
    () =>
      defaultExpandedTaskIds ??
      tasks.filter((t) => t.status === "in-progress").map((t) => t.id).slice(0, 1),
    [defaultExpandedTaskIds, tasks]
  );

  const [expandedTasks, setExpandedTasks] = useState<string[]>(initialExpanded);
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const toggleSubtaskExpansion = (taskId: string, subtaskId: string) => {
    const key = `${taskId}-${subtaskId}`;
    setExpandedSubtasks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const springTransition = prefersReducedMotion
    ? ({ type: "tween" as const, duration: 0.2 })
    : ({ type: "spring" as const, stiffness: 500, damping: 30 });

  const taskVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : -5 },
    visible: {
      opacity: 1,
      y: 0,
      transition: springTransition,
    },
  };

  const subtaskListVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" as const },
    visible: {
      height: "auto",
      opacity: 1,
      overflow: "visible" as const,
      transition: {
        duration: 0.25,
        staggerChildren: prefersReducedMotion ? 0 : 0.05,
        when: "beforeChildren" as const,
        ease: [0.2, 0.65, 0.3, 0.9] as [number, number, number, number],
      },
    },
    exit: {
      height: 0,
      opacity: 0,
      overflow: "hidden" as const,
      transition: {
        duration: 0.2,
        ease: [0.2, 0.65, 0.3, 0.9] as [number, number, number, number],
      },
    },
  };

  const subtaskSpringTransition = prefersReducedMotion
    ? ({ type: "tween" as const, duration: 0.2 })
    : ({ type: "spring" as const, stiffness: 500, damping: 25 });

  const subtaskVariants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -10 },
    visible: {
      opacity: 1,
      x: 0,
      transition: subtaskSpringTransition,
    },
  };

  const subtaskDetailsVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" as const },
    visible: {
      opacity: 1,
      height: "auto",
      overflow: "visible" as const,
      transition: {
        duration: 0.25,
        ease: [0.2, 0.65, 0.3, 0.9] as [number, number, number, number],
      },
    },
  };

  return (
    <div className={cn("text-gray-100 h-full overflow-auto", className)}>
      <motion.div
        className="bg-gray-800 border border-gray-700 rounded-lg shadow overflow-hidden"
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: [0.2, 0.65, 0.3, 0.9] },
        }}
      >
        <LayoutGroup>
          <div className="p-3 overflow-hidden">
            <ul className="space-y-1 overflow-hidden">
              {tasks.map((task, index) => {
                const isExpanded = expandedTasks.includes(task.id);
                const isCompleted = task.status === "completed";

                return (
                  <motion.li
                    key={task.id}
                    className={cn(index !== 0 && "mt-1 pt-2")}
                    initial="hidden"
                    animate="visible"
                    variants={taskVariants}
                  >
                    <motion.div
                      className="group flex items-center px-2 py-1.5 rounded-md"
                      whileHover={{
                        backgroundColor: "rgba(255,255,255,0.04)",
                        transition: { duration: 0.2 },
                      }}
                    >
                      <div className="mr-2 flex-shrink-0">
                        <StatusIcon status={task.status} />
                      </div>

                      <div
                        className="flex min-w-0 flex-grow cursor-pointer items-center justify-between"
                        onClick={() => toggleTaskExpansion(task.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleTaskExpansion(task.id);
                          }
                        }}
                      >
                        <div className="mr-2 flex-1 min-w-0">
                          <span
                            className={cn(
                              "text-sm block truncate",
                              isCompleted && "text-gray-500 line-through"
                            )}
                          >
                            {task.title}
                          </span>
                          {task.description && !isExpanded && (
                            <span className="text-xs text-gray-500 truncate block">
                              {task.description}
                            </span>
                          )}
                        </div>

                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0",
                            statusBadgeClass(task.status)
                          )}
                        >
                          {task.status}
                        </span>
                      </div>
                    </motion.div>

                    <AnimatePresence mode="wait">
                      {isExpanded && task.subtasks.length > 0 && (
                        <motion.div
                          className="relative overflow-hidden"
                          variants={subtaskListVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          layout
                        >
                          <div className="absolute top-0 bottom-0 left-[18px] border-l-2 border-dashed border-gray-600/50" />
                          <ul className="mt-1 mr-1 mb-1.5 ml-2 space-y-0.5">
                            {task.subtasks.map((subtask) => {
                              const subtaskKey = `${task.id}-${subtask.id}`;
                              const isSubtaskExpanded = expandedSubtasks[subtaskKey];

                              return (
                                <motion.li
                                  key={subtask.id}
                                  className="group flex flex-col py-0.5 pl-5"
                                  variants={subtaskVariants}
                                  initial="hidden"
                                  animate="visible"
                                  layout
                                >
                                  <motion.div
                                    className="flex flex-1 items-center rounded-md p-1 cursor-pointer"
                                    whileHover={{
                                      backgroundColor: "rgba(255,255,255,0.04)",
                                      transition: { duration: 0.2 },
                                    }}
                                    onClick={() =>
                                      toggleSubtaskExpansion(task.id, subtask.id)
                                    }
                                    layout
                                  >
                                    <div className="mr-2 flex-shrink-0">
                                      <StatusIcon status={subtask.status} size="sm" />
                                    </div>
                                    <span
                                      className={cn(
                                        "text-xs",
                                        subtask.status === "completed" &&
                                          "text-gray-500 line-through"
                                      )}
                                    >
                                      {subtask.title}
                                    </span>
                                  </motion.div>

                                  <AnimatePresence mode="wait">
                                    {isSubtaskExpanded && (
                                      <motion.div
                                        className="text-gray-400 border-gray-600 mt-1 ml-1.5 border-l border-dashed pl-4 text-xs overflow-hidden"
                                        variants={subtaskDetailsVariants}
                                        initial="hidden"
                                        animate="visible"
                                        exit="hidden"
                                        layout
                                      >
                                        <p className="py-1">{subtask.description}</p>
                                        {subtask.tools && subtask.tools.length > 0 && (
                                          <div className="mt-0.5 mb-1 flex flex-wrap items-center gap-1.5">
                                            <span className="text-gray-500 font-medium">
                                              Tools:
                                            </span>
                                            <div className="flex flex-wrap gap-1">
                                              {subtask.tools.map((tool) => (
                                                <span
                                                  key={tool}
                                                  className="bg-gray-700/60 text-gray-300 rounded px-1.5 py-0.5 text-[10px] font-medium"
                                                >
                                                  {tool}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </motion.li>
                              );
                            })}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </LayoutGroup>
      </motion.div>
    </div>
  );
}

export default AgentPlan;
