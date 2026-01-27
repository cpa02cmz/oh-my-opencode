import { describe, it, expect, beforeEach } from "bun:test"
import { createTasksTodowriteDisablerHook } from "./index"

describe("tasks-todowrite-disabler hook", () => {
  //#region given: hook with tasks enabled
  describe("when tasks are enabled", () => {
    let hook: ReturnType<typeof createTasksTodowriteDisablerHook>

    beforeEach(() => {
      //#given
      hook = createTasksTodowriteDisablerHook({
        sisyphusConfig: { tasks: { enabled: true } },
      })
    })

    //#when: todowrite tool is called
    it("should block todowrite tool with error message", async () => {
      //#when
      const input = { tool: "todowrite", sessionID: "ses_123", callID: "call_1" }
      const output = { args: { todos: [] }, message: "" }

      //#then
      await expect(
        hook["tool.execute.before"]!(input, output)
      ).rejects.toThrow("TodoWrite is disabled when Sisyphus Tasks are enabled")
    })

    //#when: todoread tool is called
    it("should allow todoread tool", async () => {
      //#when
      const input = { tool: "todoread", sessionID: "ses_123", callID: "call_1" }
      const output = { args: {}, message: "" }

      //#then
      await expect(
        hook["tool.execute.before"]!(input, output)
      ).resolves.toBeUndefined()
    })

    //#when: other tools are called
    it("should allow other tools", async () => {
      //#when
      const input = { tool: "read", sessionID: "ses_123", callID: "call_1" }
      const output = { args: { filePath: "/some/file" }, message: "" }

      //#then
      await expect(
        hook["tool.execute.before"]!(input, output)
      ).resolves.toBeUndefined()
    })
  })
  //#endregion

  //#region given: hook with tasks disabled
  describe("when tasks are disabled", () => {
    let hook: ReturnType<typeof createTasksTodowriteDisablerHook>

    beforeEach(() => {
      //#given
      hook = createTasksTodowriteDisablerHook({
        sisyphusConfig: { tasks: { enabled: false } },
      })
    })

    //#when: todowrite tool is called
    it("should allow todowrite tool", async () => {
      //#when
      const input = { tool: "todowrite", sessionID: "ses_123", callID: "call_1" }
      const output = { args: { todos: [] }, message: "" }

      //#then
      await expect(
        hook["tool.execute.before"]!(input, output)
      ).resolves.toBeUndefined()
    })
  })
  //#endregion

  //#region given: hook with no tasks config (default)
  describe("when tasks config is undefined (default)", () => {
    let hook: ReturnType<typeof createTasksTodowriteDisablerHook>

    beforeEach(() => {
      //#given
      hook = createTasksTodowriteDisablerHook({
        sisyphusConfig: undefined,
      })
    })

    //#when: todowrite tool is called
    it("should allow todowrite tool (default is disabled)", async () => {
      //#when
      const input = { tool: "todowrite", sessionID: "ses_123", callID: "call_1" }
      const output = { args: { todos: [] }, message: "" }

      //#then
      await expect(
        hook["tool.execute.before"]!(input, output)
      ).resolves.toBeUndefined()
    })
  })
  //#endregion
})
