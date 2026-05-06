import { describe, expect, test } from "bun:test"

const runCli = async (...args: string[]) => {
  const proc = Bun.spawn(["bun", "run", "src/bin/cli.ts", ...args], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return { stdout, stderr, exitCode }
}

describe("CLI", () => {
  test("renders commander help with short options", async () => {
    const result = await runCli("--help")

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("Usage: nano-code")
    expect(result.stdout).toContain("-y, --yolo")
    expect(result.stdout).toContain("-d, --allowed-domains <domains>")
  })

  test("rejects missing prompt for non-issue runs", async () => {
    const result = await runCli()

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("missing required argument 'prompt'")
  })
})
