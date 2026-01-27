import { join, dirname } from "path"
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "fs"
import { homedir } from "os"
import type { z } from "zod"
import type { OhMyOpenCodeConfig } from "../../config/schema"

export function getTaskDir(listId: string, config: Partial<OhMyOpenCodeConfig>): string {
  const tasksConfig = config.sisyphus?.tasks

  if (tasksConfig?.claude_code_compat) {
    return join(homedir(), ".cache", "claude-code", "tasks", listId)
  }

  const storagePath = tasksConfig?.storage_path ?? ".sisyphus/tasks"
  return join(process.cwd(), storagePath, listId)
}

export function getTaskPath(listId: string, taskId: string, config: Partial<OhMyOpenCodeConfig>): string {
  return join(getTaskDir(listId, config), `${taskId}.json`)
}

export function getTeamDir(teamName: string, config: Partial<OhMyOpenCodeConfig>): string {
  const swarmConfig = config.sisyphus?.swarm

  if (swarmConfig?.storage_path?.includes("claude")) {
    return join(homedir(), ".claude", "teams", teamName)
  }

  const storagePath = swarmConfig?.storage_path ?? ".sisyphus/teams"
  return join(process.cwd(), storagePath, teamName)
}

export function getInboxPath(teamName: string, agentName: string, config: Partial<OhMyOpenCodeConfig>): string {
  return join(getTeamDir(teamName, config), "inboxes", `${agentName}.json`)
}

export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true })
  }
}

export function readJsonSafe<T>(filePath: string, schema: z.ZodType<T>): T | null {
  try {
    if (!existsSync(filePath)) {
      return null
    }

    const content = readFileSync(filePath, "utf-8")
    const parsed = JSON.parse(content)
    const result = schema.safeParse(parsed)

    if (!result.success) {
      return null
    }

    return result.data
  } catch {
    return null
  }
}

export function writeJsonAtomic(filePath: string, data: unknown): void {
  const dir = dirname(filePath)
  ensureDir(dir)

  const tempPath = `${filePath}.tmp.${Date.now()}`

  try {
    writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8")
    renameSync(tempPath, filePath)
  } catch (error) {
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath)
      }
    } catch {
      // Ignore cleanup errors
    }
    throw error
  }
}

const STALE_LOCK_THRESHOLD_MS = 30000

export function acquireLock(dirPath: string): { acquired: boolean; release: () => void } {
  const lockPath = join(dirPath, ".lock")
  const now = Date.now()

  if (existsSync(lockPath)) {
    try {
      const lockContent = readFileSync(lockPath, "utf-8")
      const lockData = JSON.parse(lockContent)
      const lockAge = now - lockData.timestamp

      if (lockAge <= STALE_LOCK_THRESHOLD_MS) {
        return {
          acquired: false,
          release: () => {
            // No-op release for failed acquisition
          },
        }
      }
    } catch {
      // If lock file is corrupted, treat as stale and override
    }
  }

  ensureDir(dirPath)
  writeFileSync(lockPath, JSON.stringify({ timestamp: now }), "utf-8")

  return {
    acquired: true,
    release: () => {
      try {
        if (existsSync(lockPath)) {
          unlinkSync(lockPath)
        }
      } catch {
        // Ignore cleanup errors
      }
    },
  }
}
