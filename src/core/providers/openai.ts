import OpenAI, { APIError } from "openai"
import type { ChatCompletionMessageParam } from "openai/resources"
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

type CreateOpenAIConfig = {
  apiKey?: string
  baseURL?: string
  maxRetries?: number
}

export const createOpenAI = (config?: CreateOpenAIConfig): Provider => {
  const client = new OpenAI({
    apiKey: config?.apiKey,
    baseURL: config?.baseURL,
    maxRetries: config?.maxRetries || 0,
  })

  return (modelId: string): LanguageModel => ({
    async doGenerate(params: GenerateParams): Promise<GenerateTextResult> {
      const tools = params.tools.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }))

      try {
        const completion = await client.chat.completions.create(
          {
            model: modelId,
            messages: convertMessages(params.messages),
            temperature: params.temperature,
            max_tokens: params.maxTokens,
            ...(tools.length > 0 && { tools }),
          },
          {
            signal: params.signal,
          },
        )

        const choice = completion.choices[0]

        if (!choice) {
          throw new LLMApiError(
            500,
            "openai",
            undefined,
            "No choices returned from OpenAI API",
            completion,
          )
        }

        const message = choice.message

        const toolCalls: ToolCall[] =
          message.tool_calls
            ?.filter((call) => {
              return call.type === "function"
            })
            .map((call) => ({
              toolCallId: call.id,
              name: call.function.name,
              args: JSON.parse(call.function.arguments),
            })) || []

        return {
          text: choice.message.content || "",
          finishReason: mapFinishReason(choice.finish_reason),
          toolCalls,
          usage: {
            promptTokens: completion.usage?.prompt_tokens,
            completionTokens: completion.usage?.completion_tokens,
            totalTokens: completion.usage?.total_tokens,
          },
        }
      } catch (error: unknown) {
        if (error instanceof APIError) {
          throw new LLMApiError(
            error.status ?? 500,
            "openai",
            error.code ?? undefined,
            error.message,
            error,
          )
        } else {
          throw new LLMApiError(
            500,
            "openai",
            undefined,
            "An unknown error occurred",
            error,
          )
        }
      }
    },

    async *doStream(params: GenerateParams): AsyncIterable<StreamChunk> {
      const tools = params.tools.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }))

      const stream = await client.chat.completions.create(
        {
          model: modelId,
          messages: convertMessages(params.messages),
          temperature: params.temperature,
          max_tokens: params.maxTokens,
          stream: true,
          stream_options: { include_usage: true },
          ...(tools.length > 0 && { tools }),
        },
        {
          signal: params.signal,
        },
      )

      const toolCallBuffer: Record<
        string,
        { id: string; name: string; argsText: string }
      > = {}
      let finishReason: StreamChunk["finishReason"]
      let usage: StreamChunk["usage"] = {}

      for await (const chunk of stream) {
        const choice = chunk.choices?.[0]

        if (choice?.delta?.content) {
          yield {
            kind: "delta",
            text: choice.delta.content,
            toolCalls: [],
            usage: {},
          }
        }

        if (choice?.delta?.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            const key = tc.id || String(tc.index)
            const existing = toolCallBuffer[key] || {
              id: "",
              name: "",
              argsText: "",
            }
            if (tc.id) existing.id = tc.id
            if (tc.function?.name) existing.name = tc.function.name
            if (tc.function?.arguments)
              existing.argsText += tc.function.arguments
            toolCallBuffer[key] = existing
          }
        }

        if (choice?.finish_reason) {
          finishReason = mapFinishReason(choice.finish_reason)
        }

        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          }
        }
      }

      const toolCalls = Object.values(toolCallBuffer).map((tc) => ({
        toolCallId: tc.id,
        name: tc.name,
        args: JSON.parse(tc.argsText),
      }))

      yield {
        kind: "done",
        finishReason,
        usage,
        toolCalls,
      }
    },
  })
}

/* -- Helper Functions -- */
const convertMessages = (messages: Message[]): ChatCompletionMessageParam[] => {
  return messages.map((message) => {
    switch (message.role) {
      case "tool":
        return {
          role: "tool",
          tool_call_id: message.toolCallId,
          content: message.content,
        }
      case "assistant":
        if (message.toolCalls) {
          return {
            role: "assistant",
            content: message.content,
            tool_calls: message.toolCalls.map((call) => ({
              id: call.toolCallId,
              type: "function" as const,
              function: {
                name: call.name,
                arguments: JSON.stringify(call.args),
              },
            })),
          }
        }
        return {
          role: "assistant",
          content: message.content,
        }
      default:
        return {
          role: message.role,
          content: message.content,
        }
    }
  })
}

const mapFinishReason = (
  reason: string | null,
): GenerateTextResult["finishReason"] => {
  switch (reason) {
    case "stop":
      return "stop"
    case "length":
      return "length"
    case "content_filter":
      return "content_filter"
    case "tool_call":
      return "tool_call"
    default:
      return "stop"
  }
}
