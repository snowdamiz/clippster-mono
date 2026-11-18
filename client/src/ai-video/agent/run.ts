import { invoke } from '@tauri-apps/api/core';
import { dirname, join } from '@tauri-apps/api/path';
import * as videoApi from '../api';
import { indexSources, songBeats } from '../analysis/sources';
import { throwIfAborted } from '../analysis/shared';
import { aspectFormat, mediaAspect, outputFormat } from '../director/aspect';
import { buildCandidates } from '../director/candidates';
import {
  compositionPaths,
  linkProjectMedia,
  readCompositionFiles,
  syncWorkspace,
  writeCompiledDocument,
} from '../runtime/project';
import { ensureRenderBrowser, type HyperframesWorkspace } from '../runtime/workspace';
import type {
  GenerateBrief,
  SourceSegment,
  VideoMeasurement,
  VideoPolicy,
  VideoSession,
} from '../types';
import { AgentTools, type AgentProgress } from './tools';
import { driveAgentTurns } from './turnLoop';
import { finalAgentDocument } from './finalDocument';
import type { CreatorSkillPackage } from '@clippster/shared-types';

const STILL_SIZE = 768;

export interface SourceSummary {
  videos: number;
  photos: number;
  songs: number;
  good: number;
  skipped: number;
}

export interface AgentRunCallbacks {
  /** The server charged the run. */
  onStarted?: () => void;
  onSourcesIndexed?: (summary: SourceSummary) => void;
  onProgress?: (progress: AgentProgress) => void;
  /** Interim text the AI wrote between tool calls. */
  onNote?: (text: string) => void;
  /** Persist a submitted package before another paid agent turn begins. */
  onPlaybookPackage?: (item: CreatorSkillPackage, researchFetches: number) => Promise<void> | void;
}

export interface AgentRunOptions {
  session: VideoSession;
  kind: 'generate' | 'revise';
  request: string;
  workspace: HyperframesWorkspace;
  policy: VideoPolicy;
  exampleMeasurement: VideoMeasurement | null;
  requirePlaybookPackage?: boolean;
  maxCredits?: number;
  callbacks?: AgentRunCallbacks;
  signal?: AbortSignal;
}

const SKIPPED_QUALITY = new Set(['unusable', 'shaky', 'soft']);

function summarizeSources(
  session: VideoSession,
  sources: Record<string, SourceSegment[]>
): SourceSummary {
  const segments = Object.values(sources).flat();
  const skipped = segments.filter((segment) => SKIPPED_QUALITY.has(segment.quality ?? '')).length;
  const count = (kind: string) => session.media_items.filter((item) => item.kind === kind).length;
  return {
    videos: count('video'),
    photos: count('photo'),
    songs: count('audio'),
    good: segments.length - skipped,
    skipped,
  };
}
/**
 * Drive one paid agent run end to end: charge, index sources (new edits), relay tool calls to the
 * workspace turn by turn, then save the finished document and composition files. Any failure or
 * cancellation fails the run on the server, which refunds it.
 */
export async function runAgent(
  options: AgentRunOptions
): Promise<{ session: VideoSession; message: string; playbookPackage: CreatorSkillPackage | null }> {
  const { session, kind, request, workspace, policy, callbacks = {}, signal } = options;
  const run = await videoApi.startRun(session.id, kind, request, options.maxCredits);
  callbacks.onStarted?.();

  try {
    const media = session.media_items;
    const [compileContext] = await Promise.all([
      linkProjectMedia(workspace, media),
      ensureRenderBrowser({ signal }),
    ]);
    const prepared = kind === 'generate' ? await prepareGenerate(options) : null;
    const brief = prepared?.brief ?? {};
    throwIfAborted(signal);

    if (kind === 'generate') {
      for (const path of await compositionPaths(workspace)) await workspace.deleteFile(path);
    } else {
      await syncWorkspace(
        workspace,
        session.composition_files ?? {},
        session.document,
        compileContext
      );
    }

    const tools = new AgentTools(
      {
        workspace,
        compileContext,
        media,
        sourceSegments:
          prepared?.sources ??
          Object.fromEntries(
            media.map((item) => [
              item.id,
              Object.values(session.source_index?.[item.contentHash] ?? {}).flatMap(
                (chunk) => chunk.segments
              ),
            ])
          ),
        speechSegments: Object.fromEntries(
          media.map((item) => [item.id, session.speech_index?.[item.contentHash] ?? []])
        ),
        maxSeconds: policy.max_output_seconds,
        creatorLayoutSourceId: options.requirePlaybookPackage ? media[0]?.id : undefined,
        exampleKeyframes: (session.reference_blueprint?.shots ?? []).map(
          (shot) => options.exampleMeasurement?.shots[shot.index]?.keyframePath ?? null
        ),
        snapshotDir: await join(await dirname(workspace.projectDir), 'snapshots'),
        encodeImage: (path) =>
          invoke<string>('encode_image_for_ai', { path, maxDimension: STILL_SIZE }),
        signal,
      },
      kind === 'revise' ? session.document : null
    );

    const response = await driveAgentTurns(
      await videoApi.turn(run.id, { brief }),
      tools,
      results => videoApi.turn(run.id, { results }),
      callbacks,
      signal,
    );

    if (!tools.document) throw new Error("The AI didn't produce an edit. You weren't charged.");
    if (options.requirePlaybookPackage && !tools.playbookPackage) {
      throw new Error('The AI editor did not submit the required research and publishing package.');
    }
    const files = await readCompositionFiles(workspace);
    const document = finalAgentDocument(tools.document, files, session.media_items, policy.max_output_seconds, session.reference_blueprint?.shots.length ?? 0);
    await writeCompiledDocument(workspace, document, compileContext);
    const completed = await videoApi.completeRun(run.id, document, files);
    const messages = completed.session.messages;
    const message =
      messages[messages.length - 1]?.content ??
      (response.type === 'finish' ? response.message : '');
    return { session: completed.session, message, playbookPackage: tools.playbookPackage };
  } catch (error) {
    const reason = signal?.aborted
      ? 'Cancelled'
      : videoApi.apiErrorMessage(error, 'The run failed');
    await videoApi.failRun(run.id, reason).catch(() => {});
    throw error;
  }
}

/** With an example: its shape and the best footage per example shot. Without one: the chosen shape. */
async function prepareGenerate(
  options: AgentRunOptions
): Promise<{ brief: GenerateBrief; sources: Record<string, SourceSegment[]> }> {
  const { session, callbacks = {}, signal } = options;
  const blueprint = session.reference_blueprint;

  let sources: Record<string, SourceSegment[]> = {};
  if (session.media_items.length) {
    sources = await indexSources(
      session.id,
      session.media_items,
      session.source_index ?? {},
      () => {},
      signal
    );
    callbacks.onSourcesIndexed?.(summarizeSources(session, sources));
  }

  const song = session.media_items.find((item) => item.kind === 'audio');
  const beats = song ? await songBeats(song) : null;
  return {
    sources,
    brief: {
      format: blueprint
        ? outputFormat(blueprint)
        : aspectFormat(session.aspect_ratio ?? mediaAspect(session.media_items)),
      ...(blueprint && { candidates: buildCandidates(blueprint, session.media_items, sources) }),
      music: song
        ? {
            mediaId: song.id,
            duration: song.duration,
            bpm: beats?.bpm ?? null,
            beats: beats?.beats.map((beat) => beat.time) ?? [],
          }
        : null,
    },
  };
}
