import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { clipperProfilesApi } from '@/services/api';
import { tokens } from '@/theme/tokens';

export default function ProfilePreviewScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (!slug) return;
    void (async () => {
      try {
        const response = await clipperProfilesApi.getClipperBySlug(slug);
        if (response.success && response.profile) {
          setName(response.profile.display_name ?? 'Clipper');
          setBio(response.profile.bio ?? '');
          setTags([
            ...(response.profile.specialty_tags ?? []),
            ...(response.profile.content_style_tags ?? []),
          ]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Public preview" showBack />
      <ScrollView contentContainerClassName="gap-4 px-4 py-4">
        <Card className="gap-2">
          <Text className="text-xl font-bold text-foreground">{name}</Text>
          <Text className="text-muted">clippster.app/clippers/{slug}</Text>
          {bio ? <Text className="text-foreground">{bio}</Text> : null}
          {tags.length > 0 ? (
            <Text className="text-sm text-muted">{tags.join(' · ')}</Text>
          ) : null}
        </Card>
        <Text className="text-center text-sm text-muted">
          Full public profile is available on clippster.app
        </Text>
      </ScrollView>
    </View>
  );
}
