import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { taskGetTool } from "./task-get"

const TEST_DIR = join(import.meta.dirname, ".test-task-get")

describe("TaskGet Tool", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(join(TEST_DIR, "tasks"), { recursive: true })
  })
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

  //#given existing task
  //#when getting by ID
  //#then return full task object
  it("returns task when exists", async () => {
    // given
    const taskDir = join(TEST_DIR, "tasks")
    writeFileSync(
      join(taskDir, "1.json"),
      JSON.stringify({
        id: "1",
        subject: "Test",
        description: "Desc",
        status: "pending",
        blocks: [],
        blockedBy: [],
      })
    )

    // when
    const result = await taskGetTool.execute({ taskId: "1" }, { taskDir })

    // then
    expect(result.task).not.toBeNull()
    expect(result.task?.subject).toBe("Test")
  })

  //#given non-existent task
  //#when getting
  //#then return null
  it("returns null when not exists", async () => {
    // given
    const taskDir = join(TEST_DIR, "tasks")

    // when
    const result = await taskGetTool.execute({ taskId: "999" }, { taskDir })

    // then
    expect(result.task).toBeNull()
  })
})
