import { describe, expect, test } from "bun:test"
import { OpenAPIHono } from "@hono/zod-openapi"
import type { A2AService } from "@/application/a2a/A2AService"
import { registerMessageSendController } from "@/interfaces/a2a/controllers/messageSendController"
import { HttpError } from "@/interfaces/a2a/error"

const createMessageSendApp = (
  service: Pick<A2AService, "sendMessage">,
  auth: { bearerToken?: string } = {},
) => {
  const app = new OpenAPIHono()
  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json(err.body, err.status)
    }

    throw err
  })
  registerMessageSendController(app, service as A2AService, auth)
  return app
}

describe("registerMessageSendController", () => {
  test("registers and handles message/send requests", async () => {
    const commands: unknown[] = []
    const app = createMessageSendApp(
      {
        sendMessage: async (command) => {
          commands.push(command)
          return {
            kind: "message",
            messageId: "agent-msg-1",
            role: "agent",
            parts: [{ kind: "text", text: "answer" }],
          }
        },
      },
      { bearerToken: "secret-token" },
    )

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
    expect(commands).toEqual([
      {
        messageId: "msg-1",
        parts: [{ kind: "text", text: "hello" }],
      },
    ])
    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: "req-1",
      result: {
        kind: "message",
        messageId: "agent-msg-1",
        role: "agent",
        parts: [{ kind: "text", text: "answer" }],
      },
    })
  })

  test("returns JSON-RPC errors from controller validation", async () => {
    const app = createMessageSendApp(
      {
        sendMessage: async () => {
          throw new Error("should not run")
        },
      },
      { bearerToken: "secret-token" },
    )

    const response = await app.request("/a2a", {
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

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32601, message: "Method not found" },
    })
  })

  test("registers the message/send OpenAPI schema", () => {
    const app = createMessageSendApp({
      sendMessage: async () => ({
        kind: "message",
        messageId: "agent-msg-1",
        role: "agent",
        parts: [{ kind: "text", text: "answer" }],
      }),
    })

    const document = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "test", version: "0.1.0" },
    })

    expect(document.paths?.["/a2a"]?.post).toMatchObject({
      security: [{ bearerAuth: [] }],
      requestBody: {
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
      },
    })
    expect(document.components?.schemas?.A2AMessageSendRequest).toMatchObject({
      properties: {
        jsonrpc: { enum: ["2.0"] },
        method: { enum: ["message/send"] },
      },
    })
  })
})
