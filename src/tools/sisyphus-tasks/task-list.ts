import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { readdirSync } from "fs"
import { join } from "path"
import { readJsonSafe } from "../../features/sisyphus-tasks/storage"
import { TaskSchema, type Task } from "../../features/sisyphus-tasks/types"

export const taskListTool: ToolDefinition = tool({
  description: "List all tasks in the current task list",
  args: {
    task_dir: tool.schema.string().optional().describe("Task directory (defaults to current working directory)"),
  },
  execute: async (args) => {
    const taskDir = args.task_dir ?? process.cwd()

    const files = readdirSync(taskDir).filter((f: string) => f.endsWith(".json") && !f.startsWith("."))
    if (files.length === 0) return "No tasks found."

    const tasks: Task[] = []
    const completedIds = new Set<string>()

    for (const file of files) {
      const task = readJsonSafe(join(taskDir, file), TaskSchema)
      if (task) {
        tasks.push(task)
        if (task.status === "completed") completedIds.add(task.id)
      }
    }

    const lines = tasks.map(t => {
      const ownerPart = t.owner ? ` (${t.owner})` : ""
      const blockedBy = t.blockedBy.filter(id => !completedIds.has(id))
      const blockedPart = blockedBy.length > 0 ? ` [blocked by ${blockedBy.map(id => `#${id}`).join(", ")}]` : ""
      return `#${t.id} [${t.status}] ${t.subject}${ownerPart}${blockedPart}`
    })

    return lines.join("\n")
  }
})
