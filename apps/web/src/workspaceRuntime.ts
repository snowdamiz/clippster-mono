import { SYSTEM_DETECTION_PROMPTS, type WebProject, type WebClip, type WebWorkspace } from '@clippster/shared-types'
import { projects, workspaceClient } from './api'
import { queueWorkspaceMutation } from './workspaceMutations'
type Context = { project: () => WebProject; update: (workspace: WebWorkspace) => void }
const contexts = new Map<string, Context>()
export async function getAllPrompts() {
  const custom = (await workspaceClient.get<{ prompts: Array<{ id: string; name: string; content: string }> }>('/web/prompts').catch(() => ({ prompts: [] }))).prompts
  return [...SYSTEM_DETECTION_PROMPTS, ...custom].map(prompt => ({ ...prompt, created_at: 0, updated_at: 0 }))
}
export async function updateTranscriptWord(projectId: string, index: number, text: string) {
  const context = contexts.get(projectId)
  const workspace = await workspaceClient.patch<WebWorkspace>(`/web/projects/${projectId}/transcript`, { index, text })
  context?.update(workspace)
  return { success: true, error: undefined as string | undefined }
}
export function registerWorkspace(context: Context) {
  const id = context.project().id; contexts.set(id, context)
  return () => { if (contexts.get(id) === context) contexts.delete(id) }
}
export function contextForClip(id: string) {
  const context = [...contexts.values()].find(item => item.project().clips.some(clip => clip.id === id))
  if (!context) throw new Error('This clip is no longer available. Reload the project.')
  return context
}
export async function getClip(id: string) { const clip = contextForClip(id).project().clips.find(value => value.id === id); return clip ? { ...clip, clip_text_overlay: clip.textBox ? JSON.stringify(clip.textBox) : null } : null }
async function editClip(id: string, edit: (clip: WebClip) => void) {
  const context = contextForClip(id)
  await queueWorkspaceMutation(context.project().id, async () => {
    const current = context.project().clips.find(clip => clip.id === id)
    if (!current) throw new Error('This clip is no longer available.')
    const clip = JSON.parse(JSON.stringify(current)) as WebClip; edit(clip)
    context.update(await projects.saveClip(context.project().id, clip, clip.id, clip.revision))
  })
}
export async function updateClipSegment(id: string, index: number, start: number, end: number) {
  await editClip(id, clip => { clip.segments[index] = { ...clip.segments[index], start_time: start, end_time: end } })
}
export async function updateClipTextOverlay(id: string, value: WebClip['textBox']) {
  await editClip(id, clip => { clip.textBox = value })
}
export async function getAdjacentClipSegments(id: string, index: number) {
  const clip = contextForClip(id).project().clips.find(clip => clip.id === id)!
  return { previous: clip.segments[index - 1] || null, next: clip.segments[index + 1] || null }
}
export async function realignClipSegment(id: string, _index: number, originalStart: number, originalEnd: number, start: number, end: number) {
  const context = contextForClip(id)
  await editClip(id, clip => {
    const source = clip.subtitleWords || context.project().words.filter(word => clip.segments.some(segment => word.end >= segment.start_time && word.start <= segment.end_time) || word.end >= originalStart && word.start <= originalEnd)
    const scale = (end - start) / (originalEnd - originalStart)
    clip.subtitleWords = source.map(word => word.start >= originalStart && word.end <= originalEnd ? { ...word, start: start + (word.start - originalStart) * scale, end: start + (word.end - originalStart) * scale } : word)
  })
}
export async function splitClipSegment(id: string, index: number, time: number) {
  await editClip(id, clip => { const segment = clip.segments[index]; if (!segment || time <= segment.start_time || time >= segment.end_time) throw new Error('Choose a split inside the segment.'); clip.segments.splice(index, 1, { ...segment, end_time: time }, { ...segment, start_time: time }) })
}
export async function deleteClipSegment(id: string, index: number) {
  const context = contextForClip(id), clip = context.project().clips.find(clip => clip.id === id)!
  if (clip.segments.length === 1) { await projects.removeClip(context.project().id, id); context.update(await projects.get(context.project().id)) }
  else await editClip(id, value => { value.segments.splice(index, 1) })
}
export async function deleteClip(id: string) {
  const context = contextForClip(id); await projects.removeClip(context.project().id, id); context.update(await projects.get(context.project().id))
}
export async function createManualClip(projectId: string, data: { name: string; startTime: number; endTime: number; description?: string }) {
  const context = contexts.get(projectId); if (!context) throw new Error('Open the project before creating a clip.')
    const preset = context.project().vodPresetConfig
    const workspace = await projects.saveClip(projectId, { name: data.name, aspectRatio: (preset?.targetAspectRatio || '9:16') as import('@clippster/shared-types').TargetAspectRatio, captions: preset?.subtitleDefaults?.enabled === true, subtitleSettings: preset?.subtitleDefaults, framingConfig: preset?.framingConfig, segments: [{ start_time: data.startTime, end_time: data.endTime }] })
  context.update(workspace); return workspace.project.clips.at(-1)!.id
}
export async function addSegmentToClip(id: string, _projectId: string, data: { startTime: number; endTime: number }) {
  await editClip(id, clip => { clip.segments.push({ start_time: data.startTime, end_time: data.endTime, duration: data.endTime - data.startTime, transcript: '' }) }); return id
}
export async function getTranscriptWithSegmentsByProjectId(projectId: string) {
  const project = contexts.get(projectId)?.project() || (await projects.get(projectId)).project
  return { transcript: project.words.length ? { id: project.id, raw_json: JSON.stringify({ words: project.words }), content: project.words.map(word => word.word).join(' ') } : null, segments: [] }
}
