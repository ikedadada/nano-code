import { describe, expect, test } from "bun:test"
import { allTools } from "@/infrastructure/tools"

describe("allTools", () => {
  test("registers each tool once in the expected order", () => {
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
})
