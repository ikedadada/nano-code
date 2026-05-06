import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi"
import type { A2AService } from "@/application/a2a/A2AService"

const PreferredTransportSchema = z.enum(["JSONRPC"])
const SecuritySchemeTypeSchema = z.enum(["http"])
const SecuritySchemeSchema = z.enum(["bearer"])

const AgentSkillSchema = z
  .object({
    id: z.string().openapi({ example: "coding-agent" }),
    name: z.string().openapi({ example: "Coding Agent" }),
    description: z.string(),
    tags: z.array(z.string()).openapi({ example: ["coding", "typescript"] }),
    inputModes: z.array(z.string()).openapi({ example: ["text/plain"] }),
    outputModes: z.array(z.string()).openapi({ example: ["text/plain"] }),
  })
  .openapi("A2AAgentSkill")

const AgentCardSchema = z
  .object({
    protocolVersion: z.string().openapi({ example: "0.3.0" }),
    name: z.string().openapi({ example: "nano-code" }),
    description: z.string(),
    url: z.url().openapi({ example: "http://localhost:3000/a2a" }),
    preferredTransport: PreferredTransportSchema,
    securitySchemes: z
      .record(
        z.string(),
        z.object({
          type: SecuritySchemeTypeSchema,
          scheme: SecuritySchemeSchema,
          bearerFormat: z.string().optional(),
          description: z.string().optional(),
        }),
      )
      .optional(),
    security: z.array(z.record(z.string(), z.array(z.string()))).optional(),
    capabilities: z.object({
      streaming: z.boolean(),
      pushNotifications: z.boolean(),
      stateTransitionHistory: z.boolean(),
    }),
    defaultInputModes: z.array(z.string()).openapi({ example: ["text/plain"] }),
    defaultOutputModes: z
      .array(z.string())
      .openapi({ example: ["text/plain"] }),
    skills: z.array(AgentSkillSchema),
  })
  .openapi("A2AAgentCard")

const agentCardRoute = createRoute({
  method: "get",
  path: "/.well-known/agent-card.json",
  tags: ["A2A"],
  summary: "Get the A2A Agent Card",
  responses: {
    200: {
      description: "A2A Agent Card discovery document.",
      content: {
        "application/json": {
          schema: AgentCardSchema,
        },
      },
    },
  },
})

export const registerAgentCardController = (
  app: OpenAPIHono,
  service: A2AService,
) => {
  app.openapi(agentCardRoute, (c) => {
    return c.json(service.getAgentCard(), 200)
  })
}
