import type { ManualRegion } from '@clippster/shared-types';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { View } from 'react-native';

import { configurePreviewPlayer } from '@/lib/configurePreviewPlayer';
import { toVideoSource } from '@/lib/playbackVideo';

interface CroppedRegionVideoProps {
  region: ManualRegion;
  videoPath: string;
  currentTime: number;
  playing: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

export function CroppedRegionVideo({
  region,
  videoPath,
  currentTime,
  playing,
  canvasWidth,
  canvasHeight,
}: CroppedRegionVideoProps) {
  const player = useVideoPlayer(toVideoSource(videoPath), configurePreviewPlayer);

  useEffect(() => {
    player.muted = true;
    player.volume = 0;
    const drift = Math.abs(player.currentTime - currentTime);
    if (!playing || !player.playing || drift > 0.75) {
      player.currentTime = currentTime;
    }
    if (playing && !player.playing) player.play();
    if (!playing && player.playing) player.pause();
  }, [currentTime, player, playing]);

  const outputWidth = Math.max(1, region.output.width * canvasWidth);
  const outputHeight = Math.max(1, region.output.height * canvasHeight);
  const sourceWidth = Math.max(0.0001, region.source.width);
  const sourceHeight = Math.max(0.0001, region.source.height);
  const renderedWidth = outputWidth / sourceWidth;
  const renderedHeight = outputHeight / sourceHeight;
  const cornerRadius =
    region.cornerRadiusEnabled && region.cornerRadiusPx
      ? Math.max(1, (region.cornerRadiusPx * outputWidth) / 1080)
      : 0;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: region.output.x * canvasWidth,
        top: region.output.y * canvasHeight,
        width: outputWidth,
        height: outputHeight,
        borderRadius: cornerRadius,
        overflow: 'hidden',
      }}
    >
      <VideoView
        player={player}
        style={{
          position: 'absolute',
          left: -region.source.x * renderedWidth,
          top: -region.source.y * renderedHeight,
          width: renderedWidth,
          height: renderedHeight,
        }}
        nativeControls={false}
        contentFit="fill"
        surfaceType="textureView"
      />
    </View>
  );
}
