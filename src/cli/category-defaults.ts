/**
 * Maps each category to the recommended model for each provider.
 * Based on documented recommendations from docs/category-skill-guide.md
 */
export const CATEGORY_MODEL_DEFAULTS: Record<string, Record<string, string>> = {
  ultrabrain: {
    claude_max: "anthropic/claude-opus-4-5",
    claude: "anthropic/claude-opus-4-5",
    chatgpt: "openai/gpt-5.2",
    gemini: "google/gemini-3-pro-preview",
    copilot: "github-copilot/gpt-5.2",
    fallback: "opencode/gpt-5.2",
  },
  quick: {
    claude_max: "anthropic/claude-haiku-4-5",
    claude: "anthropic/claude-haiku-4-5",
    chatgpt: "openai/gpt-5.2-mini",
    gemini: "google/gemini-3-flash-preview",
    copilot: "github-copilot/claude-haiku-4-5",
    fallback: "opencode/claude-haiku-4-5",
  },
  "visual-engineering": {
    claude_max: "google/gemini-3-pro-preview",
    claude: "google/gemini-3-pro-preview",
    chatgpt: "google/gemini-3-pro-preview",
    gemini: "google/gemini-3-pro-preview",
    copilot: "github-copilot/gemini-3-pro-preview",
    fallback: "opencode/gemini-3-pro-preview",
  },
  "most-capable": {
    claude_max: "anthropic/claude-opus-4-5",
    claude: "anthropic/claude-opus-4-5",
    chatgpt: "openai/gpt-5.2",
    gemini: "google/gemini-3-pro-preview",
    copilot: "github-copilot/claude-opus-4-5",
    fallback: "opencode/claude-opus-4-5",
  },
  writing: {
    claude_max: "google/gemini-3-flash-preview",
    claude: "google/gemini-3-flash-preview",
    chatgpt: "google/gemini-3-flash-preview",
    gemini: "google/gemini-3-flash-preview",
    copilot: "github-copilot/gemini-3-flash-preview",
    fallback: "opencode/gemini-3-flash-preview",
  },
  general: {
    claude_max: "anthropic/claude-sonnet-4-5",
    claude: "anthropic/claude-sonnet-4-5",
    chatgpt: "openai/gpt-5.2",
    gemini: "google/gemini-3-flash-preview",
    copilot: "github-copilot/claude-sonnet-4-5",
    fallback: "opencode/claude-sonnet-4-5",
  },
  artistry: {
    claude_max: "google/gemini-3-pro-preview",
    claude: "google/gemini-3-pro-preview",
    chatgpt: "google/gemini-3-pro-preview",
    gemini: "google/gemini-3-pro-preview",
    copilot: "github-copilot/gemini-3-pro-preview",
    fallback: "opencode/gemini-3-pro-preview",
  },
}

/**
 * Priority order for each category when user has multiple providers.
 * Native providers first, Copilot as fallback.
 */
export const CATEGORY_PROVIDER_PRIORITY: Record<string, string[]> = {
  ultrabrain: ["chatgpt", "claude_max", "claude", "gemini", "copilot"],
  quick: ["claude", "claude_max", "gemini", "chatgpt", "copilot"],
  "visual-engineering": ["gemini", "claude_max", "claude", "chatgpt", "copilot"],
  "most-capable": ["claude_max", "claude", "chatgpt", "gemini", "copilot"],
  writing: ["gemini", "claude_max", "claude", "chatgpt", "copilot"],
  general: ["claude", "claude_max", "chatgpt", "gemini", "copilot"],
  artistry: ["gemini", "claude_max", "claude", "chatgpt", "copilot"],
}

/**
 * All category names for iteration
 */
export const ALL_CATEGORIES: string[] = Object.keys(CATEGORY_MODEL_DEFAULTS)

export interface UserProviders {
  hasClaude: boolean
  hasClaudeMax: boolean
  hasChatGPT: boolean
  hasGemini: boolean
  hasCopilot: boolean
}

/**
 * Select the best model for a category based on user's providers.
 * Returns undefined if no provider matches.
 */
export function selectModelForCategory(category: string, providers: UserProviders): string | undefined {
  const categoryDefaults = CATEGORY_MODEL_DEFAULTS[category]
  if (!categoryDefaults) {
    return undefined
  }

  const priority = CATEGORY_PROVIDER_PRIORITY[category]
  if (!priority) {
    return categoryDefaults.fallback
  }

  const providerMap: Record<string, boolean> = {
    claude_max: providers.hasClaudeMax,
    claude: providers.hasClaude,
    chatgpt: providers.hasChatGPT,
    gemini: providers.hasGemini,
    copilot: providers.hasCopilot,
  }

  for (const provider of priority) {
    if (providerMap[provider]) {
      return categoryDefaults[provider]
    }
  }

  return categoryDefaults.fallback
}

/**
 * Generate category configurations based on user's providers.
 * Only includes categories that have a matching provider.
 */
export function generateCategoryConfig(providers: UserProviders): Record<string, { model: string }> {
  const config: Record<string, { model: string }> = {}

  for (const category of ALL_CATEGORIES) {
    const model = selectModelForCategory(category, providers)
    if (model) {
      config[category] = { model }
    }
  }

  return config
}
