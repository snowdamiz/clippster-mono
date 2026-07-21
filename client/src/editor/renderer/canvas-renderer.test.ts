import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BaseNode } from './nodes/base-node';
import { CanvasRenderer } from './canvas-renderer';

class FakeContext {
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  filter = 'none';
  fillStyle: string | CanvasGradient | CanvasPattern = 'black';
  setTransform = vi.fn();
  fillRect = vi.fn();
  drawImage = vi.fn();
}

class FakeOffscreenCanvas {
  readonly context = new FakeContext();

  constructor(
    public width: number,
    public height: number
  ) {}

  getContext() {
    return this.context;
  }
}

describe('CanvasRenderer preview backing size', () => {
  beforeEach(() => {
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps project-space coordinates while rendering into a smaller backing canvas', async () => {
    const renderer = new CanvasRenderer({
      width: 1920,
      height: 1080,
      backingWidth: 640,
      backingHeight: 360,
      fps: 30,
    });
    const node = {
      render: vi.fn(),
    } as unknown as BaseNode;

    await renderer.render({ node, time: 0 });

    expect(renderer.getBackingSize()).toEqual({ width: 640, height: 360 });
    expect((renderer.context as unknown as FakeContext).setTransform).toHaveBeenLastCalledWith(
      1 / 3,
      0,
      0,
      1 / 3,
      0,
      0
    );
    expect(node.render).toHaveBeenCalledWith({ renderer, time: 0 });
  });

  it('paints at the display canvas backing dimensions', async () => {
    const renderer = new CanvasRenderer({
      width: 1920,
      height: 1080,
      backingWidth: 960,
      backingHeight: 540,
      fps: 30,
    });
    const targetContext = new FakeContext();
    const targetCanvas = {
      width: 960,
      height: 540,
      getContext: () => targetContext,
    } as unknown as HTMLCanvasElement;
    const node = { render: vi.fn() } as unknown as BaseNode;

    await renderer.renderToCanvas({ node, time: 1, targetCanvas });

    expect(targetContext.drawImage).toHaveBeenCalledWith(renderer.canvas, 0, 0, 960, 540);
  });
});
