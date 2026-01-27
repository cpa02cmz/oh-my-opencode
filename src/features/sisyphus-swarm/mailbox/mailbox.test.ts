import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import {
  getInboxPath,
  readMessages,
  getUnreadMessages,
  sendMessage,
  markAsRead,
  clearInbox
} from "./mailbox"

const TEST_DIR = join(import.meta.dirname, ".test-mailbox")

describe("Mailbox IPC", () => {
  const teamDir = join(TEST_DIR, "teams", "test-team")

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(join(teamDir, "inboxes"), { recursive: true })
  })

  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

  //#given inbox path
  //#when getting path
  //#then return correct path
  it("getInboxPath returns correct path", () => {
    const path = getInboxPath("agent-1", teamDir)
    expect(path).toBe(join(teamDir, "inboxes", "agent-1.json"))
  })

  //#given empty inbox
  //#when reading messages
  //#then return empty array
  it("readMessages returns empty for new inbox", () => {
    writeFileSync(join(teamDir, "inboxes", "agent-1.json"), "[]")
    const messages = readMessages("agent-1", teamDir)
    expect(messages).toEqual([])
  })

  //#given message to send
  //#when sending
  //#then message appears in recipient inbox
  it("sendMessage adds to recipient inbox", () => {
    writeFileSync(join(teamDir, "inboxes", "agent-1.json"), "[]")
    sendMessage("agent-1", { type: "idle_notification" }, "sender", teamDir)

    const messages = readMessages("agent-1", teamDir)
    expect(messages.length).toBe(1)
    expect(messages[0].from).toBe("sender")
    expect(messages[0].read).toBe(false)
  })

  //#given messages with unread
  //#when getting unread
  //#then return only unread
  it("getUnreadMessages filters correctly", () => {
    const inbox = [
      { from: "a", text: "{}", timestamp: "2026-01-27T00:00:00Z", read: true },
      { from: "b", text: "{}", timestamp: "2026-01-27T00:01:00Z", read: false }
    ]
    writeFileSync(join(teamDir, "inboxes", "agent-1.json"), JSON.stringify(inbox))

    const unread = getUnreadMessages("agent-1", teamDir)
    expect(unread.length).toBe(1)
    expect(unread[0].from).toBe("b")
  })

  //#given unread message
  //#when marking as read
  //#then message marked read
  it("markAsRead marks single message", () => {
    const inbox = [
      { from: "a", text: "{}", timestamp: "2026-01-27T00:00:00Z", read: false }
    ]
    writeFileSync(join(teamDir, "inboxes", "agent-1.json"), JSON.stringify(inbox))

    markAsRead("agent-1", teamDir, 0)

    const messages = readMessages("agent-1", teamDir)
    expect(messages[0].read).toBe(true)
  })

  //#given messages
  //#when clearing inbox
  //#then inbox empty
  it("clearInbox removes all messages", () => {
    const inbox = [
      { from: "a", text: "{}", timestamp: "2026-01-27T00:00:00Z", read: false }
    ]
    writeFileSync(join(teamDir, "inboxes", "agent-1.json"), JSON.stringify(inbox))

    clearInbox("agent-1", teamDir)

    const messages = readMessages("agent-1", teamDir)
    expect(messages.length).toBe(0)
  })
})
