import { describe, expect, it } from 'vitest';

import { buildTimelineClipArgs, buildTimelineExportPlan } from './buildTimelineExport';
import { createDefaultSubtitleSettings } from '@clippster/shared-types';

describe('buildTimelineExportPlan', () => {
  it('scales phone clips to the target frame like the preview', () => {
    const args = buildTimelineClipArgs({
      clip: { path: 'file:///storage/video.mp4', sourceStart: 4, sourceEnd: 12, speed: 1, muted: false },
      outputPath: '/tmp/clip.mp4',
      width: 1920,
      height: 1080,
      silentAudio: false,
    });

    expect(args.join(' ')).toContain('force_original_aspect_ratio=decrease');
    expect(args.join(' ')).toContain('pad=1920:1080');
    expect(args).toContain('/storage/video.mp4');
    expect(args).toContain('4');
  });

  it('uses silence when a video track is muted', () => {
    const args = buildTimelineClipArgs({
      clip: { path: '/phone.mp4', sourceStart: 0, sourceEnd: 5, speed: 1, muted: true },
      outputPath: '/tmp/clip.mp4',
      width: 1080,
      height: 1920,
      silentAudio: true,
    });

    expect(args.join(' ')).toContain('anullsrc');
    expect(args.join(' ')).toContain('[1:a]');
  });

  it('composites images, music, and captions onto the assembled timeline', () => {
    const settings = createDefaultSubtitleSettings();
    settings.enabled = true;
    const plan = buildTimelineExportPlan({
      videos: [
        { path: '/a.mp4', sourceStart: 0, sourceEnd: 10, speed: 1, muted: false },
        { path: '/b.mp4', sourceStart: 20, sourceEnd: 30, speed: 1, muted: true },
      ],
      images: [{ path: '/sticker.png', timelineStart: 2, duration: 3, x: 0.1, y: 0.2, widthPct: 0.3 }],
      audio: [{ path: '/song.mp3', sourceStart: 0, sourceEnd: 20, timelineStart: 1, volume: 0.8 }],
      outputPath: '/out.mp4',
      workDir: '/tmp/work',
      targetRatio: '16:9',
      subtitleSettings: settings,
      subtitleWords: [{ word: 'HELLO', start: 0.2, end: 0.8 }],
      assPath: '/tmp/work/subs.ass',
    });

    expect(plan.clipRenders).toHaveLength(2);
    expect(plan.totalDuration).toBe(20);
    expect(plan.concat.listContent).toContain('tl_clip_0.mp4');
    expect(plan.compose.args.join(' ')).toContain('overlay=');
    expect(plan.compose.args.join(' ')).toContain('between(t,2,5)');
    expect(plan.compose.args.join(' ')).toContain('amix=inputs=2');
    expect(plan.compose.args.join(' ')).toContain('ass=');
    expect(plan.assContent).toContain('HELLO');
  });

  it('xfades overlapping dissolve instead of a hard concat copy', () => {
    const plan = buildTimelineExportPlan({
      videos: [
        { path: '/a.mp4', sourceStart: 0, sourceEnd: 10, speed: 1, muted: false },
        { path: '/b.mp4', sourceStart: 0, sourceEnd: 10, speed: 1, muted: false, transitionIn: 'dissolve' },
      ],
      images: [],
      audio: [],
      outputPath: '/out.mp4',
      workDir: '/tmp/work',
      targetRatio: '16:9',
    });

    expect(plan.totalDuration).toBe(19.5);
    expect(plan.concat.args.join(' ')).toContain('xfade=transition=fade');
    expect(plan.concat.args.join(' ')).toContain('acrossfade=d=0.5');
    expect(plan.concat.listContent).toBeUndefined();
  });

  it('uses fadeblack and wipeleft for fade and wipe joins', () => {
    const fade = buildTimelineExportPlan({
      videos: [
        { path: '/a.mp4', sourceStart: 0, sourceEnd: 4, speed: 1, muted: false },
        { path: '/b.mp4', sourceStart: 0, sourceEnd: 4, speed: 1, muted: false, transitionIn: 'fade' },
      ],
      images: [],
      audio: [],
      outputPath: '/out.mp4',
      workDir: '/tmp/work',
      targetRatio: '9:16',
    });
    const wipe = buildTimelineExportPlan({
      videos: [
        { path: '/a.mp4', sourceStart: 0, sourceEnd: 4, speed: 1, muted: false },
        { path: '/b.mp4', sourceStart: 0, sourceEnd: 4, speed: 1, muted: false, transitionIn: 'wipe' },
      ],
      images: [],
      audio: [],
      outputPath: '/out.mp4',
      workDir: '/tmp/work',
      targetRatio: '9:16',
    });

    expect(fade.concat.args.join(' ')).toContain('xfade=transition=fadeblack');
    expect(wipe.concat.args.join(' ')).toContain('xfade=transition=wipeleft');
  });
});
