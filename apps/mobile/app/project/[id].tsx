import { useEventListener } from 'expo';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/button';
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
import {
  getClipSegmentsByClipId,
  getClipSubtitleSettings,
  getClipTextOverlay,
  getClipsByProjectId,
  getProject,
  getRawVideoByProjectId,
  getTranscriptByProjectId,
  updateClipSubtitleSettings,
  updateClipTextOverlay,
} from '@/services/database';
import { transcriptWordsForClip } from '@/lib/subtitleVisibleWords';
import { tokens } from '@/theme/tokens';
import { CloudVodSettings } from '@/components/sync/CloudVodSettings';

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
  onRefresh,
}: {
  projectId: string;
  project: Project;
  videoPath: string;
  clips: Clip[];
  hasTranscript: boolean;
  transcriptJson: string | null;
  onRefresh: () => Promise<void>;
}) {
  const router = useRouter();
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
  const segmentEndRef = useRef<number | null>(null);
  const [playheadTime, setPlayheadTime] = useState(0);

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
    if (!activeClipId && clips[0]?.id) {
      setActiveClipId(clips[0].id);
    }
  }, [clips, activeClipId]);

  async function runTranscribe() {
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

  async function runDetect() {
    setAiBusy(true);
    const pipeline = new AiPipeline(setAiProgress);
    try {
      await pipeline.detectClips(projectId);
      await onRefresh();
    } catch (error) {
      setAiProgress({
        stage: 'error',
        progress: 0,
        message: 'Detection failed',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setAiBusy(false);
    }
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

  async function handleExport(options: {
    ratios: ('9:16' | '16:9')[];
    remuxOnly: boolean;
  }) {
    if (!activeClipId) return;
    setExportProgress({ state: 'building', progress: 0, message: 'Starting...' });
    try {
      await buildClipExport(activeClipId, projectId, {
        ratios: options.ratios,
        remuxOnly: options.remuxOnly,
        onProgress: setExportProgress,
      });
    } catch (error) {
      if ((error as Error).message !== 'Export cancelled') {
        Alert.alert('Export failed', error instanceof Error ? error.message : String(error));
      }
    }
  }

  return (
    <>
      <View className="relative">
        <VideoView
          player={player}
          style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}
          nativeControls={false}
          contentFit="contain"
        />
        {subtitleSettings?.enabled && activeClip ? (
          <SubtitleOverlay
            settings={subtitleSettings}
            words={subtitleWords}
            currentTime={clipRelativeTime}
            targetRatio="9:16"
          />
        ) : null}
        {textBox?.enabled ? (
          <TextBoxOverlay
            state={textBox}
            currentTime={clipRelativeTime}
            frameWidth={360}
            onPositionChange={(x, y) => {
              const next = upsertClipTextPerRatioGeometry(textBox, '9:16', {
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

      <View className="flex-row items-center justify-between px-4 py-2">
        <Text className="text-sm text-muted">{formatTime(player.currentTime)}</Text>
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => {
              segmentEndRef.current = null;
              if (player.playing) player.pause();
              else player.play();
            }}
          >
            <Text className="text-primary">{player.playing ? 'Pause' : 'Play'}</Text>
          </Pressable>
          <Pressable onPress={() => player.seekBy(-10)}>
            <Text className="text-foreground">-10s</Text>
          </Pressable>
          <Pressable onPress={() => player.seekBy(10)}>
            <Text className="text-foreground">+10s</Text>
          </Pressable>
        </View>
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
      ) : null}

      <View className="flex-row flex-wrap gap-2 border-t border-border px-4 py-2">
        <Pressable
          onPress={() => router.push(`/framing/${projectId}`)}
          className="rounded bg-surface px-3 py-2"
        >
          <Text className="text-xs text-primary">Framing</Text>
        </Pressable>
        <Pressable onPress={() => setShowSubtitleSheet(true)} className="rounded bg-surface px-3 py-2">
          <Text className="text-xs text-primary">Subtitles</Text>
        </Pressable>
        <Pressable onPress={() => setShowTextBoxSheet(true)} className="rounded bg-surface px-3 py-2">
          <Text className="text-xs text-primary">Text</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowExportSheet(true)}
          disabled={!activeClipId}
          className="rounded bg-surface px-3 py-2"
        >
          <Text className="text-xs text-primary">Export</Text>
        </Pressable>
      </View>

      <View className="border-t border-border px-4 py-3">
        <CloudVodSettings projectId={projectId} />
      </View>

      <View className="border-t border-border px-4 py-3">
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button title="Transcribe" onPress={() => void runTranscribe()} disabled={aiBusy || hasTranscript} />
          </View>
          <View className="flex-1">
            <Button
              title="Detect clips"
              variant="outline"
              onPress={() => void runDetect()}
              disabled={aiBusy || !hasTranscript}
            />
          </View>
        </View>
        {aiProgress ? (
          <Text className="mt-2 text-xs text-muted">
            {aiProgress.message}
            {aiProgress.error ? ` — ${aiProgress.error}` : ''}
          </Text>
        ) : null}
      </View>

      <View className="flex-1 border-t border-border px-4 py-3">
        <Text className="mb-2 text-sm font-semibold text-foreground">
          {project.name} · Clips {clips.length > 0 ? `(${clips.length})` : ''}
        </Text>
        <FlatList
          data={clips}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text className="text-sm text-muted">
              {hasTranscript ? 'Run detect clips to populate this list.' : 'Transcribe first, then detect clips.'}
            </Text>
          }
          renderItem={({ item }) => {
            const selected = item.id === activeClipId;
            return (
              <Pressable
                className={`mb-2 rounded-lg border px-3 py-3 ${
                  selected ? 'border-primary bg-primary/10' : 'border-border bg-surface'
                }`}
                onPress={() => playClip(item)}
              >
                <Text className="font-medium text-foreground">{item.name ?? 'Clip'}</Text>
                <Text className="mt-1 text-xs text-muted">
                  {formatTime(item.start_time ?? 0)} – {formatTime(item.end_time ?? 0)}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

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
    </>
  );
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [hasTranscript, setHasTranscript] = useState(false);
  const [transcriptJson, setTranscriptJson] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadWorkspace() {
    if (!id) return;
    setLoading(true);
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
      <Stack.Screen options={{ title: project?.name ?? 'Project' }} />
      <View className="flex-1 bg-background">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={tokens.colors.primary} />
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
            onRefresh={loadWorkspace}
          />
        )}
      </View>
    </>
  );
}
