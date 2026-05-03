import { requestApproval } from "./approval"
import { generateText } from "./generateText"
import type { LanguageModel, Message, Tool } from "./types"

interface AgentConfig {
  name: string
  instruction: string
  model: LanguageModel
  tools: Tool[]
  maxSteps?: number
  verbose?: boolean
  appprovalFunc?: (
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<boolean>
}

const executeTool = async (
  tool: Tool,
  args: Record<string, unknown>,
): Promise<string> => {
  try {
    return await tool.execute(args)
  } catch (error) {
    return `Error executing tool ${tool.name}: ${(error as Error).message}`
  }
}

export class Agent {
  private name: string
  private instructions: string
  private model: LanguageModel
  private tools: Tool[]
  private maxSteps: number
  private verbose: boolean
  private approvalFunc: (
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<boolean>
  constructor(config: AgentConfig) {
    this.name = config.name
    this.instructions = config.instruction
    this.model = config.model
    this.tools = config.tools
    this.maxSteps = config.maxSteps ?? 5
    this.verbose = config.verbose ?? false
    this.approvalFunc = config.appprovalFunc ?? requestApproval
  }

  async generate(userPrompt: string): Promise<{ text: string }> {
    const messages: Message[] = [
      { role: "system", content: this.instructions },
      { role: "user", content: userPrompt },
    ]

    let currentStep = 0
    let finalText = ""
    let toolCallCount = 0

    while (currentStep < this.maxSteps) {
      currentStep++

      const response = await generateText({
        model: this.model,
        messages,
        tools: this.tools,
      })

      if (response.text) {
        finalText = response.text
        if (this.verbose) {
          console.log(
            `Step ${currentStep} - Assistant Response:`,
            response.text,
          )
        }
      }

      if (response.toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: response.text,
          toolCalls: response.toolCalls,
        })

        for (const toolCall of response.toolCalls) {
          const tool = this.tools.find((t) => t.name === toolCall.name)
          if (!tool) {
            messages.push({
              role: "tool",
              toolCallId: toolCall.toolCallId,
              name: toolCall.name,
              content: `Error: Tool not found - ${toolCall.name}`,
            })
            continue
          }

          if (this.verbose) {
            console.log(`Step ${currentStep} - Tool Call:`, toolCall)
          }

          if (tool.needsApproval) {
            const approved = await this.approvalFunc(tool.name, toolCall.args)
            if (!approved) {
              messages.push({
                role: "tool",
                toolCallId: toolCall.toolCallId,
                name: toolCall.name,
                content: `Tool call denied by user.`,
              })
              continue
            }
          }

          const result = await executeTool(tool, toolCall.args)
          toolCallCount++

          if (this.verbose) {
            console.log(`Step ${currentStep} - Tool Result:`, result)
          }

          messages.push({
            role: "tool",
            toolCallId: toolCall.toolCallId,
            name: toolCall.name,
            content: result,
          })
        }
        continue
      }

      messages.push({
        role: "assistant",
        content: response.text,
        toolCalls: [],
      })
      break
    }

    if (currentStep >= this.maxSteps) {
      console.warn(
        `Agent ${this.name} reached max steps (${this.maxSteps}) without finishing.`,
      )
    }

    if (toolCallCount === 0 && currentStep === 1) {
      console.warn(
        `Agent ${this.name} did not call any tools. Check if the instructions are clear and if the model is capable of using the tools.`,
      )
    }

    return { text: finalText }
  }
}
