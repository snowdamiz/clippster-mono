import { createServer, request as httpRequest } from 'node:http'
import { lookup } from 'node:dns/promises'
import { connect } from 'node:net'
import ipaddr from 'ipaddr.js'
/** Downloaders may follow redirects and CDN URLs. Validate and pin every connection,
 * including CONNECT tunnels, rather than trusting only the initial video URL. */
export function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === 'unicast'
  } catch {
    return false
  }
}
async function publicAddress(host: string) {
  const answers = await lookup(host, { all: true })
  if (!answers.length || answers.some((answer) => !isPublicAddress(answer.address)))
    throw new Error('Private network destinations are blocked.')
  return answers[0].address
}
export async function downloadProxy() {
  const sockets = new Set<import('node:net').Socket>()
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '')
      if (
        url.protocol !== 'http:' ||
        (url.port && url.port !== '80') ||
        url.username ||
        url.password
      )
        throw new Error('Blocked destination.')
      const address = await publicAddress(url.hostname)
      const {
        'proxy-authorization': _authorization,
        'proxy-connection': _connection,
        ...headers
      } = req.headers
      const remote = httpRequest(
        {
          host: address,
          port: 80,
          method: req.method,
          path: url.pathname + url.search,
          headers: { ...headers, host: url.host },
          timeout: 30_000
        },
        (response) => {
          res.writeHead(response.statusCode || 502, response.headers)
          response.pipe(res)
        }
      )
      remote.on('error', () => {
        if (!res.headersSent) res.writeHead(502)
        res.end()
      })
      remote.on('timeout', () => remote.destroy())
      res.on('close', () => remote.destroy())
      req.pipe(remote)
    } catch {
      res.writeHead(403)
      res.end('Destination blocked.')
    }
  })
  server.on('connect', async (req, client, head) => {
    try {
      const destination = new URL(`https://${req.url}`)
      if (destination.port && destination.port !== '443') throw new Error('Blocked port.')
      const address = await publicAddress(destination.hostname)
      const remote = connect({ host: address, port: 443 }, () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head.length) remote.write(head)
        remote.pipe(client)
        client.pipe(remote)
      })
      sockets.add(remote)
      remote.setTimeout(60_000, () => remote.destroy())
      remote.on('error', () => client.destroy())
      client.on('error', () => remote.destroy())
      client.on('close', () => remote.destroy())
      remote.on('close', () => {
        sockets.delete(remote)
        client.destroy()
      })
    } catch {
      client.end('HTTP/1.1 403 Forbidden\r\n\r\n')
    }
  })
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as import('node:net').AddressInfo
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => {
      for (const socket of sockets) socket.destroy()
      server.close()
    }
  }
}
