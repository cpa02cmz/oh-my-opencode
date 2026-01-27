import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { join } from "path"
import { sendMessage } from "../../features/sisyphus-swarm/mailbox/mailbox"
import type { ProtocolMessage } from "../../features/sisyphus-swarm/mailbox/types"
import { formatSendMessage } from "../../features/sisyphus-swarm/formatters"

export const sendMessageTool: ToolDefinition = tool({
  description: "Send a message to another agent via mailbox IPC",
  args: {
    recipient: tool.schema.string().describe("Recipient agent name"),
    message_type: tool.schema.string().describe("Message type (e.g., idle_notification, task_assignment, permission_response)"),
    payload: tool.schema.string().describe("JSON payload for the message"),
    team_dir: tool.schema.string().optional().describe("Team directory (defaults to .sisyphus/teams/default-team)"),
  },
  execute: async (args) => {
    try {
      const teamDir = args.team_dir ?? join(process.cwd(), ".sisyphus", "teams", "default-team")
      const payloadObj = JSON.parse(args.payload)

      const message: ProtocolMessage = {
        type: args.message_type as ProtocolMessage["type"],
        ...payloadObj,
      }

      sendMessage(args.recipient, message, "system", teamDir)

      return formatSendMessage({
        success: true,
        recipient: args.recipient,
        messageType: args.message_type,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      return formatSendMessage({
        success: false,
        error: errorMessage,
      })
    }
  },
})
