import { computed, reactive, ref } from 'vue'
import type { WebClip, WebProject, WebWorkspace, WebJob, ManualFramingConfig, TargetAspectRatio, WebBranding } from '@clippster/shared-types'
import { isFreePlan } from '@clippster/shared-types'
import { useClipBuildNavigation } from '@/composables/useClipBuildNavigation'
import { useAuthStore } from './workspaceAccount'
import { getAllIntroOutros } from './creatorProfileRuntime'
import { workspaceClient, clipPreviewPath } from './api'
import { useWorkspaceBranding } from './useWorkspaceBranding'
import { useWorkspacePersonalBranding } from './useWorkspacePersonalBranding'
import { flushWorkspaceMutations } from './workspaceMutations'
export function useWorkspaceExport(project: () => WebProject, clip: () => WebClip | null, update: (value: WebWorkspace) => void, report: (cause: unknown) => void) {
  const opened = ref(false), ratios = ref<string[]>(['16:9']), configs = ref<Record<string, ManualFramingConfig>>({})
  const branding = useWorkspaceBranding(project, () => ratios.value)
  const personal = useWorkspacePersonalBranding(project, clip)
  const showManualPOIEditor = ref(false), editingAspectRatio = ref('9:16'), selectedIntro = ref<any>(null), selectedOutro = ref<any>(null), intros = ref<any[]>([]), outros = ref<any[]>([]), loadingAssets = ref(false)
  const quality = ref<'low' | 'medium' | 'high'>('high'), frameRate = ref<30 | 60>(30), outputFormat = ref<'mp4' | 'mov'>('mp4')
  const hasPortraitRatio = computed(() => ratios.value.some(ratio => ratio !== '16:9'))
  const navigation = useClipBuildNavigation(ratios, () => hasPortraitRatio.value || !!clip()?.captions || !!clip()?.textBox?.enabled)
  const introButtonRef = ref<HTMLElement>(), outroButtonRef = ref<HTMLElement>(), introDropdownPosition = ref({}), outroDropdownPosition = ref({}), showIntroDropdown = ref(false), showOutroDropdown = ref(false)
  const dropdown = (button: HTMLElement | undefined) => { const bounds = button?.getBoundingClientRect(); return bounds ? { top: `${bounds.bottom + 4}px`, left: `${bounds.left}px`, width: `${bounds.width}px`, maxHeight: `${Math.max(100, innerHeight - bounds.bottom - 12)}px` } : {} }
  const duration = computed(() => clip()?.segments.reduce((sum, part) => sum + part.end_time - part.start_time, 0) || 0)
  async function open(show = true) {
    await flushWorkspaceMutations(project().id)
    if (!clip()) return
    ratios.value = project().vodPresetConfig?.targetAspectRatio ? [project().vodPresetConfig!.targetAspectRatio] : [...(clip()!.exportRatios || ['16:9'])]; configs.value = JSON.parse(JSON.stringify(clip()!.framingConfigs || (clip()!.framingConfig ? { [clip()!.aspectRatio]: clip()!.framingConfig } : {})))
    const preset = project().vodPresetConfig
    if (preset?.framingConfig && !configs.value[preset.targetAspectRatio]) configs.value[preset.targetAspectRatio] = JSON.parse(JSON.stringify(preset.framingConfig))
    navigation.currentStep.value = 'platforms'; opened.value = show; loadingAssets.value = true
    void branding.load().catch(report)
    quality.value = clip()!.exportSettings?.quality || 'high'; frameRate.value = clip()!.exportSettings?.frameRate || 30; outputFormat.value = clip()!.exportSettings?.format || 'mp4'
    try { const assets = await getAllIntroOutros(); await personal.load(assets); intros.value = assets.filter(asset => asset.type === 'intro'); outros.value = assets.filter(asset => asset.type === 'outro'); selectedIntro.value = clip()!.branding?.introId === null ? null : intros.value.find(asset => String(asset.id) === String(clip()!.branding?.introId)) || personal.defaultIntro.value; selectedOutro.value = clip()!.branding?.outroId === null ? null : outros.value.find(asset => String(asset.id) === String(clip()!.branding?.outroId)) || personal.defaultOutro.value } catch (cause) { report(cause) } finally { loadingAssets.value = false }
  }
  async function confirmBuild() {
    await flushWorkspaceMutations(project().id)
    const selected = clip(); if (!selected || !ratios.value.length) return
    const selections = branding.targets()
    const targets = (selections.length ? selections : ratios.value.map(ratio => ({ ratio, branding: {} }))).map(target => ({ aspectRatio: target.ratio as TargetAspectRatio, framingConfig: configs.value[target.ratio] || null, exportSettings: { quality: quality.value, frameRate: frameRate.value, format: outputFormat.value }, branding: { ...selected.branding, creatorId: personal.profile.value?.id, introId: selectedIntro.value ? selectedIntro.value.id === personal.defaultIntro.value?.id ? undefined : Number(selectedIntro.value.id) : null, outroId: selectedOutro.value ? selectedOutro.value.id === personal.defaultOutro.value?.id ? undefined : Number(selectedOutro.value.id) : null, watermarkX: selected.branding?.watermarkX ?? .95, watermarkY: selected.branding?.watermarkY ?? .05, watermarkWidth: selected.branding?.watermarkWidth ?? .15, ...presetWatermark(target.ratio), ...target.branding } }))
    try { const job = await workspaceClient.post<WebJob>(`/web/projects/${project().id}/clips/${selected.id}/build`, { targets }); update(await workspaceClient.get<WebWorkspace>(`/web/projects/${project().id}`)); opened.value = false; return job } catch (cause) { report(cause) }
  }
  function presetWatermark(ratio: string): Partial<WebBranding> {
    const preset = project().vodPresetConfig
    if (preset?.watermarkMode === 'none') return { watermarkId: null }
    if (preset?.watermarkMode !== 'custom') return {}
    const settings = preset.customWatermarkSettings as unknown as import('@/types').WatermarkSettings | null, perRatio = settings?.perRatioSettings?.[ratio as '9:16']
    if (!settings?.enabled || perRatio === null) return { watermarkId: null }
    const position = perRatio?.position
    return { watermarkId: Number(perRatio?.watermarkId || settings.watermarkId), watermarkCustom: true, watermarkX: (position?.x ?? settings.positionX) / 100, watermarkY: (position?.y ?? settings.positionY) / 100, watermarkWidth: (position?.scale ?? settings.scale) / 100, watermarkOpacity: (position?.opacity ?? settings.opacity) / 100 }
  }
  const model = reactive({ ...navigation, modelValue: opened, clip: computed(clip), publishMode: false, selectedRatios: ratios, selectedPortraitRatios: computed(() => ratios.value.filter(ratio => ratio !== '16:9')), hasPortraitRatio, hasMultipleAspectRatios: computed(() => ratios.value.length > 1), clipDuration: duration, totalDuration: computed(() => duration.value + (selectedIntro.value?.duration || 0) + (selectedOutro.value?.duration || 0)), totalBuildsCount: computed(() => branding.targets().length || ratios.value.length), framingMode: 'manual', quality, frameRate, outputFormat, intros, outros, selectedIntro, selectedOutro, loadingAssets, isFreeTier: computed(() => isFreePlan(useAuthStore().user)), ...branding.model, ...personal.model,
    showIntroDropdown, showOutroDropdown, introButtonRef, outroButtonRef, introDropdownPosition, outroDropdownPosition,
    toggleIntroDropdown: () => { introDropdownPosition.value = dropdown(introButtonRef.value); showIntroDropdown.value = !showIntroDropdown.value }, toggleOutroDropdown: () => { outroDropdownPosition.value = dropdown(outroButtonRef.value); showOutroDropdown.value = !showOutroDropdown.value }, selectIntro: (asset: any) => { selectedIntro.value = asset; showIntroDropdown.value = false }, selectOutro: (asset: any) => { selectedOutro.value = asset; showOutroDropdown.value = false },
    toggleRatio: (ratio: string) => { ratios.value = ratios.value.includes(ratio) ? ratios.value.filter(value => value !== ratio) : [...ratios.value, ratio] }, getConfigForRatio: (ratio: string) => configs.value[ratio], isRatioConfigured: (ratio: string) => !!configs.value[ratio], openPOIEditorForRatio: (ratio: string) => { editingAspectRatio.value = ratio; showManualPOIEditor.value = true }, formatDuration: (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`, close: () => { opened.value = false }, confirmBuild
  })
  return { model, open, showManualPOIEditor, editingAspectRatio, config: computed(() => configs.value[editingAspectRatio.value] || null), videoPath: computed(() => clip() ? clipPreviewPath(project().id, clip()!.id) : ''), confirmFraming: (value: ManualFramingConfig) => { configs.value[editingAspectRatio.value] = value } }
}
