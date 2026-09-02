import type { SubtitleSettings, WordInfo } from '@clippster/shared-types';
import { useMemo, useRef } from 'react';
import { PanResponder, View } from 'react-native';
import { SubtitleOverlay } from '@/components/subtitles/SubtitleOverlay';

interface EditableCaptionLayerProps {
  settings: SubtitleSettings;
  words: WordInfo[];
  currentTime: number;
  targetRatio: string;
  width: number;
  height: number;
  selected: boolean;
  onSelect: () => void;
  onSettingsChange: (settings: SubtitleSettings) => void;
}

export function EditableCaptionLayer({
  settings,
  words,
  currentTime,
  targetRatio,
  width,
  height,
  selected,
  onSelect,
  onSettingsChange,
}: EditableCaptionLayerProps) {
  const startY = useRef(settings.positionPercentage);
  const startSize = useRef(settings.fontSize);
  const pinchStart = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          onSelect();
          startY.current = settingsRef.current.positionPercentage;
          startSize.current = settingsRef.current.fontSize;
          const touches = event.nativeEvent.touches;
          if (touches.length >= 2) {
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            pinchStart.current = Math.hypot(dx, dy);
          } else {
            pinchStart.current = 0;
          }
        },
        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches;
          if (touches.length >= 2) {
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            const distance = Math.hypot(dx, dy);
            if (pinchStart.current > 0) {
              const nextSize = Math.max(24, Math.min(84, startSize.current * (distance / pinchStart.current)));
              onSettingsChange({ ...settingsRef.current, fontSize: nextSize });
            }
            return;
          }
          const deltaPct = (gesture.dy / Math.max(height, 1)) * 100;
          const nextPct = Math.max(12, Math.min(92, startY.current + deltaPct));
          onSettingsChange({ ...settingsRef.current, positionPercentage: nextPct });
        },
      }),
    [height, onSelect, onSettingsChange],
  );

  const bandTop = Math.max(0, (settings.positionPercentage / 100) * height - 48);

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width, height }} pointerEvents="box-none">
      <SubtitleOverlay
        settings={settings}
        words={words}
        currentTime={currentTime}
        targetRatio={targetRatio}
        frameWidth={width}
        frameHeight={height}
        sampleFallback
      />
      <View
        {...pan.panHandlers}
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: bandTop,
          height: 96,
          borderWidth: selected ? 1 : 0,
          borderColor: 'rgba(14,165,233,0.9)',
          borderStyle: 'dashed',
          borderRadius: 8,
        }}
      />
    </View>
  );
}
