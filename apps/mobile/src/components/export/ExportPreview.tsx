import { useVideoPlayer, VideoView } from 'expo-video';
import { View } from 'react-native';
import { toVideoSource } from '@/lib/playbackVideo';
import { configureVodPlayer } from '@/lib/configurePreviewPlayer';

/** Mounted only while export details are open, so playback stops on dismissal. */
export function ExportPreview({ path, width = 180, height = 280 }: { path: string; width?: number; height?: number }) {
  const player = useVideoPlayer(toVideoSource(path), configureVodPlayer);
  return (
    <View style={{ width, height, alignSelf: 'center', borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' }}>
      <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="contain" nativeControls />
    </View>
  );
}
