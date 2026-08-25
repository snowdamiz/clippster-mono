import { beforeEach, describe, expect, it } from 'vitest';
import {
  AdaptivePreviewQualityController,
  configurePreviewDecode,
  getInitialAutoPreviewQuality,
  getPreviewDecodeSinkSize,
  setPreviewDecodeSinkSizeOverride,
} from './preview-decode-settings';

describe('preview decode settings', () => {
  beforeEach(() => {
    setPreviewDecodeSinkSizeOverride(null);
  });

  it('starts Auto at 360p only on devices with at most two hardware threads', () => {
    expect(getInitialAutoPreviewQuality(1)).toBe(360);
    expect(getInitialAutoPreviewQuality(2)).toBe(360);
    expect(getInitialAutoPreviewQuality(3)).toBe(720);
  });

  it('uses the adaptive Auto height without changing fixed quality presets', () => {
    configurePreviewDecode({
      projectWidth: 1920,
      projectHeight: 1080,
      previewQuality: 'auto',
      autoQualityHeight: 360,
    });
    expect(getPreviewDecodeSinkSize()).toEqual({ width: 640, height: 360 });

    configurePreviewDecode({
      projectWidth: 1920,
      projectHeight: 1080,
      previewQuality: 540,
      autoQualityHeight: 360,
    });
    expect(getPreviewDecodeSinkSize()).toEqual({ width: 960, height: 540 });
  });

  it('steps Auto down under sustained frame pressure', () => {
    const controller = new AdaptivePreviewQualityController(720);
    for (let i = 0; i < 7; i++) {
      expect(controller.recordFrame(30, 30)).toBeNull();
    }
    expect(controller.recordFrame(30, 30)).toBe(540);
    expect(controller.height).toBe(540);
  });

  it('steps Auto up only after a longer stable period', () => {
    const controller = new AdaptivePreviewQualityController(360);
    for (let i = 0; i < 89; i++) {
      expect(controller.recordFrame(5, 30)).toBeNull();
    }
    expect(controller.recordFrame(5, 30)).toBe(540);
    expect(controller.height).toBe(540);
  });

  it('does not adapt when frame cost is inside the neutral band', () => {
    const controller = new AdaptivePreviewQualityController(540);
    for (let i = 0; i < 200; i++) {
      expect(controller.recordFrame(18, 30)).toBeNull();
    }
    expect(controller.height).toBe(540);
  });
});
