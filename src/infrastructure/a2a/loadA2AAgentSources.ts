import { readFileSync } from "node:fs"
import type { A2AAgentSource } from "@/infrastructure/a2a/A2AAgentRegistry"

type A2AAgentSourceConfig = A2AAgentSource & {
  bearerTokenEnv?: string
}

type A2AAgentCatalog = {
  agents: A2AAgentSourceConfig[]
}

const defaultCatalogUrl = new URL("./agents.json", import.meta.url)

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null
}

const parseCatalog = (content: string): A2AAgentCatalog => {
  const catalog = JSON.parse(content) as unknown
  if (!isRecord(catalog) || !Array.isArray(catalog.agents)) {
    throw new Error("Invalid A2A agent catalog. Expected an agents array.")
  }

  return {
    agents: catalog.agents.map((agent) => {
      if (
        !isRecord(agent) ||
        typeof agent.id !== "string" ||
        typeof agent.agentCardUrl !== "string"
      ) {
        throw new Error(
          "Invalid A2A agent catalog entry. Expected id and agentCardUrl.",
        )
      }

      return {
        id: agent.id,
        agentCardUrl: agent.agentCardUrl,
        ...(typeof agent.endpointUrl === "string" && {
          endpointUrl: agent.endpointUrl,
        }),
        ...(typeof agent.bearerToken === "string" && {
          bearerToken: agent.bearerToken,
        }),
        ...(typeof agent.bearerTokenEnv === "string" && {
          bearerTokenEnv: agent.bearerTokenEnv,
        }),
      }
    }),
  }
}

export const loadA2AAgentSources = (
  catalogUrl: URL | string = defaultCatalogUrl,
  env: NodeJS.ProcessEnv = process.env,
): A2AAgentSource[] => {
  const catalog = parseCatalog(readFileSync(catalogUrl, "utf8"))

  return catalog.agents.map((agent) => ({
    id: agent.id,
    agentCardUrl: agent.agentCardUrl,
    ...(agent.endpointUrl && { endpointUrl: agent.endpointUrl }),
    ...(agent.bearerToken && { bearerToken: agent.bearerToken }),
    ...(agent.bearerTokenEnv &&
      env[agent.bearerTokenEnv] && {
        bearerToken: env[agent.bearerTokenEnv],
      }),
  }))
}
