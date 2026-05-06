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
}

function validateTitle(title: string): void {
  if (!title || title.length > 200) {
    throw new Error("Invalid PR title")
  }
  if (/[\r\n\0]/.test(title)) {
    throw new Error("PR title cannot contain newlines or control characters")
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

export const createPullRequest: Tool = {
  name: "createPullRequest",
  description:
    "Create a PR using GitHub CLI. If an existing PR is found, update it.",
  needsApproval: true,
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "PR title",
      },
      body: {
        type: "string",
        description: "PR body",
      },
      head: {
        type: "string",
        description: "Source branch name (e.g. 'fix/error-handling')",
      },
      base: {
        type: "string",
        description: "Target branch name (usually 'main')",
      },
    },
    required: ["title", "body", "head", "base"],
  },
  execute: async (args) => {
    const argsSchema = z.object({
      title: z.string(),
      body: z.string(),
      head: z.string(),
      base: z.string(),
    })
    const parsedArgs = argsSchema.parse(args)
    validateTitle(parsedArgs.title)
    validateBranchName(parsedArgs.head)
    validateBranchName(parsedArgs.base)

    const listResult = await execCommand.execute({
      commandName: "gh",
      commandArgs: [
        "pr",
        "list",
        "--head",
        parsedArgs.head,
        "--base",
        parsedArgs.base,
        "--state",
        "open",
        "--json",
        "number",
      ],
    })

    const bodyFile = writeTempFile(parsedArgs.body, "pr-body")

    try {
      let existingPRs: unknown = []
      try {
        existingPRs = JSON.parse(listResult || "[]")
      } catch {
        // If JSON parsing fails, attempt to create a new PR.
      }

      if (Array.isArray(existingPRs) && existingPRs.length > 0) {
        const prNumber = String(existingPRs[0].number)
        await execCommand.execute({
          commandName: "gh",
          commandArgs: ["pr", "edit", prNumber, "--body-file", bodyFile],
        })
        return `Updated existing PR #${prNumber}`
      }

      const result = await execCommand.execute({
        commandName: "gh",
        commandArgs: [
          "pr",
          "create",
          "--title",
          parsedArgs.title,
          "--body-file",
          bodyFile,
          "--base",
          parsedArgs.base,
          "--head",
          parsedArgs.head,
        ],
      })
      return `Created PR: ${result}`
    } finally {
      try {
        rmSync(dirname(bodyFile), { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  },
}

export const createIssueComment: Tool = {
  name: "createIssueComment",
  description: "Post a comment on a specified Issue using GitHub CLI",
  needsApproval: true,
  parameters: {
    type: "object",
    properties: {
      issueNumber: {
        type: "number",
        description: "Number of the Issue to comment on",
      },
      body: {
        type: "string",
        description: "Comment body",
      },
    },
    required: ["issueNumber", "body"],
  },
  execute: async (args) => {
    const argsSchema = z.object({
      issueNumber: z.number().int().positive(),
      body: z.string(),
    })
    const parsedArgs = argsSchema.parse(args)

    const bodyFile = writeTempFile(parsedArgs.body, "comment-body")
    try {
      await execCommand.execute({
        commandName: "gh",
        commandArgs: [
          "issue",
          "comment",
          String(parsedArgs.issueNumber),
          "--body-file",
          bodyFile,
        ],
      })
      return "Comment posted"
    } finally {
      try {
        rmSync(dirname(bodyFile), { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  },
}
