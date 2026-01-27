import { existsSync } from "fs"
import { join } from "path"
import { z } from "zod"
import {
  ensureDir,
  readJsonSafe,
  writeJsonAtomic
} from "../../sisyphus-tasks/storage"
import {
  MailboxMessageSchema,
  type MailboxMessage,
  type ProtocolMessage
} from "./types"

const MailboxArraySchema = z.array(MailboxMessageSchema)

export function getInboxPath(agentName: string, teamDir: string): string {
  return join(teamDir, "inboxes", `${agentName}.json`)
}

export function readMessages(agentName: string, teamDir: string): MailboxMessage[] {
  const inboxPath = getInboxPath(agentName, teamDir)
  if (!existsSync(inboxPath)) return []
  return readJsonSafe(inboxPath, MailboxArraySchema) ?? []
}

export function getUnreadMessages(
  agentName: string,
  teamDir: string
): MailboxMessage[] {
  return readMessages(agentName, teamDir).filter(message => !message.read)
}

export function sendMessage(
  recipient: string,
  message: ProtocolMessage,
  sender: string,
  teamDir: string,
  color?: string
): void {
  const inboxPath = getInboxPath(recipient, teamDir)
  ensureDir(join(teamDir, "inboxes"))

  const messages = readMessages(recipient, teamDir)
  const newMessage: MailboxMessage = {
    from: sender,
    text: JSON.stringify(message),
    timestamp: new Date().toISOString(),
    color,
    read: false
  }
  messages.push(newMessage)
  writeJsonAtomic(inboxPath, messages)
}

export function markAsRead(
  agentName: string,
  teamDir: string,
  index?: number
): void {
  const inboxPath = getInboxPath(agentName, teamDir)
  const messages = readMessages(agentName, teamDir)

  if (index !== undefined) {
    if (messages[index]) messages[index].read = true
  } else {
    messages.forEach(message => {
      message.read = true
    })
  }

  writeJsonAtomic(inboxPath, messages)
}

export function clearInbox(agentName: string, teamDir: string): void {
  const inboxPath = getInboxPath(agentName, teamDir)
  writeJsonAtomic(inboxPath, [])
}
