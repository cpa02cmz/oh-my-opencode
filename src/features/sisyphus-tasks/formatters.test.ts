import { describe, it, expect } from "bun:test"
import {
  formatTaskList,
  formatTaskCreate,
  formatTaskGet,
  formatTaskUpdate,
  formatTaskDelete,
  formatNextTask,
} from "./formatters"
import type { Task } from "./types"

describe("formatTaskList", () => {
  //#given tasks with CC-aligned fields (title, dependsOn, open status)
  //#when formatting list
  //#then should use title, dependsOn, and open status
  it("formats task list with title and dependsOn fields", () => {
    const tasks: Task[] = [
      {
        id: "task-1",
        title: "Fix auth bug",
        description: "Users report 401",
        status: "open",
        dependsOn: [],
        owner: "agent-001",
      },
      {
        id: "task-2",
        title: "Add logging",
        description: "Debug info",
        status: "in_progress",
        dependsOn: ["task-1"],
        owner: "agent-002",
      },
    ]

    const result = formatTaskList(tasks, new Set())
    expect(result).toContain("Fix auth bug")
    expect(result).toContain("Add logging")
    expect(result).not.toContain("subject")
    expect(result).not.toContain("blockedBy")
  })

  //#given tasks with dependencies
  //#when formatting list
  //#then should show dependsOn info
  it("shows dependsOn info in task list", () => {
    const tasks: Task[] = [
      {
        id: "task-1",
        title: "Task 1",
        description: "",
        status: "open",
        dependsOn: ["task-2"],
        owner: undefined,
      },
    ]

    const result = formatTaskList(tasks, new Set())
    expect(result).toContain("task-1")
    expect(result).toContain("Task 1")
  })

  //#given completed task IDs
  //#when formatting list
  //#then should filter out completed dependencies
  it("filters completed dependencies from display", () => {
    const tasks: Task[] = [
      {
        id: "task-1",
        title: "Task 1",
        description: "",
        status: "open",
        dependsOn: ["task-2", "task-3"],
        owner: undefined,
      },
    ]
    const completedIds = new Set(["task-2"])

    const result = formatTaskList(tasks, completedIds)
    expect(result).toContain("task-1")
  })

  //#given empty task list
  //#when formatting
  //#then should return "No tasks found."
  it("returns 'No tasks found.' for empty list", () => {
    const result = formatTaskList([], new Set())
    expect(result).toBe("No tasks found.")
  })
})

describe("formatTaskCreate", () => {
  //#given task creation result with title
  //#when formatting
  //#then should show title (not subject)
  it("formats task creation with title field", () => {
    const result = formatTaskCreate({ id: "task-1", title: "New task" })
    expect(result).toContain("task-1")
    expect(result).toContain("New task")
    expect(result).not.toContain("subject")
  })
})

describe("formatTaskGet", () => {
  //#given a task with CC-aligned fields
  //#when formatting for display
  //#then should show title and dependsOn (not subject/blockedBy)
  it("formats task details with title and dependsOn", () => {
    const task: Task = {
      id: "task-1",
      title: "Fix bug",
      description: "Critical issue",
      status: "open",
      dependsOn: ["task-2"],
      owner: "agent-001",
    }

    const result = formatTaskGet(task)
    expect(result).toContain("Fix bug")
    expect(result).toContain("task-2")
    expect(result).not.toContain("subject")
    expect(result).not.toContain("blockedBy")
    expect(result).not.toContain("blocks")
  })

  //#given null task
  //#when formatting
  //#then should return "Task not found."
  it("returns 'Task not found.' for null task", () => {
    const result = formatTaskGet(null)
    expect(result).toBe("Task not found.")
  })

  //#given task with no owner or description
  //#when formatting
  //#then should omit those rows
  it("omits optional fields when not present", () => {
    const task: Task = {
      id: "task-1",
      title: "Simple task",
      description: "",
      status: "open",
      dependsOn: [],
      owner: undefined,
    }

    const result = formatTaskGet(task)
    expect(result).toContain("Simple task")
    expect(result).not.toContain("Owner")
  })
})

describe("formatTaskUpdate", () => {
  //#given successful update
  //#when formatting
  //#then should show success message
  it("formats successful task update", () => {
    const result = formatTaskUpdate({
      success: true,
      taskId: "task-1",
      updatedFields: ["title", "status"],
    })
    expect(result).toContain("task-1")
    expect(result).toContain("updated")
  })

  //#given update with status change to completed
  //#when formatting
  //#then should include nextTask info
  it("includes nextTask info when status changes to completed", () => {
    const result = formatTaskUpdate({
      success: true,
      taskId: "task-1",
      updatedFields: ["status"],
      nextTask: { id: "task-2", title: "Next task" },
    })
    expect(result).toContain("task-1")
    expect(result).toContain("task-2")
    expect(result).toContain("Next task")
  })

  //#given failed update
  //#when formatting
  //#then should show error message
  it("formats failed task update with error", () => {
    const result = formatTaskUpdate({
      success: false,
      taskId: "task-1",
      updatedFields: [],
      error: "Task not found",
    })
    expect(result).toContain("Failed")
    expect(result).toContain("task-1")
    expect(result).toContain("Task not found")
  })
})

describe("formatTaskDelete", () => {
  //#given successful task deletion
  //#when formatting
  //#then should show success message
  it("formats successful task deletion", () => {
    const result = formatTaskDelete({
      success: true,
      taskId: "task-1",
    })
    expect(result).toContain("task-1")
    expect(result).toContain("deleted")
  })

  //#given deletion with blocked children
  //#when formatting
  //#then should include blocked-by-children message
  it("includes blocked-by-children message when present", () => {
    const result = formatTaskDelete({
      success: true,
      taskId: "task-1",
      blockedChildren: ["task-2", "task-3"],
    })
    expect(result).toContain("task-1")
    expect(result).toContain("task-2")
    expect(result).toContain("task-3")
  })

  //#given failed deletion
  //#when formatting
  //#then should show error message
  it("formats failed task deletion", () => {
    const result = formatTaskDelete({
      success: false,
      taskId: "task-1",
      error: "Task not found",
    })
    expect(result).toContain("Failed")
    expect(result).toContain("task-1")
  })
})

describe("formatNextTask", () => {
  //#given a next task to recommend
  //#when formatting
  //#then should show task info
  it("formats next task recommendation", () => {
    const result = formatNextTask({
      id: "task-2",
      title: "Next priority",
      dependsOn: [],
    })
    expect(result).toContain("task-2")
    expect(result).toContain("Next priority")
  })

  //#given next task with dependencies
  //#when formatting
  //#then should show dependency info
  it("shows dependencies in next task", () => {
    const result = formatNextTask({
      id: "task-2",
      title: "Blocked task",
      dependsOn: ["task-3"],
    })
    expect(result).toContain("task-2")
    expect(result).toContain("task-3")
  })
})
