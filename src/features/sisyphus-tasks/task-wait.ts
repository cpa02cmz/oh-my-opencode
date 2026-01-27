import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { join } from "path"
import { readJsonSafe } from "./storage"
import { TaskSchema } from "./types"

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const taskWaitTool: ToolDefinition = tool({
  description: "Wait for a task to complete",
  args: {
    task_id: tool.schema.string().describe("Task ID to wait for"),
    timeout: tool.schema.number().optional().describe("Timeout in milliseconds (default 60000)"),
    task_dir: tool.schema.string().optional().describe("Task directory (defaults to current working directory)"),
  },
  execute: async (args) => {
    const taskDir = args.task_dir ?? process.cwd()
    const taskPath = join(taskDir, `${args.task_id}.json`)
    const timeout = args.timeout ?? 60000
    const pollInterval = 500
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      const task = readJsonSafe(taskPath, TaskSchema)
      if (!task) return JSON.stringify({ completed: false, task: null })
      if (task.status === "completed") return JSON.stringify({ completed: true, task })
      
      await delay(pollInterval)
    }
    
    const task = readJsonSafe(taskPath, TaskSchema)
    const isCompleted = task?.status === "completed"
    return JSON.stringify({ completed: isCompleted ?? false, task })
  }
})
