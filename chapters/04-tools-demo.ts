import { editFile } from "../src/infrastructure/tools/editFile"
import { execCommand } from "../src/infrastructure/tools/execCommand"
import { readFile } from "../src/infrastructure/tools/readFile"
import { writeFile } from "../src/infrastructure/tools/writeFile"

async function demoTools() {
  console.log("=== Tools Demo ===\n")

  console.log("1. Writing to a file using writeFile tool...")
  const writeResult = await writeFile.execute({
    path: "demo/demo.txt",
    content: "Hello, this is a demo of the writeFile tool!",
  })
  console.log(`  Result: ${writeResult}\n`)

  console.log("2. Reading the file back using readFile tool...")
  const readResult = await readFile.execute({
    path: "demo/demo.txt",
  })
  console.log(`  Result: ${readResult}\n`)

  console.log("3. Editing the file using editFile tool...")
  const editResult = await editFile.execute({
    path: "demo/demo.txt",
    oldText: "writeFile tool",
    newText: "editFile tool",
  })
  console.log(`  Result: ${editResult}\n`)

  console.log("4. Reading the edited file back using readFile tool...")
  const readEditedResult = await readFile.execute({
    path: "demo/demo.txt",
  })
  console.log(`  Result: ${readEditedResult}\n`)

  console.log(
    "5. Listing files in the demo directory using execCommand tool...",
  )
  const listResult = await execCommand.execute({
    command: "ls -la demo/",
  })
  console.log(`  Result: ${listResult}\n`)

  console.log("6. Unexisting file read test (should return an error)...")
  try {
    const unexistingResult = await readFile.execute({
      path: "demo/unexisting.txt",
    })
    console.log(`  Result: ${unexistingResult}\n`)
  } catch (error) {
    console.log(`  Error: ${(error as Error).message}\n`)
  }

  console.log("7. Out of workspace access test (should return an error)...")
  try {
    const outOfWorkspaceResult = await writeFile.execute({
      path: "../outside_workspace.txt",
      content: "This should fail.",
    })
    console.log(`  Result: ${outOfWorkspaceResult}\n`)
  } catch (error) {
    console.log(`  Error: ${(error as Error).message}\n`)
  }

  console.log("=== End of Tools Demo ===")
}

demoTools().catch(console.error)
