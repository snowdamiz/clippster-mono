// Runs the web workspace from ../Dockerfile as a single Cloudflare Container behind this Worker.
// The landing Worker reaches it through a service binding for clippster.app/workspace.
import { containerServer } from '../../../cloudflare/container.mjs'

export const ClippsterWeb = containerServer({
  name: 'clippster-web',
  port: 8080,
  // 2 vCPU, 8 GiB, matching Fly's 2 shared CPUs / 4 GB with room for ffmpeg renders.
  instance: 'standard-3',
  healthPath: '/api/health',
})

export default {
  fetch: (request, env) => env.CLIPPSTER_WEB.getByName('main').fetch(request),
  // Backstop for the alarm: restarts the instance if Cloudflare moved it and nothing else woke it.
  scheduled: async (_controller, env) => {
    await env.CLIPPSTER_WEB.getByName('main').fetch('https://clippster-web/api/health')
  },
}
