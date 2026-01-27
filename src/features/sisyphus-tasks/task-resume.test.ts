import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { taskResumeTool } from "./task-resume"

const TEST_DIR = join(import.meta.dirname, ".test-task-resume")
const mockContext = {} as Parameters<typeof taskResumeTool.execute>[1]

describe("TaskResume Tool", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(join(TEST_DIR, "tasks"), { recursive: true })
  })
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

  //#given agent not busy
  //#when resuming task
  //#then succeed
  it("resumes if agent not busy", async () => {
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
    const result = await taskResumeTool.execute({ task_id: "1", agent_id: "agent-1", task_dir: taskDir }, mockContext)

    //#then
    expect(result).toContain("✓")
    expect(result).toContain("Resumed task #1")
  })

  //#given agent has active task
  //#when resuming another task
  //#then fail with agent_busy
  it("returns agent_busy if has active task", async () => {
    //#given
    const taskDir = join(TEST_DIR, "tasks")
    writeFileSync(
      join(taskDir, "1.json"),
      JSON.stringify({
        id: "1",
        subject: "A",
        description: "D",
        status: "in_progress",
        owner: "agent-1",
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
        blockedBy: [],
      })
    )

    //#when
    const result = await taskResumeTool.execute({ task_id: "2", agent_id: "agent-1", task_dir: taskDir }, mockContext)

    //#then
    expect(result).toContain("✗")
    expect(result).toContain("Agent busy")
    expect(result).toContain("#1")
  })
})
