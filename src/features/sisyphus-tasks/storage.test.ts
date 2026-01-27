import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { join } from "path"
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from "fs"
import { z } from "zod"
import {
  getTaskDir,
  getTaskPath,
  getTeamDir,
  getInboxPath,
  ensureDir,
  readJsonSafe,
  writeJsonAtomic,
  acquireLock,
} from "./storage"

const TEST_DIR = join(import.meta.dirname, ".test-storage")

describe("Storage Utilities", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe("getTaskDir", () => {
    //#given default config (no claude_code_compat)
    //#when getting task directory
    //#then it should return .sisyphus/tasks/{listId}
    it("returns sisyphus path by default", () => {
      const config = { sisyphus: { tasks: { storage_path: ".sisyphus/tasks" } } }
      const result = getTaskDir("list-123", config as any)
      expect(result).toContain(".sisyphus/tasks/list-123")
    })

    //#given claude_code_compat enabled
    //#when getting task directory
    //#then it should return Claude Code path
    it("returns claude code path when compat enabled", () => {
      const config = {
        sisyphus: {
          tasks: {
            storage_path: ".sisyphus/tasks",
            claude_code_compat: true,
          },
        },
      }
      const result = getTaskDir("list-123", config as any)
      expect(result).toContain(".cache/claude-code/tasks/list-123")
    })
  })

  describe("getTaskPath", () => {
    //#given list and task IDs
    //#when getting task path
    //#then it should return path to task JSON file
    it("returns path to task JSON", () => {
      const config = { sisyphus: { tasks: { storage_path: ".sisyphus/tasks" } } }
      const result = getTaskPath("list-123", "1", config as any)
      expect(result).toContain("list-123/1.json")
    })
  })

  describe("getTeamDir", () => {
    //#given team name and default config
    //#when getting team directory
    //#then it should return .sisyphus/teams/{teamName}
    it("returns sisyphus team path", () => {
      const config = { sisyphus: { swarm: { storage_path: ".sisyphus/teams" } } }
      const result = getTeamDir("my-team", config as any)
      expect(result).toContain(".sisyphus/teams/my-team")
    })
  })

  describe("getInboxPath", () => {
    //#given team and agent names
    //#when getting inbox path
    //#then it should return path to inbox JSON file
    it("returns path to inbox JSON", () => {
      const config = { sisyphus: { swarm: { storage_path: ".sisyphus/teams" } } }
      const result = getInboxPath("my-team", "agent-001", config as any)
      expect(result).toContain("my-team/inboxes/agent-001.json")
    })
  })

  describe("ensureDir", () => {
    //#given a non-existent directory path
    //#when calling ensureDir
    //#then it should create the directory
    it("creates directory if not exists", () => {
      const dirPath = join(TEST_DIR, "new-dir", "nested")
      ensureDir(dirPath)
      expect(existsSync(dirPath)).toBe(true)
    })

    //#given an existing directory
    //#when calling ensureDir
    //#then it should not throw
    it("does not throw for existing directory", () => {
      const dirPath = join(TEST_DIR, "existing")
      mkdirSync(dirPath, { recursive: true })
      expect(() => ensureDir(dirPath)).not.toThrow()
    })
  })

  describe("readJsonSafe", () => {
    //#given a valid JSON file matching schema
    //#when reading with readJsonSafe
    //#then it should return parsed object
    it("reads and parses valid JSON", () => {
      const testSchema = z.object({ name: z.string(), value: z.number() })
      const filePath = join(TEST_DIR, "test.json")
      writeFileSync(filePath, JSON.stringify({ name: "test", value: 42 }))

      const result = readJsonSafe(filePath, testSchema)
      expect(result).toEqual({ name: "test", value: 42 })
    })

    //#given a non-existent file
    //#when reading with readJsonSafe
    //#then it should return null
    it("returns null for non-existent file", () => {
      const testSchema = z.object({ name: z.string() })
      const result = readJsonSafe(join(TEST_DIR, "missing.json"), testSchema)
      expect(result).toBeNull()
    })

    //#given invalid JSON content
    //#when reading with readJsonSafe
    //#then it should return null
    it("returns null for invalid JSON", () => {
      const testSchema = z.object({ name: z.string() })
      const filePath = join(TEST_DIR, "invalid.json")
      writeFileSync(filePath, "not valid json")

      const result = readJsonSafe(filePath, testSchema)
      expect(result).toBeNull()
    })

    //#given JSON that doesn't match schema
    //#when reading with readJsonSafe
    //#then it should return null
    it("returns null for schema mismatch", () => {
      const testSchema = z.object({ name: z.string(), required: z.number() })
      const filePath = join(TEST_DIR, "mismatch.json")
      writeFileSync(filePath, JSON.stringify({ name: "test" }))

      const result = readJsonSafe(filePath, testSchema)
      expect(result).toBeNull()
    })
  })

   describe("writeJsonAtomic", () => {
     //#given data to write
     //#when calling writeJsonAtomic
     //#then it should write to file atomically
     it("writes JSON atomically", () => {
       const filePath = join(TEST_DIR, "atomic.json")
       const data = { key: "value", number: 123 }

       writeJsonAtomic(filePath, data)

       const content = readFileSync(filePath, "utf-8")
       expect(JSON.parse(content)).toEqual(data)
     })

     //#given a deeply nested path
     //#when calling writeJsonAtomic
     //#then it should create parent directories
     it("creates parent directories", () => {
       const filePath = join(TEST_DIR, "deep", "nested", "file.json")
       writeJsonAtomic(filePath, { test: true })

       expect(existsSync(filePath)).toBe(true)
     })
   })

   describe("acquireLock", () => {
     //#given a directory path with no existing lock
     //#when calling acquireLock
     //#then it should create .lock file and return acquired=true with release function
     it("acquires lock when no lock exists", () => {
       const dirPath = join(TEST_DIR, "lock-test-1")
       mkdirSync(dirPath, { recursive: true })

       const result = acquireLock(dirPath)

       expect(result.acquired).toBe(true)
       expect(typeof result.release).toBe("function")
       expect(existsSync(join(dirPath, ".lock"))).toBe(true)
     })

     //#given a directory with a fresh lock file
     //#when calling acquireLock
     //#then it should return acquired=false and not create new lock
     it("returns acquired=false when fresh lock exists", () => {
       const dirPath = join(TEST_DIR, "lock-test-2")
       mkdirSync(dirPath, { recursive: true })
       const lockPath = join(dirPath, ".lock")
       writeFileSync(lockPath, JSON.stringify({ timestamp: Date.now() }))

       const result = acquireLock(dirPath)

       expect(result.acquired).toBe(false)
     })

     //#given a lock file that is older than 30 seconds
     //#when calling acquireLock
     //#then it should override the stale lock and return acquired=true
     it("overrides stale lock (>30s old)", () => {
       const dirPath = join(TEST_DIR, "lock-test-3")
       mkdirSync(dirPath, { recursive: true })
       const lockPath = join(dirPath, ".lock")
       const staleTimestamp = Date.now() - 31000 // 31 seconds ago
       writeFileSync(lockPath, JSON.stringify({ timestamp: staleTimestamp }))

       const result = acquireLock(dirPath)

       expect(result.acquired).toBe(true)
       const lockContent = JSON.parse(readFileSync(lockPath, "utf-8"))
       expect(lockContent.timestamp).toBeGreaterThan(staleTimestamp)
     })

     //#given an acquired lock with release function
     //#when calling release()
     //#then it should remove the .lock file
     it("release() removes lock file", () => {
       const dirPath = join(TEST_DIR, "lock-test-4")
       mkdirSync(dirPath, { recursive: true })

       const { acquired, release } = acquireLock(dirPath)
       expect(acquired).toBe(true)
       expect(existsSync(join(dirPath, ".lock"))).toBe(true)

       release()

       expect(existsSync(join(dirPath, ".lock"))).toBe(false)
     })

     //#given a lock that is exactly 30 seconds old
     //#when calling acquireLock
     //#then it should still be considered fresh (not stale)
     it("considers 30s lock as fresh (boundary)", () => {
       const dirPath = join(TEST_DIR, "lock-test-5")
       mkdirSync(dirPath, { recursive: true })
       const lockPath = join(dirPath, ".lock")
       const boundaryTimestamp = Date.now() - 30000 // exactly 30 seconds ago
       writeFileSync(lockPath, JSON.stringify({ timestamp: boundaryTimestamp }))

       const result = acquireLock(dirPath)

       expect(result.acquired).toBe(false)
     })
   })
})
