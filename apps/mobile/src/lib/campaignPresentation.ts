import type { Campaign } from '@clippster/api-client'
import { formatCpm } from '@clippster/api-client'

export function campaignPaymentLabel(campaign: Campaign): string {
  return campaign.payment_model === 'per_clip' && campaign.per_clip_amount != null
    ? `$${Number(campaign.per_clip_amount).toFixed(2)} per approved clip`
    : formatCpm(campaign.cpm)
}
export function campaignDeadlineLabel(campaign: Campaign): string {
  return campaign.ends_at
    ? new Date(campaign.ends_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : 'No deadline'
}
