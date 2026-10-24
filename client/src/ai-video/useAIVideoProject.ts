import { computed, reactive, ref, shallowRef } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { join, videoDir } from '@tauri-apps/api/path';
import { useToast } from '@/composables/useToast';
import { createClip } from '@/services/database/clips';
import { updateClipBuildStatus } from '@/services/database/clip-build';
import * as videoApi from './api';
import { runAgent, type SourceSummary } from './agent/run';
import type { AgentProgress } from './agent/tools';
import { importMediaFiles, type MediaFile } from './analysis/media';
import { analyzeExample, loadExampleMeasurement, type ExampleInput, type ExampleProgress } from './analysis/reference';
import type { CompileContext } from './compiler/compile';
import { linkProjectMedia, syncWorkspace } from './runtime/project';
import { HyperframesWorkspace } from './runtime/workspace';
import type { EditDocument, MediaItem, VideoMeasurement, VideoPolicy, VideoSession } from './types';

export const DEFAULT_REQUEST = 'Make all these clips into one to match this video';
const TEXT_SAVE_DELAY_MS = 600;

export type Stage = 'start' | 'working' | 'result';

/** Live state of a generate run, for the working stage. */
export interface WorkingState {
  request: string;
  /** The example is analyzed in this run (it wasn't already). */
  analyzingExample: boolean;
  exampleReady: boolean;
  exampleProgress: ExampleProgress | null;
  sources: SourceSummary | null;
  progress: AgentProgress | null;
  notes: string[];
}

export interface ExportState {
  progress: number;
  path: string | null;
  error: string | null;
}

interface Version {
  document: EditDocument;
  files: Record<string, string>;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'ai-video';
}

/** One open AI video project: setup, paid AI runs, local timeline edits with undo, and export. */
export function useAIVideoProject() {
  const toast = useToast();

  const session = ref<VideoSession | null>(null);
  const policy = ref<VideoPolicy | null>(null);
  const loading = ref(false);
  const request = ref(DEFAULT_REQUEST);
  /** A newly chosen example that hasn't been analyzed yet. */
  const exampleDraft = ref<ExampleInput | null>(null);
  const running = ref<'generate' | 'revise' | null>(null);
  const working = ref<WorkingState | null>(null);
  /** The user's message while a revision runs (the server saves it with the run). */
  const pendingMessage = ref<string | null>(null);
  const previewUrl = ref<string | null>(null);
  const previewError = ref<string | null>(null);
  const revision = ref(0);
  const history = ref<Version[]>([]);
  const exportState = ref<ExportState | null>(null);
  /** Back on the setup screen of a project that already has a video. */
  const editingSetup = ref(false);

  const workspace = shallowRef<HyperframesWorkspace | null>(null);
  let compileContext: CompileContext | null = null;
  let measurement: VideoMeasurement | null = null;
  let controller: AbortController | null = null;
  let generation = 0;
  let saveQueue: Promise<void> = Promise.resolve();
  let textEdit: { overlayId: string; timer: ReturnType<typeof setTimeout> | null; version: Version | null } | null = null;

  const document = computed(() => session.value?.document ?? null);
  const blueprint = computed(() => session.value?.reference_blueprint ?? null);
  const media = computed(() => session.value?.media_items ?? []);
  const clips = computed(() => media.value.filter((item) => item.kind !== 'audio'));
  const song = computed(() => media.value.find((item) => item.kind === 'audio') ?? null);
  const needsExampleAnalysis = computed(() => !!exampleDraft.value || !blueprint.value);
  const hasExample = computed(() => !!exampleDraft.value || !!session.value?.reference);
  const goCost = computed(() => {
    const credits = policy.value?.credits;
    if (!credits) return null;
    return credits.generate + (needsExampleAnalysis.value ? credits.reference : 0);
  });
  const stage = computed<Stage>(() => {
    if (running.value === 'generate') return 'working';
    return document.value && !editingSetup.value ? 'result' : 'start';
  });

  function reportError(error: unknown, title = 'Something went wrong') {
    if (videoApi.isPaymentRequired(error)) {
      toast.error('Not enough credits', 'Add credits to keep going. You were not charged.');
    } else {
      toast.error(title, videoApi.apiErrorMessage(error));
    }
  }

  async function ensurePolicy() {
    policy.value ??= await videoApi.getPolicy();
    return policy.value;
  }

  // -- Opening and closing ---------------------------------------------------------

  async function open(id: number) {
    close();
    const token = ++generation;
    loading.value = true;
    try {
      const [loaded] = await Promise.all([videoApi.getSession(id), ensurePolicy()]);
      let current = loaded;
      // Runs are driven by the client that started them; one still open here was interrupted.
      if (current.running_run) {
        await videoApi.failRun(current.running_run.id, 'Interrupted').catch(() => {});
        current = await videoApi.getSession(id);
      }
      if (token !== generation) return;
      session.value = current;
      request.value = current.request || DEFAULT_REQUEST;
      measurement = current.reference ? await loadExampleMeasurement(current.reference.path) : null;
      if (current.document) await preparePreview(token);
    } catch (error) {
      if (token === generation) {
        session.value = null;
        reportError(error, "Couldn't open the project");
      }
    } finally {
      if (token === generation) loading.value = false;
    }
  }

  async function create(): Promise<boolean> {
    try {
      const [created] = await Promise.all([videoApi.createSession({ request: DEFAULT_REQUEST }), ensurePolicy()]);
      close();
      generation++;
      session.value = created;
      return true;
    } catch (error) {
      reportError(error, "Couldn't create the project");
      return false;
    }
  }

  function close() {
    generation++;
    controller?.abort();
    controller = null;
    if (textEdit) {
      if (textEdit.timer) clearTimeout(textEdit.timer);
      if (textEdit.version && session.value) void videoApi.updateSession(session.value.id, { document: textEdit.version.document }).catch(() => {});
      textEdit = null;
    }
    session.value = null;
    workspace.value = null;
    compileContext = null;
    measurement = null;
    exampleDraft.value = null;
    running.value = null;
    working.value = null;
    pendingMessage.value = null;
    previewUrl.value = null;
    previewError.value = null;
    history.value = [];
    exportState.value = null;
    editingSetup.value = false;
    request.value = DEFAULT_REQUEST;
  }

  // -- Workspace and preview ----------------------------------------------------------

  async function ensureWorkspace(): Promise<{ workspace: HyperframesWorkspace; context: CompileContext }> {
    const current = session.value;
    if (!current) throw new Error('No project is open.');
    workspace.value ??= await HyperframesWorkspace.open(current.id);
    compileContext ??= await linkProjectMedia(workspace.value, current.media_items);
    return { workspace: workspace.value, context: compileContext };
  }

  async function preparePreview(token = generation) {
    previewError.value = null;
    try {
      const { workspace: ws, context } = await ensureWorkspace();
      const current = session.value;
      if (token !== generation || !current) return;
      await syncWorkspace(ws, current.composition_files ?? {}, current.document, context);
      previewUrl.value ??= await ws.serve();
      revision.value++;
    } catch (error) {
      if (token === generation) previewError.value = videoApi.apiErrorMessage(error, "The preview couldn't load.");
    }
  }

  /** Put the saved document and files back in the workspace after a failed or cancelled run. */
  async function restoreWorkspace() {
    if (!workspace.value || !compileContext || !session.value) return;
    await syncWorkspace(workspace.value, session.value.composition_files ?? {}, session.value.document, compileContext).catch(() => {});
    revision.value++;
  }

  // -- Setup ---------------------------------------------------------------------------

  async function saveMedia(items: MediaItem[]) {
    const current = session.value;
    if (!current) return;
    session.value = await videoApi.updateSession(current.id, { media_items: items });
    compileContext = null;
  }

  async function addMedia(files: MediaFile[]) {
    const current = session.value;
    if (!current || running.value || !files.length) return;
    try {
      const { items, failed } = await importMediaFiles(files, current.media_items);
      for (const { name, error } of failed) toast.error(`Couldn't add ${name}`, error);
      if (!items.length) return;
      const added = [...current.media_items, ...items];
      const newSong = items.filter((item) => item.kind === 'audio').pop();
      await saveMedia(newSong ? added.filter((item) => item.kind !== 'audio' || item === newSong) : added);
    } catch (error) {
      reportError(error, "Couldn't add the files");
    }
  }

  async function removeMedia(id: string) {
    const current = session.value;
    if (!current || running.value) return;
    try {
      await saveMedia(current.media_items.filter((item) => item.id !== id));
    } catch (error) {
      reportError(error, "Couldn't remove the file");
    }
  }

  function setExampleUrl(url: string) {
    const value = url.trim();
    exampleDraft.value = value && value !== session.value?.reference?.sourceUrl ? { kind: 'url', value } : null;
  }

  function setExampleFile(path: string) {
    exampleDraft.value = { kind: 'upload', value: path };
  }

  function clearExampleDraft() {
    exampleDraft.value = null;
  }

  // -- AI runs -------------------------------------------------------------------------

  function currentVersion(): Version | null {
    const current = session.value;
    return current?.document ? { document: current.document, files: current.composition_files ?? {} } : null;
  }

  async function go() {
    const current = session.value;
    if (!current || running.value) return;
    const text = request.value.trim() || DEFAULT_REQUEST;
    const token = generation;
    const abort = (controller = new AbortController());
    const before = currentVersion();
    const state = reactive<WorkingState>({
      request: text,
      analyzingExample: needsExampleAnalysis.value,
      exampleReady: !needsExampleAnalysis.value,
      exampleProgress: null,
      sources: null,
      progress: null,
      notes: [],
    });
    running.value = 'generate';
    working.value = state;

    try {
      await flushTextEdit();
      const activePolicy = await ensurePolicy();
      let latest = await videoApi.updateSession(current.id, { request: text });
      session.value = latest;

      if (state.analyzingExample) {
        const input = exampleDraft.value ?? (latest.reference ? referenceInput(latest) : null);
        if (!input) throw new Error('Add an example video first.');
        const result = await analyzeExample(
          latest.id,
          input,
          activePolicy.max_reference_chunks,
          (progress) => (state.exampleProgress = progress),
          abort.signal
        );
        measurement = result.measurement;
        exampleDraft.value = null;
        latest = await videoApi.getSession(latest.id);
        if (token !== generation) return;
        session.value = latest;
        state.exampleReady = true;
      }

      const { workspace: ws } = await ensureWorkspace();
      const { session: done } = await runAgent({
        session: latest,
        kind: 'generate',
        request: text,
        workspace: ws,
        policy: activePolicy,
        exampleMeasurement: measurement,
        signal: abort.signal,
        callbacks: {
          onSourcesIndexed: (summary) => (state.sources = summary),
          onProgress: (progress) => (state.progress = progress),
          onNote: (note) => state.notes.push(note),
        },
      });
      if (token !== generation) return;
      session.value = done.name || !done.document?.title ? done : await videoApi.updateSession(done.id, { name: done.document.title });
      if (before) history.value.push(before);
      editingSetup.value = false;
      await preparePreview(token);
    } catch (error) {
      if (token !== generation) return;
      if (!abort.signal.aborted) reportError(error, "The video couldn't be made");
      session.value = await videoApi.getSession(current.id).catch(() => session.value);
      await restoreWorkspace();
    } finally {
      if (token === generation) {
        running.value = null;
        working.value = null;
        controller = null;
      }
    }
  }

  async function revise(text: string) {
    const current = session.value;
    const message = text.trim();
    if (!current?.document || running.value || !message) return;
    const token = generation;
    const abort = (controller = new AbortController());
    const before = currentVersion();
    running.value = 'revise';
    pendingMessage.value = message;

    try {
      await flushTextEdit();
      const activePolicy = await ensurePolicy();
      const { workspace: ws } = await ensureWorkspace();
      const { session: done } = await runAgent({
        session: current,
        kind: 'revise',
        request: message,
        workspace: ws,
        policy: activePolicy,
        exampleMeasurement: measurement,
        signal: abort.signal,
      });
      if (token !== generation) return;
      session.value = done;
      if (before && JSON.stringify(before) !== JSON.stringify(currentVersion())) history.value.push(before);
      revision.value++;
    } catch (error) {
      if (token !== generation) return;
      if (!abort.signal.aborted) reportError(error, "That change couldn't be made");
      session.value = await videoApi.getSession(current.id).catch(() => session.value);
      await restoreWorkspace();
    } finally {
      if (token === generation) {
        running.value = null;
        pendingMessage.value = null;
        controller = null;
      }
    }
  }

  function cancel() {
    controller?.abort();
  }

  // -- Timeline edits -----------------------------------------------------------------

  /**
   * Write a local edit to the workspace and the server. Saves run one at a time so they land in
   * order; local state already holds the edit, so responses never overwrite newer typing.
   */
  function persist(version: Version, saveFiles: boolean, errorTitle: string): Promise<void> {
    const sessionId = session.value?.id;
    const token = generation;
    saveQueue = saveQueue.then(async () => {
      if (sessionId == null || token !== generation) return;
      try {
        const { workspace: ws, context } = await ensureWorkspace();
        await syncWorkspace(ws, version.files, version.document, context);
        revision.value++;
        await videoApi.updateSession(sessionId, saveFiles ? { document: version.document, composition_files: version.files } : { document: version.document });
      } catch (error) {
        if (token === generation) reportError(error, errorTitle);
      }
    });
    return saveQueue;
  }

  /** Apply a local edit (no AI, no credits) and save it. */
  async function applyEdit(next: EditDocument) {
    const current = session.value;
    const before = currentVersion();
    if (!current || !before || running.value) return;
    await flushTextEdit();
    history.value.push(before);
    session.value = { ...current, document: next };
    await persist({ document: next, files: before.files }, false, "Couldn't save the change");
  }

  /** Edit overlay text as the user types: one undo step per overlay, saved after a pause. */
  function editText(overlayId: string, next: EditDocument) {
    const current = session.value;
    const before = currentVersion();
    if (!current || !before || running.value) return;
    if (textEdit?.overlayId !== overlayId) {
      void flushTextEdit();
      history.value.push(before);
      textEdit = { overlayId, timer: null, version: null };
    }
    session.value = { ...current, document: next };
    const edit = textEdit!;
    if (edit.timer) clearTimeout(edit.timer);
    edit.version = { document: next, files: before.files };
    edit.timer = setTimeout(() => void flushTextEdit(false), TEXT_SAVE_DELAY_MS);
  }

  async function flushTextEdit(end = true) {
    const edit = textEdit;
    if (!edit) return;
    if (edit.timer) clearTimeout(edit.timer);
    edit.timer = null;
    const version = edit.version;
    edit.version = null;
    if (end) textEdit = null;
    if (version) await persist(version, false, "Couldn't save the text");
  }

  async function undo() {
    const current = session.value;
    if (!current || running.value) return;
    await flushTextEdit();
    const previous = history.value.pop();
    if (!previous) return;
    session.value = { ...current, document: previous.document, composition_files: previous.files };
    await persist(previous, true, "Couldn't undo");
  }

  // -- Export ---------------------------------------------------------------------------

  async function exportVideo() {
    const current = session.value;
    if (!current?.document || running.value || (exportState.value && !exportState.value.path && !exportState.value.error)) return;
    const name = current.name || current.document.title || 'AI video';
    exportState.value = { progress: 0, path: null, error: null };
    try {
      await flushTextEdit();
      const { workspace: ws } = await ensureWorkspace();
      const requested = await join(await videoDir(), `${slugify(name)}.mp4`);
      const result = await ws.render(requested, {
        fps: current.document.format.fps,
        onProgress: (progress) => exportState.value && (exportState.value.progress = Math.round(progress * 100)),
      });
      exportState.value = { progress: 100, path: result.outputPath, error: null };
      void saveToLibrary(result.outputPath, name, result.duration, result.bytes);
    } catch (error) {
      exportState.value = { progress: 0, path: null, error: videoApi.apiErrorMessage(error, 'The export failed.') };
    }
  }

  /** Register the export as a finished clip so it shows up in the clip library. */
  async function saveToLibrary(path: string, name: string, duration: number | null, bytes: number) {
    try {
      const fileName = path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || 'ai-video';
      const thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
        videoPath: path,
        timestampSeconds: 1,
        outputFilename: `${fileName}_thumb`,
      }).catch(() => undefined);
      const builtDuration = duration ?? undefined;
      const clipId = await createClip(null, path, { name, duration: builtDuration, thumbnailPath });
      await updateClipBuildStatus(clipId, 'completed', {
        builtFilePath: path,
        builtThumbnailPath: thumbnailPath,
        builtDuration,
        builtFileSize: bytes,
        progress: 100,
      });
    } catch (error) {
      console.warn('[AIVideo] Failed to add the export to the clip library:', error);
    }
  }

  return {
    session,
    policy,
    loading,
    request,
    exampleDraft,
    running,
    working,
    pendingMessage,
    previewUrl,
    previewError,
    revision,
    history,
    exportState,
    editingSetup,
    document,
    blueprint,
    media,
    clips,
    song,
    hasExample,
    needsExampleAnalysis,
    goCost,
    stage,
    open,
    create,
    close,
    addMedia,
    removeMedia,
    setExampleUrl,
    setExampleFile,
    clearExampleDraft,
    go,
    revise,
    cancel,
    applyEdit,
    editText,
    undo,
    exportVideo,
    retryPreview: () => preparePreview(),
  };
}

function referenceInput(session: VideoSession): ExampleInput | null {
  const reference = session.reference;
  if (!reference) return null;
  return reference.sourceUrl ? { kind: 'url', value: reference.sourceUrl } : { kind: 'upload', value: reference.path };
}

export type AIVideoProject = ReturnType<typeof useAIVideoProject>;
