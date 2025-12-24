import type { PluginInput } from "@opencode-ai/plugin"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { log } from "../../shared"
import {
  detectUnityProject,
  formatUnityContext,
  isUnityAssetPath,
  getProjectHash,
} from "./detector"
import type { ToolExecuteInput, ToolExecuteOutput, EventInput } from "./types"

export * from "./types"
export * from "./detector"

/**
 * Storage for injected session contexts
 * Maps sessionID -> projectHash (to detect project changes)
 */
const injectedSessions = new Map<string, string>()

/**
 * Creates the Unity Context Injector Hook
 * 
 * Automatically detects Unity projects and injects relevant context
 * (version, render pipeline, packages) when Unity files are accessed.
 */
export function createUnityContextInjectorHook(ctx: PluginInput) {
  // Early check if this could be a Unity project
  const assetsPath = join(ctx.directory, "Assets")
  const projectSettingsPath = join(ctx.directory, "ProjectSettings")
  
  if (!existsSync(assetsPath) && !existsSync(projectSettingsPath)) {
    log("[unity-context-injector] Not a Unity project, hook disabled")
    return {}
  }

  log("[unity-context-injector] Potential Unity project detected, hook enabled")

  const toolExecuteAfter = async (
    input: ToolExecuteInput,
    output: ToolExecuteOutput
  ): Promise<void> => {
    const toolName = input.tool.toLowerCase()

    // Only inject on read operations
    if (toolName !== "read") {
      return
    }

    const filePath = output.title || ""

    // Check if this is a Unity-related file
    if (!isUnityAssetPath(filePath)) {
      return
    }

    // Get current project hash
    const currentHash = getProjectHash(ctx.directory)
    const previousHash = injectedSessions.get(input.sessionID)

    // Skip if we already injected for this project state
    if (previousHash === currentHash) {
      return
    }

    // Detect Unity project info
    const projectInfo = detectUnityProject(ctx.directory)
    
    if (!projectInfo) {
      return
    }

    // Format and inject context
    const context = formatUnityContext(projectInfo)
    output.output += context

    // Mark as injected
    injectedSessions.set(input.sessionID, currentHash)

    log("[unity-context-injector] Context injected", {
      sessionID: input.sessionID,
      version: projectInfo.version,
      renderPipeline: projectInfo.renderPipeline,
      inputSystem: projectInfo.inputSystem,
    })
  }

  const eventHandler = async ({ event }: EventInput): Promise<void> => {
    const props = event.properties as Record<string, unknown> | undefined

    // Clear cache on session deletion
    if (event.type === "session.deleted") {
      const sessionInfo = props?.info as { id?: string } | undefined
      if (sessionInfo?.id) {
        injectedSessions.delete(sessionInfo.id)
        log("[unity-context-injector] Session cache cleared", {
          sessionID: sessionInfo.id,
        })
      }
    }

    // Clear cache on compaction (context needs re-injection)
    if (event.type === "session.compacted") {
      const sessionID =
        (props?.sessionID as string) ||
        (props?.info as { id?: string })?.id

      if (sessionID) {
        injectedSessions.delete(sessionID)
        log("[unity-context-injector] Session cache cleared on compaction", {
          sessionID,
        })
      }
    }
  }

  return {
    "tool.execute.after": toolExecuteAfter,
    event: eventHandler,
  }
}
