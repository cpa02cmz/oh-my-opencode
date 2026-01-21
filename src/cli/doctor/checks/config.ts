import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { CheckResult, CheckDefinition, ConfigInfo } from "../types"
import { CHECK_IDS, CHECK_NAMES, PACKAGE_NAME } from "../constants"
import { parseJsonc, detectConfigFile } from "../../../shared"
import { OhMyOpenCodeConfigSchema } from "../../../config"
import {
  validateConfig as validateConfigSemantics,
  ConfigValidationError,
} from "../../../config/validator"

const USER_CONFIG_DIR = join(homedir(), ".config", "opencode")
const USER_CONFIG_BASE = join(USER_CONFIG_DIR, `${PACKAGE_NAME}`)
const PROJECT_CONFIG_BASE = join(process.cwd(), ".opencode", PACKAGE_NAME)

function findConfigPath(): { path: string; format: "json" | "jsonc" } | null {
  const projectDetected = detectConfigFile(PROJECT_CONFIG_BASE)
  if (projectDetected.format !== "none") {
    return { path: projectDetected.path, format: projectDetected.format as "json" | "jsonc" }
  }

  const userDetected = detectConfigFile(USER_CONFIG_BASE)
  if (userDetected.format !== "none") {
    return { path: userDetected.path, format: userDetected.format as "json" | "jsonc" }
  }

  return null
}

export function validateConfig(configPath: string): { valid: boolean; errors: string[] } {
  try {
    const content = readFileSync(configPath, "utf-8")
    const rawConfig = parseJsonc<Record<string, unknown>>(content)
    const schemaResult = OhMyOpenCodeConfigSchema.safeParse(rawConfig)

    // Guard: Zod schema validation failed
    if (!schemaResult.success) {
      const errors = schemaResult.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`
      )
      return { valid: false, errors }
    }

    // Run semantic validation (deprecated fields, invalid categories, etc.)
    try {
      validateConfigSemantics(schemaResult.data)
    } catch (err) {
      // Guard: semantic validation failed
      if (err instanceof ConfigValidationError) {
        const errors = err.errors.map((e) => `${e.path}: ${e.message}`)
        return { valid: false, errors }
      }
      throw err
    }

    return { valid: true, errors: [] }
  } catch (err) {
    return {
      valid: false,
      errors: [err instanceof Error ? err.message : "Failed to parse config"],
    }
  }
}

export function getConfigInfo(): ConfigInfo {
  const configPath = findConfigPath()

  if (!configPath) {
    return {
      exists: false,
      path: null,
      format: null,
      valid: true,
      errors: [],
    }
  }

  if (!existsSync(configPath.path)) {
    return {
      exists: false,
      path: configPath.path,
      format: configPath.format,
      valid: true,
      errors: [],
    }
  }

  const validation = validateConfig(configPath.path)

  return {
    exists: true,
    path: configPath.path,
    format: configPath.format,
    valid: validation.valid,
    errors: validation.errors,
  }
}

export async function checkConfigValidity(): Promise<CheckResult> {
  const info = getConfigInfo()

  if (!info.exists) {
    return {
      name: CHECK_NAMES[CHECK_IDS.CONFIG_VALIDATION],
      status: "pass",
      message: "Using default configuration",
      details: ["No custom config file found (optional)"],
    }
  }

  if (!info.valid) {
    return {
      name: CHECK_NAMES[CHECK_IDS.CONFIG_VALIDATION],
      status: "fail",
      message: "Configuration has validation errors",
      details: [
        `Path: ${info.path}`,
        ...info.errors.map((e) => `Error: ${e}`),
      ],
    }
  }

  return {
    name: CHECK_NAMES[CHECK_IDS.CONFIG_VALIDATION],
    status: "pass",
    message: `Valid ${info.format?.toUpperCase()} config`,
    details: [`Path: ${info.path}`],
  }
}

export function getConfigCheckDefinition(): CheckDefinition {
  return {
    id: CHECK_IDS.CONFIG_VALIDATION,
    name: CHECK_NAMES[CHECK_IDS.CONFIG_VALIDATION],
    category: "configuration",
    check: checkConfigValidity,
    critical: false,
  }
}
