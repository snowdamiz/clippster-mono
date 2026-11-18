import type { IncomingMessage, ServerResponse } from 'node:http'
import type { EditDocument, MediaItem, VideoSession } from '../../../client/src/ai-video/types'

/** In-memory AI contract for media integration tests; it never calls billing or a model. */
export function mockCreatorSkillEditor() {
  const sessions = new Map<number, VideoSession>()
  const runs = new Map<number, { sessionId: number; turns: number }>()
  let nextSessionId = 17
  let nextRunId = 19
  const handle = (req: IncomingMessage, res: ServerResponse, body: Buffer): boolean => {
    const path = req.url || ''
    if (path === '/api/ai/video/policy') {
      res.end(JSON.stringify({ credits: { generate: 3, revise: 1, reference: 1 }, max_output_seconds: 720, max_label_calls: 0, max_reference_chunks: 0 }))
      return true
    }
    if (path === '/api/ai/video/sessions' && req.method === 'POST') {
      const input = JSON.parse(body.toString()) as { media_items: MediaItem[]; speech_index: VideoSession['speech_index']; aspect_ratio: VideoSession['aspect_ratio']; creator_profile_id: number | null }
      const now = new Date().toISOString()
      const session: VideoSession = { id: nextSessionId++, name: 'Fixture edit', status: 'draft', media_items: input.media_items, reference: null, reference_blueprint: null, aspect_ratio: input.aspect_ratio, motion_graphics: 'light', playbook_enabled: true, creator_profile_id: input.creator_profile_id, source_index: null, speech_index: input.speech_index, document: null, composition_files: null, thumbnail_url: null, running_run: null, messages: [], inserted_at: now, updated_at: now }
      sessions.set(session.id, session)
      res.end(JSON.stringify(session))
      return true
    }
    const sessionRoute = path.match(/^\/api\/ai\/video\/sessions\/(\d+)(?:\/(runs))?$/)
    if (sessionRoute) {
      const id = Number(sessionRoute[1])
      const session = sessions.get(id)
      if (!session) { res.statusCode = 404; res.end('{}'); return true }
      if (sessionRoute[2] === 'runs' && req.method === 'POST') {
        const runId = nextRunId++
        runs.set(runId, { sessionId: id, turns: 0 })
        res.end(JSON.stringify({ run: { id: runId, kind: 'generate', status: 'running', credits_charged: 3, refunded: false, turns: 0, label_calls: 0, error: null } }))
      } else if (req.method === 'PATCH') {
        const input = JSON.parse(body.toString()) as { document: EditDocument; composition_files: Record<string, string> }
        const updated = { ...session, document: input.document, composition_files: input.composition_files }
        sessions.set(id, updated)
        res.end(JSON.stringify(updated))
      } else res.end(JSON.stringify(session))
      return true
    }
    const runRoute = path.match(/^\/api\/ai\/video\/runs\/(\d+)\/(turn|complete|fail)$/)
    if (!runRoute) return false
    const runId = Number(runRoute[1])
    const run = runs.get(runId)
    const session = run && sessions.get(run.sessionId)
    if (!run || !session) { res.statusCode = 404; res.end('{}'); return true }
    if (runRoute[2] === 'turn') {
      if (run.turns++) res.end(JSON.stringify({ type: 'finish', message: 'Fixture edit complete' }))
      else {
        const media = session.media_items[0]
        const outro = session.media_items.find(item => item.name === 'Creator outro')
        const shots: EditDocument['shots'] = [{ id: 'source', mediaId: media.id, scene: null, sourceIn: 0, duration: Math.floor(media.duration * 30) / 30, speed: 1, move: 'none', transitionIn: 'cut', refShot: null, description: 'Keep the complete detected excerpt', alternates: [] }]
        if (outro) shots.push({ id: 'outro', mediaId: outro.id, scene: null, sourceIn: 0, duration: 1.5, speed: 1, move: 'none', transitionIn: 'cut', refShot: null, description: 'Selected creator end card', alternates: [] })
        const document: EditDocument = { title: 'Fixture clip', format: { width: 1080, height: 1920, fps: 30 }, music: null, clipAudio: 1, shots, overlays: [] }
        res.end(JSON.stringify({ type: 'tools', text: '', calls: [
          { id: 'edit', name: 'set_edit', arguments: { document } },
          { id: 'package', name: 'submit_playbook_package', arguments: { package: { funnel: { stage: 'trust', reason: 'Explain the topic', metric: 'saves' }, claims: [], sources: [], sponsors: [], thumbnailConcepts: ['Use a VOD frame'], thumbnailHeadlines: ['THE STORY', 'THE MOMENT'], platformCopy: [{ platform: 'YouTube Shorts', title: 'A fixture clip', description: 'Synthetic test clip\n#test #fixture #clip', tags: ['test'], pinnedComment: 'What did you notice?' }], reviewItems: [] } } },
        ] }))
      }
    } else if (runRoute[2] === 'complete') {
      const input = JSON.parse(body.toString()) as { document: EditDocument; composition_files: Record<string, string> }
      const updated: VideoSession = { ...session, status: 'ready', document: input.document, composition_files: input.composition_files }
      sessions.set(session.id, updated)
      res.end(JSON.stringify({ run: { id: runId, status: 'completed', credits_charged: 3 }, session: updated }))
    } else res.end(JSON.stringify({ run: { id: runId, status: 'failed', credits_charged: 0, refunded: true } }))
    return true
  }
  return { handle, sessions: () => [...sessions.values()] }
}
