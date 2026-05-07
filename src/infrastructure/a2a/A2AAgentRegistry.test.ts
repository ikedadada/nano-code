import { afterEach, describe, expect, mock, test } from "bun:test"
import type { A2AAgentCard } from "@/domain/a2a"
import { A2AAgentRegistry } from "@/infrastructure/a2a/A2AAgentRegistry"

const originalWarn = console.warn

afterEach(() => {
  console.warn = originalWarn
})

describe("A2AAgentRegistry", () => {
  test("uses an empty registry by default", () => {
    expect(new A2AAgentRegistry().list()).toEqual([])
  })

  test("discovers registered agents from Agent Card sources", async () => {
    const card: A2AAgentCard = {
      protocolVersion: "0.3.0",
      name: "Remote Agent",
      description: "Remote A2A agent.",
      url: "http://remote.example/a2a",
      preferredTransport: "JSONRPC",
      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: false,
      },
      defaultInputModes: ["text/plain"],
      defaultOutputModes: ["text/plain"],
      skills: [],
    }

    const registry = await A2AAgentRegistry.discover(
      [
        {
          id: "remote-agent",
          agentCardUrl: "http://remote.example/.well-known/agent-card.json",
          bearerToken: "secret-token",
        },
      ],
      {
        fetchAgentCard: async (url, token) => {
          expect(url).toBe("http://remote.example/.well-known/agent-card.json")
          expect(token).toBe("secret-token")
          return card
        },
      },
    )

    expect(registry.list()).toEqual([
      {
        id: "remote-agent",
        cardUrl: "http://remote.example/.well-known/agent-card.json",
        endpointUrl: "http://remote.example/a2a",
        bearerToken: "secret-token",
        card,
      },
    ])
  })

  test("uses source endpoint override when the Agent Card URL is not the invocation endpoint", async () => {
    const card: A2AAgentCard = {
      protocolVersion: "0.3.0",
      name: "Docker Agent",
      description: "Docker-hosted A2A agent.",
      url: "http://localhost:9000/unused-card-url",
      preferredTransport: "JSONRPC",
      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: false,
      },
      defaultInputModes: ["text/plain"],
      defaultOutputModes: ["text/plain"],
      skills: [],
    }

    const registry = await A2AAgentRegistry.discover(
      [
        {
          id: "docker-agent",
          agentCardUrl: "http://localhost:9000/.well-known/agent-card",
          endpointUrl: "http://localhost:9000/invoke",
        },
      ],
      {
        fetchAgentCard: async () => card,
      },
    )

    expect(registry.list()[0]).toMatchObject({
      id: "docker-agent",
      cardUrl: "http://localhost:9000/.well-known/agent-card",
      endpointUrl: "http://localhost:9000/invoke",
    })
  })

  test("skips agents whose Agent Card cannot be fetched", async () => {
    const warn = mock(() => {})
    console.warn = warn as unknown as typeof console.warn
    const card: A2AAgentCard = {
      protocolVersion: "0.3.0",
      name: "Available Agent",
      description: "Available A2A agent.",
      url: "http://available.example/a2a",
      preferredTransport: "JSONRPC",
      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: false,
      },
      defaultInputModes: ["text/plain"],
      defaultOutputModes: ["text/plain"],
      skills: [],
    }

    const registry = await A2AAgentRegistry.discover(
      [
        {
          id: "offline-agent",
          agentCardUrl: "http://offline.example/.well-known/agent-card.json",
        },
        {
          id: "available-agent",
          agentCardUrl: "http://available.example/.well-known/agent-card.json",
        },
      ],
      {
        fetchAgentCard: async (url) => {
          if (url.includes("offline")) {
            throw new Error("connection refused")
          }

          return card
        },
      },
    )

    expect(registry.list()).toEqual([
      {
        id: "available-agent",
        cardUrl: "http://available.example/.well-known/agent-card.json",
        endpointUrl: "http://available.example/a2a",
        card,
      },
    ])
    expect(warn).toHaveBeenCalledWith(
      "A2A agent 'offline-agent' skipped: failed to fetch Agent Card from http://offline.example/.well-known/agent-card.json. connection refused",
    )
  })
})
