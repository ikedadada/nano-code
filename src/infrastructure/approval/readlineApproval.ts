import * as readline from "node:readline"

export const requestApproval = async (
  toolName: string,
  args: Record<string, unknown>,
): Promise<boolean> => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    console.log(`\n--- Approval Request ---`)
    console.log(` Tool: ${toolName}`)
    console.log(` Arguments: ${JSON.stringify(args)}`)

    rl.question("Do you approve this action? (y/n):", (answer) => {
      rl.close()

      if (answer.toLowerCase() === "y") {
        console.log("Action approved.\n")
        resolve(true)
      } else {
        console.log("Action denied.\n")
        resolve(false)
      }
    })
  })
}
