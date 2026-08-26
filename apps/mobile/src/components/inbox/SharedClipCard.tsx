import type { SharedClip } from '@clippster/api-client';
import { getExpirationText } from '@clippster/api-client';
import { Image, Pressable, Text, View } from 'react-native';
import { Card } from '@/components/ui/card';
import { tokens } from '@/theme/tokens';

interface SharedClipCardProps {
  clip: SharedClip;
  onPress: () => void;
}

function expiryColor(days: number): string {
  if (days >= 5) return tokens.colors.primary;
  if (days >= 2) return tokens.colors.warning;
  return tokens.colors.destructive;
}

export function SharedClipCard({ clip, onPress }: SharedClipCardProps) {
  return (
    <Pressable onPress={onPress}>
      <Card className="flex-row gap-3">
        {clip.thumbnail_url ? (
          <Image source={{ uri: clip.thumbnail_url }} className="h-20 w-14 rounded-md" />
        ) : (
          <View className="h-20 w-14 items-center justify-center rounded-md bg-surfaceMuted">
            <Text className="text-xs text-muted">Clip</Text>
          </View>
        )}
        <View className="flex-1 gap-1">
          <Text className="font-semibold text-foreground" numberOfLines={1}>
            {clip.name}
          </Text>
          <Text className="text-sm text-muted" numberOfLines={1}>
            {clip.organization_name ?? 'Organization'}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Text className="text-xs" style={{ color: expiryColor(clip.days_until_expiration) }}>
              {getExpirationText(clip.days_until_expiration)}
            </Text>
            {clip.branding_required ? (
              <Text className="text-xs text-warning">Branding required</Text>
            ) : null}
            {clip.downloaded_at ? (
              <Text className="text-xs text-green-400">Downloaded</Text>
            ) : clip.viewed_at ? (
              <Text className="text-xs text-muted">Viewed</Text>
            ) : null}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
