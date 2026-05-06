import { afterEach, describe, expect, mock, test } from "bun:test"

type QuestionHandler = (answer: string) => void

let nextAnswer = "y"
const closeMock = mock(() => {})
const questionMock = mock((_prompt: string, handler: QuestionHandler) => {
  handler(nextAnswer)
})

mock.module("node:readline", () => ({
  createInterface: () => ({
    question: questionMock,
    close: closeMock,
  }),
}))

const { requestApproval } = await import(
  "@/infrastructure/approval/readlineApproval"
)

afterEach(() => {
  nextAnswer = "y"
  questionMock.mockClear()
  closeMock.mockClear()
})

describe("requestApproval", () => {
  test("returns true for y", async () => {
    nextAnswer = "y"

    await expect(requestApproval("writeFile", { path: "a.txt" })).resolves.toBe(
      true,
    )
    expect(questionMock).toHaveBeenCalled()
    expect(closeMock).toHaveBeenCalled()
  })

  test("returns false for non-y answers", async () => {
    nextAnswer = "n"

    await expect(requestApproval("writeFile", { path: "a.txt" })).resolves.toBe(
      false,
    )
  })
})
