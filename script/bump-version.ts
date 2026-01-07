#!/usr/bin/env bun

import { $ } from "bun"

const PACKAGE_NAME = "oh-my-opencode"
const bump = process.env.BUMP as "major" | "minor" | "patch" | undefined
const versionOverride = process.env.VERSION

console.log("=== Bumping oh-my-opencode version ===\n")

async function fetchPreviousVersion(): Promise<string> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`)
    if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`)
    const data = (await res.json()) as { version: string }
    console.log(`Previous npm version: ${data.version}`)
    return data.version
  } catch {
    console.log("No previous version found on npm, starting from 0.0.0")
    return "0.0.0"
  }
}

function bumpVersion(version: string, type: "major" | "minor" | "patch"): string {
  const [major, minor, patch] = version.split(".").map(Number)
  switch (type) {
    case "major":
      return `${major + 1}.0.0`
    case "minor":
      return `${major}.${minor + 1}.0`
    case "patch":
      return `${major}.${minor}.${patch + 1}`
  }
}

async function updatePackageVersion(newVersion: string): Promise<void> {
  const pkgPath = new URL("../package.json", import.meta.url).pathname
  let pkg = await Bun.file(pkgPath).text()
  pkg = pkg.replace(/"version": "[^"]+"/, `"version": "${newVersion}"`)
  await Bun.file(pkgPath).write(pkg)
  console.log(`Updated package.json version to: ${newVersion}`)
}

async function checkVersionExists(version: string): Promise<boolean> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}/${version}`)
    return res.ok
  } catch {
    return false
  }
}

async function main() {
  const previous = await fetchPreviousVersion()
  const newVersion = versionOverride || (bump ? bumpVersion(previous, bump) : bumpVersion(previous, "patch"))
  console.log(`New version: ${newVersion}\n`)

  if (await checkVersionExists(newVersion)) {
    console.log(`Version ${newVersion} already exists on npm. Skipping bump.`)
    process.exit(0)
  }

  await updatePackageVersion(newVersion)

  console.log(`\n=== Successfully bumped version to ${newVersion} ===`)
  console.log(`New version will be embedded in the next build.`)
}

main()
