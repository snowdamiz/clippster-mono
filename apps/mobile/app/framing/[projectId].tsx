import { Stack, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { FramingEditor } from '@/components/framing/FramingEditor';
import type { ActiveVodPresetConfig } from '@clippster/shared-types';
import {
  getOrCreateProjectVodPresetConfig,
  getRawVideoByProjectId,
  setProjectVodPresetConfig,
} from '@/services/database';
import { tokens } from '@/theme/tokens';

function FramingWorkspace({
  projectId,
  videoPath,
  initialConfig,
  videoDuration,
}: {
  projectId: string;
  videoPath: string;
  initialConfig: ActiveVodPresetConfig;
  videoDuration: number;
}) {
  const [config, setConfig] = useState(initialConfig);
  const [currentTime, setCurrentTime] = useState(0);
  const player = useVideoPlayer(videoPath, (instance) => {
    instance.timeUpdateEventInterval = 0.25;
    instance.loop = true;
  });

  useEffect(() => {
    player.play();
    const interval = setInterval(() => {
      setCurrentTime(player.currentTime);
    }, 250);
    return () => clearInterval(interval);
  }, [player]);

  const handleSave = async (next: ActiveVodPresetConfig) => {
    await setProjectVodPresetConfig(projectId, next);
    setConfig(next);
  };

  return (
    <FramingEditor
      config={config}
      clipDuration={videoDuration}
      currentTime={currentTime}
      player={player}
      onSave={handleSave}
      onSeek={(time) => {
        player.currentTime = time;
        setCurrentTime(time);
      }}
    />
  );
}

export default function FramingScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [config, setConfig] = useState<ActiveVodPresetConfig | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [vodConfig, rawVideo] = await Promise.all([
        getOrCreateProjectVodPresetConfig(projectId),
        getRawVideoByProjectId(projectId),
      ]);
      setConfig(vodConfig);
      setVideoPath(rawVideo?.file_path ?? null);
      setVideoDuration(Math.max(1, rawVideo?.duration ?? 30));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 bg-background">
        <ScreenHeader title="Manual framing" subtitle="Crop regions for 9:16 or 16:9" showBack />
        {loading || !config || !projectId ? (
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
            videoDuration={videoDuration}
          />
        )}
      </View>
    </>
  );
}
