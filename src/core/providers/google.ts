import type { ContentListUnion, Part, ToolListUnion } from "@google/genai"
import { ApiError, GoogleGenAI } from "@google/genai"
import type {
  GenerateParams,
  GenerateTextResult,
  LanguageModel,
  Message,
  Provider,
  StreamChunk,
  ToolCall,
} from "../types"
import { LLMApiError } from "../types"

type CreateGoogleConfig = {
  apiKey?: string
}

export const createGoogle = (config?: CreateGoogleConfig): Provider => {
  const client = new GoogleGenAI({
    apiKey: config?.apiKey,
  })

  return (modelId: string): LanguageModel => ({
    async doGenerate(params: GenerateParams): Promise<GenerateTextResult> {
      const systemInstruction = params.messages
        .filter((message) => message.role === "system")
        .map((message) => message.content)
        .join("\n")

      const tools: ToolListUnion = [
        {
          functionDeclarations: params.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parametersJsonSchema: tool.parameters,
          })),
        },
      ]

      try {
        const response = await client.models.generateContent({
          model: modelId,
          contents: convertMessages(params.messages),
          config: {
            systemInstruction,
            temperature: params.temperature,
            maxOutputTokens: params.maxTokens,
            ...(tools.length > 0 && { tools }),
          },
        })

        const candidate = response.candidates?.[0]
        const parts = candidate?.content?.parts || []

        const text = parts
          .filter((part) => part.text)
          .map((part) => part.text)
          .join("")

        const toolCalls: ToolCall[] = parts
          .filter(
            (
              part,
            ): part is typeof part & {
              functionCall: NonNullable<typeof part.functionCall>
            } => part.functionCall !== undefined,
          )
          .map((part, i) => ({
            toolCallId: `call_${i}`, // Gemini API does not return an ID for tool calls
            name: part.functionCall.name ?? "unknown_tool",
            args: part.functionCall.args ?? {},
          }))

        return {
          text,
          finishReason: mapFinishReason(
            candidate?.finishReason,
            toolCalls.length > 0,
          ),
          toolCalls,
          usage: {
            promptTokens: response.usageMetadata?.promptTokenCount,
            completionTokens: response.usageMetadata?.candidatesTokenCount,
            totalTokens: response.usageMetadata?.totalTokenCount,
          },
        }
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          throw new LLMApiError(
            error.status ?? 500,
            "google",
            error.name ?? undefined,
            error.message,
            error,
          )
        } else {
          throw new LLMApiError(
            500,
            "google",
            undefined,
            "An unknown error occurred",
            error,
          )
        }
      }
    },

    async *doStream(params: GenerateParams): AsyncIterable<StreamChunk> {
      const systemInstruction = params.messages
        .filter((message) => message.role === "system")
        .map((message) => message.content)
        .join("\n")

      const tools: ToolListUnion = [
        {
          functionDeclarations: params.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parametersJsonSchema: tool.parameters,
          })),
        },
      ]

      const stream = await client.models.generateContentStream({
        model: modelId,
        contents: convertMessages(params.messages),
        config: {
          systemInstruction,
          temperature: params.temperature,
          maxOutputTokens: params.maxTokens,
          ...(tools.length > 0 && { tools }),
        },
      })

      const toolCallBuffer: Record<string, ToolCall> = {}
      let finishReason: StreamChunk["finishReason"]
      let usage: StreamChunk["usage"] = {}

      for await (const chunk of stream) {
        const candidate = chunk.candidates?.[0]

        const text = candidate?.content?.parts?.[0]?.text
        if (text) {
          yield { kind: "delta", text, toolCalls: [], usage: {} }
        }

        for (const part of candidate?.content?.parts || []) {
          if (part.functionCall?.name) {
            const id = part.functionCall.name
            toolCallBuffer[id] = {
              toolCallId: id,
              name: part.functionCall.name,
              args: part.functionCall.args || {},
            }
          }
        }

        if (candidate?.finishReason) {
          finishReason = mapFinishReason(
            candidate.finishReason,
            !!Object.keys(toolCallBuffer).length,
          )
        }

        if (chunk.usageMetadata) {
          usage = {
            promptTokens: chunk.usageMetadata?.promptTokenCount,
            completionTokens: chunk.usageMetadata?.candidatesTokenCount,
            totalTokens: chunk.usageMetadata?.totalTokenCount,
          }
        }
      }

      const toolCalls = Object.values(toolCallBuffer)
      yield {
        kind: "done",
        finishReason,
        toolCalls,
        usage,
      }
    },
  })
}

/* -- Helper Functions -- */
const convertMessages = (messages: Message[]): ContentListUnion => {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      switch (message.role) {
        case "tool":
          return {
            role: "tool",
            parts: [
              {
                functionResponse: {
                  name: message.name,
                  response: {
                    result: { result: message.content },
                  },
                },
              },
            ],
          }
        case "assistant":
          if (message.toolCalls) {
            const parts: Part[] = []
            if (message.content) {
              parts.push({ text: message.content })
            }
            for (const call of message.toolCalls) {
              parts.push({
                functionCall: {
                  name: call.name,
                  args: call.args,
                },
              })
            }
            return {
              role: "model" as const,
              parts,
            }
          }
          return {
            role: "model" as const,
            parts: [{ text: message.content }],
          }
        default:
          return {
            role: message.role,
            parts: [{ text: message.content }],
          }
      }
    })
}

const mapFinishReason = (
  reason: string | undefined,
  hasFunctionCall: boolean,
): GenerateTextResult["finishReason"] => {
  if (hasFunctionCall) return "tool_call"
  switch (reason?.toUpperCase()) {
    case "STOP":
      return "stop"
    case "MAX_TOKENS":
      return "length"
    case "SAFETY":
      return "content_filter"
    default:
      return "stop"
  }
}
