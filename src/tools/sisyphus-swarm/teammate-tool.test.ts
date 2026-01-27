import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, rmSync } from "fs"
import { join } from "path"
import { teammateTool } from "./teammate-tool"

const TEST_DIR = join(import.meta.dirname, ".test-teammate")
const mockContext = {} as Parameters<typeof teammateTool.execute>[1]

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
    const teamDir = join(TEST_DIR, "teams", "test-team")
    const result = await teammateTool.execute(
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
    const teamDir = join(TEST_DIR, "teams", "test-team")
    const result = await teammateTool.execute(
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
})
