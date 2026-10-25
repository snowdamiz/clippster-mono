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
import {
  analyzeExample,
  isExampleLink,
  loadExampleMeasurement,
  type ExampleInput,
  type ExampleProgress,
} from './analysis/reference';
import { indexSources, type SourceProgress } from './analysis/sources';
import type { CompileContext } from './compiler/compile';
import { exportFiles, linkProjectMedia, syncWorkspace } from './runtime/project';
import { HyperframesWorkspace } from './runtime/workspace';
import { mediaAspect } from './director/aspect';
import type {
  AspectRatio,
  EditDocument,
  MediaItem,
  VideoMeasurement,
  VideoPlan,
  VideoPolicy,
  VideoSession,
} from './types';

const BUILD_PLAN_REQUEST = 'Build this video.';
const BUILD_CHAT_REQUEST = 'Build it from what we talked about.';
const BUILD_MATCH_REQUEST = 'Make all these clips into one to match this video.';
const BUILD_EXAMPLE_REQUEST = 'Make a video like this example.';
const BUILD_CLIPS_REQUEST = 'Make one video from my clips.';
const TEXT_SAVE_DELAY_MS = 600;
/** Pause after typing or pasting an example link before it is analyzed. */
const EXAMPLE_URL_DELAY_MS = 1200;
/** Before the first build (planning chat), while a build runs, and once there is a video. */
export type Stage = 'setup' | 'working' | 'result';

/** Live state of a generate run, for the working stage. */
export interface WorkingState {
  request: string;
  /** The example was still being analyzed when the build started. */
  analyzingExample: boolean;
  exampleReady: boolean;
  sources: SourceSummary | null;
  progress: AgentProgress | null;
  notes: string[];
}

/** The example and the clips are analyzed in the background as soon as they're added. */
export interface AnalysisState {
  example: ExampleProgress | null;
  exampleError: string | null;
  clips: SourceProgress | null;
  clipsError: string | null;
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
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'ai-video'
  );
}

/** One open AI video project: sources, the free planning chat, paid AI runs, local timeline edits with undo, and export. */
export function useAIVideoProject() {
  const toast = useToast();

  const session = ref<VideoSession | null>(null);
  const policy = ref<VideoPolicy | null>(null);
  const loading = ref(false);
  /** A newly chosen example that hasn't been analyzed yet. */
  const exampleDraft = ref<ExampleInput | null>(null);
  const analysis = reactive<AnalysisState>({
    example: null,
    exampleError: null,
    clips: null,
    clipsError: null,
  });
  /** The user's planning message while the AI replies. */
  const planPending = ref<string | null>(null);
  /** The planning composer's text, kept here so a failed message comes back. */
  const planDraft = ref('');
  const running = ref<'generate' | 'revise' | null>(null);
  const working = ref<WorkingState | null>(null);
  /** The user's message while a revision runs (the server saves it with the run). */
  const pendingMessage = ref<string | null>(null);
  const previewUrl = ref<string | null>(null);
  const previewError = ref<string | null>(null);
  const revision = ref(0);
  const history = ref<Version[]>([]);
  const exportState = ref<ExportState | null>(null);

  const workspace = shallowRef<HyperframesWorkspace | null>(null);
  let compileContext: CompileContext | null = null;
  let measurement: VideoMeasurement | null = null;
  let controller: AbortController | null = null;
  let generation = 0;
  let saveQueue: Promise<void> = Promise.resolve();
  let textEdit: {
    blockId: string;
    timer: ReturnType<typeof setTimeout> | null;
    version: Version | null;
  } | null = null;
  let analysisAbort = new AbortController();
  let example: { task: Promise<void>; abort: AbortController } | null = null;
  let exampleUrlTimer: ReturnType<typeof setTimeout> | null = null;
  let clipsTask: Promise<void> | null = null;
  let clipsPass = 0;
  let clipsChanged = false;

  const document = computed(() => session.value?.document ?? null);
  const blueprint = computed(() => session.value?.reference_blueprint ?? null);
  const media = computed(() => session.value?.media_items ?? []);
  const clips = computed(() => media.value.filter((item) => item.kind !== 'audio'));
  const song = computed(() => media.value.find((item) => item.kind === 'audio') ?? null);
  const hasExample = computed(() => !!exampleDraft.value || !!session.value?.reference);
  const needsExampleAnalysis = computed(
    () => !!exampleDraft.value || (!!session.value?.reference && !blueprint.value)
  );
  const planMessages = computed(() =>
    (session.value?.messages ?? []).filter((message) => message.metadata?.phase === 'plan')
  );
  const hasPlanChat = computed(() => planMessages.value.length > 0);
  /** The newest plan from the planning chat. */
  const plan = computed<VideoPlan | null>(
    () =>
      [...planMessages.value].reverse().find((message) => message.metadata?.plan)?.metadata?.plan ??
      null
  );
  /** The shape a video without an example gets: the user's pick, or most clips' shape. */
  const aspect = computed<AspectRatio>(
    () => session.value?.aspect_ratio ?? mediaAspect(clips.value)
  );
  /** Building needs something to go on: the planning chat, an example or clips. */
  const canBuild = computed(
    () =>
      !running.value &&
      !planPending.value &&
      (hasPlanChat.value || hasExample.value || clips.value.length > 0)
  );
  const goCost = computed(() => {
    const credits = policy.value?.credits;
    if (!credits) return null;
    return credits.generate + (needsExampleAnalysis.value ? credits.reference : 0);
  });
  const stage = computed<Stage>(() => {
    if (running.value === 'generate') return 'working';
    return document.value ? 'result' : 'setup';
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

  /** Take fields from a fresh copy of the session without touching local edits. */
  function mergeSession(fresh: VideoSession, keys: Array<keyof VideoSession>) {
    const current = session.value;
    if (!current || current.id !== fresh.id) return;
    session.value = { ...current, ...Object.fromEntries(keys.map((key) => [key, fresh[key]])) };
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
      measurement = current.reference ? await loadExampleMeasurement(current.reference.path) : null;
      if (current.document) await preparePreview(token);
      else void indexClipsNow().catch(() => {});
    } catch (error) {
      if (token === generation) {
        session.value = null;
        reportError(error, "Couldn't open the project");
      }
    } finally {
      if (token === generation) loading.value = false;
    }
  }

  function close() {
    generation++;
    controller?.abort();
    controller = null;
    analysisAbort.abort();
    analysisAbort = new AbortController();
    example = null;
    clipsTask = null;
    if (exampleUrlTimer) clearTimeout(exampleUrlTimer);
    exampleUrlTimer = null;
    Object.assign(analysis, { example: null, exampleError: null, clips: null, clipsError: null });
    if (textEdit) {
      if (textEdit.timer) clearTimeout(textEdit.timer);
      if (textEdit.version && session.value)
        void videoApi
          .updateSession(session.value.id, { document: textEdit.version.document })
          .catch(() => {});
      textEdit = null;
    }
    session.value = null;
    workspace.value = null;
    compileContext = null;
    measurement = null;
    exampleDraft.value = null;
    planPending.value = null;
    planDraft.value = '';
    running.value = null;
    working.value = null;
    pendingMessage.value = null;
    previewUrl.value = null;
    previewError.value = null;
    history.value = [];
    exportState.value = null;
  }

  // -- Workspace and preview ----------------------------------------------------------

  async function ensureWorkspace(): Promise<{
    workspace: HyperframesWorkspace;
    context: CompileContext;
  }> {
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
      if (token === generation)
        previewError.value = videoApi.apiErrorMessage(error, "The preview couldn't load.");
    }
  }

  /** Put the saved document and files back in the workspace after a failed or cancelled run. */
  async function restoreWorkspace() {
    if (!workspace.value || !compileContext || !session.value) return;
    await syncWorkspace(
      workspace.value,
      session.value.composition_files ?? {},
      session.value.document,
      compileContext
    ).catch(() => {});
    revision.value++;
  }

  // -- Background analysis ------------------------------------------------------------

  /**
   * Analyze a new or unfinished example (charged when it finishes), or join the analysis already
   * running. Resolves quietly when it is cancelled because the example was removed or replaced.
   */
  function analyzeExampleNow(): Promise<void> {
    if (example) return example.task;
    const current = session.value;
    const input =
      exampleDraft.value ??
      (current?.reference && !current.reference_blueprint ? referenceInput(current) : null);
    if (!current || !input) return Promise.resolve();
    const token = generation;
    const abort = new AbortController();
    const stop = () => abort.abort();
    analysisAbort.signal.addEventListener('abort', stop, { once: true });
    analysis.exampleError = null;
    analysis.example = { stage: 'downloading', progress: 0, message: 'Getting the example' };

    const run = async () => {
      try {
        const activePolicy = await ensurePolicy();
        const result = await analyzeExample(
          current.id,
          input,
          activePolicy.max_reference_chunks,
          (progress) => {
            if (!abort.signal.aborted) analysis.example = progress;
          },
          abort.signal
        );
        if (token !== generation || abort.signal.aborted) return;
        measurement = result.measurement;
        if (exampleDraft.value === input) exampleDraft.value = null;
        mergeSession(await videoApi.getSession(current.id), ['reference', 'reference_blueprint']);
      } catch (error) {
        if (token !== generation || abort.signal.aborted) return;
        analysis.exampleError = videoApi.isPaymentRequired(error)
          ? 'Not enough credits to analyze the example.'
          : videoApi.apiErrorMessage(error, "Couldn't analyze the example.");
        throw error;
      } finally {
        analysisAbort.signal.removeEventListener('abort', stop);
        if (example?.abort === abort) {
          example = null;
          analysis.example = null;
        }
      }
    };
    const task = run();
    example = { task, abort };
    return task;
  }

  function cancelExampleAnalysis() {
    if (exampleUrlTimer) clearTimeout(exampleUrlTimer);
    exampleUrlTimer = null;
    example?.abort.abort();
    example = null;
    analysis.example = null;
    analysis.exampleError = null;
  }

  /** Look through the clips (free before a build) so planning knows what's in them, or join the pass already running. */
  function indexClipsNow(): Promise<void> {
    if (clipsTask) {
      clipsChanged = true;
      return clipsTask;
    }
    if (!session.value?.media_items.some((item) => item.kind !== 'audio')) return Promise.resolve();
    const token = generation;
    const signal = analysisAbort.signal;
    const pass = ++clipsPass;
    analysis.clipsError = null;

    clipsTask = (async () => {
      try {
        do {
          clipsChanged = false;
          const latest = session.value!;
          await indexSources(
            latest.id,
            latest.media_items,
            latest.source_index ?? {},
            (progress) => {
              if (token === generation) analysis.clips = progress;
            },
            signal
          );
          if (token !== generation) return;
          mergeSession(await videoApi.getSession(latest.id), ['source_index']);
        } while (clipsChanged && token === generation);
      } catch (error) {
        if (token !== generation || signal.aborted) return;
        analysis.clipsError = videoApi.isPaymentRequired(error)
          ? 'Add credits so the AI can look through your clips.'
          : videoApi.apiErrorMessage(error, "Couldn't look through your clips.");
        throw error;
      } finally {
        if (pass === clipsPass) {
          clipsTask = null;
          analysis.clips = null;
        }
      }
    })();
    return clipsTask;
  }

  /** Everything planning and building need: the analyzed example (errors stop them) and the clips (best effort). */
  async function ensureAnalyzed() {
    await Promise.all([analyzeExampleNow(), indexClipsNow().catch(() => {})]);
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
      await saveMedia(
        newSong ? added.filter((item) => item.kind !== 'audio' || item === newSong) : added
      );
      void indexClipsNow().catch(() => {});
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

  /** A pasted link is analyzed once the user stops typing. */
  function setExampleUrl(url: string) {
    const value = url.trim();
    if (value === exampleDraft.value?.value || value === session.value?.reference?.sourceUrl)
      return;
    cancelExampleAnalysis();
    exampleDraft.value = isExampleLink(value) ? { kind: 'url', value } : null;
    if (exampleDraft.value)
      exampleUrlTimer = setTimeout(
        () => void analyzeExampleNow().catch(() => {}),
        EXAMPLE_URL_DELAY_MS
      );
  }

  function setExampleFile(path: string) {
    cancelExampleAnalysis();
    exampleDraft.value = { kind: 'upload', value: path };
    void analyzeExampleNow().catch(() => {});
  }

  /** Drop the example (a new pick, the analyzed one, or one mid-analysis) so the video is made from the description. */
  async function removeExample() {
    const current = session.value;
    if (!current || running.value) return;
    const started = !!example || !!current.reference;
    cancelExampleAnalysis();
    exampleDraft.value = null;
    if (!started) return;
    try {
      session.value = await videoApi.updateSession(current.id, { reference: null });
      measurement = null;
    } catch (error) {
      reportError(error, "Couldn't remove the example");
    }
  }

  async function rename(name: string) {
    const current = session.value;
    const value = name.trim();
    if (!current || !value || value === current.name) return;
    try {
      mergeSession(await videoApi.updateSession(current.id, { name: value }), ['name']);
    } catch (error) {
      reportError(error, "Couldn't rename the project");
    }
  }

  async function setAspect(value: AspectRatio) {
    const current = session.value;
    if (!current || running.value || current.aspect_ratio === value) return;
    try {
      session.value = await videoApi.updateSession(current.id, { aspect_ratio: value });
    } catch (error) {
      reportError(error, "Couldn't change the shape");
    }
  }

  // -- Planning (free) -----------------------------------------------------------------

  async function sendPlan(text: string) {
    const current = session.value;
    const message = text.trim();
    if (!current || !message || running.value || planPending.value) return;
    const token = generation;
    planPending.value = message;
    planDraft.value = '';
    try {
      await ensureAnalyzed();
      if (token !== generation) return;
      const updated = await videoApi.sendPlanMessage(current.id, message);
      if (token !== generation) return;
      mergeSession(updated, [
        'messages',
        'aspect_ratio',
        'source_index',
        'reference',
        'reference_blueprint',
      ]);
    } catch (error) {
      if (token !== generation) return;
      planDraft.value = message;
      reportError(error, "The AI couldn't reply");
    } finally {
      if (token === generation) planPending.value = null;
    }
  }

  // -- AI runs -------------------------------------------------------------------------

  function currentVersion(): Version | null {
    const current = session.value;
    return current?.document
      ? { document: current.document, files: current.composition_files ?? {} }
      : null;
  }

  function buildRequest() {
    if (plan.value) return BUILD_PLAN_REQUEST;
    if (hasPlanChat.value) return BUILD_CHAT_REQUEST;
    if (hasExample.value) return clips.value.length ? BUILD_MATCH_REQUEST : BUILD_EXAMPLE_REQUEST;
    return BUILD_CLIPS_REQUEST;
  }

  /** Build the video (paid), following the planning chat and its plan when there is one. */
  async function build() {
    const current = session.value;
    if (!current || !canBuild.value) return;
    const text = buildRequest();
    const token = generation;
    const abort = (controller = new AbortController());
    const before = currentVersion();
    const state = reactive<WorkingState>({
      request: text,
      analyzingExample: needsExampleAnalysis.value,
      exampleReady: !needsExampleAnalysis.value,
      sources: null,
      progress: null,
      notes: [],
    });
    running.value = 'generate';
    working.value = state;

    try {
      await flushTextEdit();
      const activePolicy = await ensurePolicy();
      await ensureAnalyzed();
      if (token !== generation || abort.signal.aborted) return;
      const latest = await videoApi.getSession(current.id);
      session.value = latest;
      state.exampleReady = true;

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
      session.value =
        done.name || !done.document?.title
          ? done
          : await videoApi.updateSession(done.id, { name: done.document.title });
      if (before) history.value.push(before);
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
      if (before && JSON.stringify(before) !== JSON.stringify(currentVersion()))
        history.value.push(before);
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
        await videoApi.updateSession(
          sessionId,
          saveFiles
            ? { document: version.document, composition_files: version.files }
            : { document: version.document }
        );
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

  /** Commit a user's scene styling, SVG or animation edit with the same file-aware undo history as AI revisions. */
  async function applyComposition(path: string, source: string) {
    const current = session.value;
    if (
      !current?.composition_files ||
      !(path in current.composition_files) ||
      !source.trim() ||
      running.value
    )
      return;
    await flushTextEdit();
    const before = currentVersion();
    if (!before || before.files[path] === source) return;
    history.value.push(before);
    const files = { ...before.files, [path]: source };
    session.value = { ...current, composition_files: files };
    await persist({ document: before.document, files }, true, "Couldn't save the scene");
  }

  /** Edit the words of an overlay or scene as the user types: one undo step per block, saved after a pause. */
  function editText(blockId: string, next: EditDocument) {
    const current = session.value;
    const before = currentVersion();
    if (!current || !before || running.value) return;
    if (textEdit?.blockId !== blockId) {
      void flushTextEdit();
      history.value.push(before);
      textEdit = { blockId, timer: null, version: null };
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
    if (
      !current?.document ||
      running.value ||
      (exportState.value && !exportState.value.path && !exportState.value.error)
    )
      return;
    const name = current.name || current.document.title || 'AI video';
    exportState.value = { progress: 0, path: null, error: null };
    try {
      await flushTextEdit();
      await saveQueue;
      const version = currentVersion();
      if (!version?.document) throw new Error('No video is ready to export.');
      const { workspace: ws, context } = await ensureWorkspace();
      const requested = await join(await videoDir(), `${slugify(name)}.mp4`);
      const result = await ws.render(requested, {
        fps: version.document.format.fps,
        files: exportFiles(version.files, version.document, context),
        onProgress: (progress) =>
          exportState.value && (exportState.value.progress = Math.round(progress * 100)),
      });
      exportState.value = { progress: 100, path: result.outputPath, error: null };
      void saveToLibrary(result.outputPath, name, result.duration, result.bytes);
    } catch (error) {
      exportState.value = {
        progress: 0,
        path: null,
        error: videoApi.apiErrorMessage(error, 'The export failed.'),
      };
    }
  }

  /** Register the export as a finished clip so it shows up in the clip library. */
  async function saveToLibrary(path: string, name: string, duration: number | null, bytes: number) {
    try {
      const fileName =
        path
          .split(/[\\/]/)
          .pop()
          ?.replace(/\.[^.]+$/, '') || 'ai-video';
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
    exampleDraft,
    analysis,
    planPending,
    planDraft,
    plan,
    hasPlanChat,
    running,
    working,
    pendingMessage,
    previewUrl,
    previewError,
    revision,
    history,
    exportState,
    document,
    blueprint,
    media,
    clips,
    song,
    hasExample,
    needsExampleAnalysis,
    aspect,
    canBuild,
    goCost,
    stage,
    open,
    close,
    addMedia,
    removeMedia,
    setExampleUrl,
    setExampleFile,
    removeExample,
    retryExample: () => void analyzeExampleNow().catch(() => {}),
    retryClips: () => void indexClipsNow().catch(() => {}),
    rename,
    setAspect,
    sendPlan,
    build,
    revise,
    cancel,
    applyEdit,
    applyComposition,
    editText,
    undo,
    exportVideo,
    retryPreview: () => preparePreview(),
  };
}

function referenceInput(session: VideoSession): ExampleInput | null {
  const reference = session.reference;
  if (!reference) return null;
  return reference.sourceUrl
    ? { kind: 'url', value: reference.sourceUrl }
    : { kind: 'upload', value: reference.path };
}

export type AIVideoProject = ReturnType<typeof useAIVideoProject>;
