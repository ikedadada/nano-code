import { swaggerUI } from "@hono/swagger-ui"
import type { OpenAPIHono } from "@hono/zod-openapi"

const bearerAuthSecurityScheme = {
  type: "http",
  scheme: "bearer",
  bearerFormat: "opaque",
  description: "Required for POST /a2a when A2A_AUTH_TOKEN is configured.",
} as const

export const a2aOpenApiConfig = {
  openapi: "3.1.0",
  info: {
    title: "nano-code A2A API",
    version: "0.1.0",
    description:
      "A2A Agent Card discovery and JSON-RPC message/send endpoint for nano-code.",
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        ...bearerAuthSecurityScheme,
      },
    },
  },
} as const

export const registerDocsController = (app: OpenAPIHono) => {
  app.openAPIRegistry.registerComponent(
    "securitySchemes",
    "bearerAuth",
    bearerAuthSecurityScheme,
  )

  app.get(
    "/docs",
    swaggerUI({
      title: "nano-code A2A API",
      url: "",
      spec: app.getOpenAPI31Document(a2aOpenApiConfig),
    }),
  )
}
