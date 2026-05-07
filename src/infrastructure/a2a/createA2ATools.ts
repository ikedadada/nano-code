import { z } from "zod"
import type { Tool } from "@/domain/types"
import {
  type A2AAgentRegistry,
  defaultA2AAgentRegistry,
  type RegisteredA2AAgent,
} from "@/infrastructure/a2a/A2AAgentRegistry"
import { A2AClient } from "@/infrastructure/a2a/A2AClient"

type A2AMessageSender = Pick<A2AClient, "sendMessage">

const toToolName = (agent: RegisteredA2AAgent, skillId: string): string => {
  const safeName = `a2a_${agent.id}_${skillId}`
    .replaceAll(/[^a-zA-Z0-9_-]/g, "_")
    .replaceAll(/_+/g, "_")
    .slice(0, 64)

  return safeName || "a2a_remote_agent"
}

const toToolDescription = (
  agent: RegisteredA2AAgent,
  skill: RegisteredA2AAgent["card"]["skills"][number],
): string => {
  const tags = skill.tags.length > 0 ? ` Tags: ${skill.tags.join(", ")}.` : ""
  return [
    `Delegate to remote A2A agent '${agent.card.name}' for skill '${skill.name}'.`,
    skill.description,
    tags,
  ]
    .filter(Boolean)
    .join(" ")
}

export const createA2ATools = (
  registry: A2AAgentRegistry = defaultA2AAgentRegistry,
  client: A2AMessageSender = new A2AClient(),
): Tool[] => {
  return registry.list().flatMap((agent) =>
    agent.card.skills.map((skill) => ({
      name: toToolName(agent, skill.id),
      description: toToolDescription(agent, skill),
      needsApproval: true,
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: `Task prompt for remote A2A agent '${agent.card.name}' skill '${skill.name}'`,
          },
        },
        required: ["prompt"],
      },
      execute: async (args) => {
        const parsedArgs = z.object({ prompt: z.string().min(1) }).parse(args)

        return await client.sendMessage(
          {
            id: agent.id,
            name: agent.card.name,
            url: agent.endpointUrl,
            bearerToken: agent.bearerToken,
          },
          parsedArgs.prompt,
        )
      },
    })),
  )
}
