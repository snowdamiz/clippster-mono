import type { ManualFramingConfig, TargetAspectRatio } from '@clippster/shared-types';
import { View } from 'react-native';

import { CroppedRegionVideo } from './CroppedRegionVideo';
import { getActiveFramingRegions } from './framingRegions';
import { Use16x9Preview } from './TargetPanel';

export function FramedVideoPreview({
  config,
  targetRatio,
  videoPath,
  currentTime,
  videoTime,
  playing,
  width,
  height,
}: {
  config: ManualFramingConfig;
  targetRatio: TargetAspectRatio;
  videoPath: string;
  currentTime: number;
  videoTime: number;
  playing: boolean;
  width: number;
  height: number;
}) {
  const { regions } = getActiveFramingRegions(config, currentTime);
  const use16x9 = targetRatio === '9:16' && config.sourceFrameMode === 'use16x9';
  const syncTime = playing ? Math.floor(videoTime * 2) / 2 : videoTime;

  if (use16x9) {
    const transform = config.sourceTransform ?? { scale: 1, x: 0, y: 0 };
    const sourceWidth = width * transform.scale;
    const sourceHeight = sourceWidth / (16 / 9);
    return (
      <View style={{ width, height }} className="overflow-hidden bg-black">
        <Use16x9Preview
          videoPath={videoPath}
          syncTime={syncTime}
          playing={playing}
          blurAmount={config.blurEnabled ? (config.blurAmount ?? 12) : 0}
          previewWidth={width}
          previewHeight={height}
          sourceLeft={(width - sourceWidth) / 2 + transform.x * width}
          sourceTop={(height - sourceHeight) / 2 + transform.y * height}
          sourceWidth={sourceWidth}
          sourceHeight={sourceHeight}
          showBorder={false}
        />
      </View>
    );
  }

  return (
    <View style={{ width, height }} className="overflow-hidden bg-black">
      {regions.map((region) => (
        <CroppedRegionVideo
          key={region.id}
          region={region}
          videoPath={videoPath}
          currentTime={syncTime}
          playing={playing}
          canvasWidth={width}
          canvasHeight={height}
        />
      ))}
    </View>
  );
}
