import { describe, expect, mock, test } from "bun:test"

const generateContentMock = mock(async () => ({
  candidates: [
    {
      finishReason: "STOP",
      content: {
        parts: [
          { text: "hello" },
          { functionCall: { name: "readFile", args: { path: "a.txt" } } },
        ],
      },
    },
  ],
  usageMetadata: {
    promptTokenCount: 1,
    candidatesTokenCount: 2,
    totalTokenCount: 3,
  },
}))

mock.module("@google/genai", () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = { generateContent: generateContentMock }
  },
  ApiError: class ApiError extends Error {},
}))

const { createGoogle } = await import("@/infrastructure/llm/providers/google")

describe("createGoogle", () => {
  test("maps domain messages, tools, and responses", async () => {
    const model = createGoogle({ apiKey: "test-key" })("gemini-test")
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

    const request = (generateContentMock.mock.calls as unknown[][])[0]?.[0]
    expect(request).toMatchObject({
      model: "gemini-test",
      contents: [
        {
          role: "model",
          parts: [
            { text: "using tool" },
            { functionCall: { name: "readFile", args: { path: "a.txt" } } },
          ],
        },
        {
          role: "tool",
          parts: [
            {
              functionResponse: {
                name: "readFile",
                response: { result: { result: "file content" } },
              },
            },
          ],
        },
      ],
      config: {
        systemInstruction: "system",
        tools: [
          {
            functionDeclarations: [
              {
                name: "readFile",
                description: "Read a file",
                parametersJsonSchema: { type: "object" },
              },
            ],
          },
        ],
      },
    })
    expect(result).toEqual({
      text: "hello",
      finishReason: "tool_call",
      toolCalls: [
        { toolCallId: "call_0", name: "readFile", args: { path: "a.txt" } },
      ],
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    })
  })
})
