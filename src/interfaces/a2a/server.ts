import * as path from "node:path"
import { OpenAPIHono } from "@hono/zod-openapi"
import { A2AService } from "@/application/a2a/A2AService"
import { registerAgentCardController } from "@/interfaces/a2a/controllers/agentCardController"
import { registerDocsController } from "@/interfaces/a2a/controllers/docsController"
import {
  type A2AAuthConfig,
  registerMessageSendController,
} from "@/interfaces/a2a/controllers/messageSendController"
import { HttpError } from "@/interfaces/a2a/error"
import {
  runAgent as defaultRunAgent,
  type RunAgentRequest,
  type RunAgentResponse,
} from "@/interfaces/agentRunner"

type RunAgent = (request: RunAgentRequest) => Promise<RunAgentResponse>

type A2AAppOptions = {
  env?: NodeJS.ProcessEnv
  runAgent?: RunAgent
  workspaceRoot?: string
}

export const createA2AApp = ({
  env = process.env,
  runAgent = defaultRunAgent,
  workspaceRoot = path.resolve(process.cwd(), "workspace"),
}: A2AAppOptions = {}) => {
  const port = Number(env.PORT ?? 3000)
  const host = env.HOST ?? "localhost"
  const agentUrl = env.A2A_AGENT_URL ?? `http://${host}:${port}/a2a`
  const bearerToken = env.A2A_AUTH_TOKEN
  const allowedDomains =
    env.A2A_ALLOWED_DOMAINS?.split(",")
      .map((domain) => domain.trim())
      .filter(Boolean) ?? []

  const service = new A2AService({
    agentUrl,
    runAgent,
    workspaceRoot,
    authRequired: Boolean(bearerToken),
    sandbox: env.A2A_SANDBOX === "true",
    allowedDomains,
  })

  const auth: A2AAuthConfig = { bearerToken }
  const app = new OpenAPIHono()

  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json(err.body, err.status)
    }

    throw err
  })

  registerAgentCardController(app, service)
  registerMessageSendController(app, service, auth)
  registerDocsController(app)

  return app
}

export const serveA2A = () => {
  const port = Number(process.env.PORT ?? 3000)
  const app = createA2AApp()

  return Bun.serve({
    port,
    fetch: app.fetch,
  })
}
