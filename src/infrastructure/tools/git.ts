import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { z } from "zod"
import type { Tool } from "../../domain/types"
import { execCommand } from "./execCommand"

const WORKSPACE_ROOT = join(process.cwd(), "workspace")

function validateBranchName(name: string): void {
  if (!name || name.length > 120) {
    throw new Error("Invalid branch name")
  }
  if (name.startsWith("-") || name.startsWith(":")) {
    throw new Error("Branch name cannot start with '-' or ':'")
  }
  if (/\s/.test(name)) {
    throw new Error("Branch name cannot contain whitespace")
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(name)) {
    throw new Error("Branch name contains invalid characters")
  }
  if (
    name.includes("..") ||
    name.includes("//") ||
    name.endsWith("/") ||
    name.endsWith(".")
  ) {
    throw new Error("Invalid branch name format")
  }
}

function validateFilePath(filePath: string): void {
  if (!filePath) {
    throw new Error("File path is empty")
  }
  if (filePath.startsWith("-")) {
    throw new Error("File path cannot start with '-'")
  }
  if (/[[\r\n\0]]/.test(filePath)) {
    throw new Error("File path contains invalid control characters")
  }
}

function writeTempFile(content: string, prefix: string): string {
  if (!existsSync(WORKSPACE_ROOT)) {
    mkdirSync(WORKSPACE_ROOT, { recursive: true })
  }
  const tempDir = mkdtempSync(join(WORKSPACE_ROOT, `.${prefix}-`))
  const tempPath = join(tempDir, "content.txt")
  writeFileSync(tempPath, content, "utf-8")
  return tempPath
}

export const createBranch: Tool = {
  name: "createBranch",
  description: "Create a new Git branch. Fails if the branch already exists.",
  needsApproval: true,
  parameters: {
    type: "object",
    properties: {
      branchName: {
        type: "string",
        description: "Branch name to create (e.g. 'fix/error-handling')",
      },
    },
    required: ["branchName"],
  },
  execute: async (args) => {
    const argsSchema = z.object({
      branchName: z.string(),
    })
    const parsedArgs = argsSchema.parse(args)

    const branchName = parsedArgs.branchName
    validateBranchName(branchName)

    try {
      const result = await execCommand.execute({
        commandName: "git",
        commandArgs: ["switch", "-c", branchName],
      })
      return `Branch created: ${branchName}\n${result}`
    } catch (error) {
      throw new Error(`Branch creation failed: ${error}`)
    }
  },
}

export const commit: Tool = {
  name: "commit",
  description:
    "Commit changes with a message. If there are no changes, do not commit.",
  needsApproval: true,
  parameters: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "Commit message",
      },
      files: {
        type: "array",
        items: {
          type: "string",
        },
        description: "List of file paths to commit",
      },
    },
    required: ["message", "files"],
  },
  execute: async (args) => {
    const argsSchema = z.object({
      message: z.string(),
      files: z.array(z.string()),
    })
    const parsedArgs = argsSchema.parse(args)

    if (!parsedArgs.message || /[\0]/.test(parsedArgs.message)) {
      throw new Error("Invalid commit message")
    }

    try {
      const status = await execCommand.execute({
        commandName: "git",
        commandArgs: ["status", "--porcelain"],
      })

      if (!status.trim()) {
        return "No changes to commit (already up to date)"
      }

      for (const file of parsedArgs.files) {
        validateFilePath(file)
        await execCommand.execute({
          commandName: "git",
          commandArgs: ["add", "--", file],
        })
      }

      const messageFile = writeTempFile(parsedArgs.message, "commit-message")
      try {
        const result = await execCommand.execute({
          commandName: "git",
          commandArgs: ["commit", "-F", messageFile],
        })
        return `Committed: ${parsedArgs.message}\n${result}`
      } finally {
        try {
          rmSync(dirname(messageFile), { recursive: true, force: true })
        } catch {
          /* ignore */
        }
      }
    } catch (error) {
      throw new Error(`Commit failed: ${error}`)
    }
  },
}

export const pushBranch: Tool = {
  name: "pushBranch",
  description:
    "Push the current branch to the remote repository. If it is a new branch, set the upstream.",
  needsApproval: true,
  parameters: {
    type: "object",
    properties: {
      branchName: {
        type: "string",
        description: "Branch name to push",
      },
    },
    required: ["branchName"],
  },
  execute: async (args) => {
    const argsSchema = z.object({
      branchName: z.string(),
    })
    const parseArgs = argsSchema.parse(args)
    validateBranchName(parseArgs.branchName)
    try {
      const result = await execCommand.execute({
        commandName: "git",
        commandArgs: ["push", "-u", "origin", parseArgs.branchName],
      })
      return `Branch pushed: ${parseArgs.branchName}\n${result}`
    } catch (error) {
      throw new Error(`Push failed: ${error}`)
    }
  },
}
