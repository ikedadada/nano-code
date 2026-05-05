import { spawn } from "node:child_process"

export interface SandboxOptions {
  cwd?: string
  allowNetwork?: boolean
  env?: Record<string, string>
}

export interface SandboxResult {
  stdout: string
  stderr: string
  exitCode: number
}

export class Sandbox {
  async run(
    command: string,
    args: string[],
    options: SandboxOptions = {},
  ): Promise<SandboxResult> {
    const cwd = options.cwd || process.cwd()

    const bwrapArgs: string[] = [
      // Bind the root filesystem as read-only to prevent system damage
      "--ro-bind",
      "/",
      "/",
      // Create fresh device files and a temporary directory
      "--dev",
      "/dev",
      "--tmpfs",
      "/tmp",
      // Bind only the working directory with write permission
      "--bind",
      cwd,
      cwd,
      "--chdir",
      cwd,
      // Terminate the sandbox when the parent process (Bun) exits to prevent zombies
      "--die-with-parent",
      // Clear environment variables to prevent leaking secrets
      "--clearenv",
    ]

    const envVars = {
      PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
      HOME: "/tmp",
      ...options.env,
    }
    for (const [key, value] of Object.entries(envVars)) {
      bwrapArgs.push("--setenv", key, value)
    }

    if (!options.allowNetwork) {
      bwrapArgs.push("--unshare-net")
    }

    bwrapArgs.push("--", command, ...args)

    return new Promise((resolve) => {
      const child = spawn("bwrap", bwrapArgs, {
        stdio: "pipe",
      })

      let stdout = ""
      let stderr = ""

      child.stdout.on("data", (d) => (stdout += d.toString()))
      child.stderr.on("data", (d) => (stderr += d.toString()))

      child.on("close", (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1,
        })
      })

      child.on("error", (err) => {
        resolve({
          stdout: "",
          stderr:
            `Sandbox Error: ${err.message}\n` +
            "(Hint: check the --cap-add=SYS_ADMIN option for docker run)",
          exitCode: 126,
        })
      })
    })
  }
}
