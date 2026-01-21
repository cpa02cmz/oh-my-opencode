import { describe, expect, test, mock, beforeEach, afterEach, spyOn } from "bun:test"
import * as fs from "node:fs"

import { ANTIGRAVITY_PROVIDER_CONFIG, getPluginNameWithVersion, fetchNpmDistTags, generateOmoConfig, addProviderConfig, initConfigContext, resetConfigContext } from "./config-manager"
import type { InstallConfig } from "./types"

describe("getPluginNameWithVersion", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test("returns @latest when current version matches latest tag", async () => {
    // #given npm dist-tags with latest=2.14.0
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ latest: "2.14.0", beta: "3.0.0-beta.3" }),
      } as Response)
    ) as unknown as typeof fetch

    // #when current version is 2.14.0
    const result = await getPluginNameWithVersion("2.14.0")

    // #then should use @latest tag
    expect(result).toBe("oh-my-opencode@latest")
  })

  test("returns @beta when current version matches beta tag", async () => {
    // #given npm dist-tags with beta=3.0.0-beta.3
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ latest: "2.14.0", beta: "3.0.0-beta.3" }),
      } as Response)
    ) as unknown as typeof fetch

    // #when current version is 3.0.0-beta.3
    const result = await getPluginNameWithVersion("3.0.0-beta.3")

    // #then should use @beta tag
    expect(result).toBe("oh-my-opencode@beta")
  })

  test("returns @next when current version matches next tag", async () => {
    // #given npm dist-tags with next=3.1.0-next.1
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ latest: "2.14.0", beta: "3.0.0-beta.3", next: "3.1.0-next.1" }),
      } as Response)
    ) as unknown as typeof fetch

    // #when current version is 3.1.0-next.1
    const result = await getPluginNameWithVersion("3.1.0-next.1")

    // #then should use @next tag
    expect(result).toBe("oh-my-opencode@next")
  })

  test("returns pinned version when no tag matches", async () => {
    // #given npm dist-tags with beta=3.0.0-beta.3
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ latest: "2.14.0", beta: "3.0.0-beta.3" }),
      } as Response)
    ) as unknown as typeof fetch

    // #when current version is old beta 3.0.0-beta.2
    const result = await getPluginNameWithVersion("3.0.0-beta.2")

    // #then should pin to specific version
    expect(result).toBe("oh-my-opencode@3.0.0-beta.2")
  })

  test("returns pinned version when fetch fails", async () => {
    // #given network failure
    globalThis.fetch = mock(() => Promise.reject(new Error("Network error"))) as unknown as typeof fetch

    // #when current version is 3.0.0-beta.3
    const result = await getPluginNameWithVersion("3.0.0-beta.3")

    // #then should fall back to pinned version
    expect(result).toBe("oh-my-opencode@3.0.0-beta.3")
  })

  test("returns pinned version when npm returns non-ok response", async () => {
    // #given npm returns 404
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 404,
      } as Response)
    ) as unknown as typeof fetch

    // #when current version is 2.14.0
    const result = await getPluginNameWithVersion("2.14.0")

    // #then should fall back to pinned version
    expect(result).toBe("oh-my-opencode@2.14.0")
  })

  test("prioritizes latest over other tags when version matches multiple", async () => {
    // #given version matches both latest and beta (during release promotion)
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ beta: "3.0.0", latest: "3.0.0", next: "3.1.0-alpha.1" }),
      } as Response)
    ) as unknown as typeof fetch

    // #when current version matches both
    const result = await getPluginNameWithVersion("3.0.0")

    // #then should prioritize @latest
    expect(result).toBe("oh-my-opencode@latest")
  })
})

describe("fetchNpmDistTags", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test("returns dist-tags on success", async () => {
    // #given npm returns dist-tags
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ latest: "2.14.0", beta: "3.0.0-beta.3" }),
      } as Response)
    ) as unknown as typeof fetch

    // #when fetching dist-tags
    const result = await fetchNpmDistTags("oh-my-opencode")

    // #then should return the tags
    expect(result).toEqual({ latest: "2.14.0", beta: "3.0.0-beta.3" })
  })

  test("returns null on network failure", async () => {
    // #given network failure
    globalThis.fetch = mock(() => Promise.reject(new Error("Network error"))) as unknown as typeof fetch

    // #when fetching dist-tags
    const result = await fetchNpmDistTags("oh-my-opencode")

    // #then should return null
    expect(result).toBeNull()
  })

  test("returns null on non-ok response", async () => {
    // #given npm returns 404
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 404,
      } as Response)
    ) as unknown as typeof fetch

    // #when fetching dist-tags
    const result = await fetchNpmDistTags("oh-my-opencode")

    // #then should return null
    expect(result).toBeNull()
  })
})

describe("config-manager ANTIGRAVITY_PROVIDER_CONFIG", () => {
  test("Gemini models include full spec (limit + modalities)", () => {
    const google = (ANTIGRAVITY_PROVIDER_CONFIG as any).google
    expect(google).toBeTruthy()

    const models = google.models as Record<string, any>
    expect(models).toBeTruthy()

    const required = [
      "antigravity-gemini-3-pro-high",
      "antigravity-gemini-3-pro-low",
      "antigravity-gemini-3-flash",
    ]

    for (const key of required) {
      const model = models[key]
      expect(model).toBeTruthy()
      expect(typeof model.name).toBe("string")
      expect(model.name.includes("(Antigravity)")).toBe(true)

      expect(model.limit).toBeTruthy()
      expect(typeof model.limit.context).toBe("number")
      expect(typeof model.limit.output).toBe("number")

      expect(model.modalities).toBeTruthy()
      expect(Array.isArray(model.modalities.input)).toBe(true)
      expect(Array.isArray(model.modalities.output)).toBe(true)
    }
  })
})

describe("generateOmoConfig - category generation", () => {
  test("generates category config based on providers (Claude Max)", () => {
    // #given user has Claude max20 subscription
    const config: InstallConfig = {
      hasClaude: true,
      isMax20: true,
      hasOpenAI: false,
      hasGemini: false,
      hasCopilot: false,
      hasOpencodeZen: false,
      hasZaiCodingPlan: false,
    }

    // #when generating config
    const result = generateOmoConfig(config)

    // #then should generate category-based config (not agent-based)
    expect(result.categories).toBeDefined()
    expect((result.categories as Record<string, { model: string }>)["most-capable"].model).toBe("anthropic/claude-opus-4-5")
    expect((result.categories as Record<string, { model: string }>)["quick"].model).toBe("anthropic/claude-haiku-4-5")
    expect(result.agents).toBeUndefined()
  })

  test("generates category config based on providers (ChatGPT)", () => {
    // #given user has only ChatGPT subscription
    const config: InstallConfig = {
      hasClaude: false,
      isMax20: false,
      hasOpenAI: true,
      hasGemini: false,
      hasCopilot: false,
      hasOpencodeZen: false,
      hasZaiCodingPlan: false,
    }

    // #when generating config
    const result = generateOmoConfig(config)

    // #then should generate ultrabrain category with OpenAI model
    expect((result.categories as Record<string, { model: string }>)["ultrabrain"].model).toBe("openai/gpt-5.2")
  })

  test("generates empty categories when no providers", () => {
    // #given user has no providers
    const config: InstallConfig = {
      hasClaude: false,
      isMax20: false,
      hasOpenAI: false,
      hasGemini: false,
      hasCopilot: false,
      hasOpencodeZen: false,
      hasZaiCodingPlan: false,
    }

    // #when generating config
    const result = generateOmoConfig(config)

    // #then should have categories defined (empty or undefined based on implementation)
    expect(result.categories).toBeDefined()
    expect(Object.keys(result.categories as Record<string, unknown>).length).toBe(0)
    expect(result.agents).toBeUndefined()
  })
})

describe("addProviderConfig", () => {
  let existsSyncSpy: ReturnType<typeof spyOn>
  let readFileSyncSpy: ReturnType<typeof spyOn>
  let writeFileSyncSpy: ReturnType<typeof spyOn>
  let statSyncSpy: ReturnType<typeof spyOn>
  let mkdirSyncSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    // Initialize config context with a test path
    initConfigContext("opencode", "1.0.0")
  })

  afterEach(() => {
    existsSyncSpy?.mockRestore()
    readFileSyncSpy?.mockRestore()
    writeFileSyncSpy?.mockRestore()
    statSyncSpy?.mockRestore()
    mkdirSyncSpy?.mockRestore()
    resetConfigContext()
  })

  test("should preserve existing google provider config", () => {
    // #given a config with existing google provider
    const existingConfig = {
      provider: {
        google: {
          existing: true,
          customModel: "my-custom-model",
        },
      },
    }

    existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(true)
    mkdirSyncSpy = spyOn(fs, "mkdirSync").mockReturnValue(undefined)
    statSyncSpy = spyOn(fs, "statSync").mockReturnValue({ size: 100 } as fs.Stats)
    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(existingConfig))
    writeFileSyncSpy = spyOn(fs, "writeFileSync").mockReturnValue(undefined)

    // #when adding provider config with hasGemini: true
    const installConfig: InstallConfig = {
      hasClaude: false,
      isMax20: false,
      hasOpenAI: false,
      hasGemini: true,
      hasCopilot: false,
      hasOpencodeZen: false,
      hasZaiCodingPlan: false,
    }

    const result = addProviderConfig(installConfig)

    // #then writeFileSync should be called with config that preserves existing google config
    expect(result.success).toBe(true)
    expect(writeFileSyncSpy).toHaveBeenCalled()

    const writtenContent = writeFileSyncSpy.mock.calls[0]?.[1] as string
    const writtenConfig = JSON.parse(writtenContent)

    // Existing google config should be preserved, not overwritten
    expect(writtenConfig.provider.google.existing).toBe(true)
    expect(writtenConfig.provider.google.customModel).toBe("my-custom-model")

    // ANTIGRAVITY_PROVIDER_CONFIG.google should NOT have been merged
    // (the existing config should take precedence)
    expect(writtenConfig.provider.google.models).toBeUndefined()
  })

  test("should add google provider if missing", () => {
    // #given a config without google provider
    const existingConfig = {
      provider: {
        openai: { apiKey: "sk-xxx" },
      },
    }

    existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(true)
    mkdirSyncSpy = spyOn(fs, "mkdirSync").mockReturnValue(undefined)
    statSyncSpy = spyOn(fs, "statSync").mockReturnValue({ size: 100 } as fs.Stats)
    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(existingConfig))
    writeFileSyncSpy = spyOn(fs, "writeFileSync").mockReturnValue(undefined)

    // #when adding provider config with hasGemini: true
    const installConfig: InstallConfig = {
      hasClaude: false,
      isMax20: false,
      hasOpenAI: false,
      hasGemini: true,
      hasCopilot: false,
      hasOpencodeZen: false,
      hasZaiCodingPlan: false,
    }

    const result = addProviderConfig(installConfig)

    // #then writeFileSync should be called with config that includes ANTIGRAVITY google provider
    expect(result.success).toBe(true)
    expect(writeFileSyncSpy).toHaveBeenCalled()

    const writtenContent = writeFileSyncSpy.mock.calls[0]?.[1] as string
    const writtenConfig = JSON.parse(writtenContent)

    // Google provider should be added from ANTIGRAVITY_PROVIDER_CONFIG
    expect(writtenConfig.provider.google).toEqual(ANTIGRAVITY_PROVIDER_CONFIG.google)

    // Existing openai provider should be preserved
    expect(writtenConfig.provider.openai.apiKey).toBe("sk-xxx")
  })
})
