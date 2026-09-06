import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { getMinScheduleTime, isValidScheduleTime } from '@clippster/api-client';
import { BottomSheet } from '@/components/ui/BottomSheet';

const DAY_COUNT = 14;
const MINUTE_STEP = 5;

export function toLocalScheduleValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

export function formatScheduleLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function roundUpToStep(date: Date, stepMinutes: number): Date {
  const next = new Date(date);
  const minutes = next.getMinutes();
  const remainder = minutes % stepMinutes;
  if (remainder !== 0) {
    next.setMinutes(minutes + (stepMinutes - remainder), 0, 0);
  } else {
    next.setSeconds(0, 0);
  }
  return next;
}

function buildDayOptions(minTime: Date): Date[] {
  const start = startOfDay(minTime);
  return Array.from({ length: DAY_COUNT }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

interface ScheduleTimeSheetProps {
  visible: boolean;
  value: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}

export function ScheduleTimeSheet({
  visible,
  value,
  onClose,
  onConfirm,
}: ScheduleTimeSheetProps) {
  const [draft, setDraft] = useState(() => roundUpToStep(getMinScheduleTime(), MINUTE_STEP));
  const [minTime, setMinTime] = useState(() => roundUpToStep(getMinScheduleTime(), MINUTE_STEP));

  const dayOptions = useMemo(() => buildDayOptions(minTime), [minTime]);

  useEffect(() => {
    if (!visible) return;
    const floor = roundUpToStep(getMinScheduleTime(), MINUTE_STEP);
    setMinTime(floor);
    const parsed = new Date(value);
    const initial = Number.isNaN(parsed.getTime()) ? floor : parsed;
    setDraft(initial < floor ? floor : roundUpToStep(initial, MINUTE_STEP));
  }, [visible, value]);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(
    () => Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP),
    [],
  );

  const valid = isValidScheduleTime(draft);

  function selectDay(day: Date) {
    const next = new Date(draft);
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    setDraft(next < minTime ? new Date(minTime) : next);
  }

  function selectHour(hour: number) {
    const next = new Date(draft);
    next.setHours(hour);
    setDraft(next < minTime ? new Date(minTime) : next);
  }

  function selectMinute(minute: number) {
    const next = new Date(draft);
    next.setMinutes(minute, 0, 0);
    setDraft(next < minTime ? new Date(minTime) : next);
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="sheet"
      title="Schedule time"
      subtitle="Local timezone"
      headerIcon="calendar-outline"
      showAccentBar
      showHandle={false}
      primaryAction={{
        title: 'Done',
        disabled: !valid,
        onPress: () => {
          onConfirm(toLocalScheduleValue(draft));
          onClose();
        },
      }}
      secondaryAction={{ title: 'Cancel', onPress: onClose }}
    >
      <View className="rounded-lg border border-accent/25 bg-accent/10 px-3 py-2.5">
        <Text className="text-sm font-medium text-accent">
          {formatScheduleLabel(toLocalScheduleValue(draft))}
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {dayOptions.map((day) => {
            const active = sameDay(day, draft);
            const label = day.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
            return (
              <Pressable
                key={day.toISOString()}
                onPress={() => selectDay(day)}
                className={`rounded-lg border px-3 py-2.5 ${
                  active ? 'border-accent bg-accent/10' : 'border-border bg-white/5'
                }`}
              >
                <Text className={`text-sm ${active ? 'font-semibold text-accent' : 'text-foreground'}`}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Hour</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {hours.map((hour) => {
            const active = draft.getHours() === hour;
            const label = new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, {
              hour: 'numeric',
            });
            return (
              <Pressable
                key={hour}
                onPress={() => selectHour(hour)}
                className={`items-center rounded-md border px-3 py-2.5 ${
                  active ? 'border-accent bg-accent/10' : 'border-border bg-white/5'
                }`}
              >
                <Text className={`text-sm ${active ? 'font-semibold text-accent' : 'text-foreground'}`}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Minute</Text>
        <View className="flex-row flex-wrap gap-2">
          {minutes.map((minute) => {
            const active = draft.getMinutes() === minute;
            return (
              <Pressable
                key={minute}
                onPress={() => selectMinute(minute)}
                className={`min-w-[52px] flex-grow items-center rounded-md border px-2 py-2.5 ${
                  active ? 'border-accent bg-accent/10' : 'border-border bg-white/5'
                }`}
              >
                <Text className={`text-sm ${active ? 'font-semibold text-accent' : 'text-foreground'}`}>
                  :{String(minute).padStart(2, '0')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {!valid ? (
        <Text className="text-xs text-warning">Schedule at least 5 minutes in the future.</Text>
      ) : null}
    </BottomSheet>
  );
}
