import { Router } from 'express'
import type { Config } from './config'
import type { Store } from './store'
import { requireValue } from './errors'
import { waveformData } from './waveform'
export function waveformRoutes(store: Store, config: Config) {
  const router = Router()
  router.get('/projects/:id/waveform', async (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    requireValue(project.status === 'ready', 409, 'Wait for this video to finish downloading.')
    const start = Number(req.query.start || 0), end = Number(req.query.end || project.duration), width = Number(req.query.width || 1000), gain = Number(req.query.gain || 1)
    requireValue(Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && end <= project.duration + .1 && Number.isInteger(width) && width > 0 && width <= 10000 && Number.isFinite(gain) && gain >= 0 && gain <= 10, 400, 'Invalid waveform range.')
    if (!project.hasAudio) { res.json({ duration: project.duration, peaks: [] }); return }
    const data = await waveformData(project, config), samples = Math.floor(data.length / 4)
      const first = Math.min(samples, Math.floor(start * 100)), last = Math.min(samples, Math.ceil(end * 100))
      const peaks = Array.from({ length: width }, (_, index) => {
        const left = first + Math.floor((last - first) * index / width), right = Math.max(left + 1, first + Math.floor((last - first) * (index + 1) / width))
        let min = 0, max = 0
        for (let sample = left; sample < Math.min(right, samples); sample++) { const value = data.readFloatLE(sample * 4) * gain; min = Math.min(min, -value); max = Math.max(max, value) }
        return { min, max }
      })
      res.json({ duration: project.duration, peaks })
  })
  return router
}
