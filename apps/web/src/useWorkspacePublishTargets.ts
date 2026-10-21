import { ref, computed, markRaw } from 'vue'
import { Instagram, Youtube } from 'lucide-vue-next'
import XLogo from '@/components/icons/XLogo.vue'
import TiktokLogo from '@/components/icons/TiktokLogo.vue'
import TokendLogo from '@/components/icons/TokendLogo.vue'
import type { WebClip, WebProject } from '@clippster/shared-types'
import { usePublishAccounts } from './usePublishAccounts'
import { workspaceClient } from './api'
type Target = { id: string; buildId: string; type: string; name: string; aspectRatio: string; organizationId?: number; campaignId?: number; selectedPlatforms: Map<string, string> }
export function useWorkspacePublishTargets(project: () => WebProject, clip: () => WebClip | null, close: () => void, report: (cause: unknown) => void) {
  const accounts = usePublishAccounts(), caption = ref(''), buildTargets = ref<Target[]>([]), activeAccountDropdown = ref<string | null>(null), publishing = ref(false)
  const requestIds = new Map<string, string>(), submitted = new Set<string>()
  const availablePlatforms = [{ id: 'instagram', label: 'Instagram', icon: markRaw(Instagram) }, { id: 'twitter', label: 'X', icon: markRaw(XLogo) }, { id: 'tiktok', label: 'TikTok', icon: markRaw(TiktokLogo) }, { id: 'youtube', label: 'YouTube', icon: markRaw(Youtube) }, { id: 'tokend', label: 'Tokend', icon: markRaw(TokendLogo) }]
  const groupedBuildTargets = computed(() => Object.fromEntries([...new Set(buildTargets.value.map(value => value.aspectRatio))].map(ratio => [ratio, buildTargets.value.filter(value => value.aspectRatio === ratio)])))
  const totalSelectedPlatforms = computed(() => buildTargets.value.reduce((sum, target) => sum + target.selectedPlatforms.size, 0))
  const canPublish = computed(() => totalSelectedPlatforms.value > 0 && buildTargets.value.every(target => !!target.buildId && [...target.selectedPlatforms.values()].every(Boolean)))
  const accountFor = (key: string) => accounts.accounts.value.find(account => `${account.organizationId ? 'org' : 'user'}:${account.id}` === key)
  function selectAccountForAspectRatio(ratio: string, platform: string, key: string) { for (const target of buildTargets.value.filter(value => value.aspectRatio === ratio)) target.selectedPlatforms.set(platform, key); activeAccountDropdown.value = null }
  function togglePlatformForAspectRatio(ratio: string, platform: string) { for (const target of buildTargets.value.filter(value => value.aspectRatio === ratio)) { if (target.selectedPlatforms.has(platform)) target.selectedPlatforms.delete(platform); else target.selectedPlatforms.set(platform, '') } }
  function ready(builds: NonNullable<WebClip['builds']>) {
    const previous = buildTargets.value
    buildTargets.value = builds.map(build => { const target = previous.find(value => value.aspectRatio === build.aspectRatio && value.organizationId === build.organizationId && value.campaignId === build.campaignId); return { ...target, id: build.id, buildId: build.id, aspectRatio: build.aspectRatio, organizationId: build.organizationId, campaignId: build.campaignId, type: build.campaignId ? 'campaign' : build.organizationId ? 'org' : 'personal', name: target?.name || 'Personal', selectedPlatforms: target?.selectedPlatforms || new Map() } })
  }
  async function publish() {
    const selected = clip(); if (!selected || !canPublish.value || publishing.value) return
    publishing.value = true
    try {
      for (const target of buildTargets.value) for (const [platform, key] of target.selectedPlatforms) {
        const account = accountFor(key); if (!account) throw new Error('Choose a connected account for each platform.')
        const fingerprint = `${target.buildId}:${account.organizationId || 0}:${account.id}:${caption.value}`
        if (submitted.has(fingerprint)) continue
        if (!requestIds.has(fingerprint)) requestIds.set(fingerprint, crypto.randomUUID())
        await workspaceClient.post(`/web/projects/${project().id}/clips/${selected.id}/publish`, { requestId: requestIds.get(fingerprint), buildId: target.buildId, accountId: account.id, organizationId: account.organizationId, caption: caption.value })
        submitted.add(fingerprint)
      }
      close()
    } catch (cause) { report(cause) } finally { publishing.value = false }
  }
  const model = { caption, buildTargets, groupedBuildTargets, availablePlatforms, activeAccountDropdown, canPublish, totalSelectedPlatforms, getPlatformIcon: (id: string) => availablePlatforms.find(value => value.id === id)?.icon, getPlatformLabel: (id: string) => availablePlatforms.find(value => value.id === id)?.label || id,
    getOrgAccountsForPlatform: (platform: string) => accounts.accounts.value.filter(value => value.platform === platform && value.organizationId), getPersonalAccountsForPlatform: (platform: string) => accounts.accounts.value.filter(value => value.platform === platform && !value.organizationId),
    getSelectedPlatformsForAspectRatio: (ratio: string) => [...(groupedBuildTargets.value[ratio]?.[0].selectedPlatforms.keys() || [])], togglePlatformForAspectRatio, selectAccountForAspectRatio, getAccountLabelForAspectRatio: (ratio: string, platform: string) => accountFor(groupedBuildTargets.value[ratio]?.[0].selectedPlatforms.get(platform) || '')?.username || 'Select account...', toggleAccountDropdownForAspectRatio: (ratio: string, platform: string) => { const key = `${ratio}-${platform}`; activeAccountDropdown.value = activeAccountDropdown.value === key ? null : key },
    selectedPublishPlatforms: [], platformConfigs: {}, activeAspectRatioDropdown: null, handlePublish: publish }
  return { model, publishing, ready, load: accounts.load, plan: (targets: Array<Omit<Target, 'id' | 'buildId' | 'selectedPlatforms'>>) => { buildTargets.value = targets.map(target => ({ ...target, id: crypto.randomUUID(), buildId: '', selectedPlatforms: new Map() })) }, reset: () => { buildTargets.value = []; caption.value = ''; activeAccountDropdown.value = null } }
}
