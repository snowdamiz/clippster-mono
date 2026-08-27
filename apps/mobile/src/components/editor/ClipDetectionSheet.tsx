import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { VodTimeRangePicker, type TimeRangeValue } from '@/components/download/VodTimeRangePicker';
import { CaptionPresetPicker } from '@/components/subtitles/CaptionPresetPicker';
import { DEFAULT_CAPTION_PRESET_ID } from '@/lib/captionPresets';
import { DEFAULT_DETECTION_PROMPTS, type DetectionPrompt } from '@/lib/detectionPrompts';
import { tokens } from '@/theme/tokens';

export interface ClipDetectionPlan {
  prompt: DetectionPrompt;
  startTime: number;
  endTime: number;
  enhanced: boolean;
  subtitlesEnabled: boolean;
  subtitlePresetId: string;
}

interface ClipDetectionSheetProps {
  visible: boolean;
  videoDuration: number;
  starting: boolean;
  onClose: () => void;
  onConfirm: (plan: ClipDetectionPlan) => void;
}

export function ClipDetectionSheet({
  visible,
  videoDuration,
  starting,
  onClose,
  onConfirm,
}: ClipDetectionSheetProps) {
  const total = Math.max(0, Math.floor(videoDuration));
  const [promptId, setPromptId] = useState(DEFAULT_DETECTION_PROMPTS[0].id);
  const [showPrompts, setShowPrompts] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRangeValue>({ startTime: 0, endTime: total });
  const [enhanced, setEnhanced] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [subtitlePresetId, setSubtitlePresetId] = useState(DEFAULT_CAPTION_PRESET_ID);

  useEffect(() => {
    if (!visible) return;
    setTimeRange({ startTime: 0, endTime: total });
    setShowPrompts(false);
  }, [visible, total]);

  const selectedPrompt = useMemo(
    () => DEFAULT_DETECTION_PROMPTS.find((prompt) => prompt.id === promptId) ?? DEFAULT_DETECTION_PROMPTS[0],
    [promptId],
  );

  const selectedDuration = Math.max(0, timeRange.endTime - timeRange.startTime);
  const canConfirm = !starting && (total <= 0 || selectedDuration >= 10);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/70">
        <View className="max-h-[92%] rounded-t-2xl border-t border-border bg-background">
          <View className="flex-row items-center justify-between px-4 pt-4">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-foreground">Detect Clips</Text>
              <Text className="mt-1 text-sm text-muted">AI-powered clip detection</Text>
            </View>
            <Pressable onPress={onClose} disabled={starting} className="p-2">
              <Ionicons name="close" size={22} color={tokens.colors.muted} />
            </Pressable>
          </View>

          <ScrollView
            className="px-4 py-4"
            contentContainerClassName="gap-4 pb-6"
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <View className="rounded-lg border border-border bg-surface px-3 py-2">
              <Text className="text-xs text-muted">Video duration</Text>
              <Text className="text-sm font-medium text-foreground">
                {Math.floor(total / 60)}m {total % 60}s
              </Text>
            </View>

            {total > 0 ? (
              <View className="gap-2">
                <Text className="text-sm font-semibold text-foreground">Detection time range</Text>
                <View className="rounded-lg border border-border bg-surface p-3">
                  <VodTimeRangePicker totalDuration={total} value={timeRange} onChange={setTimeRange} />
                </View>
              </View>
            ) : null}

            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">Detection prompt</Text>
              <Pressable
                onPress={() => setShowPrompts((open) => !open)}
                className="flex-row items-center justify-between rounded-lg border border-border bg-surface px-3 py-3"
              >
                <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                  {selectedPrompt.name}
                </Text>
                <Ionicons
                  name={showPrompts ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={tokens.colors.muted}
                />
              </Pressable>
              {showPrompts
                ? DEFAULT_DETECTION_PROMPTS.map((prompt) => (
                    <Pressable
                      key={prompt.id}
                      onPress={() => {
                        setPromptId(prompt.id);
                        setShowPrompts(false);
                      }}
                      className={`rounded-lg border px-3 py-2 ${
                        prompt.id === promptId ? 'border-accent bg-accent/10' : 'border-border bg-surface'
                      }`}
                    >
                      <Text className="text-sm text-foreground">{prompt.name}</Text>
                    </Pressable>
                  ))
                : null}
            </View>

            <View className="rounded-lg border border-border bg-surface px-3 py-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-medium text-foreground">Enhanced detection</Text>
                    <Text className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      2× credits
                    </Text>
                  </View>
                  <Text className="mt-1 text-xs text-muted">
                    Video + audio analysis is desktop-only. Mobile uses transcript detection.
                  </Text>
                </View>
                <Switch
                  value={enhanced}
                  onValueChange={setEnhanced}
                  disabled
                  trackColor={{ false: tokens.colors.border, true: tokens.colors.accent }}
                />
              </View>
            </View>

            <View className="rounded-lg border border-border bg-surface px-3 py-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-sm font-medium text-foreground">Include subtitles</Text>
                  <Text className="mt-1 text-xs text-muted">
                    Automatically add captions to all detected clips
                  </Text>
                </View>
                <Switch
                  value={subtitlesEnabled}
                  onValueChange={setSubtitlesEnabled}
                  trackColor={{ false: tokens.colors.border, true: tokens.colors.accent }}
                />
              </View>

              {subtitlesEnabled ? (
                <View className="mt-3 gap-2">
                  <Text className="text-xs font-semibold text-muted">Subtitle style</Text>
                  <CaptionPresetPicker selectedId={subtitlePresetId} onSelect={setSubtitlePresetId} />
                </View>
              ) : null}
            </View>

            <View className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-3">
              <Text className="text-sm font-medium text-foreground">Credit cost</Text>
              <Text className="mt-1 text-xs text-muted">
                Detection uses AI credits for the selected time range. Transcribe first if this VOD
                does not have a transcript yet.
              </Text>
            </View>
          </ScrollView>

          <View className="flex-row gap-3 border-t border-border px-4 py-3">
            <View className="flex-1">
              <Button variant="outline" title="Cancel" onPress={onClose} disabled={starting} />
            </View>
            <View className="flex-1">
              <Button
                title={starting ? 'Detecting…' : 'Detect clips'}
                onPress={() =>
                  onConfirm({
                    prompt: selectedPrompt,
                    startTime: timeRange.startTime,
                    endTime: timeRange.endTime,
                    enhanced: false,
                    subtitlesEnabled,
                    subtitlePresetId,
                  })
                }
                disabled={!canConfirm}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
