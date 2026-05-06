import { afterEach, describe, expect, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { loadInstructions } from "@/infrastructure/prompts"

const workspaceRoot = path.resolve(process.cwd(), "workspace/test-prompts")

afterEach(async () => {
  await fs.rm(workspaceRoot, { recursive: true, force: true })
})

describe("loadInstructions", () => {
  test("includes project instructions when AGENTS.md exists", async () => {
    await fs.mkdir(workspaceRoot, { recursive: true })
    await fs.writeFile(path.join(workspaceRoot, "AGENTS.md"), "Project rule")

    const instructions = loadInstructions(workspaceRoot, false)

    expect(instructions).toContain("You are a TypeScript coding agent.")
    expect(instructions).toContain("# Project-Specific Instructions")
    expect(instructions).toContain("Project rule")
  })

  test("includes issue workflow instructions for issue-driven runs", () => {
    const instructions = loadInstructions(workspaceRoot, true)

    expect(instructions).toContain("running on GitHub Actions")
    expect(instructions).toContain("Create a TODO List")
  })
})
