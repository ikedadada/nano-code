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

afterEach(() => {
  config.sandbox = originalConfig.sandbox
  config.allowedDomains = [...originalConfig.allowedDomains]

  process.env.LLM_PROVIDER = originalEnv.LLM_PROVIDER
  process.env.LLM_MODEL = originalEnv.LLM_MODEL
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
