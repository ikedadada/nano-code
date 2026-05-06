import { describe, expect, test } from "bun:test"
import { execCommand } from "@/infrastructure/tools/execCommand"

describe("execCommand", () => {
  test("rejects dangerous shell characters", async () => {
    await expect(
      execCommand.execute({ command: "ls; echo unsafe" }),
    ).rejects.toThrow("dangerous characters")
  })

  test("rejects commands outside the allowlist", async () => {
    await expect(
      execCommand.execute({ command: "cat package.json" }),
    ).rejects.toThrow('Command "cat" is not allowed')
  })

  test("executes an allowed command without a shell", async () => {
    await expect(
      execCommand.execute({ commandName: "bun", commandArgs: ["--version"] }),
    ).resolves.toMatch(/^\d+\.\d+\.\d+/)
  })
})
