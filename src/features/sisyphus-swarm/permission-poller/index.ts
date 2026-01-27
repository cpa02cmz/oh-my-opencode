import { randomUUID } from "crypto"
import { getUnreadMessages, markAsRead } from "../mailbox/mailbox"
import { PermissionResponseSchema } from "../mailbox/types"
import type { PermissionRequest, PermissionResponse } from "../mailbox/types"

interface PermissionCallback {
  onAllow: (updatedInput?: unknown, permissionUpdates?: unknown) => void
  onReject: (feedback?: string) => void
}

const callbackRegistry = new Map<string, PermissionCallback>()

export function createPermissionRequest(
  toolName: string,
  input: unknown,
  agentId: string
): PermissionRequest {
  return {
    type: "permission_request",
    requestId: randomUUID(),
    toolName,
    input,
    agentId,
    timestamp: Date.now()
  }
}

export function registerCallback(
  requestId: string,
  callback: PermissionCallback
): void {
  callbackRegistry.set(requestId, callback)
}

export function processResponse(response: PermissionResponse): boolean {
  const callback = callbackRegistry.get(response.requestId)
  if (!callback) return false

  callbackRegistry.delete(response.requestId)

  if (response.decision === "approved") {
    callback.onAllow(response.updatedInput, response.permissionUpdates)
  } else {
    callback.onReject(response.feedback)
  }

  return true
}

export function clearCallbacks(): void {
  callbackRegistry.clear()
}

export function startPolling(
  agentName: string,
  teamDir: string,
  interval = 500,
  onMessage?: (response: PermissionResponse) => void
): { stop: () => void } {
  let running = true

  const poll = async (): Promise<void> => {
    while (running) {
      const unread = getUnreadMessages(agentName, teamDir)

      for (const message of unread) {
        let parsed: unknown
        try {
          parsed = JSON.parse(message.text)
        } catch {
          continue
        }

        const result = PermissionResponseSchema.safeParse(parsed)
        if (!result.success) continue

        processResponse(result.data)
        onMessage?.(result.data)
      }

      if (unread.length > 0) {
        markAsRead(agentName, teamDir)
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, interval)
      })
    }
  }

  void poll()

  return {
    stop: () => {
      running = false
    }
  }
}

export function stopPolling(): void {
  // Cleanup handled by returned stop function
}
