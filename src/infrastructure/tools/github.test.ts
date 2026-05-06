import { describe, expect, test } from "bun:test"
import {
  createIssueComment,
  createPullRequest,
} from "@/infrastructure/tools/github"

describe("github tools", () => {
  test("rejects pull request titles with newlines before running gh", async () => {
    await expect(
      createPullRequest.execute({
        title: "bad\ntitle",
        body: "body",
        head: "feature/test",
        base: "main",
      }),
    ).rejects.toThrow("PR title cannot contain newlines")
  })

  test("rejects invalid issue numbers before running gh", async () => {
    await expect(
      createIssueComment.execute({ issueNumber: 0, body: "comment" }),
    ).rejects.toThrow()
  })
})
