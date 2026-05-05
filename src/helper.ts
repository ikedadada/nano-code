export const isErrnoException = (
  error: unknown,
): error is NodeJS.ErrnoException => {
  return error instanceof Error && "code" in error
}

export const parseJsonObject = (jsonText: string): Record<string, unknown> => {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText || "{}")
  } catch (error) {
    throw new Error(`Invalid JSON: ${(error as Error).message}`)
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON value must be an object")
  }

  return parsed as Record<string, unknown>
}
