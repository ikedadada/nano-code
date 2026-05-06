import { describe, expect, test } from "bun:test"
import { OpenAPIHono } from "@hono/zod-openapi"
import {
  a2aOpenApiConfig,
  registerDocsController,
} from "@/interfaces/a2a/controllers/docsController"

describe("registerDocsController", () => {
  test("registers Swagger UI at /docs", async () => {
    const app = new OpenAPIHono()
    registerDocsController(app)

    const response = await app.request("/docs")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/html")

    const html = await response.text()
    expect(html).toContain("SwaggerUIBundle")
    expect(html).toContain("nano-code A2A API")
  })

  test("registers bearerAuth in the generated OpenAPI document", () => {
    const app = new OpenAPIHono()
    registerDocsController(app)

    const document = app.getOpenAPI31Document(a2aOpenApiConfig)

    expect(document.components?.securitySchemes).toMatchObject({
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "opaque",
      },
    })
  })
})
