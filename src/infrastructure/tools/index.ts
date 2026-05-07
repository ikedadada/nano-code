import type { A2AAgentRegistry } from "@/infrastructure/a2a/A2AAgentRegistry"
import { createA2ATools } from "@/infrastructure/a2a/createA2ATools"
import { editFile } from "@/infrastructure/tools/editFile"
import { execCommand } from "@/infrastructure/tools/execCommand"
import { commit, createBranch, pushBranch } from "@/infrastructure/tools/git"
import {
  createIssueComment,
  createPullRequest,
} from "@/infrastructure/tools/github"
import { readFile } from "@/infrastructure/tools/readFile"
import { webFetch } from "@/infrastructure/tools/webFetch"
import { writeFile } from "@/infrastructure/tools/writeFile"

export const createTools = (
  options: { a2aRegistry?: A2AAgentRegistry } = {},
) => [
  readFile,
  writeFile,
  editFile,
  execCommand,
  createBranch,
  commit,
  pushBranch,
  createPullRequest,
  createIssueComment,
  webFetch,
  ...createA2ATools(options.a2aRegistry),
]

export const allTools = createTools()
