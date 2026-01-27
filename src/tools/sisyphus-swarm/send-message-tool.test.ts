import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, readFileSync } from "fs"
import { join } from "path"
import { sendMessageTool } from "./send-message-tool"

const TEST_DIR = join(import.meta.dirname, ".test-send-message")
const mockContext = {} as Parameters<typeof sendMessageTool.execute>[1]

describe("SendMessageTool", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

  //#given valid recipient and message payload
  //#when sending message
  //#then create inbox and store message
  it("sends message to recipient inbox", async () => {
    const teamDir = join(TEST_DIR, "teams", "test-team")
    const result = await sendMessageTool.execute(
      {
        recipient: "agent-1",
        message_type: "idle_notification",
        payload: "{}",
        team_dir: teamDir,
      },
      mockContext
    )

    expect(result).toContain("✓")
    expect(result).toContain("agent-1")
    expect(result).toContain("Message sent")

    const inboxPath = join(teamDir, "inboxes", "agent-1.json")
    const content = readFileSync(inboxPath, "utf-8")
    const messages = JSON.parse(content)
    expect(messages).toHaveLength(1)
    expect(messages[0].text).toContain("idle_notification")
  })

  //#given valid task_assignment message
  //#when sending with taskId and description
  //#then parse payload and construct ProtocolMessage
  it("sends task_assignment with parsed payload", async () => {
    const teamDir = join(TEST_DIR, "teams", "test-team")
    const payload = JSON.stringify({
      taskId: "task-123",
      subject: "Test task",
      description: "Do something",
      assignedBy: "manager",
      timestamp: 1234567890,
    })

    const result = await sendMessageTool.execute(
      {
        recipient: "worker-1",
        message_type: "task_assignment",
        payload,
        team_dir: teamDir,
      },
      mockContext
    )

    expect(result).toContain("✓")
    expect(result).toContain("worker-1")

    const inboxPath = join(teamDir, "inboxes", "worker-1.json")
    const content = readFileSync(inboxPath, "utf-8")
    const messages = JSON.parse(content)
    expect(messages[0].text).toContain("task_assignment")
    expect(messages[0].text).toContain("task-123")
  })

  //#given default team_dir
  //#when team_dir not provided
  //#then use .sisyphus/teams/default-team
  it("uses default team_dir when not provided", async () => {
    const result = await sendMessageTool.execute(
      {
        recipient: "agent-1",
        message_type: "idle_notification",
        payload: "{}",
      },
      mockContext
    )

    expect(result).toContain("✓")
    expect(result).toContain("agent-1")
  })

  //#given invalid JSON payload
  //#when sending message
  //#then return error message
  it("returns error for invalid JSON payload", async () => {
    const teamDir = join(TEST_DIR, "teams", "test-team")
    const result = await sendMessageTool.execute(
      {
        recipient: "agent-1",
        message_type: "idle_notification",
        payload: "not valid json",
        team_dir: teamDir,
      },
      mockContext
    )

    expect(result).toContain("✗")
    expect(result).toContain("Failed")
  })

  //#given permission_response message type
  //#when sending with decision field
  //#then construct valid ProtocolMessage
  it("sends permission_response with decision", async () => {
    const teamDir = join(TEST_DIR, "teams", "test-team")
    const payload = JSON.stringify({
      requestId: "req-123",
      decision: "approved",
      feedback: "Looks good",
    })

    const result = await sendMessageTool.execute(
      {
        recipient: "requester",
        message_type: "permission_response",
        payload,
        team_dir: teamDir,
      },
      mockContext
    )

    expect(result).toContain("✓")

    const inboxPath = join(teamDir, "inboxes", "requester.json")
    const content = readFileSync(inboxPath, "utf-8")
    const messages = JSON.parse(content)
    expect(messages[0].text).toContain("permission_response")
    expect(messages[0].text).toContain("approved")
  })
})
