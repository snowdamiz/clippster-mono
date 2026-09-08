import { useEventListener } from 'expo';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { FramingEditor } from '@/components/framing/FramingEditor';
import { useSmoothPlayerTime } from '@/hooks/useSmoothPlayerTime';
import { configurePreviewPlayer } from '@/lib/configurePreviewPlayer';
import { beginPlaybackCritical } from '@/lib/mediaDecodeGate';
import { toVideoSource } from '@/lib/playbackVideo';
import type { ActiveVodPresetConfig } from '@clippster/shared-types';
import {
  getOrCreateProjectVodPresetConfig,
  getClipById,
  getRawVideoByProjectId,
  setProjectVodPresetConfig,
  updateRawVideoFilePath,
} from '@/services/database';
import { ensurePlayableVideo } from '@/services/ensurePlayableVideo';
import { tokens } from '@/theme/tokens';

function FramingWorkspace({
  projectId,
  videoPath,
  initialConfig,
  clipStart,
  clipEnd,
  onSaved,
}: {
  projectId: string;
  videoPath: string;
  initialConfig: ActiveVodPresetConfig;
  clipStart: number;
  clipEnd: number;
  onSaved: () => void;
}) {
  const [config, setConfig] = useState(initialConfig);
  const [, setPlaybackEpoch] = useState(0);
  const player = useVideoPlayer(toVideoSource(videoPath), (instance) => {
    configurePreviewPlayer(instance);
    instance.loop = false;
    instance.currentTime = clipStart;
  });
  const { currentTime: videoTime, noteSeek } = useSmoothPlayerTime(player);
  const duration = Math.max(0, clipEnd - clipStart);
  const currentTime = Math.max(0, Math.min(duration, videoTime - clipStart));

  useEventListener(player, 'playingChange', () => {
    setPlaybackEpoch((value) => value + 1);
  });
  useEventListener(player, 'volumeChange', () => {
    setPlaybackEpoch((value) => value + 1);
  });
  useEventListener(player, 'statusChange', () => {
    setPlaybackEpoch((value) => value + 1);
    if (player.currentTime < clipStart - 0.04) {
      player.currentTime = clipStart;
      noteSeek(clipStart);
    }
  });

  useEffect(() => {
    if (!player.playing) return;
    return beginPlaybackCritical();
  }, [player, player.playing]);

  useEffect(() => {
    if (videoTime < clipEnd - 0.04) return;
    player.pause();
    player.currentTime = clipStart;
    noteSeek(clipStart);
  }, [clipEnd, clipStart, noteSeek, player, videoTime]);

  const handleSave = async (next: ActiveVodPresetConfig) => {
    await setProjectVodPresetConfig(projectId, next);
    setConfig(next);
    const { queueProjectSync } = await import('@/services/cloudSync');
    void queueProjectSync(projectId);
    onSaved();
  };

  return (
    <FramingEditor
      config={config}
      currentTime={currentTime}
      videoTime={videoTime}
      player={player}
      videoPath={videoPath}
      duration={duration}
      playing={player.playing}
      onSeek={(seconds) => {
        const absoluteTime = clipStart + seconds;
        player.currentTime = absoluteTime;
        noteSeek(absoluteTime);
      }}
      onTogglePlay={() => {
        if (player.playing) player.pause();
        else {
          if (player.currentTime >= clipEnd - 0.04) {
            player.currentTime = clipStart;
            noteSeek(clipStart);
          }
          player.play();
        }
      }}
      onSave={handleSave}
    />
  );
}

export default function FramingScreen() {
  const router = useRouter();
  const { projectId, clipId, clipStart: clipStartParam, clipEnd: clipEndParam, ratio } =
    useLocalSearchParams<{
    projectId: string;
    clipId?: string;
    clipStart?: string;
    clipEnd?: string;
    ratio?: '9:16' | '16:9';
  }>();
  const [config, setConfig] = useState<ActiveVodPresetConfig | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [clipRange, setClipRange] = useState<{ start: number; end: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId || !clipId) return;
    setLoading(true);
    try {
      const [vodConfig, rawVideo, clip] = await Promise.all([
        getOrCreateProjectVodPresetConfig(projectId),
        getRawVideoByProjectId(projectId),
        getClipById(clipId),
      ]);
      if (!clip) throw new Error('Clip not found.');
      setConfig(
        ratio
          ? {
              ...vodConfig,
              targetAspectRatio: ratio,
              framingConfig: vodConfig.framingConfig
                ? { ...vodConfig.framingConfig, targetAspectRatio: ratio }
                : null,
            }
          : vodConfig,
      );
      let path = rawVideo?.file_path ?? null;
      if (path && !path.startsWith('pending://') && !path.startsWith('http')) {
        const playable = await ensurePlayableVideo(path);
        if (playable !== path) {
          await updateRawVideoFilePath(projectId, playable);
          path = playable;
        }
      }
      setVideoPath(path);
      const requestedStart = Number(clipStartParam);
      const requestedEnd = Number(clipEndParam);
      const storedStart = Math.max(0, clip.start_time ?? 0);
      const storedEnd = Math.max(storedStart, clip.end_time ?? storedStart + (clip.duration ?? 0));
      const start = Number.isFinite(requestedStart) ? Math.max(0, requestedStart) : storedStart;
      const end =
        Number.isFinite(requestedEnd) && requestedEnd > start ? requestedEnd : storedEnd;
      setClipRange({ start, end });
    } finally {
      setLoading(false);
    }
  }, [clipEndParam, clipId, clipStartParam, projectId, ratio]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 bg-background">
        <ScreenHeader title="9:16 Framing" subtitle="Choose source regions and arrange the output" showBack />
        {loading || !config || !projectId || !clipRange ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={tokens.colors.accent} />
          </View>
        ) : !videoPath ? (
          <View className="flex-1 items-center justify-center px-6">
            <ActivityIndicator color={tokens.colors.accent} />
          </View>
        ) : (
          <FramingWorkspace
            projectId={projectId}
            videoPath={videoPath}
            initialConfig={config}
            clipStart={clipRange.start}
            clipEnd={clipRange.end}
            onSaved={() => router.back()}
          />
        )}
      </View>
    </>
  );
}
