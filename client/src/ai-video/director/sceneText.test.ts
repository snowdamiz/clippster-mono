import { describe, expect, it } from 'vitest';
import { sceneTextFields } from './sceneText';
import { setBlockText } from './edits';
import type { EditDocument, ShotScene } from '../types';

const scene: ShotScene = {
  composition: 'compositions/end.html',
  label: 'End card',
  variables: {
    text: 'Share your best',
    wordmark: 'Clippster',
    accent: '#22d3ee',
    screen: 'media:p1',
    font: 'Montserrat',
  },
};
const files = {
  'compositions/end.html': `<html data-composition-variables='[{"id":"wordmark","type":"string","label":"Brand name","default":"Default"},{"id":"tagline","type":"string","label":"Tagline","default":"Create more"}]'>`,
};
describe('editable scene text', () => {
  it('exposes copy and wordmarks separately and excludes style and media variables', () => {
    const fields = sceneTextFields('end', scene, files);
    expect(fields.map((field) => field.key)).toEqual(['wordmark', 'tagline', 'text']);
    expect(fields.find((field) => field.key === 'wordmark')).toMatchObject({
      label: 'Brand name',
      value: 'Clippster',
    });
  });
  it('edits one scene variable without replacing its other copy or animation', () => {
    const document = { shots: [{ id: 'end', scene }], overlays: [] } as unknown as EditDocument;
    const field = sceneTextFields('end', scene, files).find((field) => field.key === 'wordmark')!;
    const edited = setBlockText(document, field.id, 'New brand', files);
    expect(edited.shots[0].scene?.variables).toEqual({ ...scene.variables, wordmark: 'New brand' });
    expect(document.shots[0].scene?.variables.wordmark).toBe('Clippster');
    expect(edited.shots[0].scene?.composition).toBe(scene.composition);
  });
  it('writes declared defaults as overrides and handles malformed declarations', () => {
    const document = { shots: [{ id: 'end', scene }], overlays: [] } as unknown as EditDocument;
    const field = sceneTextFields('end', scene, files).find((field) => field.key === 'tagline')!;
    expect(
      setBlockText(document, field.id, 'Updated', files).shots[0].scene?.variables.tagline
    ).toBe('Updated');
    expect(
      sceneTextFields('end', scene, {
        'compositions/end.html': `<html data-composition-variables='broken'>`,
      }).map((field) => field.key)
    ).toEqual(['text', 'wordmark']);
  });
});
