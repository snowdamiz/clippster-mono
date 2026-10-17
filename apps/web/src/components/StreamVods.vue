<template><Toast /><StreamVodsView :model="model" /></template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { Video } from 'lucide-vue-next'
import StreamVodsView from '@/components/StreamVodsView.vue'
import Toast from '@/components/Toast.vue'
import type { PlatformClip } from '@/stores/platform'
import type { PlatformId } from '@/config/platforms'
import { extractChannelSlug, extractChannelName, extractYouTubeChannel, extractYouTubeVideoId, extractRumbleChannel, extractMintId } from '@/lib/creatorPlatformIds'
import { getPlatformIcon } from '@/lib/creatorProfilePresentation'
import { listCreatorVods, normalizeVodDate, useCreatorDownloadRuntime, type CreatorVod } from '../creatorDownloadRuntime'
import { projects, workspaceClient, errorMessage } from '../api'
import { useToast } from '../toasts'
import { getAllCreatorProfiles } from '../creatorProfileRuntime'
import { parseCreatorClipBuildDefaults } from '@/lib/creatorClipBuildDefaults'
const props = defineProps<{ platform?: string; channel?: string }>()
const searchInput = ref(props.channel || ''), detectedPlatform = ref<PlatformId | null>(props.platform === 'youtube' ? 'YouTube' : props.platform as PlatformId || null)
const { startDownload, navigateProjects } = useCreatorDownloadRuntime(), { error: showError, success } = useToast()
type Recent = { id: string; platform: PlatformId; displayText: string; timestamp: number; label?: string }
async function clearRecentSearches() { try { platformStore.getRecentSearches = (await workspaceClient.delete<{ searches: Recent[] }>('/web/vod-searches')).searches } catch (cause) { showError('Could not clear recent searches', errorMessage(cause)) } }
const platformStore = reactive({ clips: [] as PlatformClip[], loading: false, error: '', currentSearchId: '', getRecentSearches: [] as Recent[], tokendCatalogMetadata: null, clearRecentSearches })
const showRecentDropdown = ref(false), currentPage = ref(1), hasNext = ref(false), downloaded = ref(new Set<string>())
const youtubeTab = ref<'streams' | 'videos'>('streams'), rumbleTab = ref<'streams' | 'videos'>('streams'), tokendTab = ref('streams')
const showDownloadDialog = ref(false), clipToDownload = ref<PlatformClip | null>(null), downloadStarting = ref(false)
const selectedTimeRange = ref({ startTime: 0, endTime: 0 }), autoSegment = ref(false), autoSegmentDuration = ref(30)
const useCreatorLayout = ref(false), layoutCreatorId = ref<number | null>(null)
const clipDefaultsEligible = computed(() => layoutCreatorId.value !== null)
const selectedVodIds = ref(new Set<string>()), downloadQueue = ref<PlatformClip[]>([]), currentQueueIndex = ref(0), isProcessingQueue = ref(false)
const paginatedClips = computed(() => platformStore.clips), displayTotalPages = computed(() => currentPage.value + (hasNext.value ? 1 : 0))
const selectedDuration = computed(() => selectedTimeRange.value.endTime - selectedTimeRange.value.startTime)
const isFullStreamSelected = computed(() => selectedTimeRange.value.startTime <= Math.max(5, (clipToDownload.value?.duration || 0) * .01) && selectedTimeRange.value.endTime >= (clipToDownload.value?.duration || 0) - Math.max(5, (clipToDownload.value?.duration || 0) * .01))
const estimatedParts = computed(() => Math.ceil(selectedDuration.value / (autoSegmentDuration.value * 60)))
function detectPlatform() {
  const text = searchInput.value.trim().toLowerCase()
  detectedPlatform.value = !text ? null : extractMintId(searchInput.value) ? 'pumpfun' : text.includes('twitch.tv') ? 'twitch' : text.includes('youtu') ? 'YouTube' : text.includes('rumble.com') ? 'rumble' : text.includes('x.com') || text.includes('twitter.com') ? 'twitter' : 'kick'
}
function channelId(platform: PlatformId, text: string) {
  return (platform === 'twitch' ? extractChannelName(text) : platform === 'YouTube' ? extractYouTubeChannel(text) : platform === 'rumble' ? extractRumbleChannel(text) : platform === 'kick' ? extractChannelSlug(text) : text) || text
}
function mapVod(vod: CreatorVod): PlatformClip {
  let url = vod.url
  if (!url?.startsWith('https://')) { if (detectedPlatform.value === 'YouTube') url = `https://www.youtube.com/watch?v=${vod.id}`; else if (detectedPlatform.value === 'twitch') url = `https://www.twitch.tv/videos/${vod.id}` }
  return { clipId: vod.id, title: vod.title || 'Untitled video', duration: vod.duration_seconds == null ? undefined : Number(vod.duration_seconds), mp4Url: url, thumbnailUrl: vod.thumbnail_url, clipType: 'COMPLETE', createdAt: normalizeVodDate(vod.upload_date) }
}
let generation = 0
async function handleSearch(reset = true) {
  if (!searchInput.value.trim()) return
  if (!detectedPlatform.value) detectPlatform()
  if (!detectedPlatform.value) return
  if (reset) currentPage.value = 1
  const run = ++generation, platform = detectedPlatform.value, input = searchInput.value.trim()
  platformStore.loading = true; platformStore.error = ''; selectedVodIds.value.clear()
  try {
    try { platformStore.getRecentSearches = (await workspaceClient.post<{ searches: Recent[] }>('/web/vod-searches', { id: channelId(platform, input), platform, displayText: input })).searches }
    catch (cause) { showError('Could not save recent search', errorMessage(cause)) }
    const direct = /^https:\/\//.test(input) && (extractYouTubeVideoId(input) || /twitch\.tv\/videos\/|kick\.com\/.+\/videos\/|rumble\.com\/v[^/]+\.html|(?:x|twitter)\.com\/.+(?:status|broadcast)/.test(input))
    let result: { vods: CreatorVod[] }
    if (direct) {
      const meta = await workspaceClient.post<{ source_id: string; title: string; duration_seconds: number; thumbnail_url?: string }>('/web/account/media/probe', { url: input, platform: platform.toLowerCase() })
      result = { vods: [{ id: meta.source_id, title: meta.title, duration_seconds: meta.duration_seconds, url: input, thumbnail_url: meta.thumbnail_url }] }
    } else result = await listCreatorVods(platform, channelId(platform, input), (currentPage.value - 1) * 20, platform === 'YouTube' ? youtubeTab.value : rumbleTab.value)
    if (run !== generation) return
    platformStore.currentSearchId = channelId(platform, input)
    platformStore.clips = result.vods.filter(vod => !vod.is_live).map(mapVod)
    hasNext.value = !direct && ('has_more' in result ? Boolean(result.has_more) : result.vods.length === 20)
    const existing = await projects.list()
    downloaded.value = new Set(existing.projects.filter(project => project.status === 'ready' && project.sourceUrl).map(project => project.sourceUrl!))
  } catch (cause) { if (run === generation) { platformStore.error = errorMessage(cause); platformStore.clips = [] } }
  finally { if (run === generation) platformStore.loading = false }
}
function goToPage(page: number) { if (page < 1 || page > displayTotalPages.value || platformStore.loading) return; currentPage.value = page; void handleSearch(false) }
function clearSelection() { selectedVodIds.value = new Set() }
function toggleVodSelection(clip: PlatformClip) { if (selectedVodIds.value.has(clip.clipId)) selectedVodIds.value.delete(clip.clipId); else selectedVodIds.value.add(clip.clipId) }
async function handleDownloadClip(clip: PlatformClip) {
  if (!clip.duration) { showError('Duration unavailable', 'Choose a completed video with a known duration.'); return }
  clipToDownload.value = clip; selectedTimeRange.value = { startTime: 0, endTime: clip.duration }; autoSegment.value = false; useCreatorLayout.value = false; layoutCreatorId.value = null; showDownloadDialog.value = true
  try { const profiles = await getAllCreatorProfiles(); const profile = profiles.find(value => value.platform_links?.some(link => link.platform.toLowerCase() === detectedPlatform.value?.toLowerCase() && channelId(detectedPlatform.value!, link.platform_id).toLowerCase() === platformStore.currentSearchId.toLowerCase())); if (clipToDownload.value?.clipId === clip.clipId && profile && parseCreatorClipBuildDefaults(profile.clip_build_defaults)) layoutCreatorId.value = Number(profile.id) } catch (cause) { showError('Could not load creator layout', errorMessage(cause)) }
}
function closeDownloadDialog() { if (downloadStarting.value) return; showDownloadDialog.value = false; clipToDownload.value = null; isProcessingQueue.value = false; downloadQueue.value = [] }
function downloadSelectedVods() { downloadQueue.value = platformStore.clips.filter(clip => selectedVodIds.value.has(clip.clipId)); currentQueueIndex.value = 0; isProcessingQueue.value = true; if (downloadQueue.value[0]) handleDownloadClip(downloadQueue.value[0]) }
async function downloadClipConfirmed() {
  const clip = clipToDownload.value
  if (!clip || downloadStarting.value) return
  downloadStarting.value = true
  try {
    await startDownload(clip.title, clip.mp4Url || clip.playlistUrl || '', platformStore.currentSearchId, isFullStreamSelected.value ? undefined : selectedTimeRange.value, clip.clipId, clip.duration, { autoSegment: autoSegment.value && selectedDuration.value > 900, segmentDuration: autoSegmentDuration.value * 60, provider: detectedPlatform.value || undefined, creatorProfileId: layoutCreatorId.value || undefined, applyCreatorClipLayout: useCreatorLayout.value })
    success('Download Started', `Downloading "${clip.title}".`)
    showDownloadDialog.value = false; clipToDownload.value = null
    if (isProcessingQueue.value && ++currentQueueIndex.value < downloadQueue.value.length) handleDownloadClip(downloadQueue.value[currentQueueIndex.value])
    else { isProcessingQueue.value = false; downloadQueue.value = []; clearSelection(); navigateProjects() }
  } catch (cause) { showError('Download Failed', errorMessage(cause)) }
  finally { downloadStarting.value = false }
}
const model = reactive({ assetBase: '/workspace', platformStore, searchInput, detectedPlatform, detectPlatform, handleSearch: () => handleSearch(), showRecentDropdown,
  handleRecentSearchClick: (search: Recent) => { searchInput.value = search.displayText; detectedPlatform.value = search.platform; void handleSearch() },
  getPlatformIcon: (platform: PlatformId) => getPlatformIcon(platform, '/workspace/'), getPlatformFallbackIcon: () => Video, getCleanChannelName: (id: string) => id,
  currentPage, paginatedClips, displayTotalPages, goToPage, nextPage: () => goToPage(currentPage.value + 1), previousPage: () => goToPage(currentPage.value - 1),
  youtubeTab, rumbleTab, tokendTab, tokendModeLabel: '', switchYouTubeTab: (tab: 'streams' | 'videos') => { youtubeTab.value = tab; void handleSearch() }, switchRumbleTab: (tab: 'streams' | 'videos') => { rumbleTab.value = tab; void handleSearch() }, switchTokendTab: () => {},
  selectedVodIds, clearSelection, toggleVodSelection, downloadSelectedVods, handleClipClick: () => {}, handleDownloadClip,
  isVodAlreadyDownloaded: (id: string) => downloaded.value.has(platformStore.clips.find(clip => clip.clipId === id)?.mp4Url || ''),
  showDownloadDialog, clipToDownload, downloadStarting, closeDownloadDialog, downloadClipConfirmed, selectedTimeRange, selectedDuration, isFullStreamSelected,
  handleTimeRangeChange: (value: { startTime: number; endTime: number }) => { selectedTimeRange.value = value }, resetToFullStream: () => { selectedTimeRange.value = { startTime: 0, endTime: clipToDownload.value?.duration || 0 } },
  autoSegment, autoSegmentDuration, estimatedParts, downloadQueue, currentQueueIndex, isProcessingQueue, nextSegmentNumber: 1, clipDefaultsEligible, useCreatorLayout,
  formatDuration: (seconds?: number) => !seconds ? 'Unknown' : [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, Math.floor(seconds) % 60].filter((_, index) => index || seconds >= 3600).map((value, index) => index ? String(value).padStart(2, '0') : String(value)).join(':'),
  formatAbsoluteDate: (value: string | number | Date, includeTime = false) => includeTime ? new Date(value).toLocaleString() : new Date(value).toLocaleDateString(), formatRelativeTime: (value: string | number | Date) => { const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000)); return days ? `${days} ${days === 1 ? 'day' : 'days'} ago` : 'Today' }
})
const closeRecentOnOutsideClick = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest('.streamvods-recent')) showRecentDropdown.value = false }
onMounted(async () => {
  document.addEventListener('click', closeRecentOnOutsideClick)
  const run = generation
  try { const result = await workspaceClient.get<{ searches: Recent[] }>('/web/vod-searches'); if (run === generation) platformStore.getRecentSearches = result.searches }
  catch (cause) { showError('Could not load recent searches', errorMessage(cause)) }
  if (props.channel) void handleSearch()
})
onUnmounted(() => { generation++; document.removeEventListener('click', closeRecentOnOutsideClick) })
</script>
