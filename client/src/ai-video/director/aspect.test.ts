import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../types';
import { aspectFormat, mediaAspect, outputFormat } from './aspect';

const item = (id: string, kind: MediaItem['kind'], width: number, height: number): MediaItem => ({
  id,
  name: id,
  kind,
  path: '',
  duration: 5,
  width,
  height,
  hasAudio: false,
  contentHash: id,
});

describe('outputFormat', () => {
  it('follows the example aspect ratio', () => {
    expect(outputFormat({ width: 1080, height: 1920, fps: 60 })).toEqual({
      width: 1080,
      height: 1920,
      fps: 30,
    });
    expect(outputFormat({ width: 1440, height: 1800, fps: 24 })).toEqual({
      width: 1080,
      height: 1350,
      fps: 24,
    });
    expect(outputFormat({ width: 1000, height: 1000, fps: 25 })).toEqual({
      width: 1080,
      height: 1080,
      fps: 25,
    });
    expect(outputFormat({ width: 3840, height: 2160, fps: 29.97 })).toEqual({
      width: 1920,
      height: 1080,
      fps: 30,
    });
  });
});

describe('aspectFormat', () => {
  it('sizes each shape at 30 fps', () => {
    expect(aspectFormat('9:16')).toEqual({ width: 1080, height: 1920, fps: 30 });
    expect(aspectFormat('4:5')).toEqual({ width: 1080, height: 1350, fps: 30 });
  });
});

describe('mediaAspect', () => {
  it('uses the shape most clips and photos share, ignoring audio', () => {
    const media = [
      item('a', 'video', 1080, 1920),
      item('b', 'photo', 1170, 2532),
      item('c', 'video', 1920, 1080),
      item('d', 'audio', 0, 0),
    ];
    expect(mediaAspect(media)).toBe('9:16');
  });

  it('falls back to 16:9 without visual media', () => {
    expect(mediaAspect([item('d', 'audio', 0, 0)])).toBe('16:9');
    expect(mediaAspect([])).toBe('16:9');
  });
});
