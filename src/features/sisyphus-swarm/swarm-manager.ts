import { join } from "path"
import type { BackgroundManager } from "../background-agent/manager"
import type { SisyphusSwarmConfig } from "../../config/schema"
import { ensureDir, writeJsonAtomic } from "../sisyphus-tasks/storage"
import { sendMessage } from "./mailbox/mailbox"
import type { ShutdownRequest } from "./mailbox/types"
import {
  createTeammatePane,
  applyPaneStyle,
  cleanupSwarmSession,
  executeCommand,
} from "./tmux-backend"

const DEFAULT_TEAM_NAME = "default"
const SWARM_MANAGER_SENDER = "swarm-manager"

export interface TeammateState {
  name: string
  taskId: string
  sessionId?: string
  status: "spawning" | "running" | "idle" | "stopped"
  teamName: string
  teamDir: string
}

export class SwarmManager {
  private teammates: Map<string, TeammateState> = new Map()
  private backgroundManager: BackgroundManager
  private config: SisyphusSwarmConfig
  private tmuxEnabled: boolean

  constructor(
    backgroundManager: BackgroundManager,
    config: SisyphusSwarmConfig,
    options?: { tmuxEnabled?: boolean }
  ) {
    this.backgroundManager = backgroundManager
    this.config = config
    this.tmuxEnabled = options?.tmuxEnabled ?? (config.ui_mode === "tmux" || config.ui_mode === "both")
  }

  async spawnTeammate(
    name: string,
    prompt: string,
    options?: {
      teamName?: string
      mode?: string
      skills?: string[]
    }
  ): Promise<TeammateState> {
    const teamName = options?.teamName ?? DEFAULT_TEAM_NAME
    const teamDir = join(this.config.storage_path, teamName)

    const inboxDir = join(teamDir, "inboxes")
    ensureDir(inboxDir)
    writeJsonAtomic(join(inboxDir, `${name}.json`), [])

    const task = await this.backgroundManager.launch({
      agent: name,
      prompt,
      description: `Swarm teammate: ${name}`,
      parentSessionID: "swarm",
      parentMessageID: "swarm",
      skills: options?.skills,
    })

    const state: TeammateState = {
      name,
      taskId: task.id,
      sessionId: task.sessionID,
      status: task.status === "running" ? "running" : "spawning",
      teamName,
      teamDir,
    }

    this.teammates.set(name, state)

    if (this.tmuxEnabled) {
      try {
        const pane = createTeammatePane(name)
        const styleCmd = applyPaneStyle(name, "#00CED1")
        executeCommand(pane.command)
        executeCommand(styleCmd)
      } catch {
      }
    }

    return state
  }

  getTeammate(name: string): TeammateState | undefined {
    return this.teammates.get(name)
  }

  getAllTeammates(): TeammateState[] {
    return Array.from(this.teammates.values())
  }

  async shutdownTeammate(name: string): Promise<void> {
    const state = this.teammates.get(name)
    if (!state) return

    const shutdownMessage: ShutdownRequest = { type: "shutdown_request" }
    sendMessage(name, shutdownMessage, SWARM_MANAGER_SENDER, state.teamDir)

    state.status = "stopped"
    this.teammates.set(name, state)
  }

  async shutdownAll(): Promise<void> {
    const activeTeammates = this.getAllTeammates().filter(t => t.status !== "stopped")
    for (const teammate of activeTeammates) {
      await this.shutdownTeammate(teammate.name)
    }

    if (this.tmuxEnabled) {
      try {
        cleanupSwarmSession()
      } catch {
      }
    }
  }

  cleanup(): void {
    const activeTeammates = this.getAllTeammates().filter(t => t.status !== "stopped")
    for (const teammate of activeTeammates) {
      const state = this.teammates.get(teammate.name)
      if (!state) continue

      const shutdownMessage: ShutdownRequest = { type: "shutdown_request" }
      sendMessage(teammate.name, shutdownMessage, SWARM_MANAGER_SENDER, state.teamDir)

      state.status = "stopped"
      this.teammates.set(teammate.name, state)
    }

    if (this.tmuxEnabled) {
      try {
        cleanupSwarmSession()
      } catch {
      }
    }
  }
}
