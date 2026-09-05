import type { TargetAspectRatio } from '@clippster/shared-types';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { appAlert } from '@/lib/appAlert';
import { PostSheet } from '@/components/schedule/PostSheet';
import { BottomSheet } from '@/components/ui/BottomSheet';

import type { EditorExportProgress as ClipBuildProgress } from '@/editor/export/exportProgress';
import { cancelFfmpeg } from '@/services/ffmpeg';

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
  const [postBuildId, setPostBuildId] = useState<string | null>(null);

  if (!visible && !postBuildId) return null;

  const building = progress?.state === 'building';
  const completedPaths = progress?.state === 'complete' ? progress.outputPaths ?? [] : [];
  const canStart = ratio916 || ratio169;

  function startExport() {
    const ratios: TargetAspectRatio[] = [];
    if (ratio916) ratios.push('9:16');
    if (ratio169) ratios.push('16:9');
    if (ratios.length > 0) onExport({ ratios, remuxOnly });
  }

  async function saveToCameraRoll() {
    if (!completedPaths.length) return;
    setSaving(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        appAlert('Permission needed', 'Allow photo library access to save exports.');
        return;
      }
      for (const path of completedPaths) {
        await MediaLibrary.saveToLibraryAsync(path);
      }
      appAlert('Saved', 'Exported clip saved to your camera roll.');
    } catch (error) {
      appAlert('Save failed', error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function shareExport() {
    if (!completedPaths[0]) return;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        appAlert('Unavailable', 'Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(completedPaths[0], { mimeType: 'video/mp4' });
    } catch (error) {
      appAlert('Share failed', error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
    {visible ? (
    <BottomSheet
      visible={visible}
      onClose={building ? () => undefined : onClose}
      variant="sheet"
      title={title}
      headerIcon="download-outline"
      dismissOnBackdrop={!building}
      scrollable
      primaryAction={
        building
          ? {
              title: 'Cancel export',
              variant: 'destructive',
              onPress: cancelFfmpeg,
            }
          : {
              title: completedPaths.length > 0 ? 'Export again' : 'Start export',
              onPress: startExport,
              disabled: !canStart,
            }
      }
    >
      <Pressable
        onPress={() => setRatio916((value) => !value)}
        className="flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
      >
        <Text className="font-medium text-foreground">9:16 (portrait)</Text>
        <Text className="font-semibold text-accent">{ratio916 ? '✓' : ''}</Text>
      </Pressable>
      <Pressable
        onPress={() => setRatio169((value) => !value)}
        className="flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
      >
        <Text className="font-medium text-foreground">16:9 (landscape)</Text>
        <Text className="font-semibold text-accent">{ratio169 ? '✓' : ''}</Text>
      </Pressable>
      {showRemux ? (
          <Pressable
            onPress={() => setRemuxOnly((value) => !value)}
            className="flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
          >
            <Text className="text-foreground">Remux only (no overlays)</Text>
            <Text className="font-semibold text-accent">{remuxOnly ? '✓' : ''}</Text>
          </Pressable>
      ) : (
        <Text className="text-sm leading-5 text-muted">
          Export matches the editor: clips, mute, images, music, and captions.
        </Text>
      )}

      {progress ? (
        <View className="rounded-xl border border-border bg-surface px-4 py-3">
          <Text className="text-sm font-medium text-foreground">{progress.message}</Text>
          {building ? (
            <View className="mt-2 h-2 overflow-hidden rounded bg-border">
              <View
                className="h-full bg-accent"
                style={{ width: `${Math.round(progress.progress * 100)}%` }}
              />
            </View>
          ) : null}
          {progress.error ? (
            <Text className="mt-1 text-xs text-destructive">{progress.error}</Text>
          ) : null}
          {progress.outputPaths?.length ? (
            <Text className="mt-2 text-xs text-muted">
              Saved: {progress.outputPaths.map((path) => path.split('/').pop()).join(', ')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {completedPaths.length > 0 ? (
        <View className="gap-2">
          <Pressable
            onPress={() => void saveToCameraRoll()}
            disabled={saving}
            className="items-center rounded-xl border border-border py-3"
          >
            <Text className="font-semibold text-foreground">
              {saving ? 'Saving…' : 'Save to camera roll'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void shareExport()}
            className="items-center rounded-xl border border-border py-3"
          >
            <Text className="font-semibold text-foreground">Share</Text>
          </Pressable>
          {progress?.buildIds?.length ? (
            <Pressable
              onPress={() => {
                setPostBuildId(progress.buildIds![0]);
                onClose();
              }}
              className="items-center rounded-xl border border-accent py-3"
            >
              <Text className="font-semibold text-accent">Schedule post</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
    ) : null}
    <PostSheet
      visible={postBuildId != null}
      buildId={postBuildId}
      onClose={() => setPostBuildId(null)}
    />
    </>
  );
}
