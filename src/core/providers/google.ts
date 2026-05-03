import type { ContentListUnion, Part, ToolListUnion } from "@google/genai"
import { ApiError, GoogleGenAI } from "@google/genai"
import type {
  GenerateParams,
  GenerateTextResult,
  LanguageModel,
  Message,
  Provider,
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

      const tools = [
        {
          functionDeclarations: params.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
        },
      ] as ToolListUnion

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
