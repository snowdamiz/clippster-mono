import { describe, expect, it } from 'vitest';

import { buildClipExportPlan } from './buildClipExport';
import { buildTextOverlayFilterArgs } from './buildTextOverlay';
import { buildFramingFilterGraph } from './buildFramingFilter';
import { buildSegmentConcatArgs } from './buildSegmentConcat';
import { buildSubtitleAssContent } from './buildSubtitleAss';
import { createDefaultManualFramingConfig, createDefaultManualRegion } from '@clippster/shared-types';
import { createDefaultSubtitleSettings } from '@clippster/shared-types';

describe('buildSegmentConcatArgs', () => {
  it('builds single-segment trim args', () => {
    const result = buildSegmentConcatArgs({
      videoPath: '/input.mp4',
      segments: [{ start_time: 10, end_time: 40, duration: 30, transcript: null }],
      outputPath: '/out.mp4',
      concatListPath: '/list.txt',
    });

    expect(result.ffmpegArgs).toContain('-ss');
    expect(result.ffmpegArgs).toContain('10');
    expect(result.totalDuration).toBe(30);
  });

  it('builds multi-segment concat filter', () => {
    const result = buildSegmentConcatArgs({
      videoPath: '/input.mp4',
      segments: [
        { start_time: 0, end_time: 10, duration: 10, transcript: null },
        { start_time: 20, end_time: 30, duration: 10, transcript: null },
      ],
      outputPath: '/out.mp4',
      concatListPath: '/list.txt',
    });

    expect(result.ffmpegArgs.join(' ')).toContain('concat=n=2');
    expect(result.totalDuration).toBe(20);
  });
});

describe('buildFramingFilterGraph', () => {
  it('returns center crop for empty regions', () => {
    const result = buildFramingFilterGraph({
      framingConfig: createDefaultManualFramingConfig('9:16'),
      targetRatio: '9:16',
    });

    expect(result?.filterComplex).toContain('crop');
    expect(result?.width).toBe(1080);
    expect(result?.height).toBe(1920);
  });

  it('composites regions into target canvas', () => {
    const config = createDefaultManualFramingConfig('9:16');
    config.regions = [createDefaultManualRegion(0)];
    const result = buildFramingFilterGraph({
      framingConfig: config,
      targetRatio: '9:16',
    });

    expect(result?.filterComplex).toContain('overlay');
  });
});

describe('buildSubtitleAssContent', () => {
  it('generates valid ASS header and dialogue lines', () => {
    const content = buildSubtitleAssContent({
      settings: createDefaultSubtitleSettings(),
      words: [
        { word: 'Hello', start: 0, end: 1 },
        { word: 'world', start: 1, end: 2 },
      ],
      clipDuration: 5,
      targetRatio: '9:16',
      outputPath: '/subs.ass',
    });

    expect(content).toContain('[Script Info]');
    expect(content).toContain('Dialogue:');
    expect(content).toContain('Hello');
  });
});

describe('buildTextOverlayFilterArgs', () => {
  it('uses center-anchored overlay with correct input index', () => {
    const filter = buildTextOverlayFilterArgs('framed', 2, {
      enabled: true,
      text: 'TEST',
      startTime: 0,
      endTime: 5,
      positionX: 50,
      positionY: 50,
      widthPct: 72,
      style: {
        fontFamily: 'Montserrat',
        fontSize: 28,
        fontWeight: 700,
        color: '#000000',
        backgroundColor: '#FFFFFF',
        backgroundEnabled: true,
        highlightColor: '#FFFF00',
        border1Width: 0,
        border1Color: '#000000',
        border2Width: 0,
        border2Color: '#000000',
        strokeEnabled: false,
        strokeColor: '#000000',
        strokeWidth: 0,
        shadowEnabled: false,
        shadowColor: '#000000',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        borderRadius: 24,
        padding: 20,
        letterSpacing: 0,
        lineHeight: 1.2,
        wordSpacing: 0.35,
        textAlign: 'center',
        maxWidth: 90,
        textOffsetX: 0,
        textOffsetY: 0,
      },
    }, 1080, 1920);

    expect(filter).toContain('[2:v]');
    expect(filter).toContain('overlay_w/2');
    expect(filter).toContain('overlay_h/2');
    expect(filter).toContain("enable='between(t,0,5)'");
  });
});

describe('buildClipExportPlan', () => {
  it('returns remux-only plan when requested', () => {
    const plan = buildClipExportPlan({
      videoPath: '/in.mp4',
      outputPath: '/out.mp4',
      segments: [{ start_time: 0, end_time: 5, duration: 5, transcript: null }],
      targetRatio: '9:16',
      remuxOnly: true,
    });

    expect(plan.ffmpegArgs).toContain('/out.mp4');
    expect(plan.totalDuration).toBe(5);
  });
});
