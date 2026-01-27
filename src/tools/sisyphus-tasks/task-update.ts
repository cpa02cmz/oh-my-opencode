import { join } from "path"
import { unlinkSync } from "fs"
import { readJsonSafe, writeJsonAtomic } from "../../features/sisyphus-tasks/storage"
import { TaskSchema, type Task, type TaskUpdateInput } from "../../features/sisyphus-tasks/types"

export const taskUpdateTool = {
  name: "TaskUpdate",
  description: "Update a task",
  inputSchema: {
    taskId: { type: "string" },
    subject: { type: "string", optional: true },
    description: { type: "string", optional: true },
    status: { type: "string", optional: true },
    addBlocks: { type: "array", optional: true },
    addBlockedBy: { type: "array", optional: true },
    owner: { type: "string", optional: true },
    metadata: { type: "object", optional: true },
  },

  async execute(
    input: TaskUpdateInput,
    context?: { taskDir?: string }
  ): Promise<{
    success: boolean
    taskId: string
    updatedFields: string[]
    error?: string
  }> {
    const taskDir = context?.taskDir ?? process.cwd()
    const taskPath = join(taskDir, `${input.taskId}.json`)
    const task = readJsonSafe(taskPath, TaskSchema)

    if (!task) {
      return { success: false, taskId: input.taskId, updatedFields: [], error: "task_not_found" }
    }

    if (input.status === "deleted") {
      unlinkSync(taskPath)
      return { success: true, taskId: input.taskId, updatedFields: ["deleted"] }
    }

    const updatedFields: string[] = []

    if (input.subject !== undefined) {
      task.subject = input.subject
      updatedFields.push("subject")
    }
    if (input.description !== undefined) {
      task.description = input.description
      updatedFields.push("description")
    }
    if (input.status !== undefined) {
      task.status = input.status as Task["status"]
      updatedFields.push("status")
    }
    if (input.owner !== undefined) {
      task.owner = input.owner
      updatedFields.push("owner")
    }
    if (input.metadata !== undefined) {
      task.metadata = { ...task.metadata, ...input.metadata }
      updatedFields.push("metadata")
    }

    if (input.addBlockedBy?.length) {
      for (const blockerId of input.addBlockedBy) {
        if (!task.blockedBy.includes(blockerId)) {
          task.blockedBy.push(blockerId)
        }
        const blockerPath = join(taskDir, `${blockerId}.json`)
        const blocker = readJsonSafe(blockerPath, TaskSchema)
        if (blocker && !blocker.blocks.includes(input.taskId)) {
          blocker.blocks.push(input.taskId)
          writeJsonAtomic(blockerPath, blocker)
        }
      }
      updatedFields.push("blockedBy")
    }

    if (input.addBlocks?.length) {
      for (const blockedId of input.addBlocks) {
        if (!task.blocks.includes(blockedId)) {
          task.blocks.push(blockedId)
        }
        const blockedPath = join(taskDir, `${blockedId}.json`)
        const blocked = readJsonSafe(blockedPath, TaskSchema)
        if (blocked && !blocked.blockedBy.includes(input.taskId)) {
          blocked.blockedBy.push(input.taskId)
          writeJsonAtomic(blockedPath, blocked)
        }
      }
      updatedFields.push("blocks")
    }

    writeJsonAtomic(taskPath, task)
    return { success: true, taskId: input.taskId, updatedFields }
  },
}
