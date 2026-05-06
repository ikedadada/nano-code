import type {
  A2AAgentCard,
  A2AMessage,
  A2AMessageSendCommand,
} from "@/domain/a2a"
import type { RunAgentRequest } from "@/interfaces/agentRunner"

type RunAgent = (request: RunAgentRequest) => Promise<{ text: string }>

export type A2AServiceConfig = {
  agentUrl: string
  runAgent: RunAgent
  workspaceRoot: string
  authRequired: boolean
  sandbox: boolean
  allowedDomains: string[]
}

export class A2AService {
  constructor(private config: A2AServiceConfig) {}

  getAgentCard(): A2AAgentCard {
    return {
      protocolVersion: "0.3.0",
      name: "nano-code",
      description: "A TypeScript coding agent exposed over A2A JSON-RPC.",
      url: this.config.agentUrl,
      preferredTransport: "JSONRPC",
      ...(this.config.authRequired && {
        securitySchemes: {
          bearerAuth: {
            type: "http" as const,
            scheme: "bearer" as const,
            bearerFormat: "opaque",
            description: "Bearer token required for A2A JSON-RPC requests.",
          },
        },
        security: [{ bearerAuth: [] }],
      }),
      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: false,
      },
      defaultInputModes: ["text/plain"],
      defaultOutputModes: ["text/plain"],
      skills: [
        {
          id: "coding-agent",
          name: "Coding Agent",
          description: "Helps with coding tasks in the configured workspace.",
          tags: ["coding", "typescript", "automation"],
          inputModes: ["text/plain"],
          outputModes: ["text/plain"],
        },
      ],
    }
  }

  async sendMessage(command: A2AMessageSendCommand): Promise<A2AMessage> {
    const prompt = extractTextPrompt(command.parts)
    if (!prompt) {
      throw new Error("Text part is required")
    }

    const result = await this.config.runAgent({
      prompt,
      issueDriven: false,
      verbose: false,
      streaming: false,
      yolo: true,
      sandbox: this.config.sandbox,
      allowedDomains: this.config.allowedDomains,
      workspaceRoot: this.config.workspaceRoot,
    })

    return {
      kind: "message",
      messageId: crypto.randomUUID(),
      role: "agent",
      parts: [{ kind: "text", text: result.text }],
    }
  }
}

const extractTextPrompt = (parts: A2AMessageSendCommand["parts"]): string => {
  return parts
    .filter((part) => part.kind === "text")
    .map((part) => part.text)
    .join("\n")
    .trim()
}
