import { expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { SCENE_VISIBILITY_SCRIPT } from './sceneVisibility';
it('measures separate visible spans at the project fps and restores the playhead and styles', () => {
  let time = 0.75;
  const properties = new Map([['visibility', 'hidden']]);
  const root = {
    style: {
      getPropertyValue: (key: string) => properties.get(key) ?? '',
      getPropertyPriority: () => '',
      setProperty: (key: string, value: string) => properties.set(key, value),
      removeProperty: (key: string) => properties.delete(key),
    },
    closest: () => ({ getAttribute: () => '10' }),
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
    }),
    querySelector: () => node,
  };
  const node = {
    isConnected: true,
    parentElement: root,
    getBoundingClientRect: () => ({
      left: time >= 1 && time < 1.5 ? 200 : 10,
      top: 10,
      right: time >= 1 && time < 1.5 ? 210 : 20,
      bottom: 20,
      width: 10,
      height: 10,
    }),
  };
  const layer = { kind: 'element', key: 'icon', selector: 'svg', start: 0, duration: 2 };
  runInNewContext(SCENE_VISIBILITY_SCRIPT + '\nmeasureSceneLayers();', {
    root,
    layers: [layer],
    overrides: {},
    variables: { __editorDuration: 2 },
    timeline: {
      totalTime(value?: number) {
        if (value !== undefined) time = value;
        return time;
      },
    },
    getComputedStyle: (element: unknown) => ({
      opacity: element === root && time < 0.3 ? '0' : '1',
      display: 'block',
      visibility: 'visible',
    }),
  });
  expect(layer).toMatchObject({
    start: 0.3,
    duration: 1.7,
    ranges: [
      { start: 0.3, duration: 0.7 },
      { start: 1.5, duration: 0.5 },
    ],
  });
  expect(time).toBe(0.75);
  expect(properties.get('visibility')).toBe('hidden');
});
