import { join } from "path"
import { readJsonSafe } from "./storage"
import { TaskSchema, type Task } from "./types"

export const taskGetTool = {
  name: "TaskGet",
  description: "Get a task by ID",
  inputSchema: { taskId: { type: "string", description: "Task ID" } },

  async execute(
    input: { taskId: string },
    context?: { taskDir?: string }
  ): Promise<{ task: Task | null }> {
    const taskDir = context?.taskDir ?? process.cwd()
    const task = readJsonSafe(join(taskDir, `${input.taskId}.json`), TaskSchema)
    return { task }
  },
}
