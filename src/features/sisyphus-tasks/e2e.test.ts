import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { taskCreateTool } from "../../tools/sisyphus-tasks/task-create"
import { taskListTool } from "../../tools/sisyphus-tasks/task-list"
import { taskGetTool } from "./task-get"
import { taskUpdateTool } from "../../tools/sisyphus-tasks/task-update"
import { taskExecuteTool } from "./task-execute"
import { taskSuspendTool } from "../../tools/sisyphus-tasks/task-suspend"
import { taskAbortTool } from "../../tools/sisyphus-tasks/task-abort"

describe("Sisyphus Tasks E2E", () => {
  let taskDir: string

  beforeEach(() => {
    taskDir = mkdtempSync(join(tmpdir(), "sisyphus-tasks-e2e-"))
  })

  afterEach(() => {
    rmSync(taskDir, { recursive: true, force: true })
  })

  //#region E2E: Full task lifecycle
  it("should complete full task lifecycle: create -> execute -> update -> complete", async () => {
    //#given
    const context = { taskDir }

    //#when: create a task
    const createResult = await taskCreateTool.execute(
      { subject: "Implement feature X", description: "Build the feature" },
      context
    )

    //#then
    expect(createResult.task.id).toBe("1")
    expect(createResult.task.subject).toBe("Implement feature X")

    //#when: list tasks
    const listResult = await taskListTool.execute({}, context)

    //#then
    expect(listResult).toContain("#1 [pending] Implement feature X")

    //#when: execute (claim) the task
    const executeResult = await taskExecuteTool.execute(
      { taskId: "1", agentId: "agent-001" },
      context
    )

    //#then
    expect(executeResult.success).toBe(true)
    expect(executeResult.task?.status).toBe("in_progress")
    expect(executeResult.task?.owner).toBe("agent-001")

    //#when: update task to completed
    const updateResult = await taskUpdateTool.execute(
      { taskId: "1", status: "completed" },
      context
    )

    //#then
    expect(updateResult.success).toBe(true)
    expect(updateResult.updatedFields).toContain("status")

    //#when: get final task state
    const getResult = await taskGetTool.execute({ taskId: "1" }, context)

    //#then
    expect(getResult.task?.status).toBe("completed")
    expect(getResult.task?.owner).toBe("agent-001")
  })
  //#endregion

  //#region E2E: Task blocking and dependencies
  it("should handle task dependencies correctly", async () => {
    //#given
    const context = { taskDir }
    
    await taskCreateTool.execute(
      { subject: "Task 1 - Foundation", description: "Base work" },
      context
    )
    await taskCreateTool.execute(
      { subject: "Task 2 - Dependent", description: "Depends on task 1" },
      context
    )

    //#when: add dependency
    await taskUpdateTool.execute(
      { taskId: "2", addBlockedBy: ["1"] },
      context
    )

    //#then: task 2 cannot be executed
    const executeResult = await taskExecuteTool.execute(
      { taskId: "2", agentId: "agent-001" },
      context
    )
    expect(executeResult.success).toBe(false)
    expect(executeResult.reason).toBe("blocked")

    //#when: complete task 1
    await taskExecuteTool.execute({ taskId: "1", agentId: "agent-001" }, context)
    await taskUpdateTool.execute({ taskId: "1", status: "completed" }, context)

    //#then: task 2 can now be executed
    const executeResult2 = await taskExecuteTool.execute(
      { taskId: "2", agentId: "agent-002" },
      context
    )
    expect(executeResult2.success).toBe(true)
  })
  //#endregion

  //#region E2E: Task abort and cleanup
  it("should abort task and clean up dependencies", async () => {
    //#given
    const context = { taskDir }
    
    await taskCreateTool.execute(
      { subject: "Task 1", description: "Will be aborted" },
      context
    )
    await taskCreateTool.execute(
      { subject: "Task 2", description: "Blocked by task 1" },
      context
    )
    await taskUpdateTool.execute(
      { taskId: "2", addBlockedBy: ["1"] },
      context
    )

    //#when: abort task 1
    await taskAbortTool.execute({ taskId: "1" }, context)

    //#then: task 1 is deleted
    const getResult = await taskGetTool.execute({ taskId: "1" }, context)
    expect(getResult.task).toBeNull()

    //#then: task 2 no longer blocked
    const task2 = await taskGetTool.execute({ taskId: "2" }, context)
    expect(task2.task?.blockedBy.includes("1")).toBe(false)
  })
  //#endregion

  //#region E2E: Task suspend and resume
  it("should suspend and allow re-execution of task", async () => {
    //#given
    const context = { taskDir }
    
    await taskCreateTool.execute(
      { subject: "Task 1", description: "In progress" },
      context
    )
    await taskExecuteTool.execute({ taskId: "1", agentId: "agent-001" }, context)

    //#when: suspend the task
    const suspendResult = await taskSuspendTool.execute({ taskId: "1" }, context)

    //#then
    expect(suspendResult.success).toBe(true)

    //#when: verify task state
    const taskAfterSuspend = await taskGetTool.execute({ taskId: "1" }, context)

    //#then: task is pending and owner is cleared
    expect(taskAfterSuspend.task?.status).toBe("pending")
    expect(taskAfterSuspend.task?.owner).toBeUndefined()

    //#when: another agent executes the task
    const executeResult = await taskExecuteTool.execute(
      { taskId: "1", agentId: "agent-002" },
      context
    )

    //#then: new agent can claim the task
    expect(executeResult.success).toBe(true)
    expect(executeResult.task?.owner).toBe("agent-002")
  })
  //#endregion
})
