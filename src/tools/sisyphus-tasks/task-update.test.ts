import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs"
import { join } from "path"
import { taskUpdateTool } from "./task-update"

const TEST_DIR = join(import.meta.dirname, ".test-task-update")

describe("TaskUpdate Tool", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(join(TEST_DIR, "tasks"), { recursive: true })
  })
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

  //#given existing task
  //#when updating single field
  //#then only that field changes
  it("updates single field", async () => {
    const taskDir = join(TEST_DIR, "tasks")
    writeFileSync(
      join(taskDir, "1.json"),
      JSON.stringify({
        id: "1",
        subject: "Old",
        description: "Desc",
        status: "pending",
        blocks: [],
        blockedBy: [],
      })
    )

    const result = await taskUpdateTool.execute({ taskId: "1", subject: "New" }, { taskDir })
    expect(result.success).toBe(true)
    expect(result.updatedFields).toContain("subject")

    const saved = JSON.parse(readFileSync(join(taskDir, "1.json"), "utf-8"))
    expect(saved.subject).toBe("New")
    expect(saved.description).toBe("Desc") // unchanged
  })

  //#given task
  //#when adding blockedBy
  //#then update both tasks' relationships
  it("adds blockedBy relationship", async () => {
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
        blockedBy: [],
      })
    )

    await taskUpdateTool.execute({ taskId: "2", addBlockedBy: ["1"] }, { taskDir })

    const task1 = JSON.parse(readFileSync(join(taskDir, "1.json"), "utf-8"))
    const task2 = JSON.parse(readFileSync(join(taskDir, "2.json"), "utf-8"))
    expect(task2.blockedBy).toContain("1")
    expect(task1.blocks).toContain("2")
  })

  //#given task
  //#when status=deleted
  //#then delete file
  it("deletes when status=deleted", async () => {
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

    await taskUpdateTool.execute({ taskId: "1", status: "deleted" }, { taskDir })
    expect(existsSync(join(taskDir, "1.json"))).toBe(false)
  })
})
