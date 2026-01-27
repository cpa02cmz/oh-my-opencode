const SESSION_NAME = "sisyphus-swarm"
const WINDOW_NAME = "swarm-view"

export function getSessionName(): string {
  return SESSION_NAME
}

export function createSwarmSession(): { success: boolean; sessionName: string } {
  if (runCommand(`tmux has-session -t ${SESSION_NAME} 2>/dev/null`)) {
    return { success: true, sessionName: SESSION_NAME }
  }

  if (runCommand(`tmux new-session -d -s ${SESSION_NAME} -n ${WINDOW_NAME}`)) {
    return { success: true, sessionName: SESSION_NAME }
  }

  return { success: false, sessionName: SESSION_NAME }
}

export interface PaneConfig {
  name: string
  command: string
  paneId?: string
}

export function createTeammatePane(
  name: string,
  options?: { splitFrom?: string; horizontal?: boolean; size?: number }
): PaneConfig {
  const splitDir = options?.horizontal ? "-h" : "-v"
  const sizeOpt = options?.size ? `-p ${options.size}` : "-p 30"
  const target = options?.splitFrom ? `-t ${options.splitFrom}` : ""

  const command = `tmux split-window ${splitDir} ${sizeOpt} ${target}`.trim()

  return {
    name,
    command,
  }
}

export function applyPaneStyle(paneName: string, color: string): string {
  const commands = [
    `tmux select-pane -T "${paneName}"`,
    `tmux set-option -p pane-border-style "fg=${color}"`,
    `tmux set-option -p pane-active-border-style "fg=${color}"`,
  ]
  return commands.join(" && ")
}

export function createTeammatePaneWithLeader(
  leaderId: string,
  teammate: string
): PaneConfig {
  return createTeammatePane(teammate, {
    splitFrom: leaderId,
    horizontal: true,
    size: 70,
  })
}

export function createTeammatePaneInSwarmView(teammate: string): PaneConfig {
  return createTeammatePane(teammate, { horizontal: false, size: 25 })
}

export function cleanupSwarmSession(): void {
  runCommand(`tmux kill-session -t ${SESSION_NAME}`)
}

export function executeCommand(cmd: string): boolean {
  return runCommand(cmd)
}

function runCommand(command: string): boolean {
  const result = Bun.spawnSync(["/bin/sh", "-lc", command], {
    stdout: "pipe",
    stderr: "pipe",
  })
  return result.exitCode === 0
}


