import { Agent } from "../application/agent/Agent"
import { config } from "../config"
import { requestApproval } from "../infrastructure/approval/readlineApproval"
import { createModelFromEnv } from "../infrastructure/llm/providers/modelFactory"
import { loadInstructions } from "../infrastructure/prompts"
import { allTools } from "../infrastructure/tools"

export type RunAgentRequest = {
  prompt: string
  issueDriven: boolean
  verbose: boolean
  streaming: boolean
  yolo: boolean
  sandbox: boolean
  allowedDomains: string[]
  workspaceRoot: string
}

export type RunAgentResponse = {
  text: string
}

export const runAgent = async (
  request: RunAgentRequest,
): Promise<RunAgentResponse> => {
  config.sandbox = request.sandbox
  config.allowedDomains.push(...request.allowedDomains)

  const model = createModelFromEnv()
  const instructions = loadInstructions(
    request.workspaceRoot,
    request.issueDriven,
  )

  const agent = new Agent({
    name: "nano-code",
    model,
    instructions,
    tools: allTools,
    maxSteps: 20,
    verbose: request.verbose,
    useStreaming: request.streaming,
    approvalFunc: request.yolo ? async () => true : requestApproval,
  })

  return await agent.generate(request.prompt)
}
