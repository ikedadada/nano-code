import { describe, expect, test } from "bun:test"
import { isErrnoException, parseJsonObject } from "@/helper"

describe("isErrnoException", () => {
  test("returns true for Node-style errors with code", () => {
    const error = Object.assign(new Error("boom"), { code: "ENOENT" })

    expect(isErrnoException(error)).toBe(true)
  })

  test("returns false for non-errors", () => {
    expect(isErrnoException({ code: "ENOENT" })).toBe(false)
    expect(isErrnoException("boom")).toBe(false)
  })
})

describe("parseJsonObject", () => {
  test("parses a JSON object", () => {
    expect(parseJsonObject('{"name":"nano","count":2}')).toEqual({
      name: "nano",
      count: 2,
    })
  })

  test("treats empty input as an empty object", () => {
    expect(parseJsonObject("")).toEqual({})
  })

  test("rejects arrays", () => {
    expect(() => parseJsonObject("[1,2,3]")).toThrow(
      "JSON value must be an object",
    )
  })

  test("rejects invalid JSON", () => {
    expect(() => parseJsonObject("{")).toThrow("Invalid JSON:")
  })
})
