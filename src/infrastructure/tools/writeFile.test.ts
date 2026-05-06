import { afterEach, describe, expect, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { writeFile } from "@/infrastructure/tools/writeFile"

const testDir = path.resolve(process.cwd(), "workspace/test-write-file")

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true })
})

describe("writeFile", () => {
  test("writes a file inside the workspace", async () => {
    await expect(
      writeFile.execute({
        path: "test-write-file/nested/example.txt",
        content: "hello workspace",
      }),
    ).resolves.toBe(
      "File written successfully to test-write-file/nested/example.txt",
    )

    await expect(
      fs.readFile(path.join(testDir, "nested/example.txt"), "utf-8"),
    ).resolves.toBe("hello workspace")
  })

  test("rejects paths that resolve outside the workspace", async () => {
    await expect(
      writeFile.execute({ path: "../outside.txt", content: "nope" }),
    ).rejects.toThrow("Access denied")
  })
})
