import { createDefaultSubtitleSettings } from '@clippster/shared-types';
import { describe, expect, it } from 'vitest';

import { buildEditorRenderPlan, type EditorRenderDescriptor } from './buildEditorRender';

function descriptor(): EditorRenderDescriptor {
  const settings = createDefaultSubtitleSettings();
  settings.enabled = true;
  return {
    videos: [
      {
        path: '/source.mp4',
        sourceStart: 10,
        sourceEnd: 20,
        speed: 1,
        muted: false,
        volume: 0.75,
        effect: { type: 'sepia', intensity: 50 },
      },
    ],
    overlays: [
      {
        path: '/overlay.png',
        timelineStart: 1,
        duration: 3,
        x: 0.1,
        y: 0.2,
        widthPct: 0.3,
      },
    ],
    textOverlays: [
      {
        path: '/text.png',
        timelineStart: 2,
        duration: 4,
        x: 0.25,
        y: 0.3,
        widthPct: 0.5,
      },
    ],
    audio: [
      {
        path: '/music.mp3',
        sourceStart: 0,
        sourceEnd: 8,
        timelineStart: 1,
        volume: 0.8,
      },
      {
        path: '/voiceover.m4a',
        sourceStart: 0,
        sourceEnd: 4,
        timelineStart: 3,
        volume: 1,
      },
    ],
    captions: {
      required: true,
      settings,
      words: [{ word: 'hello', start: 1, end: 2 }],
      assPath: '/work/captions.ass',
    },
    branding: {
      required: true,
      watermarkPath: '/watermark.png',
      watermarkSettings: { position: 'top-right' },
    },
  };
}

describe('buildEditorRenderPlan', () => {
  it.each([
    ['9:16' as const, 1080, 1920],
    ['16:9' as const, 1920, 1080],
  ])('plans a complete %s render without dropping requested layers', (ratio, width, height) => {
    const plan = buildEditorRenderPlan({
      descriptor: descriptor(),
      targetRatio: ratio,
      outputPath: `/out-${ratio}.mp4`,
      workDir: '/work',
    });
    expect(plan.width).toBe(width);
    expect(plan.height).toBe(height);
    expect(plan.timeline.clipRenders[0].args.join(' ')).toContain('volume=0.75');
    expect(plan.timeline.clipRenders[0].args.join(' ')).toContain('colorchannelmixer');
    expect(plan.timeline.compose.args.join(' ')).toContain('/overlay.png');
    expect(plan.timeline.compose.args.join(' ')).toContain('/text.png');
    expect(plan.timeline.compose.args.join(' ')).toContain('/music.mp3');
    expect(plan.timeline.compose.args.join(' ')).toContain('/voiceover.m4a');
    expect(plan.timeline.assContent).toContain('hello');
    expect(plan.branding?.ffmpegArgs).toContain('/watermark.png');
    expect(plan.branding?.outputPath).toBe(`/out-${ratio}.mp4`);
  });

  it('routes project framing through every source render', () => {
    const input = descriptor();
    input.branding = null;
    input.framingConfig = {
      mode: 'manual',
      sourceAspectRatio: '16:9',
      targetAspectRatio: '9:16',
      regions: [
        {
          id: 'region',
          color: '#ffffff',
          source: { x: 0.25, y: 0, width: 0.5, height: 1 },
          output: { x: 0, y: 0, width: 1, height: 1 },
        },
      ],
    };
    const plan = buildEditorRenderPlan({
      descriptor: input,
      targetRatio: '9:16',
      outputPath: '/out.mp4',
      workDir: '/work',
    });
    expect(plan.timeline.clipRenders[0].args.join(' ')).toContain('crop=iw*0.5');
  });

  it('fails instead of silently removing requested content', () => {
    const captions = descriptor();
    captions.captions = { ...captions.captions!, assPath: undefined };
    expect(() =>
      buildEditorRenderPlan({
        descriptor: captions,
        targetRatio: '9:16',
        outputPath: '/out.mp4',
        workDir: '/work',
      }),
    ).toThrow('Requested captions cannot be rendered');

    const branding = descriptor();
    branding.branding = { required: true };
    expect(() =>
      buildEditorRenderPlan({
        descriptor: branding,
        targetRatio: '16:9',
        outputPath: '/out.mp4',
        workDir: '/work',
      }),
    ).toThrow('Required branding assets are unavailable');
  });
});
