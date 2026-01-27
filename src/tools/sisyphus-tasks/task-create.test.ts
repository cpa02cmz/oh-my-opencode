import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { taskCreateTool } from "./task-create"

const TEST_DIR = join(import.meta.dirname, ".test-task-create")

describe("TaskCreate Tool", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(join(TEST_DIR, "tasks", "test-list"), { recursive: true })
  })
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

  //#given valid input
  //#when creating task
  //#then create JSON file with correct structure
  it("creates task file with correct structure", async () => {
    // given
    const taskDir = join(TEST_DIR, "tasks", "test-list")

    // when
    const result = await taskCreateTool.execute({
      subject: "Fix authentication bug",
      description: "Users report 401 errors"
    }, { taskDir })

    // then
    expect(result.task.id).toBe("1")
    expect(result.task.subject).toBe("Fix authentication bug")
    expect(existsSync(join(taskDir, "1.json"))).toBe(true)

    const saved = JSON.parse(readFileSync(join(taskDir, "1.json"), "utf-8"))
    expect(saved.status).toBe("pending")
    expect(saved.blocks).toEqual([])
    expect(saved.blockedBy).toEqual([])
  })

  //#given existing tasks
  //#when creating new task
  //#then generate sequential ID
  it("generates sequential ID", async () => {
    // given
    const taskDir = join(TEST_DIR, "tasks", "test-list")
    writeFileSync(join(taskDir, "1.json"), JSON.stringify({ id: "1" }))
    writeFileSync(join(taskDir, "2.json"), JSON.stringify({ id: "2" }))

    // when
    const result = await taskCreateTool.execute({
      subject: "New task",
      description: "Description"
    }, { taskDir })

    // then
    expect(result.task.id).toBe("3")
  })

  //#given optional fields
  //#when creating task
  //#then include them in output
  it("includes optional fields", async () => {
    // given
    const taskDir = join(TEST_DIR, "tasks", "test-list")

    // when
    const result = await taskCreateTool.execute({
      subject: "Task",
      description: "Desc",
      activeForm: "Working on task",
      metadata: { priority: "high" }
    }, { taskDir })

    // then
    const saved = JSON.parse(readFileSync(join(taskDir, "1.json"), "utf-8"))
    expect(saved.activeForm).toBe("Working on task")
    expect(saved.metadata.priority).toBe("high")
  })
})
