import { computed, ref, watch, onUnmounted } from 'vue'
import type { WebProject } from '@clippster/shared-types'
import type { WatermarkSettings } from '@/types'
import { getAllWatermarkImages } from './creatorProfileRuntime'
import { workspaceClient, framingAssetPath } from './api'
import { creatorChannelId } from '@/lib/creatorPlatformIds'
import type { SocialOverlayPreset } from '@/editor/types/social-overlays'
export function useWorkspacePreview(project: () => WebProject) {
  const ratio = ref('16:9'), social = ref<SocialOverlayPreset | null>(null)
  const watermarkSettings = ref<WatermarkSettings>({ enabled: false, watermarkId: null, positionX: 12, positionY: 92, opacity: 80, scale: 20 })
  const watermarkData = ref<{ dataUrl: string; width?: number; height?: number } | null>(null)
  const watermarkAssets = ref<Awaited<ReturnType<typeof getAllWatermarkImages>>>([])
  function loadWatermark(id: string | null) { const asset = watermarkAssets.value.find(value => value.id === id); watermarkData.value = asset ? { dataUrl: asset.file_path, width: asset.width || undefined, height: asset.height || undefined } : null }
  const preset = computed(() => project().vodPresetConfig || null)
  watch(() => [project().id, preset.value?.targetAspectRatio], () => { ratio.value = preset.value?.targetAspectRatio || '16:9'; social.value = null }, { immediate: true })
  const aspect = computed(() => { const [width, height] = ratio.value.split(':').map(Number); return { width, height } })
  const options = computed(() => [...new Set(['16:9', preset.value?.targetAspectRatio].filter((value): value is string => !!value))].map(value => ({ value, label: value })))
  const config = computed(() => ratio.value !== '16:9' ? preset.value?.framingConfig || null : null)
  const subtitleDefaults = computed(() => preset.value?.subtitleDefaults || null)
  const layoutOverlays = computed(() => (preset.value?.layoutOverlays || []) as unknown as import('@/types').LayoutOverlay[])
  function overlayUrlsForRatio(target: string) { return Object.fromEntries(layoutOverlays.value.map(overlay => [overlay.id, framingAssetPath(project().id, overlay.perRatioSettings?.[target as '9:16']?.imagePath || overlay.imagePath)])) }
  watch(ratio, value => { if (value !== '9:16') social.value = null })
  const detectionDefaults = computed(() => subtitleDefaults.value ? { enabled: subtitleDefaults.value.enabled !== false, presetId: subtitleDefaults.value.selectedPresetId || 'tiktok-bold' } : null)
  let generation = 0
  onUnmounted(() => { generation++ })
  watch(() => project().id, async () => {
    const current = ++generation
    watermarkSettings.value.enabled = false; watermarkData.value = null
    try {
      const bundle = await workspaceClient.get<{ profiles: Array<{ id: number; platform_links?: Array<{ platform_id: string }>; watermark_id?: number; watermark_settings?: Record<string, any> }> }>('/web/account/user/branding')
      const profile = bundle.profiles.find(value => project().creatorId ? value.id === project().creatorId : value.platform_links?.some(link => link.platform_id.toLowerCase() === creatorChannelId(project())))
      const defaults = preset.value?.watermarkMode === 'none' ? null : preset.value?.watermarkMode === 'custom' ? preset.value.customWatermarkSettings as unknown as WatermarkSettings : profile?.watermark_id ? { enabled: true, watermarkId: String(profile.watermark_id), positionX: 12, positionY: 92, opacity: 80, scale: 20, perRatioSettings: profile.watermark_settings } as WatermarkSettings : null
      if (!defaults?.enabled) return
      const assets = await getAllWatermarkImages()
      if (current === generation) { watermarkAssets.value = assets; watermarkSettings.value = defaults; loadWatermark(String(defaults.watermarkId)) }
    } catch { /* Owner can continue playback while creator branding is unavailable. */ }
  }, { immediate: true })
  return { ratio, social, aspect, options, preset, config, subtitleDefaults, detectionDefaults, watermarkSettings, watermarkData, layoutOverlays, overlayUrlsForRatio, loadWatermark }
}
