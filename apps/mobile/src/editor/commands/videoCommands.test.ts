import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMobileEditProject } from '../model/createProject';
import { EDITOR_TICKS_PER_SECOND } from '../model/schema';
import { getVideoTrack } from '../model/timeline';
import { EditorCommandHistory } from './history';
import {
  DeleteVideoItemCommand,
  DuplicateVideoItemCommand,
  MoveVideoItemCommand,
  SetVideoSpeedCommand,
  SplitVideoItemCommand,
  TrimVideoItemCommand,
} from './videoCommands';

function fixture() {
  let sequence = 0;
  return createMobileEditProject({
    kind: 'clip',
    targetId: 'clip-1',
    source: {
      uri: '/source.mp4',
      fingerprint: 'source:123',
      durationSeconds: 60,
      sourceKind: 'clip',
    },
    ranges: [
      { startSeconds: 0, endSeconds: 10 },
      { startSeconds: 20, endSeconds: 30 },
    ],
    now: 1,
    idFactory: (prefix) => `${prefix}_${sequence++}`,
  });
}

describe('video commands', () => {
  it('splits without creating media and undoes as one command', () => {
    const original = fixture();
    const history = new EditorCommandHistory();
    const first = getVideoTrack(original).items[0];
    let document = history.commit(
      original,
      new SplitVideoItemCommand(
        first.id,
        5 * EDITOR_TICKS_PER_SECOND,
        'video_split',
        'transition_split',
        2,
      ),
    ).document;
    const split = getVideoTrack(document);
    assert.equal(split.items.length, 3);
    assert.equal(split.items[0].sourceEnd, 5 * EDITOR_TICKS_PER_SECOND);
    assert.equal(split.items[1].sourceStart, 5 * EDITOR_TICKS_PER_SECOND);
    assert.equal(Object.keys(document.assets).length, 1);

    document = history.undo(document).document;
    assert.deepEqual(getVideoTrack(document), getVideoTrack(original));
  });

  it('coalesces a continuous trim gesture and preserves integer timing', () => {
    const original = fixture();
    const first = getVideoTrack(original).items[0];
    const history = new EditorCommandHistory();
    let document = history.commit(
      original,
      new TrimVideoItemCommand(first.id, 'end', 9 * EDITOR_TICKS_PER_SECOND, 2),
    ).document;
    document = history.commit(
      document,
      new TrimVideoItemCommand(first.id, 'end', 8 * EDITOR_TICKS_PER_SECOND, 3),
    ).document;
    assert.equal(history.size, 1);
    assert.equal(getVideoTrack(document).items[0].timelineEnd, 8 * EDITOR_TICKS_PER_SECOND);
    document = history.undo(document).document;
    assert.equal(getVideoTrack(document).items[0].sourceEnd, 10 * EDITOR_TICKS_PER_SECOND);
  });

  it('reflows clips after speed and reorder operations', () => {
    const original = fixture();
    const [first, second] = getVideoTrack(original).items;
    const history = new EditorCommandHistory();
    let document = history.commit(original, new SetVideoSpeedCommand(first.id, 2, 2)).document;
    assert.equal(getVideoTrack(document).items[0].timelineEnd, 5 * EDITOR_TICKS_PER_SECOND);
    document = history.commit(document, new MoveVideoItemCommand(second.id, 0, 3)).document;
    const moved = getVideoTrack(document);
    assert.equal(moved.items[0].id, second.id);
    assert.equal(moved.items[1].timelineStart, 10 * EDITOR_TICKS_PER_SECOND);
  });

  it('duplicates and deletes source references without copying assets', () => {
    const original = fixture();
    const first = getVideoTrack(original).items[0];
    const history = new EditorCommandHistory();
    let document = history.commit(
      original,
      new DuplicateVideoItemCommand(first.id, 'video_copy', 'transition_copy', 2),
    ).document;
    assert.equal(getVideoTrack(document).items.length, 3);
    assert.equal(Object.keys(document.assets).length, 1);
    document = history.commit(document, new DeleteVideoItemCommand('video_copy', 3)).document;
    assert.equal(getVideoTrack(document).items.length, 2);
  });
});
