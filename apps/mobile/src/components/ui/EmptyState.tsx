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

/** Dashed empty card matching Home / Accounts. */
export function EmptyState({ icon = 'folder-open-outline', title, subtitle, action }: EmptyStateProps) {
  return (
    <View className="items-center rounded-xl border border-dashed border-border px-6 py-10">
      <View className="mb-3 h-12 w-12 items-center justify-center rounded-xl bg-accent/15">
        <Ionicons name={icon} size={24} color={tokens.colors.accent} />
      </View>
      <Text className="text-center text-lg font-semibold text-foreground">{title}</Text>
      {subtitle ? (
        <Text className="mt-2 text-center text-sm text-muted">{subtitle}</Text>
      ) : null}
      {action ? <View className="mt-4">{action}</View> : null}
    </View>
  );
}
