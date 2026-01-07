import { spawn, type Subprocess } from "bun"
import { readFileSync } from "fs"
import { extname, resolve } from "path"
import { getLanguageId } from "./config"
import type { Diagnostic, ResolvedServer } from "./types"
import { LSPServerUnavailableError, LSPServerExitedError, isSpawnError } from "./errors"

/**
 * Server availability status for tracking failed servers
 */
type ServerStatus = "available" | "unavailable"

interface ServerState {
  status: ServerStatus
  failedAt?: number
  error?: string
  retryCount: number
}

interface ManagedClient {
  client: LSPClient
  lastUsedAt: number
  refCount: number
  initPromise?: Promise<void>
  isInitializing: boolean
}

class LSPServerManager {
  private static instance: LSPServerManager
  private clients = new Map<string, ManagedClient>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null
  private readonly IDLE_TIMEOUT = 5 * 60 * 1000

  /**
   * Track server availability to avoid repeatedly trying to spawn failed servers
   */
  private serverStates = new Map<string, ServerState>()
  private readonly FAILURE_COOLDOWN = 5 * 60 * 1000 // 5 minutes before retry
  private readonly MAX_RETRIES = 3

  private constructor() {
    this.startCleanupTimer()
    this.registerProcessCleanup()
  }

  private registerProcessCleanup(): void {
    const cleanup = () => {
      for (const [, managed] of this.clients) {
        try {
          managed.client.stop()
        } catch {}
      }
      this.clients.clear()
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval)
        this.cleanupInterval = null
      }
    }

    // Works on all platforms
    process.on("exit", cleanup)

    // Ctrl+C - works on all platforms
    process.on("SIGINT", () => {
      cleanup()
      process.exit(0)
    })

    // Kill signal - Unix/macOS
    process.on("SIGTERM", () => {
      cleanup()
      process.exit(0)
    })

    // Ctrl+Break - Windows specific
    if (process.platform === "win32") {
      process.on("SIGBREAK", () => {
        cleanup()
        process.exit(0)
      })
    }
  }

  static getInstance(): LSPServerManager {
    if (!LSPServerManager.instance) {
      LSPServerManager.instance = new LSPServerManager()
    }
    return LSPServerManager.instance
  }

  private getKey(root: string, serverId: string): string {
    return `${root}::${serverId}`
  }

  private startCleanupTimer(): void {
    if (this.cleanupInterval) return
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleClients()
    }, 60000)
  }

  private cleanupIdleClients(): void {
    const now = Date.now()
    for (const [key, managed] of this.clients) {
      if (managed.refCount === 0 && now - managed.lastUsedAt > this.IDLE_TIMEOUT) {
        managed.client.stop()
        this.clients.delete(key)
      }
    }
  }

  /**
   * Check if a server is currently unavailable (failed recently)
   */
  private isServerUnavailable(key: string): boolean {
    const state = this.serverStates.get(key)
    if (!state) return false
    if (state.status !== "unavailable") return false

    // Check if cooldown has passed
    if (state.failedAt && Date.now() - state.failedAt > this.FAILURE_COOLDOWN) {
      // Cooldown passed, allow retry if under max retries
      if (state.retryCount < this.MAX_RETRIES) {
        return false
      }
    }

    return true
  }

  /**
   * Mark a server as unavailable after a failure
   */
  private markServerUnavailable(key: string, error: string): void {
    const existing = this.serverStates.get(key)
    this.serverStates.set(key, {
      status: "unavailable",
      failedAt: Date.now(),
      error,
      retryCount: (existing?.retryCount ?? 0) + 1,
    })
  }

  /**
   * Mark a server as available after successful start
   */
  private markServerAvailable(key: string): void {
    this.serverStates.set(key, {
      status: "available",
      retryCount: 0,
    })
  }

  /**
   * Get server state info (for diagnostics)
   */
  getServerState(root: string, serverId: string): ServerState | undefined {
    return this.serverStates.get(this.getKey(root, serverId))
  }

  async getClient(root: string, server: ResolvedServer): Promise<LSPClient> {
    const key = this.getKey(root, server.id)

    // Check if server is known to be unavailable
    if (this.isServerUnavailable(key)) {
      const state = this.serverStates.get(key)!
      throw new LSPServerUnavailableError(
        server.id,
        server.command,
        new Error(state.error || "Server previously failed to start")
      )
    }

    let managed = this.clients.get(key)
    if (managed) {
      if (managed.initPromise) {
        try {
          await managed.initPromise
        } catch (error) {
          // Concurrent init failed - remove stale entry and mark unavailable
          this.clients.delete(key)
          if (error instanceof LSPServerUnavailableError || error instanceof LSPServerExitedError) {
            this.markServerUnavailable(key, error.message)
          }
          throw error
        }
      }
      if (managed.client.isAlive()) {
        managed.refCount++
        managed.lastUsedAt = Date.now()
        return managed.client
      }
      await managed.client.stop()
      this.clients.delete(key)
    }

    const client = new LSPClient(root, server)
    const initPromise = (async () => {
      await client.start()
      await client.initialize()
    })()

    this.clients.set(key, {
      client,
      lastUsedAt: Date.now(),
      refCount: 1,
      initPromise,
      isInitializing: true,
    })

    try {
      await initPromise
      this.markServerAvailable(key)
    } catch (error) {
      // Handle initialization failure
      this.clients.delete(key)

      if (error instanceof LSPServerUnavailableError || error instanceof LSPServerExitedError) {
        this.markServerUnavailable(key, error.message)
        throw error
      }

      // Wrap unexpected errors
      const wrappedError = new LSPServerUnavailableError(
        server.id,
        server.command,
        error instanceof Error ? error : new Error(String(error))
      )
      this.markServerUnavailable(key, wrappedError.message)
      throw wrappedError
    }

    const m = this.clients.get(key)
    if (m) {
      m.initPromise = undefined
      m.isInitializing = false
    }

    return client
  }

  warmupClient(root: string, server: ResolvedServer): void {
    const key = this.getKey(root, server.id)

    // Skip if server is known to be unavailable
    if (this.isServerUnavailable(key)) {
      return
    }

    if (this.clients.has(key)) return

    const client = new LSPClient(root, server)
    const initPromise = (async () => {
      await client.start()
      await client.initialize()
    })()

    this.clients.set(key, {
      client,
      lastUsedAt: Date.now(),
      refCount: 0,
      initPromise,
      isInitializing: true,
    })

    initPromise
      .then(() => {
        const m = this.clients.get(key)
        if (m) {
          m.initPromise = undefined
          m.isInitializing = false
        }
        this.markServerAvailable(key)
      })
      .catch((error) => {
        // Warmup failed - mark as unavailable but don't throw
        this.clients.delete(key)
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.markServerUnavailable(key, errorMessage)
        // Log warning but don't crash - warmup is best-effort
        console.warn(`[lsp] Warmup failed for ${server.id}: ${errorMessage}`)
      })
  }

  releaseClient(root: string, serverId: string): void {
    const key = this.getKey(root, serverId)
    const managed = this.clients.get(key)
    if (managed && managed.refCount > 0) {
      managed.refCount--
      managed.lastUsedAt = Date.now()
    }
  }

  isServerInitializing(root: string, serverId: string): boolean {
    const key = this.getKey(root, serverId)
    const managed = this.clients.get(key)
    return managed?.isInitializing ?? false
  }

  async stopAll(): Promise<void> {
    for (const [, managed] of this.clients) {
      await managed.client.stop()
    }
    this.clients.clear()
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Reset a server's failure state (e.g., after user installs the missing binary)
   */
  resetServerState(root: string, serverId: string): void {
    const key = this.getKey(root, serverId)
    this.serverStates.delete(key)
  }

  /**
   * Get list of unavailable servers (for diagnostics)
   */
  getUnavailableServers(): Array<{ key: string; state: ServerState }> {
    const result: Array<{ key: string; state: ServerState }> = []
    for (const [key, state] of this.serverStates) {
      if (state.status === "unavailable") {
        result.push({ key, state })
      }
    }
    return result
  }
}

export const lspManager = LSPServerManager.getInstance()

export class LSPClient {
  private proc: Subprocess<"pipe", "pipe", "pipe"> | null = null
  private buffer: Uint8Array = new Uint8Array(0)
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  private requestIdCounter = 0
  private openedFiles = new Set<string>()
  private stderrBuffer: string[] = []
  private processExited = false
  private diagnosticsStore = new Map<string, Diagnostic[]>()
  private stdinWritable = true

  constructor(
    private root: string,
    private server: ResolvedServer
  ) {}

  async start(): Promise<void> {
    try {
      this.proc = spawn(this.server.command, {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        cwd: this.root,
        env: {
          ...process.env,
          ...this.server.env,
        },
      })
    } catch (error) {
      // Catch spawn errors (ENOENT, EACCES, etc.) and wrap them
      if (isSpawnError(error)) {
        throw new LSPServerUnavailableError(this.server.id, this.server.command, error)
      }
      throw error
    }

    if (!this.proc) {
      throw new LSPServerUnavailableError(
        this.server.id,
        this.server.command,
        new Error("spawn returned null")
      )
    }

    // Note: Bun's FileSink doesn't support .on() events like Node streams
    // We handle stdin errors in safeWrite() via try-catch instead

    // Track process exit
    this.proc.exited
      .then((code) => {
        this.processExited = true
        this.stdinWritable = false
        this.rejectAllPending(`LSP server exited with code ${code}`)
      })
      .catch((err) => {
        this.processExited = true
        this.stdinWritable = false
        this.rejectAllPending(`LSP server process error: ${err}`)
      })

    this.startReading()
    this.startStderrReading()

    await new Promise((resolve) => setTimeout(resolve, 100))

    if (this.proc.exitCode !== null) {
      const stderr = this.stderrBuffer.join("\n")
      throw new LSPServerExitedError(this.server.id, this.proc.exitCode, stderr)
    }
  }

  private startReading(): void {
    if (!this.proc) return

    const reader = this.proc.stdout.getReader()
    const read = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            this.processExited = true
            this.stdinWritable = false
            this.rejectAllPending("LSP server stdout closed")
            break
          }
          const newBuf = new Uint8Array(this.buffer.length + value.length)
          newBuf.set(this.buffer)
          newBuf.set(value, this.buffer.length)
          this.buffer = newBuf
          this.processBuffer()
        }
      } catch (err) {
        this.processExited = true
        this.stdinWritable = false
        this.rejectAllPending(`LSP stdout read error: ${err}`)
      }
    }
    read()
  }

  private startStderrReading(): void {
    if (!this.proc) return

    const reader = this.proc.stderr.getReader()
    const read = async () => {
      const decoder = new TextDecoder()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value)
          this.stderrBuffer.push(text)
          if (this.stderrBuffer.length > 100) {
            this.stderrBuffer.shift()
          }
        }
      } catch {
      }
    }
    read()
  }

  private rejectAllPending(reason: string): void {
    for (const [id, handler] of this.pending) {
      handler.reject(new Error(reason))
      this.pending.delete(id)
    }
  }

  private findSequence(haystack: Uint8Array, needle: number[]): number {
    outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) {
        if (haystack[i + j] !== needle[j]) continue outer
      }
      return i
    }
    return -1
  }

  private processBuffer(): void {
    const decoder = new TextDecoder()
    const CONTENT_LENGTH = [67, 111, 110, 116, 101, 110, 116, 45, 76, 101, 110, 103, 116, 104, 58]
    const CRLF_CRLF = [13, 10, 13, 10]
    const LF_LF = [10, 10]

    while (true) {
      const headerStart = this.findSequence(this.buffer, CONTENT_LENGTH)
      if (headerStart === -1) break
      if (headerStart > 0) this.buffer = this.buffer.slice(headerStart)

      let headerEnd = this.findSequence(this.buffer, CRLF_CRLF)
      let sepLen = 4
      if (headerEnd === -1) {
        headerEnd = this.findSequence(this.buffer, LF_LF)
        sepLen = 2
      }
      if (headerEnd === -1) break

      const header = decoder.decode(this.buffer.slice(0, headerEnd))
      const match = header.match(/Content-Length:\s*(\d+)/i)
      if (!match) break

      const len = parseInt(match[1], 10)
      const start = headerEnd + sepLen
      const end = start + len
      if (this.buffer.length < end) break

      const content = decoder.decode(this.buffer.slice(start, end))
      this.buffer = this.buffer.slice(end)

      try {
        const msg = JSON.parse(content)

        if ("method" in msg && !("id" in msg)) {
          if (msg.method === "textDocument/publishDiagnostics" && msg.params?.uri) {
            this.diagnosticsStore.set(msg.params.uri, msg.params.diagnostics ?? [])
          }
        } else if ("id" in msg && "method" in msg) {
          this.handleServerRequest(msg.id, msg.method, msg.params)
        } else if ("id" in msg && this.pending.has(msg.id)) {
          const handler = this.pending.get(msg.id)!
          this.pending.delete(msg.id)
          if ("error" in msg) {
            handler.reject(new Error(msg.error.message))
          } else {
            handler.resolve(msg.result)
          }
        }
      } catch {
      }
    }
  }

  /**
   * Safely write to stdin with guards against destroyed streams
   */
  private safeWrite(data: string): boolean {
    if (!this.proc || !this.stdinWritable || this.processExited || this.proc.exitCode !== null) {
      return false
    }

    try {
      this.proc.stdin.write(data)
      return true
    } catch (error) {
      // Stream likely destroyed - mark as unwritable
      this.stdinWritable = false
      return false
    }
  }

  private send(method: string, params?: unknown): Promise<unknown> {
    if (!this.proc) throw new Error("LSP client not started")

    if (this.processExited || this.proc.exitCode !== null || !this.stdinWritable) {
      const stderr = this.stderrBuffer.slice(-10).join("\n")
      throw new Error(`LSP server already exited (code: ${this.proc.exitCode})` + (stderr ? `\nstderr: ${stderr}` : ""))
    }

    const id = ++this.requestIdCounter
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params })
    const header = `Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n`
    
    if (!this.safeWrite(header + msg)) {
      throw new Error("LSP server stdin is no longer writable")
    }

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          const stderr = this.stderrBuffer.slice(-5).join("\n")
          reject(new Error(`LSP request timeout (method: ${method})` + (stderr ? `\nrecent stderr: ${stderr}` : "")))
        }
      }, 15000)
    })
  }

  private notify(method: string, params?: unknown): void {
    if (!this.proc) return
    if (this.processExited || this.proc.exitCode !== null || !this.stdinWritable) return

    const msg = JSON.stringify({ jsonrpc: "2.0", method, params })
    this.safeWrite(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`)
  }

  private respond(id: number | string, result: unknown): void {
    if (!this.proc) return
    if (this.processExited || this.proc.exitCode !== null || !this.stdinWritable) return

    const msg = JSON.stringify({ jsonrpc: "2.0", id, result })
    this.safeWrite(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`)
  }

  private handleServerRequest(id: number | string, method: string, params?: unknown): void {
    if (method === "workspace/configuration") {
      const items = (params as { items?: Array<{ section?: string }> })?.items ?? []
      const result = items.map((item) => {
        if (item.section === "json") return { validate: { enable: true } }
        return {}
      })
      this.respond(id, result)
    } else if (method === "client/registerCapability") {
      this.respond(id, null)
    } else if (method === "window/workDoneProgress/create") {
      this.respond(id, null)
    }
  }

  async initialize(): Promise<void> {
    const rootUri = `file://${this.root}`
    await this.send("initialize", {
      processId: process.pid,
      rootUri,
      rootPath: this.root,
      workspaceFolders: [{ uri: rootUri, name: "workspace" }],
      capabilities: {
        textDocument: {
          hover: { contentFormat: ["markdown", "plaintext"] },
          definition: { linkSupport: true },
          references: {},
          documentSymbol: { hierarchicalDocumentSymbolSupport: true },
          publishDiagnostics: {},
          rename: {
            prepareSupport: true,
            prepareSupportDefaultBehavior: 1,
            honorsChangeAnnotations: true,
          },
          codeAction: {
            codeActionLiteralSupport: {
              codeActionKind: {
                valueSet: [
                  "quickfix",
                  "refactor",
                  "refactor.extract",
                  "refactor.inline",
                  "refactor.rewrite",
                  "source",
                  "source.organizeImports",
                  "source.fixAll",
                ],
              },
            },
            isPreferredSupport: true,
            disabledSupport: true,
            dataSupport: true,
            resolveSupport: {
              properties: ["edit", "command"],
            },
          },
        },
        workspace: {
          symbol: {},
          workspaceFolders: true,
          configuration: true,
          applyEdit: true,
          workspaceEdit: {
            documentChanges: true,
          },
        },
      },
      ...this.server.initialization,
    })
    this.notify("initialized")
    this.notify("workspace/didChangeConfiguration", {
      settings: { json: { validate: { enable: true } } },
    })
    await new Promise((r) => setTimeout(r, 300))
  }

  async openFile(filePath: string): Promise<void> {
    const absPath = resolve(filePath)
    if (this.openedFiles.has(absPath)) return

    const text = readFileSync(absPath, "utf-8")
    const ext = extname(absPath)
    const languageId = getLanguageId(ext)

    this.notify("textDocument/didOpen", {
      textDocument: {
        uri: `file://${absPath}`,
        languageId,
        version: 1,
        text,
      },
    })
    this.openedFiles.add(absPath)

    await new Promise((r) => setTimeout(r, 1000))
  }

  async hover(filePath: string, line: number, character: number): Promise<unknown> {
    const absPath = resolve(filePath)
    await this.openFile(absPath)
    return this.send("textDocument/hover", {
      textDocument: { uri: `file://${absPath}` },
      position: { line: line - 1, character },
    })
  }

  async definition(filePath: string, line: number, character: number): Promise<unknown> {
    const absPath = resolve(filePath)
    await this.openFile(absPath)
    return this.send("textDocument/definition", {
      textDocument: { uri: `file://${absPath}` },
      position: { line: line - 1, character },
    })
  }

  async references(filePath: string, line: number, character: number, includeDeclaration = true): Promise<unknown> {
    const absPath = resolve(filePath)
    await this.openFile(absPath)
    return this.send("textDocument/references", {
      textDocument: { uri: `file://${absPath}` },
      position: { line: line - 1, character },
      context: { includeDeclaration },
    })
  }

  async documentSymbols(filePath: string): Promise<unknown> {
    const absPath = resolve(filePath)
    await this.openFile(absPath)
    return this.send("textDocument/documentSymbol", {
      textDocument: { uri: `file://${absPath}` },
    })
  }

  async workspaceSymbols(query: string): Promise<unknown> {
    return this.send("workspace/symbol", { query })
  }

  async diagnostics(filePath: string): Promise<{ items: Diagnostic[] }> {
    const absPath = resolve(filePath)
    const uri = `file://${absPath}`
    await this.openFile(absPath)
    await new Promise((r) => setTimeout(r, 500))

    try {
      const result = await this.send("textDocument/diagnostic", {
        textDocument: { uri },
      })
      if (result && typeof result === "object" && "items" in result) {
        return result as { items: Diagnostic[] }
      }
    } catch {
    }

    return { items: this.diagnosticsStore.get(uri) ?? [] }
  }

  async prepareRename(filePath: string, line: number, character: number): Promise<unknown> {
    const absPath = resolve(filePath)
    await this.openFile(absPath)
    return this.send("textDocument/prepareRename", {
      textDocument: { uri: `file://${absPath}` },
      position: { line: line - 1, character },
    })
  }

  async rename(filePath: string, line: number, character: number, newName: string): Promise<unknown> {
    const absPath = resolve(filePath)
    await this.openFile(absPath)
    return this.send("textDocument/rename", {
      textDocument: { uri: `file://${absPath}` },
      position: { line: line - 1, character },
      newName,
    })
  }

  async codeAction(
    filePath: string,
    startLine: number,
    startChar: number,
    endLine: number,
    endChar: number,
    only?: string[]
  ): Promise<unknown> {
    const absPath = resolve(filePath)
    await this.openFile(absPath)
    return this.send("textDocument/codeAction", {
      textDocument: { uri: `file://${absPath}` },
      range: {
        start: { line: startLine - 1, character: startChar },
        end: { line: endLine - 1, character: endChar },
      },
      context: {
        diagnostics: [],
        only,
      },
    })
  }

  async codeActionResolve(codeAction: unknown): Promise<unknown> {
    return this.send("codeAction/resolve", codeAction)
  }

  isAlive(): boolean {
    return this.proc !== null && !this.processExited && this.proc.exitCode === null && this.stdinWritable
  }

  async stop(): Promise<void> {
    try {
      this.notify("shutdown", {})
      this.notify("exit")
    } catch {
    }
    this.stdinWritable = false
    this.proc?.kill()
    this.proc = null
    this.processExited = true
    this.diagnosticsStore.clear()
  }
}
