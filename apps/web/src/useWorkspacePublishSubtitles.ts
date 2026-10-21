import { computed, ref, markRaw } from 'vue'
import { clipWords, createDefaultSubtitleSettings, type WebClip, type WebProject, type WebWorkspace, type SubtitleSettings, type WebJob } from '@clippster/shared-types'
import { workspaceClient, sourcePath } from './api'
import { captionPresetSettings } from '@/utils/captionPresetSettings'
import { useWorkspaceJobWaiter } from './useWorkspaceJobWaiter'
export function useWorkspacePublishSubtitles(project: () => WebProject, clip: () => WebClip | null, update: (workspace: WebWorkspace) => void, save: (id: string, patch: Partial<WebClip>) => Promise<void>, next: () => void) {
  const subtitleSubState = ref('choosing'), subtitleTranscribeError = ref<string | null>(null), progress = ref({ message: '', progress: 0 }), settings = ref<SubtitleSettings>(createDefaultSubtitleSettings()), enabled = ref(false)
  const words = computed(() => clip() ? clipWords(clip()!.subtitleWords || project().words, clip()!.segments) : [])
  const position = ref({ x: 50, y: 85, width: 80 })
  const waitForJob = useWorkspaceJobWaiter(update)
  async function saveSettings(patch: Partial<SubtitleSettings>) {
    const { position: _position, perRatioConfigs, ...style } = patch
    settings.value = { ...settings.value, ...patch, perRatioConfigs: { ...settings.value.perRatioConfigs, ...perRatioConfigs, '16:9': { ...settings.value.perRatioConfigs?.['16:9'], ...style, ...perRatioConfigs?.['16:9'], fontSize: patch.fontSize ?? settings.value.perRatioConfigs?.['16:9']?.fontSize ?? settings.value.fontSize, positionPercentage: patch.positionPercentage ?? settings.value.perRatioConfigs?.['16:9']?.positionPercentage ?? settings.value.positionPercentage } } }
    if (clip()) await save(clip()!.id, { captions: enabled.value, subtitleSettings: settings.value })
  }
  async function chooseSubtitlesYes() {
    if (!clip()) return
    subtitleTranscribeError.value = null; enabled.value = true
    try {
      if (!words.value.length) {
        subtitleSubState.value = 'transcribing'
        const job = await workspaceClient.post<WebJob>(`/web/projects/${project().id}/clips/${clip()!.id}/transcribe`)
        await waitForJob(job, current => { progress.value = { message: current.message, progress: current.progress } })
      }
      settings.value = clip()!.subtitleSettings || captionPresetSettings('neon-glow')!
      await saveSettings({ enabled: true }); subtitleSubState.value = 'editing'
    } catch (cause) { subtitleTranscribeError.value = cause instanceof Error ? cause.message : 'Transcription failed.'; subtitleSubState.value = 'choosing' }
  }
  const model = { subtitleSubState, subtitleTranscribeError, subtitlesEnabled: enabled, wizardSubtitleSettings: settings, wizardTranscription: markRaw({ progress }), wizardSubtitlePosition: position, wizardTranscriptWords: words, wizardTranscriptSegments: computed(() => words.value.map((word, index) => ({ index, text: word.word, start: word.start, end: word.end }))), subtitleFirstFrameUrl: computed(() => sourcePath(project().id).replace(/\/source$/, '/thumbnail') + '?time=' + (clip()?.segments[0]?.start_time || 0)), chooseSubtitlesYes,
    chooseSubtitlesNo: async () => { enabled.value = false; if (clip()) await save(clip()!.id, { captions: false }); next() }, onWizardSubtitlePositionChange: (value: typeof position.value) => { position.value = value; void saveSettings({ positionPercentage: value.y, maxWidth: value.width, perRatioConfigs: { ...settings.value.perRatioConfigs, '16:9': { fontSize: settings.value.fontSize, positionPercentage: value.y, position: value, maxWidth: value.width } } }) }, onWizardSubtitleSettingsChange: saveSettings, onWizardSubtitleSettingsUpdate: saveSettings, removeWizardSubtitles: async () => { enabled.value = false; await saveSettings({ enabled: false }); subtitleSubState.value = 'choosing' } }
  return { model, reset: () => { subtitleSubState.value = 'choosing'; subtitleTranscribeError.value = null; enabled.value = false; settings.value = clip()?.subtitleSettings || createDefaultSubtitleSettings() } }
}
