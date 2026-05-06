import { describe, expect, test } from "bun:test"
import { createBranch, pushBranch } from "@/infrastructure/tools/git"

describe("git tools", () => {
  test("reject createBranch names with whitespace before running git", async () => {
    await expect(
      createBranch.execute({ branchName: "bad branch" }),
    ).rejects.toThrow("Branch name cannot contain whitespace")
  })

  test("reject pushBranch names with unsafe prefixes before running git", async () => {
    await expect(
      pushBranch.execute({ branchName: "-bad-branch" }),
    ).rejects.toThrow("Branch name cannot start")
  })
})
