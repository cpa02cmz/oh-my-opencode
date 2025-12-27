import { existsSync, readFileSync } from "node:fs"

export function stripJsoncComments(content: string): string {
  let result = ""
  let i = 0
  let inString = false
  let escape = false

  while (i < content.length) {
    const char = content[i]

    if (escape) {
      result += char
      escape = false
      i++
      continue
    }

    if (char === "\\") {
      result += char
      escape = true
      i++
      continue
    }

    if (char === '"' && !inString) {
      inString = true
      result += char
      i++
      continue
    }

    if (char === '"' && inString) {
      inString = false
      result += char
      i++
      continue
    }

    if (inString) {
      result += char
      i++
      continue
    }

    if (char === "/" && content[i + 1] === "/") {
      while (i < content.length && content[i] !== "\n") {
        i++
      }
      continue
    }

    if (char === "/" && content[i + 1] === "*") {
      i += 2
      while (i < content.length - 1 && !(content[i] === "*" && content[i + 1] === "/")) {
        i++
      }
      i += 2
      continue
    }

    result += char
    i++
  }

  return result.replace(/,(\s*[}\]])/g, "$1")
}

export function parseJsonc<T = unknown>(content: string): T {
  const cleaned = stripJsoncComments(content)
  return JSON.parse(cleaned) as T
}

export function readJsoncFile<T = unknown>(filePath: string): T | null {
  try {
    const content = readFileSync(filePath, "utf-8")
    return parseJsonc<T>(content)
  } catch {
    return null
  }
}

export function detectConfigFile(basePath: string): {
  format: "json" | "jsonc" | "none"
  path: string
} {
  const jsoncPath = `${basePath}.jsonc`
  const jsonPath = `${basePath}.json`

  if (existsSync(jsoncPath)) {
    return { format: "jsonc", path: jsoncPath }
  }
  if (existsSync(jsonPath)) {
    return { format: "json", path: jsonPath }
  }
  return { format: "none", path: jsonPath }
}
