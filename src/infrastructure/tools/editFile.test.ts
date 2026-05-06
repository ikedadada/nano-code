import { afterEach, describe, expect, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { editFile } from "@/infrastructure/tools/editFile"

const testDir = path.resolve(process.cwd(), "workspace/test-edit-file")

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true })
})

describe("editFile", () => {
  test("replaces a unique text range inside the workspace", async () => {
    await fs.mkdir(testDir, { recursive: true })
    const filePath = path.join(testDir, "example.txt")
    await fs.writeFile(filePath, "before TARGET after")

    await expect(
      editFile.execute({
        path: "test-edit-file/example.txt",
        oldText: "TARGET",
        newText: "updated",
      }),
    ).resolves.toBe("File edited successfully at test-edit-file/example.txt")

    await expect(fs.readFile(filePath, "utf-8")).resolves.toBe(
      "before updated after",
    )
  })

  test("rejects ambiguous replacements", async () => {
    await fs.mkdir(testDir, { recursive: true })
    await fs.writeFile(path.join(testDir, "example.txt"), "same same")

    await expect(
      editFile.execute({
        path: "test-edit-file/example.txt",
        oldText: "same",
        newText: "updated",
      }),
    ).rejects.toThrow("found multiple times")
  })
})
