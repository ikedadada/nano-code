import * as fs from "node:fs/promises"
import * as path from "node:path"
import { z } from "zod"
import type { Tool } from "../../domain/types"
import { isErrnoException } from "../../helper"

const WORKSPACE_ROOT = path.resolve(process.cwd(), "./workspace")

const MAX_FILE_SIZE = 100 * 1024 // 100 KB

const readFileExecute = async (args: { path: string }): Promise<string> => {
  const absolutePath = path.resolve(WORKSPACE_ROOT, args.path)

  // Ensure the path is within the workspace (early check)
  const allowPrefix = WORKSPACE_ROOT + path.sep
  if (
    !absolutePath.startsWith(allowPrefix) &&
    absolutePath !== WORKSPACE_ROOT
  ) {
    throw new Error("Access denied: Path must be within the workspace")
  }

  try {
    // Ensure the path is within the workspace (after resolving symlinks)
    const realPath = await fs.realpath(absolutePath)
    if (!realPath.startsWith(allowPrefix) && realPath !== WORKSPACE_ROOT) {
      throw new Error("Access denied: Path must be within the workspace")
    }

    const stat = await fs.stat(absolutePath)

    if (!stat.isFile()) {
      throw new Error("The specified path is not a file")
    }

    if (stat.size > MAX_FILE_SIZE) {
      throw new Error("File size exceeds the maximum allowed limit of 100 KB")
    }
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") {
      throw new Error("File not found")
    } else {
      throw err
    }
  }

  const content = await fs.readFile(absolutePath, "utf-8")
  return content
}

export const readFile: Tool = {
  name: "readFile",
  description: [
    "Reads the contents of a file at the specified path within the workspace as a string.",
    "Returns an error if the file does not exist.",
    'Files larger than 100 KB cannot be read to protect the context window. path should be relative to the workspace root and must not contain any path traversal characters (e.g., "..").',
    "The path can be specified as either a relative or absolute path. the content of a file within the workspace.",
  ].join(""),
  needsApproval: false,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The relative path to the file within the workspace",
      },
    },
    required: ["path"],
  },
  execute: async (args) => {
    const argsSchema = z.object({
      path: z.string(),
    })
    return await readFileExecute(argsSchema.parse(args))
  },
}
