import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import type { PermissionResponse } from "../mailbox/types"
import {
  createPermissionRequest,
  registerCallback,
  processResponse,
  clearCallbacks
} from "./index"

const TEST_DIR = join(import.meta.dir, ".test-permission-poller")
const EXPECTED_FEEDBACK = "Too dangerous"

describe("Permission Poller", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
    clearCallbacks()
  })
  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    clearCallbacks()
  })

  //#given tool call
  //#when creating permission request
  //#then return valid request object
  it("creates permission request", () => {
    const request = createPermissionRequest(
      "Bash",
      { command: "rm -rf /" },
      "agent-1"
    )

    expect(request.type).toBe("permission_request")
    expect(request.toolName).toBe("Bash")
    expect(request.agentId).toBe("agent-1")
    expect(request.requestId).toBeDefined()
  })

  //#given registered callback
  //#when processing approved response
  //#then invoke onAllow
  it("invokes callback on approval", async () => {
    const request = createPermissionRequest(
      "Bash",
      { command: "ls" },
      "agent-1"
    )
    let allowedInput: unknown = null

    registerCallback(request.requestId, {
      onAllow: (input: unknown) => {
        allowedInput = input
      },
      onReject: () => {}
    })

    const approvalResponse: PermissionResponse = {
      type: "permission_response",
      requestId: request.requestId,
      decision: "approved",
      updatedInput: { command: "ls -la" }
    }

    processResponse(approvalResponse)

    expect(allowedInput).toEqual({ command: "ls -la" })
  })

  //#given registered callback
  //#when processing rejected response
  //#then invoke onReject
  it("invokes callback on rejection", async () => {
    const request = createPermissionRequest(
      "Bash",
      { command: "rm -rf /" },
      "agent-1"
    )
    let rejectionFeedback = ""

    registerCallback(request.requestId, {
      onAllow: () => {},
      onReject: (feedback?: string) => {
        rejectionFeedback = feedback ?? ""
      }
    })

    const rejectionResponse: PermissionResponse = {
      type: "permission_response",
      requestId: request.requestId,
      decision: "rejected",
      feedback: EXPECTED_FEEDBACK
    }

    processResponse(rejectionResponse)

    if (rejectionFeedback !== EXPECTED_FEEDBACK) {
      throw new Error("Expected rejection feedback to be Too dangerous")
    }
  })
})
