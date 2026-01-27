import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs"
import { join } from "path"
import { taskRemoveTool } from "./task-remove"

const TEST_DIR = join(import.meta.dirname, ".test-task-remove")

describe("TaskRemove Tool", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(join(TEST_DIR, "tasks"), { recursive: true })
  })
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

  //#given existing task
  //#when removing
  //#then delete file
  it("removes task", async () => {
    // given
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

    // when
    const result = await taskRemoveTool.execute({ taskId: "1" }, { taskDir })

    // then
    expect(result.success).toBe(true)
    expect(existsSync(join(taskDir, "1.json"))).toBe(false)
  })
})
