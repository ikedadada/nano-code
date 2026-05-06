export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 415,
    message: string,
    public body: unknown,
  ) {
    super(message)
    this.name = "HttpError"
  }
}

export class JsonRpcHttpError extends HttpError {
  constructor(
    status: 400 | 401 | 415,
    id: string | number | null,
    code: number,
    message: string,
  ) {
    super(status, message, {
      jsonrpc: "2.0",
      id,
      error: { code, message },
    })
    this.name = "JsonRpcHttpError"
  }
}
