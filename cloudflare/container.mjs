// One long-lived Cloudflare Container behind a Worker, shared by the clippster Workers (server, web).
import { DurableObject } from 'cloudflare:workers'

// The container lives only while its Durable Object is active, so an alarm keeps both up between requests.
const KEEPALIVE_MS = 60_000

async function digest(env) {
  const bytes = new TextEncoder().encode(JSON.stringify(Object.entries(env).sort()))
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * A Durable Object class that runs the Worker's `base` image as one container and proxies requests to `port`.
 * `healthy(response)` decides when the server at `healthPath` is ready; `entrypoint` overrides the image's CMD.
 */
export function containerServer({ name, port, instance, entrypoint, healthPath, healthy = (response) => response.ok }) {
  return class extends DurableObject {
    async fetch(request) {
      await this.running()
      return this.ctx.container.getTcpPort(port).fetch(request.url.replace('https:', 'http:'), request)
    }

    async alarm() {
      await this.running()
    }

    /** Starts the container when it is not up, and resolves once its health check passes. */
    async running() {
      if (!this.ctx.container.running || !this.ready) {
        this.starting ??= this.start().finally(() => { this.starting = undefined })
        await this.starting
      }
      await this.ctx.storage.setAlarm(Date.now() + KEEPALIVE_MS)
    }

    async start() {
      const container = this.ctx.container
      this.ready = false
      // Worker secrets and vars become the container's environment, as `fly secrets` did.
      const env = Object.fromEntries(Object.entries(this.env).filter(([, value]) => typeof value === 'string'))
      // A container reads its environment only at start, so a deploy that changed secrets or vars restarts it.
      const envHash = await digest(env)
      if (container.running && (await this.ctx.storage.get('envHash')) !== envHash) {
        // SIGTERM first, so the server finishes its writes and R2 mounts upload pending files; destroy() kills at once.
        container.signal(15)
        for (let wait = 0; container.running && wait < 60; wait++) await scheduler.wait(1000)
        if (container.running) await container.destroy()
        for (let wait = 0; container.running && wait < 30; wait++) await scheduler.wait(1000)
      }
      if (!container.running) {
        container.start({ image: container.images.base, instance, entrypoint, enableInternet: true, env })
        await this.ctx.storage.put('envHash', envHash)
      }
      // Container stdout isn't visible from here, so start failures report the exit and the last health check instead.
      const exited = container.monitor().then(() => 'exited cleanly', (error) => String(error))
      const describe = async () => `exit: ${await Promise.race([exited, scheduler.wait(3000).then(() => 'still running')])}`
      const tcp = container.getTcpPort(port)
      let lastError = 'none'
      for (let attempt = 0; attempt < 180; attempt++) {
        try {
          const health = await tcp.fetch(`http://container${healthPath}`, { signal: AbortSignal.timeout(2000) })
          if (healthy(health)) {
            this.ready = true
            return
          }
          lastError = `health ${health.status}`
        } catch (error) {
          // The server is still starting.
          lastError = String(error)
        }
        if (!container.running) throw new Error(`${name} exited while starting (${await describe()}, last check: ${lastError})`)
        await scheduler.wait(1000)
      }
      throw new Error(`${name} did not become healthy within 3 minutes (${await describe()}, last check: ${lastError})`)
    }
  }
}
