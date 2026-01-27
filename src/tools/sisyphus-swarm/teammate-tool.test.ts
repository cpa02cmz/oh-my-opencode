import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync } from "fs"
import { join } from "path"
import { createTeammateTool } from "./teammate-tool"
import type { SwarmManager } from "../../features/sisyphus-swarm/swarm-manager"

const TEST_DIR = join(import.meta.dirname, ".test-teammate")

describe("TeammateTool", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

  //#given valid teammate config
  //#when spawning
  //#then create inbox and add to team
  it("spawns teammate and creates inbox", async () => {
    const tool = createTeammateTool(null)
    const mockContext = {} as Parameters<typeof tool.execute>[1]
    const teamDir = join(TEST_DIR, "teams", "test-team")
    const result = await tool.execute(
      {
        name: "worker-1",
        team_name: "test-team",
        mode: "default",
        team_dir: teamDir,
        dry_run: true,
      },
      mockContext
    )

    expect(result).toContain("✓")
    expect(result).toContain("worker-1")
    expect(result).toContain("spawned")
  })

  //#given default params
  //#when spawning
  //#then generate name automatically
  it("generates name if not provided", async () => {
    const tool = createTeammateTool(null)
    const mockContext = {} as Parameters<typeof tool.execute>[1]
    const teamDir = join(TEST_DIR, "teams", "test-team")
    const result = await tool.execute(
      {
        team_name: "test-team",
        team_dir: teamDir,
        dry_run: true,
      },
      mockContext
    )

    expect(result).toContain("✓")
    expect(result).toContain("spawned")
  })

  //#given swarm not enabled (null manager)
  //#when spawning without dry_run
  //#then return error
  it("returns error when swarmManager is null and dry_run is false", async () => {
    const tool = createTeammateTool(null)
    const mockContext = {} as Parameters<typeof tool.execute>[1]
    const teamDir = join(TEST_DIR, "teams", "test-team")
    const result = await tool.execute(
      {
        name: "worker-1",
        team_name: "test-team",
        team_dir: teamDir,
        dry_run: false,
      },
      mockContext
    )

    expect(result).toContain("✗")
    expect(result).toContain("Failed")
  })

  //#given swarm enabled with mock manager
  //#when spawning without dry_run
  //#then call spawnTeammate
  it("calls spawnTeammate when swarmManager exists and dry_run is false", async () => {
    const teamDir = join(TEST_DIR, "teams", "test-team")
    const spawnCalls: { name: string; prompt: string; options: unknown }[] = []
    const mockManager = {
      spawnTeammate: async (name: string, prompt: string, options?: unknown) => {
        spawnCalls.push({ name, prompt, options })
        return { name, taskId: "mock-task", status: "running" as const, teamName: "test-team", teamDir: teamDir }
      },
    } as unknown as SwarmManager

    const tool = createTeammateTool(mockManager)
    const mockContext = {} as Parameters<typeof tool.execute>[1]
    const result = await tool.execute(
      {
        name: "worker-1",
        team_name: "test-team",
        mode: "default",
        team_dir: teamDir,
        dry_run: false,
      },
      mockContext
    )

    expect(spawnCalls).toHaveLength(1)
    expect(spawnCalls[0]?.name).toBe("worker-1")
    expect(spawnCalls[0]?.prompt).toContain("worker-1")
    expect(spawnCalls[0]?.prompt).toContain("test-team")
    expect(spawnCalls[0]?.options).toEqual({ teamName: "test-team", mode: "default" })
    expect(result).toContain("✓")
    expect(result).toContain("worker-1")
  })
})
