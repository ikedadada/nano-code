import { spawn } from "node:child_process"
import * as path from "node:path"
import { z } from "zod"
import { config } from "@/config"
import type { Tool } from "@/domain/types"
import { Sandbox } from "@/infrastructure/process/Sandbox"

const WORKSPACE_ROOT = path.resolve(process.cwd(), "./workspace")

const SAFE_ENV = {
  PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
  HOME: "/tmp",
  LANG: process.env.LANG || "C.UTF-8",
}

const ALLOWED_COMMANDS = ["bun", "ls", "git", "gh"]

const MAX_OUTPUT_LENGTH = 2024

const dangerousChars = /[;&`$]/

type Quote = null | "'" | '"'

type ExecCommandArgs =
  | { command: string }
  | { commandName: string; commandArgs: string[] }

const parseCommand = (input: string): string[] => {
  const tokens: string[] = []

  let current = ""
  let quote: Quote = null
  let escaped = false

  for (const ch of input) {
    if (quote) {
      if (escaped) {
        current += ch
        escaped = false
        continue
      }
      if (ch === "\\" && quote === '"') {
        escaped = true
        continue
      }
      if (ch === quote) {
        quote = null
        continue
      }
      current += ch
      continue
    }

    if (ch === "'" || ch === '"') {
      quote = ch
      continue
    }

    if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current)
        current = ""
      }
      continue
    }

    current += ch
  }

  if (quote) throw new Error(`Unclosed quote: ${quote}`)
  if (current.length > 0) tokens.push(current)

  return tokens
}

const validateAllowedCommandArgs = (
  commandName: string,
  commandArgs: string[],
): void => {
  if (commandName === "bun") {
    const allowedBunCommands = [["--version"], ["-v"]]
    const isAllowed = allowedBunCommands.some(
      (allowedArgs) =>
        allowedArgs.length === commandArgs.length &&
        allowedArgs.every((arg, index) => commandArgs[index] === arg),
    )

    if (!isAllowed) {
      throw new Error(
        'Command "bun" is restricted to "--version" or "-v"',
      )
    }
  }
}

const execCommandExecute = async (args: ExecCommandArgs): Promise<string> => {
  let commandName: string
  let commandArgs: string[]

  if ("command" in args) {
    // Check dangerous characters to prevent command injection
    if (dangerousChars.test(args.command)) {
      throw new Error(
        "Command contains dangerous characters that are not allowed",
      )
    }

    const parts = parseCommand(args.command)
    if (parts.length === 0) {
      throw new Error("No command provided")
    }
    const first = parts[0]
    if (!first) {
      throw new Error("No command provided")
    }
    commandName = first
    commandArgs = parts.slice(1)
  } else {
    commandName = args.commandName
    commandArgs = args.commandArgs
  }

  if (!commandName) {
    throw new Error("No command provided")
  }

  if (!ALLOWED_COMMANDS.includes(commandName)) {
    throw new Error(
      `Command "${commandName}" is not allowed. Allowed commands are: ${ALLOWED_COMMANDS.join(", ")}`,
    )
  }

  validateAllowedCommandArgs(commandName, commandArgs)

  for (const arg of commandArgs) {
    if (arg.includes("/") || arg.includes("\\")) {
      const resolvedPath = path.resolve(WORKSPACE_ROOT, arg)
      const allowPrefix = WORKSPACE_ROOT + path.sep
      if (
        !resolvedPath.startsWith(allowPrefix) &&
        resolvedPath !== WORKSPACE_ROOT
      ) {
        throw new Error(
          `Argument "${arg}" is not allowed because it resolves outside the workspace`,
        )
      }
    }
  }
  if (process.platform === "linux" && config.sandbox) {
    const sandbox = new Sandbox()
    const result = await sandbox.run(commandName, commandArgs, {
      cwd: WORKSPACE_ROOT,
      allowNetwork: false,
      env: SAFE_ENV,
    })

    if (result.exitCode !== 0) {
      throw new Error(`Command failed: ${result.stderr}`)
    }
    return result.stdout
  }

  return new Promise((resolve, reject) => {
    let stdout = ""
    let stderr = ""
    let outputTruncated = false

    const child = spawn(commandName, commandArgs, {
      cwd: WORKSPACE_ROOT,
      timeout: 30000,
      shell: false,
    })

    child.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString()
      if (stdout.length + chunk.length > MAX_OUTPUT_LENGTH) {
        stdout += chunk.slice(0, MAX_OUTPUT_LENGTH - stdout.length)
        outputTruncated = true
      } else {
        stdout += chunk
      }
    })

    child.stderr.on("data", (data: Buffer) => {
      const chunk = data.toString()
      if (stderr.length + chunk.length > MAX_OUTPUT_LENGTH) {
        stderr += chunk.slice(0, MAX_OUTPUT_LENGTH - stderr.length)
        outputTruncated = true
      } else {
        stderr += chunk
      }
    })

    child.on("close", (code) => {
      const stdoutText = stdout.trim()
      const stderrText = stderr.trim()

      if (code !== 0) {
        let errorMessage = stderrText || stdoutText || "Unknown error"
        if (outputTruncated) {
          errorMessage += "\n...[output truncated]"
        }
        reject(
          new Error(
            `Command failed (${code}): ${commandName} ${commandArgs.join(" ")}` +
              (errorMessage ? `\n${errorMessage}` : ""),
          ),
        )
        return
      }

      if (stdoutText) {
        resolve(
          outputTruncated ? `${stdoutText}\n...[output truncated]` : stdoutText,
        )
        return
      }

      if (stderrText) {
        resolve(
          outputTruncated ? `${stderrText}\n...[output truncated]` : stderrText,
        )
        return
      }

      resolve(outputTruncated ? "...[output truncated]" : "[no output]")
    })

    child.on("error", (err) => {
      reject(new Error(`Failed to execute command: ${err.message}`))
    })
  })
}

export const execCommand: Tool = {
  name: "execCommand",
  description: [
    "Executes a shell command and returns its output as a string.",
    "Only a limited set of safe commands are allowed (bun --version, bun -v, ls, git, gh).",
    "Commands must not contain dangerous characters (e.g., ; & ` $) to prevent command injection.",
    "Arguments that resolve to paths must be within the workspace.",
    "Output is limited to 2024 characters to prevent excessive token usage.",
  ].join(" "),
  needsApproval: true,
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The shell command to execute",
      },
    },
    required: ["command"],
  },
  execute: async (args) => {
    const argsSchema = z.union([
      z.object({
        command: z.string(),
      }),
      z.object({
        commandName: z.string(),
        commandArgs: z.array(z.string()),
      }),
    ])
    return await execCommandExecute(argsSchema.parse(args))
  },
}
