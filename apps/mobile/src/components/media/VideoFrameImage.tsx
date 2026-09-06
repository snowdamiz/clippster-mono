import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image as RnImage, Text, View, type ImageStyle, type StyleProp } from 'react-native';
import { formatClock } from '@/lib/formatTime';
import { getExpoImage } from '@/lib/expoImage';
import { getVideoFrames, type ThumbnailSource } from '@/services/videoThumbnails';
import { tokens } from '@/theme/tokens';

const ExpoImage = getExpoImage();

export function VideoFrameImage({
  path,
  time,
  style,
  fallbackUri,
}: {
  path: string | null | undefined;
  time: number;
  style: StyleProp<ImageStyle>;
  fallbackUri?: string | null;
}) {
  const [thumb, setThumb] = useState<ThumbnailSource | null>(null);

  useEffect(() => {
    if (!path || !ExpoImage) return;
    let cancelled = false;
    void getVideoFrames(path, [time], { maxHeight: 160 }).then((frames) => {
      if (!cancelled) setThumb(frames[0] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [path, time]);

  if (ExpoImage && thumb) {
    return <ExpoImage source={thumb} style={style} contentFit="cover" />;
  }
  if (fallbackUri) {
    return (
      <View style={style}>
        <RnImage source={{ uri: fallbackUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        {ExpoImage == null && time > 0 ? (
          <View className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
            <Text className="text-center font-mono text-[9px] text-white">{formatClock(time)}</Text>
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <View style={style} className="items-center justify-center bg-black/40">
      <Ionicons name="videocam-outline" size={22} color={tokens.colors.muted} />
    </View>
  );
}
