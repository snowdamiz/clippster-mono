import type { SharedClip } from '@clippster/api-client';
import { getExpirationText } from '@clippster/api-client';
import { Text, View } from 'react-native';
import { ThumbnailRow } from '@/components/navigation/ThumbnailRow';
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
    <ThumbnailRow title={clip.name} subtitle={clip.organization_name ?? "Organization"} image={clip.thumbnail_url} onPress={onPress}>
          <View className="flex-row flex-wrap gap-2">
            <Text className="text-xs" style={{ color: expiryColor(clip.days_until_expiration) }}>
              {getExpirationText(clip.days_until_expiration)}
            </Text>
            {clip.branding_required ? (
              <Text className="text-xs text-warning">Branding required</Text>
            ) : null}
            {clip.downloaded_at ? (
              <Text className="text-xs text-success">Downloaded</Text>
            ) : clip.viewed_at ? (
              <Text className="text-xs text-muted">Viewed</Text>
            ) : null}
          </View>
    </ThumbnailRow>
  );
}
