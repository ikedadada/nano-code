import { config } from "../../config"
import type { Tool } from "../types"

const webFetchExecute = async (args: { url: string }): Promise<string> => {
  const url = args.url

  let targetUrl: URL
  try {
    targetUrl = new URL(url)
  } catch {
    throw new Error("Invalid URL format")
  }

  const isAllowed = config.allowedDomains.some(
    (domain) =>
      targetUrl.hostname === domain ||
      targetUrl.hostname.endsWith(`.${domain}`),
  )

  if (!isAllowed) {
    throw new Error(
      `Security Error: Access to domain '${targetUrl.hostname}' is not allowed.\n` +
        `Allowed domains: ${config.allowedDomains.join(", ")}`,
    )
  }

  const response = await fetch(url, { redirect: "error" })
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
  }

  return await response.text()
}

export const webFetch: Tool = {
  name: "webFetch",
  description: "Fetches the web page from the specified URL",
  needsApproval: true,
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to fetch" },
    },
    required: ["url"],
  },
  execute: async (args) => {
    return await webFetchExecute(args as { url: string })
  },
}
