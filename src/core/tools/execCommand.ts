import { spawn } from "node:child_process"
import * as path from "node:path"
import type { Tool } from "../types"

const WORKSPACE_ROOT = path.resolve(process.cwd(), "./workspace")

const ALLOWED_COMMANDS = ["bun", "ls", "git", "gh"]

const MAX_OUTPUT_LENGTH = 2024

const dangerousChars = /[;&`$]/

type Quote = null | "'" | '"'

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

const execCommandExecute = (args: { command: string }): Promise<string> => {
  // Check dangerous characters to prevent command injection
  if (dangerousChars.test(args.command)) {
    throw new Error(
      "Command contains dangerous characters that are not allowed",
    )
  }

  const parts = parseCommand(args.command)
  const commandName = parts[0]
  const commandArgs = parts.slice(1)

  if (!commandName) {
    throw new Error("No command provided")
  }

  if (!ALLOWED_COMMANDS.includes(commandName)) {
    throw new Error(
      `Command "${commandName}" is not allowed. Allowed commands are: ${ALLOWED_COMMANDS.join(", ")}`,
    )
  }

  for (const arg of commandArgs) {
    if (arg.includes("/") || arg.includes("\\")) {
      const resolvedPath = path.resolve(WORKSPACE_ROOT, arg)
      if (!resolvedPath.startsWith(WORKSPACE_ROOT)) {
        throw new Error(
          `Argument "${arg}" is not allowed because it resolves outside the workspace`,
        )
      }
    }
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
      let result = ""

      if (stdout) {
        result += stdout
      }
      if (stderr) {
        result += (stdout ? "\n" : "") + `[stderr] ${stderr}`
      }
      if (outputTruncated) {
        result += "\n...[output truncated]"
      }

      if (code !== 0) {
        result += `\n[process exited with code ${code}]`
      }

      resolve(result || "[no output]")
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
    "Only a limited set of safe commands are allowed (bun, ls, git, gh).",
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
    return await execCommandExecute(args as { command: string })
  },
}
