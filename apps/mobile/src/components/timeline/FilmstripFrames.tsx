import { useEffect, useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import { getExpoImage } from '@/lib/expoImage';
import { getVideoFrames, type ThumbnailSource } from '@/services/videoThumbnails';

const ExpoImage = getExpoImage();

export function FilmstripFrames({
  path,
  start,
  end,
  width,
  height,
  fallbackUri,
  sourceFingerprint,
}: {
  path: string;
  start: number;
  end: number;
  width: number;
  height: number;
  fallbackUri?: string;
  sourceFingerprint?: string;
}) {
  const frameWidth = Math.max(40, height * 0.8);
  const count = Math.max(1, Math.min(24, Math.ceil(Math.max(width, 1) / frameWidth)));
  const times = useMemo(() => {
    const duration = Math.max(0.05, end - start);
    return Array.from({ length: count }, (_, index) => start + ((index + 0.5) / count) * duration);
  }, [count, end, start]);

  const [frames, setFrames] = useState<(ThumbnailSource | null)[]>([]);

  useEffect(() => {
    if (!path || width <= 0 || !ExpoImage) return;
    let cancelled = false;
    setFrames(Array.from({ length: times.length }, () => null));
    void getVideoFrames(path, times, {
      maxHeight: Math.max(48, Math.round(height)),
      sourceFingerprint,
    }).then((next) => {
      if (!cancelled) setFrames(next);
    });
    return () => {
      cancelled = true;
    };
  }, [height, path, sourceFingerprint, times, width]);

  const cellWidth = width / count;

  return (
    <View
      style={{
        width,
        height,
        flexDirection: 'row',
        overflow: 'hidden',
        backgroundColor: '#111113',
      }}
    >
      {times.map((time, index) => {
        const thumb = frames[index];
        if ((thumb || fallbackUri) && ExpoImage) {
          return (
            <ExpoImage
              key={`${time}-${index}`}
              source={thumb ?? fallbackUri}
              style={{ width: cellWidth, height }}
              contentFit="cover"
            />
          );
        }
        if (fallbackUri) {
          return (
            <Image
              key={`${time}-${index}`}
              source={{ uri: fallbackUri }}
              style={{ width: cellWidth, height }}
              resizeMode="cover"
            />
          );
        }
        return (
          <View
            key={`${time}-${index}`}
            style={{
              width: cellWidth,
              height,
              backgroundColor: index % 2 === 0 ? '#1c1c22' : '#151518',
              borderRightWidth: index < times.length - 1 ? 1 : 0,
              borderRightColor: 'rgba(255,255,255,0.06)',
            }}
          />
        );
      })}
    </View>
  );
}
