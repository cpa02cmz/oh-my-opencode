import type { Task } from "./types"

const STATUS_ICONS: Record<Task["status"], string> = {
  pending: "○",
  in_progress: "●",
  completed: "✓",
}

export function formatTaskList(tasks: Task[], completedIds: Set<string>): string {
  if (tasks.length === 0) return "No tasks found."

  const pending = tasks.filter(t => t.status === "pending")
  const inProgress = tasks.filter(t => t.status === "in_progress")
  const completed = tasks.filter(t => t.status === "completed")

  const lines: string[] = []

  if (inProgress.length > 0) {
    lines.push(`**In Progress (${inProgress.length})**`)
    for (const t of inProgress) {
      lines.push(formatTaskLine(t, completedIds))
    }
    lines.push("")
  }

  if (pending.length > 0) {
    lines.push(`**Pending (${pending.length})**`)
    for (const t of pending) {
      lines.push(formatTaskLine(t, completedIds))
    }
    lines.push("")
  }

  if (completed.length > 0) {
    lines.push(`**Completed (${completed.length})**`)
    for (const t of completed) {
      lines.push(formatTaskLine(t, completedIds))
    }
  }

  return lines.join("\n").trim()
}

function formatTaskLine(task: Task, completedIds: Set<string>): string {
  const icon = STATUS_ICONS[task.status]
  const ownerPart = task.owner ? ` @${task.owner}` : ""
  const blockedBy = task.blockedBy.filter(id => !completedIds.has(id))
  const blockedPart = blockedBy.length > 0 ? ` ⏳blocked by ${blockedBy.map(id => `#${id}`).join(", ")}` : ""
  return `${icon} #${task.id} ${task.subject}${ownerPart}${blockedPart}`
}

export function formatTaskCreate(task: { id: string; subject: string }): string {
  return `✓ Task #${task.id} created: "${task.subject}"`
}

export function formatTaskGet(task: Task | null): string {
  if (!task) return "Task not found."

  const lines = [
    `**Task #${task.id}**`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Subject | ${task.subject} |`,
    `| Status | ${STATUS_ICONS[task.status]} ${task.status} |`,
  ]

  if (task.owner) {
    lines.push(`| Owner | @${task.owner} |`)
  }
  if (task.description) {
    lines.push(`| Description | ${task.description} |`)
  }
  if (task.blockedBy.length > 0) {
    lines.push(`| Blocked by | ${task.blockedBy.map(id => `#${id}`).join(", ")} |`)
  }
  if (task.blocks.length > 0) {
    lines.push(`| Blocks | ${task.blocks.map(id => `#${id}`).join(", ")} |`)
  }

  return lines.join("\n")
}

export function formatTaskExecute(result: {
  success: boolean
  reason?: string
  task?: Task
  blockedByTasks?: string[]
}): string {
  if (result.success && result.task) {
    return `✓ Claimed task #${result.task.id}: "${result.task.subject}"\n  Status: ${STATUS_ICONS.in_progress} in_progress | Owner: @${result.task.owner}`
  }

  const reasons: Record<string, string> = {
    task_not_found: "✗ Task not found",
    already_claimed: `✗ Task #${result.task?.id} already claimed by @${result.task?.owner}`,
    already_resolved: `✗ Task #${result.task?.id} already completed`,
    blocked: `✗ Task #${result.task?.id} blocked by ${result.blockedByTasks?.map(id => `#${id}`).join(", ")}`,
  }

  return reasons[result.reason ?? ""] ?? "✗ Failed to execute task"
}

export function formatTaskUpdate(result: {
  success: boolean
  taskId: string
  updatedFields: string[]
  error?: string
}): string {
  if (!result.success) {
    return `✗ Failed to update task #${result.taskId}: ${result.error ?? "unknown error"}`
  }

  if (result.updatedFields.includes("deleted")) {
    return `✓ Task #${result.taskId} deleted`
  }

  return `✓ Task #${result.taskId} updated: ${result.updatedFields.join(", ")}`
}

export function formatTaskSuspend(result: { success: boolean; taskId?: string }): string {
  if (result.success) {
    return `✓ Task #${result.taskId} suspended (status → pending, owner cleared)`
  }
  return `✗ Failed to suspend task`
}

export function formatTaskAbort(result: { success: boolean; taskId: string }): string {
  if (result.success) {
    return `✓ Task #${result.taskId} aborted and removed`
  }
  return `✗ Failed to abort task #${result.taskId}`
}

export function formatTaskResume(result: {
  success: boolean
  reason?: string
  task?: Task
  busyWithTasks?: string[]
  blockedByTasks?: string[]
}): string {
  if (result.success && result.task) {
    return `✓ Resumed task #${result.task.id}: "${result.task.subject}"\n  Status: ${STATUS_ICONS.in_progress} in_progress | Owner: @${result.task.owner}`
  }

  if (result.reason === "agent_busy") {
    return `✗ Agent busy with tasks: ${result.busyWithTasks?.map(id => `#${id}`).join(", ")}`
  }

  return `✗ Failed to resume task`
}

export function formatTaskWait(result: {
  completed: boolean
  task?: Task
  timedOut?: boolean
}): string {
  if (result.completed && result.task) {
    return `✓ Task #${result.task.id} completed`
  }
  if (result.timedOut && result.task) {
    return `⏳ Timeout waiting for task #${result.task.id} (current status: ${result.task.status})`
  }
  return `○ Task not yet completed (status: ${result.task?.status ?? "unknown"})`
}

export function formatTeammate(result: {
  success: boolean
  teammate?: { name: string; team: string; mode: string }
}): string {
  if (result.success && result.teammate) {
    return `✓ Teammate "${result.teammate.name}" spawned\n  Team: ${result.teammate.team} | Mode: ${result.teammate.mode}`
  }
  return `✗ Failed to spawn teammate`
}
