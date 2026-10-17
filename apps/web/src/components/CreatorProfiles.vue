<template>
  <div class="creators">
    <Toast />
    <CreatorProfilesView :model="model">
      <template #notice>
        <p v-if="error" role="alert" class="m-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{{ error }} <button class="underline" @click="load">Retry</button></p>
      </template>
    </CreatorProfilesView>
    <ProfileDialog :show="showEditor" mode="local" :creator="editingCreator" :scope="activeTab === 'global' ? 'global' : 'streamer'" @close="showEditor = false" @saved="load" />
    <CreatorDownloadDialog :show="!!downloadingCreator" :creator="downloadingCreator" :selected-vod="selectedVod" @close="downloadingCreator = null" />
    <ConfirmationModal :show="!!deletingCreator" title="Delete Creator" message="Are you sure you want to delete" :item-name="deletingCreator?.name" suffix="? This will remove all platform links but not the associated VODs or clips." confirm-text="Delete" variant="destructive" @close="deletingCreator = null" @confirm="remove" />
    <AddPostDialog v-model="showPersonalPost" />
    <ExternalPostSubmitDialog :open="!!postingCreator" :organization-id="postingCreator?.organization_id || 0" :creator-profiles="postingCreator ? [{ id: postingCreator.server_id || Number(postingCreator.id), name: postingCreator.name }] : []" :campaigns="[]" :preselected-creator-profile-id="postingCreator?.server_id" @close="postingCreator = null" />
    <dialog ref="desktopNotice" class="m-auto max-w-md rounded-xl border border-white/10 bg-zinc-950 p-6 text-white backdrop:bg-black/80">
      <h2 class="mb-3 text-lg font-semibold">Live-stream tools</h2>
      <p class="mb-4 text-sm text-zinc-400">Recording and live monitoring run in Clippster Desktop. Your creator profiles and branding are shared across your account.</p>
      <button class="button-secondary" @click="desktopNotice?.close()">Close</button>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { Paintbrush, Users } from 'lucide-vue-next'
import CreatorProfilesView from '@/components/CreatorProfilesView.vue'
import ProfileDialog from '@/components/ProfileDialog.vue'
import CreatorDownloadDialog from '@/components/CreatorDownloadDialog.vue'
import type { PlatformClip } from '@/stores/platform'
import Toast from '@/components/Toast.vue'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import AddPostDialog from '@/components/AddPostDialog.vue'
import ExternalPostSubmitDialog from '@/components/organization/ExternalPostSubmitDialog.vue'
import type { CreatorProfileWithLinks } from '@/services/database/types'
import { getPlatformIcon, getPlatformFilter } from '@/lib/creatorProfilePresentation'
import { convertCampaignsToGroupedDisplay, type DisplayCampaign } from '@/lib/creatorCampaignPresentation'
import type { Campaign } from '@/services/campaignApi'
import type { PlatformId } from '@/config/platforms'
import { workspaceClient, errorMessage } from '../api'
import { hydrateCreatorAssets, releaseSelectedFiles, creatorAvatarUrl } from '../creatorProfileRuntime'

interface PlatformLink { id?: number | string; platform: string; platform_id: string; display_name?: string | null; profile_image_url?: string | null; is_primary: boolean }
interface Creator { id: number | string; name: string; description?: string | null; scope: string; disabled?: boolean; profile_image_url?: string | null; platform_links: PlatformLink[]; isOrgProfile?: boolean; organization_id?: number; organization_name?: string; server_id?: number; intro_id?: number | null; outro_id?: number | null; watermark_id?: number | null }
const account = '/web/account'
const creators = ref<Creator[]>([]), loading = ref(true), error = ref(''), activeTab = ref('streamer'), searchQuery = ref('')
const campaigns = ref<DisplayCampaign[]>([]), expandedCampaigns = ref(new Set<number>())
const desktopNotice = ref<HTMLDialogElement>()
const downloadingCreator = ref<CreatorProfileWithLinks | null>(null), selectedVod = ref<PlatformClip | null>(null)
const deletingCreator = ref<Creator | null>(null), postingCreator = ref<Creator | null>(null), showPersonalPost = ref(false)
const showEditor = ref(false), editingCreator = ref<CreatorProfileWithLinks | null>(null)
watch(showEditor, open => { if (!open) releaseSelectedFiles() })
const filteredCreators = computed(() => creators.value.filter(creator =>
  (activeTab.value === 'streamer' ? ['streamer', 'personal_studio'].includes(creator.scope || 'streamer') : creator.scope === activeTab.value) &&
  (!searchQuery.value.trim() || [creator.name, ...creator.platform_links.flatMap(link => [link.display_name || '', link.platform_id])].some(value => value.toLowerCase().includes(searchQuery.value.trim().toLowerCase())))
).sort((a, b) => a.name.localeCompare(b.name)))
const userProfiles = computed(() => filteredCreators.value.filter(creator => !creator.isOrgProfile))
const organizationProfiles = computed(() => filteredCreators.value.filter(creator => creator.isOrgProfile))
async function load() {
  loading.value = true; error.value = ''
  try {
    const [personal, assigned, joined] = await Promise.all([
      workspaceClient.get<{ profiles: Creator[] }>(account + '/user/creator-profiles'),
      workspaceClient.get<{ profiles: Creator[] }>(account + '/user/assigned-creator-profiles'),
      workspaceClient.get<{ campaigns: Campaign[] }>(account + '/user/campaigns').catch(() => ({ campaigns: [] }))
    ])
    creators.value = [
      ...(await hydrateCreatorAssets(personal.profiles)).map(profile => ({ ...profile, scope: profile.scope || 'streamer', platform_links: profile.platform_links || [], isOrgProfile: false })),
      ...assigned.profiles.map(profile => ({ ...profile, id: `org-${profile.id}`, server_id: Number(profile.id), scope: profile.scope || 'streamer', platform_links: profile.platform_links || [], isOrgProfile: true }))
    ]
    campaigns.value = convertCampaignsToGroupedDisplay(joined.campaigns)
  } catch (cause) { error.value = errorMessage(cause) }
  finally { loading.value = false }
}
function jsonSettings(value: unknown) { return typeof value === 'string' ? value : value == null ? null : JSON.stringify(value) }
function edit(creator?: Creator) {
  editingCreator.value = creator ? {
    ...creator, id: String(creator.id),
    intro_id: creator.intro_id == null ? null : String(creator.intro_id),
    outro_id: creator.outro_id == null ? null : String(creator.outro_id),
    watermark_id: creator.watermark_id == null ? null : String(creator.watermark_id),
    watermark_settings: jsonSettings((creator as any).watermark_settings),
    intro_outro_settings: jsonSettings((creator as any).intro_outro_settings),
    intro_ratio_settings: jsonSettings((creator as any).intro_ratio_settings),
    outro_ratio_settings: jsonSettings((creator as any).outro_ratio_settings),
    layout_overlays: jsonSettings((creator as any).layout_overlays),
    clip_build_defaults: jsonSettings((creator as any).clip_build_defaults),
    platform_links: creator.platform_links.map(link => ({ ...link, id: String(link.id), platform: link.platform === 'YouTube' ? 'youtube' : link.platform }))
  } as unknown as CreatorProfileWithLinks : null
  showEditor.value = true
}
async function remove() {
  const creator = deletingCreator.value
  if (!creator) return
  try { await workspaceClient.delete(`${account}/user/creator-profiles/${creator.id}`); deletingCreator.value = null; await load() }
  catch (cause) { error.value = errorMessage(cause) }
}
async function toggleDisabled(creator: Creator) {
  try { await workspaceClient.put(`${account}/user/creator-profiles/${creator.id}`, { disabled: !creator.disabled }); await load() }
  catch (cause) { error.value = errorMessage(cause) }
}
function download(creator: Creator) {
  selectedVod.value = null
  downloadingCreator.value = creator as unknown as CreatorProfileWithLinks
}
function viewVods(creator: Creator) {
  const link = creator.platform_links.find(link => link.is_primary) || creator.platform_links[0]
  if (!link) { error.value = 'Add a platform link to this creator to browse videos.'; return }
  window.dispatchEvent(new CustomEvent('clippster-search-vods', { detail: { platform: link.platform, channel: link.platform_id } }))
}
function desktopTool() { desktopNotice.value?.showModal() }
const model = reactive({
  Paintbrush, Users, activeTab, authStore: { isAuthenticated: true }, campaigns, creators, filteredCreators, userProfiles, organizationProfiles, searchQuery, loading,
  syncingPersonal: loading, syncPersonalToCloud: load, syncPersonalLabel: 'Refresh', openCreateDialog: () => edit(), openEditDialog: edit,
  confirmDeleteCreator: (creator: Creator) => { deletingCreator.value = creator }, toggleProfileDisabled: toggleDisabled, openDownloadDialog: download, viewCreatorVods: viewVods,
  openPersonalPostDialog: () => { showPersonalPost.value = true }, openPostSubmitDialog: (creator: Creator) => { postingCreator.value = creator },
  getCreatorProfileImage: (creator: Creator) => (creator.profile_image_url || creator.platform_links.some(link => link.profile_image_url)) ? creatorAvatarUrl(creator.id, Boolean(creator.isOrgProfile)) : undefined,
  handleImageError: (event: Event) => { (event.target as HTMLImageElement).style.display = 'none' },
  getPlatformIcon: (platform: PlatformId) => getPlatformIcon(platform, '/workspace/'), getPlatformFilter,
  isLiveClipEnabled: false, liveCreatorsCount: 0, monitoringCreatorsCount: 0,
  isCreatorLive: () => false, isCreatorMonitored: () => false, isCreatorCheckingLive: () => false, isCreatorAutoDvrEnabled: () => false,
  hasMonitorableLink: () => false, canWatchCreator: () => false, isCreatorPersistentAutoDetect: () => false, isCreatorPersistentRecord: () => false,
  getCreatorStatusLabel: () => '', isCampaignExpanded: (id: number) => expandedCampaigns.value.has(id), toggleCampaignExpansion: (id: number) => { if (expandedCampaigns.value.has(id)) expandedCampaigns.value.delete(id); else expandedCampaigns.value.add(id) },
  onCreatorAutoDetectClick: desktopTool, onCreatorRecordClick: desktopTool, stopCreatorMonitoring: desktopTool, toggleCreatorAutoDvr: desktopTool, watchCreator: desktopTool,
})
let refreshTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => { void load(); refreshTimer = setInterval(() => { if (!document.hidden && !showEditor.value && !loading.value) void load() }, 30_000) })
onUnmounted(() => { clearInterval(refreshTimer); releaseSelectedFiles() })
</script>
<style scoped>
  .creators { width: 100%; min-height: 100%; }
</style>
