import { useEventListener } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClipDetectionSheet, type ClipDetectionPlan } from '@/components/editor/ClipDetectionSheet';
import { ClipMoreSheet } from '@/components/editor/ClipMoreSheet';
import { ClipTrimBar } from '@/components/editor/ClipTrimBar';
import type { EditorToolId } from '@/components/editor/ClipMoreSheet';
import { VideoPlayerControls } from '@/components/editor/VideoPlayerControls';
import { ExportSheet } from '@/components/export/ExportSheet';
import { SubtitleOverlay } from '@/components/subtitles/SubtitleOverlay';
import { SubtitleSheet } from '@/components/subtitles/SubtitleSheet';
import { TextBoxOverlay } from '@/components/textbox/TextBoxOverlay';
import { TextBoxSheet } from '@/components/textbox/TextBoxSheet';
import { SegmentTimeline } from '@/components/workspace/SegmentTimeline';
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
import { transcriptWordsFromRaw } from '@/lib/subtitleVisibleWords';
import {
  addManualClip,
  getClipSegmentsByClipId,
  getClipSubtitleSettings,
  getClipTextOverlay,
  getClipsByProjectId,
  getProject,
  getRawVideoByProjectId,
  getTranscriptByProjectId,
  updateClipSubtitleSettings,
  updateClipTextOverlay,
  updateClipTimeRange,
} from '@/services/database';
import { useAccount } from '@/context/AccountContext';
import { settingsFromPresetId } from '@/lib/captionPresets';
import { transcriptWordsForClip } from '@/lib/subtitleVisibleWords';
import { tokens } from '@/theme/tokens';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function ProjectWorkspace({
  projectId,
  project,
  videoPath,
  clips,
  hasTranscript,
  transcriptJson,
  openDetectInitially,
  onRefresh,
}: {
  projectId: string;
  project: Project;
  videoPath: string;
  clips: Clip[];
  hasTranscript: boolean;
  transcriptJson: string | null;
  openDetectInitially?: boolean;
  onRefresh: () => Promise<void>;
}) {
  const router = useRouter();
  const { requireSubscription } = useAccount();
  const [activeClipId, setActiveClipId] = useState<string | null>(clips[0]?.id ?? null);
  const [segments, setSegments] = useState<ClipSegment[]>([]);
  const [aiProgress, setAiProgress] = useState<AiPipelineProgress | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings | null>(null);
  const [textBox, setTextBox] = useState<ClipTextBoxState | null>(null);
  const [showSubtitleSheet, setShowSubtitleSheet] = useState(false);
  const [showTextBoxSheet, setShowTextBoxSheet] = useState(false);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [exportProgress, setExportProgress] = useState<ClipBuildProgress | null>(null);
  const [previewRatio, setPreviewRatio] = useState<'9:16' | '16:9'>('16:9');
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const segmentEndRef = useRef<number | null>(null);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [showDetectSheet, setShowDetectSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(30);
  const trimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeClip = useMemo(
    () => clips.find((c) => c.id === activeClipId) ?? null,
    [clips, activeClipId],
  );

  const player = useVideoPlayer(videoPath, (instance) => {
    instance.timeUpdateEventInterval = 0.25;
  });

  useEventListener(player, 'timeUpdate', (payload: { currentTime: number }) => {
    setPlayheadTime(payload.currentTime);
    const end = segmentEndRef.current;
    if (end != null && payload.currentTime >= end) {
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

  const loadClipData = useCallback(async (clipId: string) => {
    const [segs, subs, text] = await Promise.all([
      getClipSegmentsByClipId(clipId),
      getClipSubtitleSettings(clipId),
      getClipTextOverlay(clipId),
    ]);
    setSegments(segs);
    setSubtitleSettings(subs);
    setTextBox(text);
  }, []);

  useEffect(() => {
    if (activeClipId) void loadClipData(activeClipId);
  }, [activeClipId, loadClipData]);

  useEffect(() => {
    if (!activeClip) return;
    setTrimStart(activeClip.start_time ?? 0);
    setTrimEnd(activeClip.end_time ?? (activeClip.start_time ?? 0) + 30);
  }, [activeClip?.id]);

  useEffect(() => {
    if (!activeClipId && clips[0]?.id) {
      setActiveClipId(clips[0].id);
    }
  }, [clips, activeClipId]);

  const openDetectSheet = useCallback(async () => {
    if (aiBusy) return;
    const allowed = await requireSubscription({
      context: 'Detect clips with AI',
      type: 'ai',
      aiOnly: true,
    });
    if (!allowed) return;
    setShowDetectSheet(true);
  }, [aiBusy, requireSubscription]);

  useEffect(() => {
    if (!openDetectInitially) return;
    void openDetectSheet();
  }, [openDetectInitially, openDetectSheet]);

  async function runTranscribe() {
    const allowed = await requireSubscription({
      context: 'Transcribe VOD',
      type: 'ai',
      aiOnly: true,
    });
    if (!allowed) return;

    setAiBusy(true);
    const pipeline = new AiPipeline(setAiProgress);
    try {
      await pipeline.transcribeProject(projectId);
      await onRefresh();
    } catch (error) {
      setAiProgress({
        stage: 'error',
        progress: 0,
        message: 'Transcription failed',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setAiBusy(false);
    }
  }

  async function confirmDetect(plan: ClipDetectionPlan) {
    setShowDetectSheet(false);
    setAiBusy(true);
    setAiProgress({
      stage: 'checking_credits',
      progress: 0,
      message: 'Starting clip detection…',
    });

    const allowed = await requireSubscription({
      context: 'Detect clips with AI',
      type: 'ai',
      aiOnly: true,
    });
    if (!allowed) {
      setAiBusy(false);
      setAiProgress(null);
      return;
    }

    const pipeline = new AiPipeline(setAiProgress);
    try {
      if (!hasTranscript) {
        await pipeline.transcribeProject(projectId);
        await onRefresh();
      }
      const found = await pipeline.detectClips(projectId, {
        prompt: plan.prompt.content,
        startTime: plan.startTime,
        endTime: plan.endTime,
      });
      await onRefresh();

      if (plan.subtitlesEnabled) {
        const detected = await getClipsByProjectId(projectId);
        const settings = settingsFromPresetId(plan.subtitlePresetId);
        settings.enabled = true;
        await Promise.all(
          detected.map((clip) =>
            updateClipSubtitleSettings(clip.id, true, plan.subtitlePresetId, settings),
          ),
        );
        if (activeClipId) {
          setSubtitleSettings(settings);
        }
      }
      if (found === 0) {
        Alert.alert('No clips found', 'Try a different prompt or a wider time range.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAiProgress({
        stage: 'error',
        progress: 0,
        message: 'Detection failed',
        error: message,
      });
      Alert.alert('Detection failed', message);
    } finally {
      setAiBusy(false);
    }
  }

  async function createClipAtPlayhead() {
    const duration = player.duration && player.duration > 0 ? player.duration : playheadTime + 30;
    const start = Math.max(0, playheadTime);
    const end = Math.min(duration, start + 30);
    try {
      const clipId = await addManualClip(
        projectId,
        videoPath,
        start,
        end > start ? end : start + 30,
      );
      await onRefresh();
      setActiveClipId(clipId);
      setTrimStart(start);
      setTrimEnd(end > start ? end : start + 30);
      segmentEndRef.current = null;
      player.currentTime = start;
      player.play();
    } catch (error) {
      Alert.alert('Could not create clip', error instanceof Error ? error.message : String(error));
    }
  }

  function persistTrim(start: number, end: number) {
    if (!activeClipId) return;
    if (trimTimerRef.current) clearTimeout(trimTimerRef.current);
    trimTimerRef.current = setTimeout(() => {
      void (async () => {
        await updateClipTimeRange(activeClipId, start, end);
        await onRefresh();
        await loadClipData(activeClipId);
      })();
    }, 250);
  }

  function playClip(clip: Clip) {
    setActiveClipId(clip.id);
    if (clip.start_time == null || clip.end_time == null) return;
    segmentEndRef.current = clip.end_time;
    player.currentTime = clip.start_time;
    player.play();
  }

  const clipStart = activeClip?.start_time ?? 0;
  const clipEnd = activeClip?.end_time ?? clipStart;
  const clipRelativeTime = playheadTime - clipStart;

  const subtitleWords = useMemo(() => {
    if (!hasTranscript || !activeClip || !transcriptJson) return [];
    return transcriptWordsForClip(transcriptJson, clipStart, clipEnd);
  }, [hasTranscript, activeClip, transcriptJson, clipStart, clipEnd]);

  const landscapeWidth = windowWidth;
  const landscapeHeight = landscapeWidth * (9 / 16);
  const portraitHeight = Math.min(windowHeight * 0.42, landscapeHeight + 24);
  const portraitWidth = portraitHeight * (9 / 16);
  const videoWidth = previewRatio === '9:16' ? portraitWidth : landscapeWidth;
  const videoHeight = previewRatio === '9:16' ? portraitHeight : landscapeHeight;

  async function handleExport(options: {
    ratios: ('9:16' | '16:9')[];
    remuxOnly: boolean;
  }) {
    if (!activeClipId) return;
    setExportProgress({ state: 'building', progress: 0, message: 'Starting...' });
    try {
      const timeline =
        (await loadEditDocument('clip', activeClipId)) ??
        (await loadEditDocument('project', projectId));
      if (timeline && timeline.videos.length > 0 && !options.remuxOnly) {
        const words = transcriptJson ? transcriptWordsFromRaw(transcriptJson) : [];
        await buildTimelineExport(timeline, {
          ratios: options.ratios,
          wordsBySourcePath: videoPath ? { [videoPath]: words } : {},
          clipId: activeClipId,
          projectId,
          onProgress: setExportProgress,
        });
      } else {
        await buildClipExport(activeClipId, projectId, {
          ratios: options.ratios,
          remuxOnly: options.remuxOnly,
          onProgress: setExportProgress,
        });
      }
    } catch (error) {
      if ((error as Error).message !== 'Export cancelled') {
        Alert.alert('Export failed', error instanceof Error ? error.message : String(error));
      }
    }
  }

  function handleToolPress(tool: EditorToolId) {
    switch (tool) {
      case 'edit':
        if (activeClipId) {
          router.push({ pathname: '/edit/[kind]/[id]', params: { kind: 'clip', id: activeClipId } });
        }
        break;
      case 'transcribe':
        void runTranscribe();
        break;
      case 'framing':
        router.push(`/framing/${projectId}`);
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
    <View className="flex-1 bg-background">
      <SafeAreaView edges={['top']} className="border-b border-border bg-background">
        <View className="flex-row items-center justify-between px-4 py-2">
          <Pressable onPress={() => router.back()} className="py-1">
            <Text className="text-sm font-medium text-accent">← Back</Text>
          </Pressable>
          <Text className="flex-1 text-center text-base font-semibold text-foreground" numberOfLines={1}>
            {project.name}
          </Text>
          <Pressable
            onPress={() => setShowExportSheet(true)}
            disabled={!activeClipId}
            className={`rounded-lg px-3 py-1.5 ${activeClipId ? 'bg-primary' : 'bg-surfaceMuted'}`}
          >
            <Text
              className={`text-sm font-semibold ${
                activeClipId ? 'text-primary-foreground' : 'text-muted'
              }`}
            >
              Export
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <View className="bg-black">
        <View className="items-center">
          <View
            className="relative"
            style={{ width: videoWidth, height: videoHeight }}
          >
            <VideoView
              player={player}
              style={{
                width: videoWidth,
                height: videoHeight,
                backgroundColor: '#000',
              }}
              nativeControls={false}
              contentFit={previewRatio === '9:16' ? 'cover' : 'contain'}
            />
            {subtitleSettings?.enabled && activeClip ? (
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
                  if (activeClipId) void updateClipTextOverlay(activeClipId, next);
                }}
              />
            ) : null}
          </View>
        </View>
        <VideoPlayerControls
          player={player}
          currentTime={playheadTime}
          duration={player.duration ?? 0}
          onSeek={(seconds) => {
            segmentEndRef.current = null;
            player.currentTime = seconds;
            setPlayheadTime(seconds);
          }}
        />
        {activeClip ? (
          <ClipTrimBar
            startTime={trimStart}
            endTime={trimEnd}
            videoDuration={player.duration ?? trimEnd}
            onChangeStart={(start) => {
              setTrimStart(start);
              segmentEndRef.current = null;
              player.currentTime = start;
              setPlayheadTime(start);
              persistTrim(start, trimEnd);
            }}
            onChangeEnd={(end) => {
              setTrimEnd(end);
              segmentEndRef.current = null;
              player.currentTime = Math.max(trimStart, end - 0.25);
              setPlayheadTime(Math.max(trimStart, end - 0.25));
              persistTrim(trimStart, end);
            }}
          />
        ) : null}
        {activeClip ? (
          <View className="flex-row items-center justify-end border-t border-border bg-surface px-4 py-2">
            <Pressable
              onPress={() => setShowMoreSheet(true)}
              className="flex-row items-center gap-1.5 rounded-lg border border-border px-3 py-1.5"
            >
              <Ionicons name="ellipsis-horizontal" size={16} color={tokens.colors.foreground} />
              <Text className="text-xs font-semibold text-foreground">More</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {activeClip ? (
        <SegmentTimeline
          clipId={activeClip.id}
          clipStart={clipStart}
          segments={segments}
          currentTime={playheadTime}
          onSeek={(t) => {
            player.currentTime = t;
            setPlayheadTime(t);
          }}
          onSegmentsChange={() => void loadClipData(activeClip.id)}
        />
      ) : (
        <View className="mx-4 rounded-lg border border-dashed border-border px-4 py-3">
          <Text className="text-center text-sm text-muted">
            Detect clips with AI, or tap New clip to mark a segment at the playhead. Drag Start and
            End to trim while the video plays.
          </Text>
        </View>
      )}

      {aiProgress ? (
        <Text className="px-4 py-1 text-xs text-muted">
          {aiProgress.message}
          {aiProgress.error ? ` — ${aiProgress.error}` : ''}
        </Text>
      ) : null}

      <View className="border-t border-border py-2">
        <View className="mb-2 flex-row items-center justify-between px-4">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
            Clips ({clips.length})
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => void openDetectSheet()}
              disabled={aiBusy}
              className="rounded-lg bg-primary px-3 py-1.5"
            >
              <Text className="text-xs font-semibold text-primary-foreground">Detect clips</Text>
            </Pressable>
            <Pressable
              onPress={() => void createClipAtPlayhead()}
              className="rounded-lg border border-border bg-surface px-3 py-1.5"
            >
              <Text className="text-xs font-semibold text-foreground">New clip</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4">
          {clips.map((item) => {
            const selected = item.id === activeClipId;
            return (
              <Pressable
                key={item.id}
                onPress={() => playClip(item)}
                className={`rounded-lg border px-3 py-2 ${
                  selected ? 'border-accent bg-accent/10' : 'border-border bg-surface'
                }`}
              >
                <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                  {item.name ?? 'Clip'}
                </Text>
                <Text className="text-xs text-muted">
                  {formatTime(item.start_time ?? 0)} – {formatTime(item.end_time ?? 0)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

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
          if (!activeClipId) return;
          void (async () => {
            await updateClipSubtitleSettings(activeClipId, enabled, presetId, settings);
            setSubtitleSettings(settings);
            const { queueProjectSync } = await import('@/services/cloudSync');
            void queueProjectSync(projectId);
          })();
        }}
      />

      <TextBoxSheet
        visible={showTextBoxSheet}
        state={textBox}
        clipDuration={(activeClip?.duration ?? activeClip?.end_time ?? 0) - clipStart}
        onClose={() => setShowTextBoxSheet(false)}
        onSave={(state) => {
          if (!activeClipId) return;
          void (async () => {
            await updateClipTextOverlay(activeClipId, state);
            setTextBox(state);
            const { queueProjectSync } = await import('@/services/cloudSync');
            void queueProjectSync(projectId);
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

      <ClipDetectionSheet
        visible={showDetectSheet}
        videoDuration={player.duration ?? 0}
        starting={aiBusy}
        onClose={() => {
          if (!aiBusy) setShowDetectSheet(false);
        }}
        onConfirm={(plan) => void confirmDetect(plan)}
      />

    </View>
  );
}

export default function ProjectDetailScreen() {
  const { id, detect } = useLocalSearchParams<{ id: string; detect?: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [hasTranscript, setHasTranscript] = useState(false);
  const [transcriptJson, setTranscriptJson] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadWorkspace(options?: { silent?: boolean }) {
    if (!id) return;
    if (!options?.silent) setLoading(true);
    try {
      const [projectRow, rawVideo, transcript, clipRows] = await Promise.all([
        getProject(id),
        getRawVideoByProjectId(id),
        getTranscriptByProjectId(id),
        getClipsByProjectId(id),
      ]);
      setProject(projectRow);
      setVideoPath(rawVideo?.file_path ?? null);
      setHasTranscript(!!transcript);
      setTranscriptJson(transcript?.raw_json ?? null);
      setClips(clipRows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [id]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 bg-background">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={tokens.colors.accent} />
          </View>
        ) : !videoPath || !project || !id ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-muted">Video file is missing from device storage.</Text>
          </View>
        ) : (
          <ProjectWorkspace
            projectId={id}
            project={project}
            videoPath={videoPath}
            clips={clips}
            hasTranscript={hasTranscript}
            transcriptJson={transcriptJson}
            openDetectInitially={detect === '1'}
            onRefresh={() => loadWorkspace({ silent: true })}
          />
        )}
      </View>
    </>
  );
}
