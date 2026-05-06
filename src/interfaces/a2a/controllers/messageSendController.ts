import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi"
import type { A2AService } from "@/application/a2a/A2AService"
import type { A2AMessageSendCommand } from "@/domain/a2a"
import { JsonRpcHttpError } from "@/interfaces/a2a/error"

export type A2AAuthConfig = {
  bearerToken?: string
}

const JSON_RPC_VERSION = "2.0"
const MESSAGE_SEND_METHOD = "message/send"

const JsonRpcIdSchema = z.union([z.string(), z.number(), z.null()])
const JsonRpcVersionSchema = z.enum([JSON_RPC_VERSION])
const MessageSendMethodSchema = z.enum([MESSAGE_SEND_METHOD])
const MessageKindSchema = z.enum(["message"])
const PartKindSchema = z.enum(["text"])
const UserRoleSchema = z.enum(["user"])
const AgentRoleSchema = z.enum(["agent"])

const JsonRpcRequestSchema = z.object({
  jsonrpc: JsonRpcVersionSchema,
  id: JsonRpcIdSchema.optional(),
  method: z.string(),
  params: z.unknown().optional(),
})

const TextPartSchema = z
  .object({
    kind: PartKindSchema,
    text: z.string().openapi({ example: "hello" }),
  })
  .openapi("A2ATextPart")

const MessageSendParamsSchema = z
  .object({
    message: z.object({
      role: UserRoleSchema,
      messageId: z.string().openapi({ example: "msg-1" }),
      parts: z.array(TextPartSchema),
    }),
  })
  .openapi("A2AMessageSendParams")

const MessageSendRequestSchema = z
  .object({
    jsonrpc: JsonRpcVersionSchema,
    id: JsonRpcIdSchema.optional().openapi({ example: "req-1" }),
    method: MessageSendMethodSchema,
    params: MessageSendParamsSchema,
  })
  .openapi("A2AMessageSendRequest")

const AgentMessageSchema = z
  .object({
    kind: MessageKindSchema,
    messageId: z.string().openapi({ example: "response-message-id" }),
    role: AgentRoleSchema,
    parts: z.array(TextPartSchema),
  })
  .openapi("A2AAgentMessage")

const MessageSendSuccessResponseSchema = z
  .object({
    jsonrpc: JsonRpcVersionSchema,
    id: JsonRpcIdSchema,
    result: AgentMessageSchema,
  })
  .openapi("A2AMessageSendSuccessResponse")

const JsonRpcErrorResponseSchema = z
  .object({
    jsonrpc: JsonRpcVersionSchema,
    id: JsonRpcIdSchema,
    error: z.object({
      code: z.number().openapi({ example: -32602 }),
      message: z.string().openapi({ example: "Invalid params" }),
    }),
  })
  .openapi("A2AJsonRpcErrorResponse")

const messageSendRoute = createRoute({
  method: "post",
  path: "/a2a",
  tags: ["A2A"],
  summary: "Send an A2A message",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: MessageSendRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "JSON-RPC success response containing the agent message.",
      content: {
        "application/json": {
          schema: MessageSendSuccessResponseSchema,
        },
      },
    },
    400: {
      description: "JSON-RPC error response for parse or request failures.",
      content: {
        "application/json": {
          schema: JsonRpcErrorResponseSchema,
        },
      },
    },
    401: {
      description:
        "JSON-RPC error response for bearer authentication failures.",
      content: {
        "application/json": {
          schema: JsonRpcErrorResponseSchema,
        },
      },
    },
    415: {
      description: "JSON-RPC error response for unsupported media types.",
      content: {
        "application/json": {
          schema: JsonRpcErrorResponseSchema,
        },
      },
    },
  },
})

type ParsedMessageSendRequest = {
  id: string | number | null
  command: A2AMessageSendCommand
}

export const registerMessageSendController = (
  app: OpenAPIHono,
  service: A2AService,
  auth: A2AAuthConfig = {},
) => {
  app.openAPIRegistry.registerPath(messageSendRoute)

  app.post("/a2a", async (c) => {
    if (auth.bearerToken) {
      const expected = `Bearer ${auth.bearerToken}`
      if (c.req.header("authorization") !== expected) {
        throw new JsonRpcHttpError(401, null, -32001, "Unauthorized")
      }
    }

    const contentType = c.req.header("content-type") ?? ""
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new JsonRpcHttpError(
        415,
        null,
        -32600,
        "Content-Type must be application/json",
      )
    }

    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      throw new JsonRpcHttpError(400, null, -32700, "Parse error")
    }

    const request = parseMessageSendRequest(body)

    try {
      const message = await service.sendMessage(request.command)
      return c.json(
        {
          jsonrpc: JSON_RPC_VERSION,
          id: request.id,
          result: message,
        },
        200,
      )
    } catch (cause) {
      throw new JsonRpcHttpError(
        400,
        request.id,
        -32602,
        cause instanceof Error ? cause.message : "Invalid params",
      )
    }
  })
}

const parseMessageSendRequest = (
  request: unknown,
): ParsedMessageSendRequest => {
  const parsedId = z
    .object({ id: JsonRpcIdSchema.optional() })
    .safeParse(request)
  const id = parsedId.success ? (parsedId.data.id ?? null) : null
  const parsedRequest = JsonRpcRequestSchema.safeParse(request)

  if (!parsedRequest.success) {
    throw new JsonRpcHttpError(400, id, -32600, "Invalid Request")
  }

  if (parsedRequest.data.method !== MESSAGE_SEND_METHOD) {
    throw new JsonRpcHttpError(400, id, -32601, "Method not found")
  }

  const params = MessageSendParamsSchema.safeParse(parsedRequest.data.params)
  if (!params.success) {
    throw new JsonRpcHttpError(400, id, -32602, "Invalid params")
  }

  return {
    id,
    command: {
      messageId: params.data.message.messageId,
      parts: params.data.message.parts,
    },
  }
}
