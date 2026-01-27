import { describe, it, expect } from "bun:test"
import {
  TaskSchema,
  TaskStatusSchema,
  TaskToolInputSchema,
  type Task,
} from "./types"

describe("TaskStatusSchema", () => {
  //#given valid CC-aligned status values
  //#when parsing
  //#then all should succeed
  it("accepts valid statuses: open, in_progress, completed", () => {
    expect(TaskStatusSchema.safeParse("open").success).toBe(true)
    expect(TaskStatusSchema.safeParse("in_progress").success).toBe(true)
    expect(TaskStatusSchema.safeParse("completed").success).toBe(true)
  })

  //#given old OMO status value
  //#when parsing
  //#then it should fail
  it("rejects old pending status", () => {
    expect(TaskStatusSchema.safeParse("pending").success).toBe(false)
  })
})

describe("TaskSchema", () => {
  //#given a valid CC-aligned task with new field names
  //#when parsing with TaskSchema
  //#then it should succeed
  it("parses valid task with title, dependsOn, parentID, repoURL, threadID", () => {
    const validTask = {
      id: "task-1",
      title: "Fix authentication bug",
      description: "Users report 401 errors",
      status: "open",
      dependsOn: [],
      owner: "agent-001",
    }

    const result = TaskSchema.safeParse(validTask)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe("Fix authentication bug")
      expect(result.data.dependsOn).toEqual([])
    }
  })

  //#given a task with all optional CC fields
  //#when parsing with TaskSchema
  //#then it should succeed
  it("parses task with optional fields: parentID, repoURL, threadID", () => {
    const taskWithOptionals = {
      id: "task-2",
      title: "Add unit tests",
      description: "Write tests for auth module",
      status: "in_progress",
      dependsOn: ["task-1"],
      owner: "agent-002",
      parentID: "task-parent",
      repoURL: "https://github.com/example/repo",
      threadID: "thread-123",
    }

    const result = TaskSchema.safeParse(taskWithOptionals)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.parentID).toBe("task-parent")
      expect(result.data.repoURL).toBe("https://github.com/example/repo")
      expect(result.data.threadID).toBe("thread-123")
    }
  })

  //#given a task with old OMO field names
  //#when parsing with TaskSchema
  //#then it should fail
  it("rejects old subject field (should be title)", () => {
    const invalidTask = {
      id: "task-1",
      subject: "Old field name",
      description: "Test",
      status: "open",
      dependsOn: [],
    }

    const result = TaskSchema.safeParse(invalidTask)
    expect(result.success).toBe(false)
  })

  //#given a task with old blockedBy field
  //#when parsing with TaskSchema
  //#then it should fail
  it("rejects old blockedBy field (should be dependsOn)", () => {
    const invalidTask = {
      id: "task-1",
      title: "Test",
      description: "Test",
      status: "open",
      blockedBy: ["task-2"],
    }

    const result = TaskSchema.safeParse(invalidTask)
    expect(result.success).toBe(false)
  })

  //#given a task with old blocks field
  //#when parsing with TaskSchema
  //#then it should fail
  it("rejects old blocks field", () => {
    const invalidTask = {
      id: "task-1",
      title: "Test",
      description: "Test",
      status: "open",
      dependsOn: [],
      blocks: ["task-2"],
    }

    const result = TaskSchema.safeParse(invalidTask)
    expect(result.success).toBe(false)
  })

  //#given a task with old activeForm field
  //#when parsing with TaskSchema
  //#then it should fail
  it("rejects old activeForm field", () => {
    const invalidTask = {
      id: "task-1",
      title: "Test",
      description: "Test",
      status: "open",
      dependsOn: [],
      activeForm: "Some form",
    }

    const result = TaskSchema.safeParse(invalidTask)
    expect(result.success).toBe(false)
  })

  //#given a task with old metadata field
  //#when parsing with TaskSchema
  //#then it should fail
  it("rejects old metadata field", () => {
    const invalidTask = {
      id: "task-1",
      title: "Test",
      description: "Test",
      status: "open",
      dependsOn: [],
      metadata: { key: "value" },
    }

    const result = TaskSchema.safeParse(invalidTask)
    expect(result.success).toBe(false)
  })

  //#given missing required fields
  //#when parsing with TaskSchema
  //#then it should fail
  it("rejects missing required fields (id, title, status, dependsOn)", () => {
    const invalidTask = {
      id: "task-1",
      // missing title, status, dependsOn
    }

    const result = TaskSchema.safeParse(invalidTask)
    expect(result.success).toBe(false)
  })
})

describe("TaskToolInputSchema", () => {
  //#given a create action input
  //#when parsing with TaskToolInputSchema
  //#then it should succeed with required fields
  it("validates create action with title and description", () => {
    const createInput = {
      action: "create",
      title: "New task",
      description: "Task description",
    }

    const result = TaskToolInputSchema.safeParse(createInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.action).toBe("create")
    }
  })

  //#given a list action input
  //#when parsing with TaskToolInputSchema
  //#then it should succeed with optional limit
  it("validates list action with optional limit", () => {
    const listInput = {
      action: "list",
      limit: 10,
    }

    const result = TaskToolInputSchema.safeParse(listInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.action).toBe("list")
      expect(result.data.limit).toBe(10)
    }
  })

  //#given a get action input
  //#when parsing with TaskToolInputSchema
  //#then it should succeed with taskID
  it("validates get action with taskID", () => {
    const getInput = {
      action: "get",
      taskID: "task-1",
    }

    const result = TaskToolInputSchema.safeParse(getInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.action).toBe("get")
      expect(result.data.taskID).toBe("task-1")
    }
  })

  //#given an update action input
  //#when parsing with TaskToolInputSchema
  //#then it should succeed with taskID and update fields
  it("validates update action with taskID and optional fields", () => {
    const updateInput = {
      action: "update",
      taskID: "task-1",
      title: "Updated title",
      status: "in_progress",
      dependsOn: ["task-2"],
    }

    const result = TaskToolInputSchema.safeParse(updateInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.action).toBe("update")
      expect(result.data.taskID).toBe("task-1")
    }
  })

  //#given a delete action input
  //#when parsing with TaskToolInputSchema
  //#then it should succeed with taskID
  it("validates delete action with taskID", () => {
    const deleteInput = {
      action: "delete",
      taskID: "task-1",
    }

    const result = TaskToolInputSchema.safeParse(deleteInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.action).toBe("delete")
    }
  })

  //#given an invalid action value
  //#when parsing with TaskToolInputSchema
  //#then it should fail
  it("rejects invalid action value", () => {
    const invalidInput = {
      action: "invalid_action",
      title: "Test",
    }

    const result = TaskToolInputSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
  })

  //#given missing action field
  //#when parsing with TaskToolInputSchema
  //#then it should fail
  it("rejects missing action field", () => {
    const invalidInput = {
      title: "Test",
      description: "Test",
    }

    const result = TaskToolInputSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
  })

  //#given invalid status in update action
  //#when parsing with TaskToolInputSchema
  //#then it should fail
  it("rejects invalid status value in update", () => {
    const invalidInput = {
      action: "update",
      taskID: "task-1",
      status: "pending",
    }

    const result = TaskToolInputSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
  })
})
