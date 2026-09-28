import { Text, View } from 'react-native';
import { SeekBar } from '@/components/ui/seek-bar';
import { formatClockTime } from '@/lib/timeRange';
import { ClockInput } from './ClockInput';

export interface TimeRangeValue {
  startTime: number;
  endTime: number;
}

interface VodTimeRangePickerProps {
  totalDuration: number;
  value: TimeRangeValue;
  onChange: (value: TimeRangeValue) => void;
  minSelectionSeconds?: number;
}

export function VodTimeRangePicker({
  totalDuration,
  value,
  onChange,
  minSelectionSeconds = 10,
}: VodTimeRangePickerProps) {
  const max = Math.max(0, Math.floor(totalDuration));
  const minimumLength = Math.min(minSelectionSeconds, max);
  const selectedDuration = Math.max(0, value.endTime - value.startTime);

  let selectionError: string | null = null;
  if (value.startTime >= value.endTime) {
    selectionError = 'Start time must be before end time';
  } else if (selectedDuration < minSelectionSeconds) {
    selectionError = `Selection too short (minimum ${minSelectionSeconds} seconds)`;
  }

  function updateStart(raw: number) {
    const start = Math.max(0, Math.min(raw, value.endTime - minimumLength));
    onChange({ startTime: start, endTime: value.endTime });
    return start;
  }

  function updateEnd(raw: number) {
    const end = Math.min(max, Math.max(raw, value.startTime + minimumLength));
    onChange({ startTime: value.startTime, endTime: end });
    return end;
  }

  if (max <= 0) {
    return (
      <Text className="text-sm text-muted">Duration unknown — full stream will be downloaded.</Text>
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <ClockInput label="Start" seconds={value.startTime} onChange={updateStart} />
        <ClockInput label="End" seconds={value.endTime} onChange={updateEnd} />
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-muted">{formatClockTime(value.startTime)}</Text>
        <Text className="text-xs font-medium text-foreground">
          Duration: {formatClockTime(selectedDuration)}
        </Text>
        <Text className="text-xs text-muted">{formatClockTime(value.endTime)}</Text>
      </View>

      <View className="gap-1">
        <Text className="text-xs text-muted">Start</Text>
        <SeekBar
          minimumValue={0}
          maximumValue={max}
          step={1}
          value={value.startTime}
          onValueChange={updateStart}
        />
      </View>

      <View className="gap-1">
        <Text className="text-xs text-muted">End</Text>
        <SeekBar
          minimumValue={0}
          maximumValue={max}
          step={1}
          value={value.endTime}
          onValueChange={updateEnd}
        />
      </View>

      {selectionError ? (
        <Text className="text-xs text-destructive">{selectionError}</Text>
      ) : null}
    </View>
  );
}
