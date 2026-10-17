import { readConfig } from './config'
import { verifyMediaTools } from './capabilities'
import { createWebApp } from './app'
const config = readConfig()
await verifyMediaTools(config)
const web = await createWebApp(config)
const server = web.app.listen(config.port, config.host, () =>
  console.log(`Clippster web media service listening on ${config.host}:${config.port}`)
)
server.requestTimeout = 30 * 60_000
let closing = false
async function shutdown() {
  if (closing) return
  closing = true
  server.close()
  server.closeAllConnections()
  await web.close()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
