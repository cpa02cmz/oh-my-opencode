import { join } from "path"
import { readJsonSafe, writeJsonAtomic } from "../../features/sisyphus-tasks/storage"
import { TaskSchema } from "../../features/sisyphus-tasks/types"

export const taskSuspendTool = {
  name: "TaskSuspend",
  description: "Suspend a task",
  inputSchema: { taskId: { type: "string" } },

  async execute(input: { taskId: string }, context?: { taskDir?: string }): Promise<{ success: boolean }> {
    const taskDir = context?.taskDir ?? process.cwd()
    const taskPath = join(taskDir, `${input.taskId}.json`)
    const task = readJsonSafe(taskPath, TaskSchema)

    if (!task) return { success: false }

    task.status = "pending"
    task.owner = undefined
    writeJsonAtomic(taskPath, task)

    return { success: true }
  }
}
