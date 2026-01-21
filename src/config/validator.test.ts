import { describe, expect, it } from "bun:test"
import { validateConfig, ConfigValidationError, type ValidatedConfig } from "./validator"

describe("validateConfig", () => {
  it("should return ValidatedConfig for valid input", () => {
    // #given
    const config = {
      agents: {
        oracle: {
          category: "ultrabrain",
          temperature: 0.2,
        },
      },
      categories: {
        ultrabrain: {
          model: "openai/gpt-5.2",
        },
      },
    }

    // #when
    const result = validateConfig(config)

    // #then
    expect(result).toBeDefined()
    expect(result.agents).toBeDefined()
    expect(result.agents?.oracle?.category).toBe("ultrabrain")
    expect(result.categories).toBeDefined()
    expect(result.categories?.ultrabrain?.model).toBe("openai/gpt-5.2")
  })

  it("should throw ConfigValidationError for invalid category", () => {
    // #given
    const config = {
      agents: {
        oracle: {
          category: "invalid",
        },
      },
    }

    // #when / #then
    expect(() => validateConfig(config)).toThrow(ConfigValidationError)
    try {
      validateConfig(config)
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError)
      expect((error as ConfigValidationError).message).toContain("Invalid category 'invalid'")
    }
  })

  it("should provide suggestion for typo", () => {
    // #given
    const config = {
      agents: {
        oracle: {
          category: "ultra-brain",
        },
      },
    }

    // #when / #then
    expect(() => validateConfig(config)).toThrow(ConfigValidationError)
    try {
      validateConfig(config)
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError)
      const validationError = error as ConfigValidationError
      // Expect suggestion in message or in errors array
      expect(validationError.message).toContain("Did you mean 'ultrabrain'?")
      expect(validationError.errors[0].suggestion).toBe("ultrabrain")
    }
  })

  it("should aggregate multiple errors", () => {
    // #given
    const config = {
      agents: {
        oracle: {
          category: "nonexistent-category",
        },
        librarian: {
          category: "another-invalid",
        },
      },
    }

    // #when / #then
    expect(() => validateConfig(config)).toThrow(ConfigValidationError)
    try {
      validateConfig(config)
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError)
      const message = (error as ConfigValidationError).message
      expect(message).toContain("nonexistent-category")
      expect(message).toContain("another-invalid")
    }
  })

  describe("semantic validation", () => {
    it("should throw error for invalid model format", () => {
      // #given
      const config = { categories: { custom: { model: "invalid-format" } } }

      // #when / #then
      expect(() => validateConfig(config)).toThrow(ConfigValidationError)
      try {
        validateConfig(config)
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigValidationError)
        expect((error as ConfigValidationError).message).toContain("Invalid model format")
      }
    })

    it("should throw error for invalid temperature", () => {
      // #given
      const config = { categories: { custom: { temperature: 2.5 } } }

      // #when / #then
      expect(() => validateConfig(config)).toThrow(ConfigValidationError)
      try {
        validateConfig(config)
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigValidationError)
        expect((error as ConfigValidationError).message).toContain("Temperature 2.5 out of range")
      }
    })

    it("should pass for valid model and temperature", () => {
      // #given
      const config = { categories: { custom: { model: "provider/model", temperature: 0.5 } } }

      // #when
      const result = validateConfig(config)

      // #then
      expect(result).toBeDefined()
      expect(result.categories?.custom?.model).toBe("provider/model")
      expect(result.categories?.custom?.temperature).toBe(0.5)
    })
  })
})
