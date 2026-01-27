import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { join } from "path"
import { readJsonSafe } from "./storage"
import { TaskSchema } from "./types"
import { formatTaskGet } from "./formatters"

export const taskGetTool: ToolDefinition = tool({
  description: "Get a task by ID",
  args: {
    task_id: tool.schema.string().describe("Task ID"),
    task_dir: tool.schema.string().optional().describe("Task directory (defaults to current working directory)"),
  },
  execute: async (args) => {
    const taskDir = args.task_dir ?? process.cwd()
    const task = readJsonSafe(join(taskDir, `${args.task_id}.json`), TaskSchema)
    return formatTaskGet(task)
  },
})
