// Runs the Phoenix release from ../Dockerfile as a single Cloudflare Container behind this Worker.
import { containerServer } from '../../cloudflare/container.mjs'

export const ClippsterServer = containerServer({
  name: 'clippster-server',
  port: 4000,
  // ½ vCPU, 4 GiB; Fly ran 1 shared vCPU / 1 GB, and yt-dlp and the Node helpers need the headroom.
  instance: 'standard-1',
  // Fly ran migrations as a release command; here they run before every start.
  entrypoint: ['/bin/sh', '-c', "/app/bin/clippster_server eval 'ClippsterServer.Release.migrate()' && exec /app/bin/clippster_server start"],
  healthPath: '/api/health',
})

export default {
  fetch: (request, env) => env.CLIPPSTER_SERVER.getByName('main').fetch(request),
  // Backstop for the alarm: restarts the instance if Cloudflare moved it and nothing else woke it.
  scheduled: async (_controller, env) => {
    await env.CLIPPSTER_SERVER.getByName('main').fetch('https://clippster-server/api/health')
  },
}
