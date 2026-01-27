import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { join } from "path"
import { readJsonSafe, writeJsonAtomic } from "./storage"
import { TaskSchema } from "./types"

export type TaskExecuteFailReason = "task_not_found" | "already_claimed" | "already_resolved" | "blocked"

export const taskExecuteTool: ToolDefinition = tool({
  description: "Execute/claim a task",
  args: {
    task_id: tool.schema.string().describe("Task ID to execute"),
    agent_id: tool.schema.string().describe("Agent ID claiming the task"),
    task_dir: tool.schema.string().optional().describe("Task directory (defaults to current working directory)"),
  },
  execute: async (args) => {
    const taskDir = args.task_dir ?? process.cwd()
    const taskPath = join(taskDir, `${args.task_id}.json`)
    const task = readJsonSafe(taskPath, TaskSchema)

    if (!task) {
      return JSON.stringify({ success: false, reason: "task_not_found" })
    }

    if (task.owner && task.status === "in_progress") {
      return JSON.stringify({ success: false, reason: "already_claimed", task })
    }

    if (task.status === "completed") {
      return JSON.stringify({ success: false, reason: "already_resolved", task })
    }

    const blockers: string[] = []
    for (const blockerId of task.blockedBy) {
      const blocker = readJsonSafe(join(taskDir, `${blockerId}.json`), TaskSchema)
      if (blocker && blocker.status !== "completed") {
        blockers.push(blockerId)
      }
    }

    if (blockers.length > 0) {
      return JSON.stringify({ success: false, reason: "blocked", task, blockedByTasks: blockers })
    }

    task.owner = args.agent_id
    task.status = "in_progress"
    writeJsonAtomic(taskPath, task)

    return JSON.stringify({ success: true, task })
  },
})
