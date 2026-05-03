import * as path from "node:path"
import { Agent } from "../core/agent"
import { loadInstructions } from "../core/prompts"
import { createModelFromEnv } from "../core/providers/modelFactory"
import { allTools } from "../core/tools"

const main = async () => {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error("Please provide a prompt as an argument")
    console.error('Usage: bun run agent "Your prompt here"')
    process.exit(1)
  }

  const userPrompt = args.join(" ")

  const model = createModelFromEnv()

  const workspaceRoot = path.resolve(process.cwd(), "workspace")

  const instructions = loadInstructions(workspaceRoot)

  const agent = new Agent({
    name: "nano-code",
    model,
    instructions,
    tools: allTools,
    maxSteps: 15,
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
