import type { ReactNode } from 'react';
import { Switch, Text, View } from 'react-native';
import { cn } from '@/lib/utils';

interface SettingRowProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon?: ReactNode;
  className?: string;
}

export function SettingRow({
  title,
  description,
  value,
  onValueChange,
  icon,
  className,
}: SettingRowProps) {
  return (
    <View
      className={cn(
        'flex-row items-center justify-between gap-3 rounded-xl border p-4',
        value ? 'border-accent/25 bg-accent/5' : 'border-border bg-surfaceMuted/40',
        className,
      )}
    >
      <View className="flex-1 flex-row items-center gap-3">
        {icon}
        <View className="flex-1 gap-0.5">
          <Text className="font-medium text-foreground">{title}</Text>
          {description ? <Text className="text-sm leading-5 text-muted">{description}</Text> : null}
        </View>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}
