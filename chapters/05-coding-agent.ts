import { Agent } from "@/application/agent/Agent"
import { requestApproval } from "@/infrastructure/approval/readlineApproval"
import { createOpenAI } from "@/infrastructure/llm/providers/openai"
import { allTools } from "@/infrastructure/tools"

const openai = createOpenAI()
const model = openai("gpt-5-mini")

const codingAgent = new Agent({
  name: "nano-code",
  instructions: [
    "You are nano-code, an AI coding assistant.",
    "You help users with coding tasks by generating code and executing tools.",
    "Always try to solve the user's problem with the least number of steps and tool calls.",
    "Only use tools when necessary, and prefer generating code directly when possible.",
  ].join(""),
  model,
  tools: allTools,
  maxSteps: 20,
  verbose: true,
  approvalFunc: requestApproval,
})

const result = await codingAgent.generate(
  "Please fix the bug in the tests/example.test.ts file and make sure all tests pass.",
)

console.log("\n=== Final Result ===")
console.log(result.text)
