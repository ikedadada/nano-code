import { describe, expect, test } from "bun:test"
import type { A2AAgentCard } from "@/domain/a2a"
import { A2AAgentRegistry } from "@/infrastructure/a2a/A2AAgentRegistry"
import { createA2ATools } from "@/infrastructure/a2a/createA2ATools"

const createCard = (): A2AAgentCard => ({
  protocolVersion: "0.3.0",
  name: "Code Reviewer",
  description: "Reviews code changes.",
  url: "http://reviewer.example/a2a",
  preferredTransport: "JSONRPC",
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
  skills: [
    {
      id: "review-code",
      name: "Review Code",
      description: "Reviews code and reports actionable findings.",
      tags: ["review", "code"],
      inputModes: ["text/plain"],
      outputModes: ["text/plain"],
    },
  ],
})

describe("createA2ATools", () => {
  test("returns no tools for an empty registry", () => {
    expect(createA2ATools(new A2AAgentRegistry())).toEqual([])
  })

  test("creates LLM-facing tools from A2A Agent Card skills", async () => {
    const card = createCard()
    const registry = new A2AAgentRegistry([
      {
        id: "reviewer",
        cardUrl: "http://reviewer.example/.well-known/agent-card.json",
        endpointUrl: card.url,
        bearerToken: "secret-token",
        card,
      },
    ])
    const sentMessages: unknown[] = []
    const tools = createA2ATools(registry, {
      sendMessage: async (agent, prompt) => {
        sentMessages.push({ agent, prompt })
        return "review result"
      },
    })

    expect(tools).toHaveLength(1)
    expect(tools[0]).toMatchObject({
      name: "a2a_reviewer_review-code",
      needsApproval: true,
      parameters: {
        required: ["prompt"],
      },
    })
    expect(tools[0]?.description).toContain("Code Reviewer")
    expect(tools[0]?.description).toContain("Reviews code")

    await expect(tools[0]?.execute({ prompt: "review this" })).resolves.toBe(
      "review result",
    )
    expect(sentMessages).toEqual([
      {
        agent: {
          id: "reviewer",
          name: "Code Reviewer",
          url: "http://reviewer.example/a2a",
          bearerToken: "secret-token",
        },
        prompt: "review this",
      },
    ])
  })
})
