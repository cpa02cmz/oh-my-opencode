export type AntiPatternLevel = "error" | "warn" | "info"

export interface AntiPattern {
  /** Unique identifier for the pattern */
  id: string
  /** Regular expression to match the anti-pattern */
  pattern: RegExp
  /** Severity level */
  level: AntiPatternLevel
  /** Human-readable message explaining the issue */
  message: string
  /** Optional condition function for context-aware checking */
  condition?: (context: PatternContext) => boolean
}

export interface PatternContext {
  /** Full file path */
  filePath: string
  /** Full file content */
  content: string
  /** Whether this is an Editor script (in Editor folder or has UNITY_EDITOR) */
  isEditorScript: boolean
}

export interface CheckResult {
  /** The anti-pattern that was matched */
  pattern: AntiPattern
  /** The matched text */
  match: string
  /** Line number (1-based) */
  line: number
}

export interface ToolExecuteInput {
  tool: string
  sessionID: string
  callID: string
  input?: Record<string, unknown>
}

export interface ToolExecuteOutput {
  title: string
  output: string
  metadata: unknown
}
