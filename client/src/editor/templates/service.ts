import {
  assignTemplateSlots,
  type TemplateAssignmentResult,
  type TemplateBinding,
  type TemplateManifest,
  type TemplateSourceRange,
} from '@clippster/template-schema';
import type { EditorCore } from '../core';
import type { MediaAsset } from '../types/assets';
import type { TimelineTrack } from '../types/timeline';
import { ApplyTemplateCommand } from './apply-template-command';
import {
  compileTemplatePlan,
  type CompiledTemplatePlan,
} from './compiler';
import { settleTemplatePreviewBeforeCommit } from './preview-session';

export interface PreparedTemplateDraft {
  manifest: TemplateManifest;
  assignment: TemplateAssignmentResult;
  plan: CompiledTemplatePlan;
  preparedAt: number;
}

function fingerprint(asset: MediaAsset): string {
  return `${asset.id}:${asset.file.size}:${asset.file.lastModified}`;
}

export function mediaAssetsToCandidates(
  assets: MediaAsset[],
  preferredWindowMs = 4_000
): TemplateSourceRange[] {
  return assets
    .filter((asset) => !asset.ephemeral && asset.type !== 'audio')
    .flatMap((asset) => {
      const totalMs = Math.max(1, Math.round((asset.duration ?? 5) * 1000));
      if (asset.type === 'image') {
        return [
          {
            assetId: asset.id,
            sourceFingerprint: fingerprint(asset),
            type: asset.type,
            startMs: 0,
            endMs: totalMs,
            durationMs: totalMs,
            width: asset.width,
            height: asset.height,
            score: 0.5,
            tags: ['detail'],
          } satisfies TemplateSourceRange,
        ];
      }
      const windowMs = Math.min(totalMs, Math.max(4_000, preferredWindowMs));
      const stepMs = Math.max(3_000, Math.round(windowMs * 0.75));
      const candidates: TemplateSourceRange[] = [];
      for (let startMs = 0; startMs < totalMs; startMs += stepMs) {
        const endMs = Math.min(totalMs, startMs + windowMs);
        if (endMs - startMs < 500) break;
        candidates.push({
          assetId: asset.id,
          sourceFingerprint: fingerprint(asset),
          type: 'video',
          startMs,
          endMs,
          durationMs: endMs - startMs,
          width: asset.width,
          height: asset.height,
          hasAudio: true,
          score: 0.5,
          tags: startMs === 0 ? ['hook', 'establishing'] : [],
        });
      }
      return candidates;
    });
}

export async function prepareTemplateDraft(input: {
  editor: EditorCore;
  manifest: TemplateManifest;
  seed?: number;
  lockedBindings?: TemplateBinding[];
}): Promise<PreparedTemplateDraft> {
  const assets = input.editor.media.getAssets().filter((asset) => !asset.ephemeral);
  const preferredWindowMs =
    input.manifest.kind === 'style'
      ? Math.max(
          ...input.manifest.slots
            .filter((slot) => slot.type === 'video' || slot.type === 'image' || slot.type === 'media')
            .map((slot) => (slot.targetDuration.value * 1000) / slot.targetDuration.timescale),
          4_000
        )
      : 4_000;
  const candidates = mediaAssetsToCandidates(assets, preferredWindowMs);
  const assignment = assignTemplateSlots({
    manifest: input.manifest,
    candidates,
    seed: input.seed,
    lockedBindings: input.lockedBindings,
  });
  for (const binding of assignment.bindings) {
    const hydrated = await input.editor.media.ensureAssetHydrated(binding.assetId);
    if (!hydrated) throw new Error(`Could not prepare media for slot ${binding.slotId}`);
  }
  const hydratedAssets = input.editor.media.getAssets().filter((asset) => !asset.ephemeral);
  const plan = compileTemplatePlan({
    manifest: input.manifest,
    bindings: assignment.bindings,
    mediaAssets: hydratedAssets,
    seed: assignment.seed,
  });
  if (
    input.manifest.kind === 'style' &&
    input.editor.timeline
      .getTracks()
      .reduce(
        (count, track) =>
          count +
          track.elements.filter((element) => element.type === 'video' || element.type === 'image')
            .length,
        0
      ) >= input.manifest.slots.length
  ) {
    let mediaIndex = 0;
    const generatedVideo = plan.tracks.find((track) => track.type === 'video');
    const generatedStyle = generatedVideo?.elements[0];
    const styledTracks: TimelineTrack[] = structuredClone(
      input.editor.timeline.getTracks()
    ).map((track) => {
      if (track.type === 'text') {
        return {
          ...track,
          elements: track.elements.filter((element) => !element.templateProvenance),
        };
      }
      if (track.type === 'effect') {
        return {
          ...track,
          elements: track.elements.filter((element) => !element.templateProvenance),
        };
      }
      if (track.type !== 'video') return track;
      return {
        ...track,
        elements: track.elements.map((element) => {
          const slot = input.manifest.slots[mediaIndex % input.manifest.slots.length];
          mediaIndex += 1;
          return {
            ...element,
            mediaFit: slot.fit,
            colorAdjustments:
              generatedStyle && 'colorAdjustments' in generatedStyle
                ? structuredClone(generatedStyle.colorAdjustments)
                : element.colorAdjustments,
            templateSlotId: slot.id,
            templateProvenance: {
              templateId: input.manifest.id,
              templateVersionId: input.manifest.versionId,
              logicalElementId: slot.bindings[0].elementId,
            },
          };
        }),
      };
    });
    const styleDuration = input.editor.timeline.getTotalDuration();
    const decorationTracks = plan.tracks
      .filter((track) => track.type === 'effect' || track.type === 'text')
      .map((track) => ({
        ...track,
        elements: track.elements.map((element) => ({
          ...element,
          duration: Math.min(element.duration, styleDuration),
        })),
      })) as TimelineTrack[];
    plan.tracks = [
      ...styledTracks,
      ...decorationTracks,
    ];
    plan.durationSeconds = styleDuration;
    // A style template must not rewrite the user's editorial transition graph.
    plan.transitions = structuredClone(
      input.editor.scenes.getActiveScene().transitions ?? []
    );
  }
  return { manifest: input.manifest, assignment, plan, preparedAt: Date.now() };
}

export function commitTemplateDraft(editor: EditorCore, draft: PreparedTemplateDraft): void {
  // Drop non-history preview paint so the command's undo snapshot is the real baseline.
  settleTemplatePreviewBeforeCommit(editor);
  editor.command.execute({ command: new ApplyTemplateCommand(draft.plan) });
}
