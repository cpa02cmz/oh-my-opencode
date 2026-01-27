import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs"
import { join } from "path"
import type { BackgroundManager } from "../background-agent/manager"
import type { BackgroundTask, LaunchInput } from "../background-agent/types"
import type { SisyphusSwarmConfig } from "../../config/schema"
import { SwarmManager } from "./swarm-manager"

const TEST_DIR = join(import.meta.dirname, ".test-swarm-manager")

function createStubManager(overrides?: {
  launch?: (input: LaunchInput) => Promise<BackgroundTask>
}): BackgroundManager {
  return {
    launch: overrides?.launch ?? (async (input: LaunchInput) => ({
      id: `bg_test_${Date.now()}`,
      status: "running" as const,
      sessionID: `ses_test_${Date.now()}`,
      description: input.description,
      prompt: input.prompt,
      agent: input.agent,
      parentSessionID: input.parentSessionID,
      parentMessageID: input.parentMessageID,
    })),
  } as unknown as BackgroundManager
}

function createConfig(overrides?: Partial<SisyphusSwarmConfig>): SisyphusSwarmConfig {
  return {
    enabled: true,
    storage_path: join(TEST_DIR, "teams"),
    ui_mode: "toast",
    ...overrides,
  }
}

describe("SwarmManager", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe("spawnTeammate", () => {
    //#given a SwarmManager with stub BackgroundManager
    //#when spawning a teammate
    //#then returns TeammateState with correct fields
    it("returns TeammateState with correct fields", async () => {
      // given
      const stubManager = createStubManager()
      const config = createConfig()
      const manager = new SwarmManager(stubManager, config)

      // when
      const state = await manager.spawnTeammate("worker-1", "Do the task")

      // then
      expect(state.name).toBe("worker-1")
      expect(state.taskId).toMatch(/^bg_/)
      expect(state.status).toBe("running")
      expect(state.teamName).toBe("default")
      expect(state.teamDir).toContain("teams")
    })

    //#given a SwarmManager
    //#when spawning with custom teamName
    //#then uses provided teamName
    it("uses provided teamName", async () => {
      // given
      const stubManager = createStubManager()
      const config = createConfig()
      const manager = new SwarmManager(stubManager, config)

      // when
      const state = await manager.spawnTeammate("worker-1", "Do the task", {
        teamName: "alpha-team",
      })

      // then
      expect(state.teamName).toBe("alpha-team")
      expect(state.teamDir).toContain("alpha-team")
    })

    //#given a SwarmManager
    //#when spawning a teammate
    //#then creates inbox directory for teammate
    it("creates inbox directory for teammate", async () => {
      // given
      const stubManager = createStubManager()
      const config = createConfig()
      const manager = new SwarmManager(stubManager, config)

      // when
      await manager.spawnTeammate("worker-1", "Do the task")

      // then
      const inboxPath = join(config.storage_path, "default", "inboxes", "worker-1.json")
      expect(existsSync(inboxPath)).toBe(true)
      const content = JSON.parse(readFileSync(inboxPath, "utf-8"))
      expect(content).toEqual([])
    })

    //#given a SwarmManager
    //#when spawning a teammate
    //#then calls backgroundManager.launch with correct LaunchInput
    it("calls backgroundManager.launch with correct LaunchInput", async () => {
      // given
      let capturedInput: LaunchInput | undefined
      const stubManager = createStubManager({
        launch: async (input: LaunchInput) => {
          capturedInput = input
          return {
            id: "bg_captured",
            status: "running" as const,
            sessionID: "ses_captured",
            description: input.description,
            prompt: input.prompt,
            agent: input.agent,
            parentSessionID: input.parentSessionID,
            parentMessageID: input.parentMessageID,
          }
        },
      })
      const config = createConfig()
      const manager = new SwarmManager(stubManager, config)

      // when
      await manager.spawnTeammate("worker-1", "Build the feature", {
        skills: ["typescript-programmer"],
      })

      // then
      expect(capturedInput).toBeDefined()
      expect(capturedInput!.agent).toBe("worker-1")
      expect(capturedInput!.prompt).toBe("Build the feature")
      expect(capturedInput!.description).toContain("worker-1")
      expect(capturedInput!.skills).toEqual(["typescript-programmer"])
    })

    //#given a SwarmManager with sessionID in launch result
    //#when spawning a teammate
    //#then stores sessionId in TeammateState
    it("stores sessionId from launch result", async () => {
      // given
      const stubManager = createStubManager({
        launch: async (input: LaunchInput) => ({
          id: "bg_with_session",
          status: "running" as const,
          sessionID: "ses_abc123",
          description: input.description,
          prompt: input.prompt,
          agent: input.agent,
          parentSessionID: input.parentSessionID,
          parentMessageID: input.parentMessageID,
        }),
      })
      const config = createConfig()
      const manager = new SwarmManager(stubManager, config)

      // when
      const state = await manager.spawnTeammate("worker-1", "Do work")

      // then
      expect(state.sessionId).toBe("ses_abc123")
    })
  })

  describe("getTeammate", () => {
    //#given a spawned teammate
    //#when getting by name
    //#then returns the teammate state
    it("returns teammate state by name", async () => {
      // given
      const stubManager = createStubManager()
      const config = createConfig()
      const manager = new SwarmManager(stubManager, config)
      await manager.spawnTeammate("worker-1", "Do the task")

      // when
      const state = manager.getTeammate("worker-1")

      // then
      expect(state).toBeDefined()
      expect(state!.name).toBe("worker-1")
    })

    //#given no spawned teammates
    //#when getting by name
    //#then returns undefined
    it("returns undefined for unknown teammate", () => {
      // given
      const stubManager = createStubManager()
      const config = createConfig()
      const manager = new SwarmManager(stubManager, config)

      // when
      const state = manager.getTeammate("nonexistent")

      // then
      expect(state).toBeUndefined()
    })
  })

  describe("getAllTeammates", () => {
    //#given multiple spawned teammates
    //#when getting all
    //#then returns all teammate states
    it("returns all teammate states", async () => {
      // given
      const stubManager = createStubManager()
      const config = createConfig()
      const manager = new SwarmManager(stubManager, config)
      await manager.spawnTeammate("worker-1", "Task 1")
      await manager.spawnTeammate("worker-2", "Task 2")

      // when
      const all = manager.getAllTeammates()

      // then
      expect(all.length).toBe(2)
      expect(all.map(t => t.name).sort()).toEqual(["worker-1", "worker-2"])
    })

    //#given no spawned teammates
    //#when getting all
    //#then returns empty array
    it("returns empty array when no teammates", () => {
      // given
      const stubManager = createStubManager()
      const config = createConfig()
      const manager = new SwarmManager(stubManager, config)

      // when
      const all = manager.getAllTeammates()

      // then
      expect(all).toEqual([])
    })
  })

  describe("shutdownTeammate", () => {
    //#given a running teammate
    //#when shutting down
    //#then sends shutdown_request via mailbox and updates status
    it("sends shutdown_request and updates status to stopped", async () => {
      // given
      const stubManager = createStubManager()
      const config = createConfig()
      const manager = new SwarmManager(stubManager, config)
      await manager.spawnTeammate("worker-1", "Do the task")

      // when
      await manager.shutdownTeammate("worker-1")

      // then
      const state = manager.getTeammate("worker-1")
      expect(state).toBeDefined()
      expect(state!.status).toBe("stopped")

      // Verify shutdown message was sent to inbox
      const inboxPath = join(config.storage_path, "default", "inboxes", "worker-1.json")
      const messages = JSON.parse(readFileSync(inboxPath, "utf-8"))
      expect(messages.length).toBe(1)
      const protocolMessage = JSON.parse(messages[0].text)
      expect(protocolMessage.type).toBe("shutdown_request")
    })

    //#given a nonexistent teammate
    //#when shutting down
    //#then does nothing (no error)
    it("does nothing for unknown teammate", async () => {
      // given
      const stubManager = createStubManager()
      const config = createConfig()
      const manager = new SwarmManager(stubManager, config)

      // when / then - should not throw
      await manager.shutdownTeammate("nonexistent")
    })
  })

  describe("shutdownAll", () => {
    //#given multiple running teammates
    //#when shutting down all
    //#then all teammates are stopped
    it("stops all teammates", async () => {
      // given
      const stubManager = createStubManager()
      const config = createConfig()
      const manager = new SwarmManager(stubManager, config)
      await manager.spawnTeammate("worker-1", "Task 1")
      await manager.spawnTeammate("worker-2", "Task 2")

      // when
      await manager.shutdownAll()

      // then
      const all = manager.getAllTeammates()
      expect(all.every(t => t.status === "stopped")).toBe(true)
    })
  })

  describe("cleanup", () => {
    //#given running teammates
    //#when cleanup is called
    //#then all teammates are stopped
    it("shuts down all teammates on cleanup", async () => {
      // given
      const stubManager = createStubManager()
      const config = createConfig()
      const manager = new SwarmManager(stubManager, config)
      await manager.spawnTeammate("worker-1", "Task 1")

      // when
      manager.cleanup()

      // then
      const all = manager.getAllTeammates()
      expect(all.every(t => t.status === "stopped")).toBe(true)
    })
  })

  describe("tmux integration", () => {
    //#given tmux disabled (default)
    //#when spawning a teammate
    //#then does not attempt tmux operations
    it("does not use tmux when disabled", async () => {
      // given
      const stubManager = createStubManager()
      const config = createConfig({ ui_mode: "toast" })
      const manager = new SwarmManager(stubManager, config)

      // when
      const state = await manager.spawnTeammate("worker-1", "Do the task")

      // then - no error, teammate spawned successfully
      expect(state.name).toBe("worker-1")
      expect(state.status).toBe("running")
    })

    //#given tmux explicitly enabled via options
    //#when creating SwarmManager
    //#then tmux is enabled
    it("respects tmuxEnabled option override", async () => {
      // given
      const stubManager = createStubManager()
      const config = createConfig({ ui_mode: "toast" })
      const manager = new SwarmManager(stubManager, config, { tmuxEnabled: true })

      // when - spawn should work (tmux calls may fail in test env but shouldn't throw)
      const state = await manager.spawnTeammate("worker-1", "Do the task")

      // then
      expect(state.name).toBe("worker-1")
    })
  })
})
