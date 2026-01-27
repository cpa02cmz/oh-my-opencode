import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { readdirSync } from "fs"
import { join } from "path"
import { readJsonSafe } from "../../features/sisyphus-tasks/storage"
import { TaskSchema, type Task } from "../../features/sisyphus-tasks/types"
import { formatTaskList } from "../../features/sisyphus-tasks/formatters"

type ToolContextWithMetadata = {
  metadata?: (input: { title?: string; metadata?: Record<string, unknown> }) => void
}

export const taskListTool: ToolDefinition = tool({
  description: "List all tasks in the current task list",
  args: {
    task_dir: tool.schema.string().optional().describe("Task directory (defaults to current working directory)"),
  },
  execute: async (args, context) => {
    const ctx = context as ToolContextWithMetadata
    const taskDir = args.task_dir ?? process.cwd()

    const files = readdirSync(taskDir).filter((f: string) => f.endsWith(".json") && !f.startsWith("."))
    if (files.length === 0) {
      ctx.metadata?.({ title: "Tasks", metadata: { count: 0, status: "empty" } })
      return "No tasks found."
    }

    const tasks: Task[] = []
    const completedIds = new Set<string>()

    for (const file of files) {
      const task = readJsonSafe(join(taskDir, file), TaskSchema)
      if (task) {
        tasks.push(task)
        if (task.status === "completed") completedIds.add(task.id)
      }
    }

    const pending = tasks.filter(t => t.status === "pending").length
    const inProgress = tasks.filter(t => t.status === "in_progress").length
    const completed = tasks.filter(t => t.status === "completed").length

    ctx.metadata?.({
      title: "Tasks",
      metadata: {
        total: tasks.length,
        pending,
        inProgress,
        completed,
        tasks: tasks.map(t => ({ id: t.id, subject: t.subject, status: t.status, owner: t.owner }))
      }
    })

    return formatTaskList(tasks, completedIds)
  }
})
