export function formatTeammate(result: {
  success: boolean
  teammate?: { name: string; team: string; mode: string }
}): string {
  if (result.success && result.teammate) {
    return `✓ Teammate "${result.teammate.name}" spawned\n  Team: ${result.teammate.team} | Mode: ${result.teammate.mode}`
  }
  return `✗ Failed to spawn teammate`
}

export function formatSendMessage(result: {
  success: boolean
  recipient?: string
  messageType?: string
  error?: string
}): string {
  if (result.success && result.recipient && result.messageType) {
    return `✓ Message sent to ${result.recipient}\n  Type: ${result.messageType}`
  }
  return `✗ Failed: ${result.error ?? "unknown error"}`
}
