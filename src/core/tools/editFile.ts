import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { Tool } from "../types"

const WORKSPACE_ROOT = path.resolve(process.cwd(), "./workspace")

const editFileExecute = async (args: {
  path: string
  oldText: string
  newText: string
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

  const content = await fs.readFile(absolutePath, "utf-8")

  const matches = content.split(args.oldText).length - 1
  if (matches === 0) {
    throw new Error("The specified oldText was not found in the file")
  }
  if (matches > 1) {
    throw new Error(
      "The specified oldText was found multiple times in the file. Please provide a unique oldText.",
    )
  }

  const newContent = content.replace(args.oldText, args.newText)

  await fs.writeFile(absolutePath, newContent, "utf-8")

  return `File edited successfully at ${args.path}`
}

export const editFile: Tool = {
  name: "editFile",
  description: [
    "Edits part of a file by replacing the section specified by oldText with newText.",
    "Returns an error if oldText is found multiple times, so specify a range that uniquely identifies the target section.",
    "This uses fewer tokens than reading and writing the entire file.",
  ].join(""),
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path to the file to edit",
      },
      oldText: {
        type: "string",
        description: "The text to replace",
      },
      newText: {
        type: "string",
        description: "The new text to insert",
      },
    },
    required: ["path", "oldText", "newText"],
  },
  execute: async (args) => {
    return await editFileExecute(
      args as { path: string; oldText: string; newText: string },
    )
  },
}
