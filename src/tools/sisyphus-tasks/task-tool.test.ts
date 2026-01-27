import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { taskTool } from "./task-tool"
import type { Task } from "../../features/sisyphus-tasks/types"

const TEST_DIR = join(process.cwd(), ".test-task-tool")

function writeTask(task: Task): void {
  mkdirSync(TEST_DIR, { recursive: true })
  writeFileSync(join(TEST_DIR, `${task.id}.json`), JSON.stringify(task, null, 2))
}

function readTask(taskId: string): Task | null {
  const taskPath = join(TEST_DIR, `${taskId}.json`)
  if (!existsSync(taskPath)) return null
  return JSON.parse(readFileSync(taskPath, "utf-8"))
}

describe("taskTool", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  // ============================================================
  // CREATE ACTION (7 tests)
  // ============================================================
  describe("create action", () => {
    it("creates task with title and returns formatted output", async () => {
      //#given
      const context = {}

      //#when
      const result = await taskTool.execute(
        { action: "create", title: "Test task", description: "Test description", task_dir: TEST_DIR },
        context
      )

      //#then
      expect(result).toContain("Task #1 created")
      expect(result).toContain("Test task")
    })

    it("auto-increments ID", async () => {
      //#given
      writeTask({
        id: "1",
        title: "Existing task",
        description: "Existing",
        status: "open",
        dependsOn: [],
      })

      //#when
      const result = await taskTool.execute(
        { action: "create", title: "New task", description: "New", task_dir: TEST_DIR },
        {}
      )

      //#then
      expect(result).toContain("Task #2 created")
    })

    it("sets status to open", async () => {
      //#given
      //#when
      await taskTool.execute(
        { action: "create", title: "Test task", description: "Test", task_dir: TEST_DIR },
        {}
      )

      //#then
      const task = readTask("1")
      expect(task?.status).toBe("open")
    })

    it("supports parentID and repoURL", async () => {
      //#given
      //#when
      await taskTool.execute(
        {
          action: "create",
          title: "Child task",
          description: "Child",
          parentID: "parent-1",
          repoURL: "https://github.com/test/repo",
          task_dir: TEST_DIR,
        },
        {}
      )

      //#then
      const task = readTask("1")
      expect(task?.parentID).toBe("parent-1")
      expect(task?.repoURL).toBe("https://github.com/test/repo")
    })

    it("supports dependsOn", async () => {
      //#given
      //#when
      await taskTool.execute(
        {
          action: "create",
          title: "Dependent task",
          description: "Depends on others",
          dependsOn: JSON.stringify(["1", "2"]),
          task_dir: TEST_DIR,
        },
        {}
      )

      //#then
      const task = readTask("1")
      expect(task?.dependsOn).toEqual(["1", "2"])
    })

    it("requires title and returns error without it", async () => {
      //#given
      //#when
      const result = await taskTool.execute(
        { action: "create", description: "No title", task_dir: TEST_DIR },
        {}
      )

      //#then
      expect(result).toContain("title is required")
    })

    it("acquires lock for write", async () => {
      //#given
      //#when
      await taskTool.execute(
        { action: "create", title: "Test task", description: "Test", task_dir: TEST_DIR },
        {}
      )

      //#then
      const lockPath = join(TEST_DIR, ".lock")
      expect(existsSync(lockPath)).toBe(false)
    })
  })

  // ============================================================
  // LIST ACTION (6 tests)
  // ============================================================
  describe("list action", () => {
    it("returns empty when no tasks", async () => {
      //#given
      //#when
      const result = await taskTool.execute({ action: "list", task_dir: TEST_DIR }, {})

      //#then
      expect(result).toContain("No tasks found")
    })

    it("lists all tasks grouped by status", async () => {
      //#given
      writeTask({ id: "1", title: "Open task", description: "Open", status: "open", dependsOn: [] })
      writeTask({ id: "2", title: "In progress", description: "WIP", status: "in_progress", dependsOn: [] })
      writeTask({ id: "3", title: "Done", description: "Done", status: "completed", dependsOn: [] })

      //#when
      const result = await taskTool.execute({ action: "list", task_dir: TEST_DIR }, {})

      //#then
      expect(result).toContain("In Progress")
      expect(result).toContain("Open")
      expect(result).toContain("Completed")
    })

    it("filters by status", async () => {
      //#given
      writeTask({ id: "1", title: "Open task", description: "Open", status: "open", dependsOn: [] })
      writeTask({ id: "2", title: "Done", description: "Done", status: "completed", dependsOn: [] })

      //#when
      const result = await taskTool.execute({ action: "list", status: "open", task_dir: TEST_DIR }, {})

      //#then
      expect(result).toContain("Open task")
      expect(result).not.toContain("Done")
    })

    it("respects limit", async () => {
      //#given
      writeTask({ id: "1", title: "Task 1", description: "1", status: "open", dependsOn: [] })
      writeTask({ id: "2", title: "Task 2", description: "2", status: "open", dependsOn: [] })
      writeTask({ id: "3", title: "Task 3", description: "3", status: "open", dependsOn: [] })

      //#when
      const result = await taskTool.execute({ action: "list", limit: 2, task_dir: TEST_DIR }, {})

      //#then
      expect(result).toContain("Task 1")
      expect(result).toContain("Task 2")
      expect(result).not.toContain("Task 3")
    })

    it("ready=true filters to tasks with all deps completed", async () => {
      //#given
      writeTask({ id: "1", title: "Completed dep", description: "Done", status: "completed", dependsOn: [] })
      writeTask({ id: "2", title: "Ready task", description: "Ready", status: "open", dependsOn: ["1"] })
      writeTask({ id: "3", title: "Blocked task", description: "Blocked", status: "open", dependsOn: ["99"] })

      //#when
      const result = await taskTool.execute({ action: "list", ready: true, task_dir: TEST_DIR }, {})

      //#then
      expect(result).toContain("Ready task")
      expect(result).not.toContain("Blocked task")
    })

    it("filters by repoURL", async () => {
      //#given
      writeTask({ id: "1", title: "Repo A task", description: "A", status: "open", dependsOn: [], repoURL: "https://github.com/a/repo" })
      writeTask({ id: "2", title: "Repo B task", description: "B", status: "open", dependsOn: [], repoURL: "https://github.com/b/repo" })

      //#when
      const result = await taskTool.execute({ action: "list", repoURL: "https://github.com/a/repo", task_dir: TEST_DIR }, {})

      //#then
      expect(result).toContain("Repo A task")
      expect(result).not.toContain("Repo B task")
    })
  })

  // ============================================================
  // GET ACTION (4 tests)
  // ============================================================
  describe("get action", () => {
    it("returns task by ID", async () => {
      //#given
      writeTask({ id: "1", title: "Test task", description: "Test", status: "open", dependsOn: [] })

      //#when
      const result = await taskTool.execute({ action: "get", taskID: "1", task_dir: TEST_DIR }, {})

      //#then
      expect(result).toContain("Task #1")
      expect(result).toContain("Test task")
    })

    it("returns not found for missing ID", async () => {
      //#given
      //#when
      const result = await taskTool.execute({ action: "get", taskID: "999", task_dir: TEST_DIR }, {})

      //#then
      expect(result).toContain("not found")
    })

    it("requires taskID", async () => {
      //#given
      //#when
      const result = await taskTool.execute({ action: "get", task_dir: TEST_DIR }, {})

      //#then
      expect(result).toContain("taskID is required")
    })

    it("uses formatTaskGet", async () => {
      //#given
      writeTask({
        id: "1",
        title: "Test task",
        description: "Test description",
        status: "in_progress",
        dependsOn: ["2"],
        owner: "test-owner",
      })

      //#when
      const result = await taskTool.execute({ action: "get", taskID: "1", task_dir: TEST_DIR }, {})

      //#then
      expect(result).toContain("Task #1")
      expect(result).toContain("Title")
      expect(result).toContain("Status")
      expect(result).toContain("in_progress")
    })
  })

  // ============================================================
  // UPDATE ACTION (7 tests)
  // ============================================================
  describe("update action", () => {
    it("changes title", async () => {
      //#given
      writeTask({ id: "1", title: "Old title", description: "Test", status: "open", dependsOn: [] })

      //#when
      const result = await taskTool.execute(
        { action: "update", taskID: "1", title: "New title", task_dir: TEST_DIR },
        {}
      )

      //#then
      expect(result).toContain("updated")
      const task = readTask("1")
      expect(task?.title).toBe("New title")
    })

    it("changes status", async () => {
      //#given
      writeTask({ id: "1", title: "Test", description: "Test", status: "open", dependsOn: [] })

      //#when
      const result = await taskTool.execute(
        { action: "update", taskID: "1", status: "in_progress", task_dir: TEST_DIR },
        {}
      )

      //#then
      expect(result).toContain("updated")
      const task = readTask("1")
      expect(task?.status).toBe("in_progress")
    })

    it("changes status to completed and returns nextTask", async () => {
      //#given
      writeTask({ id: "1", title: "First task", description: "First", status: "in_progress", dependsOn: [] })
      writeTask({ id: "2", title: "Next task", description: "Next", status: "open", dependsOn: ["1"] })

      //#when
      const result = await taskTool.execute(
        { action: "update", taskID: "1", status: "completed", task_dir: TEST_DIR },
        {}
      )

      //#then
      expect(result).toContain("Next task")
      expect(result).toContain("#2")
    })

    it("adds dependsOn", async () => {
      //#given
      writeTask({ id: "1", title: "Test", description: "Test", status: "open", dependsOn: [] })

      //#when
      const result = await taskTool.execute(
        { action: "update", taskID: "1", dependsOn: JSON.stringify(["2", "3"]), task_dir: TEST_DIR },
        {}
      )

      //#then
      expect(result).toContain("updated")
      const task = readTask("1")
      expect(task?.dependsOn).toEqual(["2", "3"])
    })

    it("requires taskID", async () => {
      //#given
      //#when
      const result = await taskTool.execute(
        { action: "update", title: "New title", task_dir: TEST_DIR },
        {}
      )

      //#then
      expect(result).toContain("taskID is required")
    })

    it("returns error for missing task", async () => {
      //#given
      //#when
      const result = await taskTool.execute(
        { action: "update", taskID: "999", title: "New title", task_dir: TEST_DIR },
        {}
      )

      //#then
      expect(result).toContain("Failed")
      expect(result).toContain("999")
    })

    it("acquires lock for write", async () => {
      //#given
      writeTask({ id: "1", title: "Test", description: "Test", status: "open", dependsOn: [] })

      //#when
      await taskTool.execute(
        { action: "update", taskID: "1", title: "Updated", task_dir: TEST_DIR },
        {}
      )

      //#then
      const lockPath = join(TEST_DIR, ".lock")
      expect(existsSync(lockPath)).toBe(false)
    })
  })

  // ============================================================
  // DELETE ACTION (6 tests)
  // ============================================================
  describe("delete action", () => {
    it("removes task file", async () => {
      //#given
      writeTask({ id: "1", title: "To delete", description: "Delete me", status: "open", dependsOn: [] })

      //#when
      const result = await taskTool.execute({ action: "delete", taskID: "1", task_dir: TEST_DIR }, {})

      //#then
      expect(result).toContain("deleted")
      expect(existsSync(join(TEST_DIR, "1.json"))).toBe(false)
    })

    it("cleans up dependsOn references in other tasks", async () => {
      //#given
      writeTask({ id: "1", title: "To delete", description: "Delete me", status: "open", dependsOn: [] })
      writeTask({ id: "2", title: "Dependent", description: "Depends on 1", status: "open", dependsOn: ["1"] })

      //#when
      await taskTool.execute({ action: "delete", taskID: "1", task_dir: TEST_DIR }, {})

      //#then
      const task2 = readTask("2")
      expect(task2?.dependsOn).toEqual([])
    })

    it("blocks deletion when task has children", async () => {
      //#given
      writeTask({ id: "1", title: "Parent", description: "Parent task", status: "open", dependsOn: [] })
      writeTask({ id: "2", title: "Child", description: "Child task", status: "open", dependsOn: [], parentID: "1" })

      //#when
      const result = await taskTool.execute({ action: "delete", taskID: "1", task_dir: TEST_DIR }, {})

      //#then
      expect(result).toContain("Failed")
      expect(result).toContain("children")
      expect(existsSync(join(TEST_DIR, "1.json"))).toBe(true)
    })

    it("requires taskID", async () => {
      //#given
      //#when
      const result = await taskTool.execute({ action: "delete", task_dir: TEST_DIR }, {})

      //#then
      expect(result).toContain("taskID is required")
    })

    it("returns error for missing task", async () => {
      //#given
      //#when
      const result = await taskTool.execute({ action: "delete", taskID: "999", task_dir: TEST_DIR }, {})

      //#then
      expect(result).toContain("Failed")
      expect(result).toContain("999")
    })

    it("acquires lock for write", async () => {
      //#given
      writeTask({ id: "1", title: "To delete", description: "Delete me", status: "open", dependsOn: [] })

      //#when
      await taskTool.execute({ action: "delete", taskID: "1", task_dir: TEST_DIR }, {})

      //#then
      const lockPath = join(TEST_DIR, ".lock")
      expect(existsSync(lockPath)).toBe(false)
    })
  })

  // ============================================================
  // ACTION VALIDATION (1 test)
  // ============================================================
  describe("action validation", () => {
    it("rejects unknown action", async () => {
      //#given
      //#when
      const result = await taskTool.execute(
        { action: "unknown" as "create", task_dir: TEST_DIR },
        {}
      )

      //#then
      expect(result).toContain("Unknown action")
    })
  })
})
