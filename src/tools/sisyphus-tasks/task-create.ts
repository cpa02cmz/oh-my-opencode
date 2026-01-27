import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { readdirSync } from "fs"
import { join } from "path"
import { writeJsonAtomic, ensureDir } from "../../features/sisyphus-tasks/storage"
import type { Task } from "../../features/sisyphus-tasks/types"
import { formatTaskCreate } from "../../features/sisyphus-tasks/formatters"

export const taskCreateTool: ToolDefinition = tool({
  description: "Create a new task",
  args: {
    subject: tool.schema.string().describe("Task title"),
    description: tool.schema.string().describe("Task description"),
    active_form: tool.schema.string().optional().describe("Active form"),
    metadata: tool.schema.string().optional().describe("JSON metadata object"),
    task_dir: tool.schema.string().optional().describe("Task directory (defaults to current working directory)"),
  },
  execute: async (args) => {
    const taskDir = args.task_dir ?? process.cwd()
    ensureDir(taskDir)

    const files = readdirSync(taskDir).filter((f: string) => f.endsWith(".json") && !f.startsWith("."))
    const ids = files.map((f: string) => parseInt(f.replace(".json", ""), 10)).filter((n: number) => !isNaN(n))
    const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1

    const metadata = args.metadata ? JSON.parse(args.metadata) : undefined

    const task: Task = {
      id: String(nextId),
      subject: args.subject,
      description: args.description,
      activeForm: args.active_form,
      status: "pending",
      blocks: [],
      blockedBy: [],
      metadata
    }

    writeJsonAtomic(join(taskDir, `${nextId}.json`), task)

    return formatTaskCreate({ id: task.id, subject: task.subject })
  }
})
