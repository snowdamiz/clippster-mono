import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
}

export function AppHeader({ title, subtitle, showBack }: AppHeaderProps) {
  return (
    <SafeAreaView edges={['top']} className="bg-background">
      <View className="border-b border-border px-4 pb-4 pt-2">
        {showBack ? (
          <Pressable onPress={() => router.back()} className="mb-2 self-start">
            <Text className="text-base text-primary">← Back</Text>
          </Pressable>
        ) : null}
        <Text className="text-2xl font-bold text-foreground">{title}</Text>
        {subtitle ? <Text className="mt-1 text-sm text-muted">{subtitle}</Text> : null}
      </View>
    </SafeAreaView>
  );
}
