import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EffectsSheet } from '@/components/editor/EffectsSheet';
import { ExportSheet } from '@/components/export/ExportSheet';
import { CaptionStylePanel } from '@/components/subtitles/CaptionStylePanel';
import { AddMediaSheet, type MediaAddRequest } from '@/components/timeline/AddMediaSheet';
import { EditorToolDock } from '@/components/timeline/EditorToolDock';
import { FilmstripTimeline } from '@/components/timeline/FilmstripTimeline';
import { MusicPlayer, PreviewStage } from '@/components/timeline/PreviewStage';
import { VideoThumbnailProvider } from '@/components/media/HiddenThumbnailPlayer';
import { VideoPlayerControls } from '@/components/editor/VideoPlayerControls';
import { useSmoothClock } from '@/hooks/useSmoothClock';
import { settingsFromPresetId } from '@/lib/captionPresets';
import { transcriptWordsFromRaw } from '@/lib/subtitleVisibleWords';
import { pickEditorAudio, pickEditorImage, pickEditorVideo, recordEditorVideo } from '@/lib/timeline/editorMedia';
import {
  activeAudio,
  addAudioToTimeline,
  addImageToTimeline,
  addVideoToTimeline,
  cloneDoc,
  createEditDocument,
  createVideoClip,
  cycleTransition,
  deleteTimelineItem,
  mapWordsToTimeline,
  remainingTimeline,
  resolveTimelineTime,
  setCaptions,
  setClipEffect,
  setClipSpeed,
  setTransitionIn,
  setVideoMuted,
  sourceRanges,
  splitAtPlayhead,
  timelineDuration,
  timelineTimeForSource,
  trimTimelineVideo,
  updateOverlay,
  withSourceDuration,
  type EditDocument,
} from '@/lib/timeline/editDocument';
import { loadEditDocument, saveEditDocument } from '@/lib/timeline/editStorage';
import {
  addManualClip,
  getClipById,
  getClipSegmentsByClipId,
  getClipSubtitleSettings,
  getProject,
  getRawVideoByProjectId,
  getTranscriptByProjectId,
  replaceClipSegments,
  updateClipSubtitleSettings,
} from '@/services/database';
import type { ClipBuildProgress } from '@/services/clipBuildPipeline';
import { buildTimelineExport } from '@/services/timelineExport';
import { parseSubtitleSettings } from '@clippster/shared-types';
import { appAlert } from '@/lib/appAlert';

export default function TimelineEditorScreen() {
  const router = useRouter();
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const editKind = kind === 'clip' ? 'clip' : 'project';
  const [doc, setDoc] = useState<EditDocument | null>(null);
  const [title, setTitle] = useState('Edit');
  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<ReturnType<typeof transcriptWordsFromRaw>>([]);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [sourceDuration, setSourceDuration] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const stored = await loadEditDocument(editKind, id);

      if (editKind === 'clip') {
        const clip = await getClipById(id);
        if (!clip) throw new Error('Clip not found');
        const projectId = clip.project_id ?? '';
        const [project, raw, segments, transcript, storedSettings] = await Promise.all([
          projectId ? getProject(projectId) : Promise.resolve(null),
          projectId ? getRawVideoByProjectId(projectId) : Promise.resolve(null),
          getClipSegmentsByClipId(id),
          projectId ? getTranscriptByProjectId(projectId) : Promise.resolve(null),
          getClipSubtitleSettings(id),
        ]);
        setTitle(clip.name || project?.name || 'Clip');
        setWords(transcriptWordsFromRaw(transcript?.raw_json));
        setSourcePath(raw?.file_path || clip.file_path);
        setSourceDuration(raw?.duration ?? clip.duration ?? 0);
        const start = clip.start_time ?? 0;
        const end = clip.end_time ?? start + 30;
        const path = raw?.file_path || clip.file_path;
        const sourceDuration = raw?.duration ?? clip.duration ?? end;
        const presetId = clip.subtitle_preset_id || storedSettings?.selectedPresetId || 'tiktok-bold';
        const created =
          stored ??
          createEditDocument({
            kind: 'clip',
            targetId: id,
            projectId: projectId || undefined,
            sourcePath: path,
            sourceDuration,
            sourceStart: start,
            sourceEnd: end,
            videos:
              segments.length > 0
                ? segments.map((segment) =>
                    createVideoClip({
                      sourceKind: 'clip',
                      sourcePath: path,
                      sourceDuration,
                      sourceStart: segment.start_time,
                      sourceEnd: segment.end_time,
                      sourceId: id,
                      label: clip.name ?? 'Clip',
                    }),
                  )
                : undefined,
            captions: {
              enabled: clip.subtitle_enabled == null ? true : clip.subtitle_enabled !== 0,
              presetId,
              settings:
                storedSettings ??
                parseSubtitleSettings(clip.subtitle_settings) ??
                settingsFromPresetId(presetId),
            },
          });
        created.captions.settings.enabled = created.captions.enabled;
        setDoc(created);
        return;
      }

      const [project, raw, transcript] = await Promise.all([
        getProject(id),
        getRawVideoByProjectId(id),
        getTranscriptByProjectId(id),
      ]);
      if (!project || !raw?.file_path) throw new Error('Project video not found');
      setTitle(project.name);
      setWords(transcriptWordsFromRaw(transcript?.raw_json));
      setSourcePath(raw.file_path);
      setSourceDuration(raw.duration ?? 0);
      const created =
        stored ??
        createEditDocument({
          kind: 'project',
          targetId: id,
          projectId: id,
          sourcePath: raw.file_path,
          sourceDuration: raw.duration ?? 0,
        });
      created.captions.settings.enabled = created.captions.enabled;
      setDoc(created);
    } catch (error) {
      appAlert('Could not open editor', error instanceof Error ? error.message : String(error));
      router.back();
    } finally {
      setLoading(false);
    }
  }, [editKind, id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !doc) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#fafafa" />
      </View>
    );
  }

  return (
    <TimelineEditor
      doc={doc}
      title={title}
      words={words}
      sourcePath={sourcePath}
      sourceDuration={sourceDuration}
      onDocChange={setDoc}
    />
  );
}

function TimelineEditor({
  doc,
  title,
  words,
  sourcePath,
  sourceDuration,
  onDocChange,
}: {
  doc: EditDocument;
  title: string;
  words: ReturnType<typeof transcriptWordsFromRaw>;
  sourcePath: string | null;
  sourceDuration: number;
  onDocChange: (doc: EditDocument) => void;
}) {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [seekKey, setSeekKey] = useState(0);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(24);
  const [mediaTime, setMediaTime] = useState(0);
  const { time: playhead, seek } = useSmoothClock({
    playing,
    duration: timelineDuration(doc),
    onEnd: () => setPlaying(false),
  });
  const [selectedId, setSelectedId] = useState<string | null>(doc.videos[0]?.id ?? null);
  const [selectedKind, setSelectedKind] = useState<'video' | 'image' | 'audio' | 'cut'>('video');
  const [captionsSelected, setCaptionsSelected] = useState(false);
  const [panel, setPanel] = useState<'tools' | 'captions'>('tools');
  const [showAdd, setShowAdd] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportProgress, setExportProgress] = useState<ClipBuildProgress | null>(null);
  const trimSession = useRef(false);
  const historyRef = useRef<{ past: EditDocument[]; future: EditDocument[] }>({ past: [], future: [] });
  const [, setHistoryEpoch] = useState(0);

  const resolved = resolveTimelineTime(doc, mediaTime);
  const music = activeAudio(doc, mediaTime);
  const wordsBySource = useMemo(
    () => (sourcePath ? { [sourcePath]: words } : {}),
    [sourcePath, words],
  );
  const timelineWords = useMemo(() => mapWordsToTimeline(doc, wordsBySource), [doc, wordsBySource]);

  const commit = useCallback(
    (next: EditDocument) => {
      historyRef.current.past.push(cloneDoc(doc));
      historyRef.current.future = [];
      setHistoryEpoch((value) => value + 1);
      onDocChange(next);
    },
    [doc, onDocChange],
  );

  function undo() {
    const previous = historyRef.current.past.pop();
    if (!previous) return;
    historyRef.current.future.push(cloneDoc(doc));
    setHistoryEpoch((value) => value + 1);
    onDocChange(previous);
  }

  function redo() {
    const next = historyRef.current.future.pop();
    if (!next) return;
    historyRef.current.past.push(cloneDoc(doc));
    setHistoryEpoch((value) => value + 1);
    onDocChange(next);
  }

  const seekTimeline = useCallback(
    (timelineTime: number) => {
      const nextTime = Math.max(0, Math.min(timelineTime, timelineDuration(doc)));
      const next = resolveTimelineTime(doc, nextTime);
      setMediaTime(nextTime);
      seek(nextTime);
      if (next) setSelectedId(next.clip.id);
      setSeekKey((value) => value + 1);
    },
    [doc, seek],
  );

  function handleVideoTime(sourceTime: number) {
    if (!resolved) return;
    if (sourceTime >= resolved.clip.sourceEnd - 0.05) {
      const nextIndex = resolved.clipIndex + 1;
      const next = doc.videos[nextIndex];
      if (next) {
        const nextTime = timelineTimeForSource(doc, nextIndex, next.sourceStart);
        setMediaTime(nextTime);
        seek(nextTime);
        setSelectedId(next.id);
        setSeekKey((value) => value + 1);
      } else {
        const end = timelineDuration(doc);
        setPlaying(false);
        setMediaTime(end);
        seek(end);
      }
      return;
    }
    const nextTime = timelineTimeForSource(doc, resolved.clipIndex, sourceTime);
    setMediaTime(nextTime);
    seek(nextTime);
  }

  async function handleSave(): Promise<EditDocument | null> {
    setSaving(true);
    try {
      const ranges = sourceRanges(doc);
      let next = { ...doc };
      const first = doc.videos[0];
      if (doc.kind === 'clip') {
        await replaceClipSegments(doc.targetId, ranges);
        await updateClipSubtitleSettings(
          doc.targetId,
          doc.captions.enabled,
          doc.captions.presetId,
          doc.captions.settings,
        );
      } else if (first) {
        const clipId =
          doc.linkedClipId ??
          (await addManualClip(doc.targetId, first.sourcePath, ranges[0].start_time, ranges[0].end_time, `${title} edit`));
        await replaceClipSegments(clipId, ranges);
        await updateClipSubtitleSettings(
          clipId,
          doc.captions.enabled,
          doc.captions.presetId,
          doc.captions.settings,
        );
        next = { ...doc, linkedClipId: clipId };
      }
      await saveEditDocument(next);
      onDocChange(next);
      return next;
    } catch (error) {
      appAlert('Could not save edit', error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function addImportedVideo(picked: { path: string; duration: number; label: string }, kind: 'upload' | 'vod') {
    commit(
      addVideoToTimeline(
        doc,
        createVideoClip({
          sourceKind: kind,
          sourcePath: picked.path,
          sourceDuration: picked.duration,
          sourceStart: 0,
          sourceEnd: picked.duration || Math.min(30, remainingTimeline(doc) || 30),
          label: picked.label,
        }),
      ),
    );
  }

  async function handleAdd(request: MediaAddRequest) {
    try {
      if (request.type === 'source-range') {
        commit(
          addVideoToTimeline(
            doc,
            createVideoClip({
              sourceKind: 'upload',
              sourcePath: request.sourcePath,
              sourceDuration: request.sourceDuration,
              sourceStart: request.sourceStart,
              sourceEnd: request.sourceEnd,
              label: request.label,
            }),
          ),
        );
        return;
      }
      if (request.type === 'record-video') {
        const picked = await recordEditorVideo();
        if (picked) await addImportedVideo(picked, 'upload');
        return;
      }
      if (request.type === 'clip') {
        const raw = request.clip.project_id ? await getRawVideoByProjectId(request.clip.project_id) : null;
        commit(
          addVideoToTimeline(
            doc,
            createVideoClip({
              sourceKind: 'clip',
              sourcePath: raw?.file_path || request.clip.file_path,
              sourceDuration: raw?.duration ?? request.clip.end_time ?? 0,
              sourceStart: request.clip.start_time ?? 0,
              sourceEnd: request.clip.end_time ?? request.clip.start_time ?? 0,
              sourceId: request.clip.id,
              label: request.clip.name ?? 'Clip',
            }),
          ),
        );
        return;
      }
      if (request.type === 'build') {
        commit(
          addVideoToTimeline(
            doc,
            createVideoClip({
              sourceKind: 'build',
              sourcePath: request.item.build.file_path,
              sourceDuration: request.item.build.duration ?? 0,
              sourceStart: 0,
              sourceEnd: request.item.build.duration ?? 0,
              sourceId: request.item.build.id,
              label: request.item.clipName,
            }),
          ),
        );
        return;
      }
      if (request.type === 'upload-video') {
        const picked = await pickEditorVideo();
        if (picked) await addImportedVideo(picked, 'upload');
        return;
      }
      if (request.type === 'upload-image') {
        const picked = await pickEditorImage();
        if (!picked) return;
        commit(addImageToTimeline(doc, { sourcePath: picked.path, label: picked.label, timelineStart: playhead }));
        return;
      }
      const picked = await pickEditorAudio();
      if (!picked) return;
      commit(
        addAudioToTimeline(doc, {
          sourcePath: picked.path,
          sourceDuration: 0,
          label: picked.label,
          timelineStart: playhead,
        }),
      );
    } catch (error) {
      appAlert('Could not add media', error instanceof Error ? error.message : String(error));
    }
  }

  const selectedVideo = selectedKind === 'video' || selectedKind === 'cut'
    ? doc.videos.find((clip) => clip.id === selectedId) ?? null
    : null;
  const transitionClip =
    selectedKind === 'cut'
      ? selectedVideo
      : selectedVideo && doc.videos[0]?.id !== selectedVideo.id
        ? selectedVideo
        : null;
  const videoWidth = windowWidth;
  const videoHeight = Math.min(windowHeight * 0.34, videoWidth * (9 / 16));
  const total = timelineDuration(doc);
  const canSplit = useMemo(() => {
    if (!resolved) return false;
    const left = resolved.sourceTime - resolved.clip.sourceStart;
    const right = resolved.clip.sourceEnd - resolved.sourceTime;
    return left >= 0.5 && right >= 0.5;
  }, [resolved]);

  return (
    <VideoThumbnailProvider paths={doc.videos.map((clip) => clip.sourcePath)}>
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-2">
          <Pressable onPress={() => router.back()} className="py-1">
            <Text className="text-sm font-medium text-accent">← Back</Text>
          </Pressable>
          <Text className="flex-1 text-center text-base font-semibold text-foreground" numberOfLines={1}>
            {title}
          </Text>
          <View className="flex-row items-center gap-2">
            <Pressable onPress={() => void handleSave()} disabled={saving} className="rounded-lg border border-border px-3 py-1.5">
              <Text className="text-sm font-semibold text-foreground">{saving ? 'Saving' : 'Save'}</Text>
            </Pressable>
            <Pressable onPress={() => setShowExport(true)} className="rounded-lg bg-primary px-3 py-1.5">
              <Text className="text-sm font-semibold text-primary-foreground">Export</Text>
            </Pressable>
          </View>
        </View>

        <View className="items-center bg-black">
          <PreviewStage
            key={`${resolved?.clip.id ?? 'none'}-${seekKey}`}
            doc={doc}
            video={resolved?.clip ?? null}
            sourceTime={resolved?.sourceTime ?? 0}
            timelineTime={playhead}
            playing={playing}
            words={timelineWords}
            width={videoWidth}
            height={videoHeight}
            captionsSelected={captionsSelected}
            selectedImageId={selectedKind === 'image' ? selectedId : null}
            onTimeUpdate={handleVideoTime}
            onDuration={(duration) => {
              if (!resolved || resolved.clip.sourceDuration > 0) return;
              onDocChange(withSourceDuration(doc, resolved.clip.sourcePath, duration));
            }}
            onCaptionSelect={() => {
              setCaptionsSelected(true);
              setPanel('captions');
              setSelectedId(null);
            }}
            onCaptionChange={(settings) => {
              onDocChange(setCaptions(doc, { enabled: true, presetId: doc.captions.presetId, settings }));
            }}
            onSelectImage={(id) => {
              setSelectedId(id);
              setSelectedKind('image');
              setCaptionsSelected(false);
              setPanel('tools');
            }}
            onImageChange={(id, patch) => onDocChange(updateOverlay(doc, id, patch))}
          />
          {music ? (
            <MusicPlayer
              key={`${music.id}-${seekKey}`}
              path={music.sourcePath}
              sourceTime={music.sourceStart + (mediaTime - music.timelineStart)}
              volume={music.volume}
              playing={playing}
            />
          ) : null}
        </View>

        <VideoPlayerControls
          currentTime={playhead}
          duration={total}
          playing={playing}
          onSeek={seekTimeline}
          onSeekBy={(delta) => seekTimeline(playhead + delta)}
          onTogglePlay={() => setPlaying((value) => !value)}
        />

        <Text className="px-4 pb-1 text-[10px] text-muted">
          Timeline {formatClock(total)} / 2:00 · {formatClock(remainingTimeline(doc))} left
        </Text>

        <FilmstripTimeline
          doc={doc}
          playhead={playhead}
          pixelsPerSecond={pixelsPerSecond}
          selectedId={selectedId}
          onSelect={(id, kind) => {
            setSelectedId(id);
            setSelectedKind(kind);
            setCaptionsSelected(false);
            setPanel('tools');
          }}
          onSeek={seekTimeline}
          onTrimVideo={(clipId, edge, sourceTime) => {
            if (!trimSession.current) {
              historyRef.current.past.push(cloneDoc(doc));
              historyRef.current.future = [];
              trimSession.current = true;
              setHistoryEpoch((value) => value + 1);
            }
            onDocChange(trimTimelineVideo(doc, clipId, edge, sourceTime));
          }}
          onTrimEnd={() => {
            trimSession.current = false;
          }}
          onPixelsPerSecondChange={setPixelsPerSecond}
        />

        {panel === 'captions' ? (
          <View className="flex-1">
            <CaptionStylePanel
              enabled={doc.captions.enabled}
              presetId={doc.captions.presetId}
              settings={doc.captions.settings}
              onChange={(next) => commit(setCaptions(doc, next))}
            />
            <Pressable onPress={() => setPanel('tools')} className="items-center py-2">
              <Text className="text-xs font-semibold text-accent">Done</Text>
            </Pressable>
          </View>
        ) : (
          <EditorToolDock
            canUndo={historyRef.current.past.length > 0}
            canRedo={historyRef.current.future.length > 0}
            canSplit={canSplit}
            canDelete={
              selectedId != null &&
              (selectedKind !== 'video' || doc.videos.length > 1)
            }
            selectedVideo={selectedVideo != null}
            muted={selectedVideo?.muted ?? false}
            speed={selectedVideo?.speed ?? 1}
            transition={transitionClip?.transitionIn ?? null}
            onUndo={undo}
            onRedo={redo}
            onSplit={() => {
              const next = splitAtPlayhead(doc, playhead);
              commit(next);
              const at = resolveTimelineTime(next, playhead);
              if (at) setSelectedId(at.clip.id);
            }}
            onDelete={() => {
              if (!selectedId) return;
              const next = deleteTimelineItem(doc, selectedId);
              commit(next);
              setSelectedId(next.videos[0]?.id ?? null);
              setSelectedKind('video');
            }}
            onCaptions={() => {
              setPanel('captions');
              setCaptionsSelected(true);
            }}
            onEffects={() => setShowEffects(true)}
            hasEffect={Boolean(selectedVideo?.effect)}
            onAdd={() => setShowAdd(true)}
            onMute={() => {
              if (!selectedVideo) return;
              commit(setVideoMuted(doc, selectedVideo.id, !selectedVideo.muted));
            }}
            onSpeed={(speed) => {
              if (!selectedVideo) return;
              commit(setClipSpeed(doc, selectedVideo.id, speed));
            }}
            onCycleTransition={() => {
              if (!transitionClip) return;
              commit(setTransitionIn(doc, transitionClip.id, cycleTransition(transitionClip.transitionIn)));
            }}
          />
        )}
      </SafeAreaView>

      <EffectsSheet
        visible={showEffects}
        effect={selectedVideo?.effect}
        disabled={!selectedVideo}
        onClose={() => setShowEffects(false)}
        onChange={(next) => {
          if (!selectedVideo) return;
          commit(setClipEffect(doc, selectedVideo.id, next));
        }}
      />
      <AddMediaSheet
        visible={showAdd}
        projectId={doc.projectId}
        sourcePath={sourcePath}
        sourceDuration={sourceDuration}
        remainingSeconds={remainingTimeline(doc)}
        onClose={() => setShowAdd(false)}
        onAdd={(request) => void handleAdd(request)}
      />
      <ExportSheet
        visible={showExport}
        progress={exportProgress}
        title="Export video"
        showRemux={false}
        onClose={() => {
          setShowExport(false);
          setExportProgress(null);
        }}
        onExport={(options) => {
          void (async () => {
            const saved = await handleSave();
            if (!saved) return;
            try {
              await buildTimelineExport(saved, {
                ratios: options.ratios,
                wordsBySourcePath: wordsBySource,
                clipId: saved.linkedClipId ?? (saved.kind === 'clip' ? saved.targetId : undefined),
                projectId: saved.projectId ?? (saved.kind === 'project' ? saved.targetId : undefined),
                onProgress: setExportProgress,
              });
            } catch (error) {
              appAlert('Export failed', error instanceof Error ? error.message : String(error));
            }
          })();
        }}
      />
    </View>
    </VideoThumbnailProvider>
  );
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}
