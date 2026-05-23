import { describe, expect, test } from "bun:test"
import { a2aOpenApiConfig } from "@/interfaces/a2a/controllers/docsController"
import { createA2AApp } from "@/interfaces/a2a/server"

const createApp = () => {
  return createA2AApp({
    env: {
      A2A_AUTH_TOKEN: "secret-token",
      A2A_AGENT_URL: "http://localhost:3000/a2a",
    },
    workspaceRoot: "/workspace",
    runAgent: async (request) => ({ text: `answer:${request.prompt}` }),
  })
}

describe("A2A server app", () => {
  test("requires A2A_AUTH_TOKEN by default", () => {
    expect(() =>
      createA2AApp({
        env: {},
        workspaceRoot: "/workspace",
        runAgent: async (request) => ({ text: `answer:${request.prompt}` }),
      }),
    ).toThrow("A2A_AUTH_TOKEN is required")
  })

  test("allows explicit unsafe no-auth mode only as local A2A", async () => {
    const app = createA2AApp({
      env: {
        A2A_UNSAFE_ALLOW_NO_AUTH: "true",
        A2A_AGENT_URL: "http://example.com/a2a",
        HOST: "0.0.0.0",
        PORT: "8787",
      },
      workspaceRoot: "/workspace",
      runAgent: async (request) => ({ text: `answer:${request.prompt}` }),
    })

    const agentCardResponse = await app.request("/.well-known/agent-card.json")
    const agentCard = await agentCardResponse.json()
    expect(agentCard).toMatchObject({
      url: "http://127.0.0.1:8787/a2a",
    })
    expect(agentCard.security).toBeUndefined()

    const response = await app.request("/a2a", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "req-1",
        method: "message/send",
        params: {
          message: {
            role: "user",
            messageId: "msg-1",
            parts: [{ kind: "text", text: "hello" }],
          },
        },
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      result: {
        parts: [{ kind: "text", text: "answer:hello" }],
      },
    })
  })

  test("serves the well-known agent card", async () => {
    const app = createApp()
    const response = await app.request("/.well-known/agent-card.json")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      name: "nano-code",
      url: "http://localhost:3000/a2a",
      preferredTransport: "JSONRPC",
    })
  })

  test("handles JSON-RPC message/send over HTTP", async () => {
    const app = createApp()
    const response = await app.request("/a2a", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer secret-token",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "req-1",
        method: "message/send",
        params: {
          message: {
            role: "user",
            messageId: "msg-1",
            parts: [{ kind: "text", text: "hello" }],
          },
        },
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: "req-1",
      result: {
        kind: "message",
        role: "agent",
        parts: [{ kind: "text", text: "answer:hello" }],
      },
    })
  })

  test("passes A2A environment options to the agent runner", async () => {
    const runRequests: unknown[] = []
    const app = createA2AApp({
      env: {
        PORT: "8787",
        HOST: "127.0.0.1",
        A2A_AUTH_TOKEN: "secret-token",
        A2A_SANDBOX: "true",
        A2A_ALLOWED_DOMAINS: "example.com, docs.example.com",
      },
      workspaceRoot: "/custom-workspace",
      runAgent: async (request) => {
        runRequests.push(request)
        return { text: "configured-answer" }
      },
    })

    const agentCard = await app.request("/.well-known/agent-card.json")
    await expect(agentCard.json()).resolves.toMatchObject({
      url: "http://127.0.0.1:8787/a2a",
      security: [{ bearerAuth: [] }],
    })

    const response = await app.request("/a2a", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer secret-token",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "req-1",
        method: "message/send",
        params: {
          message: {
            role: "user",
            messageId: "msg-1",
            parts: [{ kind: "text", text: "hello" }],
          },
        },
      }),
    })

    expect(response.status).toBe(200)
    expect(runRequests[0]).toMatchObject({
      prompt: "hello",
      sandbox: true,
      allowedDomains: ["example.com", "docs.example.com"],
      workspaceRoot: "/custom-workspace",
    })
  })

  test("rejects non-json requests", async () => {
    const app = createApp()
    const response = await app.request("/a2a", {
      method: "POST",
      headers: { authorization: "Bearer secret-token" },
      body: "not json",
    })

    expect(response.status).toBe(415)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: -32600 },
    })
  })

  test("returns JSON-RPC errors for unsupported methods and invalid params", async () => {
    const app = createApp()

    const unsupportedMethod = await app.request("/a2a", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer secret-token",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tasks/get",
      }),
    })

    expect(unsupportedMethod.status).toBe(400)
    await expect(unsupportedMethod.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32601, message: "Method not found" },
    })

    const invalidParams = await app.request("/a2a", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer secret-token",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "message/send",
        params: {},
      }),
    })

    expect(invalidParams.status).toBe(400)
    await expect(invalidParams.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 2,
      error: { code: -32602, message: "Invalid params" },
    })
  })

  test("rejects missing bearer token before handling JSON-RPC", async () => {
    const app = createApp()
    const response = await app.request("/a2a", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "req-1",
        method: "message/send",
      }),
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: -32001, message: "Unauthorized" },
    })
  })

  test("serves Swagger UI with the generated OpenAPI document", async () => {
    const app = createApp()
    const response = await app.request("/docs")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/html")

    const html = await response.text()
    expect(html).toContain("SwaggerUIBundle")
    expect(html).toContain("nano-code A2A API")
    expect(html).toContain("/.well-known/agent-card.json")
    expect(html).toContain("/a2a")
    expect(html).toContain("message/send")
  })

  test("generates an OpenAPI document for A2A endpoints from controller schemas", () => {
    const app = createApp()
    const document = app.getOpenAPI31Document(a2aOpenApiConfig)

    expect(document.openapi).toBe("3.1.0")
    expect(document.info.title).toBe("nano-code A2A API")
    expect(document.components?.securitySchemes).toMatchObject({
      bearerAuth: {
        type: "http",
        scheme: "bearer",
      },
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

    expect(document.paths?.["/a2a"]?.post).toMatchObject({
      tags: ["A2A"],
      summary: "Send an A2A message",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/A2AMessageSendRequest" },
          },
        },
      },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/A2AMessageSendSuccessResponse",
              },
            },
          },
        },
        400: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/A2AJsonRpcErrorResponse" },
            },
          },
        },
        401: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/A2AJsonRpcErrorResponse" },
            },
          },
        },
        415: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/A2AJsonRpcErrorResponse" },
            },
          },
        },
      },
    })

    expect(document.components?.schemas?.A2AMessageSendRequest).toMatchObject({
      properties: {
        jsonrpc: { enum: ["2.0"] },
        method: { enum: ["message/send"] },
        params: { $ref: "#/components/schemas/A2AMessageSendParams" },
      },
      required: ["jsonrpc", "method", "params"],
    })
  })

  test("does not expose a standalone OpenAPI JSON endpoint", async () => {
    const app = createApp()
    const response = await app.request("/openapi.json")

    expect(response.status).toBe(404)
  })
})
