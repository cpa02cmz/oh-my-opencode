import { describe, it, expect } from "bun:test"
import { formatTeammate, formatSendMessage } from "./formatters"

describe("formatTeammate", () => {
  it("returns success message with teammate details when success=true", () => {
    //#given
    const result = {
      success: true,
      teammate: { name: "agent-1", team: "dev-team", mode: "default" },
    }

    //#when
    const output = formatTeammate(result)

    //#then
    expect(output).toContain("✓ Teammate")
    expect(output).toContain("agent-1")
    expect(output).toContain("spawned")
    expect(output).toContain("dev-team")
    expect(output).toContain("default")
  })

  it("returns failure message when success=false", () => {
    //#given
    const result = {
      success: false,
    }

    //#when
    const output = formatTeammate(result)

    //#then
    expect(output).toBe("✗ Failed to spawn teammate")
  })

  it("returns failure message when success=true but teammate is missing", () => {
    //#given
    const result = {
      success: true,
    }

    //#when
    const output = formatTeammate(result)

    //#then
    expect(output).toBe("✗ Failed to spawn teammate")
  })
})

describe("formatSendMessage", () => {
  it("returns success message with recipient and message type when success=true", () => {
    //#given
    const result = {
      success: true,
      recipient: "agent-2",
      messageType: "task_assignment",
    }

    //#when
    const output = formatSendMessage(result)

    //#then
    expect(output).toContain("✓ Message sent to")
    expect(output).toContain("agent-2")
    expect(output).toContain("task_assignment")
  })

  it("returns failure message with error when success=false", () => {
    //#given
    const result = {
      success: false,
      error: "Agent not found",
    }

    //#when
    const output = formatSendMessage(result)

    //#then
    expect(output).toBe("✗ Failed: Agent not found")
  })

  it("returns failure message with unknown error when success=false and error is missing", () => {
    //#given
    const result = {
      success: false,
    }

    //#when
    const output = formatSendMessage(result)

    //#then
    expect(output).toBe("✗ Failed: unknown error")
  })

  it("returns failure message when success=true but recipient is missing", () => {
    //#given
    const result = {
      success: true,
      messageType: "task_assignment",
    }

    //#when
    const output = formatSendMessage(result)

    //#then
    expect(output).toContain("✗ Failed:")
  })

  it("returns failure message when success=true but messageType is missing", () => {
    //#given
    const result = {
      success: true,
      recipient: "agent-2",
    }

    //#when
    const output = formatSendMessage(result)

    //#then
    expect(output).toContain("✗ Failed:")
  })
})
