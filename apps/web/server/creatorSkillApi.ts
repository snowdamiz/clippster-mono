import type { CreatorSkillPreferences } from '@clippster/shared-types'
import type { EditDocument, GenerateBrief, MediaItem, SpeechIndex, ToolResult, TurnResponse, VideoPolicy, VideoRun, VideoSession } from '../../../client/src/ai-video/types'
import type { Config } from './config'

/** The web worker's authenticated AI editor calls. Tokens stay on the server. */
export class CreatorSkillApi {
  constructor(private readonly config: Config, private readonly token: string) {}

  private async request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
    const deadline = AbortSignal.timeout(path.endsWith('/turn') ? 10 * 60_000 : 60_000)
    const response = await fetch(`${this.config.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'X-Client-Platform': 'web',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
    })
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null)
      const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error : `AI editor request failed (${response.status}).`
      throw new Error(message)
    }
    return await response.json() as T
  }

  policy(signal?: AbortSignal) { return this.request<VideoPolicy>('/ai/video/policy', 'GET', undefined, signal) }

  session(id: number) { return this.request<VideoSession>(`/ai/video/sessions/${id}`) }

  updateSession(id: number, document: EditDocument, compositionFiles: Record<string, string>, signal?: AbortSignal) {
    return this.request<VideoSession>(`/ai/video/sessions/${id}`, 'PATCH', { document, composition_files: compositionFiles }, signal)
  }

  async creatorProfile(id: number, signal?: AbortSignal): Promise<{ name: string; description?: string | null; preferences: CreatorSkillPreferences; intro_ratio_settings?: unknown; outro_ratio_settings?: unknown } | null> {
    const payload = await this.request<{ profiles: Array<{ id: number; name: string; description?: string | null; creator_skill_preferences?: CreatorSkillPreferences | null; intro_ratio_settings?: unknown; outro_ratio_settings?: unknown }> }>('/user/creator-profiles', 'GET', undefined, signal)
    const profile = payload.profiles.find(item => item.id === id)
    if (!profile) return null
    const { parseCreatorSkillPreferences } = await import('../../../client/src/services/creatorSkillPreferences')
    return { name: profile.name, description: profile.description, preferences: parseCreatorSkillPreferences(profile.creator_skill_preferences), intro_ratio_settings: profile.intro_ratio_settings, outro_ratio_settings: profile.outro_ratio_settings }
  }

  async creatorAssets(signal?: AbortSignal) {
    const payload = await this.request<{ assets: Array<{ id: number; asset_type: string; url: string; mime_type?: string }> }>('/user/branding', 'GET', undefined, signal)
    return payload.assets
  }

  createSession(media: MediaItem[], speech: SpeechIndex, creatorProfileId: number | null, aspectRatio: '9:16' | '16:9', signal?: AbortSignal) {
    return this.request<VideoSession>('/ai/video/sessions', 'POST', {
      media_items: media,
      speech_index: speech,
      aspect_ratio: aspectRatio,
      motion_graphics: 'light',
      playbook_enabled: true,
      creator_profile_id: creatorProfileId,
    }, signal)
  }

  async startRun(sessionId: number, request: string, maxCredits: number, signal?: AbortSignal): Promise<VideoRun> {
    const result = await this.request<{ run: VideoRun }>(`/ai/video/sessions/${sessionId}/runs`, 'POST', {
      kind: 'generate', request, max_credits: maxCredits,
    }, signal)
    return result.run
  }

  turn(runId: number, input: { brief?: GenerateBrief | Record<string, never>; results?: ToolResult[] }, signal?: AbortSignal) {
    return this.request<TurnResponse>(`/ai/video/runs/${runId}/turn`, 'POST', input, signal)
  }

  complete(runId: number, document: EditDocument, compositionFiles: Record<string, string>, signal?: AbortSignal) {
    return this.request<{ run: VideoRun; session: VideoSession }>(`/ai/video/runs/${runId}/complete`, 'POST', {
      document, composition_files: compositionFiles,
    }, signal)
  }

  /** Use an un-aborted request: cancellation of the local job must still release reserved credits. */
  fail(runId: number, reason: string) {
    return this.request<unknown>(`/ai/video/runs/${runId}/fail`, 'POST', { reason })
  }
}
