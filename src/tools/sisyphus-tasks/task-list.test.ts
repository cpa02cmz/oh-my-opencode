import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { taskListTool } from "./task-list"

const TEST_DIR = join(import.meta.dirname, ".test-task-list")
const mockContext = {} as Parameters<typeof taskListTool.execute>[1]

describe("TaskList Tool", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(join(TEST_DIR, "tasks", "test-list"), { recursive: true })
  })
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

  //#given empty task directory
  //#when listing tasks
  //#then return empty message
  it("returns message for empty list", async () => {
    const result = await taskListTool.execute({ task_dir: join(TEST_DIR, "tasks", "test-list") }, mockContext)
    expect(result).toContain("No tasks")
  })

  //#given tasks exist
  //#when listing
  //#then return formatted list
  it("lists tasks with format: #N [status] subject (owner)", async () => {
    const taskDir = join(TEST_DIR, "tasks", "test-list")
    writeFileSync(join(taskDir, "1.json"), JSON.stringify({
      id: "1", subject: "Fix bug", description: "desc", status: "pending", blocks: [], blockedBy: []
    }))
    writeFileSync(join(taskDir, "2.json"), JSON.stringify({
      id: "2", subject: "Add tests", description: "desc", status: "in_progress", owner: "agent-1", blocks: [], blockedBy: ["1"]
    }))
    
    const result = await taskListTool.execute({ task_dir: taskDir }, mockContext)
    expect(result).toContain("#1")
    expect(result).toContain("Pending")
    expect(result).toContain("Fix bug")
    expect(result).toContain("#2")
    expect(result).toContain("In Progress")
    expect(result).toContain("agent-1")
    expect(result).toContain("blocked by #1")
  })

  //#given completed task in blockedBy
  //#when listing
  //#then filter out completed from blockedBy display
  it("filters completed tasks from blockedBy", async () => {
    const taskDir = join(TEST_DIR, "tasks", "test-list")
    writeFileSync(join(taskDir, "1.json"), JSON.stringify({
      id: "1", subject: "Done task", description: "desc", status: "completed", blocks: ["2"], blockedBy: []
    }))
    writeFileSync(join(taskDir, "2.json"), JSON.stringify({
      id: "2", subject: "Blocked task", description: "desc", status: "pending", blocks: [], blockedBy: ["1"]
    }))
    
    const result = await taskListTool.execute({ task_dir: taskDir }, mockContext)
    expect(result.includes("blocked by #1")).toBe(false)
  })
})
