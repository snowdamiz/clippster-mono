import { expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { sceneLayerScript } from './sceneLayers';
it('applies saved tween timing, easing and values in the same script used by preview and export', () => {
  const state = { start: 0.1, duration: 0.5 };
  const child = {
    vars: { x: 10, startAt: { x: 0 } },
    startTime(value?: number) {
      if (value !== undefined) state.start = value;
      return state.start;
    },
    duration(value?: number) {
      if (value !== undefined) state.duration = value;
      return state.duration;
    },
    invalidate() {},
    targets: () => [],
    paused() {},
  };
  let report: unknown;
  const window = {
    addEventListener() {},
    __hyperframes: {
      getVariables: () => ({
        __editorOwner: 'shot',
        __editorLayers: JSON.stringify({
          'animation:0': {
            start: 0.4,
            duration: 1.2,
            ease: 'none',
            properties: { x: 80 },
            fromProperties: { x: -20 },
          },
        }),
      }),
    },
    __timelines: { card: { getChildren: () => [child], invalidate() {} } },
    parent: {
      postMessage(value: unknown) {
        report = value;
      },
    },
  };
  const script = sceneLayerScript('card')
    .replace(/^<script[^>]*>/, '')
    .replace(/<\/script>$/, '');
  runInNewContext(script, {
    window,
    document: { querySelector: () => ({ querySelectorAll: () => [], addEventListener() {} }) },
    Element: class {},
  });
  expect(state).toEqual({ start: 0.4, duration: 1.2 });
  expect(child.vars).toMatchObject({ ease: 'none', x: 80, startAt: { x: -20 } });
  expect(report).toMatchObject({
    type: 'clippster-scene-layers',
    owner: 'shot',
    layers: [
      {
        key: 'animation:0',
        start: 0.4,
        duration: 1.2,
        properties: { x: 80 },
        fromProperties: { x: -20 },
      },
    ],
  });
});
