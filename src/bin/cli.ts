import * as path from "node:path"
import { parseArgs } from "node:util"
import { Agent } from "../core/agent"
import { loadInstructions } from "../core/prompts"
import { createModelFromEnv } from "../core/providers/modelFactory"
import { allTools } from "../core/tools"

const main = async () => {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      yolo: { type: "boolean", default: false },
      verbose: { type: "boolean", default: false },
    },
    allowPositionals: true,
  })

  const isIssueDriven =
    process.env.ISSUE_BODY !== undefined || process.env.ISSUE_TEXT !== undefined

  let userPrompt = ""

  if (isIssueDriven) {
    userPrompt = process.env.ISSUE_BODY || process.env.ISSUE_TEXT || ""
  } else {
    if (positionals.length === 0) {
      console.error("Please provide a prompt as an argument")
      console.error('Usage: bun run agent "Your prompt here"')
      process.exit(1)
    }
    userPrompt = positionals.join(" ")
  }

  const model = createModelFromEnv()

  const workspaceRoot = path.resolve(process.cwd(), "workspace")

  const instructions = loadInstructions(workspaceRoot, isIssueDriven)

  const yoloMode = values.yolo

  const agent = new Agent({
    name: "nano-code",
    model,
    instructions,
    tools: allTools,
    maxSteps: 20,
    verbose: values.verbose,
    approvalFunc: yoloMode ? async () => true : undefined,
  })

  console.log("Start agent")
  console.log("User Prompt:", userPrompt)
  console.log(["\n", "-".repeat(60)].join(""))

  try {
    const result = await agent.generate(userPrompt)
    console.log(result.text)
    console.log(["\n", "-".repeat(60)].join(""))
    console.log("Finished task")
  } catch (error) {
    console.error("\n Unexpected error: ", error)
    process.exit(1)
  }
}

main()
