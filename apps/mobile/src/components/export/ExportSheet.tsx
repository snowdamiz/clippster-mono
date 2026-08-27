import type { TargetAspectRatio } from '@clippster/shared-types';
import { router } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import type { ClipBuildProgress } from '@/services/clipBuildPipeline';
import { cancelClipBuild } from '@/services/clipBuildPipeline';

interface ExportSheetProps {
  visible: boolean;
  progress: ClipBuildProgress | null;
  onClose: () => void;
  onExport: (options: { ratios: TargetAspectRatio[]; remuxOnly: boolean }) => void;
  title?: string;
  showRemux?: boolean;
}

export function ExportSheet({
  visible,
  progress,
  onClose,
  onExport,
  title = 'Export clip',
  showRemux = true,
}: ExportSheetProps) {
  const [ratio916, setRatio916] = useState(true);
  const [ratio169, setRatio169] = useState(false);
  const [remuxOnly, setRemuxOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!visible) return null;

  const building = progress?.state === 'building';
  const completedPaths = progress?.state === 'complete' ? progress.outputPaths ?? [] : [];

  async function saveToCameraRoll() {
    if (!completedPaths.length) return;
    setSaving(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to save exports.');
        return;
      }
      for (const path of completedPaths) {
        await MediaLibrary.saveToLibraryAsync(path);
      }
      Alert.alert('Saved', 'Exported clip saved to your camera roll.');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function shareExport() {
    if (!completedPaths[0]) return;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Unavailable', 'Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(completedPaths[0], { mimeType: 'video/mp4' });
    } catch (error) {
      Alert.alert('Share failed', error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <View className="absolute inset-0 z-50 justify-end bg-black/70">
      <View className="rounded-t-2xl bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="text-lg font-semibold text-foreground">{title}</Text>
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
          {showRemux ? (
          <Pressable
            onPress={() => setRemuxOnly((v) => !v)}
            className="mb-4 flex-row items-center justify-between rounded-lg bg-surface px-4 py-3"
          >
            <Text className="text-foreground">Remux only (no overlays)</Text>
            <Text className="text-primary">{remuxOnly ? '✓' : ''}</Text>
          </Pressable>
          ) : (
            <Text className="mb-4 text-sm text-muted">
              Export matches the editor: clips, mute, images, music, and captions.
            </Text>
          )}

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
              {completedPaths.length ? (
                <>
                  <Pressable
                    onPress={() => void saveToCameraRoll()}
                    disabled={saving}
                    className="mt-3 items-center rounded-lg border border-border py-3"
                  >
                    <Text className="font-semibold text-foreground">
                      {saving ? 'Saving…' : 'Save to camera roll'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void shareExport()}
                    className="mt-3 items-center rounded-lg border border-border py-3"
                  >
                    <Text className="font-semibold text-foreground">Share</Text>
                  </Pressable>
                  {progress?.buildIds?.length ? (
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
              ) : null}
            </>
          )}
        </View>
      </View>
    </View>
  );
}
