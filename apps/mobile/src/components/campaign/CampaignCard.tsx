import type { Campaign } from '@clippster/api-client';
import { formatCpm, getPlatformDisplayName } from '@clippster/api-client';
import { Image, Pressable, Text, View } from 'react-native';
import { Card } from '@/components/ui/card';

interface CampaignCardProps {
  campaign: Campaign;
  onPress: () => void;
  joined?: boolean;
  participationStatus?: string;
}

export function CampaignCard({ campaign, onPress, joined, participationStatus }: CampaignCardProps) {
  const joinLabel =
    campaign.join_type === 'application_required' ? 'Application required' : 'Open to join';

  return (
    <Pressable onPress={onPress}>
      <Card className="gap-3">
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
            <Text className="font-semibold text-foreground">{campaign.title}</Text>
            <Text className="text-sm text-muted">{campaign.organization?.name}</Text>
          </View>
          {joined ? (
            <View className="rounded-full bg-primary/20 px-2 py-1">
              <Text className="text-xs text-primary">{participationStatus ?? 'Joined'}</Text>
            </View>
          ) : null}
        </View>

        <Text className="text-sm text-muted" numberOfLines={2}>
          {campaign.description ?? 'No description'}
        </Text>

        <View className="flex-row flex-wrap gap-2">
          <Text className="rounded-md bg-surfaceMuted px-2 py-1 text-xs text-foreground">
            {formatCpm(campaign.cpm)}
          </Text>
          <Text className="rounded-md bg-surfaceMuted px-2 py-1 text-xs text-foreground">{joinLabel}</Text>
          {campaign.require_watermark ? (
            <Text className="rounded-md bg-warning/20 px-2 py-1 text-xs text-warning">
              Branding required
            </Text>
          ) : null}
        </View>

        <Text className="text-xs text-muted">
          Platforms: {campaign.allowed_platforms.map(getPlatformDisplayName).join(', ')}
        </Text>
      </Card>
    </Pressable>
  );
}
