export interface UnityProjectInfo {
  /** Unity Editor version (e.g., "2022.3.15f1") */
  version: string
  /** Render pipeline in use */
  renderPipeline: "Built-in" | "URP" | "HDRP" | "Unknown"
  /** Input system type */
  inputSystem: "Legacy" | "New" | "Both" | "Unknown"
  /** List of installed packages */
  packages: string[]
  /** Project name from ProjectSettings */
  projectName?: string
}

export interface ToolExecuteInput {
  tool: string
  sessionID: string
  callID: string
}

export interface ToolExecuteOutput {
  title: string
  output: string
  metadata: unknown
}

export interface EventInput {
  event: {
    type: string
    properties?: unknown
  }
}
