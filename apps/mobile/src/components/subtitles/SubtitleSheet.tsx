import type { SubtitleSettings } from '@clippster/shared-types';
import { createDefaultSubtitleSettings } from '@clippster/shared-types';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { CaptionStylePanel } from '@/components/subtitles/CaptionStylePanel';
import { BottomSheet } from '@/components/ui/BottomSheet';

interface SubtitleSheetProps {
  visible: boolean;
  settings: SubtitleSettings | null;
  hasTranscript: boolean;
  onClose: () => void;
  onSave: (enabled: boolean, presetId: string, settings: SubtitleSettings) => void;
}

export function SubtitleSheet({
  visible,
  settings,
  hasTranscript,
  onClose,
  onSave,
}: SubtitleSheetProps) {
  const [draft, setDraft] = useState<SubtitleSettings>(
    settings ?? createDefaultSubtitleSettings(),
  );
  const [enabled, setEnabled] = useState(settings?.enabled ?? false);

  useEffect(() => {
    if (!visible) return;
    setDraft(settings ?? createDefaultSubtitleSettings());
    setEnabled(settings?.enabled ?? false);
  }, [visible, settings]);

  function persist(nextEnabled: boolean, nextSettings: SubtitleSettings) {
    const presetId = nextSettings.selectedPresetId ?? 'tiktok-bold';
    onSave(nextEnabled, presetId, {
      ...nextSettings,
      enabled: nextEnabled,
      selectedPresetId: presetId,
    });
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="sheet"
      title="Captions"
      subtitle={
        hasTranscript
          ? 'Matches desktop subtitle defaults and style controls'
          : 'Transcribe for timed captions. Styles still preview on sample text.'
      }
      scrollable
      maxHeightClassName="max-h-[88%]"
      primaryAction={{
        title: 'Done',
        variant: 'accent',
        onPress: () => {
          persist(enabled, draft);
          onClose();
        },
      }}
    >
      {!hasTranscript ? (
        <Text className="mb-2 px-4 text-sm text-amber-500">
          Transcribe first for timed captions. Styles still apply to sample text.
        </Text>
      ) : null}
      <CaptionStylePanel
        enabled={enabled}
        settings={draft}
        onChange={(next) => {
          setEnabled(next.enabled);
          setDraft(next.settings);
          persist(next.enabled, next.settings);
        }}
      />
    </BottomSheet>
  );
}
