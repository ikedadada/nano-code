import { describe, expect, test } from "bun:test"
import { PassThrough } from "node:stream"
import { Sandbox } from "@/infrastructure/process/Sandbox"

describe("Sandbox", () => {
  test("runs commands through bwrap with isolated defaults", async () => {
    const calls: { command: string; args: string[] }[] = []
    const spawnProcess = ((command: string, args: string[]) => {
      calls.push({ command, args })

      const stdout = new PassThrough()
      const stderr = new PassThrough()
      const listeners: Record<string, (value: unknown) => void> = {}

      queueMicrotask(() => {
        stdout.end("ok")
        stderr.end("")
        listeners.close?.(0)
      })

      return {
        stdout,
        stderr,
        on(event: "close" | "error", listener: (value: unknown) => void) {
          listeners[event] = listener
          return this
        },
      }
    }) as ConstructorParameters<typeof Sandbox>[0]

    const sandbox = new Sandbox(spawnProcess)
    const result = await sandbox.run("bun", ["test"], {
      cwd: "/tmp/project",
      env: { CUSTOM_ENV: "1" },
    })

    expect(result).toEqual({ stdout: "ok", stderr: "", exitCode: 0 })
    expect(calls[0]?.command).toBe("bwrap")
    expect(calls[0]?.args).toEqual(
      expect.arrayContaining([
        "--bind",
        "/tmp/project",
        "/tmp/project",
        "--chdir",
        "/tmp/project",
        "--clearenv",
        "--setenv",
        "CUSTOM_ENV",
        "1",
        "--unshare-net",
        "--",
        "bun",
        "test",
      ]),
    )
  })
})
