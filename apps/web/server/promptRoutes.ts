import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { hasCreatorToolsAccess } from '@clippster/shared-types'
import type { Auth } from './auth'
import type { Store } from './store'
import { requireValue } from './errors'
import { textField } from './validation'

export function promptRoutes(store: Store, auth: Auth) {
  const router = Router()
  router.use(async (_req, res, next) => {
    requireValue(hasCreatorToolsAccess(res.locals.user), 403, 'Prompts requires a Creator or Pro plan.')
    const restrictions = await auth.upstream(auth.token(res.locals.session)).get<{ success: boolean; restricted?: boolean; restrictions?: { allow_custom_prompts?: boolean } }>('/user/restrictions')
    requireValue(restrictions.success && (!restrictions.restricted || restrictions.restrictions?.allow_custom_prompts !== false), 403, 'Your organization has disabled custom prompts.')
    next()
  })
  router.get('/', (_req, res) => res.json({ prompts: store.db.prepare('SELECT id, name, content FROM prompts WHERE owner = ? ORDER BY name').all(res.locals.session.owner) }))
  router.post('/', (req, res) => {
    const owner = res.locals.session.owner
    const count = store.db.prepare('SELECT COUNT(*) AS count FROM prompts WHERE owner = ?').get(owner) as { count: number }
    requireValue(count.count < 100, 400, 'You can save up to 100 custom prompts.')
    const id = randomUUID()
    store.db.prepare('INSERT INTO prompts VALUES (?, ?, ?, ?)').run(id, owner, textField(req.body?.name, 'Name', 120), textField(req.body?.content, 'Prompt', 4000))
    res.status(201).json({ id })
  })
  router.put('/:id', (req, res) => {
    const result = store.db.prepare('UPDATE prompts SET name = ?, content = ? WHERE id = ? AND owner = ?').run(textField(req.body?.name, 'Name', 120), textField(req.body?.content, 'Prompt', 4000), String(req.params.id), res.locals.session.owner)
    requireValue(result.changes > 0, 404, 'Prompt not found.')
    res.json({ success: true })
  })
  router.delete('/:id', (req, res) => {
    const result = store.db.prepare('DELETE FROM prompts WHERE id = ? AND owner = ?').run(String(req.params.id), res.locals.session.owner)
    requireValue(result.changes > 0, 404, 'Prompt not found.')
    res.json({ success: true })
  })
  return router
}
