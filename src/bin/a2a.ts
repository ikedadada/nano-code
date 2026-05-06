import { logger } from "@/infrastructure/logger/logger"
import { serveA2A } from "@/interfaces/a2a/server"

const server = serveA2A()

logger.withTag("a2a").ready(`Server listening on ${server.url}`)
