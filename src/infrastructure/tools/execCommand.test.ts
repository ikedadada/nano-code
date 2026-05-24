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

  test("rejects curl to keep network access behind webFetch policy", async () => {
    await expect(
      execCommand.execute({ command: "curl https://example.com" }),
    ).rejects.toThrow('Command "curl" is not allowed')
  })

  test("rejects bun interpreter execution", async () => {
    await expect(
      execCommand.execute({
        command: 'bun -e "console.log(1)"',
      }),
    ).rejects.toThrow('Command "bun" is restricted')
  })

  test("rejects bare bun because it starts an interactive runtime", async () => {
    await expect(
      execCommand.execute({
        command: "bun",
      }),
    ).rejects.toThrow('Command "bun" is restricted')
  })

  test("applies command policy to structured command args", async () => {
    await expect(
      execCommand.execute({
        commandName: "bun",
        commandArgs: ["-e", "console.log(1)"],
      }),
    ).rejects.toThrow('Command "bun" is restricted')
  })

  test("executes an allowed command without a shell", async () => {
    await expect(
      execCommand.execute({ commandName: "bun", commandArgs: ["--version"] }),
    ).resolves.toMatch(/^\d+\.\d+\.\d+/)
  })
})
