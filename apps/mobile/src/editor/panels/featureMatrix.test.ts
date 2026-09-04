/**
 * End-to-end feature matrix for Editor V2 command + gating surface.
 * Exercises every user-facing tool path that can be verified without a device GPU.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CLIP_EFFECT_PRESETS } from '@clippster/clip-export';

import {
  SetCanvasRatioCommand,
  SetCanvasSafeAreaCommand,
  SetItemTransformCommand,
} from '../commands/canvasCommands';
import {
  EditCaptionWordCommand,
  InitializeTranscriptCaptionsCommand,
  UpdateCaptionStyleCommand,
} from '../commands/captionCommands';
import { createTextCommand } from '../commands/createTextCommand';
import { EditorCommandHistory } from '../commands/history';
import {
  DeleteTrackItemCommand,
  DuplicateTrackItemCommand,
  InsertTrackItemCommand,
  SetTransitionCommand,
  SplitAudioItemCommand,
  UpdateAudioItemCommand,
  UpdateOverlayItemCommand,
  UpdateTextItemCommand,
  defaultTextStyle,
  effectStackPatch,
} from '../commands/trackCommands';
import {
  DeleteVideoItemCommand,
  DuplicateVideoItemCommand,
  SetVideoEffectsCommand,
  SetVideoSpeedCommand,
  SetVideoVolumeCommand,
  SplitVideoItemCommand,
  TrimVideoItemCommand,
} from '../commands/videoCommands';
import { createBlankMobileEditProject, createMobileEditProject } from '../model/createProject';
import {
  createDefaultRatioAwareTransform,
  secondsToTicks,
  transformForRatio,
  type AudioItem,
  type OverlayItem,
} from '../model/schema';
import { getVideoTrack } from '../model/timeline';
import { toolsForSelection, type EditorToolId } from './toolDefinitions';

const FULL_CAPABILITIES = new Set([
  'trim',
  'split',
  'speed',
  'volume',
  'crop',
  'reframe',
  'rotate',
  'mirror',
  'overlay',
  'audio_mix',
  'opacity',
  'fade',
  'text',
  'captions',
  'dissolve',
  'fade_transition',
  'wipe',
  'color_matrix',
  'brightness',
  'exposure',
  'contrast',
  'saturation',
  'temperature',
  'tint',
  'blur',
  'sharpen',
  'grain',
  'vignette',
  'glitch',
]);

function clipFixture() {
  let sequence = 0;
  return createMobileEditProject({
    kind: 'clip',
    targetId: 'clip-1',
    source: {
      uri: '/source.mp4',
      fingerprint: 'source:123',
      durationSeconds: 60,
      sourceKind: 'clip',
      width: 1080,
      height: 1920,
      hasAudio: true,
    },
    ranges: [
      { startSeconds: 0, endSeconds: 10 },
      { startSeconds: 20, endSeconds: 30 },
    ],
    now: 1,
    idFactory: (prefix) => `${prefix}_${sequence++}`,
  });
}

describe('editor feature matrix', () => {
  it('exposes every expected contextual tool when capabilities are unlocked', () => {
    const expected: Record<string, EditorToolId[]> = {
      global: ['edit', 'text', 'captions', 'audio', 'overlay', 'effects', 'filters', 'adjust', 'add'],
      video: ['split', 'speed', 'volume', 'crop', 'reframe', 'rotate', 'replace', 'duplicate', 'delete'],
      text: ['edit', 'style', 'font', 'color', 'animation', 'duration', 'duplicate', 'delete'],
      caption: ['edit', 'style', 'font', 'color', 'animation', 'duration'],
      overlay: [
        'replace',
        'crop',
        'reframe',
        'opacity',
        'animation',
        'speed',
        'volume',
        'duplicate',
        'delete',
      ],
      audio: ['volume', 'fade', 'split', 'speed', 'duplicate', 'delete'],
      transition: ['transition', 'duration', 'delete'],
    };

    assert.deepEqual(
      toolsForSelection(null, FULL_CAPABILITIES).map((tool) => tool.id),
      expected.global,
    );
    for (const kind of ['video', 'text', 'caption', 'overlay', 'audio', 'transition'] as const) {
      assert.deepEqual(
        toolsForSelection(kind, FULL_CAPABILITIES).map((tool) => tool.id),
        expected[kind],
        `tools for ${kind}`,
      );
    }
  });

  it('hides LUT and keeps style presets renderable', () => {
    assert.ok(!FULL_CAPABILITIES.has('lut'));
    assert.ok(!CLIP_EFFECT_PRESETS.some((preset) => (preset.type as string) === 'lut'));
    for (const type of ['blur', 'sharpen', 'glitch', 'vignette', 'grain', 'mirror', 'letterbox']) {
      assert.ok(
        CLIP_EFFECT_PRESETS.some((preset) => preset.type === type),
        `missing style preset ${type}`,
      );
    }
  });

  it('applies the full video edit surface with undo', () => {
    const original = clipFixture();
    const history = new EditorCommandHistory();
    const first = getVideoTrack(original).items[0];
    let document = history.commit(
      original,
      new TrimVideoItemCommand(first.id, 'end', secondsToTicks(8), 2),
    ).document;
    document = history.commit(
      document,
      new SplitVideoItemCommand(first.id, secondsToTicks(4), 'video_split', 'transition_split', 3),
    ).document;
    document = history.commit(document, new SetVideoSpeedCommand(first.id, 1.5, 4)).document;
    document = history.commit(document, new SetVideoVolumeCommand(first.id, 0.4, 5)).document;
    document = history.commit(
      document,
      new SetVideoEffectsCommand(first.id, [{ type: 'blur', intensity: 60 }], 6),
    ).document;
    document = history.commit(
      document,
      new SetItemTransformCommand(
        first.id,
        '9:16',
        {
          ...transformForRatio(getVideoTrack(document).items[0].transform, '9:16'),
          scaleX: 1.4,
          scaleY: 1.4,
          positionX: 0.35,
          rotationDeg: 15,
          fit: 'cover',
        },
        7,
      ),
    ).document;
    document = history.commit(
      document,
      new DuplicateVideoItemCommand(first.id, 'video_copy', 'transition_copy', 8),
    ).document;
    document = history.commit(document, new DeleteVideoItemCommand('video_copy', 9)).document;
    document = history.commit(
      document,
      new SetTransitionCommand(
        getVideoTrack(document).items[1].id,
        'transition_split',
        'dissolve',
        secondsToTicks(0.5),
        10,
      ),
    ).document;
    document = history.commit(document, new SetCanvasRatioCommand('16:9', 11)).document;
    document = history.commit(document, new SetCanvasSafeAreaCommand(true, 12)).document;

    const video = getVideoTrack(document);
    assert.equal(document.canvas.activeRatio, '16:9');
    assert.equal(document.canvas.safeAreaVisible, true);
    assert.equal(video.items[0].speed, 1.5);
    assert.equal(video.items[0].volume, 0.4);
    assert.equal(video.items[0].effectStack[0]?.type, 'blur');
    assert.equal(transformForRatio(video.items[0].transform, '9:16').positionX, 0.35);
    assert.equal(video.transitions[0]?.transition, 'dissolve');

    while (history.canUndo) {
      document = history.undo(document).document;
    }
    assert.deepEqual(getVideoTrack(document).items.map((item) => item.id), getVideoTrack(original).items.map((item) => item.id));
  });

  it('applies text, overlay, audio, and caption feature paths', () => {
    const original = clipFixture();
    const history = new EditorCommandHistory();
    const created = createTextCommand('Hello', secondsToTicks(1), () => 'text_new');
    let document = history.commit(original, created.command).document;
    document = history.commit(
      document,
      new UpdateTextItemCommand(
        created.selection.id,
        {
          content: 'Title',
          animationIn: 'pop',
          animationOut: 'fade',
          style: { ...defaultTextStyle(), color: '#FACC15', fontSize: 64 },
        },
        3,
      ),
    ).document;

    const overlay: OverlayItem = {
      id: 'overlay_1',
      kind: 'overlay',
      assetId: 'overlay_asset',
      timelineStart: secondsToTicks(1),
      timelineEnd: secondsToTicks(6),
      sourceStart: 0,
      sourceEnd: secondsToTicks(5),
      speed: 1,
      volume: 0,
      opacity: 1,
      crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      transform: createDefaultRatioAwareTransform(),
      effectStack: [],
    };
    document = history.commit(
      document,
      new InsertTrackItemCommand(
        {
          trackKind: 'overlay',
          item: overlay,
          asset: {
            id: 'overlay_asset',
            kind: 'image',
            sourceKind: 'image',
            sourceUri: '/overlay.png',
            sourceFingerprint: 'overlay:1',
            durationTicks: secondsToTicks(5),
            width: 512,
            height: 512,
          },
        },
        4,
      ),
    ).document;
    document = history.commit(
      document,
      new UpdateOverlayItemCommand(
        'overlay_1',
        {
          opacity: 0.55,
          speed: 1.25,
          ...effectStackPatch([{ type: 'glitch', intensity: 40 }]),
        },
        5,
      ),
    ).document;
    document = history.commit(
      document,
      new DuplicateTrackItemCommand('overlay', 'overlay_1', 'overlay_copy', 6),
    ).document;

    const audio: AudioItem = {
      id: 'audio_1',
      kind: 'audio',
      assetId: 'audio_asset',
      timelineStart: 0,
      timelineEnd: secondsToTicks(8),
      sourceStart: 0,
      sourceEnd: secondsToTicks(8),
      speed: 1,
      volume: 1,
      fadeInTicks: 0,
      fadeOutTicks: 0,
      role: 'music',
      label: 'Bed',
    };
    document = history.commit(
      document,
      new InsertTrackItemCommand(
        {
          trackKind: 'audio',
          item: audio,
          asset: {
            id: 'audio_asset',
            kind: 'audio',
            sourceKind: 'audio',
            sourceUri: '/bed.m4a',
            sourceFingerprint: 'audio:1',
            durationTicks: secondsToTicks(30),
            hasAudio: true,
          },
        },
        7,
      ),
    ).document;
    document = history.commit(
      document,
      new UpdateAudioItemCommand(
        'audio_1',
        {
          volume: 0.3,
          fadeInTicks: secondsToTicks(0.5),
          fadeOutTicks: secondsToTicks(0.5),
          speed: 0.9,
        },
        8,
      ),
    ).document;
    document = history.commit(
      document,
      new SplitAudioItemCommand('audio_1', secondsToTicks(4), 'audio_split', 9),
    ).document;
    document = history.commit(
      document,
      new InitializeTranscriptCaptionsCommand(
        [
          { id: 'w1', word: 'Hello', start: 0, end: secondsToTicks(0.5) },
          { id: 'w2', word: 'world', start: secondsToTicks(0.5), end: secondsToTicks(1) },
        ],
        [{ id: 'p1', wordIds: ['w1', 'w2'], start: 0, end: secondsToTicks(1) }],
        10,
      ),
    ).document;
    document = history.commit(
      document,
      new EditCaptionWordCommand('w1', 'Hi', 11),
    ).document;
    document = history.commit(
      document,
      new UpdateCaptionStyleCommand(
        {
          enabled: true,
          settings: document.captionDocument!.settings,
        },
        12,
      ),
    ).document;
    document = history.commit(
      document,
      new DeleteTrackItemCommand('overlay', 'overlay_copy', 13),
    ).document;

    const text = document.tracks.find((track) => track.kind === 'text')?.items[0];
    const overlayTrack = document.tracks.find((track) => track.kind === 'overlay');
    const audioTrack = document.tracks.find((track) => track.kind === 'audio');
    assert.equal(text?.content, 'Title');
    assert.equal(text?.animationIn, 'pop');
    assert.equal(overlayTrack?.items[0].opacity, 0.55);
    assert.equal(overlayTrack?.items[0].effectStack[0]?.type, 'glitch');
    assert.equal(overlayTrack?.items.length, 1);
    assert.equal(audioTrack?.items.length, 2);
    assert.equal(audioTrack?.items[0].volume, 0.3);
    assert.equal(document.captionDocument?.enabled, true);
    assert.equal(document.captionDocument?.words[0].word, 'Hi');
  });

  it('builds a blank editor project ready for import tools', () => {
    let sequence = 0;
    const blank = createBlankMobileEditProject({
      targetId: 'blank',
      now: 1,
      idFactory: (prefix) => `${prefix}_${sequence++}`,
    });
    assert.equal(blank.kind, 'project');
    assert.equal(getVideoTrack(blank).items.length, 0);
    assert.ok(blank.tracks.some((track) => track.kind === 'overlay'));
    assert.ok(blank.tracks.some((track) => track.kind === 'audio'));
    assert.ok(blank.tracks.some((track) => track.kind === 'text'));
  });
});
