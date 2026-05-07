import type {
  A2AAgentCard,
  A2AArtifact,
  A2AJsonRpcResponse,
  A2AMessage,
  A2AMessageSendParams,
  A2ATask,
} from "@/domain/a2a"

export type A2ARemoteAgentEndpoint = {
  id: string
  name: string
  url: string
  bearerToken?: string
}

const MESSAGE_SEND_METHOD = "message/send"

const createMessageSendRequest = (
  prompt: string,
): {
  jsonrpc: "2.0"
  id: string
  method: typeof MESSAGE_SEND_METHOD
  params: A2AMessageSendParams
} => {
  return {
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method: MESSAGE_SEND_METHOD,
    params: {
      message: {
        role: "user",
        messageId: crypto.randomUUID(),
        parts: [{ kind: "text", text: prompt }],
      },
    },
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null
}

const textFromParts = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap((part) => {
    if (!isRecord(part)) return []
    if (
      typeof part.text === "string" &&
      (part.kind === "text" || part.type === "text" || !("kind" in part))
    ) {
      return [part.text]
    }

    return []
  })
}

const isMessageResult = (value: unknown): value is A2AMessage => {
  return (
    isRecord(value) &&
    value.kind === "message" &&
    value.role === "agent" &&
    Array.isArray(value.parts)
  )
}

const isTaskResult = (value: unknown): value is A2ATask => {
  return (
    isRecord(value) &&
    (value.kind === "task" ||
      Array.isArray(value.artifacts) ||
      ("id" in value && "status" in value && isRecord(value.status)))
  )
}

const normalizeTaskState = (state: unknown): string => {
  return String(state ?? "")
    .toLowerCase()
    .replace(/^task_state_/, "")
    .replaceAll("_", "-")
}

const textFromMessage = (message: unknown): string | undefined => {
  if (!isRecord(message)) return undefined
  if (message.role !== "agent") return undefined

  const text = textFromParts(message.parts).join("\n").trim()
  return text || undefined
}

const textFromArtifacts = (artifacts: unknown): string | undefined => {
  if (!Array.isArray(artifacts)) return undefined

  const text = artifacts
    .flatMap((artifact) => {
      if (!isRecord(artifact)) return []
      return textFromParts((artifact as A2AArtifact).parts)
    })
    .join("\n")
    .trim()

  return text || undefined
}

const textFromAgentHistory = (history: unknown): string | undefined => {
  if (!Array.isArray(history)) return undefined

  const text = history
    .flatMap(textFromMessage)
    .filter(Boolean)
    .join("\n")
    .trim()
  return text || undefined
}

const isTerminalFailureState = (state: string): boolean => {
  return ["failed", "canceled", "cancelled", "rejected"].includes(state)
}

const isNonTerminalState = (state: string): boolean => {
  return [
    "submitted",
    "working",
    "input-required",
    "auth-required",
    "unknown",
    "unspecified",
  ].includes(state)
}

const extractMessageSendResultText = (
  result: unknown,
): { text: string } | { error: string } | undefined => {
  if (isMessageResult(result)) {
    const text = textFromMessage(result)
    return text ? { text } : undefined
  }

  if (!isTaskResult(result)) {
    return undefined
  }

  const state = normalizeTaskState(result.status?.state)
  const statusText = textFromMessage(result.status?.message)
  if (isTerminalFailureState(state)) {
    return { error: statusText ?? state }
  }
  if (isNonTerminalState(state)) {
    return { error: `task is not completed: ${state}` }
  }

  const artifactText = textFromArtifacts(result.artifacts)
  if (artifactText) {
    return { text: artifactText }
  }
  if (statusText) {
    return { text: statusText }
  }
  const historyText = textFromAgentHistory(result.history)
  if (historyText) {
    return { text: historyText }
  }

  return undefined
}

const formatInvalidResult = (result: unknown): string => {
  try {
    return JSON.stringify(result).slice(0, 500)
  } catch {
    return String(result)
  }
}

export class A2AClient {
  async fetchAgentCard(
    agentCardUrl: string,
    bearerToken?: string,
  ): Promise<A2AAgentCard> {
    const headers = new Headers()
    if (bearerToken) {
      headers.set("authorization", `Bearer ${bearerToken}`)
    }

    const response = await fetch(agentCardUrl, { headers })
    if (!response.ok) {
      throw new Error(
        `A2A Agent Card fetch failed with HTTP ${response.status} ${response.statusText}`,
      )
    }

    return (await response.json()) as A2AAgentCard
  }

  async sendMessage(
    agent: A2ARemoteAgentEndpoint,
    prompt: string,
  ): Promise<string> {
    const headers = new Headers({ "content-type": "application/json" })
    if (agent.bearerToken) {
      headers.set("authorization", `Bearer ${agent.bearerToken}`)
    }

    const response = await fetch(agent.url, {
      method: "POST",
      headers,
      body: JSON.stringify(createMessageSendRequest(prompt)),
    })

    if (!response.ok) {
      throw new Error(
        `A2A agent '${agent.id}' responded with HTTP ${response.status} ${response.statusText}`,
      )
    }

    const body = (await response.json()) as A2AJsonRpcResponse
    if ("error" in body) {
      throw new Error(
        `A2A agent '${agent.id}' returned JSON-RPC error ${body.error.code}: ${body.error.message}`,
      )
    }

    const result = extractMessageSendResultText(body.result)
    if (result && "error" in result) {
      throw new Error(`A2A agent '${agent.id}' failed: ${result.error}`)
    }
    if (result) {
      return result.text
    }

    throw new Error(
      `A2A agent '${agent.id}' returned an invalid message: ${formatInvalidResult(body.result)}`,
    )
  }
}
