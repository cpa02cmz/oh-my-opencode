import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { taskWaitTool } from "./task-wait"

const TEST_DIR = join(import.meta.dirname, ".test-task-wait")
const mockContext = {} as Parameters<typeof taskWaitTool.execute>[1]

describe("TaskWait Tool", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(join(TEST_DIR, "tasks"), { recursive: true })
  })
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

  //#given completed task
  //#when waiting
  //#then return immediately
  it("returns when task completed", async () => {
    const taskDir = join(TEST_DIR, "tasks")
    writeFileSync(join(taskDir, "1.json"), JSON.stringify({
      id: "1", subject: "A", description: "D", status: "completed", blocks: [], blockedBy: []
    }))
    
    const result = await taskWaitTool.execute({ task_id: "1", timeout: 1000, task_dir: taskDir }, mockContext)
    expect(result).toContain("✓")
    expect(result).toContain("Task #1 completed")
  })

  //#given pending task
  //#when waiting with short timeout
  //#then return with current state
  it("returns current state on timeout", async () => {
    const taskDir = join(TEST_DIR, "tasks")
    writeFileSync(join(taskDir, "1.json"), JSON.stringify({
      id: "1", subject: "A", description: "D", status: "pending", blocks: [], blockedBy: []
    }))
    
    const result = await taskWaitTool.execute({ task_id: "1", timeout: 100, task_dir: taskDir }, mockContext)
    expect(result).toContain("pending")
  })
})
