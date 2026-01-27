import type { PluginInput } from "@opencode-ai/plugin"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { log } from "../../shared/logger"
import { SYSTEM_DIRECTIVE_PREFIX } from "../../shared/system-directive"
import { readState, writeState, clearState, incrementIteration } from "./storage"
import {
  HOOK_NAME,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_COMPLETION_PROMISE,
} from "./constants"
import type { RalphLoopState, RalphLoopOptions } from "./types"
import { getTranscriptPath as getDefaultTranscriptPath } from "../claude-code-hooks/transcript"
import { findNearestMessageWithFields, MESSAGE_STORAGE } from "../../features/hook-message-injector"

function getMessageDir(sessionID: string): string | null {
  if (!existsSync(MESSAGE_STORAGE)) return null
  const directPath = join(MESSAGE_STORAGE, sessionID)
  if (existsSync(directPath)) return directPath
  for (const dir of readdirSync(MESSAGE_STORAGE)) {
    const sessionPath = join(MESSAGE_STORAGE, dir, sessionID)
    if (existsSync(sessionPath)) return sessionPath
  }
  return null
}

export * from "./types"
export * from "./constants"
export { readState, writeState, clearState, incrementIteration } from "./storage"

interface SessionState {
  isRecovering?: boolean
  isHandlingIdle?: boolean
  lastInjectionTime?: number
}

interface OpenCodeSessionMessage {
  info?: {
    role?: string
  }
  parts?: Array<{
    type: string
    text?: string
    [key: string]: unknown
  }>
}

const CONTINUATION_PROMPT = `${SYSTEM_DIRECTIVE_PREFIX} - RALPH LOOP {{ITERATION}}/{{MAX}}]

Your previous attempt did not output the completion promise. Continue working on the task.

IMPORTANT:
- Review your progress so far
- Continue from where you left off  
- When FULLY complete, output: <promise>{{PROMISE}}</promise>
- Do not stop until the task is truly done

Original task:
{{PROMPT}}`

export interface RalphLoopHook {
  event: (input: { event: { type: string; properties?: unknown } }) => Promise<void>
  startLoop: (
    sessionID: string,
    prompt: string,
    options?: { maxIterations?: number; completionPromise?: string; ultrawork?: boolean }
  ) => boolean
  cancelLoop: (sessionID: string) => boolean
  getState: () => RalphLoopState | null
}

const DEFAULT_API_TIMEOUT = 5000
const MIN_INTERVAL_BETWEEN_INJECTIONS_MS = 2000

export function createRalphLoopHook(
  ctx: PluginInput,
  options?: RalphLoopOptions
): RalphLoopHook {
  const sessions = new Map<string, SessionState>()
  const config = options?.config
  const stateDir = config?.state_dir
  const getTranscriptPath = options?.getTranscriptPath ?? getDefaultTranscriptPath
  const apiTimeout = options?.apiTimeout ?? DEFAULT_API_TIMEOUT
  const checkSessionExists = options?.checkSessionExists

  function getSessionState(sessionID: string): SessionState {
    let state = sessions.get(sessionID)
    if (!state) {
      state = {}
      sessions.set(sessionID, state)
    }
    return state
  }

  function detectCompletionPromise(
    transcriptPath: string | undefined,
    promise: string
  ): boolean {
    if (!transcriptPath) return false

    try {
      if (!existsSync(transcriptPath)) return false

      const content = readFileSync(transcriptPath, "utf-8")
      const pattern = new RegExp(`<promise>\\s*${escapeRegex(promise)}\\s*</promise>`, "is")
      const lines = content.split("\n").filter(l => l.trim())

      for (const line of lines) {
        try {
          const entry = JSON.parse(line)
          if (entry.type === "user") continue
          if (pattern.test(line)) return true
        } catch {
          continue
        }
      }
      return false
    } catch {
      return false
    }
  }

  function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }

  async function detectCompletionInSessionMessages(
    sessionID: string,
    promise: string
  ): Promise<boolean> {
    try {
      const response = await Promise.race([
        ctx.client.session.messages({
          path: { id: sessionID },
          query: { directory: ctx.directory },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("API timeout")), apiTimeout)
        ),
      ])

      const rawMessages = (response as { data?: unknown[]; "200"?: unknown[] }).data
        ?? (response as { "200"?: unknown[] })["200"]
        ?? (Array.isArray(response) ? response : [])
      if (!Array.isArray(rawMessages)) return false

      const assistantMessages = (rawMessages as OpenCodeSessionMessage[]).filter(
        (msg) => msg.info?.role === "assistant"
      )

      if (assistantMessages.length === 0) return false

      const pattern = new RegExp(`<promise>\\s*${escapeRegex(promise)}\\s*</promise>`, "is")
      const lastN = assistantMessages.slice(-3)

      for (const msg of lastN) {
        if (!msg.parts) continue
        const responseText = msg.parts
          .filter((p) => p.type === "text" || p.type === "reasoning")
          .map((p) => p.text ?? "")
          .join("\n")
        if (pattern.test(responseText)) return true
      }

      return false
    } catch (err) {
      log(`[${HOOK_NAME}] Session messages check failed`, { sessionID, error: String(err) })
      return false
    }
  }

  async function sessionHasAssistantOutput(sessionID: string): Promise<boolean> {
    try {
      const response = await Promise.race([
        ctx.client.session.messages({
          path: { id: sessionID },
          query: { directory: ctx.directory },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("API timeout")), apiTimeout)
        ),
      ])

      const rawMessages = (response as { data?: unknown[]; "200"?: unknown[] }).data
        ?? (response as { "200"?: unknown[] })["200"]
        ?? (Array.isArray(response) ? response : [])
      if (!Array.isArray(rawMessages)) return false

      return (rawMessages as OpenCodeSessionMessage[]).some(
        (msg) => msg.info?.role === "assistant" && msg.parts && msg.parts.length > 0
      )
    } catch {
      return true
    }
  }

  const startLoop = (
    sessionID: string,
    prompt: string,
    loopOptions?: { maxIterations?: number; completionPromise?: string; ultrawork?: boolean }
  ): boolean => {
    const state: RalphLoopState = {
      active: true,
      iteration: 1,
      max_iterations:
        loopOptions?.maxIterations ?? config?.default_max_iterations ?? DEFAULT_MAX_ITERATIONS,
      completion_promise: loopOptions?.completionPromise ?? DEFAULT_COMPLETION_PROMISE,
      ultrawork: loopOptions?.ultrawork,
      started_at: new Date().toISOString(),
      prompt,
      session_id: sessionID,
    }

    const success = writeState(ctx.directory, state, stateDir)
    if (success) {
      log(`[${HOOK_NAME}] Loop started`, {
        sessionID,
        maxIterations: state.max_iterations,
        completionPromise: state.completion_promise,
      })
    }
    return success
  }

  const cancelLoop = (sessionID: string): boolean => {
    const state = readState(ctx.directory, stateDir)
    if (!state || state.session_id !== sessionID) {
      return false
    }

    const success = clearState(ctx.directory, stateDir)
    if (success) {
      log(`[${HOOK_NAME}] Loop cancelled`, { sessionID, iteration: state.iteration })
    }
    return success
  }

  const getState = (): RalphLoopState | null => {
    return readState(ctx.directory, stateDir)
  }

  const event = async ({
    event,
  }: {
    event: { type: string; properties?: unknown }
  }): Promise<void> => {
    const props = event.properties as Record<string, unknown> | undefined

    if (event.type === "session.idle") {
      const sessionID = props?.sessionID as string | undefined
      if (!sessionID) return

      const sessionState = getSessionState(sessionID)

      if (sessionState.isHandlingIdle) {
        log(`[${HOOK_NAME}] Skipped: already handling idle`, { sessionID })
        return
      }

      if (sessionState.isRecovering) {
        log(`[${HOOK_NAME}] Skipped: in recovery`, { sessionID })
        return
      }

      const now = Date.now()
      if (sessionState.lastInjectionTime && (now - sessionState.lastInjectionTime) < MIN_INTERVAL_BETWEEN_INJECTIONS_MS) {
        log(`[${HOOK_NAME}] Skipped: too soon since last injection`, {
          sessionID,
          elapsedMs: now - sessionState.lastInjectionTime,
        })
        return
      }

      sessionState.isHandlingIdle = true

      try {
        const state = readState(ctx.directory, stateDir)
        if (!state || !state.active) {
          return
        }

        if (state.session_id && state.session_id !== sessionID) {
          if (checkSessionExists) {
            try {
              const originalSessionExists = await checkSessionExists(state.session_id)
              if (!originalSessionExists) {
                clearState(ctx.directory, stateDir)
                log(`[${HOOK_NAME}] Cleared orphaned state from deleted session`, {
                  orphanedSessionId: state.session_id,
                  currentSessionId: sessionID,
                })
                return
              }
            } catch (err) {
              log(`[${HOOK_NAME}] Failed to check session existence`, {
                sessionId: state.session_id,
                error: String(err),
              })
            }
          }
          return
        }

        const hasOutput = await sessionHasAssistantOutput(sessionID)
        if (!hasOutput) {
          log(`[${HOOK_NAME}] Skipped: no assistant output yet`, { sessionID })
          return
        }

        const transcriptPath = getTranscriptPath(sessionID)
        const completionDetectedViaTranscript = detectCompletionPromise(transcriptPath, state.completion_promise)

        const completionDetectedViaApi = completionDetectedViaTranscript
          ? false
          : await detectCompletionInSessionMessages(sessionID, state.completion_promise)

        if (completionDetectedViaTranscript || completionDetectedViaApi) {
          log(`[${HOOK_NAME}] Completion detected!`, {
            sessionID,
            iteration: state.iteration,
            promise: state.completion_promise,
            detectedVia: completionDetectedViaTranscript ? "transcript_file" : "session_messages_api",
          })
          clearState(ctx.directory, stateDir)

          const title = state.ultrawork
            ? "ULTRAWORK LOOP COMPLETE!"
            : "Ralph Loop Complete!"
          const message = state.ultrawork
            ? `JUST ULW ULW! Task completed after ${state.iteration} iteration(s)`
            : `Task completed after ${state.iteration} iteration(s)`

          await ctx.client.tui
            .showToast({
              body: {
                title,
                message,
                variant: "success",
                duration: 5000,
              },
            })
            .catch(() => {})

          return
        }

        if (state.iteration >= state.max_iterations) {
          log(`[${HOOK_NAME}] Max iterations reached`, {
            sessionID,
            iteration: state.iteration,
            max: state.max_iterations,
          })
          clearState(ctx.directory, stateDir)

          await ctx.client.tui
            .showToast({
              body: {
                title: "Ralph Loop Stopped",
                message: `Max iterations (${state.max_iterations}) reached without completion`,
                variant: "warning",
                duration: 5000,
              },
            })
            .catch(() => {})

          return
        }

        const nextIteration = state.iteration + 1
        log(`[${HOOK_NAME}] Continuing loop`, {
          sessionID,
          iteration: nextIteration,
          max: state.max_iterations,
        })

        const continuationPrompt = CONTINUATION_PROMPT.replace("{{ITERATION}}", String(nextIteration))
          .replace("{{MAX}}", String(state.max_iterations))
          .replace("{{PROMISE}}", state.completion_promise)
          .replace("{{PROMPT}}", state.prompt)

        const finalPrompt = state.ultrawork
          ? `ultrawork ${continuationPrompt}`
          : continuationPrompt

        await ctx.client.tui
          .showToast({
            body: {
              title: "Ralph Loop",
              message: `Iteration ${nextIteration}/${state.max_iterations}`,
              variant: "info",
              duration: 2000,
            },
          })
          .catch(() => {})

        let agent: string | undefined
        let model: { providerID: string; modelID: string } | undefined

        try {
          const messagesResp = await ctx.client.session.messages({ path: { id: sessionID } })
          const rawMessages = (messagesResp as { data?: unknown[]; "200"?: unknown[] }).data
            ?? (messagesResp as { "200"?: unknown[] })["200"]
            ?? (Array.isArray(messagesResp) ? messagesResp : [])
          const messages = rawMessages as Array<{
            info?: { agent?: string; model?: { providerID: string; modelID: string }; modelID?: string; providerID?: string }
          }>
          for (let i = messages.length - 1; i >= 0; i--) {
            const info = messages[i].info
            if (info?.agent || info?.model || (info?.modelID && info?.providerID)) {
              agent = info.agent
              model = info.model ?? (info.providerID && info.modelID ? { providerID: info.providerID, modelID: info.modelID } : undefined)
              break
            }
          }
        } catch {
          const messageDir = getMessageDir(sessionID)
          const currentMessage = messageDir ? findNearestMessageWithFields(messageDir) : null
          agent = currentMessage?.agent
          model = currentMessage?.model?.providerID && currentMessage?.model?.modelID
            ? { providerID: currentMessage.model.providerID, modelID: currentMessage.model.modelID }
            : undefined
        }

        await ctx.client.session.prompt({
          path: { id: sessionID },
          body: {
            ...(agent !== undefined ? { agent } : {}),
            ...(model !== undefined ? { model } : {}),
            parts: [{ type: "text", text: finalPrompt }],
          },
          query: { directory: ctx.directory },
        })

        incrementIteration(ctx.directory, stateDir)
        sessionState.lastInjectionTime = Date.now()
      } catch (err) {
        log(`[${HOOK_NAME}] Failed to inject continuation`, {
          sessionID,
          error: String(err),
        })
      } finally {
        sessionState.isHandlingIdle = false
      }
    }

    if (event.type === "session.deleted") {
      const sessionInfo = props?.info as { id?: string } | undefined
      if (sessionInfo?.id) {
        const state = readState(ctx.directory, stateDir)
        if (state?.session_id === sessionInfo.id) {
          clearState(ctx.directory, stateDir)
          log(`[${HOOK_NAME}] Session deleted, loop cleared`, { sessionID: sessionInfo.id })
        }
        sessions.delete(sessionInfo.id)
      }
    }

    if (event.type === "session.error") {
      const sessionID = props?.sessionID as string | undefined
      const error = props?.error as { name?: string } | undefined

      if (error?.name === "MessageAbortedError") {
        if (sessionID) {
          const state = readState(ctx.directory, stateDir)
          if (state?.session_id === sessionID) {
            clearState(ctx.directory, stateDir)
            log(`[${HOOK_NAME}] User aborted, loop cleared`, { sessionID })
          }
          sessions.delete(sessionID)
        }
        return
      }

      if (sessionID) {
        const sessionState = getSessionState(sessionID)
        sessionState.isRecovering = true
        setTimeout(() => {
          sessionState.isRecovering = false
        }, 5000)
      }
    }
  }

  return {
    event,
    startLoop,
    cancelLoop,
    getState,
  }
}
