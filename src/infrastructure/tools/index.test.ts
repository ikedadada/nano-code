import { describe, expect, test } from "bun:test"
import { allTools, createTools } from "@/infrastructure/tools"

describe("allTools", () => {
  test("registers base tools once in the expected order", () => {
    expect(allTools.map((tool) => tool.name)).toEqual([
      "readFile",
      "writeFile",
      "editFile",
      "execCommand",
      "createBranch",
      "commit",
      "pushBranch",
      "createPullRequest",
      "createIssueComment",
      "webFetch",
    ])
  })

  test("does not add A2A tools when no remote agents are registered", () => {
    expect(createTools().map((tool) => tool.name)).not.toContain("callA2AAgent")
  })
})
