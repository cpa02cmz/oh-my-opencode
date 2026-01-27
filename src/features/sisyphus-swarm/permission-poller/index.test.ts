import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import type { PermissionResponse } from "../mailbox/types"
import { sendMessage } from "../mailbox/mailbox"
import {
  createPermissionRequest,
  registerCallback,
  processResponse,
  clearCallbacks,
  startPolling
} from "./index"

const TEST_DIR = join(import.meta.dir, ".test-permission-poller")
const EXPECTED_FEEDBACK = "Too dangerous"

describe("Permission Poller", () => {
  const teamDir = join(TEST_DIR, "teams", "test-team")

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(join(teamDir, "inboxes"), { recursive: true })
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

  //#given permission_response in inbox
  //#when polling starts
  //#then processes response and invokes registered callback
  it("polls inbox and processes permission_response messages", async () => {
    // given
    const request = createPermissionRequest("Bash", { command: "ls" }, "agent-1")
    let allowedInput: unknown = null

    registerCallback(request.requestId, {
      onAllow: (input: unknown) => { allowedInput = input },
      onReject: () => {}
    })

    const response: PermissionResponse = {
      type: "permission_response",
      requestId: request.requestId,
      decision: "approved",
      updatedInput: { command: "ls -la" }
    }
    sendMessage("poller-agent", response, "leader", teamDir)

    // when
    const poller = startPolling("poller-agent", teamDir, 50)
    await new Promise<void>((resolve) => { setTimeout(resolve, 200) })
    poller.stop()

    // then
    expect(allowedInput).toEqual({ command: "ls -la" })
  })

  //#given permission_response in inbox
  //#when polling processes it
  //#then calls onMessage callback
  it("calls onMessage callback for each processed response", async () => {
    // given
    const request = createPermissionRequest("Bash", { command: "ls" }, "agent-1")
    const receivedMessages: PermissionResponse[] = []

    registerCallback(request.requestId, {
      onAllow: () => {},
      onReject: () => {}
    })

    const response: PermissionResponse = {
      type: "permission_response",
      requestId: request.requestId,
      decision: "approved"
    }
    sendMessage("callback-agent", response, "leader", teamDir)

    // when
    const poller = startPolling("callback-agent", teamDir, 50, (message) => {
      receivedMessages.push(message)
    })
    await new Promise<void>((resolve) => { setTimeout(resolve, 200) })
    poller.stop()

    // then
    expect(receivedMessages.length).toBe(1)
    expect(receivedMessages[0].requestId).toBe(request.requestId)
  })

  //#given non-permission_response message in inbox
  //#when polling reads it
  //#then skips non-permission messages and marks them read
  it("skips non-permission_response messages", async () => {
    // given
    sendMessage("skip-agent", { type: "idle_notification" }, "sender", teamDir)
    const receivedMessages: PermissionResponse[] = []

    // when
    const poller = startPolling("skip-agent", teamDir, 50, (message) => {
      receivedMessages.push(message)
    })
    await new Promise<void>((resolve) => { setTimeout(resolve, 200) })
    poller.stop()

    // then
    expect(receivedMessages.length).toBe(0)
  })

  //#given invalid JSON in inbox message text
  //#when polling reads it
  //#then skips gracefully without crashing
  it("handles invalid JSON in message text gracefully", async () => {
    // given - write a raw inbox with invalid JSON text
    const { writeFileSync } = await import("node:fs")
    const inboxPath = join(teamDir, "inboxes", "bad-json-agent.json")
    const badMessages = [
      { from: "sender", text: "not-valid-json{{{", timestamp: "2026-01-27T00:00:00Z", read: false }
    ]
    writeFileSync(inboxPath, JSON.stringify(badMessages))

    const receivedMessages: PermissionResponse[] = []

    // when
    const poller = startPolling("bad-json-agent", teamDir, 50, (message) => {
      receivedMessages.push(message)
    })
    await new Promise<void>((resolve) => { setTimeout(resolve, 200) })
    poller.stop()

    // then
    expect(receivedMessages.length).toBe(0)
  })

  //#given running poller
  //#when stop() is called
  //#then polling ceases
  it("stops polling when stop() is called", async () => {
    // given
    const poller = startPolling("stop-agent", teamDir, 50)

    // when
    poller.stop()
    await new Promise<void>((resolve) => { setTimeout(resolve, 100) })

    // then - send a message after stop, it should NOT be processed
    const request = createPermissionRequest("Bash", { command: "ls" }, "agent-1")
    let callbackInvoked = false
    registerCallback(request.requestId, {
      onAllow: () => { callbackInvoked = true },
      onReject: () => { callbackInvoked = true }
    })

    const response: PermissionResponse = {
      type: "permission_response",
      requestId: request.requestId,
      decision: "approved"
    }
    sendMessage("stop-agent", response, "leader", teamDir)

    await new Promise<void>((resolve) => { setTimeout(resolve, 150) })

    // then
    expect(callbackInvoked).toBe(false)
  })
})
