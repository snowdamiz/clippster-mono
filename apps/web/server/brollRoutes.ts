import { Router } from 'express'
import { z } from 'zod'
import type { Store } from './store'
import { requireValue } from './errors'
const candidate = z.object({ id: z.string().max(200), provider: z.enum(['pexels', 'pixabay', 'local', 'generated']), mediaType: z.enum(['image', 'video']), previewUrl: z.string().max(4096), downloadUrl: z.string().max(4096), width: z.number().finite().nonnegative(), height: z.number().finite().nonnegative(), duration: z.number().finite().nonnegative().nullable().optional(), attribution: z.string().max(1000), license: z.string().max(1000), providerAssetId: z.string().max(200), score: z.number().finite().optional() })
const suggestions = z.array(z.object({ id: z.string().uuid(), clipId: z.string().uuid(), startTime: z.number().finite().nonnegative(), endTime: z.number().finite().positive(), transcriptText: z.string().max(10000), reason: z.string().max(10000), visualQuery: z.string().max(2000), generationPrompt: z.string().max(10000).optional(), sourceType: z.enum(['stock', 'generated', 'library', 'manual']), status: z.enum(['suggested', 'fetching', 'ready', 'applied', 'rejected', 'failed']), confidence: z.number().finite(), candidates: z.array(candidate).max(100), selectedCandidateId: z.string().max(200).nullable().optional(), localMediaPath: z.string().uuid().nullable().optional(), error: z.string().max(2000).nullable().optional() })).max(100)
export function brollRoutes(store: Store) {
  const router = Router()
  router.route('/projects/:id/clips/:clipId/broll-suggestions').all((req, res, next) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    requireValue(project.clips.some(clip => clip.id === req.params.clipId), 404, 'Clip not found.')
    res.locals.project = project; next()
  }).get((req, res) => {
    const row = store.db.prepare('SELECT data FROM broll_suggestions WHERE clip_id = ? AND project_id = ? AND owner = ?').get(String(req.params.clipId), String(req.params.id), res.locals.session.owner) as { data: string } | undefined
    res.json({ suggestions: row ? JSON.parse(row.data) : [] })
  }).put((req, res) => {
    const parsed = suggestions.safeParse(req.body?.suggestions)
    requireValue(parsed.success, 400, 'Invalid B-roll suggestions.')
    requireValue(parsed.data.every(value => value.clipId === req.params.clipId && value.endTime > value.startTime && value.endTime <= res.locals.project.duration), 400, 'Suggestions must belong to this clip and source.')
    store.db.prepare('INSERT INTO broll_suggestions VALUES (?, ?, ?, ?) ON CONFLICT(clip_id) DO UPDATE SET data=excluded.data').run(String(req.params.clipId), String(req.params.id), res.locals.session.owner, JSON.stringify(parsed.data))
    res.json({ suggestions: parsed.data })
  })
  return router
}
