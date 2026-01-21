import { describe, expect, it, mock, beforeEach } from "bun:test"

// #given mock @clack/prompts module
const select = mock(() => Promise.resolve("no" as const))
const log = { step: mock(), warn: mock(), success: mock(), error: mock(), info: mock() }
const outro = mock()
const isCancel = mock(() => false)
const cancel = mock()

mock.module("@clack/prompts", () => ({ select, log, outro, isCancel, cancel }))

import { runTuiMode } from "./install"
import type { DetectedConfig } from "./types"

describe("runTuiMode", () => {
  const defaultDetected: DetectedConfig = {
    isInstalled: false,
    hasClaude: false,
    isMax20: false,
    hasOpenAI: false,
    hasGemini: false,
    hasCopilot: false,
    hasOpencodeZen: false,
    hasZaiCodingPlan: false,
  }

  beforeEach(() => {
    select.mockClear()
    isCancel.mockClear()
    isCancel.mockImplementation(() => false)
  })

  it("prompts use unified question format", async () => {
    // #given a sequence of "no" responses to complete the flow
    select.mockImplementation(() => Promise.resolve("no" as const))

    // #when running TUI mode
    await runTuiMode(defaultDetected)

    // #then all select calls should use "Do you have a [Provider] subscription?" format
    const calls = select.mock.calls
    expect(calls.length).toBeGreaterThan(0)

    for (const call of calls) {
      const args = call[0] as unknown as { message: string }
      expect(args.message).toMatch(/Do you have a .+ subscription\?/)
    }
  })

  it("options use generic hints", async () => {
    // #given a sequence of "no" responses to complete the flow
    select.mockImplementation(() => Promise.resolve("no" as const))

    // #when running TUI mode
    await runTuiMode(defaultDetected)

    // #then options passed to select should not contain specific model names
    const calls = select.mock.calls
    expect(calls.length).toBeGreaterThan(0)

    const specificModelNames = [
      "Opus 4.5",
      "Sonnet 4.5",
      "GPT-5.2",
      "Gemini 3",
      "glm-4.7",
    ]

    for (const call of calls) {
      const args = call[0] as unknown as { options: Array<{ hint?: string }> }
      for (const option of args.options) {
        if (option.hint) {
          for (const modelName of specificModelNames) {
            expect(option.hint).not.toContain(modelName)
          }
        }
      }
    }
  })
})
