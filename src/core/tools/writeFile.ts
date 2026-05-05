import * as fs from "node:fs/promises"
import * as path from "node:path"
import { isErrnoException } from "../../helper"
import type { Tool } from "../types"

const WORKSPACE_ROOT = path.resolve(process.cwd(), "./workspace")

const writeFileExecute = async (args: {
  path: string
  content: string
}): Promise<string> => {
  const absolutePath = path.resolve(WORKSPACE_ROOT, args.path)

  // Ensure the path is within the workspace
  const allowPrefix = WORKSPACE_ROOT + path.sep
  if (
    !absolutePath.startsWith(allowPrefix) &&
    absolutePath !== WORKSPACE_ROOT
  ) {
    throw new Error("Access denied: Path must be within the workspace")
  }

  // If directory does not exist, create it
  const dir = path.dirname(absolutePath)
  await fs.mkdir(dir, { recursive: true })

  let realPath: string
  try {
    realPath = await fs.realpath(absolutePath)
  } catch (err) {
    if (!isErrnoException(err) || err.code !== "ENOENT") {
      throw err
    }
    try {
      await fs.lstat(absolutePath)
      throw new Error("Access denied: Path must be within the workspace")
    } catch (lstatErr) {
      if (!isErrnoException(lstatErr) || lstatErr.code !== "ENOENT") {
        throw lstatErr
      }
    }
    realPath = path.join(await fs.realpath(dir), path.basename(absolutePath))
  }
  if (!realPath.startsWith(allowPrefix) && realPath !== WORKSPACE_ROOT) {
    throw new Error("Access denied: Path must be within the workspace")
  }

  await fs.writeFile(absolutePath, args.content, "utf-8")

  return `File written successfully to ${args.path}`
}

export const writeFile: Tool = {
  name: "writeFile",
  description: [
    "Writes the provided content to a file at the specified path within the workspace.",
    "The path should be relative to the workspace root and must not contain any path traversal characters (e.g., '..').",
    "If the file already exists, it will be overwritten. If the file does not exist, it will be created along with any necessary directories.",
  ].join(""),
  needsApproval: true,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The relative path to the file within the workspace",
      },
      content: {
        type: "string",
        description: "The content to write to the file",
      },
    },
    required: ["path", "content"],
  },
  execute: async (args) => {
    return await writeFileExecute(args as { path: string; content: string })
  },
}
