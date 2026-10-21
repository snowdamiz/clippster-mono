import { workspaceClient, framingAssetPath, webApiPath } from './api'
import { contextForClip } from './workspaceRuntime'
import type { AiBrollSearchResponse, AiBrollSuggestRequest, AiBrollSuggestResponse, AiBrollSuggestion, AiBrollProvider } from '@/types/ai-broll'
export const suggestAiBroll = (request: AiBrollSuggestRequest) => workspaceClient.post<AiBrollSuggestResponse>('/web/account/ai/broll/suggest', request)
export async function searchAiBrollStock(params: { query: string; provider?: AiBrollProvider; orientation?: 'portrait' | 'landscape' | 'square'; mediaType?: 'image' | 'video'; page?: number; perPage?: number }) {
  const query = new URLSearchParams({ query: params.query, orientation: params.orientation || 'portrait', media_type: params.mediaType || 'video', page: String(params.page || 1), per_page: String(params.perPage || 20) })
  if (params.provider) query.set('provider', params.provider)
  const result = await workspaceClient.get<AiBrollSearchResponse>(`/web/account/ai/broll/search?${query}`)
  result.candidates = result.candidates.map(candidate => ({ ...candidate, previewUrl: `${webApiPath}/broll-preview?url=${encodeURIComponent(candidate.previewUrl)}` }))
  return result
}
function path(clipId: string) { return `/web/projects/${contextForClip(clipId).project().id}/clips/${clipId}/broll-suggestions` }
export async function getAiBrollSuggestionsForClip(clipId: string) { return (await workspaceClient.get<{ suggestions: AiBrollSuggestion[] }>(path(clipId))).suggestions }
export async function saveAiBrollSuggestions(clipId: string, suggestions: AiBrollSuggestion[]) { await workspaceClient.put(path(clipId), { suggestions }) }
export async function upsertAiBrollSuggestion(suggestion: AiBrollSuggestion) {
  const values = await getAiBrollSuggestionsForClip(suggestion.clipId), index = values.findIndex(value => value.id === suggestion.id)
  if (index < 0) values.push(suggestion); else values[index] = suggestion
  await saveAiBrollSuggestions(suggestion.clipId, values)
}
export const updateAiBrollSuggestion = upsertAiBrollSuggestion
export async function downloadBrollMedia(options: { url: string; projectId: string; filename: string; mediaType: 'image' | 'video' }) {
  const query = new URLSearchParams({ url: options.url, type: options.mediaType, name: options.filename })
  const response = await fetch(`${framingAssetPath(options.projectId)}?${query}`, { method: 'POST', credentials: 'same-origin' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Could not import stock media.')
  return result.asset.id as string
}
export async function addProjectMedia(projectId: string, data: { filePath: string; mediaType: string; fileName: string; duration?: number | null; width?: number | null; height?: number | null }) {
  const result = await workspaceClient.get<{ assets: Array<{ id: string; name: string; type: string }> }>(`/web/projects/${projectId}/framing-assets`)
  const asset = result.assets.find(value => value.id === data.filePath)
  if (!asset) throw new Error('Imported media is no longer available.')
  return asset
}
