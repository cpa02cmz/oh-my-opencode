import { join } from "path"
import { readdirSync } from "fs"
import { readJsonSafe, writeJsonAtomic } from "./storage"
import { TaskSchema, type Task } from "./types"

export const taskResumeTool = {
  name: "TaskResume",
  description: "Resume a task (checks if agent is busy)",
  inputSchema: {
    taskId: { type: "string" },
    agentId: { type: "string" },
  },

  async execute(
    input: { taskId: string; agentId: string },
    context?: { taskDir?: string }
  ): Promise<{
    success: boolean
    reason?: "task_not_found" | "already_claimed" | "already_resolved" | "blocked" | "agent_busy"
    task?: Task
    blockedByTasks?: string[]
    busyWithTasks?: string[]
  }> {
    const taskDir = context?.taskDir ?? process.cwd()

    const files = readdirSync(taskDir).filter((f: string) => f.endsWith(".json"))
    const busyTasks: string[] = []
    for (const file of files) {
      const t = readJsonSafe(join(taskDir, file), TaskSchema)
      if (t && t.owner === input.agentId && t.status === "in_progress" && t.id !== input.taskId) {
        busyTasks.push(t.id)
      }
    }
    if (busyTasks.length > 0) {
      return { success: false, reason: "agent_busy", busyWithTasks: busyTasks }
    }

    const taskPath = join(taskDir, `${input.taskId}.json`)
    const task = readJsonSafe(taskPath, TaskSchema)

    if (!task) return { success: false, reason: "task_not_found" }
    if (task.owner && task.owner !== input.agentId && task.status === "in_progress") {
      return { success: false, reason: "already_claimed", task }
    }
    if (task.status === "completed") return { success: false, reason: "already_resolved", task }

    const blockers: string[] = []
    for (const blockerId of task.blockedBy) {
      const blocker = readJsonSafe(join(taskDir, `${blockerId}.json`), TaskSchema)
      if (blocker && blocker.status !== "completed") blockers.push(blockerId)
    }
    if (blockers.length > 0) return { success: false, reason: "blocked", task, blockedByTasks: blockers }

    task.owner = input.agentId
    task.status = "in_progress"
    writeJsonAtomic(taskPath, task)

    return { success: true, task }
  },
}
