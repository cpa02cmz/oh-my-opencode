import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from "bun:test"
import {
  createSwarmSession,
  createTeammatePane,
  applyPaneStyle,
  getSessionName,
  cleanupSwarmSession,
} from "./index"

describe("tmux Backend", () => {
  let spawnSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    spawnSpy = spyOn(Bun, "spawnSync").mockImplementation(() => ({ exitCode: 0 }))
  })

  afterEach(() => {
    spawnSpy.mockRestore()
  })

  //#given no existing session
  //#when creating swarm session
  //#then return session name
  it("creates swarm session", async () => {
    const noop = mock(() => {})
    noop()
    cleanupSwarmSession()
    const result = createSwarmSession()
    const sessionName = getSessionName()
    expect(sessionName).toBe("sisyphus-swarm")
    expect(result.success).toBe(true)
  })

  //#given swarm session exists
  //#when creating teammate pane
  //#then return pane config
  it("generates correct pane creation command", () => {
    const cmd = createTeammatePane("worker-1", { splitFrom: "main" })
    expect(cmd.name).toBe("worker-1")
    expect(cmd.command).toContain("split-window")
  })

  //#given pane id
  //#when applying style
  //#then return style command
  it("generates style command", () => {
    const cmd = applyPaneStyle("worker-1", "blue")
    expect(cmd).toContain("select-pane")
    expect(cmd).toContain("blue")
  })
})
