import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "fs"
import { join } from "path"
import { taskExecuteTool } from "./task-execute"

const TEST_DIR = join(import.meta.dirname, ".test-task-execute")
const mockContext = {} as Parameters<typeof taskExecuteTool.execute>[1]

describe("TaskExecute Tool", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(join(TEST_DIR, "tasks"), { recursive: true })
  })
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

  //#given available task
  //#when executing
  //#then claim successfully
  it("claims available task", async () => {
    //#given
    const taskDir = join(TEST_DIR, "tasks")
    writeFileSync(
      join(taskDir, "1.json"),
      JSON.stringify({
        id: "1",
        subject: "A",
        description: "D",
        status: "pending",
        blocks: [],
        blockedBy: [],
      })
    )

    //#when
    const result = await taskExecuteTool.execute({ task_id: "1", agent_id: "agent-1", task_dir: taskDir }, mockContext)

    //#then
    expect(result).toContain("✓")
    expect(result).toContain("Claimed task #1")

    const task = JSON.parse(readFileSync(join(taskDir, "1.json"), "utf-8"))
    expect(task.owner).toBe("agent-1")
    expect(task.status).toBe("in_progress")
  })

  //#given already claimed task
  //#when executing
  //#then fail with already_claimed
  it("fails if already claimed", async () => {
    //#given
    const taskDir = join(TEST_DIR, "tasks")
    writeFileSync(
      join(taskDir, "1.json"),
      JSON.stringify({
        id: "1",
        subject: "A",
        description: "D",
        status: "in_progress",
        owner: "other",
        blocks: [],
        blockedBy: [],
      })
    )

    //#when
    const result = await taskExecuteTool.execute({ task_id: "1", agent_id: "agent-1", task_dir: taskDir }, mockContext)

    //#then
    expect(result).toContain("✗")
    expect(result).toContain("already claimed")
  })

  //#given blocked task
  //#when executing
  //#then fail with blocked
  it("fails if blocked", async () => {
    //#given
    const taskDir = join(TEST_DIR, "tasks")
    writeFileSync(
      join(taskDir, "1.json"),
      JSON.stringify({
        id: "1",
        subject: "A",
        description: "D",
        status: "pending",
        blocks: [],
        blockedBy: [],
      })
    )
    writeFileSync(
      join(taskDir, "2.json"),
      JSON.stringify({
        id: "2",
        subject: "B",
        description: "D",
        status: "pending",
        blocks: [],
        blockedBy: ["1"],
      })
    )

    //#when
    const result = await taskExecuteTool.execute({ task_id: "2", agent_id: "agent-1", task_dir: taskDir }, mockContext)

    //#then
    expect(result).toContain("✗")
    expect(result).toContain("blocked")
    expect(result).toContain("#1")
  })

  //#given completed task
  //#when executing
  //#then fail
  it("fails if already completed", async () => {
    //#given
    const taskDir = join(TEST_DIR, "tasks")
    writeFileSync(
      join(taskDir, "1.json"),
      JSON.stringify({
        id: "1",
        subject: "A",
        description: "D",
        status: "completed",
        blocks: [],
        blockedBy: [],
      })
    )

    //#when
    const result = await taskExecuteTool.execute({ task_id: "1", agent_id: "agent-1", task_dir: taskDir }, mockContext)

    //#then
    expect(result).toContain("✗")
    expect(result).toContain("completed")
  })
})
