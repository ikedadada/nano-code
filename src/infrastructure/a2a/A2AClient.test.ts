import { afterEach, describe, expect, mock, test } from "bun:test"
import { A2AClient } from "@/infrastructure/a2a/A2AClient"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("A2AClient", () => {
  test("fetches an Agent Card with bearer auth", async () => {
    const fetchMock = mock(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers)
        expect(headers.get("authorization")).toBe("Bearer secret-token")

        return Response.json({
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
        })
      },
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const client = new A2AClient()

    await expect(
      client.fetchAgentCard(
        "http://remote.example/.well-known/agent-card.json",
        "secret-token",
      ),
    ).resolves.toMatchObject({
      name: "Remote Agent",
      url: "http://remote.example/a2a",
    })
  })

  test("sends message/send to a remote A2A agent", async () => {
    const fetchMock = mock(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers)
        const body = JSON.parse(String(init?.body))

        expect(headers.get("content-type")).toBe("application/json")
        expect(headers.get("authorization")).toBe("Bearer secret-token")
        expect(body).toMatchObject({
          jsonrpc: "2.0",
          method: "message/send",
          params: {
            message: {
              role: "user",
              parts: [{ kind: "text", text: "hello remote" }],
            },
          },
        })
        expect(body.id).toBeString()
        expect(body.params.message.messageId).toBeString()

        return Response.json({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            kind: "message",
            messageId: "agent-message-1",
            role: "agent",
            parts: [
              { kind: "text", text: "hello" },
              { kind: "text", text: "from remote" },
            ],
          },
        })
      },
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const client = new A2AClient()

    await expect(
      client.sendMessage(
        {
          id: "remote-agent",
          name: "Remote Agent",
          url: "http://remote.example/a2a",
          bearerToken: "secret-token",
        },
        "hello remote",
      ),
    ).resolves.toBe("hello\nfrom remote")
    expect(fetchMock).toHaveBeenCalledWith(
      "http://remote.example/a2a",
      expect.objectContaining({ method: "POST" }),
    )
  })

  test("extracts text from Docker Agent artifact responses", async () => {
    const fetchMock = mock(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body))

        return Response.json({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            artifacts: [
              {
                parts: [{ kind: "text", text: "Ahoy from Docker Agent." }],
              },
            ],
          },
        })
      },
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const client = new A2AClient()

    await expect(
      client.sendMessage(
        {
          id: "pirate",
          name: "Pirate",
          url: "http://localhost:9000/invoke",
        },
        "say hello",
      ),
    ).resolves.toBe("Ahoy from Docker Agent.")
  })

  test("extracts text from nested A2A task responses", async () => {
    globalThis.fetch = mock(async (_url, init) => {
      const body = JSON.parse(String(init?.body))

      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          kind: "task",
          id: "task-1",
          status: {
            state: "completed",
            message: {
              kind: "message",
              role: "agent",
              parts: [{ text: "Ahoy, matey! Hello." }],
            },
          },
        },
      })
    }) as unknown as typeof fetch

    const client = new A2AClient()

    await expect(
      client.sendMessage(
        {
          id: "pirate",
          name: "Pirate",
          url: "http://localhost:9000/invoke",
        },
        "say hello",
      ),
    ).resolves.toBe("Ahoy, matey! Hello.")
  })

  test("prefers agent output over echoed user prompt in task history", async () => {
    globalThis.fetch = mock(async (_url, init) => {
      const body = JSON.parse(String(init?.body))

      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          kind: "task",
          history: [
            {
              kind: "message",
              role: "user",
              parts: [{ kind: "text", text: "Say hello in pirate style." }],
            },
            {
              kind: "message",
              role: "agent",
              parts: [{ kind: "text", text: "Ahoy, matey! Hello." }],
            },
          ],
        },
      })
    }) as unknown as typeof fetch

    const client = new A2AClient()

    await expect(
      client.sendMessage(
        {
          id: "pirate",
          name: "Pirate",
          url: "http://localhost:9000/invoke",
        },
        "say hello",
      ),
    ).resolves.toBe("Ahoy, matey! Hello.")
  })

  test("surfaces failed Docker Agent task status", async () => {
    globalThis.fetch = mock(async (_url, init) => {
      const body = JSON.parse(String(init?.body))

      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          kind: "task",
          status: {
            state: "failed",
            message: {
              kind: "message",
              role: "agent",
              parts: [
                {
                  kind: "text",
                  text: "agent run failed: model failed: HTTP 401 Unauthorized",
                },
              ],
            },
          },
          history: [
            {
              kind: "message",
              role: "user",
              parts: [{ kind: "text", text: "Say hello in pirate style." }],
            },
          ],
        },
      })
    }) as unknown as typeof fetch

    const client = new A2AClient()

    await expect(
      client.sendMessage(
        {
          id: "pirate",
          name: "Pirate",
          url: "http://localhost:9000/invoke",
        },
        "say hello",
      ),
    ).rejects.toThrow(
      "A2A agent 'pirate' failed: agent run failed: model failed: HTTP 401 Unauthorized",
    )
  })

  test("surfaces JSON-RPC errors from the remote A2A agent", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({
        jsonrpc: "2.0",
        id: "req-1",
        error: { code: -32602, message: "Invalid params" },
      }),
    ) as unknown as typeof fetch

    const client = new A2AClient()

    await expect(
      client.sendMessage(
        {
          id: "remote-agent",
          name: "Remote Agent",
          url: "http://remote.example/a2a",
        },
        "hello",
      ),
    ).rejects.toThrow(
      "A2A agent 'remote-agent' returned JSON-RPC error -32602: Invalid params",
    )
  })
})
