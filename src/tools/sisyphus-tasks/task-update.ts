import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { join } from "path"
import { unlinkSync } from "fs"
import { readJsonSafe, writeJsonAtomic } from "../../features/sisyphus-tasks/storage"
import { TaskSchema, type Task } from "../../features/sisyphus-tasks/types"
import { formatTaskUpdate } from "../../features/sisyphus-tasks/formatters"

type ToolContextWithMetadata = {
  metadata?: (input: { title?: string; metadata?: Record<string, unknown> }) => void
}

export const taskUpdateTool: ToolDefinition = tool({
  description: "Update a task",
  args: {
    task_id: tool.schema.string().describe("Task ID to update"),
    subject: tool.schema.string().optional().describe("New task title"),
    description: tool.schema.string().optional().describe("New task description"),
    status: tool.schema.string().optional().describe("New status (pending, in_progress, completed, deleted)"),
    add_blocks: tool.schema.string().optional().describe("JSON array of task IDs this task blocks"),
    add_blocked_by: tool.schema.string().optional().describe("JSON array of task IDs that block this task"),
    owner: tool.schema.string().optional().describe("New owner"),
    metadata: tool.schema.string().optional().describe("JSON metadata object to merge"),
    task_dir: tool.schema.string().optional().describe("Task directory (defaults to current working directory)"),
  },
  execute: async (args, context) => {
    const ctx = context as ToolContextWithMetadata
    const taskDir = args.task_dir ?? process.cwd()
    const taskPath = join(taskDir, `${args.task_id}.json`)
    const task = readJsonSafe(taskPath, TaskSchema)

    if (!task) {
      return formatTaskUpdate({ success: false, taskId: args.task_id, updatedFields: [], error: "task_not_found" })
    }

    if (args.status === "deleted") {
      unlinkSync(taskPath)
      return formatTaskUpdate({ success: true, taskId: args.task_id, updatedFields: ["deleted"] })
    }

    const updatedFields: string[] = []

    if (args.subject !== undefined) {
      task.subject = args.subject
      updatedFields.push("subject")
    }
    if (args.description !== undefined) {
      task.description = args.description
      updatedFields.push("description")
    }
    if (args.status !== undefined) {
      task.status = args.status as Task["status"]
      updatedFields.push("status")
    }
    if (args.owner !== undefined) {
      task.owner = args.owner
      updatedFields.push("owner")
    }
    if (args.metadata !== undefined) {
      const metadata = JSON.parse(args.metadata)
      task.metadata = { ...task.metadata, ...metadata }
      updatedFields.push("metadata")
    }

    const addBlockedBy = args.add_blocked_by ? JSON.parse(args.add_blocked_by) as string[] : []
    if (addBlockedBy.length) {
      for (const blockerId of addBlockedBy) {
        if (!task.blockedBy.includes(blockerId)) {
          task.blockedBy.push(blockerId)
        }
        const blockerPath = join(taskDir, `${blockerId}.json`)
        const blocker = readJsonSafe(blockerPath, TaskSchema)
        if (blocker && !blocker.blocks.includes(args.task_id)) {
          blocker.blocks.push(args.task_id)
          writeJsonAtomic(blockerPath, blocker)
        }
      }
      updatedFields.push("blockedBy")
    }

    const addBlocks = args.add_blocks ? JSON.parse(args.add_blocks) as string[] : []
    if (addBlocks.length) {
      for (const blockedId of addBlocks) {
        if (!task.blocks.includes(blockedId)) {
          task.blocks.push(blockedId)
        }
        const blockedPath = join(taskDir, `${blockedId}.json`)
        const blocked = readJsonSafe(blockedPath, TaskSchema)
        if (blocked && !blocked.blockedBy.includes(args.task_id)) {
          blocked.blockedBy.push(args.task_id)
          writeJsonAtomic(blockedPath, blocked)
        }
      }
      updatedFields.push("blocks")
    }

    writeJsonAtomic(taskPath, task)
    return formatTaskUpdate({ success: true, taskId: args.task_id, updatedFields })
  },
})
