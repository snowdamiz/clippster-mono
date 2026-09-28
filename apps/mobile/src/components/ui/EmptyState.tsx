import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { tokens } from '@/theme/tokens';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = 'folder-open-outline', title, subtitle, action }: EmptyStateProps) {
  return (
    <View className="items-center gap-[18px] px-3 py-[50px]">
      <View className="h-[70px] w-[70px] items-center justify-center rounded-[23px] bg-surfaceMuted">
        <Ionicons name={icon} size={30} color={tokens.colors.accent} />
      </View>
      <Text className="text-center text-[28px] font-bold tracking-tight text-foreground">{title}</Text>
      {subtitle ? (
        <Text className="text-center text-sm leading-5 text-muted">{subtitle}</Text>
      ) : null}
      {action ? <View className="mt-4">{action}</View> : null}
    </View>
  );
}
