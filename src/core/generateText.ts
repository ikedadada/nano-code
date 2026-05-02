import type { GenerateParams, GenerateTextResult, LanguageModel } from "./types"

type GenerateTextParams = GenerateParams & {
  model: LanguageModel
}

export const generateText = async (
  params: GenerateTextParams,
): Promise<GenerateTextResult> => {
  return await params.model.doGenerate(params)
}
