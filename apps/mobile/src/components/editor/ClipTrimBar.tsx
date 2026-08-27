import { Text, View } from 'react-native';
import { SeekBar } from '@/components/ui/seek-bar';

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface ClipTrimBarProps {
  startTime: number;
  endTime: number;
  videoDuration: number;
  onChangeStart: (startTime: number) => void;
  onChangeEnd: (endTime: number) => void;
}

const MIN_CLIP_SECONDS = 1;

export function ClipTrimBar({
  startTime,
  endTime,
  videoDuration,
  onChangeStart,
  onChangeEnd,
}: ClipTrimBarProps) {
  const max = Math.max(MIN_CLIP_SECONDS, videoDuration);

  return (
    <View className="border-t border-border bg-surface px-4 py-2">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-foreground">Clip range</Text>
        <Text className="text-xs text-muted">
          {formatTime(startTime)} – {formatTime(endTime)} · {formatTime(endTime - startTime)}
        </Text>
      </View>
      <View className="gap-1">
        <Text className="text-[11px] text-muted">Start</Text>
        <SeekBar
          minimumValue={0}
          maximumValue={max}
          step={0.25}
          value={startTime}
          onValueChange={(next) => onChangeStart(Math.min(next, endTime - MIN_CLIP_SECONDS))}
        />
        <Text className="text-[11px] text-muted">End</Text>
        <SeekBar
          minimumValue={0}
          maximumValue={max}
          step={0.25}
          value={endTime}
          onValueChange={(next) => onChangeEnd(Math.max(next, startTime + MIN_CLIP_SECONDS))}
        />
      </View>
    </View>
  );
}
