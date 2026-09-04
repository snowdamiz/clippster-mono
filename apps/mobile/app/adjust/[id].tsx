import { useEventListener } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdjustClipTimeline } from '@/components/adjust/AdjustClipTimeline';
import { AdjustClipToolBar } from '@/components/adjust/AdjustClipToolBar';
import { useSmoothPlayerTime } from '@/hooks/useSmoothPlayerTime';
import { appAlert } from '@/lib/appAlert';
import {
  extendBuffer,
  initialAdjustWindow,
  selectionIsDirty,
} from '@/lib/clipAdjust';
import { configurePreviewPlayer } from '@/lib/configurePreviewPlayer';
import { formatClock } from '@/lib/formatTime';
import { toVideoSource } from '@/lib/playbackVideo';
import { generateClipThumbnailAtTimestamp } from '@/services/clipThumbnailGeneration';
import {
  getClipById,
  getRawVideoByProjectId,
  replaceClipSegments,
  updateClipBuiltThumbnail,
} from '@/services/database';
import { ensurePlayableVideo } from '@/services/ensurePlayableVideo';
import { tokens } from '@/theme/tokens';

export default function AdjustClipScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [clipName, setClipName] = useState('Clip');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [originalStart, setOriginalStart] = useState(0);
  const [originalEnd, setOriginalEnd] = useState(1);
  const [bufferStart, setBufferStart] = useState(0);
  const [bufferEnd, setBufferEnd] = useState(1);
  const [selectStart, setSelectStart] = useState(0);
  const [selectEnd, setSelectEnd] = useState(1);
  const [playbackEpoch, setPlaybackEpoch] = useState(0);
  const startedRef = useRef(false);
  const selectStartRef = useRef(0);
  const selectEndRef = useRef(1);

  const player = useVideoPlayer(
    videoPath ? toVideoSource(videoPath) : null,
    configurePreviewPlayer,
  );
  const { currentTime, noteSeek } = useSmoothPlayerTime(player, (seconds) => {
    if (seconds >= selectEndRef.current - 0.04) {
      player.pause();
      player.currentTime = selectStartRef.current;
      noteSeek(selectStartRef.current);
    }
  });

  useEventListener(player, 'playingChange', () => {
    setPlaybackEpoch((value) => value + 1);
  });
  useEventListener(player, 'sourceLoad', (event) => {
    const duration = event.duration;
    if (duration && duration > 0) {
      setMediaDuration((previous) => Math.max(previous, duration));
    }
  });

  useEffect(() => {
    selectStartRef.current = selectStart;
    selectEndRef.current = selectEnd;
  }, [selectEnd, selectStart]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const clip = await getClipById(id);
        if (!clip) throw new Error('Clip not found');
        const raw = clip.project_id ? await getRawVideoByProjectId(clip.project_id) : null;
        let path = raw?.file_path ?? clip.file_path;
        if (!path || path.startsWith('pending://') || path.startsWith('clip://')) {
          throw new Error('VOD file is missing from device storage.');
        }
        path = await ensurePlayableVideo(path);
        if (cancelled) return;

        const duration = Math.max(
          raw?.duration ?? 0,
          clip.end_time ?? 0,
          (clip.start_time ?? 0) + (clip.duration ?? 0),
          1,
        );
        const start = clip.start_time ?? 0;
        const end = clip.end_time ?? start + Math.max(clip.duration ?? 30, 1);
        const window = initialAdjustWindow({
          selectStart: start,
          selectEnd: end,
          mediaDuration: duration,
        });

        setClipName(clip.name || 'Untitled Clip');
        setProjectId(clip.project_id);
        setVideoPath(path);
        setMediaDuration(duration);
        setOriginalStart(window.selectStart);
        setOriginalEnd(window.selectEnd);
        setSelectStart(window.selectStart);
        setSelectEnd(window.selectEnd);
        setBufferStart(window.bufferStart);
        setBufferEnd(window.bufferEnd);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (startedRef.current || !videoPath || loading) return;
    startedRef.current = true;
    player.currentTime = selectStart;
    noteSeek(selectStart);
  }, [loading, noteSeek, player, selectStart, videoPath]);

  const dirty = selectionIsDirty(selectStart, selectEnd, originalStart, originalEnd);

  const seekTo = useCallback(
    (seconds: number) => {
      const next = Math.max(bufferStart, Math.min(bufferEnd, seconds));
      player.currentTime = next;
      noteSeek(next);
    },
    [bufferEnd, bufferStart, noteSeek, player],
  );

  const handleClose = useCallback(() => {
    if (!dirty) {
      router.back();
      return;
    }
    appAlert('Discard changes?', 'Your adjusted clip range has not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  }, [dirty, router]);

  const handleExtend = useCallback(
    (edge: 'start' | 'end') => {
      const next = extendBuffer(edge, bufferStart, bufferEnd, mediaDuration);
      if (!next.extended) return;
      setBufferStart(next.bufferStart);
      setBufferEnd(next.bufferEnd);
    },
    [bufferEnd, bufferStart, mediaDuration],
  );

  const handleReset = useCallback(() => {
    const window = initialAdjustWindow({
      selectStart: originalStart,
      selectEnd: originalEnd,
      mediaDuration,
    });
    setSelectStart(window.selectStart);
    setSelectEnd(window.selectEnd);
    setBufferStart(window.bufferStart);
    setBufferEnd(window.bufferEnd);
    player.currentTime = window.selectStart;
    noteSeek(window.selectStart);
  }, [mediaDuration, noteSeek, originalEnd, originalStart, player]);

  const handleSave = useCallback(async () => {
    if (!id || saving) return;
    setSaving(true);
    try {
      await replaceClipSegments(id, [
        { start_time: selectStart, end_time: selectEnd },
      ]);
      if (videoPath) {
        const mid = selectStart + (selectEnd - selectStart) / 2;
        const thumb = await generateClipThumbnailAtTimestamp(videoPath, mid, id);
        if (thumb) await updateClipBuiltThumbnail(id, thumb);
      }
      if (projectId) {
        const { queueProjectSync } = await import('@/services/cloudSync');
        void queueProjectSync(projectId);
      }
      router.back();
    } catch (saveError) {
      appAlert('Could not save', saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }, [id, projectId, router, saving, selectEnd, selectStart, videoPath]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <View className="flex-1 bg-background">
        <SafeAreaView edges={['top', 'bottom']} className="flex-1">
          <View className="h-12 flex-row items-center gap-1 border-b border-border px-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={handleClose}
              className="min-h-10 min-w-10 items-center justify-center active:opacity-60"
            >
              <Ionicons name="close" size={22} color={tokens.colors.foreground} />
            </Pressable>
            <Text className="flex-1 px-1 text-sm font-semibold text-foreground" numberOfLines={1}>
              Adjust clip
            </Text>
            {dirty ? (
              <Text className="px-1 text-[10px] text-muted">
                {formatClock(selectEnd - selectStart)}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save"
              disabled={!dirty || saving || loading || !!error}
              onPress={() => void handleSave()}
              className={`min-h-10 justify-center rounded-lg bg-accent px-3 ${
                !dirty || saving || loading || error ? 'opacity-40' : 'active:opacity-70'
              }`}
            >
              <Text className="text-sm font-semibold text-white">
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={tokens.colors.accent} />
              <Text className="mt-3 text-xs text-muted">Loading VOD context…</Text>
            </View>
          ) : error || !videoPath ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-center text-muted">{error ?? 'Video unavailable'}</Text>
            </View>
          ) : (
            <>
              <View className="min-h-[180px] flex-1 items-center justify-center bg-black px-2 py-2">
                <View className="aspect-video w-full max-w-xl overflow-hidden rounded-lg bg-black">
                  <VideoView
                    player={player}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="contain"
                    nativeControls={false}
                  />
                </View>
                <Text className="mt-2 text-xs text-muted" numberOfLines={1}>
                  {clipName}
                </Text>
              </View>

              <View className="h-12 items-center justify-center border-t border-white/10 bg-black">
                <Text className="absolute left-4 font-mono text-xs text-muted">
                  {formatClock(currentTime)} / {formatClock(selectEnd - selectStart)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={player.playing ? 'Pause' : 'Play'}
                  onPress={() => {
                    void playbackEpoch;
                    if (player.playing) {
                      player.pause();
                      return;
                    }
                    if (currentTime < selectStart || currentTime >= selectEnd - 0.05) {
                      player.currentTime = selectStart;
                      noteSeek(selectStart);
                    }
                    player.play();
                  }}
                  className="min-h-11 min-w-11 items-center justify-center"
                >
                  <Ionicons
                    name={player.playing ? 'pause' : 'play'}
                    size={28}
                    color={tokens.colors.foreground}
                  />
                </Pressable>
              </View>

              <AdjustClipTimeline
                videoPath={videoPath}
                bufferStart={bufferStart}
                bufferEnd={bufferEnd}
                selectStart={selectStart}
                selectEnd={selectEnd}
                mediaDuration={mediaDuration}
                currentTime={currentTime}
                onSeek={seekTo}
                onSelectionChange={({ selectStart: nextStart, selectEnd: nextEnd }) => {
                  setSelectStart(nextStart);
                  setSelectEnd(nextEnd);
                }}
                onExtendBuffer={handleExtend}
              />

              <AdjustClipToolBar
                bufferStart={bufferStart}
                bufferEnd={bufferEnd}
                selectStart={selectStart}
                selectEnd={selectEnd}
                mediaDuration={mediaDuration}
                dirty={dirty}
                onExtend={handleExtend}
                onReset={handleReset}
              />
            </>
          )}
        </SafeAreaView>
      </View>
    </>
  );
}
