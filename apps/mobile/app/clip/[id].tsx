import { useEventListener } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdjustClipTimeline } from '@/components/adjust/AdjustClipTimeline';
import { AdjustClipToolBar } from '@/components/adjust/AdjustClipToolBar';
import { ExportSheet } from '@/components/export/ExportSheet';
import { FramedVideoPreview } from '@/components/framing/FramedVideoPreview';
import { hasVisibleFraming } from '@/components/framing/framingRegions';
import { SubtitleOverlay } from '@/components/subtitles/SubtitleOverlay';
import { SubtitleSheet } from '@/components/subtitles/SubtitleSheet';
import { Button } from '@/components/ui/button';
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
import { transcriptWordsForClip } from '@/lib/subtitleVisibleWords';
import {
  createDefaultSubtitleSettings,
  type ActiveVodPresetConfig,
  type Clip,
  type Project,
  type SubtitleSettings,
  type TargetAspectRatio,
} from '@clippster/shared-types';
import { AiPipeline, type AiPipelineProgress } from '@/services/aiPipeline';
import { generateClipThumbnailAtTimestamp } from '@/services/clipThumbnailGeneration';
import {
  getClipById,
  getClipSubtitleSettings,
  getProject,
  getProjectVodPresetConfig,
  getRawVideoByProjectId,
  getTranscriptByProjectId,
  replaceClipSegments,
  updateClipBuiltThumbnail,
  updateClipSubtitleSettings,
  updateRawVideoFilePath,
} from '@/services/database';
import { ensurePlayableVideo } from '@/services/ensurePlayableVideo';
import { useAccount } from '@/context/AccountContext';
import { tokens } from '@/theme/tokens';
import { exportEditorProject } from '@/editor/export/exportEditorProject';
import type { EditorExportProgress as ClipBuildProgress } from '@/editor/export/exportProgress';
import { loadEditorEntry } from '@/editor/state/loadEditorEntry';
import { mobileEditorDependencies } from '@/editor/state/mobileEditorDependencies';

function ClipAdjustWorkspace({
  clipId,
  clip,
  project,
  videoPath,
  mediaDuration,
  hasTranscript,
  transcriptJson,
  initialSettings,
  onReload,
}: {
  clipId: string;
  clip: Clip;
  project: Project | null;
  videoPath: string;
  mediaDuration: number;
  hasTranscript: boolean;
  transcriptJson: string | null;
  initialSettings: SubtitleSettings | null;
  onReload: () => Promise<void>;
}) {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { requireSubscription } = useAccount();
  const [saving, setSaving] = useState(false);
  const [showSubtitleSheet, setShowSubtitleSheet] = useState(false);
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(
    initialSettings ?? createDefaultSubtitleSettings(),
  );
  const [aiProgress, setAiProgress] = useState<AiPipelineProgress | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [playbackEpoch, setPlaybackEpoch] = useState(0);
  const [previewRatio, setPreviewRatio] = useState<'16:9' | '9:16'>('16:9');
  const [previewSize, setPreviewSize] = useState({ width: 360, height: 203 });
  const [vodPresetConfig, setVodPresetConfig] = useState<ActiveVodPresetConfig | null>(null);
  const [exportVisible, setExportVisible] = useState(false);
  const [exportProgress, setExportProgress] = useState<ClipBuildProgress | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const start = clip.start_time ?? 0;
  const end = clip.end_time ?? start + Math.max(clip.duration ?? 30, 1);
  const initialWindow = initialAdjustWindow({
    selectStart: start,
    selectEnd: end,
    mediaDuration,
  });

  const [originalStart, setOriginalStart] = useState(initialWindow.selectStart);
  const [originalEnd, setOriginalEnd] = useState(initialWindow.selectEnd);
  const [bufferStart, setBufferStart] = useState(initialWindow.bufferStart);
  const [bufferEnd, setBufferEnd] = useState(initialWindow.bufferEnd);
  const [selectStart, setSelectStart] = useState(initialWindow.selectStart);
  const [selectEnd, setSelectEnd] = useState(initialWindow.selectEnd);

  const startedRef = useRef(false);
  const selectStartRef = useRef(selectStart);
  const selectEndRef = useRef(selectEnd);
  const aiPipelineRef = useRef<AiPipeline | null>(null);

  const player = useVideoPlayer(toVideoSource(videoPath), configurePreviewPlayer);
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

  useEffect(() => {
    selectStartRef.current = selectStart;
    selectEndRef.current = selectEnd;
  }, [selectEnd, selectStart]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    player.currentTime = selectStart;
    noteSeek(selectStart);
  }, [noteSeek, player, selectStart]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!clip.project_id) {
        setVodPresetConfig(null);
        return () => {
          active = false;
        };
      }
      void getProjectVodPresetConfig(clip.project_id).then((next) => {
        if (!active) return;
        setVodPresetConfig(next);
        if (hasVisibleFraming(next?.framingConfig)) {
          setPreviewRatio('9:16');
          requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ y: 0, animated: false });
          });
        }
      });
      return () => {
        active = false;
      };
    }, [clip.project_id]),
  );

  const dirty = selectionIsDirty(selectStart, selectEnd, originalStart, originalEnd);
  const clipRelativeTime = currentTime - selectStart;

  const subtitleWords = useMemo(() => {
    if (!hasTranscript || !transcriptJson) return [];
    return transcriptWordsForClip(transcriptJson, selectStart, selectEnd);
  }, [hasTranscript, transcriptJson, selectStart, selectEnd]);

  const seekTo = useCallback(
    (seconds: number) => {
      const next = Math.max(bufferStart, Math.min(bufferEnd, seconds));
      player.currentTime = next;
      noteSeek(next);
    },
    [bufferEnd, bufferStart, noteSeek, player],
  );

  const persistSelection = useCallback(async () => {
    await replaceClipSegments(clipId, [
      { start_time: selectStart, end_time: selectEnd },
    ]);
    const mid = selectStart + (selectEnd - selectStart) / 2;
    const thumb = await generateClipThumbnailAtTimestamp(videoPath, mid, clipId);
    if (thumb) await updateClipBuiltThumbnail(clipId, thumb);
    if (clip.project_id) {
      const { queueProjectSync } = await import('@/services/cloudSync');
      void queueProjectSync(clip.project_id);
    }
    setOriginalStart(selectStart);
    setOriginalEnd(selectEnd);
  }, [clip.project_id, clipId, selectEnd, selectStart, videoPath]);

  const ensureSaved = useCallback(async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await persistSelection();
    } catch (error) {
      appAlert('Could not save', error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      setSaving(false);
    }
  }, [dirty, persistSelection, saving]);

  const openEditor = useCallback(
    async () => {
      try {
        await ensureSaved();
      } catch {
        return;
      }
      router.push({
        pathname: '/edit/[kind]/[id]',
        params: {
          kind: 'clip',
          id: clipId,
        },
      });
    },
    [clipId, ensureSaved, router],
  );

  const openExport = useCallback(async () => {
    try {
      await ensureSaved();
    } catch {
      return;
    }
    setExportProgress(null);
    setExportVisible(true);
  }, [ensureSaved]);

  const startExport = useCallback(
    (ratios: TargetAspectRatio[]) => {
      setExportProgress({
        state: 'building',
        progress: 0,
        message: 'Preparing clip…',
      });
      void loadEditorEntry('clip', clipId, mobileEditorDependencies)
        .then((loaded) => {
          if (loaded.missingMedia.length > 0) {
            throw new Error(
              `${loaded.missingMedia.length} media ${
                loaded.missingMedia.length === 1 ? 'file is' : 'files are'
              } unavailable.`,
            );
          }
          return exportEditorProject(loaded.document, ratios, setExportProgress);
        })
        .catch((error) => {
          setExportProgress({
            state: 'error',
            progress: 0,
            message: 'Export failed',
            error: error instanceof Error ? error.message : String(error),
          });
        });
    },
    [clipId],
  );

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
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await persistSelection();
    } catch (error) {
      appAlert('Could not save', error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [dirty, persistSelection, saving]);

  const handleClose = useCallback(() => {
    if (!dirty) {
      router.back();
      return;
    }
    appAlert('Discard changes?', 'Your adjusted clip range has not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      {
        text: 'Save',
        onPress: () => {
          void handleSave().then(() => router.back());
        },
      },
    ]);
  }, [dirty, handleSave, router]);

  async function runTranscribe() {
    if (!clip.project_id) return;
    const allowed = await requireSubscription({
      context: 'Transcribe VOD',
      type: 'ai',
      aiOnly: true,
    });
    if (!allowed) return;

    setAiBusy(true);
    const pipeline = new AiPipeline(setAiProgress);
    aiPipelineRef.current = pipeline;
    try {
      await pipeline.transcribeProject(clip.project_id);
      await onReload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Cancelled') {
        setAiProgress({ stage: 'idle', progress: 0, message: 'Cancelled' });
      } else {
        setAiProgress({
          stage: 'error',
          progress: 0,
          message: 'Transcription failed',
          error: message,
        });
      }
    } finally {
      aiPipelineRef.current = null;
      setAiBusy(false);
    }
  }

  const captionsEnabled = Boolean(subtitleSettings.enabled);
  const framingConfig = vodPresetConfig?.framingConfig ?? null;
  const showFramedPreview =
    previewRatio === '9:16' && hasVisibleFraming(framingConfig);
  const previewAspect = previewRatio === '9:16' ? 9 / 16 : 16 / 9;
  const previewMaxHeight =
    previewRatio === '9:16'
      ? Math.min(windowHeight * 0.35, 320)
      : Math.min(windowHeight * 0.31, 280);
  const previewWidth = Math.min(windowWidth - 16, previewMaxHeight * previewAspect);
  const previewHeight = previewWidth / previewAspect;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="h-12 flex-row items-center gap-1 border-b border-border px-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={handleClose}
            className="min-h-10 justify-center px-2 active:opacity-60"
          >
            <Text className="text-sm font-medium text-accent">← Back</Text>
          </Pressable>
          <Text className="flex-1 px-1 text-sm font-semibold text-foreground" numberOfLines={1}>
            {clip.name || project?.name || 'Clip'}
          </Text>
          {dirty ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save"
              disabled={saving}
              onPress={() => void handleSave()}
              className={`min-h-10 justify-center rounded-lg bg-accent px-3 ${
                saving ? 'opacity-40' : 'active:opacity-70'
              }`}
            >
              <Text className="text-sm font-semibold text-white">
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View className="flex-row items-center justify-center gap-2 border-b border-border bg-black px-4 py-2">
          {(['16:9', '9:16'] as const).map((ratio) => {
            const active = previewRatio === ratio;
            return (
              <Pressable
                key={ratio}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setPreviewRatio(ratio)}
                className={`min-w-20 items-center rounded-full px-4 py-1.5 ${
                  active ? 'bg-accent' : 'border border-border bg-surface'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    active ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {ratio}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="flex-grow pb-2"
          bounces={false}
        >
          <View className="min-h-[180px] items-center justify-center bg-black px-2 py-2">
            <View
              className="overflow-hidden rounded-lg bg-black"
              style={{ width: previewWidth, height: previewHeight }}
            >
              <View
                className="relative h-full w-full"
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout;
                  if (width > 0 && height > 0) {
                    setPreviewSize({ width, height });
                  }
                }}
              >
                {showFramedPreview && framingConfig ? (
                  <FramedVideoPreview
                    config={framingConfig}
                    targetRatio="9:16"
                    videoPath={videoPath}
                    currentTime={clipRelativeTime}
                    videoTime={currentTime}
                    playing={player.playing}
                    width={previewWidth}
                    height={previewHeight}
                  />
                ) : (
                  <VideoView
                    player={player}
                    style={{ width: '100%', height: '100%' }}
                    contentFit={previewRatio === '9:16' ? 'cover' : 'contain'}
                    nativeControls={false}
                    surfaceType="textureView"
                  />
                )}
                {captionsEnabled ? (
                  <SubtitleOverlay
                    settings={subtitleSettings}
                    words={subtitleWords}
                    currentTime={clipRelativeTime}
                    targetRatio={previewRatio}
                    frameWidth={previewSize.width}
                    frameHeight={previewSize.height}
                    sampleFallback
                  />
                ) : null}
              </View>
            </View>
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

          <View className="mx-4 mt-3 flex-row items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3">
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: captionsEnabled }}
              onPress={() => {
                const next = { ...subtitleSettings, enabled: !captionsEnabled };
                setSubtitleSettings(next);
                void updateClipSubtitleSettings(
                  clipId,
                  next.enabled,
                  next.selectedPresetId ?? 'tiktok-bold',
                  next,
                );
              }}
              className={`h-5 w-5 items-center justify-center rounded border ${
                captionsEnabled ? 'border-accent bg-accent' : 'border-border bg-black'
              }`}
            >
              {captionsEnabled ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : null}
            </Pressable>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={tokens.colors.accent} />
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-medium text-foreground">Captions</Text>
              <Text className="text-[10px] text-muted">
                {aiBusy
                  ? aiProgress?.message || 'Transcribing…'
                  : hasTranscript
                    ? captionsEnabled
                      ? 'On · tap Edit to style'
                      : 'Off · tap Edit to style'
                    : 'Transcript needed'}
              </Text>
            </View>
            <Pressable
              disabled={aiBusy}
              onPress={() => {
                if (hasTranscript) {
                  setShowSubtitleSheet(true);
                  return;
                }
                void runTranscribe();
              }}
              className="rounded-lg border border-border bg-white/5 px-3 py-1.5 active:opacity-70"
            >
              <Text className="text-xs font-semibold text-foreground">
                {hasTranscript ? 'Edit' : 'Generate'}
              </Text>
            </Pressable>
          </View>

          {clip.project_id ? (
            <View className="mx-4 mt-2 flex-row items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3">
              <Ionicons name="phone-portrait-outline" size={20} color={tokens.colors.accent} />
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-medium text-foreground">9:16 Framing</Text>
                <Text className="text-[10px] text-muted">
                  {hasVisibleFraming(framingConfig)
                    ? 'Configured · previewing framed 9:16'
                    : 'Source regions, output layout, and blurred 16:9 framing'}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/framing/[projectId]',
                    params: {
                      projectId: clip.project_id!,
                      clipId,
                      clipStart: String(selectStart),
                      clipEnd: String(selectEnd),
                      ratio: '9:16',
                    },
                  })
                }
                className="rounded-lg border border-border bg-white/5 px-3 py-1.5 active:opacity-70"
              >
                <Text className="text-xs font-semibold text-foreground">Edit</Text>
              </Pressable>
            </View>
          ) : null}

          {aiProgress && aiBusy ? (
            <View className="mx-4 mt-2 flex-row items-center justify-between gap-3">
              <Text className="flex-1 text-xs text-muted">{aiProgress.message}</Text>
              <Pressable
                onPress={() => {
                  aiPipelineRef.current?.cancel();
                  setAiProgress({ stage: 'idle', progress: 0, message: 'Cancelling…' });
                }}
                className="rounded-lg border border-border px-3 py-1.5"
              >
                <Text className="text-xs font-semibold text-foreground">Cancel</Text>
              </Pressable>
            </View>
          ) : null}

          <View className="mt-auto gap-3 px-4 pt-4">
            <Button title="Open in Editor" variant="accent" onPress={() => void openEditor()} />
            <Button title="Export" variant="accent" onPress={() => void openExport()} />
          </View>
        </ScrollView>
      </SafeAreaView>

      <SubtitleSheet
        visible={showSubtitleSheet}
        settings={subtitleSettings}
        hasTranscript={hasTranscript}
        onClose={() => setShowSubtitleSheet(false)}
        onSave={(enabled, presetId, settings) => {
          const next = { ...settings, enabled, selectedPresetId: presetId };
          setSubtitleSettings(next);
          void (async () => {
            await updateClipSubtitleSettings(clipId, enabled, presetId, next);
            if (clip.project_id) {
              const { queueProjectSync } = await import('@/services/cloudSync');
              void queueProjectSync(clip.project_id);
            }
          })();
        }}
      />
      <ExportSheet
        visible={exportVisible}
        progress={exportProgress}
        title="Export clip"
        showRemux={false}
        onClose={() => setExportVisible(false)}
        onExport={({ ratios }) => startExport(ratios)}
      />
    </View>
  );
}

export default function ClipWorkspaceScreen() {
  const { id: clipId } = useLocalSearchParams<{ id: string }>();
  const [clip, setClip] = useState<Clip | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [hasTranscript, setHasTranscript] = useState(false);
  const [transcriptJson, setTranscriptJson] = useState<string | null>(null);
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClip = useCallback(async () => {
    if (!clipId) return;
    setLoading(true);
    setError(null);
    try {
      const clipRow = await getClipById(clipId);
      if (!clipRow) {
        setClip(null);
        setError('Clip is missing from device storage.');
        return;
      }
      const projectId = clipRow.project_id;
      const [projectRow, rawVideo, transcript, subs] = await Promise.all([
        projectId ? getProject(projectId) : Promise.resolve(null),
        projectId ? getRawVideoByProjectId(projectId) : Promise.resolve(null),
        projectId ? getTranscriptByProjectId(projectId) : Promise.resolve(null),
        getClipSubtitleSettings(clipId),
      ]);
      let nextPath = rawVideo?.file_path ?? clipRow.file_path;
      if (!nextPath || nextPath.startsWith('pending://') || nextPath.startsWith('clip://')) {
        throw new Error('VOD file is missing from device storage.');
      }
      const playable = await ensurePlayableVideo(nextPath);
      if (playable !== nextPath && projectId) {
        await updateRawVideoFilePath(projectId, playable);
      }
      nextPath = playable;

      const duration = Math.max(
        rawVideo?.duration ?? 0,
        clipRow.end_time ?? 0,
        (clipRow.start_time ?? 0) + (clipRow.duration ?? 0),
        1,
      );

      setClip(clipRow);
      setProject(projectRow);
      setVideoPath(nextPath);
      setMediaDuration(duration);
      setHasTranscript(!!transcript);
      setTranscriptJson(transcript?.raw_json ?? null);
      setSubtitleSettings(subs);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setClip(null);
    } finally {
      setLoading(false);
    }
  }, [clipId]);

  useEffect(() => {
    void loadClip();
  }, [loadClip]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.accent} />
        <Text className="mt-3 text-xs text-muted">Loading clip…</Text>
      </View>
    );
  }

  if (!clip || !videoPath || !clipId || error) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-muted">{error ?? 'Clip is missing from device storage.'}</Text>
      </View>
    );
  }

  return (
    <ClipAdjustWorkspace
      clipId={clipId}
      clip={clip}
      project={project}
      videoPath={videoPath}
      mediaDuration={mediaDuration}
      hasTranscript={hasTranscript}
      transcriptJson={transcriptJson}
      initialSettings={subtitleSettings}
      onReload={loadClip}
    />
  );
}
