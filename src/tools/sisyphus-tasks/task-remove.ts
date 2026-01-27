import { taskAbortTool } from "./task-abort"

export const taskRemoveTool = {
  name: "TaskRemove",
  description: "Remove a task (alias for TaskAbort)",
  inputSchema: { taskId: { type: "string" } },

  async execute(
    input: { taskId: string },
    context?: { taskDir?: string }
  ): Promise<{ success: boolean }> {
    return taskAbortTool.execute(input, context)
  },
}
