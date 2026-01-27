import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { SwarmManager, type TeammateState } from "./swarm-manager"
import { readMessages, getUnreadMessages, sendMessage, clearInbox } from "./mailbox/mailbox"
import type { BackgroundManager } from "../background-agent/manager"
import type { SisyphusSwarmConfig } from "../../config/schema"
import type { TaskAssignment, ShutdownRequest } from "./mailbox/types"

//#region Stub BackgroundManager
let taskCounter = 0
const createStubBackgroundManager = (): BackgroundManager => {
  return {
    launch: async (input: {
      agent: string
      prompt: string
      description: string
      parentSessionID: string
      parentMessageID?: string
      skills?: string[]
    }) => ({
      id: `bg_${++taskCounter}`,
      status: "running" as const,
      sessionID: `ses_${taskCounter}`,
      description: input.description,
      prompt: input.prompt,
      agent: input.agent,
    }),
  } as unknown as BackgroundManager
}
//#endregion

describe("Sisyphus Swarm E2E", () => {
  let teamDir: string
  let stubManager: BackgroundManager
  let config: SisyphusSwarmConfig

  beforeEach(() => {
    teamDir = mkdtempSync(join(tmpdir(), "sisyphus-swarm-e2e-"))
    stubManager = createStubBackgroundManager()
    config = {
      enabled: true,
      storage_path: teamDir,
      ui_mode: "toast",
    }
  })

  afterEach(() => {
    rmSync(teamDir, { recursive: true, force: true })
  })

  //#region E2E: Full lifecycle
  it("should complete full swarm lifecycle: spawn -> verify state -> shutdown", async () => {
    //#given
    const manager = new SwarmManager(stubManager, config, { tmuxEnabled: false })

    //#when: spawn a teammate
    const spawnResult = await manager.spawnTeammate("alice", "You are a helpful assistant")

    //#then: teammate state is created
    expect(spawnResult.name).toBe("alice")
    expect(spawnResult.status).toMatch(/^(spawning|running)$/)
    expect(spawnResult.teamName).toBe("default")
    expect(spawnResult.teamDir).toContain(teamDir)
    expect(spawnResult.taskId).toMatch(/^bg_/)
    expect(spawnResult.sessionId).toMatch(/^ses_/)

    //#when: get teammate state
    const teammate = manager.getTeammate("alice")

    //#then: state is tracked
    expect(teammate).toBeDefined()
    expect(teammate?.name).toBe("alice")
    expect(teammate?.status).toMatch(/^(spawning|running)$/)

    //#when: shutdown teammate
    await manager.shutdownTeammate("alice")

    //#then: teammate is marked stopped
    const stoppedTeammate = manager.getTeammate("alice")
    expect(stoppedTeammate?.status).toBe("stopped")

    //#when: cleanup
    manager.cleanup()

    //#then: no errors
    expect(true).toBe(true)
  })
  //#endregion

  //#region E2E: Mailbox integration
  it("should send and receive messages via mailbox", async () => {
    //#given
    const manager = new SwarmManager(stubManager, config, { tmuxEnabled: false })
    const defaultTeamName = "default"
    const defaultTeamDir = join(config.storage_path, defaultTeamName)

    //#when: spawn teammate
    await manager.spawnTeammate("bob", "You are a task executor")

    //#when: send task assignment message
    const taskAssignment: TaskAssignment = {
      type: "task_assignment",
      taskId: "task-001",
      subject: "Implement feature",
      description: "Build the feature",
      assignedBy: "manager",
      timestamp: Date.now(),
    }
    sendMessage("bob", taskAssignment, "manager", defaultTeamDir)

    //#then: message is in inbox
    const messages = readMessages("bob", defaultTeamDir)
    expect(messages.length).toBe(1)
    expect(messages[0].from).toBe("manager")
    expect(messages[0].read).toBe(false)

    //#then: message content is correct
    const parsedMessage = JSON.parse(messages[0].text) as TaskAssignment
    expect(parsedMessage.type).toBe("task_assignment")
    expect(parsedMessage.taskId).toBe("task-001")
    expect(parsedMessage.subject).toBe("Implement feature")

    //#when: get unread messages
    const unreadMessages = getUnreadMessages("bob", defaultTeamDir)

    //#then: unread count is correct
    expect(unreadMessages.length).toBe(1)

    //#when: cleanup
    manager.cleanup()
  })
  //#endregion

  //#region E2E: Multi-teammate coordination
  it("should spawn and shutdown multiple teammates", async () => {
    //#given
    const manager = new SwarmManager(stubManager, config, { tmuxEnabled: false })

    //#when: spawn multiple teammates
    const alice = await manager.spawnTeammate("alice", "Assistant 1")
    const bob = await manager.spawnTeammate("bob", "Assistant 2")
    const charlie = await manager.spawnTeammate("charlie", "Assistant 3")

    //#then: all teammates are tracked
    const allTeammates = manager.getAllTeammates()
    expect(allTeammates.length).toBe(3)
    expect(allTeammates.map(t => t.name)).toContain("alice")
    expect(allTeammates.map(t => t.name)).toContain("bob")
    expect(allTeammates.map(t => t.name)).toContain("charlie")

    //#when: shutdown all teammates
    await manager.shutdownAll()

    //#then: all are marked stopped
    const finalTeammates = manager.getAllTeammates()
    expect(finalTeammates.every(t => t.status === "stopped")).toBe(true)
  })
  //#endregion

  //#region E2E: Teammate state tracking
  it("should track teammate state correctly", async () => {
    //#given
    const manager = new SwarmManager(stubManager, config, { tmuxEnabled: false })

    //#when: spawn teammates with different team names
    const alice = await manager.spawnTeammate("alice", "Assistant", { teamName: "team-a" })
    const bob = await manager.spawnTeammate("bob", "Assistant", { teamName: "team-b" })

    //#then: teammates have correct team assignments
    expect(alice.teamName).toBe("team-a")
    expect(bob.teamName).toBe("team-b")
    expect(alice.teamDir).toContain("team-a")
    expect(bob.teamDir).toContain("team-b")

    //#when: get all teammates
    const allTeammates = manager.getAllTeammates()

    //#then: count is correct
    expect(allTeammates.length).toBe(2)

    //#when: get specific teammate
    const retrieved = manager.getTeammate("alice")

    //#then: retrieval works
    expect(retrieved?.name).toBe("alice")
    expect(retrieved?.teamName).toBe("team-a")

    //#when: get non-existent teammate
    const notFound = manager.getTeammate("nonexistent")

    //#then: returns undefined
    expect(notFound).toBeUndefined()

    //#when: cleanup
    manager.cleanup()
  })
  //#endregion

  //#region E2E: Shutdown message protocol
  it("should send shutdown messages to teammates", async () => {
    //#given
    const manager = new SwarmManager(stubManager, config, { tmuxEnabled: false })
    const defaultTeamName = "default"
    const defaultTeamDir = join(config.storage_path, defaultTeamName)

    //#when: spawn teammate
    await manager.spawnTeammate("dave", "Assistant")

    //#when: shutdown teammate
    await manager.shutdownTeammate("dave")

    //#then: shutdown message is in inbox
    const messages = readMessages("dave", defaultTeamDir)
    expect(messages.length).toBe(1)

    //#then: message is shutdown request
    const shutdownMsg = JSON.parse(messages[0].text) as ShutdownRequest
    expect(shutdownMsg.type).toBe("shutdown_request")
    expect(messages[0].from).toBe("swarm-manager")
  })
  //#endregion

  //#region E2E: Inbox isolation per teammate
  it("should isolate inboxes per teammate", async () => {
    //#given
    const manager = new SwarmManager(stubManager, config, { tmuxEnabled: false })
    const defaultTeamName = "default"
    const defaultTeamDir = join(config.storage_path, defaultTeamName)

    //#when: spawn teammates
    await manager.spawnTeammate("eve", "Assistant")
    await manager.spawnTeammate("frank", "Assistant")

    //#when: send different messages to each
    const msg1: TaskAssignment = {
      type: "task_assignment",
      taskId: "task-001",
      subject: "Task for Eve",
      description: "Eve's work",
      assignedBy: "manager",
      timestamp: Date.now(),
    }
    const msg2: TaskAssignment = {
      type: "task_assignment",
      taskId: "task-002",
      subject: "Task for Frank",
      description: "Frank's work",
      assignedBy: "manager",
      timestamp: Date.now(),
    }
    sendMessage("eve", msg1, "manager", defaultTeamDir)
    sendMessage("frank", msg2, "manager", defaultTeamDir)

    //#then: each has only their own message
    const eveMessages = readMessages("eve", defaultTeamDir)
    const frankMessages = readMessages("frank", defaultTeamDir)

    expect(eveMessages.length).toBe(1)
    expect(frankMessages.length).toBe(1)

    const eveParsed = JSON.parse(eveMessages[0].text) as TaskAssignment
    const frankParsed = JSON.parse(frankMessages[0].text) as TaskAssignment

    expect(eveParsed.taskId).toBe("task-001")
    expect(frankParsed.taskId).toBe("task-002")

    //#when: cleanup
    manager.cleanup()
  })
  //#endregion

  //#region E2E: Inbox clearing
  it("should clear inbox for teammate", async () => {
    //#given
    const manager = new SwarmManager(stubManager, config, { tmuxEnabled: false })
    const defaultTeamName = "default"
    const defaultTeamDir = join(config.storage_path, defaultTeamName)

    //#when: spawn teammate
    await manager.spawnTeammate("grace", "Assistant")

    //#when: send multiple messages
    const msg1: TaskAssignment = {
      type: "task_assignment",
      taskId: "task-001",
      subject: "Task 1",
      description: "Work 1",
      assignedBy: "manager",
      timestamp: Date.now(),
    }
    const msg2: TaskAssignment = {
      type: "task_assignment",
      taskId: "task-002",
      subject: "Task 2",
      description: "Work 2",
      assignedBy: "manager",
      timestamp: Date.now(),
    }
    sendMessage("grace", msg1, "manager", defaultTeamDir)
    sendMessage("grace", msg2, "manager", defaultTeamDir)

    //#then: inbox has messages
    let messages = readMessages("grace", defaultTeamDir)
    expect(messages.length).toBe(2)

    //#when: clear inbox
    clearInbox("grace", defaultTeamDir)

    //#then: inbox is empty
    messages = readMessages("grace", defaultTeamDir)
    expect(messages.length).toBe(0)

    //#when: cleanup
    manager.cleanup()
  })
  //#endregion

  //#region E2E: Teammate with custom skills
  it("should spawn teammate with custom skills", async () => {
    //#given
    const manager = new SwarmManager(stubManager, config, { tmuxEnabled: false })

    //#when: spawn teammate with skills
    const result = await manager.spawnTeammate("henry", "Assistant", {
      skills: ["git-master", "typescript-programmer"],
    })

    //#then: teammate is created
    expect(result.name).toBe("henry")
    expect(result.status).toMatch(/^(spawning|running)$/)

    //#when: cleanup
    manager.cleanup()
  })
  //#endregion
})
