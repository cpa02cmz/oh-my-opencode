import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { join } from "path"
import { ensureDir, writeJsonAtomic } from "../../features/sisyphus-tasks/storage"
import type { MailboxMessage } from "../../features/sisyphus-swarm/mailbox/types"

export const teammateTool: ToolDefinition = tool({
  description: "Spawn a new teammate agent",
  args: {
    name: tool.schema.string().optional().describe("Teammate name"),
    team_name: tool.schema.string().optional().describe("Team name"),
    mode: tool.schema.enum(["acceptEdits", "bypassPermissions", "default", "delegate", "dontAsk", "plan"]).optional().describe("Permission mode"),
    team_dir: tool.schema.string().optional().describe("Team directory (defaults to .sisyphus/teams/{team_name})"),
    dry_run: tool.schema.boolean().optional().describe("If true, skip delegate_task integration"),
  },
  execute: async (args) => {
    const teamName = args.team_name ?? "default-team"
    const teammateName = args.name ?? `teammate-${Date.now()}`
    const mode = args.mode ?? "default"
    const teamDir = args.team_dir ?? join(process.cwd(), ".sisyphus", "teams", teamName)

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

    if (!args.dry_run) {
      // delegate_task integration goes here
    }

    return JSON.stringify({
      success: true,
      teammate: { name: teammateName, team: teamName, mode },
    })
  },
})
