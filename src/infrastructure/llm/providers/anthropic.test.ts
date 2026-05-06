import { describe, expect, mock, test } from "bun:test"

const createMock = mock(async () => ({
  content: [
    { type: "text", text: "hello" },
    {
      type: "tool_use",
      id: "call-1",
      name: "readFile",
      input: { path: "a.txt" },
    },
  ],
  stop_reason: "tool_use",
  usage: { input_tokens: 1, output_tokens: 2 },
}))

mock.module("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock }
  },
  APIError: class APIError extends Error {},
}))

const { createAnthropic } = await import(
  "@/infrastructure/llm/providers/anthropic"
)

describe("createAnthropic", () => {
  test("maps domain messages, tools, and responses", async () => {
    const model = createAnthropic({ apiKey: "test-key" })("claude-test")
    const result = await model.doGenerate({
      messages: [
        { role: "system", content: "system" },
        {
          role: "assistant",
          content: "using tool",
          toolCalls: [
            {
              toolCallId: "call-0",
              name: "readFile",
              args: { path: "a.txt" },
            },
          ],
        },
        {
          role: "tool",
          toolCallId: "call-0",
          name: "readFile",
          content: "file content",
        },
      ],
      tools: [
        {
          name: "readFile",
          description: "Read a file",
          needsApproval: false,
          parameters: { type: "object" },
          execute: async () => "",
        },
      ],
    })

    const request = (createMock.mock.calls as unknown[][])[0]?.[0]
    expect(request).toMatchObject({
      model: "claude-test",
      system: [{ type: "text", text: "system" }],
      messages: [
        {
          role: "assistant",
          content: [
            { type: "text", text: "using tool" },
            {
              type: "tool_use",
              id: "call-0",
              name: "readFile",
              input: { path: "a.txt" },
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "call-0",
              content: "file content",
            },
          ],
        },
      ],
      tools: [
        {
          name: "readFile",
          description: "Read a file",
          input_schema: { type: "object" },
        },
      ],
    })
    expect(result).toEqual({
      text: "hello",
      finishReason: "tool_call",
      toolCalls: [
        { toolCallId: "call-1", name: "readFile", args: { path: "a.txt" } },
      ],
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    })
  })
})
