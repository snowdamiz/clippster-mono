import { computed, ref } from 'vue'
import type { WebProject, WebBranding } from '@clippster/shared-types'
import type { ServerOrganizationCreatorProfile } from '@/services/organizationProfilesApi'
import type { Campaign } from '@/services/campaignApi'
import { workspaceClient } from './api'
import { creatorChannelId } from '@/lib/creatorPlatformIds'
type Selection = { selected: boolean; aspectRatios: string[] }
export function useWorkspaceBranding(project: () => WebProject, ratios: () => string[]) {
  const availableOrgs = ref<Array<Selection & { organizationId: number; organizationName: string; profile: ServerOrganizationCreatorProfile }>>([]), availableCampaignSelections = ref<Array<Selection & { campaign: Campaign }>>([])
  const selected = computed(() => availableOrgs.value.some(value => value.selected) || availableCampaignSelections.value.some(value => value.selected))
  function toggleRatio(selection: Selection, ratio: string) { selection.aspectRatios = selection.aspectRatios.includes(ratio) ? selection.aspectRatios.filter(value => value !== ratio) : [...selection.aspectRatios, ratio] }
  async function load() {
    const assigned = await workspaceClient.get<{ profiles: ServerOrganizationCreatorProfile[] }>('/web/account/user/assigned-creator-profiles')
    const profiles = assigned.profiles.filter(profile => !profile.disabled)
    const slug = creatorChannelId(project())
    availableOrgs.value = [...new Set(profiles.map(profile => profile.organization_id))].flatMap(id => {
      const choices = profiles.filter(profile => profile.organization_id === id)
      const profile = choices.find(profile => profile.platform_links?.some(link => link.platform_id.toLowerCase() === slug)) || choices.find(profile => profile.scope === 'global')
      return profile ? [{ organizationId: id, organizationName: profile.organization_name || profile.name, profile, selected: false, aspectRatios: [] }] : []
    })
    const global = await workspaceClient.get<{ campaigns: Campaign[] }>('/web/account/user/campaigns/global-branding')
    const campaigns = [...global.campaigns]
    for (const org of availableOrgs.value) {
      const result = await workspaceClient.get<{ campaigns: Campaign[] }>(`/web/account/user/campaigns/by-creator/${org.profile.id}`)
      for (const campaign of result.campaigns) if (!campaigns.some(value => value.id === campaign.id)) campaigns.push(campaign)
    }
    availableCampaignSelections.value = campaigns.map(campaign => ({ campaign, selected: false, aspectRatios: [] }))
  }
  function targets(): Array<{ ratio: string; branding: Partial<WebBranding> }> {
    return [...availableOrgs.value.filter(value => value.selected).flatMap(value => (value.aspectRatios.length ? value.aspectRatios.filter(ratio => ratios().includes(ratio)) : ratios()).map(ratio => ({ ratio, branding: { organizationId: value.organizationId, brandingProfileId: value.profile.id } }))), ...availableCampaignSelections.value.filter(value => value.selected).flatMap(value => (value.aspectRatios.length ? value.aspectRatios.filter(ratio => ratios().includes(ratio)) : ratios()).map(ratio => ({ ratio, branding: { organizationId: value.campaign.organization?.id || value.campaign.organization_id, brandingProfileId: value.campaign.branding_profile_id || undefined, campaignId: value.campaign.id } })))]
  }
  return { load, targets, model: { availableOrgs, availableCampaignSelections, hasOrgOrCampaignSelected: selected, toggleOrgSelection: (index: number) => { availableOrgs.value[index].selected = !availableOrgs.value[index].selected }, toggleCampaignSelection: (index: number) => { availableCampaignSelections.value[index].selected = !availableCampaignSelections.value[index].selected }, toggleOrgAspectRatio: (index: number, ratio: string) => toggleRatio(availableOrgs.value[index], ratio), toggleCampaignAspectRatio: (index: number, ratio: string) => toggleRatio(availableCampaignSelections.value[index], ratio) } }
}
