import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClippsterLogo } from '@/components/ClippsterLogo';
import { tokens } from '@/theme/tokens';

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showLogo?: boolean;
  rightAction?: ReactNode;
}

export function ScreenHeader({
  title,
  subtitle,
  showBack,
  showLogo,
  rightAction,
}: ScreenHeaderProps) {
  return (
    <SafeAreaView edges={['top']} className="bg-background">
      <View>
        <View className="min-h-[60px] px-5 pb-2 pt-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center gap-2">
              {showBack ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  onPress={() => router.back()}
                  className="mr-1 min-h-11 min-w-11 items-center justify-center rounded-xl active:bg-white/5"
                >
                  <Ionicons name="chevron-back" size={24} color={tokens.colors.foreground} />
                </Pressable>
              ) : null}
              {showLogo ? (
                <ClippsterLogo iconSize={28} wordmarkHeight={18} />
              ) : title ? (
                <View className="min-w-0 flex-1 pr-2">
                  <Text className="text-xl font-bold tracking-tight text-foreground" numberOfLines={2}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text className="text-[13px] text-muted">{subtitle}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
            {rightAction}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
