import { randomUUID } from "crypto"
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

  void agentName
  void teamDir
  void onMessage

  const poll = async (): Promise<void> => {
    while (running) {
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
