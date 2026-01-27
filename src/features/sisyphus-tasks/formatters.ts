import type { Task } from "./types"

const STATUS_ICONS: Record<Task["status"], string> = {
  open: "○",
  in_progress: "●",
  completed: "✓",
}

export function formatTaskList(tasks: Task[], completedIds: Set<string>): string {
  if (tasks.length === 0) return "No tasks found."

  const open = tasks.filter(t => t.status === "open")
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

  if (open.length > 0) {
    lines.push(`**Open (${open.length})**`)
    for (const t of open) {
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
  const dependsOn = task.dependsOn.filter(id => !completedIds.has(id))
  const dependsPart = dependsOn.length > 0 ? ` ⏳depends on ${dependsOn.map(id => `#${id}`).join(", ")}` : ""
  return `${icon} #${task.id} ${task.title}${ownerPart}${dependsPart}`
}

export function formatTaskCreate(task: { id: string; title: string }): string {
  return `✓ Task #${task.id} created: "${task.title}"`
}

export function formatTaskGet(task: Task | null): string {
  if (!task) return "Task not found."

  const lines = [
    `**Task #${task.id}**`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Title | ${task.title} |`,
    `| Status | ${STATUS_ICONS[task.status]} ${task.status} |`,
  ]

  if (task.owner) {
    lines.push(`| Owner | @${task.owner} |`)
  }
  if (task.description) {
    lines.push(`| Description | ${task.description} |`)
  }
  if (task.dependsOn.length > 0) {
    lines.push(`| Depends on | ${task.dependsOn.map(id => `#${id}`).join(", ")} |`)
  }

  return lines.join("\n")
}

export function formatTaskUpdate(result: {
  success: boolean
  taskId: string
  updatedFields: string[]
  error?: string
  nextTask?: { id: string; title: string }
}): string {
  if (!result.success) {
    return `✗ Failed to update task #${result.taskId}: ${result.error ?? "unknown error"}`
  }

  let message = `✓ Task #${result.taskId} updated: ${result.updatedFields.join(", ")}`

  if (result.nextTask) {
    message += `\n\n📋 Next task: #${result.nextTask.id} — ${result.nextTask.title}`
  }

  return message
}

export function formatTaskDelete(result: {
  success: boolean
  taskId: string
  error?: string
  blockedChildren?: string[]
}): string {
  if (!result.success) {
    return `✗ Failed to delete task #${result.taskId}: ${result.error ?? "unknown error"}`
  }

  let message = `✓ Task #${result.taskId} deleted`

  if (result.blockedChildren && result.blockedChildren.length > 0) {
    message += `\n⚠️ These tasks were depending on it: ${result.blockedChildren.map(id => `#${id}`).join(", ")}`
  }

  return message
}

export function formatNextTask(task: {
  id: string
  title: string
  dependsOn: string[]
}): string {
  const lines = [
    `📋 **Next Task: #${task.id}**`,
    ``,
    `**${task.title}**`,
  ]

  if (task.dependsOn.length > 0) {
    lines.push(``)
    lines.push(`⏳ Depends on: ${task.dependsOn.map(id => `#${id}`).join(", ")}`)
  }

  return lines.join("\n")
}
