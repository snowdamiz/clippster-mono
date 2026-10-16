import type { ApiClient } from '@clippster/api-client'
import type { WebBranding } from '@clippster/shared-types'
import { requireValue } from './errors'
interface Profile { id: number; organization_id: number; disabled?: boolean; scope?: string; intro_id?: number; outro_id?: number; watermark_id?: number; intro?: { url: string }; outro?: { url: string }; watermark?: { url: string }; intro_ratio_settings?: Record<string, { assetId?: number; enabled?: boolean }>; outro_ratio_settings?: Record<string, { assetId?: number; enabled?: boolean }>; watermark_settings?: Record<string, { watermarkId?: number; enabled?: boolean; position?: { x: number; y: number; scale: number; opacity: number } }> }
interface Campaign { id: number; organization_id: number; branding_profile_id?: number; branding_profile?: Profile }
export async function targetBranding(branding: WebBranding, ratio: string, upstream: ApiClient) {
  const assigned = await upstream.get<{ success: boolean; profiles: Profile[] }>('/user/assigned-creator-profiles')
  requireValue(assigned.success, 502, 'Unable to check organization branding.')
  let profile = assigned.profiles.find(value => value.id === branding.brandingProfileId && value.organization_id === branding.organizationId && !value.disabled)
  if (branding.campaignId) {
    const global = await upstream.get<{ success: boolean; campaigns: Campaign[] }>('/user/campaigns/global-branding')
    let campaign = global.campaigns?.find(value => value.id === branding.campaignId)
    if (!campaign && profile) {
      const specific = await upstream.get<{ campaigns: Campaign[] }>(`/user/campaigns/by-creator/${profile.id}`)
      campaign = specific.campaigns?.find(value => value.id === branding.campaignId)
    }
    requireValue(campaign && campaign.organization_id === branding.organizationId, 403, 'This campaign is no longer available to your account.')
    if (campaign.branding_profile_id) { requireValue(campaign.branding_profile && campaign.branding_profile_id === branding.brandingProfileId, 403, 'Choose the campaign branding profile.'); profile = campaign.branding_profile }
    else profile = assigned.profiles.find(value => value.organization_id === branding.organizationId && value.scope === 'global' && !value.disabled)
  }
  requireValue(profile && !profile.disabled, 403, 'This branding profile is not assigned to your account.')
  const assets = await upstream.get<{ success: boolean; assets: Array<{ id: number; asset_type: string; url: string }> }>(`/organizations/${branding.organizationId}/assets`)
  requireValue(assets.success, 502, 'Unable to load organization assets.')
  const resolve = (id: number | undefined, type: string, fallback?: string) => {
    if (!id) return fallback
    const asset = assets.assets.find(value => value.id === id && value.asset_type === type)
    requireValue(asset, 403, `The organization ${type} asset is no longer available.`); return asset.url
  }
  const intro = profile.intro_ratio_settings?.[ratio], outro = profile.outro_ratio_settings?.[ratio], watermark = profile.watermark_settings?.[ratio]
  return { intro: intro?.enabled === false ? undefined : resolve(intro?.assetId || profile.intro_id, 'intro', profile.intro?.url), outro: outro?.enabled === false ? undefined : resolve(outro?.assetId || profile.outro_id, 'outro', profile.outro?.url), watermark: watermark?.enabled === false ? undefined : resolve(watermark?.watermarkId || profile.watermark_id, 'watermark', profile.watermark?.url), position: watermark?.position }
}
