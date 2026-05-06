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
- `-v, --verbose`: show verbose logs.
- `-s, --sandbox`: run commands in sandbox.
- `-S, --streaming`: stream model output.
- `-d, --allowed-domains <domains>`: comma-separated domains allowed for web
  fetch.
