/* -- Tool Types -- */
export type Tool = {
  name: string
  description: string
  needsApproval: boolean
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>) => Promise<string>
}

export type ToolCall = {
  toolCallId: string
  name: string
  args: Record<string, unknown>
}

export type ToolResult = {
  toolCallId: string
  result: string
}

/* -- Message Types -- */
type UserMessage = {
  role: "user"
  content: string
}

type SystemMessage = {
  role: "system"
  content: string
}

type AssistantMessage = {
  role: "assistant"
  content: string
  toolCalls: ToolCall[]
}

type ToolMessage = {
  role: "tool"
  toolCallId: string
  name: string
  content: string
}

export type Message =
  | UserMessage
  | SystemMessage
  | AssistantMessage
  | ToolMessage

/* -- Usage Types -- */
export type Usage = {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

/* -- NanoCodeCore Types -- */
export type GenerateTextResult = {
  text: string
  finishReason: "stop" | "length" | "content_filter" | "tool_call" | "error"
  toolCalls: ToolCall[]
  usage: Usage
}

export type GenerateParams = {
  messages: Message[]
  tools: Tool[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal // for timeout or cancellation
}

export interface StreamChunk {
  kind: "delta" | "event" | "done"
  text?: string
  finishReason?: "stop" | "length" | "content_filter" | "tool_call" | "error"
  toolCalls: ToolCall[]
  usage: Usage
  error?: unknown
}

export interface LanguageModel {
  doGenerate(params: GenerateParams): Promise<GenerateTextResult>
  doStream(params: GenerateParams): AsyncIterable<StreamChunk>
}

export type Provider = (modelId: string) => LanguageModel

/* -- NanoCodeCore Error Types -- */
export class LLMApiError extends Error {
  constructor(
    public status: number,
    public provider: string,
    public code?: string,
    message?: string,
    public raw?: unknown,
  ) {
    super(
      message || `LLM API Error: ${provider} responded with status ${status}`,
    )
    this.name = "LLMApiError"
  }
}
