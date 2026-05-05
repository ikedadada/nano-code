import Anthropic, { APIError } from "@anthropic-ai/sdk"
import type {
  ContentBlockParam,
  MessageParam,
  StopReason,
  ToolUnion,
} from "@anthropic-ai/sdk/resources"
import { parseJsonObject } from "../../helper"
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

type CreateAnthropicConfig = {
  apiKey?: string
  maxRetries?: number
}

export const createAnthropic = (config?: CreateAnthropicConfig): Provider => {
  const client = new Anthropic({
    apiKey: config?.apiKey,
    maxRetries: config?.maxRetries || 0,
  })

  return (modelId: string): LanguageModel => ({
    async doGenerate(params: GenerateParams): Promise<GenerateTextResult> {
      /* Anthropic-specific logic */
      const system = params.messages
        .filter((message) => message.role === "system")
        .map((message) => ({
          type: "text" as const,
          text: message.content,
        }))

      const tools: ToolUnion[] = params.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }))

      try {
        const completion = await client.messages.create(
          {
            model: modelId,
            system,
            messages: convertMessages(params.messages),
            temperature: params.temperature,
            max_tokens: params.maxTokens || 4096,
            ...(tools.length > 0 && { tools }),
          },
          {
            signal: params.signal,
          },
        )

        const text = completion.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("")

        const toolCalls: ToolCall[] = completion.content
          .filter((block) => block.type === "tool_use")
          .map((block) => ({
            toolCallId: block.id,
            name: block.name,
            args: toRecord(block.input),
          }))

        return {
          text,
          finishReason: mapFinishReason(completion.stop_reason),
          toolCalls: toolCalls,
          usage: {
            promptTokens: completion.usage.input_tokens,
            completionTokens: completion.usage.output_tokens,
            totalTokens:
              (completion.usage.input_tokens ?? 0) +
              completion.usage.output_tokens,
          },
        }
      } catch (error: unknown) {
        if (error instanceof APIError) {
          throw new LLMApiError(
            error.status ?? 500,
            "anthropic",
            error.error?.type,
            error.message,
            error,
          )
        } else {
          throw new LLMApiError(
            500,
            "anthropic",
            undefined,
            "An unknown error occurred",
            error,
          )
        }
      }
    },

    async *doStream(params: GenerateParams): AsyncIterable<StreamChunk> {
      /* Anthropic-specific logic */
      const system = params.messages
        .filter((message) => message.role === "system")
        .map((message) => ({
          type: "text" as const,
          text: message.content,
        }))

      const tools: ToolUnion[] = params.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }))

      const stream = await client.messages.create(
        {
          model: modelId,
          system,
          messages: convertMessages(params.messages),
          temperature: params.temperature,
          max_tokens: params.maxTokens || 4096,
          stream: true,
          ...(tools.length > 0 && { tools }),
        },
        {
          signal: params.signal,
        },
      )

      const toolCallBuffer: Record<string, ToolCall> = {}
      const partialJsonBuffer: Record<string, string> = {}
      const indexToId: Record<number, string> = {}
      let finishReason: StreamChunk["finishReason"]
      let usage: StreamChunk["usage"] = {}

      for await (const event of stream) {
        switch (event.type) {
          case "content_block_start":
            if (event.content_block.type === "tool_use") {
              const id = event.content_block.id
              indexToId[event.index] = id
              toolCallBuffer[id] = {
                toolCallId: id,
                name: event.content_block.name,
                args: {},
              }
              partialJsonBuffer[id] = ""
            }
            break

          case "content_block_delta":
            if (event.delta?.type === "text_delta") {
              yield {
                kind: "delta",
                text: event.delta.text,
                toolCalls: [],
                usage: {},
              }
            }

            if (event.delta?.type === "input_json_delta") {
              const id = indexToId[event.index]
              if (id) {
                partialJsonBuffer[id] += event.delta.partial_json
                try {
                  if (toolCallBuffer[id]) {
                    toolCallBuffer[id].args = parseJsonObject(
                      partialJsonBuffer[id] ?? "",
                    )
                  }
                } catch {
                  /**Failed to parse partial JSON, wait for nextchunk */
                }
              }
            }
            break

          case "message_delta":
            if (event.delta?.stop_reason) {
              finishReason = mapFinishReason(event.delta?.stop_reason)
            }
            if (event.usage) {
              usage = {
                promptTokens: event.usage.input_tokens ?? 0,
                completionTokens: event.usage.output_tokens,
                totalTokens:
                  (event.usage.input_tokens ?? 0) + event.usage.output_tokens,
              }
            }
            break

          case "message_stop": {
            const toolCalls = Object.values(toolCallBuffer)

            yield {
              kind: "done",
              toolCalls,
              finishReason,
              usage,
            }
            break
          }
        }
      }
    },
  })
}

/* -- Helper Functions -- */
const convertMessages = (messages: Message[]): MessageParam[] => {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      switch (message.role) {
        case "tool":
          return {
            role: "user" as const,
            content: [
              {
                type: "tool_result" as const,
                tool_use_id: message.toolCallId,
                content: message.content,
              },
            ],
          }
        case "assistant":
          if (message.toolCalls) {
            const content: ContentBlockParam[] = []
            if (message.content) {
              content.push({
                type: "text" as const,
                text: message.content,
              })
            }
            for (const call of message.toolCalls) {
              content.push({
                type: "tool_use" as const,
                id: call.toolCallId,
                name: call.name,
                input: call.args,
              })
            }
            return {
              role: "assistant" as const,
              content,
            }
          }
          return {
            role: "assistant" as const,
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

const toRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

const mapFinishReason = (
  reason: StopReason | null,
): GenerateTextResult["finishReason"] => {
  switch (reason) {
    case "end_turn":
      return "stop"
    case "max_tokens":
      return "length"
    case "tool_use":
      return "tool_call"
    case "refusal":
      return "content_filter"
    default:
      return "stop"
  }
}
