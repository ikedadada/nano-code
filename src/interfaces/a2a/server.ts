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

const LOCAL_ONLY_HOST = "127.0.0.1"
const UNSAFE_NO_AUTH_ENV = "A2A_UNSAFE_ALLOW_NO_AUTH"

const getA2AServerConfig = (env: NodeJS.ProcessEnv) => {
  const bearerToken = env.A2A_AUTH_TOKEN?.trim() || undefined
  const unsafeNoAuth = env[UNSAFE_NO_AUTH_ENV] === "true"

  if (!bearerToken && !unsafeNoAuth) {
    throw new Error(
      `A2A_AUTH_TOKEN is required to serve A2A. Set ${UNSAFE_NO_AUTH_ENV}=true only for local development.`,
    )
  }

  const port = Number(env.PORT ?? 3000)
  const host =
    unsafeNoAuth && !bearerToken ? LOCAL_ONLY_HOST : (env.HOST ?? "localhost")
  const agentUrl =
    unsafeNoAuth && !bearerToken
      ? `http://${host}:${port}/a2a`
      : (env.A2A_AGENT_URL ?? `http://${host}:${port}/a2a`)

  return { port, host, agentUrl, bearerToken }
}

export const createA2AApp = ({
  env = process.env,
  runAgent = defaultRunAgent,
  workspaceRoot = path.resolve(process.cwd(), "workspace"),
}: A2AAppOptions = {}) => {
  const { agentUrl, bearerToken } = getA2AServerConfig(env)
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
  const { port, host, bearerToken } = getA2AServerConfig(process.env)
  const app = createA2AApp()

  return Bun.serve({
    port,
    ...(!bearerToken && { hostname: host }),
    fetch: app.fetch,
  })
}
