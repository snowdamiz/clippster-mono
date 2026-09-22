import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { tokens } from '@/theme/tokens';

interface MenuRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
  trailing?: ReactNode;
}

export function MenuRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  destructive,
  trailing,
}: MenuRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="min-h-[60px] flex-row items-center gap-3 border-b border-border py-[13px] active:bg-white/5"
    >
      <View className="h-[38px] w-[38px] items-center justify-center rounded-xl bg-surfaceMuted">
        <Ionicons
          name={icon}
          size={18}
          color={destructive ? tokens.colors.destructive : tokens.colors.accent}
        />
      </View>
      <View className="flex-1 min-w-0">
        <Text
          className={`text-sm font-semibold ${destructive ? 'text-destructive' : 'text-foreground'}`}
        >
          {title}
        </Text>
        {subtitle ? <Text className="text-xs leading-5 text-muted">{subtitle}</Text> : null}
      </View>
      {value ? <Text className="text-sm text-muted">{value}</Text> : null}
      {trailing ?? (
        <Ionicons name="chevron-forward" size={18} color={tokens.colors.muted} />
      )}
    </Pressable>
  );
}
