import { afterEach, describe, expect, test } from "bun:test"
import { createModelFromEnv } from "@/infrastructure/llm/providers/modelFactory"

const originalEnv = {
  LLM_PROVIDER: process.env.LLM_PROVIDER,
  LLM_MODEL: process.env.LLM_MODEL,
  LLM_API_KEY: process.env.LLM_API_KEY,
}

afterEach(() => {
  process.env.LLM_PROVIDER = originalEnv.LLM_PROVIDER
  process.env.LLM_MODEL = originalEnv.LLM_MODEL
  process.env.LLM_API_KEY = originalEnv.LLM_API_KEY
})

describe("createModelFromEnv", () => {
  test("requires a provider", () => {
    delete process.env.LLM_PROVIDER
    process.env.LLM_MODEL = "model"

    expect(() => createModelFromEnv()).toThrow(
      "LLM_PROVIDER environment variable is not set",
    )
  })

  test("rejects unsupported providers", () => {
    process.env.LLM_PROVIDER = "unsupported"
    process.env.LLM_MODEL = "model"

    expect(() => createModelFromEnv()).toThrow(
      "Unsupported LLM provider: unsupported",
    )
  })
})
