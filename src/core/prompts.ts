import * as fs from "node:fs"
import * as path from "node:path"

export const loadInstructions = (workspaceRoot: string): string => {
  const basePath = path.resolve(__dirname, "prompts.md")
  const base = fs.readFileSync(basePath, "utf-8")

  const agentMdPath = path.join(workspaceRoot, "agent.md")
  if (fs.existsSync(agentMdPath)) {
    const agentsMd = fs.readFileSync(agentMdPath, "utf-8")
    return `${base}\n\n# Project-Specific Instructions\n\n${agentsMd}`
  }
  return base
}
