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

const mockContext = {} as Parameters<typeof taskCreateTool.execute>[1]

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
    //#given - tools use task_dir arg

    //#when: create a task
    const createResult = await taskCreateTool.execute(
      { subject: "Implement feature X", description: "Build the feature", task_dir: taskDir },
      mockContext
    )

    //#then
    expect(createResult).toContain("Task #1 created")
    expect(createResult).toContain("Implement feature X")

    //#when: list tasks
    const listResult = await taskListTool.execute({ task_dir: taskDir }, mockContext)

    //#then
    expect(listResult).toContain("#1")
    expect(listResult).toContain("Implement feature X")

    //#when: execute (claim) the task
    const executeResult = await taskExecuteTool.execute(
      { task_id: "1", agent_id: "agent-001", task_dir: taskDir },
      mockContext
    )

    //#then
    expect(executeResult).toContain("✓")
    expect(executeResult).toContain("Claimed task #1")
    expect(executeResult).toContain("in_progress")
    expect(executeResult).toContain("@agent-001")

    //#when: update task to completed
    const updateResult = await taskUpdateTool.execute(
      { task_id: "1", status: "completed", task_dir: taskDir },
      mockContext
    )

    //#then
    expect(updateResult).toContain("✓")
    expect(updateResult).toContain("Task #1 updated")
    expect(updateResult).toContain("status")

    //#when: get final task state
    const getResult = await taskGetTool.execute({ task_id: "1", task_dir: taskDir }, mockContext)

    //#then
    expect(getResult).toContain("Task #1")
    expect(getResult).toContain("completed")
    expect(getResult).toContain("@agent-001")
  })
  //#endregion

  //#region E2E: Task blocking and dependencies
  it("should handle task dependencies correctly", async () => {
    //#given
    await taskCreateTool.execute(
      { subject: "Task 1 - Foundation", description: "Base work", task_dir: taskDir },
      mockContext
    )
    await taskCreateTool.execute(
      { subject: "Task 2 - Dependent", description: "Depends on task 1", task_dir: taskDir },
      mockContext
    )

    //#when: add dependency
    await taskUpdateTool.execute(
      { task_id: "2", add_blocked_by: JSON.stringify(["1"]), task_dir: taskDir },
      mockContext
    )

    //#then: task 2 cannot be executed
    const executeResult = await taskExecuteTool.execute(
      { task_id: "2", agent_id: "agent-001", task_dir: taskDir },
      mockContext
    )
    expect(executeResult).toContain("✗")
    expect(executeResult).toContain("blocked")

    //#when: complete task 1
    await taskExecuteTool.execute({ task_id: "1", agent_id: "agent-001", task_dir: taskDir }, mockContext)
    await taskUpdateTool.execute({ task_id: "1", status: "completed", task_dir: taskDir }, mockContext)

    //#then: task 2 can now be executed
    const executeResult2 = await taskExecuteTool.execute(
      { task_id: "2", agent_id: "agent-002", task_dir: taskDir },
      mockContext
    )
    expect(executeResult2).toContain("✓")
    expect(executeResult2).toContain("Claimed task #2")
  })
  //#endregion

  //#region E2E: Task abort and cleanup
  it("should abort task and clean up dependencies", async () => {
    //#given
    await taskCreateTool.execute(
      { subject: "Task 1", description: "Will be aborted", task_dir: taskDir },
      mockContext
    )
    await taskCreateTool.execute(
      { subject: "Task 2", description: "Depends on task 1", task_dir: taskDir },
      mockContext
    )
    await taskUpdateTool.execute(
      { task_id: "2", add_blocked_by: JSON.stringify(["1"]), task_dir: taskDir },
      mockContext
    )

    //#when: abort task 1
    await taskAbortTool.execute({ task_id: "1", task_dir: taskDir }, mockContext)

    //#then: task 1 is deleted
    const getResult = await taskGetTool.execute({ task_id: "1", task_dir: taskDir }, mockContext)
    expect(getResult).toContain("Task not found")

    //#then: task 2 no longer blocked (check for "Blocked by | #" pattern in table)
    const task2Result = await taskGetTool.execute({ task_id: "2", task_dir: taskDir }, mockContext)
    expect(task2Result).toContain("Task #2")
    expect(task2Result.includes("| Blocked by |")).toBe(false)
  })
  //#endregion

  //#region E2E: Task suspend and resume
  it("should suspend and allow re-execution of task", async () => {
    //#given
    await taskCreateTool.execute(
      { subject: "Task 1", description: "In progress", task_dir: taskDir },
      mockContext
    )
    await taskExecuteTool.execute({ task_id: "1", agent_id: "agent-001", task_dir: taskDir }, mockContext)

    //#when: suspend the task
    const suspendResult = await taskSuspendTool.execute({ task_id: "1", task_dir: taskDir }, mockContext)

    //#then
    expect(suspendResult).toContain("✓")
    expect(suspendResult).toContain("suspended")

    //#when: verify task state
    const taskAfterSuspend = await taskGetTool.execute({ task_id: "1", task_dir: taskDir }, mockContext)

    //#then: task is pending and owner is cleared
    expect(taskAfterSuspend).toContain("pending")
    expect(taskAfterSuspend.includes("@agent-001")).toBe(false)

    //#when: another agent executes the task
    const executeResult = await taskExecuteTool.execute(
      { task_id: "1", agent_id: "agent-002", task_dir: taskDir },
      mockContext
    )

    //#then: new agent can claim the task
    expect(executeResult).toContain("✓")
    expect(executeResult).toContain("@agent-002")
  })
  //#endregion
})
