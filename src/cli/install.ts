import * as p from "@clack/prompts"
import color from "picocolors"
import type { InstallArgs, InstallConfig, ClaudeSubscription, BooleanArg, DetectedConfig } from "./types"
import {
  addPluginToOpenCodeConfig,
  writeOmoConfig,
  isOpenCodeInstalled,
  getOpenCodeVersion,
  addAuthPlugins,
  addProviderConfig,
  detectCurrentConfig,
} from "./config-manager"
import { generateCategoryConfig, ALL_CATEGORIES, CATEGORY_PROVIDER_PRIORITY, CATEGORY_MODEL_DEFAULTS, type UserProviders } from "./category-defaults"
import packageJson from "../../package.json" with { type: "json" }

const VERSION = packageJson.version

const SYMBOLS = {
  check: color.green("✓"),
  cross: color.red("✗"),
  arrow: color.cyan("→"),
  bullet: color.dim("•"),
  info: color.blue("ℹ"),
  warn: color.yellow("⚠"),
  star: color.yellow("★"),
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  ultrabrain: "complex reasoning",
  quick: "fast responses",
  "visual-engineering": "UI/frontend",
  "most-capable": "highest quality",
  writing: "documentation",
  general: "everyday tasks",
  artistry: "creative design",
}

function formatProvider(name: string, enabled: boolean, detail?: string): string {
  const status = enabled ? SYMBOLS.check : color.dim("○")
  const label = enabled ? color.white(name) : color.dim(name)
  const suffix = detail ? color.dim(` (${detail})`) : ""
  return `  ${status} ${label}${suffix}`
}

function installConfigToUserProviders(config: InstallConfig): UserProviders {
  return {
    hasClaude: config.hasClaude && !config.isMax20,
    hasClaudeMax: config.hasClaude && config.isMax20,
    hasChatGPT: config.hasOpenAI,
    hasGemini: config.hasGemini,
    hasCopilot: config.hasCopilot,
  }
}

/**
 * Checks if the user has one of the top-priority providers for a category.
 * Returns the model if user has a high-priority provider, otherwise undefined.
 * Categories without a high-priority provider will use OpenCode default.
 * 
 * "High-priority" means the first 2 providers in the priority list.
 */
function selectOptimalModelForCategory(category: string, providers: UserProviders): string | undefined {
  const priority = CATEGORY_PROVIDER_PRIORITY[category]
  const categoryDefaults = CATEGORY_MODEL_DEFAULTS[category]
  if (!priority || !categoryDefaults || priority.length === 0) return undefined

  const providerMap: Record<string, boolean> = {
    claude_max: providers.hasClaudeMax,
    claude: providers.hasClaude,
    chatgpt: providers.hasChatGPT,
    gemini: providers.hasGemini,
    copilot: providers.hasCopilot,
  }

  // Only consider category "configured" if user has one of the top 2 priority providers
  const topPriorities = priority.slice(0, 2)
  for (const provider of topPriorities) {
    if (providerMap[provider]) {
      return categoryDefaults[provider]
    }
  }

  return undefined // User doesn't have a high-priority provider
}

export function formatConfigSummary(config: InstallConfig): string {
  const lines: string[] = []

  lines.push(color.bold(color.white("Configuration Summary")))
  lines.push("")

  const claudeDetail = config.hasClaude ? (config.isMax20 ? "max20" : "standard") : undefined
  lines.push(formatProvider("Claude", config.hasClaude, claudeDetail))
  lines.push(formatProvider("OpenAI/ChatGPT", config.hasOpenAI, "GPT-5.2 for Oracle"))
  lines.push(formatProvider("Gemini", config.hasGemini))
  lines.push(formatProvider("GitHub Copilot", config.hasCopilot, "fallback"))
  lines.push(formatProvider("OpenCode Zen", config.hasOpencodeZen, "opencode/ models"))
  lines.push(formatProvider("Z.ai Coding Plan", config.hasZaiCodingPlan, "Librarian: glm-4.7"))

  lines.push("")
  lines.push(color.dim("─".repeat(40)))
  lines.push("")

  lines.push(color.bold(color.white("Model Assignment")))
  lines.push("")

  // Generate category configurations based on user's providers
  const userProviders = installConfigToUserProviders(config)
  const categories = generateCategoryConfig(userProviders)

  // Build configured categories map (only with provider match, no fallback)
  const configuredCategories: Record<string, string> = {}
  for (const category of ALL_CATEGORIES) {
    const model = selectOptimalModelForCategory(category, userProviders)
    if (model) {
      configuredCategories[category] = model
    }
  }

  // Find unconfigured categories
  const unconfiguredCategories = ALL_CATEGORIES.filter(cat => !(cat in configuredCategories))

  // List configured categories
  for (const [category, model] of Object.entries(configuredCategories)) {
    const description = CATEGORY_DESCRIPTIONS[category] ?? ""
    const descSuffix = description ? ` (${description})` : ""
    lines.push(`  ${category} → ${model}${descSuffix}`)
  }

  // Warn about unconfigured categories
  if (unconfiguredCategories.length > 0) {
    lines.push("")
    lines.push(`  ${SYMBOLS.warn} The following categories will use your OpenCode default model:`)
    for (const category of unconfiguredCategories) {
      const description = CATEGORY_DESCRIPTIONS[category] ?? ""
      const descSuffix = description ? ` (${description})` : ""
      lines.push(`    ${SYMBOLS.bullet} ${category}${descSuffix}`)
    }
  }

  lines.push("")
  lines.push(`  ${SYMBOLS.info} Run opencode models to see all available models.`)

  return lines.join("\n")
}

function printHeader(isUpdate: boolean): void {
  const mode = isUpdate ? "Update" : "Install"
  console.log()
  console.log(color.bgMagenta(color.white(` oMoMoMoMo... ${mode} `)))
  console.log()
}

function printStep(step: number, total: number, message: string): void {
  const progress = color.dim(`[${step}/${total}]`)
  console.log(`${progress} ${message}`)
}

function printSuccess(message: string): void {
  console.log(`${SYMBOLS.check} ${message}`)
}

function printError(message: string): void {
  console.log(`${SYMBOLS.cross} ${color.red(message)}`)
}

function printInfo(message: string): void {
  console.log(`${SYMBOLS.info} ${message}`)
}

function printWarning(message: string): void {
  console.log(`${SYMBOLS.warn} ${color.yellow(message)}`)
}

function printBox(content: string, title?: string): void {
  const lines = content.split("\n")
  const maxWidth = Math.max(...lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, "").length), title?.length ?? 0) + 4
  const border = color.dim("─".repeat(maxWidth))

  console.log()
  if (title) {
    console.log(color.dim("┌─") + color.bold(` ${title} `) + color.dim("─".repeat(maxWidth - title.length - 4)) + color.dim("┐"))
  } else {
    console.log(color.dim("┌") + border + color.dim("┐"))
  }

  for (const line of lines) {
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, "")
    const padding = maxWidth - stripped.length
    console.log(color.dim("│") + ` ${line}${" ".repeat(padding - 1)}` + color.dim("│"))
  }

  console.log(color.dim("└") + border + color.dim("┘"))
  console.log()
}

function validateNonTuiArgs(args: InstallArgs): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (args.claude === undefined) {
    errors.push("--claude is required (values: no, yes, max20)")
  } else if (!["no", "yes", "max20"].includes(args.claude)) {
    errors.push(`Invalid --claude value: ${args.claude} (expected: no, yes, max20)`)
  }

  if (args.gemini === undefined) {
    errors.push("--gemini is required (values: no, yes)")
  } else if (!["no", "yes"].includes(args.gemini)) {
    errors.push(`Invalid --gemini value: ${args.gemini} (expected: no, yes)`)
  }

  if (args.copilot === undefined) {
    errors.push("--copilot is required (values: no, yes)")
  } else if (!["no", "yes"].includes(args.copilot)) {
    errors.push(`Invalid --copilot value: ${args.copilot} (expected: no, yes)`)
  }

  if (args.openai !== undefined && !["no", "yes"].includes(args.openai)) {
    errors.push(`Invalid --openai value: ${args.openai} (expected: no, yes)`)
  }

  if (args.opencodeZen !== undefined && !["no", "yes"].includes(args.opencodeZen)) {
    errors.push(`Invalid --opencode-zen value: ${args.opencodeZen} (expected: no, yes)`)
  }

  if (args.zaiCodingPlan !== undefined && !["no", "yes"].includes(args.zaiCodingPlan)) {
    errors.push(`Invalid --zai-coding-plan value: ${args.zaiCodingPlan} (expected: no, yes)`)
  }

  return { valid: errors.length === 0, errors }
}

function argsToConfig(args: InstallArgs): InstallConfig {
  return {
    hasClaude: args.claude !== "no",
    isMax20: args.claude === "max20",
    hasOpenAI: args.openai === "yes",
    hasGemini: args.gemini === "yes",
    hasCopilot: args.copilot === "yes",
    hasOpencodeZen: args.opencodeZen === "yes",
    hasZaiCodingPlan: args.zaiCodingPlan === "yes",
  }
}

function detectedToInitialValues(detected: DetectedConfig): { claude: ClaudeSubscription; openai: BooleanArg; gemini: BooleanArg; copilot: BooleanArg; opencodeZen: BooleanArg; zaiCodingPlan: BooleanArg } {
  let claude: ClaudeSubscription = "no"
  if (detected.hasClaude) {
    claude = detected.isMax20 ? "max20" : "yes"
  }

  return {
    claude,
    openai: detected.hasOpenAI ? "yes" : "no",
    gemini: detected.hasGemini ? "yes" : "no",
    copilot: detected.hasCopilot ? "yes" : "no",
    opencodeZen: detected.hasOpencodeZen ? "yes" : "no",
    zaiCodingPlan: detected.hasZaiCodingPlan ? "yes" : "no",
  }
}

export async function runTuiMode(detected: DetectedConfig): Promise<InstallConfig | null> {
  const initial = detectedToInitialValues(detected)

  const claude = await p.select({
    message: "Do you have a Claude subscription?",
    options: [
      { value: "no" as const, label: "No", hint: "Categories will use other providers or your default model" },
      { value: "yes" as const, label: "Yes (Pro)", hint: "Enables Sonnet and Haiku for balanced performance" },
      { value: "max20" as const, label: "Yes (Max)", hint: "Enables Opus for maximum reasoning capability" },
    ],
    initialValue: initial.claude,
  })

  if (p.isCancel(claude)) {
    p.cancel("Installation cancelled.")
    return null
  }

  const openai = await p.select({
    message: "Do you have a ChatGPT subscription?",
    options: [
      { value: "no" as const, label: "No" },
      { value: "yes" as const, label: "Yes", hint: "Enables GPT models for complex reasoning tasks" },
    ],
    initialValue: initial.openai,
  })

  if (p.isCancel(openai)) {
    p.cancel("Installation cancelled.")
    return null
  }

  const gemini = await p.select({
    message: "Do you have a Google Gemini subscription?",
    options: [
      { value: "no" as const, label: "No" },
      { value: "yes" as const, label: "Yes", hint: "Enables Gemini models for visual and creative work" },
    ],
    initialValue: initial.gemini,
  })

  if (p.isCancel(gemini)) {
    p.cancel("Installation cancelled.")
    return null
  }

  const copilot = await p.select({
    message: "Do you have a GitHub Copilot subscription?",
    options: [
      { value: "no" as const, label: "No" },
      { value: "yes" as const, label: "Yes", hint: "Enables Copilot-proxied models as additional options" },
    ],
    initialValue: initial.copilot,
  })

  if (p.isCancel(copilot)) {
    p.cancel("Installation cancelled.")
    return null
  }

  const opencodeZen = await p.select({
    message: "Do you have a OpenCode Zen subscription?",
    options: [
      { value: "no" as const, label: "No" },
      { value: "yes" as const, label: "Yes", hint: "Enables OpenCode-proxied models for all providers" },
    ],
    initialValue: initial.opencodeZen,
  })

  if (p.isCancel(opencodeZen)) {
    p.cancel("Installation cancelled.")
    return null
  }

  const zaiCodingPlan = await p.select({
    message: "Do you have a Z.ai Coding Plan subscription?",
    options: [
      { value: "no" as const, label: "No" },
      { value: "yes" as const, label: "Yes", hint: "Enables Z.ai models for research and documentation" },
    ],
    initialValue: initial.zaiCodingPlan,
  })

  if (p.isCancel(zaiCodingPlan)) {
    p.cancel("Installation cancelled.")
    return null
  }

  return {
    hasClaude: claude !== "no",
    isMax20: claude === "max20",
    hasOpenAI: openai === "yes",
    hasGemini: gemini === "yes",
    hasCopilot: copilot === "yes",
    hasOpencodeZen: opencodeZen === "yes",
    hasZaiCodingPlan: zaiCodingPlan === "yes",
  }
}

async function runNonTuiInstall(args: InstallArgs): Promise<number> {
  const validation = validateNonTuiArgs(args)
  if (!validation.valid) {
    printHeader(false)
    printError("Validation failed:")
    for (const err of validation.errors) {
      console.log(`  ${SYMBOLS.bullet} ${err}`)
    }
    console.log()
    printInfo("Usage: bunx oh-my-opencode install --no-tui --claude=<no|yes|max20> --gemini=<no|yes> --copilot=<no|yes>")
    console.log()
    return 1
  }

  const detected = detectCurrentConfig()
  const isUpdate = detected.isInstalled

  printHeader(isUpdate)

  const totalSteps = 6
  let step = 1

  printStep(step++, totalSteps, "Checking OpenCode installation...")
  const installed = await isOpenCodeInstalled()
  if (!installed) {
    printError("OpenCode is not installed on this system.")
    printInfo("Visit https://opencode.ai/docs for installation instructions")
    return 1
  }

  const version = await getOpenCodeVersion()
  printSuccess(`OpenCode ${version ?? ""} detected`)

  if (isUpdate) {
    const initial = detectedToInitialValues(detected)
    printInfo(`Current config: Claude=${initial.claude}, Gemini=${initial.gemini}`)
  }

  const config = argsToConfig(args)

  printStep(step++, totalSteps, "Adding oh-my-opencode plugin...")
  const pluginResult = await addPluginToOpenCodeConfig(VERSION)
  if (!pluginResult.success) {
    printError(`Failed: ${pluginResult.error}`)
    return 1
  }
  printSuccess(`Plugin ${isUpdate ? "verified" : "added"} ${SYMBOLS.arrow} ${color.dim(pluginResult.configPath)}`)

  if (config.hasGemini) {
    printStep(step++, totalSteps, "Adding auth plugins...")
    const authResult = await addAuthPlugins(config)
    if (!authResult.success) {
      printError(`Failed: ${authResult.error}`)
      return 1
    }
    printSuccess(`Auth plugins configured ${SYMBOLS.arrow} ${color.dim(authResult.configPath)}`)

    printStep(step++, totalSteps, "Adding provider configurations...")
    const providerResult = addProviderConfig(config)
    if (!providerResult.success) {
      printError(`Failed: ${providerResult.error}`)
      return 1
    }
    printSuccess(`Providers configured ${SYMBOLS.arrow} ${color.dim(providerResult.configPath)}`)
  } else {
    step += 2
  }

  printStep(step++, totalSteps, "Writing oh-my-opencode configuration...")
  const omoResult = writeOmoConfig(config)
  if (!omoResult.success) {
    printError(`Failed: ${omoResult.error}`)
    return 1
  }
  printSuccess(`Config written ${SYMBOLS.arrow} ${color.dim(omoResult.configPath)}`)

  printBox(formatConfigSummary(config), isUpdate ? "Updated Configuration" : "Installation Complete")

  if (!config.hasClaude) {
    console.log()
    console.log(color.bgRed(color.white(color.bold(" ⚠️  CRITICAL WARNING "))))
    console.log()
    console.log(color.red(color.bold("  Sisyphus agent is STRONGLY optimized for Claude Opus 4.5.")))
    console.log(color.red("  Without Claude, you may experience significantly degraded performance:"))
    console.log(color.dim("    • Reduced orchestration quality"))
    console.log(color.dim("    • Weaker tool selection and delegation"))
    console.log(color.dim("    • Less reliable task completion"))
    console.log()
    console.log(color.yellow("  Consider subscribing to Claude Pro/Max for the best experience."))
    console.log()
  }

  if (!config.hasClaude && !config.hasOpenAI && !config.hasGemini && !config.hasCopilot && !config.hasOpencodeZen) {
    printWarning("No model providers configured. Using opencode/glm-4.7-free as fallback.")
  }

  console.log(`${SYMBOLS.star} ${color.bold(color.green(isUpdate ? "Configuration updated!" : "Installation complete!"))}`)
  console.log(`  Run ${color.cyan("opencode")} to start!`)
  console.log()

  printBox(
    `${color.bold("Pro Tip:")} Include ${color.cyan("ultrawork")} (or ${color.cyan("ulw")}) in your prompt.\n` +
    `All features work like magic—parallel agents, background tasks,\n` +
    `deep exploration, and relentless execution until completion.`,
    "🪄 The Magic Word"
  )

  console.log(`${SYMBOLS.star} ${color.yellow("If you found this helpful, consider starring the repo!")}`)
  console.log(`  ${color.dim("gh repo star code-yeongyu/oh-my-opencode")}`)
  console.log()
  console.log(color.dim("oMoMoMoMo... Enjoy!"))
  console.log()

  if ((config.hasClaude || config.hasGemini || config.hasCopilot) && !args.skipAuth) {
    printBox(
      `Run ${color.cyan("opencode auth login")} and select your provider:\n` +
      (config.hasClaude ? `  ${SYMBOLS.bullet} Anthropic ${color.gray("→ Claude Pro/Max")}\n` : "") +
      (config.hasGemini ? `  ${SYMBOLS.bullet} Google ${color.gray("→ OAuth with Antigravity")}\n` : "") +
      (config.hasCopilot ? `  ${SYMBOLS.bullet} GitHub ${color.gray("→ Copilot")}` : ""),
      "🔐 Authenticate Your Providers"
    )
  }

  return 0
}

export async function install(args: InstallArgs): Promise<number> {
  if (!args.tui) {
    return runNonTuiInstall(args)
  }

  const detected = detectCurrentConfig()
  const isUpdate = detected.isInstalled

  p.intro(color.bgMagenta(color.white(isUpdate ? " oMoMoMoMo... Update " : " oMoMoMoMo... ")))

  if (isUpdate) {
    const initial = detectedToInitialValues(detected)
    p.log.info(`Existing configuration detected: Claude=${initial.claude}, Gemini=${initial.gemini}`)
  }

  const s = p.spinner()
  s.start("Checking OpenCode installation")

  const installed = await isOpenCodeInstalled()
  if (!installed) {
    s.stop("OpenCode is not installed")
    p.log.error("OpenCode is not installed on this system.")
    p.note("Visit https://opencode.ai/docs for installation instructions", "Installation Guide")
    p.outro(color.red("Please install OpenCode first."))
    return 1
  }

  const version = await getOpenCodeVersion()
  s.stop(`OpenCode ${version ?? "installed"} ${color.green("✓")}`)

  const config = await runTuiMode(detected)
  if (!config) return 1

  s.start("Adding oh-my-opencode to OpenCode config")
  const pluginResult = await addPluginToOpenCodeConfig(VERSION)
  if (!pluginResult.success) {
    s.stop(`Failed to add plugin: ${pluginResult.error}`)
    p.outro(color.red("Installation failed."))
    return 1
  }
  s.stop(`Plugin added to ${color.cyan(pluginResult.configPath)}`)

  if (config.hasGemini) {
    s.start("Adding auth plugins (fetching latest versions)")
    const authResult = await addAuthPlugins(config)
    if (!authResult.success) {
      s.stop(`Failed to add auth plugins: ${authResult.error}`)
      p.outro(color.red("Installation failed."))
      return 1
    }
    s.stop(`Auth plugins added to ${color.cyan(authResult.configPath)}`)

    s.start("Adding provider configurations")
    const providerResult = addProviderConfig(config)
    if (!providerResult.success) {
      s.stop(`Failed to add provider config: ${providerResult.error}`)
      p.outro(color.red("Installation failed."))
      return 1
    }
    s.stop(`Provider config added to ${color.cyan(providerResult.configPath)}`)
  }

  s.start("Writing oh-my-opencode configuration")
  const omoResult = writeOmoConfig(config)
  if (!omoResult.success) {
    s.stop(`Failed to write config: ${omoResult.error}`)
    p.outro(color.red("Installation failed."))
    return 1
  }
  s.stop(`Config written to ${color.cyan(omoResult.configPath)}`)

  if (!config.hasClaude) {
    console.log()
    console.log(color.bgRed(color.white(color.bold(" ⚠️  CRITICAL WARNING "))))
    console.log()
    console.log(color.red(color.bold("  Sisyphus agent is STRONGLY optimized for Claude Opus 4.5.")))
    console.log(color.red("  Without Claude, you may experience significantly degraded performance:"))
    console.log(color.dim("    • Reduced orchestration quality"))
    console.log(color.dim("    • Weaker tool selection and delegation"))
    console.log(color.dim("    • Less reliable task completion"))
    console.log()
    console.log(color.yellow("  Consider subscribing to Claude Pro/Max for the best experience."))
    console.log()
  }

  if (!config.hasClaude && !config.hasOpenAI && !config.hasGemini && !config.hasCopilot && !config.hasOpencodeZen) {
    p.log.warn("No model providers configured. Using opencode/glm-4.7-free as fallback.")
  }

  p.note(formatConfigSummary(config), isUpdate ? "Updated Configuration" : "Installation Complete")

  p.log.success(color.bold(isUpdate ? "Configuration updated!" : "Installation complete!"))
  p.log.message(`Run ${color.cyan("opencode")} to start!`)

  p.note(
    `Include ${color.cyan("ultrawork")} (or ${color.cyan("ulw")}) in your prompt.\n` +
    `All features work like magic—parallel agents, background tasks,\n` +
    `deep exploration, and relentless execution until completion.`,
    "🪄 The Magic Word"
  )

  p.log.message(`${color.yellow("★")} If you found this helpful, consider starring the repo!`)
  p.log.message(`  ${color.dim("gh repo star code-yeongyu/oh-my-opencode")}`)

  p.outro(color.green("oMoMoMoMo... Enjoy!"))

  if ((config.hasClaude || config.hasGemini || config.hasCopilot) && !args.skipAuth) {
    const providers: string[] = []
    if (config.hasClaude) providers.push(`Anthropic ${color.gray("→ Claude Pro/Max")}`)
    if (config.hasGemini) providers.push(`Google ${color.gray("→ OAuth with Antigravity")}`)
    if (config.hasCopilot) providers.push(`GitHub ${color.gray("→ Copilot")}`)

    console.log()
    console.log(color.bold("🔐 Authenticate Your Providers"))
    console.log()
    console.log(`   Run ${color.cyan("opencode auth login")} and select:`)
    for (const provider of providers) {
      console.log(`   ${SYMBOLS.bullet} ${provider}`)
    }
    console.log()
  }

  return 0
}
