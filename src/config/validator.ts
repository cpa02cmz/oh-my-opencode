import type { OhMyOpenCodeConfig } from "./schema"
import { BuiltinCategoryNameSchema } from "./schema"
import { suggestCategoryName } from "../shared/suggest-category"

/**
 * Branded type for validated category names
 */
export type ValidatedCategory = string & { readonly __brand: "ValidatedCategory" }

/**
 * Validated configuration type - currently same as OhMyOpenCodeConfig
 * but guarantees validation has passed
 */
export type ValidatedConfig = OhMyOpenCodeConfig

interface ValidationError {
  path: string
  message: string
  suggestion?: string
}

/**
 * Error thrown when config validation fails
 * Contains all accumulated errors for comprehensive feedback
 */
export class ConfigValidationError extends Error {
  readonly errors: ValidationError[]

  constructor(errors: ValidationError[]) {
    const messages = errors.map((e) => `${e.path}: ${e.message}`).join("\n")
    super(`Config validation failed:\n${messages}`)
    this.name = "ConfigValidationError"
    this.errors = errors
  }
}

/**
 * Validates model format: must be 'provider/model-name'
 * Returns true if valid, false if invalid
 */
function isValidModelFormat(model: string): boolean {
  // Guard: empty string
  if (!model) {
    return false
  }

  const parts = model.split("/")

  // Must have exactly 2 parts (provider/name)
  if (parts.length !== 2) {
    return false
  }

  // Both parts must be non-empty
  const [provider, name] = parts
  return provider.length > 0 && name.length > 0
}

/**
 * Validates temperature range: must be 0-2 inclusive
 */
function isValidTemperature(temperature: number): boolean {
  return temperature >= 0 && temperature <= 2
}

/**
 * Validates OhMyOpenCodeConfig and returns a branded ValidatedConfig
 *
 * @throws ConfigValidationError if validation fails (aggregates all errors)
 */
export function validateConfig(config: OhMyOpenCodeConfig): ValidatedConfig {
  const errors: ValidationError[] = []

  // Validate categories: model format and temperature range
  if (config.categories) {
    for (const [categoryName, categoryConfig] of Object.entries(config.categories)) {
      // Guard: skip undefined category configs
      if (!categoryConfig) {
        continue
      }

      // Check model format
      if (categoryConfig.model !== undefined && !isValidModelFormat(categoryConfig.model)) {
        errors.push({
          path: `categories.${categoryName}.model`,
          message: `Invalid model format '${categoryConfig.model}'. Expected 'provider/model-name' (e.g., 'anthropic/claude-opus-4-5')`,
        })
      }

      // Check temperature range
      if (categoryConfig.temperature !== undefined && !isValidTemperature(categoryConfig.temperature)) {
        errors.push({
          path: `categories.${categoryName}.temperature`,
          message: `Temperature ${categoryConfig.temperature} out of range. Must be between 0 and 2.`,
        })
      }
    }
  }

  // Guard: no agents to validate further
  if (!config.agents) {
    // Fail fast if category errors exist
    if (errors.length > 0) {
      throw new ConfigValidationError(errors)
    }
    return config as ValidatedConfig
  }

  // Build valid categories set: builtin + user-defined
  const builtinCategories = BuiltinCategoryNameSchema.options as readonly string[]
  const userCategories = Object.keys(config.categories || {})
  const validCategories = new Set([...builtinCategories, ...userCategories])

  // Validate each agent
  for (const [agentName, agentConfig] of Object.entries(config.agents)) {
    // Guard: skip undefined agent configs
    if (!agentConfig) {
      continue
    }

    // Check for deprecated 'model' field
    if (agentConfig.model !== undefined) {
      errors.push({
        path: `agents.${agentName}.model`,
        message:
          "The 'model' field is deprecated. Use 'category' to inherit model from CategoryConfig instead.",
        suggestion: `Define a category in 'categories' with the desired model, then set 'category' on this agent.`,
      })
    }

    // Check for invalid category
    if (agentConfig.category !== undefined) {
      if (!validCategories.has(agentConfig.category)) {
        const validCategoryArray = Array.from(validCategories).sort()
        const suggestion = suggestCategoryName(agentConfig.category, validCategoryArray)
        const availableCategories = validCategoryArray.join(", ")

        // Build error message: base + optional suggestion + available categories
        let message = `Invalid category '${agentConfig.category}'.`
        if (suggestion) {
          message += ` Did you mean '${suggestion}'?`
        }
        message += ` Available categories: ${availableCategories}`

        errors.push({
          path: `agents.${agentName}.category`,
          message,
          suggestion,
        })
      }
    }

    // Check agent temperature range
    if (agentConfig.temperature !== undefined && !isValidTemperature(agentConfig.temperature)) {
      errors.push({
        path: `agents.${agentName}.temperature`,
        message: `Temperature ${agentConfig.temperature} out of range. Must be between 0 and 2.`,
      })
    }
  }

  // Fail fast: throw if any errors accumulated
  if (errors.length > 0) {
    throw new ConfigValidationError(errors)
  }

  return config as ValidatedConfig
}
