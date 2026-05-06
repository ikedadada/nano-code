import * as readline from "node:readline"
import { logger } from "@/infrastructure/logger/logger"

export const requestApproval = async (
  toolName: string,
  args: Record<string, unknown>,
): Promise<boolean> => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    logger.box("Approval Request")
    logger.info("Tool:", toolName)
    logger.info("Arguments:", JSON.stringify(args))

    rl.question("Do you approve this action? (y/n):", (answer) => {
      rl.close()

      if (answer.toLowerCase() === "y") {
        logger.success("Action approved.")
        resolve(true)
      } else {
        logger.fail("Action denied.")
        resolve(false)
      }
    })
  })
}
