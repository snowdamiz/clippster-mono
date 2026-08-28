import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClippsterLogo } from '@/components/ClippsterLogo';

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
      <View className="border-b border-border">
        <View className="px-4 pb-3 pt-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center gap-2">
              {showBack ? (
                <Pressable onPress={() => router.back()} className="mr-1 p-1">
                  <Text className="text-sm font-medium text-accent">← Back</Text>
                </Pressable>
              ) : null}
              {showLogo ? (
                <ClippsterLogo iconSize={28} wordmarkHeight={18} />
              ) : title ? (
                <View className="min-w-0 flex-1 pr-2">
                  <Text className="text-lg font-bold text-foreground" numberOfLines={2}>
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
