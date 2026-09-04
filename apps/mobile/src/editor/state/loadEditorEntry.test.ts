import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createDefaultClipTextBoxState,
  type Clip,
  type Project,
  type RawVideo,
  type Transcript,
} from '@clippster/shared-types';

import { getVideoTrack } from '../model/timeline';
import { LocalDraftRepository, type DraftStorage } from '../persistence/draftRepository';
import {
  loadEditorEntry,
  type EditorEntryDataSource,
  type LoadEditorEntryDependencies,
} from './loadEditorEntry';

class MemoryStorage implements DraftStorage {
  readonly values = new Map<string, string>();
  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  async removeItem(key: string) {
    this.values.delete(key);
  }
}

const project: Project = {
  id: 'project-1',
  name: 'Project',
  description: null,
  thumbnail_path: null,
  parent_id: null,
  active_vod_preset_id: 'preset-1',
  active_vod_preset_config: JSON.stringify({
    presetId: 'preset-1',
    targetAspectRatio: '9:16',
    framingConfig: null,
    layoutOverlays: [],
    watermarkMode: 'creator',
    customWatermarkSettings: null,
    orgBranding: { organizationId: 12, campaignId: 34 },
  }),
  created_at: 1,
  updated_at: 1,
};

const raw: RawVideo = {
  id: 'raw-1',
  project_id: project.id,
  file_path: '/source.mp4',
  duration: 90,
  width: 1920,
  height: 1080,
  codec: 'h264',
  file_size: 100,
  created_at: 1,
  updated_at: 1,
};

const transcript: Transcript = {
  id: 'transcript-1',
  raw_video_id: raw.id,
  raw_json: JSON.stringify({
    words: [
      { word: 'first', start: 11, end: 12 },
      { word: 'second', start: 31, end: 32 },
    ],
  }),
  language: 'en',
  duration: 90,
  created_at: 1,
  updated_at: 1,
};

function clip(id: string, start = 10, end = 40): Clip {
  return {
    id,
    project_id: project.id,
    name: id,
    file_path: '/source.mp4',
    duration: end - start,
    start_time: start,
    end_time: end,
    current_version_id: null,
    detection_session_id: id.startsWith('detected') ? 'session-1' : null,
    subtitle_enabled: 1,
    subtitle_preset_id: 'tiktok-bold',
    created_at: 1,
    updated_at: 1,
  };
}

function dependencies(options: {
  targetClip: Clip;
  segments?: { start_time: number; end_time: number; duration: number; transcript: null }[];
  mediaExists?: boolean;
}): LoadEditorEntryDependencies {
  const data: EditorEntryDataSource = {
    getClipById: async (id) => (id === options.targetClip.id ? options.targetClip : null),
    getClipSegmentsByClipId: async () => options.segments ?? [],
    getClipSubtitleSettings: async () => null,
    getClipTextOverlay: async () => ({
      ...createDefaultClipTextBoxState(5),
      text: 'Imported title',
      perRatioConfigs: {
        '16:9': {
          position: { x: 25, y: 30 },
          style: createDefaultClipTextBoxState(5).style,
          rotation: 5,
          scale: 1,
        },
      },
    }),
    getProject: async (id) => (id === project.id ? project : null),
    getRawVideoByProjectId: async (id) => (id === project.id ? raw : null),
    getTranscriptByProjectId: async () => transcript,
  };
  let sequence = 0;
  return {
    data,
    drafts: new LocalDraftRepository(new MemoryStorage(), { now: () => 100 }),
    idFactory: (prefix) => `${prefix}_${sequence++}`,
    fingerprint: async () => 'local:100:1',
    probeMedia: async () =>
      options.mediaExists === false
        ? { exists: false }
        : { exists: true, fingerprint: 'local:100:1' },
    now: () => 100,
  };
}

describe('loadEditorEntry', () => {
  it('initializes a detected clip with all segments, captions, text, and branding', async () => {
    const loaded = await loadEditorEntry(
      'clip',
      'detected-1',
      dependencies({
        targetClip: clip('detected-1'),
        segments: [
          { start_time: 10, end_time: 20, duration: 10, transcript: null },
          { start_time: 30, end_time: 40, duration: 10, transcript: null },
        ],
      }),
    );
    const videos = getVideoTrack(loaded.document).items;
    assert.equal(videos.length, 2);
    assert.equal(videos[0].sourceStart, 600_000);
    assert.equal(videos[1].sourceStart, 1_800_000);
    assert.deepEqual(
      loaded.document.captionDocument?.words.map((word) => word.word),
      ['first', 'second'],
    );
    assert.equal(
      loaded.document.tracks.find((track) => track.kind === 'text')?.items[0].content,
      'Imported title',
    );
    assert.equal(loaded.document.branding?.organizationId, 12);
    assert.equal(loaded.missingMedia.length, 0);
  });

  it('gives a manual clip the same document and editing contract', async () => {
    const loaded = await loadEditorEntry(
      'clip',
      'manual-1',
      dependencies({ targetClip: clip('manual-1', 20, 35) }),
    );
    const video = getVideoTrack(loaded.document).items[0];
    assert.equal(loaded.document.kind, 'clip');
    assert.equal(video.sourceStart, 1_200_000);
    assert.equal(video.sourceEnd, 2_100_000);
    assert.ok(loaded.document.captionDocument);
    assert.ok(loaded.document.tracks.some((track) => track.kind === 'overlay'));
    assert.ok(loaded.document.tracks.some((track) => track.kind === 'audio'));
  });

  it('keeps a missing source reference and returns a recoverable media state', async () => {
    const loaded = await loadEditorEntry(
      'clip',
      'manual-1',
      dependencies({ targetClip: clip('manual-1'), mediaExists: false }),
    );
    assert.equal(loaded.missingMedia.length, 1);
    assert.equal(loaded.missingMedia[0].reason, 'missing');
    assert.equal(loaded.missingMedia[0].asset.sourceUri, '/source.mp4');
    assert.equal(getVideoTrack(loaded.document).items.length, 1);
  });

  it('initializes project-first editing without materializing a clip on open', async () => {
    const loaded = await loadEditorEntry(
      'project',
      project.id,
      dependencies({ targetClip: clip('unused') }),
    );
    assert.equal(loaded.document.kind, 'project');
    assert.equal(loaded.document.linkedClipId, undefined);
    assert.equal(getVideoTrack(loaded.document).items[0].sourceEnd, 1_800_000);
  });
});
