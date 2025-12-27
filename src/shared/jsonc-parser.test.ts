import { describe, expect, test } from "bun:test"
import { detectConfigFile, parseJsonc, readJsoncFile, stripJsoncComments } from "./jsonc-parser"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

describe("stripJsoncComments", () => {
  test("removes line comments", () => {
    //#given
    const input = `{
      "key": "value" // comment
    }`

    //#when
    const result = stripJsoncComments(input)

    //#then
    expect(result).toContain('"key": "value"')
    expect(result).not.toContain("// comment")
  })

  test("removes block comments", () => {
    //#given
    const input = `{
      /* comment */
      "key": "value"
    }`

    //#when
    const result = stripJsoncComments(input)

    //#then
    expect(result).toContain('"key": "value"')
    expect(result).not.toContain("/* comment */")
  })

  test("preserves URLs with //", () => {
    //#given
    const input = `{
      "url": "https://example.com"
    }`

    //#when
    const result = stripJsoncComments(input)

    //#then
    expect(result).toContain("https://example.com")
  })

  test("removes trailing commas", () => {
    //#given
    const input = `{
      "key": "value",
    }`

    //#when
    const result = stripJsoncComments(input)

    //#then
    expect(() => JSON.parse(result)).not.toThrow()
  })

  test("handles multi-line block comments", () => {
    //#given
    const input = `{
      /* Multi-line
         comment
         here */
      "key": "value"
    }`

    //#when
    const result = stripJsoncComments(input)

    //#then
    expect(result).toContain('"key": "value"')
    expect(result).not.toContain("Multi-line")
  })

  test("handles escaped quotes in strings", () => {
    //#given
    const input = `{
      "key": "value with \\"quotes\\""
    }`

    //#when
    const result = stripJsoncComments(input)

    //#then
    expect(result).toContain('\\"quotes\\"')
  })
})

describe("parseJsonc", () => {
  test("parses JSONC with comments", () => {
    //#given
    const jsonc = `{
      // This is a comment
      "agents": {
        "oracle": { "model": "openai/gpt-5.2" }
      },
      /* Multi-line
         comment */
      "disabled_agents": []
    }`

    //#when
    const result = parseJsonc<any>(jsonc)

    //#then
    expect(result.agents.oracle.model).toBe("openai/gpt-5.2")
    expect(result.disabled_agents).toEqual([])
  })

  test("parses JSONC with trailing commas", () => {
    //#given
    const jsonc = `{
      "key1": "value1",
      "key2": "value2",
    }`

    //#when
    const result = parseJsonc<any>(jsonc)

    //#then
    expect(result.key1).toBe("value1")
    expect(result.key2).toBe("value2")
  })

  test("throws on invalid JSON", () => {
    //#given
    const invalid = `{
      "key": invalid
    }`

    //#when
    //#then
    expect(() => parseJsonc(invalid)).toThrow()
  })
})

describe("readJsoncFile", () => {
  const testDir = join(__dirname, ".test-jsonc")
  const testFile = join(testDir, "config.jsonc")

  test("reads and parses valid JSONC file", () => {
    //#given
    if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true })
    const content = `{
      // Comment
      "test": "value"
    }`
    writeFileSync(testFile, content)

    //#when
    const result = readJsoncFile<any>(testFile)

    //#then
    expect(result).not.toBeNull()
    expect(result?.test).toBe("value")

    rmSync(testDir, { recursive: true, force: true })
  })

  test("returns null for non-existent file", () => {
    //#given
    const nonExistent = join(testDir, "does-not-exist.jsonc")

    //#when
    const result = readJsoncFile(nonExistent)

    //#then
    expect(result).toBeNull()
  })

  test("returns null for malformed JSON", () => {
    //#given
    if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true })
    writeFileSync(testFile, "{ invalid }")

    //#when
    const result = readJsoncFile(testFile)

    //#then
    expect(result).toBeNull()

    rmSync(testDir, { recursive: true, force: true })
  })
})

describe("detectConfigFile", () => {
  const testDir = join(__dirname, ".test-detect")

  test("prefers .jsonc over .json", () => {
    //#given
    if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true })
    const basePath = join(testDir, "config")
    writeFileSync(`${basePath}.json`, "{}")
    writeFileSync(`${basePath}.jsonc`, "{}")

    //#when
    const result = detectConfigFile(basePath)

    //#then
    expect(result.format).toBe("jsonc")
    expect(result.path).toBe(`${basePath}.jsonc`)

    rmSync(testDir, { recursive: true, force: true })
  })

  test("detects .json when .jsonc doesn't exist", () => {
    //#given
    if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true })
    const basePath = join(testDir, "config")
    writeFileSync(`${basePath}.json`, "{}")

    //#when
    const result = detectConfigFile(basePath)

    //#then
    expect(result.format).toBe("json")
    expect(result.path).toBe(`${basePath}.json`)

    rmSync(testDir, { recursive: true, force: true })
  })

  test("returns none when neither exists", () => {
    //#given
    const basePath = join(testDir, "nonexistent")

    //#when
    const result = detectConfigFile(basePath)

    //#then
    expect(result.format).toBe("none")
  })
})
