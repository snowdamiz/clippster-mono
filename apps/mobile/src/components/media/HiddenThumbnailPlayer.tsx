import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { getExpoImage } from '@/lib/expoImage';
import {
  markThumbnailPlayerReady,
  registerThumbnailPlayer,
  unregisterThumbnailPlayer,
} from '@/services/videoThumbnails';

export function HiddenThumbnailPlayer({ path }: { path: string }) {
  const player = useVideoPlayer(path, (instance) => {
    instance.muted = true;
    instance.volume = 0;
    instance.timeUpdateEventInterval = 0;
  });

  useEffect(() => {
    registerThumbnailPlayer(path, player);
    if (player.status === 'readyToPlay') markThumbnailPlayerReady(path, player);
    return () => unregisterThumbnailPlayer(path, player);
  }, [path, player]);

  useEventListener(player, 'statusChange', (payload: { status: string }) => {
    if (payload.status === 'readyToPlay') markThumbnailPlayerReady(path, player);
  });

  return (
    <VideoView
      player={player}
      style={{ width: 1, height: 1 }}
      nativeControls={false}
      contentFit="contain"
    />
  );
}

export function VideoThumbnailProvider({
  paths,
  children,
}: {
  paths: Array<string | null | undefined>;
  children: ReactNode;
}) {
  // Native thumbnails need expo-image. Without it, skip the extra VideoPlayer entirely
  // so we do not OOM the emulator with one player per surface.
  if (!getExpoImage()) {
    return <>{children}</>;
  }

  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  return (
    <>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
      >
        {unique.map((path) => (
          <HiddenThumbnailPlayer key={path} path={path} />
        ))}
      </View>
      {children}
    </>
  );
}
