import { afterEach, describe, expect, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { readFile } from "@/infrastructure/tools/readFile"

const testDir = path.resolve(process.cwd(), "workspace/test-read-file")

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true })
})

describe("readFile", () => {
  test("reads a file inside the workspace", async () => {
    await fs.mkdir(testDir, { recursive: true })
    await fs.writeFile(path.join(testDir, "example.txt"), "hello workspace")

    await expect(
      readFile.execute({ path: "test-read-file/example.txt" }),
    ).resolves.toBe("hello workspace")
  })

  test("rejects paths that resolve outside the workspace", async () => {
    await expect(readFile.execute({ path: "../outside.txt" })).rejects.toThrow(
      "Access denied",
    )
  })
})
