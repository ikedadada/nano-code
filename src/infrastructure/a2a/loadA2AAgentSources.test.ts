import { describe, expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadA2AAgentSources } from "@/infrastructure/a2a/loadA2AAgentSources"

describe("loadA2AAgentSources", () => {
  test("loads card URLs and endpoint overrides from the agent catalog", () => {
    const catalogPath = writeCatalog({
      agents: [
        {
          id: "pirate",
          agentCardUrl: "http://localhost:8082/.well-known/agent-card.json",
          endpointUrl: "http://localhost:8082/invoke",
        },
      ],
    })

    expect(loadA2AAgentSources(catalogPath)).toEqual([
      {
        id: "pirate",
        agentCardUrl: "http://localhost:8082/.well-known/agent-card.json",
        endpointUrl: "http://localhost:8082/invoke",
      },
    ])
  })

  test("loads bearer token from an environment variable referenced by the catalog", () => {
    const catalogPath = writeCatalog({
      agents: [
        {
          id: "private-agent",
          agentCardUrl: "http://localhost:3001/.well-known/agent-card.json",
          bearerTokenEnv: "PRIVATE_A2A_TOKEN",
        },
      ],
    })

    expect(
      loadA2AAgentSources(catalogPath, { PRIVATE_A2A_TOKEN: "test-token" }),
    ).toEqual([
      {
        id: "private-agent",
        agentCardUrl: "http://localhost:3001/.well-known/agent-card.json",
        bearerToken: "test-token",
      },
    ])
  })

  test("rejects malformed catalog entries", () => {
    const catalogPath = writeCatalog({ agents: [{ id: "missing-url" }] })

    expect(() => loadA2AAgentSources(catalogPath)).toThrow(
      "Expected id and agentCardUrl",
    )
  })
})

const writeCatalog = (content: unknown): string => {
  const directory = mkdtempSync(join(tmpdir(), "nano-code-a2a-"))
  const catalogPath = join(directory, "agents.json")
  writeFileSync(catalogPath, JSON.stringify(content))
  return catalogPath
}
