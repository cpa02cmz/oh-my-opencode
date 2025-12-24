import type { PluginInput } from "@opencode-ai/plugin"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { log } from "../../shared"
import {
  UNITY_ANTI_PATTERNS,
  FILE_PATTERNS,
  getLevelEmoji,
  getLevelLabel,
} from "./patterns"
import type {
  ToolExecuteInput,
  ToolExecuteOutput,
  CheckResult,
  PatternContext,
} from "./types"

export * from "./types"
export * from "./patterns"

/**
 * Detects if the current project is a Unity project
 */
function isUnityProject(projectRoot: string): boolean {
  const assetsPath = join(projectRoot, "Assets")
  const projectSettingsPath = join(projectRoot, "ProjectSettings")
  return existsSync(assetsPath) || existsSync(projectSettingsPath)
}

/**
 * Determines if a file is an Editor script
 */
function isEditorScript(filePath: string, content: string): boolean {
  // Check if in Editor folder
  if (/[/\\]Editor[/\\]/i.test(filePath)) {
    return true
  }
  
  // Check if wrapped in UNITY_EDITOR directive
  if (/#if\s+UNITY_EDITOR/.test(content)) {
    return true
  }
  
  return false
}

/**
 * Find line number for a match in content
 */
function findLineNumber(content: string, matchIndex: number): number {
  const lines = content.substring(0, matchIndex).split("\n")
  return lines.length
}

/**
 * Check content for anti-patterns
 */
function checkForAntiPatterns(
  content: string,
  filePath: string
): CheckResult[] {
  const results: CheckResult[] = []
  
  const context: PatternContext = {
    filePath,
    content,
    isEditorScript: isEditorScript(filePath, content),
  }

  for (const pattern of UNITY_ANTI_PATTERNS) {
    // Skip if condition exists and returns false
    if (pattern.condition && !pattern.condition(context)) {
      continue
    }

    // Use matchAll to find all occurrences
    const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags + "g")
    let match: RegExpExecArray | null
    
    while ((match = regex.exec(content)) !== null) {
      results.push({
        pattern,
        match: match[0],
        line: findLineNumber(content, match.index),
      })
    }
  }

  return results
}

/**
 * Format check results into a readable message
 */
function formatResults(results: CheckResult[]): string {
  if (results.length === 0) {
    return ""
  }

  const errorCount = results.filter((r) => r.pattern.level === "error").length
  const warnCount = results.filter((r) => r.pattern.level === "warn").length
  const infoCount = results.filter((r) => r.pattern.level === "info").length

  const lines: string[] = [
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "🎮 UNITY ANTI-PATTERN CHECKER",
    `   Found: ${errorCount} errors, ${warnCount} warnings, ${infoCount} suggestions`,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
  ]

  // Group by level
  const byLevel = {
    error: results.filter((r) => r.pattern.level === "error"),
    warn: results.filter((r) => r.pattern.level === "warn"),
    info: results.filter((r) => r.pattern.level === "info"),
  }

  for (const [level, items] of Object.entries(byLevel)) {
    if (items.length === 0) continue

    for (const result of items) {
      const emoji = getLevelEmoji(result.pattern.level)
      const label = getLevelLabel(result.pattern.level)
      lines.push(
        `${emoji} [${result.pattern.id}] ${label} (line ${result.line}):`
      )
      lines.push(`   ${result.pattern.message}`)
      lines.push("")
    }
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

  return lines.join("\n")
}

/**
 * Creates the Unity Anti-Pattern Checker Hook
 */
export function createUnityAntiPatternCheckerHook(ctx: PluginInput) {
  // Check if this is a Unity project
  const isUnity = isUnityProject(ctx.directory)
  
  if (!isUnity) {
    log("[unity-anti-pattern-checker] Not a Unity project, hook disabled")
    return {}
  }

  log("[unity-anti-pattern-checker] Unity project detected, hook enabled")

  const toolExecuteAfter = async (
    input: ToolExecuteInput,
    output: ToolExecuteOutput
  ): Promise<void> => {
    const toolName = input.tool.toLowerCase()

    // Only check write and edit operations
    if (toolName !== "write" && toolName !== "edit") {
      return
    }

    const filePath = output.title || (input.input?.filePath as string) || ""

    // Check for .meta file creation (blocked)
    if (FILE_PATTERNS.metaFile.test(filePath)) {
      log("[unity-anti-pattern-checker] Blocked .meta file operation", {
        filePath,
      })
      output.output =
        "❌ UNITY ERROR: Do not create .meta files manually.\n\n" +
        "Unity automatically generates .meta files for all assets. " +
        "Manual creation can cause:\n" +
        "• GUID conflicts\n" +
        "• Broken asset references\n" +
        "• Project corruption\n\n" +
        "If you need to modify asset import settings, use the Unity Editor Inspector."
      return
    }

    // Only check C# files
    if (!filePath.endsWith(".cs")) {
      return
    }

    // Get the content that was written/edited
    const content =
      (input.input?.content as string) ||
      (input.input?.newString as string) ||
      ""

    if (!content) {
      return
    }

    // Check for anti-patterns
    const results = checkForAntiPatterns(content, filePath)

    if (results.length > 0) {
      const formattedResults = formatResults(results)
      output.output += formattedResults
      
      log("[unity-anti-pattern-checker] Found issues", {
        filePath,
        errorCount: results.filter((r) => r.pattern.level === "error").length,
        warnCount: results.filter((r) => r.pattern.level === "warn").length,
        infoCount: results.filter((r) => r.pattern.level === "info").length,
      })
    }
  }

  return {
    "tool.execute.after": toolExecuteAfter,
  }
}
