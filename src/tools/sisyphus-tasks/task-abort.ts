import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { join } from "path"
import { unlinkSync, readdirSync, existsSync } from "fs"
import { readJsonSafe, writeJsonAtomic } from "../../features/sisyphus-tasks/storage"
import { TaskSchema } from "../../features/sisyphus-tasks/types"
import { formatTaskAbort } from "../../features/sisyphus-tasks/formatters"

export const taskAbortTool: ToolDefinition = tool({
  description: "Abort and delete a task",
  args: {
    task_id: tool.schema.string().describe("Task ID to abort"),
    task_dir: tool.schema.string().optional().describe("Task directory (defaults to current working directory)"),
  },
  execute: async (args) => {
    const taskDir = args.task_dir ?? process.cwd()
    const taskPath = join(taskDir, `${args.task_id}.json`)

    if (!existsSync(taskPath)) return formatTaskAbort({ success: false, taskId: args.task_id })

    const files = readdirSync(taskDir).filter(
      (f) => f.endsWith(".json") && f !== `${args.task_id}.json`
    )
    for (const file of files) {
      const otherPath = join(taskDir, file)
      const other = readJsonSafe(otherPath, TaskSchema)
      if (other) {
        let changed = false
        if (other.blocks.includes(args.task_id)) {
          other.blocks = other.blocks.filter((id) => id !== args.task_id)
          changed = true
        }
        if (other.blockedBy.includes(args.task_id)) {
          other.blockedBy = other.blockedBy.filter((id) => id !== args.task_id)
          changed = true
        }
        if (changed) writeJsonAtomic(otherPath, other)
      }
    }

    unlinkSync(taskPath)
    return formatTaskAbort({ success: true, taskId: args.task_id })
  },
})
