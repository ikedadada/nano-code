import { describe, expect, test } from "bun:test"
import { createLogger } from "@/infrastructure/logger/logger"

describe("createLogger", () => {
  test("uses debug level from LOG_LEVEL", () => {
    const logger = createLogger({ LOG_LEVEL: "debug" })

    expect(logger.level).toBe(4)
  })

  test("uses CONSOLA_LEVEL when LOG_LEVEL is not set", () => {
    const logger = createLogger({ CONSOLA_LEVEL: "1" })

    expect(logger.level).toBe(1)
  })
})
