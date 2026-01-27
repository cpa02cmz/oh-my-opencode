import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "fs"
import { join } from "path"
import { taskSuspendTool } from "./task-suspend"

const TEST_DIR = join(import.meta.dirname, ".test-task-suspend")

describe("TaskSuspend Tool", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(join(TEST_DIR, "tasks"), { recursive: true })
  })
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

  //#given in_progress task
  //#when suspending
  //#then set pending and clear owner
  it("suspends task", async () => {
    // given
    const taskDir = join(TEST_DIR, "tasks")
    writeFileSync(join(taskDir, "1.json"), JSON.stringify({
      id: "1", subject: "A", description: "D", status: "in_progress", owner: "agent-1", blocks: [], blockedBy: []
    }))
    
    // when
    const result = await taskSuspendTool.execute({ taskId: "1" }, { taskDir })

    // then
    expect(result.success).toBe(true)
    
    const task = JSON.parse(readFileSync(join(taskDir, "1.json"), "utf-8"))
    expect(task.status).toBe("pending")
    expect(task.owner).toBeUndefined()
  })
})
