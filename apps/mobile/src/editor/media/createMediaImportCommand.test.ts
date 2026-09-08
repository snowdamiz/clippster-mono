import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EditorCommandHistory } from '../commands/history';
import { createBlankMobileEditProject } from '../model/createProject';
import { EDITOR_TICKS_PER_SECOND } from '../model/schema';
import { createMediaImportCommand } from './createMediaImportCommand';

describe('editor media import', () => {
  it('adds video, image, and audio to a blank timeline as undoable commands', async () => {
    let sequence = 0;
    const idFactory = (prefix: string) => `${prefix}_${sequence++}`;
    const original = createBlankMobileEditProject({
      targetId: 'standalone-editor',
      now: 1,
      idFactory,
    });
    const history = new EditorCommandHistory();
    let document = original;

    for (const kind of ['video', 'image', 'audio'] as const) {
      const result = await createMediaImportCommand(
        kind,
        {
          path: `/${kind}`,
          label: kind,
          durationSeconds: 10,
        },
        2 * EDITOR_TICKS_PER_SECOND,
        idFactory,
        async (uri) => `fingerprint:${uri}`,
      );
      document = history.commit(document, result.command).document;
    }

    assert.equal(document.tracks.find((track) => track.kind === 'video')?.items.length, 1);
    assert.equal(document.tracks.find((track) => track.kind === 'overlay')?.items.length, 1);
    assert.equal(document.tracks.find((track) => track.kind === 'audio')?.items.length, 1);
    assert.equal(Object.keys(document.assets).length, 3);

    document = history.undo(document).document;
    assert.equal(document.tracks.find((track) => track.kind === 'audio')?.items.length, 0);
    assert.equal(Object.keys(document.assets).length, 2);
  });

  it('adds video as a timed overlay when requested from the overlay tool', async () => {
    let sequence = 0;
    const idFactory = (prefix: string) => `${prefix}_${sequence++}`;
    const original = createBlankMobileEditProject({ targetId: 'project', now: 1, idFactory });
    const result = await createMediaImportCommand(
      'video',
      { path: '/overlay.mp4', label: 'Overlay', durationSeconds: 4 },
      EDITOR_TICKS_PER_SECOND,
      idFactory,
      async () => 'video-fingerprint',
      'overlay',
    );
    const document = new EditorCommandHistory().commit(original, result.command).document;
    assert.equal(document.tracks.find((track) => track.kind === 'video')?.items.length, 0);
    assert.equal(document.tracks.find((track) => track.kind === 'overlay')?.items.length, 1);
    assert.equal(result.selection.kind, 'overlay');
  });
});
