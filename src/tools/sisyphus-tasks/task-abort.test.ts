import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs"
import { join } from "path"
import { taskAbortTool } from "./task-abort"

const TEST_DIR = join(import.meta.dirname, ".test-task-abort")
const mockContext = {} as Parameters<typeof taskAbortTool.execute>[1]

describe("TaskAbort Tool", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(join(TEST_DIR, "tasks"), { recursive: true })
  })
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

  //#given existing task
  //#when aborting
  //#then delete file
  it("deletes task file", async () => {
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
    await taskAbortTool.execute({ task_id: "1", task_dir: taskDir }, mockContext)

    //#then
    expect(existsSync(join(taskDir, "1.json"))).toBe(false)
  })

  //#given task with dependencies
  //#when aborting
  //#then remove from other tasks' arrays
  it("removes from other tasks dependencies", async () => {
    //#given
    const taskDir = join(TEST_DIR, "tasks")
    writeFileSync(
      join(taskDir, "1.json"),
      JSON.stringify({
        id: "1",
        subject: "A",
        description: "D",
        status: "pending",
        blocks: ["2"],
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
    await taskAbortTool.execute({ task_id: "1", task_dir: taskDir }, mockContext)

    //#then
    const task2 = JSON.parse(readFileSync(join(taskDir, "2.json"), "utf-8"))
    expect(task2.blockedBy.includes("1")).toBe(false)
  })

  //#given non-existent task
  //#when aborting
  //#then return success false
  it("returns false for non-existent task", async () => {
    //#given
    const taskDir = join(TEST_DIR, "tasks")

    //#when
    const result = await taskAbortTool.execute({ task_id: "999", task_dir: taskDir }, mockContext)

    //#then
    expect(result).toContain("✗")
    expect(result).toContain("Failed to abort")
  })
})
