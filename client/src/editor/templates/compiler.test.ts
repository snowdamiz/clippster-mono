import { describe, expect, it } from 'vitest';
import { BUILT_IN_VIDEO_TEMPLATES, assignTemplateSlots } from '@clippster/template-schema';
import type { MediaAsset } from '../types/assets';
import { canUseFastVideoExport } from '../renderer/export-routing';
import { compileTemplatePlan, TemplateCompileError } from './compiler';

const video: MediaAsset = {
  id: 'video-1',
  name: 'source.mp4',
  type: 'video',
  duration: 60,
  width: 1080,
  height: 1920,
  file: new File([new Uint8Array([0])], 'source.mp4', {
    type: 'video/mp4',
    lastModified: 100,
  }),
};
const candidates = [
  {
    assetId: video.id,
    sourceFingerprint: 'video-1:1000:100',
    type: 'video' as const,
    startMs: 0,
    endMs: 60_000,
    durationMs: 60_000,
    width: 1080,
    height: 1920,
    hasAudio: true,
    score: 0.8,
    tags: ['hook', 'speech', 'action', 'detail', 'payoff'],
  },
];

describe('desktop template compiler', () => {
  it('compiles all 14 built-ins into ordinary editable OpenCut elements', () => {
    for (const manifest of BUILT_IN_VIDEO_TEMPLATES) {
      const assignment = assignTemplateSlots({
        manifest,
        candidates,
        seed: 3,
      });
      const plan = compileTemplatePlan({
        manifest,
        bindings: assignment.bindings,
        mediaAssets: [video],
        seed: 3,
        now: new Date('2026-01-01T00:00:00.000Z'),
      });
      const videoTrack = plan.tracks.find((track) => track.type === 'video')!;
      expect(videoTrack.elements.length).toBeGreaterThan(0);
      expect(videoTrack.elements.every((element) => element.templateSlotId)).toBe(true);
      expect(
        videoTrack.elements
          .filter((element) => element.type === 'video')
          .every((element) => !element.muted && element.volume === 1)
      ).toBe(true);
      expect(plan.tracks.some((track) => track.type === 'text')).toBe(true);
      const effectTrack = plan.tracks.find((track) => track.type === 'effect')!;
      expect(effectTrack.elements[0].params).not.toEqual({});
      if (videoTrack.elements.length > 1 && manifest.presentation.transition !== 'cut') {
        expect(plan.transitions).toHaveLength(videoTrack.elements.length - 1);
      }
      expect(
        canUseFastVideoExport({
          tracks: plan.tracks,
          sceneTransitions: plan.transitions,
          canvasSourceFraming: null,
          background: { type: 'color', color: '#000000' },
        })
      ).toBe(false);
      expect(plan.provenance.templateId).toBe(manifest.id);
      expect(plan.durationSeconds).toBeGreaterThan(0);
    }
  });

  it('fails preflight before graph mutation when required media is missing', () => {
    const manifest = BUILT_IN_VIDEO_TEMPLATES[0];
    expect(() => compileTemplatePlan({ manifest, bindings: [], mediaAssets: [] })).toThrowError(
      TemplateCompileError
    );
  });

  it('remaps runtime IDs but retains stable logical slot provenance', () => {
    const manifest = BUILT_IN_VIDEO_TEMPLATES[0];
    const assignment = assignTemplateSlots({
      manifest,
      candidates,
      seed: 1,
    });
    const first = compileTemplatePlan({
      manifest,
      bindings: assignment.bindings,
      mediaAssets: [video],
    });
    const second = compileTemplatePlan({
      manifest,
      bindings: assignment.bindings,
      mediaAssets: [video],
    });
    expect(first.tracks[0].id).not.toBe(second.tracks[0].id);
    expect(first.tracks[0].elements[0].id).not.toBe(second.tracks[0].elements[0].id);
    expect(first.tracks[0].elements[0].templateSlotId).toBe(
      second.tracks[0].elements[0].templateSlotId
    );
  });

  it('does not slow a short source to the maximum duration of a style template', () => {
    const manifest = BUILT_IN_VIDEO_TEMPLATES.find((item) => item.id === 'clean-podcast')!;
    const bindings = [
      {
        slotId: manifest.slots[0].id,
        assetId: video.id,
        sourceFingerprint: 'video-1:1000:100',
        sourceStartMs: 0,
        sourceEndMs: 5_000,
        score: 1,
        reasonCodes: ['creator-selected'],
        locked: true,
      },
    ];
    const plan = compileTemplatePlan({ manifest, bindings, mediaAssets: [video] });
    const element = plan.tracks[0].elements[0];
    expect(element.duration).toBe(5);
    expect(element.type === 'video' ? element.speed : 1).toBe(1);
    expect(plan.durationSeconds).toBe(5);
  });

  it('rejects a binding that extends past the original used for final export', () => {
    const manifest = BUILT_IN_VIDEO_TEMPLATES[0];
    expect(() =>
      compileTemplatePlan({
        manifest,
        mediaAssets: [video],
        bindings: [
          {
            slotId: manifest.slots[0].id,
            assetId: video.id,
            sourceFingerprint: 'video-1:1000:100',
            sourceStartMs: 59_000,
            sourceEndMs: 61_000,
            score: 1,
            reasonCodes: ['creator-selected'],
            locked: true,
          },
        ],
      })
    ).toThrowError(TemplateCompileError);
  });
});
