import type { Campaign } from '@clippster/api-client'
import { getPlatformDisplayName } from '@clippster/api-client'
import { Image, Pressable, Text, View } from 'react-native'
import { Card } from '@/components/ui/card'
import { AppIcon } from '@/components/AppIcon'
import { Button } from '@/components/ui/button'
import { campaignDeadlineLabel, campaignPaymentLabel } from '@/lib/campaignPresentation'
import { tokens } from '@/theme/tokens'

interface CampaignCardProps {
  campaign: Campaign
  onPress: () => void
  joined?: boolean
  participationStatus?: string
  onSubmit?: () => void
}

export function CampaignCard({ campaign, onPress, joined, participationStatus, onSubmit }: CampaignCardProps) {
  const joinLabel = campaign.join_type === 'application_required' ? 'Application required' : 'Open to join'

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card className="gap-3 overflow-hidden p-0">
        {campaign.cover_image_url ? (
          <Image source={{ uri: campaign.cover_image_url }} className="aspect-[2.5] w-full" resizeMode="cover" />
        ) : null}
        <View className="gap-3 p-4">
          <View className="flex-row items-center gap-3">
            {campaign.organization?.logo_url ? (
              <Image source={{ uri: campaign.organization.logo_url }} className="h-10 w-10 rounded-full" />
            ) : (
              <View className="h-10 w-10 items-center justify-center rounded-full bg-surfaceMuted">
                <Text className="text-sm font-bold text-foreground">
                  {campaign.organization?.name?.charAt(0) ?? 'C'}
                </Text>
              </View>
            )}
            <View className="flex-1">
              <Text className="text-[17px] font-semibold text-foreground">{campaign.title}</Text>
              <Text className="text-sm text-muted">{campaign.organization?.name}</Text>
            </View>
            {joined ? (
              <View className="rounded-full bg-accent/15 px-2 py-1">
                <Text className="text-xs text-accent">{participationStatus ?? 'Joined'}</Text>
              </View>
            ) : null}
          </View>

          <Text className="text-sm text-muted" numberOfLines={2}>
            {campaign.description ?? 'No description'}
          </Text>

          <View className="flex-row flex-wrap items-center gap-3">
            <View className="flex-row items-center gap-2">
              <AppIcon name="CreditCard" size={18} color={tokens.colors.muted} />
              <Text className="text-xs text-foreground">{campaignPaymentLabel(campaign)}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <AppIcon name="Calendar" size={18} color={tokens.colors.muted} />
              <Text className="text-xs text-muted">{campaignDeadlineLabel(campaign)}</Text>
            </View>
            {campaign.require_watermark ? (
              <Text className="rounded-md bg-warning/20 px-2 py-1 text-xs text-warning">Branding required</Text>
            ) : null}
          </View>

          <Text className="text-xs text-muted">
            {joinLabel} · {campaign.allowed_platforms.map(getPlatformDisplayName).join(', ')}
          </Text>
          {joined ? (
            <View className="flex-row gap-2">
              <Button title="View campaign" variant="outline" className="flex-1" onPress={onPress} />
              {onSubmit ? <Button title="Submit clip" variant="accent" className="flex-1" onPress={onSubmit} /> : null}
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  )
}
