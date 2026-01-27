import { join } from "path"
import { ensureDir, writeJsonAtomic } from "../../features/sisyphus-tasks/storage"
import type { MailboxMessage } from "../../features/sisyphus-swarm/mailbox/types"

export interface TeammateInput {
  name?: string
  team_name?: string
  mode?: "acceptEdits" | "bypassPermissions" | "default" | "delegate" | "dontAsk" | "plan"
}

export interface TeammateContext {
  teamDir?: string
  dryRun?: boolean
}

export const teammateTool = {
  name: "TeammateTool",
  description: "Spawn a new teammate agent",
  inputSchema: {
    name: { type: "string", optional: true, description: "Teammate name" },
    team_name: { type: "string", optional: true, description: "Team name" },
    mode: { type: "string", optional: true, description: "Permission mode" },
  },

  async execute(
    input: TeammateInput,
    context?: TeammateContext
  ): Promise<{
    success: boolean
    teammate?: { name: string; team: string; mode: string }
    error?: string
  }> {
    const teamName = input.team_name ?? "default-team"
    const teammateName = input.name ?? `teammate-${Date.now()}`
    const mode = input.mode ?? "default"
    const teamDir = context?.teamDir ?? join(process.cwd(), ".sisyphus", "teams", teamName)

    const inboxesDir = join(teamDir, "inboxes")
    ensureDir(inboxesDir)

    const inboxPath = join(inboxesDir, `${teammateName}.json`)
    const emptyInbox: MailboxMessage[] = []
    writeJsonAtomic(inboxPath, emptyInbox)

    const configPath = join(teamDir, "config.json")
    const config = {
      name: teamName,
      teammates: [teammateName],
      createdAt: new Date().toISOString(),
    }
    writeJsonAtomic(configPath, config)

    if (!context?.dryRun) {
      // delegate_task integration goes here
    }

    return {
      success: true,
      teammate: { name: teammateName, team: teamName, mode },
    }
  },
}
