import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { UnityProjectInfo } from "./types"

/**
 * Detects Unity project information from project files
 */
export function detectUnityProject(
  projectRoot: string
): UnityProjectInfo | null {
  const projectVersionPath = join(
    projectRoot,
    "ProjectSettings",
    "ProjectVersion.txt"
  )

  // Check if this is a Unity project
  if (!existsSync(projectVersionPath)) {
    return null
  }

  let version = "Unknown"
  let renderPipeline: UnityProjectInfo["renderPipeline"] = "Built-in"
  let inputSystem: UnityProjectInfo["inputSystem"] = "Legacy"
  let packages: string[] = []
  let projectName: string | undefined

  // Read Unity version
  try {
    const versionContent = readFileSync(projectVersionPath, "utf8")
    const versionMatch = versionContent.match(/m_EditorVersion:\s*(.+)/)
    if (versionMatch) {
      version = versionMatch[1].trim()
    }
  } catch {
    // Ignore errors
  }

  // Read project name from ProjectSettings
  const projectSettingsPath = join(
    projectRoot,
    "ProjectSettings",
    "ProjectSettings.asset"
  )
  try {
    if (existsSync(projectSettingsPath)) {
      const settingsContent = readFileSync(projectSettingsPath, "utf8")
      const nameMatch = settingsContent.match(/productName:\s*(.+)/)
      if (nameMatch) {
        projectName = nameMatch[1].trim()
      }
    }
  } catch {
    // Ignore errors
  }

  // Read packages from manifest.json
  const manifestPath = join(projectRoot, "Packages", "manifest.json")
  try {
    if (existsSync(manifestPath)) {
      const manifestContent = readFileSync(manifestPath, "utf8")
      const manifest = JSON.parse(manifestContent)
      const deps = manifest.dependencies || {}
      packages = Object.keys(deps)

      // Detect render pipeline
      if (deps["com.unity.render-pipelines.universal"]) {
        renderPipeline = "URP"
      } else if (deps["com.unity.render-pipelines.high-definition"]) {
        renderPipeline = "HDRP"
      }

      // Detect input system
      const hasNewInput = !!deps["com.unity.inputsystem"]
      const hasLegacyEnabled = checkLegacyInputEnabled(projectRoot)
      
      if (hasNewInput && hasLegacyEnabled) {
        inputSystem = "Both"
      } else if (hasNewInput) {
        inputSystem = "New"
      } else {
        inputSystem = "Legacy"
      }
    }
  } catch {
    // Ignore errors
  }

  return {
    version,
    renderPipeline,
    inputSystem,
    packages,
    projectName,
  }
}

/**
 * Check if legacy input is enabled in ProjectSettings
 */
function checkLegacyInputEnabled(projectRoot: string): boolean {
  const projectSettingsPath = join(
    projectRoot,
    "ProjectSettings",
    "ProjectSettings.asset"
  )
  
  try {
    if (existsSync(projectSettingsPath)) {
      const content = readFileSync(projectSettingsPath, "utf8")
      // activeInputHandler: 0 = Old, 1 = New, 2 = Both
      const match = content.match(/activeInputHandler:\s*(\d)/)
      if (match) {
        const value = parseInt(match[1], 10)
        return value === 0 || value === 2
      }
    }
  } catch {
    // Ignore errors
  }
  
  return true // Default to legacy enabled
}

/**
 * Format project info as context string
 */
export function formatUnityContext(info: UnityProjectInfo): string {
  const packageList = info.packages.slice(0, 10).join(", ")
  const hasMore = info.packages.length > 10
  
  return `
[UNITY PROJECT CONTEXT - Auto-detected]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${info.projectName ? `Project: ${info.projectName}\n` : ""}Unity Version: ${info.version}
Render Pipeline: ${info.renderPipeline}
Input System: ${info.inputSystem}
Key Packages: ${packageList}${hasMore ? ` (+${info.packages.length - 10} more)` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AGENT ROUTING:
• Use @unity-engineer for C# scripting tasks
• Use @unity-spatial-engineer for physics, cameras, navigation, 3D math

REMINDERS:
• Cache GetComponent calls in Awake/Start
• Use [SerializeField] private for Inspector fields  
• Pair OnEnable/OnDisable for event subscriptions
• Never create .meta files manually
`
}

/**
 * Check if a file path is within a Unity project's Assets folder
 */
export function isUnityAssetPath(filePath: string): boolean {
  return (
    filePath.includes("/Assets/") ||
    filePath.includes("\\Assets\\") ||
    filePath.endsWith(".cs") ||
    filePath.endsWith(".unity") ||
    filePath.endsWith(".prefab") ||
    filePath.endsWith(".asset")
  )
}

/**
 * Generate a hash for project detection (for cache invalidation)
 */
export function getProjectHash(projectRoot: string): string {
  const projectVersionPath = join(
    projectRoot,
    "ProjectSettings",
    "ProjectVersion.txt"
  )
  const manifestPath = join(projectRoot, "Packages", "manifest.json")
  
  let hash = projectRoot
  
  try {
    if (existsSync(projectVersionPath)) {
      const content = readFileSync(projectVersionPath, "utf8")
      hash += content.substring(0, 100)
    }
    if (existsSync(manifestPath)) {
      const content = readFileSync(manifestPath, "utf8")
      hash += content.substring(0, 200)
    }
  } catch {
    // Ignore errors
  }
  
  // Simple hash function
  let hashValue = 0
  for (let i = 0; i < hash.length; i++) {
    const char = hash.charCodeAt(i)
    hashValue = ((hashValue << 5) - hashValue) + char
    hashValue = hashValue & hashValue // Convert to 32bit integer
  }
  
  return hashValue.toString(16)
}
