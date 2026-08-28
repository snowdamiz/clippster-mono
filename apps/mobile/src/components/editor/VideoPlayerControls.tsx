import { Ionicons } from '@expo/vector-icons';
import type { VideoPlayer } from 'expo-video';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { PlaybackClockText } from '@/components/editor/PlaybackClockText';
import { SeekBar } from '@/components/ui/seek-bar';
import { formatPlaybackClock } from '@/lib/formatTime';

interface VideoPlayerControlsProps {
  player?: VideoPlayer | null;
  currentTime: number;
  timeSV?: SharedValue<number>;
  duration: number;
  onSeek: (seconds: number) => void;
  onSeekBy?: (delta: number) => void;
  playing?: boolean;
  onTogglePlay?: () => void;
}

export function VideoPlayerControls({
  player,
  currentTime,
  timeSV,
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
  const isPlaying = playing ?? Boolean(player?.playing);

  function togglePlay() {
    if (onTogglePlay) {
      onTogglePlay();
      return;
    }
    if (player?.playing) player.pause();
    else player?.play();
  }

  function goToBeginning() {
    if (onSeekBy && currentTime <= 0.05) return;
    onSeek(0);
  }

  return (
    <View className="bg-black/40 px-1.5 py-1.5">
      <View className="px-1.5 pb-1">
        <SeekBar
          minimumValue={0}
          maximumValue={Math.max(total, 1)}
          step={0.01}
          value={shownTime}
          onValueChange={setScrubTime}
          onSlidingComplete={(next) => {
            setScrubTime(null);
            onSeek(next);
          }}
        />
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Pressable onPress={goToBeginning} hitSlop={8} className="rounded-lg p-2.5">
            <Ionicons name="play-skip-back" size={16} color="rgba(255,255,255,0.6)" />
          </Pressable>
          <Pressable onPress={togglePlay} hitSlop={8} className="rounded-lg p-2.5">
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={16}
              color="rgba(255,255,255,0.6)"
            />
          </Pressable>
          <View className="ml-1 flex-row items-center rounded-lg bg-white/[0.04] px-3 py-2">
            {scrubTime != null || !timeSV ? (
              <Text className="font-mono text-xs tabular-nums tracking-tight text-white/90">
                {formatPlaybackClock(shownTime)}
              </Text>
            ) : (
              <PlaybackClockText time={timeSV} style={{ color: 'rgba(255,255,255,0.9)' }} />
            )}
            <Text className="font-mono text-xs tabular-nums tracking-tight text-white/40"> / </Text>
            <Text className="font-mono text-xs tabular-nums tracking-tight text-white/50">
              {formatPlaybackClock(total)}
            </Text>
          </View>
        </View>

        {player ? (
          <View className="w-32 flex-row items-center gap-2 px-2 py-1.5">
            <Pressable
              onPress={() => {
                player.muted = !muted;
                if (muted && player.volume === 0) {
                  player.volume = 1;
                }
              }}
              hitSlop={8}
              className="rounded-md p-1.5"
            >
              <Ionicons
                name={shownVolume <= 0 ? 'volume-mute' : 'volume-medium'}
                size={16}
                color="rgba(255,255,255,0.6)"
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
