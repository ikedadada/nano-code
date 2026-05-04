import * as fs from "node:fs"
import * as path from "node:path"

export const loadInstructions = (
  workspaceRoot: string,
  isInstructions: boolean,
): string => {
  let instructions = ""

  const basePath = path.resolve(__dirname, "prompts/baseInstructions.md")
  const base = fs.readFileSync(basePath, "utf-8")

  instructions = `${base}`

  const agentMdPath = path.join(workspaceRoot, "agent.md")
  if (fs.existsSync(agentMdPath)) {
    const agentsMd = fs.readFileSync(agentMdPath, "utf-8")
    instructions = `${instructions}\n\n# Project-Specific Instructions\n\n${agentsMd}`
  }

  if (isInstructions) {
    const issuePath = path.resolve(__dirname, "prompts/issueInstructions.md")
    const issue = fs.readFileSync(issuePath, "utf-8")
    instructions = `${instructions}\n\n${issue}`
  }

  return instructions
}
