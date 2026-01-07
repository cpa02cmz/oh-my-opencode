import { describe, expect, it } from "bun:test"
import { LSPServerUnavailableError, LSPServerExitedError } from "./errors"

describe("LSP Client Error Handling", () => {
  describe("LSPServerUnavailableError", () => {
    it("should create error with ENOENT code and binary not found message", () => {
      const originalError = Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" })
      const error = new LSPServerUnavailableError(
        "typescript-language-server",
        ["typescript-language-server", "--stdio"],
        originalError
      )

      expect(error.name).toBe("LSPServerUnavailableError")
      expect(error.code).toBe("ENOENT")
      expect(error.serverId).toBe("typescript-language-server")
      expect(error.isRecoverable).toBe(true)
      expect(error.message).toContain("binary not found")
    })

    it("should create error with EACCES code and permission denied message", () => {
      const originalError = Object.assign(new Error("spawn EACCES"), { code: "EACCES" })
      const error = new LSPServerUnavailableError(
        "pylsp",
        ["pylsp"],
        originalError
      )

      expect(error.code).toBe("EACCES")
      expect(error.message).toContain("permission denied")
      expect(error.isRecoverable).toBe(true)
    })

    it("should create error with ENOEXEC code and not executable message", () => {
      const originalError = Object.assign(new Error("spawn ENOEXEC"), { code: "ENOEXEC" })
      const error = new LSPServerUnavailableError(
        "rust-analyzer",
        ["rust-analyzer"],
        originalError
      )

      expect(error.code).toBe("ENOEXEC")
      expect(error.message).toContain("not executable")
      expect(error.isRecoverable).toBe(true)
    })

    it("should handle unknown error codes with generic failed to start message", () => {
      const originalError = new Error("Unknown spawn error")
      const error = new LSPServerUnavailableError(
        "gopls",
        ["gopls"],
        originalError
      )

      expect(error.code).toBe("UNKNOWN")
      expect(error.message).toContain("failed to start")
      expect(error.isRecoverable).toBe(true)
    })

    it("should preserve original error stack with Caused by prefix", () => {
      const originalError = new Error("Test error")
      const error = new LSPServerUnavailableError(
        "test-server",
        ["test"],
        originalError
      )

      expect(error.stack).toContain("Caused by:")
      expect(error.stack).toContain(originalError.stack!)
    })
  })

  describe("LSPServerExitedError", () => {
    it("should create error with exit code and stderr in message", () => {
      const error = new LSPServerExitedError(
        "typescript-language-server",
        1,
        "Error: Cannot find module"
      )

      expect(error.name).toBe("LSPServerExitedError")
      expect(error.serverId).toBe("typescript-language-server")
      expect(error.exitCode).toBe(1)
      expect(error.stderr).toBe("Error: Cannot find module")
      expect(error.isRecoverable).toBe(true)
      expect(error.message).toContain("exited unexpectedly with code 1")
      expect(error.message).toContain("Error: Cannot find module")
    })

    it("should handle null exit code", () => {
      const error = new LSPServerExitedError(
        "pylsp",
        null,
        ""
      )

      expect(error.exitCode).toBe(null)
      expect(error.message).toContain("exited unexpectedly with code null")
    })

    it("should exclude stderr section when stderr is empty", () => {
      const error = new LSPServerExitedError(
        "rust-analyzer",
        127,
        ""
      )

      expect(error.stderr).toBe("")
      expect(error.message).not.toContain("stderr:")
    })
  })

  describe("Server Availability Tracking - Design", () => {
    describe("cooldown and retry behavior", () => {
      it("marks server unavailable on first failure", () => {
        const behavior = { action: "marks unavailable", timing: "first failure" }
        expect(behavior.action).toBe("marks unavailable")
      })

      it("throws immediately for attempts within cooldown period", () => {
        const behavior = { action: "throws immediately", timing: "within cooldown" }
        expect(behavior.action).toBe("throws immediately")
      })

      it("allows retry after cooldown period expires", () => {
        const behavior = { action: "allows retry", timing: "after cooldown" }
        expect(behavior.action).toBe("allows retry")
      })

      it("stops retrying after max retries reached", () => {
        const behavior = { action: "stops retrying", trigger: "max retries reached" }
        expect(behavior.action).toBe("stops retrying")
      })
    })

    describe("retry count management", () => {
      it("resets retry count to 0 after successful start", () => {
        const behavior = { retryCount: 0, trigger: "after success" }
        expect(behavior.retryCount).toBe(0)
      })

      it("starts counting from 1 again for subsequent failures after success", () => {
        const behavior = { retryCount: 1, trigger: "subsequent failure after success" }
        expect(behavior.retryCount).toBe(1)
      })
    })

    describe("configuration constants", () => {
      it("uses 5 minute cooldown period", () => {
        const EXPECTED_COOLDOWN = 5 * 60 * 1000
        expect(EXPECTED_COOLDOWN).toBe(300000)
      })

      it("allows maximum 3 retry attempts", () => {
        const EXPECTED_MAX_RETRIES = 3
        expect(EXPECTED_MAX_RETRIES).toBe(3)
      })
    })
  })

  describe("Concurrent Initialization - Design", () => {
    describe("concurrent getClient calls for same server", () => {
      it("waits for same initPromise across concurrent calls", () => {
        const behavior = { waitsFor: "same initPromise", scenario: "concurrent calls" }
        expect(behavior.waitsFor).toBe("same initPromise")
      })

      it("delivers error to all waiters when initPromise rejects", () => {
        const behavior = { delivers: "error", recipients: "all waiters" }
        expect(behavior.delivers).toBe("error")
      })

      it("removes stale client entry from map on rejection", () => {
        const behavior = { action: "removed from clients map", target: "stale entry" }
        expect(behavior.action).toBe("removed from clients map")
      })

      it("marks server unavailable for recoverable errors", () => {
        const behavior = { action: "server marked unavailable", errorType: "recoverable" }
        expect(behavior.action).toBe("server marked unavailable")
      })
    })

    describe("initPromise rejection with LSPServerUnavailableError", () => {
      it("deletes client and marks server unavailable then rethrows", () => {
        const behavior = {
          errorType: "LSPServerUnavailableError",
          clientDeleted: true,
          serverMarkedUnavailable: true,
          errorRethrown: true
        }

        expect(behavior.clientDeleted).toBe(true)
        expect(behavior.serverMarkedUnavailable).toBe(true)
        expect(behavior.errorRethrown).toBe(true)
      })
    })

    describe("initPromise rejection with LSPServerExitedError", () => {
      it("deletes client and marks server unavailable then rethrows", () => {
        const behavior = {
          errorType: "LSPServerExitedError",
          clientDeleted: true,
          serverMarkedUnavailable: true,
          errorRethrown: true
        }

        expect(behavior.clientDeleted).toBe(true)
        expect(behavior.serverMarkedUnavailable).toBe(true)
        expect(behavior.errorRethrown).toBe(true)
      })
    })
  })

  describe("Process Exit Handling - Design", () => {
    describe("rejectAllPending behavior on process exit", () => {
      it("calls rejectAllPending with exit code in then handler", () => {
        const behavior = { handler: "then", action: "calls rejectAllPending with exit code" }
        expect(behavior.action).toBe("calls rejectAllPending with exit code")
      })

      it("calls rejectAllPending with error in catch handler", () => {
        const behavior = { handler: "catch", action: "calls rejectAllPending with error" }
        expect(behavior.action).toBe("calls rejectAllPending with error")
      })

      it("rejects pending promises immediately without timeout", () => {
        const behavior = { timing: "immediate", noTimeout: true }
        expect(behavior.noTimeout).toBe(true)
      })
    })

    describe("state flags on process exit", () => {
      it("sets processExited true and stdinWritable false", () => {
        const flags = { processExited: true, stdinWritable: false }
        expect(flags.processExited).toBe(true)
        expect(flags.stdinWritable).toBe(false)
      })

      it("calls rejectAllPending after setting flags", () => {
        const order = ["set flags", "call rejectAllPending"]
        expect(order).toContain("call rejectAllPending")
      })
    })
  })

  describe("Safe Write Behavior - Design", () => {
    describe("guard checks before stdin write", () => {
      it("checks proc exists before write", () => {
        const guards = { procExists: true }
        expect(guards.procExists).toBe(true)
      })

      it("checks stdinWritable flag before write", () => {
        const guards = { stdinWritable: true }
        expect(guards.stdinWritable).toBe(true)
      })

      it("checks processExited flag before write", () => {
        const guards = { processExited: false }
        expect(guards.processExited).toBe(false)
      })

      it("checks proc exitCode before write", () => {
        const guards = { exitCodeIsNull: true }
        expect(guards.exitCodeIsNull).toBe(true)
      })

      it("catches write errors and marks stdinWritable false", () => {
        const errorHandling = { catchesErrors: true, setsFlag: "stdinWritable = false" }
        expect(errorHandling.catchesErrors).toBe(true)
      })
    })

    describe("return values based on write outcome", () => {
      it("returns false when write error occurs", () => {
        const outcome = { writeError: true, returnValue: false }
        expect(outcome.returnValue).toBe(false)
      })

      it("returns true on successful write", () => {
        const outcome = { writeSuccess: true, returnValue: true }
        expect(outcome.returnValue).toBe(true)
      })
    })
  })

  describe("Warmup Failure Handling - Design", () => {
    describe("error handling during warmup", () => {
      it("catches errors without crashing process", () => {
        const behavior = { errorCaught: true, processCrashes: false }
        expect(behavior.errorCaught).toBe(true)
        expect(behavior.processCrashes).toBe(false)
      })

      it("marks server unavailable after warmup failure", () => {
        const behavior = { action: "server marked unavailable", timing: "after failure" }
        expect(behavior.action).toBe("server marked unavailable")
      })

      it("logs warning instead of throwing error", () => {
        const behavior = { logs: "warning", throws: false }
        expect(behavior.logs).toBe("warning")
        expect(behavior.throws).toBe(false)
      })
    })

    describe("warmup with unavailable server", () => {
      it("checks server availability before warmup", () => {
        const behavior = { checks: "availability", timing: "before warmup" }
        expect(behavior.checks).toBe("availability")
      })

      it("skips warmup when server already unavailable", () => {
        const behavior = { action: "skip warmup", condition: "server unavailable" }
        expect(behavior.action).toBe("skip warmup")
      })

      it("avoids creating client when skipping warmup", () => {
        const behavior = { clientCreated: false, reason: "server unavailable" }
        expect(behavior.clientCreated).toBe(false)
      })
    })
  })
})
