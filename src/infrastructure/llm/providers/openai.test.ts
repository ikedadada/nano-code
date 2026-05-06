import { describe, expect, mock, test } from "bun:test"

const createMock = mock(async () => ({
  choices: [
    {
      message: {
        content: "hello",
        tool_calls: [
          {
            id: "call-1",
            type: "function",
            function: { name: "readFile", arguments: '{"path":"a.txt"}' },
          },
        ],
      },
      finish_reason: "tool_calls",
    },
  ],
  usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
}))

mock.module("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: createMock } }
  },
  APIError: class APIError extends Error {},
}))

const { createOpenAI } = await import("@/infrastructure/llm/providers/openai")

describe("createOpenAI", () => {
  test("maps domain messages, tools, and responses", async () => {
    const model = createOpenAI({ apiKey: "test-key" })("gpt-test")
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
      model: "gpt-test",
      messages: [
        { role: "system", content: "system" },
        {
          role: "assistant",
          content: "using tool",
          tool_calls: [
            {
              id: "call-0",
              type: "function",
              function: {
                name: "readFile",
                arguments: '{"path":"a.txt"}',
              },
            },
          ],
        },
        {
          role: "tool",
          tool_call_id: "call-0",
          content: "file content",
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "readFile",
            description: "Read a file",
            parameters: { type: "object" },
          },
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
