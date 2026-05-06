import type { LanguageModel } from "@/domain/types"
import { createAnthropic } from "@/infrastructure/llm/providers/anthropic"
import { createGoogle } from "@/infrastructure/llm/providers/google"
import { createOpenAI } from "@/infrastructure/llm/providers/openai"

export const createModelFromEnv = (): LanguageModel => {
  const provider = process.env.LLM_PROVIDER
  const modelName = process.env.LLM_MODEL
  const apiKey = process.env.LLM_API_KEY

  if (!provider) {
    throw new Error("LLM_PROVIDER environment variable is not set")
  }

  if (!modelName) {
    throw new Error("LLM_MODEL environment variable is not set")
  }

  switch (provider.toLowerCase()) {
    case "openai": {
      if (apiKey && !process.env.OPENAI_API_KEY) {
        process.env.OPENAI_API_KEY = apiKey
      }
      const openai = createOpenAI()
      return openai(modelName)
    }
    case "anthropic": {
      if (apiKey && !process.env.ANTHROPIC_API_KEY) {
        process.env.ANTHROPIC_API_KEY = apiKey
      }
      const anthropic = createAnthropic()
      return anthropic(modelName)
    }
    case "google": {
      if (apiKey && !process.env.GOOGLE_API_KEY) {
        process.env.GOOGLE_API_KEY = apiKey
      }
      const google = createGoogle()
      return google(modelName)
    }
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`)
  }
}
