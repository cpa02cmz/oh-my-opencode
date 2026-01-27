import { join } from "path"
import { unlinkSync, readdirSync, existsSync } from "fs"
import { readJsonSafe, writeJsonAtomic } from "../../features/sisyphus-tasks/storage"
import { TaskSchema } from "../../features/sisyphus-tasks/types"

export const taskAbortTool = {
  name: "TaskAbort",
  description: "Abort and delete a task",
  inputSchema: { taskId: { type: "string" } },

  async execute(
    input: { taskId: string },
    context?: { taskDir?: string }
  ): Promise<{ success: boolean }> {
    const taskDir = context?.taskDir ?? process.cwd()
    const taskPath = join(taskDir, `${input.taskId}.json`)

    if (!existsSync(taskPath)) return { success: false }

    const files = readdirSync(taskDir).filter(
      (f) => f.endsWith(".json") && f !== `${input.taskId}.json`
    )
    for (const file of files) {
      const otherPath = join(taskDir, file)
      const other = readJsonSafe(otherPath, TaskSchema)
      if (other) {
        let changed = false
        if (other.blocks.includes(input.taskId)) {
          other.blocks = other.blocks.filter((id) => id !== input.taskId)
          changed = true
        }
        if (other.blockedBy.includes(input.taskId)) {
          other.blockedBy = other.blockedBy.filter((id) => id !== input.taskId)
          changed = true
        }
        if (changed) writeJsonAtomic(otherPath, other)
      }
    }

    unlinkSync(taskPath)
    return { success: true }
  },
}
