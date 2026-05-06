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

export const allTools = [
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
]
