import { useEventListener } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { EditorToolId } from '@/components/editor/ClipMoreSheet';
import { ClipMoreSheet } from '@/components/editor/ClipMoreSheet';
import { VideoPlayerControls } from '@/components/editor/VideoPlayerControls';
import { ExportSheet } from '@/components/export/ExportSheet';
import { SubtitleOverlay } from '@/components/subtitles/SubtitleOverlay';
import { SubtitleSheet } from '@/components/subtitles/SubtitleSheet';
import { TextBoxOverlay } from '@/components/textbox/TextBoxOverlay';
import { TextBoxSheet } from '@/components/textbox/TextBoxSheet';
import { VideoThumbnailProvider } from '@/components/media/HiddenThumbnailPlayer';
import { SegmentTimeline } from '@/components/workspace/SegmentTimeline';
import { useSmoothPlayerTime } from '@/hooks/useSmoothPlayerTime';
import { configurePreviewPlayer } from '@/lib/configurePreviewPlayer';
import { toVideoSource } from '@/lib/playbackVideo';
import type { Clip, ClipSegment, Project } from '@clippster/shared-types';
import type { ClipTextBoxState, SubtitleSettings } from '@clippster/shared-types';
import { upsertClipTextPerRatioGeometry } from '@clippster/shared-types';
import { AiPipeline, type AiPipelineProgress } from '@/services/aiPipeline';
import {
  buildClipExport,
  cancelClipBuild,
  type ClipBuildProgress,
} from '@/services/clipBuildPipeline';
import { loadEditDocument } from '@/lib/timeline/editStorage';
import { buildTimelineExport } from '@/services/timelineExport';
import { transcriptWordsFromRaw, transcriptWordsForClip } from '@/lib/subtitleVisibleWords';
import {
  getClipById,
  getClipSegmentsByClipId,
  getClipSubtitleSettings,
  getClipTextOverlay,
  getProject,
  getRawVideoByProjectId,
  getTranscriptByProjectId,
  updateClipSubtitleSettings,
  updateClipTextOverlay,
  updateRawVideoFilePath,
} from '@/services/database';
import { ensurePlayableVideo } from '@/services/ensurePlayableVideo';
import { useAccount } from '@/context/AccountContext';
import { tokens } from '@/theme/tokens';
import { appAlert } from '@/lib/appAlert';

function ClipWorkspace({
  clipId,
  clip,
  project,
  videoPath,
  hasTranscript,
  transcriptJson,
  segments,
  onReload,
}: {
  clipId: string;
  clip: Clip;
  project: Project | null;
  videoPath: string;
  hasTranscript: boolean;
  transcriptJson: string | null;
  segments: ClipSegment[];
  onReload: () => Promise<void>;
}) {
  const router = useRouter();
  const { requireSubscription } = useAccount();
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings | null>(null);
  const [textBox, setTextBox] = useState<ClipTextBoxState | null>(null);
  const [showSubtitleSheet, setShowSubtitleSheet] = useState(false);
  const [showTextBoxSheet, setShowTextBoxSheet] = useState(false);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [exportProgress, setExportProgress] = useState<ClipBuildProgress | null>(null);
  const [previewRatio, setPreviewRatio] = useState<'9:16' | '16:9'>('16:9');
  const [aiProgress, setAiProgress] = useState<AiPipelineProgress | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const segmentEndRef = useRef<number | null>(clip.end_time);
  const aiPipelineRef = useRef<AiPipeline | null>(null);
  const startedRef = useRef(false);

  const player = useVideoPlayer(toVideoSource(videoPath), configurePreviewPlayer);
  const { currentTime: playheadTime, timeSV, noteSeek } = useSmoothPlayerTime(player, (seconds) => {
    const end = segmentEndRef.current;
    if (end != null && seconds >= end) {
      player.pause();
      segmentEndRef.current = null;
    }
  });

  const [, setPlaybackEpoch] = useState(0);
  useEventListener(player, 'playingChange', () => {
    setPlaybackEpoch((value) => value + 1);
  });
  useEventListener(player, 'volumeChange', () => {
    setPlaybackEpoch((value) => value + 1);
  });

  useEffect(() => {
    void (async () => {
      const [subs, text] = await Promise.all([
        getClipSubtitleSettings(clipId),
        getClipTextOverlay(clipId),
      ]);
      setSubtitleSettings(subs);
      setTextBox(text);
    })();
  }, [clipId]);

  useEffect(() => {
    segmentEndRef.current = clip.end_time;
  }, [clip.end_time]);

  useEffect(() => {
    if (startedRef.current) return;
    if (clip.start_time == null || clip.end_time == null) return;
    startedRef.current = true;
    segmentEndRef.current = clip.end_time;
    player.currentTime = clip.start_time;
    noteSeek(clip.start_time);
    player.play();
  }, [clip.end_time, clip.start_time, noteSeek, player]);

  async function runTranscribe() {
    if (!clip?.project_id) return;
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

  const clipStart = clip?.start_time ?? 0;
  const clipEnd = clip?.end_time ?? clipStart;
  const clipRelativeTime = playheadTime - clipStart;

  const subtitleWords = useMemo(() => {
    if (!hasTranscript || !clip || !transcriptJson) return [];
    return transcriptWordsForClip(transcriptJson, clipStart, clipEnd);
  }, [hasTranscript, clip, transcriptJson, clipStart, clipEnd]);

  const landscapeWidth = windowWidth;
  const landscapeHeight = landscapeWidth * (9 / 16);
  const portraitHeight = Math.min(windowHeight * 0.42, landscapeHeight + 24);
  const portraitWidth = portraitHeight * (9 / 16);
  const videoWidth = previewRatio === '9:16' ? portraitWidth : landscapeWidth;
  const videoHeight = previewRatio === '9:16' ? portraitHeight : landscapeHeight;
  const videoStyle = useMemo(
    () => ({ width: videoWidth, height: videoHeight, backgroundColor: '#000' as const }),
    [videoWidth, videoHeight],
  );

  async function handleExport(options: {
    ratios: ('9:16' | '16:9')[];
    remuxOnly: boolean;
  }) {
    if (!clipId || !clip?.project_id) return;
    setExportProgress({ state: 'building', progress: 0, message: 'Starting...' });
    try {
      const timeline =
        (await loadEditDocument('clip', clipId)) ??
        (await loadEditDocument('project', clip.project_id));
      if (timeline && timeline.videos.length > 0 && !options.remuxOnly) {
        const words = transcriptJson ? transcriptWordsFromRaw(transcriptJson) : [];
        await buildTimelineExport(timeline, {
          ratios: options.ratios,
          wordsBySourcePath: videoPath ? { [videoPath]: words } : {},
          clipId,
          projectId: clip.project_id,
          onProgress: setExportProgress,
        });
      } else {
        await buildClipExport(clipId, clip.project_id, {
          ratios: options.ratios,
          remuxOnly: options.remuxOnly,
          onProgress: setExportProgress,
        });
      }
    } catch (error) {
      if ((error as Error).message !== 'Export cancelled') {
        appAlert('Export failed', error instanceof Error ? error.message : String(error));
      }
    }
  }

  function handleToolPress(tool: EditorToolId) {
    switch (tool) {
      case 'edit':
        if (clipId) {
          router.push({ pathname: '/edit/[kind]/[id]', params: { kind: 'clip', id: clipId } });
        }
        break;
      case 'transcribe':
        void runTranscribe();
        break;
      case 'framing':
        if (clip?.project_id) router.push(`/framing/${clip.project_id}`);
        break;
      case 'subtitles':
        setShowSubtitleSheet(true);
        break;
      case 'text':
        setShowTextBoxSheet(true);
        break;
      case 'ratio-9-16':
        setPreviewRatio('9:16');
        break;
      case 'ratio-16-9':
        setPreviewRatio('16:9');
        break;
    }
  }

  return (
    <VideoThumbnailProvider paths={[videoPath]}>
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} className="border-b border-border bg-background">
        <View className="flex-row items-center justify-between px-4 py-2">
          <Pressable onPress={() => router.back()} className="py-1">
            <Text className="text-sm font-medium text-accent">← Back</Text>
          </Pressable>
          <Text className="flex-1 text-center text-base font-semibold text-foreground" numberOfLines={1}>
            {clip.name || project?.name || 'Clip'}
          </Text>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setShowMoreSheet(true)}
              className="rounded-lg border border-border px-2.5 py-1.5"
            >
              <Ionicons name="ellipsis-horizontal" size={16} color={tokens.colors.foreground} />
            </Pressable>
            <Pressable
              onPress={() => setShowExportSheet(true)}
              className="rounded-lg bg-primary px-3 py-1.5"
            >
              <Text className="text-sm font-semibold text-primary-foreground">Export</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <View className="bg-black">
        <View className="items-center">
          <View className="relative" style={{ width: videoWidth, height: videoHeight }}>
            <VideoView
              player={player}
              style={videoStyle}
              nativeControls={false}
              contentFit={previewRatio === '9:16' ? 'cover' : 'contain'}
            />
            {subtitleSettings?.enabled ? (
              <SubtitleOverlay
                settings={subtitleSettings}
                words={subtitleWords}
                currentTime={clipRelativeTime}
                targetRatio={previewRatio}
                frameWidth={videoWidth}
                frameHeight={videoHeight}
                sampleFallback
              />
            ) : null}
            {textBox?.enabled ? (
              <TextBoxOverlay
                state={textBox}
                currentTime={clipRelativeTime}
                frameWidth={videoWidth}
                onPositionChange={(x, y) => {
                  const next = upsertClipTextPerRatioGeometry(textBox, previewRatio, {
                    x,
                    y,
                    widthPct: textBox.widthPct,
                  });
                  setTextBox(next);
                  void updateClipTextOverlay(clipId, next);
                }}
              />
            ) : null}
          </View>
        </View>
        <VideoPlayerControls
          player={player}
          currentTime={playheadTime}
          timeSV={timeSV}
          duration={player.duration ?? 0}
        onSeek={(seconds) => {
          segmentEndRef.current = clipEnd;
          player.currentTime = seconds;
          noteSeek(seconds);
        }}
        />
      </View>

      <SegmentTimeline
        clipId={clip.id}
        clipStart={clipStart}
        videoPath={videoPath}
        segments={segments}
        currentTime={playheadTime}
        onSeek={(t) => {
          player.currentTime = t;
          noteSeek(t);
        }}
        onSegmentsChange={() => void onReload()}
      />

      {aiProgress ? (
        <View className="flex-row items-center justify-between gap-3 px-4 py-1">
          <Text className="flex-1 text-xs text-muted">
            {aiProgress.message}
            {aiProgress.error ? ` — ${aiProgress.error}` : ''}
          </Text>
          {aiBusy ? (
            <Pressable
              onPress={() => {
                aiPipelineRef.current?.cancel();
                setAiProgress({ stage: 'idle', progress: 0, message: 'Cancelling…' });
              }}
              className="rounded-lg border border-border px-3 py-1.5"
            >
              <Text className="text-xs font-semibold text-foreground">Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ClipMoreSheet
        visible={showMoreSheet}
        activeRatio={previewRatio}
        hasTranscript={hasTranscript}
        aiBusy={aiBusy}
        onClose={() => setShowMoreSheet(false)}
        onToolPress={handleToolPress}
      />

      <SubtitleSheet
        visible={showSubtitleSheet}
        settings={subtitleSettings}
        hasTranscript={hasTranscript}
        onClose={() => setShowSubtitleSheet(false)}
        onSave={(enabled, presetId, settings) => {
          void (async () => {
            await updateClipSubtitleSettings(clipId, enabled, presetId, settings);
            setSubtitleSettings(settings);
            if (clip.project_id) {
              const { queueProjectSync } = await import('@/services/cloudSync');
              void queueProjectSync(clip.project_id);
            }
          })();
        }}
      />

      <TextBoxSheet
        visible={showTextBoxSheet}
        state={textBox}
        clipDuration={(clip.duration ?? clip.end_time ?? 0) - clipStart}
        onClose={() => setShowTextBoxSheet(false)}
        onSave={(state) => {
          void (async () => {
            await updateClipTextOverlay(clipId, state);
            setTextBox(state);
            if (clip.project_id) {
              const { queueProjectSync } = await import('@/services/cloudSync');
              void queueProjectSync(clip.project_id);
            }
          })();
        }}
      />

      <ExportSheet
        visible={showExportSheet}
        progress={exportProgress}
        onClose={() => {
          if (exportProgress?.state === 'building') cancelClipBuild();
          setShowExportSheet(false);
        }}
        onExport={handleExport}
      />
    </View>
    </VideoThumbnailProvider>
  );
}

export default function ClipWorkspaceScreen() {
  const { id: clipId } = useLocalSearchParams<{ id: string }>();
  const [clip, setClip] = useState<Clip | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [hasTranscript, setHasTranscript] = useState(false);
  const [transcriptJson, setTranscriptJson] = useState<string | null>(null);
  const [segments, setSegments] = useState<ClipSegment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClip = useCallback(async () => {
    if (!clipId) return;
    const clipRow = await getClipById(clipId);
    if (!clipRow) {
      setClip(null);
      setLoading(false);
      return;
    }
    const projectId = clipRow.project_id;
    const [projectRow, rawVideo, transcript, segs] = await Promise.all([
      projectId ? getProject(projectId) : Promise.resolve(null),
      projectId ? getRawVideoByProjectId(projectId) : Promise.resolve(null),
      projectId ? getTranscriptByProjectId(projectId) : Promise.resolve(null),
      getClipSegmentsByClipId(clipId),
    ]);
    let nextPath = rawVideo?.file_path ?? clipRow.file_path;
    if (nextPath) {
      const playable = await ensurePlayableVideo(nextPath);
      if (playable !== nextPath && projectId) {
        await updateRawVideoFilePath(projectId, playable);
      }
      nextPath = playable;
    }
    setClip(clipRow);
    setProject(projectRow);
    setVideoPath(nextPath);
    setHasTranscript(!!transcript);
    setTranscriptJson(transcript?.raw_json ?? null);
    setSegments(segs);
    setLoading(false);
  }, [clipId]);

  useEffect(() => {
    void loadClip();
  }, [loadClip]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.accent} />
      </View>
    );
  }

  if (!clip || !videoPath || !clipId) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-muted">Clip is missing from device storage.</Text>
      </View>
    );
  }

  return (
    <ClipWorkspace
      clipId={clipId}
      clip={clip}
      project={project}
      videoPath={videoPath}
      hasTranscript={hasTranscript}
      transcriptJson={transcriptJson}
      segments={segments}
      onReload={loadClip}
    />
  );
}
