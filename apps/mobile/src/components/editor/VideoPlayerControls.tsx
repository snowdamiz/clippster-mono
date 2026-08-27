import { Ionicons } from '@expo/vector-icons';
import type { VideoPlayer } from 'expo-video';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SeekBar } from '@/components/ui/seek-bar';
import { tokens } from '@/theme/tokens';

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface VideoPlayerControlsProps {
  player?: VideoPlayer | null;
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  onSeekBy?: (delta: number) => void;
  playing?: boolean;
  onTogglePlay?: () => void;
}

export function VideoPlayerControls({
  player,
  currentTime,
  duration,
  onSeek,
  onSeekBy,
  playing,
  onTogglePlay,
}: VideoPlayerControlsProps) {
  const total = Math.max(duration, 0);
  const muted = Boolean(player && (player.muted || player.volume <= 0));
  const liveVolume = !player || muted ? 0 : player.volume;
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [scrubVolume, setScrubVolume] = useState<number | null>(null);

  const shownTime = scrubTime ?? Math.min(currentTime, total);
  const shownVolume = scrubVolume ?? liveVolume;

  return (
    <View className="gap-2 px-4 py-2">
      <View className="flex-row items-center gap-3">
        <Text className="w-12 text-xs text-muted">{formatTime(shownTime)}</Text>
        <View className="flex-1">
          <SeekBar
            minimumValue={0}
            maximumValue={Math.max(total, 1)}
            step={0.1}
            value={shownTime}
            onValueChange={setScrubTime}
            onSlidingComplete={(next) => {
              setScrubTime(null);
              onSeek(next);
            }}
          />
        </View>
        <Text className="w-12 text-right text-xs text-muted">{formatTime(total)}</Text>
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => (onSeekBy ? onSeekBy(-10) : player?.seekBy(-10))} hitSlop={8}>
            <Ionicons name="play-back" size={22} color={tokens.colors.foreground} />
          </Pressable>
          <Pressable
            onPress={() => {
              if (onTogglePlay) {
                onTogglePlay();
                return;
              }
              if (player?.playing) player.pause();
              else player?.play();
            }}
            className="h-10 w-10 items-center justify-center rounded-full bg-primary"
          >
            <Ionicons
              name={(playing ?? player?.playing) ? 'pause' : 'play'}
              size={20}
              color={tokens.colors.primaryForeground}
            />
          </Pressable>
          <Pressable onPress={() => (onSeekBy ? onSeekBy(10) : player?.seekBy(10))} hitSlop={8}>
            <Ionicons name="play-forward" size={22} color={tokens.colors.foreground} />
          </Pressable>
        </View>

        {player ? (
        <View className="w-36 flex-row items-center gap-2">
          <Pressable
            onPress={() => {
              player.muted = !muted;
              if (muted && player.volume === 0) {
                player.volume = 1;
              }
            }}
            hitSlop={8}
          >
            <Ionicons
              name={shownVolume <= 0 ? 'volume-mute' : shownVolume > 0.5 ? 'volume-high' : 'volume-low'}
              size={20}
              color={tokens.colors.foreground}
            />
          </Pressable>
          <View className="flex-1">
            <SeekBar
              minimumValue={0}
              maximumValue={1}
              step={0.01}
              value={shownVolume}
              onValueChange={setScrubVolume}
              onSlidingComplete={(next) => {
                setScrubVolume(null);
                player.muted = next === 0;
                player.volume = next;
              }}
            />
          </View>
        </View>
        ) : null}
      </View>
    </View>
  );
}
