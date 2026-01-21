import { describe, expect, it } from "bun:test"

import { formatConfigSummary } from "./install"
import type { InstallConfig } from "./types"

describe("formatConfigSummary", () => {
  it("shows auto-configured models", () => {
    // #given a config with Claude, ChatGPT, and Gemini enabled
    const config: InstallConfig = {
      hasClaude: true,
      isMax20: true,
      hasOpenAI: true,
      hasGemini: true,
      hasCopilot: false,
      hasOpencodeZen: false,
      hasZaiCodingPlan: false,
    }

    // #when formatting the config summary
    const result = formatConfigSummary(config)

    // #then it should show auto-configured models for each category
    expect(result).toContain("ultrabrain → openai/gpt-5.2")
    expect(result).toContain("quick → anthropic/claude-haiku-4-5")
    expect(result).toContain("visual-engineering → google/gemini-3-pro-preview")
  })

  it("warns about unconfigured categories", () => {
    // #given a config with only Gemini enabled (no Claude or ChatGPT)
    const config: InstallConfig = {
      hasClaude: false,
      isMax20: false,
      hasOpenAI: false,
      hasGemini: true,
      hasCopilot: false,
      hasOpencodeZen: false,
      hasZaiCodingPlan: false,
    }

    // #when formatting the config summary
    const result = formatConfigSummary(config)

    // #then it should show visual-engineering is configured
    expect(result).toContain("visual-engineering → google/gemini-3-pro-preview")

    // #then it should warn about unconfigured categories
    expect(result).toContain("The following categories will use your OpenCode default model:")
    expect(result).toContain("ultrabrain")
    expect(result).toContain("quick")
  })

  it("includes opencode models tip", () => {
    // #given any config
    const config: InstallConfig = {
      hasClaude: true,
      isMax20: false,
      hasOpenAI: false,
      hasGemini: false,
      hasCopilot: false,
      hasOpencodeZen: false,
      hasZaiCodingPlan: false,
    }

    // #when formatting the config summary
    const result = formatConfigSummary(config)

    // #then it should include the opencode models tip
    expect(result).toContain("Run opencode models to see all available models")
  })
})
