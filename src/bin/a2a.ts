import { serveA2A } from "@/interfaces/a2a/server"

const server = serveA2A()

console.log(`A2A server listening on ${server.url}`)
