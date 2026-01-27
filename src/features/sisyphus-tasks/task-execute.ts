import { join } from "path"
import { readJsonSafe, writeJsonAtomic } from "./storage"
import { TaskSchema, type Task } from "./types"

export interface TaskExecuteInput {
  taskId: string
  agentId: string
}

export interface TaskExecuteContext {
  taskDir?: string
}

export type TaskExecuteFailReason = "task_not_found" | "already_claimed" | "already_resolved" | "blocked"

export interface TaskExecuteResult {
  success: boolean
  reason?: TaskExecuteFailReason
  task?: Task
  blockedByTasks?: string[]
}

export const taskExecuteTool = {
  name: "TaskExecute",
  description: "Execute/claim a task",
  inputSchema: {
    taskId: { type: "string" },
    agentId: { type: "string" },
  },

  async execute(input: TaskExecuteInput, context?: TaskExecuteContext): Promise<TaskExecuteResult> {
    const taskDir = context?.taskDir ?? process.cwd()
    const taskPath = join(taskDir, `${input.taskId}.json`)
    const task = readJsonSafe(taskPath, TaskSchema)

    if (!task) {
      return { success: false, reason: "task_not_found" }
    }

    if (task.owner && task.status === "in_progress") {
      return { success: false, reason: "already_claimed", task }
    }

    if (task.status === "completed") {
      return { success: false, reason: "already_resolved", task }
    }

    const blockers: string[] = []
    for (const blockerId of task.blockedBy) {
      const blocker = readJsonSafe(join(taskDir, `${blockerId}.json`), TaskSchema)
      if (blocker && blocker.status !== "completed") {
        blockers.push(blockerId)
      }
    }

    if (blockers.length > 0) {
      return { success: false, reason: "blocked", task, blockedByTasks: blockers }
    }

    task.owner = input.agentId
    task.status = "in_progress"
    writeJsonAtomic(taskPath, task)

    return { success: true, task }
  },
}
