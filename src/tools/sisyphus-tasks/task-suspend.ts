import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { join } from "path"
import { readJsonSafe, writeJsonAtomic } from "../../features/sisyphus-tasks/storage"
import { TaskSchema } from "../../features/sisyphus-tasks/types"

export const taskSuspendTool: ToolDefinition = tool({
  description: "Suspend a task",
  args: {
    task_id: tool.schema.string().describe("Task ID to suspend"),
    task_dir: tool.schema.string().optional().describe("Task directory (defaults to current working directory)"),
  },
  execute: async (args) => {
    const taskDir = args.task_dir ?? process.cwd()
    const taskPath = join(taskDir, `${args.task_id}.json`)
    const task = readJsonSafe(taskPath, TaskSchema)

    if (!task) return JSON.stringify({ success: false })

    task.status = "pending"
    task.owner = undefined
    writeJsonAtomic(taskPath, task)

    return JSON.stringify({ success: true })
  }
})
