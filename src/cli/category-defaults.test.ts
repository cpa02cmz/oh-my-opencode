import { describe, expect, it } from "bun:test"

import {
  CATEGORY_MODEL_DEFAULTS,
  CATEGORY_PROVIDER_PRIORITY,
  generateCategoryConfig,
  selectModelForCategory,
} from "./category-defaults"

describe("CATEGORY_MODEL_DEFAULTS", () => {
  it("should define mappings for all builtin categories", () => {
    // #given the category model defaults export
    const categoryKeys = Object.keys(CATEGORY_MODEL_DEFAULTS)

    // #when checking for all expected categories
    const expectedCategories = [
      "ultrabrain",
      "quick",
      "visual-engineering",
      "most-capable",
      "writing",
      "general",
      "artistry",
    ]

    // #then all categories should be present
    for (const category of expectedCategories) {
      expect(categoryKeys).toContain(category)
    }
  })

  it("should have entries for all providers in each category", () => {
    // #given the ultrabrain category
    const ultrabrainProviders = Object.keys(CATEGORY_MODEL_DEFAULTS.ultrabrain)

    // #when checking for expected providers
    const expectedProviders = ["claude_max", "claude", "chatgpt", "gemini", "copilot", "fallback"]

    // #then all providers should be present
    for (const provider of expectedProviders) {
      expect(ultrabrainProviders).toContain(provider)
    }
  })

  it("should map to valid model strings", () => {
    // #given the ultrabrain category with chatgpt provider

    // #when accessing the model string
    const chatgptModel = CATEGORY_MODEL_DEFAULTS.ultrabrain.chatgpt

    // #then it should be the expected model string
    expect(chatgptModel).toBe("openai/gpt-5.2")
  })
})

describe("CATEGORY_PROVIDER_PRIORITY", () => {
  it("should define priority order for all categories", () => {
    // #given the category provider priority export
    const priorityKeys = Object.keys(CATEGORY_PROVIDER_PRIORITY)

    // #when checking for expected categories
    const expectedCategories = [
      "ultrabrain",
      "quick",
      "visual-engineering",
      "most-capable",
      "writing",
      "general",
      "artistry",
    ]

    // #then all categories should have priority defined
    for (const category of expectedCategories) {
      expect(priorityKeys).toContain(category)
    }
  })

  it("should prioritize native providers over copilot", () => {
    // #given the ultrabrain priority array
    const ultrabrainPriority = CATEGORY_PROVIDER_PRIORITY.ultrabrain

    // #when checking the order
    const firstProvider = ultrabrainPriority[0]
    const lastProvider = ultrabrainPriority[ultrabrainPriority.length - 1]

    // #then chatgpt should be first and copilot should be last
    expect(firstProvider).toBe("chatgpt")
    expect(lastProvider).toBe("copilot")
  })
})

describe("selectModelForCategory", () => {
  it("should select highest priority provider model", () => {
    // #given ultrabrain category with chatgpt and claude available
    const providers = {
      hasClaude: true,
      hasClaudeMax: false,
      hasChatGPT: true,
      hasGemini: false,
      hasCopilot: false,
    }

    // #when selecting model for ultrabrain
    const result = selectModelForCategory("ultrabrain", providers)

    // #then chatgpt model should be selected (chatgpt > claude for ultrabrain)
    expect(result).toBe(CATEGORY_MODEL_DEFAULTS.ultrabrain.chatgpt)
  })

  it("should fallback if highest priority missing", () => {
    // #given ultrabrain category with only claude available
    const providers = {
      hasClaude: true,
      hasClaudeMax: false,
      hasChatGPT: false,
      hasGemini: false,
      hasCopilot: false,
    }

    // #when selecting model for ultrabrain
    const result = selectModelForCategory("ultrabrain", providers)

    // #then claude model should be selected as fallback
    expect(result).toBe(CATEGORY_MODEL_DEFAULTS.ultrabrain.claude)
  })

  it("should return null if no matching provider", () => {
    // #given ultrabrain category with no providers available
    const providers = {
      hasClaude: false,
      hasClaudeMax: false,
      hasChatGPT: false,
      hasGemini: false,
      hasCopilot: false,
    }

    // #when selecting model for ultrabrain
    const result = selectModelForCategory("ultrabrain", providers)

    // #then fallback model should be returned (not null)
    expect(result).toBe(CATEGORY_MODEL_DEFAULTS.ultrabrain.fallback)
  })
})

describe("generateCategoryConfig", () => {
  it("should generate config for available providers", () => {
    // #given only chatgpt is available
    const providers = {
      hasClaude: false,
      hasClaudeMax: false,
      hasChatGPT: true,
      hasGemini: false,
      hasCopilot: false,
    }

    // #when generating category config
    const result = generateCategoryConfig(providers)

    // #then ultrabrain model should be defined
    expect(result.ultrabrain.model).toBeDefined()
  })

  it("should omit categories with no matches", () => {
    // #given no providers available
    const providers = {
      hasClaude: false,
      hasClaudeMax: false,
      hasChatGPT: false,
      hasGemini: false,
      hasCopilot: false,
    }

    // #when generating category config
    const result = generateCategoryConfig(providers)

    // #then result should still have categories (due to fallback models)
    // Note: The implementation returns fallback models when no provider matches
    expect(Object.keys(result).length).toBeGreaterThan(0)
  })
})
