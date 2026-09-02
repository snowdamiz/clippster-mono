import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ClipActionSheet } from '@/components/workspace/ClipActionSheet';
import { ClipDetectionSheet, type ClipDetectionPlan } from '@/components/editor/ClipDetectionSheet';
import { ClipListCard } from '@/components/workspace/ClipListCard';
import { VodPreview } from '@/components/workspace/VodPreview';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import type { Project } from '@clippster/shared-types';
import { AiPipeline, type AiPipelineProgress } from '@/services/aiPipeline';
import {
  addManualClip,
  deleteClip,
  getClipsByProjectId,
  getProject,
  getProjectClipRows,
  getRawVideoByProjectId,
  getTranscriptByProjectId,
  updateClipBuiltThumbnail,
  updateClipSubtitleSettings,
  updateRawVideoFilePath,
  type ProjectClipRow,
} from '@/services/database';
import { generateMissingClipThumbnails } from '@/services/clipThumbnailGeneration';
import { ensurePlayableVideo } from '@/services/ensurePlayableVideo';
import { useAccount } from '@/context/AccountContext';
import { settingsFromPresetId } from '@/lib/captionPresets';
import { tokens } from '@/theme/tokens';
import { appAlert } from '@/lib/appAlert';

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { requireSubscription } = useAccount();
  const { id, detect } = useLocalSearchParams<{ id: string; detect?: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [projectThumbnail, setProjectThumbnail] = useState<string | null>(null);
  const [clips, setClips] = useState<ProjectClipRow[]>([]);
  const [hasTranscript, setHasTranscript] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiProgress, setAiProgress] = useState<AiPipelineProgress | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [showDetectSheet, setShowDetectSheet] = useState(false);
  const [menuClip, setMenuClip] = useState<ProjectClipRow | null>(null);
  const [playheadTime, setPlayheadTime] = useState(0);
  const aiPipelineRef = useRef<AiPipeline | null>(null);
  const openedDetectRef = useRef(false);
  const thumbGenRef = useRef(false);

  const loadWorkspace = useCallback(async (options?: { silent?: boolean }) => {
    if (!id) return;
    if (!options?.silent) setLoading(true);
    try {
      const [projectRow, rawVideo, transcript] = await Promise.all([
        getProject(id),
        getRawVideoByProjectId(id),
        getTranscriptByProjectId(id),
      ]);
      let clipRows: ProjectClipRow[] = [];
      try {
        clipRows = await getProjectClipRows(id);
      } catch (error) {
        console.warn('[Project] getProjectClipRows failed, falling back', error);
        const fallback = await getClipsByProjectId(id);
        clipRows = fallback.map((clip) => ({
          id: clip.id,
          name: clip.name,
          start_time: clip.start_time,
          end_time: clip.end_time,
          duration: clip.duration,
          virality_score: null,
          confidence_score: null,
          detection_reason: null,
          built_thumbnail_path: null,
          thumbnail_path: null,
        }));
      }
      let vodPath = rawVideo?.file_path ?? null;
      if (vodPath && !vodPath.startsWith('pending://')) {
        const playable = await ensurePlayableVideo(vodPath);
        if (playable !== vodPath) {
          await updateRawVideoFilePath(id, playable);
          vodPath = playable;
        }
      }
      setProject(projectRow);
      setVideoPath(vodPath);
      setVideoDuration(rawVideo?.duration ?? 0);
      setProjectThumbnail(rawVideo?.thumbnail_path ?? projectRow?.thumbnail_path ?? null);
      setHasTranscript(!!transcript);
      setClips(clipRows);

      if (vodPath && !vodPath.startsWith('pending://') && clipRows.some((c) => !c.built_thumbnail_path)) {
        void (async () => {
          if (thumbGenRef.current) return;
          thumbGenRef.current = true;
          try {
            const saved = await generateMissingClipThumbnails(vodPath, clipRows, async (clipId, path) => {
              await updateClipBuiltThumbnail(clipId, path);
            });
            if (saved > 0) {
              const refreshed = await getProjectClipRows(id);
              setClips(refreshed);
            }
          } finally {
            thumbGenRef.current = false;
          }
        })();
      }
    } catch (error) {
      console.warn('[Project] failed to load workspace', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadWorkspace({ silent: true });
    }, [loadWorkspace]),
  );

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
    if (detect !== '1' || openedDetectRef.current || loading || !videoPath) return;
    openedDetectRef.current = true;
    void openDetectSheet();
  }, [detect, loading, openDetectSheet, videoPath]);

  async function confirmDetect(plan: ClipDetectionPlan) {
    if (!id) return;
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
    aiPipelineRef.current = pipeline;
    try {
      if (!hasTranscript) {
        await pipeline.transcribeProject(id);
        await loadWorkspace({ silent: true });
      }
      const found = await pipeline.detectClips(id, {
        prompt: plan.prompt.content,
        startTime: plan.startTime,
        endTime: plan.endTime,
      });
      await loadWorkspace({ silent: true });

      if (plan.subtitlesEnabled) {
        const detected = await getProjectClipRows(id);
        const settings = settingsFromPresetId(plan.subtitlePresetId);
        settings.enabled = true;
        await Promise.all(
          detected.map((clip) =>
            updateClipSubtitleSettings(clip.id, true, plan.subtitlePresetId, settings),
          ),
        );
      }
      if (found === 0) {
        appAlert('No clips found', 'Try a different prompt or a wider time range.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Cancelled') {
        setAiProgress({ stage: 'idle', progress: 0, message: 'Cancelled' });
      } else {
        setAiProgress({
          stage: 'error',
          progress: 0,
          message: 'Detection failed',
          error: message,
        });
        appAlert('Detection failed', message);
      }
    } finally {
      aiPipelineRef.current = null;
      setAiBusy(false);
    }
  }

  function cancelAi() {
    aiPipelineRef.current?.cancel();
    setAiProgress({ stage: 'idle', progress: 0, message: 'Cancelling…' });
  }

  async function createClip() {
    if (!id || !videoPath) return;
    const duration = videoDuration > 0 ? videoDuration : playheadTime + 30;
    const start = Math.max(0, playheadTime);
    const end = Math.min(duration, start + 30);
    try {
      const clipId = await addManualClip(id, videoPath, start, end > start ? end : start + 30);
      const { queueProjectSync } = await import('@/services/cloudSync');
      void queueProjectSync(id);
      await loadWorkspace({ silent: true });
      router.push({ pathname: '/clip/[id]', params: { id: clipId } });
    } catch (error) {
      appAlert('Could not create clip', error instanceof Error ? error.message : String(error));
    }
  }

  function openClip(clipId: string) {
    router.push({ pathname: '/clip/[id]', params: { id: clipId } });
  }

  function handleDeleteClip(clip: ProjectClipRow) {
    appAlert('Delete clip', `Delete “${clip.name || 'Untitled Clip'}”? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteClip(clip.id);
            const { queueProjectSync } = await import('@/services/cloudSync');
            if (id) void queueProjectSync(id);
            await loadWorkspace({ silent: true });
          })();
        },
      },
    ]);
  }

  const detecting = aiBusy && clips.length === 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 bg-background">
        {loading ? (
          <View className="flex-1 items-center justify-center px-6">
            <ActivityIndicator color={tokens.colors.accent} />
            <Text className="mt-3 text-center text-xs text-muted">Preparing video for playback…</Text>
          </View>
        ) : !videoPath || !project || !id ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-muted">Video file is missing from device storage.</Text>
          </View>
        ) : (
          <>
            <ScreenHeader
              title={project.name}
              subtitle={
                clips.length > 0
                  ? `${clips.length} clip${clips.length === 1 ? '' : 's'} detected`
                  : 'No clips yet'
              }
              showBack
            />

            <VodPreview
              videoPath={videoPath}
              onTimeChange={setPlayheadTime}
              onDurationChange={(seconds) => {
                if (seconds > 0) setVideoDuration(seconds);
              }}
            />

            {aiProgress && !detecting ? (
              <View className="flex-row items-center gap-3 border-b border-border px-4 py-2">
                <View className="flex-1">
                  <View className="h-1 overflow-hidden rounded-full bg-white/5">
                    <View
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(aiProgress.progress, 5)}%` }}
                    />
                  </View>
                  <Text className="mt-1 text-[10px] text-muted" numberOfLines={1}>
                    {aiProgress.message}
                    {aiProgress.error ? ` — ${aiProgress.error}` : ''}
                  </Text>
                </View>
                {aiBusy ? (
                  <Pressable onPress={cancelAi} className="rounded-lg border border-border px-3 py-1.5">
                    <Text className="text-xs font-semibold text-foreground">Cancel</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {detecting ? (
              <View className="flex-1 items-center justify-center px-6">
                <View className="mb-4 h-10 w-10 items-center justify-center rounded-full border border-border bg-surface">
                  <ActivityIndicator color={tokens.colors.accent} />
                </View>
                <Text className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Detecting clips
                </Text>
                <Text className="mt-2 max-w-[240px] text-center text-xs text-muted">
                  {aiProgress?.message ?? 'Analyzing your video…'}
                </Text>
                <View className="mt-5 h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
                  <View
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(aiProgress?.progress ?? 0, 5)}%` }}
                  />
                </View>
                <Pressable
                  onPress={cancelAi}
                  className="mt-4 flex-row items-center gap-1.5 rounded-md px-2.5 py-1.5"
                >
                  <Ionicons name="stop-circle-outline" size={14} color={tokens.colors.muted} />
                  <Text className="text-[11px] font-medium text-muted">Cancel</Text>
                </Pressable>
              </View>
            ) : clips.length > 0 ? (
              <ScrollView
                className="flex-1"
                contentContainerClassName="gap-3 px-4 py-4 pb-10"
                showsVerticalScrollIndicator={false}
              >
                <View className="mb-1 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="h-1.5 w-1.5 rounded-full bg-accent" />
                    <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Detected
                    </Text>
                    <Text className="text-[10px] text-muted">{clips.length}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => void createClip()}
                      className="rounded-md border border-border bg-surface px-2.5 py-1"
                    >
                      <Text className="text-[11px] font-semibold text-foreground">Add</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void openDetectSheet()}
                      disabled={aiBusy}
                      className="flex-row items-center gap-1 rounded-md bg-primary px-2.5 py-1"
                    >
                      <Ionicons name="sparkles" size={11} color={tokens.colors.primaryForeground} />
                      <Text className="text-[11px] font-semibold text-primary-foreground">Detect</Text>
                    </Pressable>
                  </View>
                </View>
                {clips.map((clip, index) => (
                  <ClipListCard
                    key={clip.id}
                    clip={clip}
                    index={index + 1}
                    fallbackThumbnail={projectThumbnail}
                    onPress={() => openClip(clip.id)}
                    onMore={() => setMenuClip(clip)}
                  />
                ))}
              </ScrollView>
            ) : (
              <View className="flex-1 items-center justify-center px-6">
                <View className="mb-6 h-16 w-16 items-center justify-center rounded-xl border border-accent/25 bg-accent/15">
                  <Ionicons name="videocam-outline" size={28} color={tokens.colors.accent} />
                </View>
                <Text className="text-sm font-semibold text-foreground">No Clips Yet</Text>
                <Text className="mt-2 max-w-[220px] text-center text-xs leading-relaxed text-muted">
                  Start detecting clips from your video using AI-powered analysis
                </Text>
                <View className="mt-6 gap-2">
                  <Button
                    title="Detect Clips"
                    onPress={() => void openDetectSheet()}
                    disabled={aiBusy}
                  />
                  <Button title="Add Clip" variant="outline" onPress={() => void createClip()} />
                </View>
              </View>
            )}

            <ClipActionSheet
              visible={menuClip != null}
              clipName={menuClip?.name || 'Untitled Clip'}
              onClose={() => setMenuClip(null)}
              onOpen={() => {
                if (!menuClip) return;
                const clipId = menuClip.id;
                setMenuClip(null);
                openClip(clipId);
              }}
              onEdit={() => {
                if (!menuClip) return;
                const clipId = menuClip.id;
                setMenuClip(null);
                router.push({ pathname: '/edit/[kind]/[id]', params: { kind: 'clip', id: clipId } });
              }}
              onDelete={() => {
                if (!menuClip) return;
                const clip = menuClip;
                setMenuClip(null);
                handleDeleteClip(clip);
              }}
            />

            <ClipDetectionSheet
              visible={showDetectSheet}
              videoDuration={videoDuration}
              starting={aiBusy}
              onClose={() => {
                if (!aiBusy) setShowDetectSheet(false);
              }}
              onConfirm={(plan) => void confirmDetect(plan)}
            />
          </>
        )}
      </View>
    </>
  );
}
