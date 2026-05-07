import { Agent } from "@/application/agent/Agent"
import { config } from "@/config"
import { A2AAgentRegistry } from "@/infrastructure/a2a/A2AAgentRegistry"
import { loadA2AAgentSources } from "@/infrastructure/a2a/loadA2AAgentSources"
import { requestApproval } from "@/infrastructure/approval/readlineApproval"
import { createModelFromEnv } from "@/infrastructure/llm/providers/modelFactory"
import { loadInstructions } from "@/infrastructure/prompts"
import { createTools } from "@/infrastructure/tools"

export type RunAgentRequest = {
  prompt: string
  issueDriven: boolean
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
  const a2aAgentSources = loadA2AAgentSources()
  const a2aRegistry =
    a2aAgentSources.length > 0
      ? await A2AAgentRegistry.discover(a2aAgentSources)
      : undefined

  const agent = new Agent({
    name: "nano-code",
    model,
    instructions,
    tools: createTools({ a2aRegistry }),
    maxSteps: 20,
    useStreaming: request.streaming,
    approvalFunc: request.yolo ? async () => true : requestApproval,
  })

  return await agent.generate(request.prompt)
}
