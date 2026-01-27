import { readdirSync } from "fs"
import { join } from "path"
import { writeJsonAtomic, ensureDir } from "../../features/sisyphus-tasks/storage"
import type { Task, TaskCreateInput } from "../../features/sisyphus-tasks/types"

export const taskCreateTool = {
  name: "TaskCreate",
  description: "Create a new task",
  inputSchema: {
    subject: { type: "string", description: "Task title" },
    description: { type: "string", description: "Task description" },
    activeForm: { type: "string", optional: true },
    metadata: { type: "object", optional: true }
  },

  async execute(input: TaskCreateInput, context?: { taskDir?: string }): Promise<{ task: { id: string; subject: string } }> {
    const taskDir = context?.taskDir ?? process.cwd()
    ensureDir(taskDir)

    const files = readdirSync(taskDir).filter((f: string) => f.endsWith(".json") && !f.startsWith("."))
    const ids = files.map((f: string) => parseInt(f.replace(".json", ""), 10)).filter((n: number) => !isNaN(n))
    const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1

    const task: Task = {
      id: String(nextId),
      subject: input.subject,
      description: input.description,
      activeForm: input.activeForm,
      status: "pending",
      blocks: [],
      blockedBy: [],
      metadata: input.metadata
    }

    writeJsonAtomic(join(taskDir, `${nextId}.json`), task)

    return { task: { id: task.id, subject: task.subject } }
  }
}
