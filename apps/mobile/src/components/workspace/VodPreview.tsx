import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { VideoPlayerControls } from '@/components/editor/VideoPlayerControls';
import { useSmoothPlayerTime } from '@/hooks/useSmoothPlayerTime';
import { configureVodPlayer } from '@/lib/configurePreviewPlayer';
import { beginPlaybackCritical } from '@/lib/mediaDecodeGate';
import { toVideoSource } from '@/lib/playbackVideo';

interface VodPreviewProps {
  videoPath: string;
  onTimeChange?: (seconds: number) => void;
  onDurationChange?: (seconds: number) => void;
}

const PreviewSurface = memo(function PreviewSurface({
  player,
  width,
  height,
}: {
  player: ReturnType<typeof useVideoPlayer>;
  width: number;
  height: number;
}) {
  const style = useMemo(
    () => ({ width, height, backgroundColor: '#000' as const }),
    [width, height],
  );
  return <VideoView player={player} style={style} nativeControls={false} contentFit="contain" />;
});

export function VodPreview({ videoPath, onTimeChange, onDurationChange }: VodPreviewProps) {
  const { width } = useWindowDimensions();
  const videoWidth = width;
  const videoHeight = width * (9 / 16);

  const player = useVideoPlayer(toVideoSource(videoPath), configureVodPlayer);
  const lastNotify = useRef(0);
  const { currentTime: playheadTime, timeSV, noteSeek } = useSmoothPlayerTime(player);
  const [, setPlaybackEpoch] = useState(0);

  useEffect(() => beginPlaybackCritical(), []);

  useEventListener(player, 'playingChange', () => {
    setPlaybackEpoch((value) => value + 1);
  });
  useEventListener(player, 'volumeChange', () => {
    setPlaybackEpoch((value) => value + 1);
  });
  useEventListener(player, 'statusChange', () => {
    const duration = player.duration ?? 0;
    if (duration > 0) onDurationChange?.(duration);
  });

  useEffect(() => {
    if (!onTimeChange) return;
    const now = performance.now();
    if (now - lastNotify.current < 250) return;
    lastNotify.current = now;
    onTimeChange(playheadTime);
  }, [onTimeChange, playheadTime]);

  return (
    <View className="bg-black">
      <PreviewSurface player={player} width={videoWidth} height={videoHeight} />
      <VideoPlayerControls
        player={player}
        currentTime={playheadTime}
        timeSV={timeSV}
        duration={player.duration ?? 0}
        onSeek={(seconds) => {
          player.currentTime = seconds;
          noteSeek(seconds);
          lastNotify.current = performance.now();
          onTimeChange?.(seconds);
        }}
      />
    </View>
  );
}
