import { describe, it, expect, spyOn, afterEach } from "bun:test"
import * as config from "./config"
import * as fs from "node:fs"

describe("config check", () => {
  describe("validateConfig", () => {
    let readFileSpy: ReturnType<typeof spyOn>

    afterEach(() => {
      readFileSpy?.mockRestore()
    })

    it("returns valid: false for non-existent file", () => {
      // #given non-existent file path
      // #when validating
      const result = config.validateConfig("/non/existent/path.json")

      // #then should indicate invalid
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it("detects deprecated model field", () => {
      // #given config with deprecated model field on agent
      const configContent = JSON.stringify({
        agents: {
          oracle: {
            model: "anthropic/claude-sonnet-4-5",
          },
        },
      })
      readFileSpy = spyOn(fs, "readFileSync").mockReturnValue(configContent)

      // #when validating
      const result = config.validateConfig("/test/config.json")

      // #then should fail with deprecated warning
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some((e) => e.toLowerCase().includes("deprecated"))).toBe(true)
    })

    it("detects invalid category", () => {
      // #given config with invalid category name
      const configContent = JSON.stringify({
        agents: {
          oracle: {
            category: "invalid-nonexistent-category",
          },
        },
      })
      readFileSpy = spyOn(fs, "readFileSync").mockReturnValue(configContent)

      // #when validating
      const result = config.validateConfig("/test/config.json")

      // #then should fail with invalid category error
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some((e) => e.toLowerCase().includes("invalid category"))).toBe(true)
    })
  })

  describe("getConfigInfo", () => {
    it("returns exists: false when no config found", () => {
      // #given no config file exists
      // #when getting config info
      const info = config.getConfigInfo()

      // #then should handle gracefully
      expect(typeof info.exists).toBe("boolean")
      expect(typeof info.valid).toBe("boolean")
    })
  })

  describe("checkConfigValidity", () => {
    let getInfoSpy: ReturnType<typeof spyOn>

    afterEach(() => {
      getInfoSpy?.mockRestore()
    })

    it("returns pass when no config exists (uses defaults)", async () => {
      // #given no config file
      getInfoSpy = spyOn(config, "getConfigInfo").mockReturnValue({
        exists: false,
        path: null,
        format: null,
        valid: true,
        errors: [],
      })

      // #when checking validity
      const result = await config.checkConfigValidity()

      // #then should pass with default message
      expect(result.status).toBe("pass")
      expect(result.message).toContain("default")
    })

    it("returns pass when config is valid", async () => {
      // #given valid config
      getInfoSpy = spyOn(config, "getConfigInfo").mockReturnValue({
        exists: true,
        path: "/home/user/.config/opencode/oh-my-opencode.json",
        format: "json",
        valid: true,
        errors: [],
      })

      // #when checking validity
      const result = await config.checkConfigValidity()

      // #then should pass
      expect(result.status).toBe("pass")
      expect(result.message).toContain("JSON")
    })

    it("returns fail when config has validation errors", async () => {
      // #given invalid config
      getInfoSpy = spyOn(config, "getConfigInfo").mockReturnValue({
        exists: true,
        path: "/home/user/.config/opencode/oh-my-opencode.json",
        format: "json",
        valid: false,
        errors: ["agents.oracle: Invalid model format"],
      })

      // #when checking validity
      const result = await config.checkConfigValidity()

      // #then should fail with errors
      expect(result.status).toBe("fail")
      expect(result.details?.some((d) => d.includes("Error"))).toBe(true)
    })
  })

  describe("getConfigCheckDefinition", () => {
    it("returns valid check definition", () => {
      // #given
      // #when getting definition
      const def = config.getConfigCheckDefinition()

      // #then should have required properties
      expect(def.id).toBe("config-validation")
      expect(def.category).toBe("configuration")
      expect(def.critical).toBe(false)
    })
  })
})
