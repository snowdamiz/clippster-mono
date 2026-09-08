import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SetCanvasRatioCommand } from '../commands/canvasCommands';
import { createMobileEditProject } from '../model/createProject';
import { MobileEditorController } from '../state/editorController';
import {
  DraftLoadError,
  LocalDraftRepository,
  type DraftStorage,
} from './draftRepository';
import { findUnavailableMedia } from './mediaRecovery';

class MemoryStorage implements DraftStorage {
  readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

function fixture() {
  let sequence = 0;
  return createMobileEditProject({
    kind: 'clip',
    targetId: 'clip-1',
    source: {
      uri: '/source.mp4',
      fingerprint: 'source:123',
      durationSeconds: 30,
      sourceKind: 'clip',
    },
    ranges: [{ startSeconds: 0, endSeconds: 20 }],
    now: 1,
    idFactory: (prefix) => `${prefix}_${sequence++}`,
  });
}

describe('LocalDraftRepository', () => {
  it('writes a verified pending record before committing current', async () => {
    const storage = new MemoryStorage();
    const repository = new LocalDraftRepository(storage, { now: () => 100 });
    const saved = await repository.save(fixture());
    assert.equal(saved.revision, 1);
    assert.equal(storage.values.has('clippster.mobileEdit.v3.clip.clip-1.pending'), false);

    const loaded = await repository.load('clip', 'clip-1');
    assert.equal(loaded?.source, 'current');
    assert.equal(loaded?.revision, 1);
    assert.equal(loaded?.document.assets.asset_1.sourceFingerprint, 'source:123');
  });

  it('retains and recovers the last-known-good revision', async () => {
    const storage = new MemoryStorage();
    let now = 100;
    const repository = new LocalDraftRepository(storage, { now: () => now++ });
    const original = fixture();
    await repository.save(original);
    await repository.save({ ...original, updatedAt: 2 }, 1);
    storage.values.set('clippster.mobileEdit.v3.clip.clip-1.current', '{corrupt');

    const recovered = await repository.load('clip', 'clip-1');
    assert.equal(recovered?.source, 'last-known-good');
    assert.equal(recovered?.recovered, true);
    assert.equal(recovered?.revision, 1);
  });

  it('recovers a fully written pending revision after an interrupted commit', async () => {
    const storage = new MemoryStorage();
    const repository = new LocalDraftRepository(storage, { now: () => 100 });
    const original = fixture();
    const saved = await repository.save(original);
    const root = 'clippster.mobileEdit.v3.clip.clip-1';
    storage.values.set(
      `${root}.pending`,
      JSON.stringify({ ...saved, revision: 2, document: { ...saved.document, updatedAt: 2 } }),
    );

    const recovered = await repository.load('clip', 'clip-1');
    assert.equal(recovered?.source, 'pending');
    assert.equal(recovered?.revision, 2);
  });

  it('atomically migrates a legacy v2 key and removes it only after commit', async () => {
    const storage = new MemoryStorage();
    const repository = new LocalDraftRepository(storage, { now: () => 100 });
    const captions = fixture().captionDocument!;
    const legacyKey = 'clippster.editDoc.v1.clip.clip-1';
    storage.values.set(
      legacyKey,
      JSON.stringify({
        version: 2,
        kind: 'clip',
        targetId: 'clip-1',
        videos: [
          {
            id: 'legacy-video',
            sourceKind: 'clip',
            sourcePath: '/source.mp4',
            sourceDuration: 30,
            sourceStart: 0,
            sourceEnd: 20,
            speed: 1,
            muted: false,
            transitionIn: 'none',
            label: 'Clip',
          },
        ],
        images: [],
        audio: [],
        captions: {
          enabled: true,
          presetId: captions.presetId,
          settings: captions.settings,
        },
      }),
    );

    const loaded = await repository.load('clip', 'clip-1');
    assert.equal(loaded?.source, 'legacy');
    assert.equal(loaded?.document.schemaVersion, 3);
    assert.equal(loaded?.revision, 1);
    assert.equal(storage.values.has(legacyKey), false);
    assert.equal(storage.values.has('clippster.mobileEdit.v3.clip.clip-1.current'), true);
  });

  it('surfaces unrecoverable corruption instead of returning a blank draft', async () => {
    const storage = new MemoryStorage();
    storage.values.set('clippster.mobileEdit.v3.clip.clip-1.current', '{corrupt');
    const repository = new LocalDraftRepository(storage);
    await assert.rejects(
      () => repository.load('clip', 'clip-1'),
      (error: unknown) => error instanceof DraftLoadError,
    );
  });
});

describe('MobileEditorController', () => {
  it('autosaves commands and exports an immutable revision snapshot', async () => {
    const storage = new MemoryStorage();
    const repository = new LocalDraftRepository(storage, { now: () => 100 });
    const controller = new MobileEditorController(fixture(), repository, 0, 10, 60_000);
    controller.commit(new SetCanvasRatioCommand('16:9', 2));
    const exportSnapshot = controller.exportSnapshot();
    controller.commit(new SetCanvasRatioCommand('9:16', 3));
    const video = controller.snapshot.document.tracks.find((track) => track.kind === 'video')!.items[0];
    controller.updateSession({
      playheadTick: 60_000,
      selection: { kind: 'video', id: video.id },
    });

    assert.equal(exportSnapshot.canvas.activeRatio, '16:9');
    assert.equal(controller.snapshot.document.canvas.activeRatio, '9:16');
    await controller.flush();
    assert.equal(controller.snapshot.revision, 1);
    assert.equal(controller.snapshot.dirty, false);
    const loaded = await repository.load('clip', 'clip-1');
    assert.equal(loaded?.document.canvas.activeRatio, '9:16');
    assert.equal(loaded?.session.playheadTick, 60_000);
    assert.equal(loaded?.session.selection?.id, video.id);
  });
});

describe('media recovery', () => {
  it('reports missing and changed sources without mutating their references', async () => {
    const document = fixture();
    const originalUri = document.assets.asset_1.sourceUri;
    const missing = await findUnavailableMedia(document, async (asset) => ({
      exists: true,
      fingerprint: `${asset.sourceFingerprint}:changed`,
    }));
    assert.equal(missing[0].reason, 'changed');
    assert.equal(missing[0].asset.sourceUri, originalUri);

    const unavailable = await findUnavailableMedia(document, async () => ({ exists: false }));
    assert.equal(unavailable[0].reason, 'missing');
    assert.equal(document.assets.asset_1.sourceUri, originalUri);
  });
});
