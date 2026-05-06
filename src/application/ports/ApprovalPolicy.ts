export type ApprovalPolicy = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<boolean>
