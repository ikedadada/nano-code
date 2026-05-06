import { describe, expect, test } from "bun:test"
import { LLMApiError } from "@/domain/types"

describe("LLMApiError", () => {
  test("keeps provider metadata and uses a default message", () => {
    const raw = { requestId: "req-1" }
    const error = new LLMApiError(429, "openai", "rate_limit", undefined, raw)

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("LLMApiError")
    expect(error.message).toBe(
      "LLM API Error: openai responded with status 429",
    )
    expect(error.status).toBe(429)
    expect(error.provider).toBe("openai")
    expect(error.code).toBe("rate_limit")
    expect(error.raw).toBe(raw)
  })
})
