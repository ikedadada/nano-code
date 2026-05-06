import { type ConsolaInstance, createConsola } from "consola"

const parseLogLevel = (value: string | undefined): number | undefined => {
  if (!value) return undefined

  const normalized = value.trim().toLowerCase()
  const numericLevel = Number(normalized)
  if (Number.isInteger(numericLevel)) return numericLevel

  switch (normalized) {
    case "silent":
      return -999
    case "error":
      return 0
    case "warn":
      return 1
    case "log":
      return 2
    case "info":
      return 3
    case "debug":
      return 4
    case "trace":
    case "verbose":
      return 5
    default:
      return undefined
  }
}

export const createLogger = (
  env: NodeJS.ProcessEnv = process.env,
): ConsolaInstance => {
  const level = parseLogLevel(env.LOG_LEVEL ?? env.CONSOLA_LEVEL)

  return createConsola({
    ...(level !== undefined && { level }),
  })
}

export const logger = createLogger()
