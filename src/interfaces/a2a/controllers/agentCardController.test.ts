import { describe, expect, test } from "bun:test"
import { OpenAPIHono } from "@hono/zod-openapi"
import type { A2AService } from "@/application/a2a/A2AService"
import { registerAgentCardController } from "@/interfaces/a2a/controllers/agentCardController"

const createAgentCardService = (): A2AService =>
  ({
    getAgentCard: () => ({
      protocolVersion: "0.3.0",
      name: "test-agent",
      description: "Test A2A agent.",
      url: "http://localhost:3000/a2a",
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
          id: "coding-agent",
          name: "Coding Agent",
          description: "Helps with coding tasks.",
          tags: ["coding"],
          inputModes: ["text/plain"],
          outputModes: ["text/plain"],
        },
      ],
    }),
  }) as A2AService

describe("registerAgentCardController", () => {
  test("registers and serves the agent card endpoint", async () => {
    const app = new OpenAPIHono()
    registerAgentCardController(app, createAgentCardService())

    const response = await app.request("/.well-known/agent-card.json")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      protocolVersion: "0.3.0",
      name: "test-agent",
      preferredTransport: "JSONRPC",
      skills: [{ id: "coding-agent" }],
    })
  })

  test("registers the agent card OpenAPI schema", () => {
    const app = new OpenAPIHono()
    registerAgentCardController(app, createAgentCardService())

    const document = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "test", version: "0.1.0" },
    })

    expect(document.paths?.["/.well-known/agent-card.json"]?.get).toMatchObject(
      {
        tags: ["A2A"],
        summary: "Get the A2A Agent Card",
        responses: {
          200: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/A2AAgentCard" },
              },
            },
          },
        },
      },
    )
    expect(document.components?.schemas?.A2AAgentCard).toMatchObject({
      properties: {
        preferredTransport: { enum: ["JSONRPC"] },
      },
    })
  })
})
