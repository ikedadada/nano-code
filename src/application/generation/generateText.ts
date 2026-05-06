import type {
  GenerateParams,
  GenerateTextResult,
  LanguageModel,
  StreamChunk,
  ToolCall,
} from "../../domain/types"

type GenerateTextParams = GenerateParams & {
  model: LanguageModel
}

export const generateText = async (
  params: GenerateTextParams,
): Promise<GenerateTextResult> => {
  return await params.model.doGenerate(params)
}

export async function* generateStreamText(
  params: GenerateTextParams,
): AsyncIterable<StreamChunk> {
  yield* params.model.doStream(params)
}

export const collectStreamResult = async (
  params: GenerateTextParams & {
    onChunk?: (chunk: StreamChunk) => void
  },
): Promise<GenerateTextResult> => {
  let text = ""
  let finishReason: StreamChunk["finishReason"]
  let usage: StreamChunk["usage"] = {}
  let toolCalls: ToolCall[] = []

  for await (const chunk of generateStreamText(params)) {
    params.onChunk?.(chunk)
    if (chunk.kind === "delta" && chunk.text) {
      text += chunk.text
    }
    if (chunk.kind === "done") {
      finishReason = chunk.finishReason
      toolCalls = chunk.toolCalls
      usage = chunk.usage
    }
  }

  return { text, finishReason: finishReason ?? "stop", toolCalls, usage }
}
