import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SetCanvasRatioCommand, SetItemTransformCommand } from '../commands/canvasCommands';
import { EditorCommandHistory } from '../commands/history';
import { createBlankMobileEditProject, createMobileEditProject } from './createProject';
import { migrateMobileEditProject } from './migrations';
import {
  EDITOR_TICKS_PER_SECOND,
  frameToTicks,
  ticksToFrame,
  transformForRatio,
} from './schema';
import { validateMobileEditProject } from './validation';

function fixture() {
  let sequence = 0;
  return createMobileEditProject({
    kind: 'clip',
    targetId: 'clip-1',
    projectId: 'project-1',
    source: {
      uri: '/source.mp4',
      fingerprint: 'source:1:1234',
      durationSeconds: 60,
      sourceKind: 'clip',
      sourceId: 'clip-1',
      hasAudio: true,
    },
    ranges: [{ startSeconds: 10, endSeconds: 30 }],
    now: 100,
    idFactory: (prefix) => `${prefix}_${sequence++}`,
  });
}

describe('mobile edit project v3', () => {
  it('creates a valid blank project for the standalone editor', () => {
    let sequence = 0;
    const document = createBlankMobileEditProject({
      targetId: 'standalone-editor',
      now: 100,
      idFactory: (prefix) => `${prefix}_${sequence++}`,
    });
    assert.equal(validateMobileEditProject(document).valid, true);
    assert.equal(Object.keys(document.assets).length, 0);
    assert.equal(document.tracks.every((track) => track.items.length === 0), true);
  });

  it('creates a validated immutable-source document with both output ratios', () => {
    const document = fixture();
    assert.equal(validateMobileEditProject(document).valid, true);
    assert.deepEqual(document.canvas.outputByRatio['9:16'], {
      width: 1080,
      height: 1920,
      fps: 30,
    });
    assert.deepEqual(document.canvas.outputByRatio['16:9'], {
      width: 1920,
      height: 1080,
      fps: 30,
    });
    const videoTrack = document.tracks.find((track) => track.kind === 'video');
    assert.equal(videoTrack?.items[0].sourceStart, 10 * EDITOR_TICKS_PER_SECOND);
    assert.equal(document.assets.asset_1.sourceUri, '/source.mp4');
  });

  it('uses exact integer frame conversions at supported frame rates', () => {
    assert.equal(frameToTicks(1, 30), 2_000);
    assert.equal(frameToTicks(1, 60), 1_000);
    assert.equal(ticksToFrame(frameToTicks(123, 60), 60), 123);
  });

  it('preserves independent per-ratio transforms through undo and redo', () => {
    const original = fixture();
    const videoTrack = original.tracks.find((track) => track.kind === 'video');
    assert.ok(videoTrack);
    const item = videoTrack.items[0];
    const history = new EditorCommandHistory(10);
    const portrait = { ...transformForRatio(item.transform, '9:16'), positionX: 0.2 };
    const landscape = { ...transformForRatio(item.transform, '16:9'), positionX: 0.8 };

    let document = history.commit(
      original,
      new SetItemTransformCommand(item.id, '9:16', portrait, 101),
    ).document;
    document = history.commit(
      document,
      new SetItemTransformCommand(item.id, '16:9', landscape, 102),
    ).document;
    document = history.commit(document, new SetCanvasRatioCommand('16:9', 103)).document;

    const transformedTrack = document.tracks.find((track) => track.kind === 'video');
    assert.ok(transformedTrack);
    assert.equal(transformForRatio(transformedTrack.items[0].transform, '9:16').positionX, 0.2);
    assert.equal(transformForRatio(transformedTrack.items[0].transform, '16:9').positionX, 0.8);
    assert.equal(document.canvas.activeRatio, '16:9');

    document = history.undo(document).document;
    assert.equal(document.canvas.activeRatio, '9:16');
    document = history.redo(document).document;
    assert.equal(document.canvas.activeRatio, '16:9');
  });

  it('coalesces continuous transform commits into one undo step', () => {
    const original = fixture();
    const videoTrack = original.tracks.find((track) => track.kind === 'video');
    assert.ok(videoTrack);
    const item = videoTrack.items[0];
    const history = new EditorCommandHistory();
    let document = original;
    for (const positionX of [0.55, 0.6, 0.65]) {
      document = history.commit(
        document,
        new SetItemTransformCommand(
          item.id,
          '9:16',
          { ...transformForRatio(item.transform, '9:16'), positionX },
          101,
        ),
      ).document;
    }
    assert.equal(history.size, 1);
    document = history.undo(document).document;
    const restoredTrack = document.tracks.find((track) => track.kind === 'video');
    assert.ok(restoredTrack);
    assert.equal(transformForRatio(restoredTrack.items[0].transform, '9:16').positionX, 0.5);
  });

  it('migrates a v2 draft without changing source ranges or media references', () => {
    const migrated = migrateMobileEditProject(
      {
        version: 2,
        kind: 'clip',
        targetId: 'clip-1',
        projectId: 'project-1',
        videos: [
          {
            id: 'legacy-video',
            sourceKind: 'clip',
            sourceId: 'clip-1',
            sourcePath: '/source.mp4',
            sourceDuration: 60,
            sourceStart: 10,
            sourceEnd: 30,
            speed: 1,
            muted: false,
            transitionIn: 'none',
            effect: null,
            label: 'Clip',
          },
        ],
        images: [],
        audio: [],
        captions: fixture().captionDocument
          ? {
              enabled: true,
              presetId: fixture().captionDocument!.presetId,
              settings: fixture().captionDocument!.settings,
            }
          : undefined,
      },
      { now: 200 },
    );
    const videoTrack = migrated.tracks.find((track) => track.kind === 'video');
    assert.ok(videoTrack);
    assert.equal(videoTrack.items[0].id, 'legacy-video');
    assert.equal(videoTrack.items[0].sourceStart, 10 * EDITOR_TICKS_PER_SECOND);
    assert.equal(videoTrack.items[0].sourceEnd, 30 * EDITOR_TICKS_PER_SECOND);
    assert.equal(migrated.assets[videoTrack.items[0].assetId].sourceUri, '/source.mp4');
  });

  it('rejects invalid dimensions and dangling media references', () => {
    const document = fixture();
    const invalid = structuredClone(document);
    invalid.canvas.outputByRatio['9:16'].width = 720;
    const videoTrack = invalid.tracks.find((track) => track.kind === 'video');
    assert.ok(videoTrack);
    videoTrack.items[0].assetId = 'missing';
    const result = validateMobileEditProject(invalid);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes('1080x1920')));
    assert.ok(result.errors.some((error) => error.includes('does not reference an asset')));
  });
});
