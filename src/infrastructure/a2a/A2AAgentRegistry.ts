import type { A2AAgentCard } from "@/domain/a2a"
import { A2AClient } from "@/infrastructure/a2a/A2AClient"

export type A2AAgentSource = {
  id: string
  agentCardUrl: string
  endpointUrl?: string
  bearerToken?: string
}

export type RegisteredA2AAgent = {
  id: string
  cardUrl: string
  endpointUrl: string
  bearerToken?: string
  card: A2AAgentCard
}

export const defaultA2AAgentSources: A2AAgentSource[] = []

type AgentCardFetcher = Pick<A2AClient, "fetchAgentCard">

export class A2AAgentRegistry {
  constructor(private agents: RegisteredA2AAgent[] = []) {}

  list(): RegisteredA2AAgent[] {
    return [...this.agents]
  }

  static async discover(
    sources: A2AAgentSource[] = defaultA2AAgentSources,
    client: AgentCardFetcher = new A2AClient(),
  ): Promise<A2AAgentRegistry> {
    const agents = (
      await Promise.all(
        sources.map(async (source) => {
          try {
            const card = await client.fetchAgentCard(
              source.agentCardUrl,
              source.bearerToken,
            )
            const endpointUrl = source.endpointUrl ?? card.url
            if (!endpointUrl) {
              console.warn(
                `A2A agent '${source.id}' skipped: Agent Card does not define an endpoint URL.`,
              )
              return undefined
            }

            return {
              id: source.id,
              cardUrl: source.agentCardUrl,
              endpointUrl,
              card,
              ...(source.bearerToken && { bearerToken: source.bearerToken }),
            }
          } catch (error) {
            console.warn(
              `A2A agent '${source.id}' skipped: failed to fetch Agent Card from ${source.agentCardUrl}. ${(error as Error).message}`,
            )
            return undefined
          }
        }),
      )
    ).filter((agent): agent is RegisteredA2AAgent => agent !== undefined)

    return new A2AAgentRegistry(agents)
  }
}

export const defaultA2AAgentRegistry = new A2AAgentRegistry()
