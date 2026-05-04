import { editFile } from "./editFile"
import { execCommand } from "./execCommand"
import { commit, createBranch, pushBranch } from "./git"
import { createIssueComment, createPullRequest } from "./github"
import { readFile } from "./readFile"
import { writeFile } from "./writeFile"

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
]
