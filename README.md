# nano-code

## Architecture

The source tree follows a DDD and Clean Architecture oriented layout:

- `src/domain`: domain model types shared by the agent runtime.
- `src/application`: use cases and ports. This layer coordinates agent
  behavior and depends only on domain abstractions.
- `src/infrastructure`: adapters for external systems, including LLM
  providers, tools, approval prompts, prompts, and sandbox execution.
- `src/interfaces`: interface controllers and request/response boundaries. The
  agent runner is independent of CLI parsing and terminal output.
- `src/interfaces/cli`: CLI-specific argument parsing and terminal rendering.
- `src/bin`: thin executable wrappers that call interface entry points.

The intended dependency direction is:

`interfaces -> application -> domain`

Infrastructure implementations are wired at the interface/composition boundary
and should not be imported by application use cases directly.

Imports for files under `src` should use the `@/*` path alias, which resolves to
`src/*`.

CLI code should adapt command-line input into a CLI-independent interface
request, call the interface runner, and render the response.

## CLI

```sh
bun run agent [options] "Your prompt here"
```

Options:

- `-y, --yolo`: approve all tool calls.
- `-v, --verbose`: show debug logs.
- `-s, --sandbox`: run commands in sandbox.
- `-S, --streaming`: stream model output.
- `-d, --allowed-domains <domains>`: comma-separated domains allowed for web
  fetch.

Use `-v, --verbose` or set `LOG_LEVEL=debug` to show detailed agent step and
tool logs.

## A2A Server

```sh
bun run a2a
```

The Hono-based A2A server exposes:

- `GET /.well-known/agent-card.json`: A2A Agent Card discovery.
- `POST /a2a`: JSON-RPC 2.0 endpoint supporting `message/send`.
- `GET /docs`: Swagger UI for the A2A OpenAPI specification.

Environment variables:

- `PORT`: HTTP port, default `3000`.
- `HOST`: host name used to build the default Agent Card URL, default
  `localhost`.
- `A2A_AGENT_URL`: explicit Agent Card service URL, default
  `http://{HOST}:{PORT}/a2a`.
- `A2A_AUTH_TOKEN`: Bearer token required by `POST /a2a`. When set, the Agent
  Card declares `bearerAuth` in `securitySchemes` and `security`.
- `A2A_UNSAFE_ALLOW_NO_AUTH`: set to `true` to allow unauthenticated local
  development only. Without `A2A_AUTH_TOKEN`, the server binds and advertises
  `127.0.0.1` and ignores `A2A_AGENT_URL`.
- `A2A_SANDBOX`: set to `true` to run tool commands through the sandbox.
- `A2A_ALLOWED_DOMAINS`: comma-separated domains allowed for web fetch.

A2A requests run non-interactively after authentication, so tool approval is
automatically granted for authenticated requests.

## Calling Remote A2A Agents

Remote A2A agents are discovered from Agent Card URLs and exposed to the model
as skill-specific tools. Available agents are listed in
`src/infrastructure/a2a/agents.json`; agents whose Agent Card cannot be fetched
at startup are skipped.

Agent catalog fields:

- `id`: stable local identifier used in generated tool names.
- `agentCardUrl`: Agent Card URL.
- `endpointUrl`: optional JSON-RPC invocation endpoint override.
- `bearerTokenEnv`: optional environment variable name for a bearer token.

Docker Agent smoke test:

```sh
docker agent serve a2a agentcatalog/pirate --env-from-file .env
```

In another terminal:

```sh
bun run agent -v -y "Ask the pirate A2A agent to say hello"
```
