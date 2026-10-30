import { expect, it } from 'vitest';
import type { EditDocument } from '../types';
import { trimSceneLayer } from './layerTiming';
import { layerId, readOverrides, setLayerOverride, type SceneInventory } from './sceneLayers';
import { timelineLayers } from './timelineLayers';
const document: EditDocument = {
  title: 'Layers',
  format: { width: 1920, height: 1080, fps: 30 },
  clipAudio: 0,
  music: null,
  overlays: [],
  shots: [
    {
      id: 'scene',
      mediaId: null,
      scene: { composition: 'compositions/card.html', label: 'Card', variables: { text: 'Hello' } },
      sourceIn: 0,
      duration: 4,
      speed: 1,
      move: 'none',
      transitionIn: 'cut',
      refShot: null,
      description: '',
      alternates: [],
    },
  ],
};
const inventories: SceneInventory[] = [
  {
    owner: 'scene',
    layers: [
      {
        key: 'animation:0',
        kind: 'animation',
        category: 'animation',
        label: 'Entrance',
        start: 0.5,
        duration: 1,
      },
    ],
  },
];
const id = layerId('scene', 'animation:0');
it('trims independent animation timing on frame boundaries without changing the owning scene', () => {
  const next = trimSceneLayer(document, id, 'end', 0.313, inventories);
  expect(next.shots[0].duration).toBe(4);
  expect(readOverrides(next.shots[0].scene!.variables.__editorLayers)['animation:0']).toEqual({
    start: 0.5,
    duration: 1.3,
  });
  expect(timelineLayers(next, inventories)[0]).toMatchObject({ start: 0.5, duration: 1.3 });
  expect(document.shots[0].scene!.variables.__editorLayers).toBeUndefined();
});
it('clamps layer trims to their owning scene and preserves at least one frame', () => {
  const longer = trimSceneLayer(document, id, 'end', 99, inventories);
  expect(timelineLayers(longer, inventories)[0].duration).toBe(3.5);
  const shorter = trimSceneLayer(document, id, 'start', 99, inventories);
  expect(timelineLayers(shorter, inventories)[0].duration).toBeCloseTo(1 / 30);
  expect(trimSceneLayer(document, id, 'end', NaN, inventories)).toBe(document);
});
it('keeps independent style and timing edits together and tolerates malformed saved data', () => {
  const styled = setLayerOverride(document, 'scene', 'animation:0', {
    ease: 'sine.inOut',
    properties: { x: 200 },
  });
  const trimmed = trimSceneLayer(styled, id, 'end', 0.5, inventories);
  expect(
    readOverrides(trimmed.shots[0].scene!.variables.__editorLayers)['animation:0']
  ).toMatchObject({ ease: 'sine.inOut', properties: { x: 200 }, duration: 1.5 });
  expect(readOverrides('null')).toEqual({});
  expect(readOverrides('[]')).toEqual({});
  expect(readOverrides('{bad')).toEqual({});
});
