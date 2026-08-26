import { Stack, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { FramingEditor } from '@/components/framing/FramingEditor';
import type { ActiveVodPresetConfig } from '@clippster/shared-types';
import {
  getClipsByProjectId,
  getOrCreateProjectVodPresetConfig,
  getProject,
  getRawVideoByProjectId,
  setProjectVodPresetConfig,
} from '@/services/database';
import { tokens } from '@/theme/tokens';

export default function FramingScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [config, setConfig] = useState<ActiveVodPresetConfig | null>(null);
  const [clipDuration, setClipDuration] = useState(30);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  const player = useVideoPlayer(videoPath ?? '', (instance) => {
    instance.timeUpdateEventInterval = 0.25;
    instance.loop = true;
  });

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [vodConfig, clips, rawVideo] = await Promise.all([
        getOrCreateProjectVodPresetConfig(projectId),
        getClipsByProjectId(projectId),
        getRawVideoByProjectId(projectId),
        getProject(projectId),
      ]);
      setConfig(vodConfig);
      setVideoPath(rawVideo?.file_path ?? null);
      const clip = clips[0];
      if (clip?.duration) setClipDuration(clip.duration);
      else if (clip?.start_time != null && clip.end_time != null) {
        setClipDuration(clip.end_time - clip.start_time);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!videoPath) return;
    const interval = setInterval(() => {
      setCurrentTime(player.currentTime);
    }, 250);
    return () => clearInterval(interval);
  }, [player, videoPath]);

  const handleSave = async (next: ActiveVodPresetConfig) => {
    if (!projectId) return;
    await setProjectVodPresetConfig(projectId, next);
    setConfig(next);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Manual Framing' }} />
      <View className="flex-1 bg-background">
        {loading || !config ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={tokens.colors.primary} />
          </View>
        ) : (
          <FramingEditor
            config={config}
            clipDuration={clipDuration}
            currentTime={currentTime}
            onSave={handleSave}
            onSeek={(t) => {
              player.currentTime = t;
              setCurrentTime(t);
            }}
          />
        )}
      </View>
    </>
  );
}
