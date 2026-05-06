import { describe, expect, test } from "bun:test"
import { Agent } from "@/application/agent/Agent"
import type {
  GenerateParams,
  GenerateTextResult,
  LanguageModel,
  StreamChunk,
  Tool,
} from "@/domain/types"

const result = (
  text: string,
  toolCalls: GenerateTextResult["toolCalls"] = [],
): GenerateTextResult => ({
  text,
  finishReason: toolCalls.length > 0 ? "tool_call" : "stop",
  toolCalls,
  usage: {},
})

describe("Agent", () => {
  test("executes an approved tool call and sends the result back to the model", async () => {
    const seenMessages: GenerateParams["messages"][] = []
    const model: LanguageModel = {
      async doGenerate(params) {
        seenMessages.push([...params.messages])

        if (seenMessages.length === 1) {
          return result("need tool", [
            {
              toolCallId: "call-1",
              name: "echo",
              args: { value: "hello" },
            },
          ])
        }

        return result("done")
      },
      async *doStream(): AsyncIterable<StreamChunk> {
        yield { kind: "done", finishReason: "stop", toolCalls: [], usage: {} }
      },
    }

    const toolCalls: Record<string, unknown>[] = []
    const tool: Tool = {
      name: "echo",
      description: "Echoes a value",
      needsApproval: true,
      parameters: { type: "object" },
      execute: async (args) => {
        toolCalls.push(args)
        return `echo:${args.value}`
      },
    }

    const agent = new Agent({
      name: "test-agent",
      instructions: "You are a test agent.",
      model,
      tools: [tool],
      maxSteps: 3,
      approvalFunc: async () => true,
    })

    await expect(agent.generate("run")).resolves.toEqual({ text: "done" })
    expect(toolCalls).toEqual([{ value: "hello" }])

    const secondCallMessages = seenMessages[1]
    expect(secondCallMessages?.at(-1)).toEqual({
      role: "tool",
      toolCallId: "call-1",
      name: "echo",
      content: "echo:hello",
    })
  })
})
