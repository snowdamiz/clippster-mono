import { ref, computed } from 'vue'
import type { WebProject, WebWorkspace, WebClip, SubtitleSettings } from '@clippster/shared-types'
import { projects, workspaceClient } from './api'
import { captionPresetSettings } from '@/utils/captionPresetSettings'
import { createDefaultSubtitleSettings } from '@clippster/shared-types'
import { useToast } from './toasts'
import { useWorkspaceJobWaiter } from './useWorkspaceJobWaiter'
import { queueWorkspaceMutation } from './workspaceMutations'
export interface DetectionOptions { prompt: string; organizationId?: number | null; startTime?: number; endTime?: number; subtitlePreset?: string | null; enhanced?: boolean }
export function useWorkspaceDialogs(project: () => WebProject, update: (workspace: WebWorkspace) => void, detect: (options: DetectionOptions) => void, transcribe: (organizationId: number | null) => void) {
  function serialize(operation: () => Promise<void>) { return queueWorkspaceMutation(project().id, operation).catch(cause => { useToast().error('Could not save clip changes', cause instanceof Error ? cause.message : 'Please try again.') }) }
  const showDetect = ref(false), showTranscribe = ref(false), showSubtitles = ref(false), showDelete = ref(false), deletingId = ref<string | null>(null)
  const transcriptionClipId = ref<string | null>(null), transcribingClip = ref(false)
  const transcriptionClip = computed(() => project().clips.find(clip => clip.id === transcriptionClipId.value))
  const waitForJob = useWorkspaceJobWaiter(update)
  function requestClipTranscription(id: string) { transcriptionClipId.value = id; showTranscribe.value = true }
  async function confirmTranscribe(organizationId: number | null) {
    const id = transcriptionClipId.value
    if (!id) { transcribe(organizationId); return }
    transcribingClip.value = true
    try { const job = await workspaceClient.post<import('@clippster/shared-types').WebJob>(`/web/projects/${project().id}/clips/${id}/transcribe`, { organizationId }); await waitForJob(job); transcriptionClipId.value = null }
    catch (cause) { useToast().error('Clip transcription failed', cause instanceof Error ? cause.message : 'Please try again.') }
    finally { transcribingClip.value = false }
  }
  function confirmDetect(_id: string, prompt: string, organizationId: number | null, startTime: number, endTime: number, subtitle?: { enabled: boolean; presetId: string } | null, enhanced = false) { detect({ prompt, organizationId, startTime, endTime, subtitlePreset: subtitle?.enabled ? subtitle.presetId : null, enhanced }) }
  async function applySubtitles(ids: string[], presetId: string) {
    const preset = captionPresetSettings(presetId); if (!preset) throw new Error('Choose a valid subtitle preset.')
    const settings = project().vodPresetConfig?.subtitleDefaults ? { ...JSON.parse(JSON.stringify(project().vodPresetConfig!.subtitleDefaults)), enabled: true, selectedPresetId: presetId } : preset
    for (const id of ids) await saveClipPatch(id, { captions: true, subtitleSettings: settings })
    useToast().success('Subtitles Configured', `Subtitles applied to ${ids.length} clip${ids.length === 1 ? '' : 's'}.`)
  }
  function remove(id: string) { deletingId.value = id; showDelete.value = true }
  async function confirmDelete() { if (!deletingId.value) return; await projects.removeClip(project().id, deletingId.value); update(await projects.get(project().id)); showDelete.value = false; deletingId.value = null }
  function saveClipPatch(id: string, patch: Partial<WebClip> | ((clip: WebClip) => Partial<WebClip>)) { return serialize(async () => { const clip = project().clips.find(value => value.id === id); if (!clip) return; const changes = typeof patch === 'function' ? patch(clip) : patch; update(await projects.saveClip(project().id, { ...clip, ...changes }, id, clip.revision)) }) }
  function saveSubtitleSettings(id: string, patch: Partial<SubtitleSettings>) { return saveClipPatch(id, clip => ({ captions: patch.enabled ?? clip.captions, subtitleSettings: { ...(clip.subtitleSettings || createDefaultSubtitleSettings()), ...patch } })) }
  return { showDetect, showTranscribe, showSubtitles, showDelete, remove, confirmDelete, confirmDetect, applySubtitles, saveClipPatch, saveSubtitleSettings, confirmTranscribe, requestClipTranscription, transcriptionClip, transcriptionClipId, transcribingClip }
}
