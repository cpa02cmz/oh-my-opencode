import { join } from "path"
import { readJsonSafe } from "./storage"
import { TaskSchema, type Task } from "./types"

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const taskWaitTool = {
  name: "TaskWait",
  description: "Wait for a task to complete",
  inputSchema: {
    taskId: { type: "string" },
    timeout: { type: "number", optional: true }
  },
  
  async execute(input: { taskId: string; timeout?: number }, context?: { taskDir?: string }): Promise<{
    completed: boolean
    task: Task | null
  }> {
    const taskDir = context?.taskDir ?? process.cwd()
    const taskPath = join(taskDir, `${input.taskId}.json`)
    const timeout = input.timeout ?? 60000
    const pollInterval = 500
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      const task = readJsonSafe(taskPath, TaskSchema)
      if (!task) return { completed: false, task: null }
      if (task.status === "completed") return { completed: true, task }
      
      await delay(pollInterval)
    }
    
    const task = readJsonSafe(taskPath, TaskSchema)
    const isCompleted = task?.status === "completed"
    return { completed: isCompleted ?? false, task }
  }
}
