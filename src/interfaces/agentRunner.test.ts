import { afterEach, describe, expect, test } from "bun:test"
import { config } from "@/config"
import { runAgent } from "@/interfaces/agentRunner"

const originalConfig = {
  sandbox: config.sandbox,
  allowedDomains: [...config.allowedDomains],
}

const originalEnv = {
  LLM_PROVIDER: process.env.LLM_PROVIDER,
  LLM_MODEL: process.env.LLM_MODEL,
}

const restoreEnv = (key: keyof typeof originalEnv) => {
  const value = originalEnv[key]
  if (value === undefined) {
    delete process.env[key]
    return
  }

  process.env[key] = value
}

afterEach(() => {
  config.sandbox = originalConfig.sandbox
  config.allowedDomains = [...originalConfig.allowedDomains]

  restoreEnv("LLM_PROVIDER")
  restoreEnv("LLM_MODEL")
})

describe("runAgent", () => {
  test("applies runtime configuration before creating the model", async () => {
    process.env.LLM_PROVIDER = "unsupported"
    process.env.LLM_MODEL = "model"

    await expect(
      runAgent({
        prompt: "hello",
        issueDriven: false,
        verbose: false,
        streaming: false,
        yolo: false,
        sandbox: true,
        allowedDomains: ["example.com"],
        workspaceRoot: "workspace",
      }),
    ).rejects.toThrow("Unsupported LLM provider")

    expect(config.sandbox).toBe(true)
    expect(config.allowedDomains).toContain("example.com")
  })
})
