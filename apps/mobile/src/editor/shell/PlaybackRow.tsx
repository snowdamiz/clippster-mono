import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { tokens } from '@/theme/tokens';
import { ticksToSeconds } from '../model/schema';

export function PlaybackRow({
  playing,
  currentTick,
  durationTick,
  onTogglePlaying,
}: {
  playing: boolean;
  currentTick: number;
  durationTick: number;
  onTogglePlaying: () => void;
}) {
  return (
    <View className="h-12 items-center justify-center border-t border-white/10 bg-black">
      <Text className="absolute left-4 font-mono text-xs text-muted">
        {formatTick(currentTick)} / {formatTick(durationTick)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause' : 'Play'}
        onPress={onTogglePlaying}
        className="min-h-11 min-w-11 items-center justify-center"
      >
        <Ionicons
          name={playing ? 'pause' : 'play'}
          size={28}
          color={tokens.colors.foreground}
        />
      </Pressable>
    </View>
  );
}

function formatTick(tick: number): string {
  const seconds = Math.max(0, ticksToSeconds(tick));
  const whole = Math.floor(seconds);
  const frames = Math.floor((seconds - whole) * 100);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}.${String(frames).padStart(2, '0')}`;
}
