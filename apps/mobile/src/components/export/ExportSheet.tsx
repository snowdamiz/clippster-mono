import type { TargetAspectRatio } from '@clippster/shared-types';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { ClipBuildProgress } from '@/services/clipBuildPipeline';
import { cancelClipBuild } from '@/services/clipBuildPipeline';

interface ExportSheetProps {
  visible: boolean;
  progress: ClipBuildProgress | null;
  onClose: () => void;
  onExport: (options: { ratios: TargetAspectRatio[]; remuxOnly: boolean }) => void;
}

export function ExportSheet({ visible, progress, onClose, onExport }: ExportSheetProps) {
  const [ratio916, setRatio916] = useState(true);
  const [ratio169, setRatio169] = useState(false);
  const [remuxOnly, setRemuxOnly] = useState(false);

  if (!visible) return null;

  const building = progress?.state === 'building';

  return (
    <View className="absolute inset-0 z-50 justify-end bg-black/70">
      <View className="rounded-t-2xl bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="text-lg font-semibold text-foreground">Export clip</Text>
          <Pressable onPress={onClose} disabled={building}>
            <Text className="text-primary">Close</Text>
          </Pressable>
        </View>

        <View className="px-4 py-4">
          <Pressable
            onPress={() => setRatio916((v) => !v)}
            className="mb-2 flex-row items-center justify-between rounded-lg bg-surface px-4 py-3"
          >
            <Text className="text-foreground">9:16 (portrait)</Text>
            <Text className="text-primary">{ratio916 ? '✓' : ''}</Text>
          </Pressable>
          <Pressable
            onPress={() => setRatio169((v) => !v)}
            className="mb-2 flex-row items-center justify-between rounded-lg bg-surface px-4 py-3"
          >
            <Text className="text-foreground">16:9 (landscape)</Text>
            <Text className="text-primary">{ratio169 ? '✓' : ''}</Text>
          </Pressable>
          <Pressable
            onPress={() => setRemuxOnly((v) => !v)}
            className="mb-4 flex-row items-center justify-between rounded-lg bg-surface px-4 py-3"
          >
            <Text className="text-foreground">Remux only (no overlays)</Text>
            <Text className="text-primary">{remuxOnly ? '✓' : ''}</Text>
          </Pressable>

          {progress ? (
            <View className="mb-4 rounded-lg bg-surface px-4 py-3">
              <Text className="text-sm text-foreground">{progress.message}</Text>
              {progress.state === 'building' ? (
                <View className="mt-2 h-2 overflow-hidden rounded bg-border">
                  <View
                    className="h-full bg-primary"
                    style={{ width: `${Math.round(progress.progress * 100)}%` }}
                  />
                </View>
              ) : null}
              {progress.error ? (
                <Text className="mt-1 text-xs text-red-400">{progress.error}</Text>
              ) : null}
              {progress.outputPaths?.length ? (
                <Text className="mt-2 text-xs text-muted">
                  Saved: {progress.outputPaths.map((p) => p.split('/').pop()).join(', ')}
                </Text>
              ) : null}
            </View>
          ) : null}

          {building ? (
            <Pressable
              onPress={() => cancelClipBuild()}
              className="items-center rounded-lg border border-destructive py-3"
            >
              <Text className="text-red-400">Cancel export</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={() => {
                  const ratios: TargetAspectRatio[] = [];
                  if (ratio916) ratios.push('9:16');
                  if (ratio169) ratios.push('16:9');
                  if (ratios.length === 0) return;
                  onExport({ ratios, remuxOnly });
                }}
                className="items-center rounded-lg bg-primary py-3"
              >
                <Text className="font-semibold text-primary-foreground">Start export</Text>
              </Pressable>
              {progress?.state === 'complete' && progress.buildIds?.length ? (
                <Pressable
                  onPress={() => {
                    onClose();
                    router.push(`/schedule/${progress.buildIds![0]}`);
                  }}
                  className="mt-3 items-center rounded-lg border border-primary py-3"
                >
                  <Text className="font-semibold text-primary">Schedule post</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>
    </View>
  );
}
