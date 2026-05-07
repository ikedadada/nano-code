export type A2ATextPart = {
  kind: "text"
  text: string
}

export type A2APart = A2ATextPart

export type A2AMessage = {
  kind: "message"
  messageId: string
  role: "user" | "agent"
  parts: A2APart[]
}

export type A2AArtifact = {
  artifactId?: string
  parts?: unknown[]
  metadata?: Record<string, unknown>
}

export type A2ATaskStatus = {
  state: string
  message?: unknown
  timestamp?: string
}

export type A2ATask = {
  kind?: "task"
  id: string
  contextId?: string
  status?: A2ATaskStatus
  artifacts?: A2AArtifact[]
  history?: unknown[]
  metadata?: Record<string, unknown>
}

export type A2AAgentSkill = {
  id: string
  name: string
  description: string
  tags: string[]
  inputModes: string[]
  outputModes: string[]
}

export type A2AAgentCard = {
  protocolVersion: string
  name: string
  description: string
  url: string
  preferredTransport: "JSONRPC"
  securitySchemes?: {
    [name: string]: {
      type: "http"
      scheme: "bearer"
      bearerFormat?: string
      description?: string
    }
  }
  security?: { [scheme: string]: string[] }[]
  capabilities: {
    streaming: boolean
    pushNotifications: boolean
    stateTransitionHistory: boolean
  }
  defaultInputModes: string[]
  defaultOutputModes: string[]
  skills: A2AAgentSkill[]
}

export type A2AJsonRpcRequest = {
  jsonrpc: "2.0"
  id?: string | number | null
  method: string
  params?: unknown
}

export type A2AJsonRpcSuccess = {
  jsonrpc: "2.0"
  id: string | number | null
  result: unknown
}

export type A2AJsonRpcError = {
  jsonrpc: "2.0"
  id: string | number | null
  error: {
    code: number
    message: string
    data?: unknown
  }
}

export type A2AJsonRpcResponse = A2AJsonRpcSuccess | A2AJsonRpcError

export type A2AMessageSendParams = {
  message: {
    role: "user"
    parts: A2APart[]
    messageId: string
  }
}

export type A2AMessageSendCommand = {
  messageId: string
  parts: A2APart[]
}
