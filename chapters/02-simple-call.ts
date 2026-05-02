type OpenAIResponse = {
  id: string
  object: string
  created: number
  model: string
  choices: { message: { content: string } }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    prompt_tokens_details: {
      cached_tokens: number
      audio_tokens: number
    }
    completion_tokens_details: {
      reasoning_tokens: number
      audio_tokens: number
      accepted_prediction_tokens: number
      rejected_prediction_tokens: number
    }
  }
  service_tier: string
  system_fingerprint: string
}

async function callOpenAI() {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      messages: [
        { role: "user", content: "TypeScriptについて簡潔に説明してください" },
      ],
    }),
  })

  const data = (await response.json()) as OpenAIResponse

  console.log(data.choices[0]?.message.content)
}

callOpenAI()
