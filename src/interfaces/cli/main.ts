import * as path from "node:path"
import { Command } from "commander"
import { logger } from "@/infrastructure/logger/logger"
import { type RunAgentRequest, runAgent } from "@/interfaces/agentRunner"

type CliOptions = {
  yolo: boolean
  verbose: boolean
  sandbox: boolean
  streaming: boolean
  allowedDomains?: string
}

export const main = async () => {
  const program = new Command()

  program
    .name("nano-code")
    .description("Run the nano-code coding agent")
    .argument("[prompt...]", "prompt to send to the agent")
    .option("-y, --yolo", "approve all tool calls", false)
    .option("-v, --verbose", "show debug logs", false)
    .option("-s, --sandbox", "run commands in sandbox", false)
    .option("-S, --streaming", "stream model output", false)
    .option(
      "-d, --allowed-domains <domains>",
      "comma-separated domains allowed for web fetch",
    )

  program.action(async (promptParts: string[], options: CliOptions) => {
    const isIssueDriven =
      process.env.ISSUE_BODY !== undefined ||
      process.env.ISSUE_TEXT !== undefined

    const userPrompt = resolvePrompt(promptParts, isIssueDriven, program)
    if (options.verbose) {
      logger.level = 4
    }

    const request: RunAgentRequest = {
      prompt: userPrompt,
      issueDriven: isIssueDriven,
      streaming: options.streaming,
      yolo: options.yolo,
      sandbox: options.sandbox,
      allowedDomains: parseAllowedDomains(options.allowedDomains),
      workspaceRoot: path.resolve(process.cwd(), "workspace"),
    }

    logger.start("Start agent")
    logger.info("User Prompt:", userPrompt)

    try {
      const result = await runAgent(request)
      logger.log(result.text)
      logger.success("Finished task")
    } catch (error) {
      logger.error("Unexpected error:", error)
      process.exit(1)
    }
  })

  await program.parseAsync(process.argv)
}

const resolvePrompt = (
  promptParts: string[],
  isIssueDriven: boolean,
  program: Command,
): string => {
  if (isIssueDriven) {
    return process.env.ISSUE_BODY || process.env.ISSUE_TEXT || ""
  }

  if (promptParts.length === 0) {
    program.error("error: missing required argument 'prompt'")
  }

  return promptParts.join(" ")
}

const parseAllowedDomains = (domains?: string): string[] => {
  if (!domains) return []

  return domains
    .split(",")
    .map((domain) => domain.trim())
    .filter(Boolean)
}
