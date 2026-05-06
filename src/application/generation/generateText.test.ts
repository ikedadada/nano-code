import { describe, expect, test } from "bun:test"
import { collectStreamResult } from "@/application/generation/generateText"
import type { LanguageModel, StreamChunk } from "@/domain/types"

describe("collectStreamResult", () => {
  test("collects streamed text, tool calls, finish reason, and usage", async () => {
    const chunks: StreamChunk[] = [
      { kind: "delta", text: "hello", toolCalls: [], usage: {} },
      { kind: "delta", text: " world", toolCalls: [], usage: {} },
      {
        kind: "done",
        finishReason: "tool_call",
        toolCalls: [{ toolCallId: "call-1", name: "readFile", args: {} }],
        usage: { totalTokens: 12 },
      },
    ]

    const model: LanguageModel = {
      async doGenerate() {
        throw new Error("doGenerate should not be called")
      },
      async *doStream() {
        yield* chunks
      },
    }

    const seen: StreamChunk[] = []
    const result = await collectStreamResult({
      model,
      messages: [],
      tools: [],
      onChunk: (chunk) => seen.push(chunk),
    })

    expect(result).toEqual({
      text: "hello world",
      finishReason: "tool_call",
      toolCalls: [{ toolCallId: "call-1", name: "readFile", args: {} }],
      usage: { totalTokens: 12 },
    })
    expect(seen).toEqual(chunks)
  })
})
