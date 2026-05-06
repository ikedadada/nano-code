import { describe, expect, test } from "bun:test"
import { A2AService } from "@/application/a2a/A2AService"

const createService = () => {
  const prompts: string[] = []
  const runRequests: unknown[] = []
  const service = new A2AService({
    agentUrl: "http://localhost:3000/a2a",
    workspaceRoot: "/workspace",
    authRequired: true,
    sandbox: true,
    allowedDomains: ["example.com"],
    runAgent: async (request) => {
      prompts.push(request.prompt)
      runRequests.push(request)
      return { text: `answer:${request.prompt}` }
    },
  })

  return { service, prompts, runRequests }
}

describe("A2AService", () => {
  test("returns an A2A agent card for JSON-RPC discovery", () => {
    const { service } = createService()

    expect(service.getAgentCard()).toMatchObject({
      protocolVersion: "0.3.0",
      name: "nano-code",
      url: "http://localhost:3000/a2a",
      preferredTransport: "JSONRPC",
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
      security: [{ bearerAuth: [] }],
      capabilities: {
        streaming: false,
        pushNotifications: false,
      },
      defaultInputModes: ["text/plain"],
      defaultOutputModes: ["text/plain"],
    })
  })

  test("sends a message through the agent runner", async () => {
    const { service, prompts, runRequests } = createService()

    const message = await service.sendMessage({
      messageId: "msg-1",
      parts: [
        { kind: "text", text: "hello" },
        { kind: "text", text: "world" },
      ],
    })

    expect(prompts).toEqual(["hello\nworld"])
    expect(runRequests[0]).toMatchObject({
      prompt: "hello\nworld",
      yolo: true,
      sandbox: true,
      allowedDomains: ["example.com"],
      workspaceRoot: "/workspace",
    })
    expect(message).toMatchObject({
      kind: "message",
      role: "agent",
      parts: [{ kind: "text", text: "answer:hello\nworld" }],
    })
  })

  test("rejects messages without text", async () => {
    const { service } = createService()

    await expect(
      service.sendMessage({
        messageId: "msg-1",
        parts: [{ kind: "text", text: "  " }],
      }),
    ).rejects.toThrow("Text part is required")
  })
})
