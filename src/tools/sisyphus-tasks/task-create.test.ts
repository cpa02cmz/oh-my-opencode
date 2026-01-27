import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { taskCreateTool } from "./task-create"

const TEST_DIR = join(import.meta.dirname, ".test-task-create")
const mockContext = {} as Parameters<typeof taskCreateTool.execute>[1]

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
    //#given
    const taskDir = join(TEST_DIR, "tasks", "test-list")

    //#when
    const result = await taskCreateTool.execute({
      subject: "Fix authentication bug",
      description: "Users report 401 errors",
      task_dir: taskDir
    }, mockContext)

    //#then
    expect(result).toContain("Task #1 created")
    expect(result).toContain("Fix authentication bug")
    expect(existsSync(join(taskDir, "1.json"))).toBe(true)

    const saved = JSON.parse(readFileSync(join(taskDir, "1.json"), "utf-8"))
    expect(saved.status).toBe("pending")
    expect(saved.blocks.length).toBe(0)
    expect(saved.blockedBy.length).toBe(0)
  })

  //#given existing tasks
  //#when creating new task
  //#then generate sequential ID
  it("generates sequential ID", async () => {
    //#given
    const taskDir = join(TEST_DIR, "tasks", "test-list")
    writeFileSync(join(taskDir, "1.json"), JSON.stringify({ id: "1" }))
    writeFileSync(join(taskDir, "2.json"), JSON.stringify({ id: "2" }))

    //#when
    const result = await taskCreateTool.execute({
      subject: "New task",
      description: "Description",
      task_dir: taskDir
    }, mockContext)

    //#then
    expect(result).toContain("Task #3 created")
  })

  //#given optional fields
  //#when creating task
  //#then include them in output
  it("includes optional fields", async () => {
    //#given
    const taskDir = join(TEST_DIR, "tasks", "test-list")

    //#when
    await taskCreateTool.execute({
      subject: "Task",
      description: "Desc",
      active_form: "Working on task",
      metadata: JSON.stringify({ priority: "high" }),
      task_dir: taskDir
    }, mockContext)

    //#then
    const saved = JSON.parse(readFileSync(join(taskDir, "1.json"), "utf-8"))
    expect(saved.activeForm).toBe("Working on task")
    expect(saved.metadata.priority).toBe("high")
  })
})
