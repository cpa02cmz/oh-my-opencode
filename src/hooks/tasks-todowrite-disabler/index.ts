import type { SisyphusConfig } from "../../config"
import { log } from "../../shared/logger"

export const HOOK_NAME = "tasks-todowrite-disabler"

interface HookConfig {
  sisyphusConfig?: SisyphusConfig
}

export function createTasksTodowriteDisablerHook(config: HookConfig) {
  const tasksEnabled = config.sisyphusConfig?.tasks?.enabled ?? false

  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      _output: { args: Record<string, unknown>; message?: string }
    ): Promise<void> => {
      if (!tasksEnabled) {
        return
      }

      if (input.tool === "todowrite") {
        log(`[${HOOK_NAME}] Blocked: TodoWrite disabled when Tasks enabled`, {
          sessionID: input.sessionID,
          callID: input.callID,
        })
        throw new Error(
          `[${HOOK_NAME}] TodoWrite is disabled when Sisyphus Tasks are enabled. ` +
          `Use TaskCreate/TaskUpdate instead for task management.`
        )
      }
    },
  }
}
