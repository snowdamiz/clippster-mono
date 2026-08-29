import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, Share, Text, View } from 'react-native';
import { getPublicProfilePath, getPublicProfileUrl } from '@/lib/publicProfileUrl';
import { tokens } from '@/theme/tokens';
import { appAlert } from '@/lib/appAlert';

interface PublicProfileLinkRowProps {
  slug: string;
  className?: string;
}

export function PublicProfileLinkRow({ slug }: PublicProfileLinkRowProps) {
  const path = getPublicProfilePath(slug);

  async function copyLink() {
    const url = getPublicProfileUrl(slug);

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        appAlert('Copied', 'Profile link copied to clipboard.');
        return;
      } catch {
        // fall through to share / alert
      }
    }

    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { url, message: path }
          : { message: url, title: 'Public profile link' },
      );
    } catch {
      appAlert('Profile link', url);
    }
  }

  return (
    <Pressable
      onPress={() => void copyLink()}
      className="mt-1 flex-row items-center gap-2 rounded-md border border-accent/25 bg-accent/5 px-2 py-1.5"
    >
      <Ionicons name="link-outline" size={14} color={tokens.colors.accent} />
      <Text className="flex-1 text-xs text-accent" numberOfLines={1}>{path}</Text>
      <View className="flex-row items-center gap-1">
        <Ionicons name="copy-outline" size={14} color={tokens.colors.accent} />
        <Text className="text-xs font-medium text-accent">Copy</Text>
      </View>
    </Pressable>
  );
}
