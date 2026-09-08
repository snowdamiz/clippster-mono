import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mapTranscriptToEditorCaptions } from '../captions/transcriptAdapter';
import { createMobileEditProject } from '../model/createProject';
import {
  createDefaultRatioAwareTransform,
  secondsToTicks,
  type OverlayItem,
  type TimedTextItem,
} from '../model/schema';
import { getVideoTrack } from '../model/timeline';
import {
  EditCaptionWordCommand,
  InitializeTranscriptCaptionsCommand,
  MergeCaptionPhrasesCommand,
  RetimeCaptionWordCommand,
  SplitCaptionPhraseCommand,
} from './captionCommands';
import { EditorCommandHistory } from './history';
import {
  InsertTrackItemCommand,
  SetTransitionCommand,
  UpdateOverlayItemCommand,
  UpdateTextItemCommand,
  defaultTextStyle,
} from './trackCommands';
import { MoveVideoItemCommand, SetVideoSpeedCommand } from './videoCommands';

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

describe('non-video track commands', () => {
  it('adds and edits timed text with one coalesced undo action', () => {
    const original = fixture();
    const history = new EditorCommandHistory();
    const text: TimedTextItem = {
      id: 'text-1',
      kind: 'text',
      timelineStart: 0,
      timelineEnd: secondsToTicks(5),
      content: 'Hello',
      style: defaultTextStyle(),
      transform: createDefaultRatioAwareTransform(),
    };
    let document = history.commit(
      original,
      new InsertTrackItemCommand({ trackKind: 'text', item: text }, 2),
    ).document;
    document = history.commit(
      document,
      new UpdateTextItemCommand('text-1', { content: 'Hello world' }, 3),
    ).document;
    document = history.commit(
      document,
      new UpdateTextItemCommand('text-1', { content: 'Hello world!' }, 4),
    ).document;
    assert.equal(history.size, 2);
    const track = document.tracks.find((candidate) => candidate.kind === 'text');
    assert.equal(track?.items[0].content, 'Hello world!');

    document = history.undo(document).document;
    const restored = document.tracks.find((candidate) => candidate.kind === 'text');
    assert.equal(restored?.items[0].content, 'Hello');
  });

  it('adds an overlay asset and removes both item and asset on undo', () => {
    const original = fixture();
    const history = new EditorCommandHistory();
    const item: OverlayItem = {
      id: 'overlay-1',
      kind: 'overlay',
      assetId: 'overlay-asset',
      timelineStart: secondsToTicks(2),
      timelineEnd: secondsToTicks(7),
      sourceStart: 0,
      sourceEnd: secondsToTicks(5),
      speed: 1,
      volume: 0,
      opacity: 1,
      crop: { x: 0, y: 0, width: 1, height: 1 },
      transform: createDefaultRatioAwareTransform(),
      effectStack: [],
    };
    let document = history.commit(
      original,
      new InsertTrackItemCommand(
        {
          trackKind: 'overlay',
          item,
          asset: {
            id: 'overlay-asset',
            kind: 'image',
            sourceKind: 'image',
            sourceUri: '/overlay.png',
            sourceFingerprint: 'overlay:1',
            durationTicks: secondsToTicks(5),
          },
        },
        2,
      ),
    ).document;
    document = history.commit(
      document,
      new UpdateOverlayItemCommand('overlay-1', { opacity: 0.5 }, 3),
    ).document;
    assert.equal(document.assets['overlay-asset'].sourceUri, '/overlay.png');
    const track = document.tracks.find((candidate) => candidate.kind === 'overlay');
    assert.equal(track?.items[0].opacity, 0.5);

    document = history.undo(document).document;
    document = history.undo(document).document;
    assert.equal(document.assets['overlay-asset'], undefined);
  });

  it('stores deterministic transitions between adjacent clips', () => {
    const original = fixture();
    const second = getVideoTrack(original).items[1];
    const history = new EditorCommandHistory();
    const document = history.commit(
      original,
      new SetTransitionCommand(
        second.id,
        'transition-1',
        'dissolve',
        secondsToTicks(0.5),
        2,
      ),
    ).document;
    const track = getVideoTrack(document);
    assert.equal(track.transitions[0].transition, 'dissolve');
    assert.equal(track.items[1].timelineStart, secondsToTicks(9.5));
  });
});

describe('caption commands', () => {
  it('maps transcript timing after speed and reorder, then edits phrases losslessly', () => {
    let document = fixture();
    const history = new EditorCommandHistory();
    const [first, second] = getVideoTrack(document).items;
    document = history.commit(document, new SetVideoSpeedCommand(first.id, 2, 2)).document;
    document = history.commit(document, new MoveVideoItemCommand(second.id, 0, 3)).document;

    let sequence = 0;
    const mapped = mapTranscriptToEditorCaptions(
      document,
      {
        '/source.mp4': [
          { word: 'later', start: 22, end: 23 },
          { word: 'hello', start: 2, end: 3 },
          { word: 'world', start: 4, end: 5 },
        ],
      },
      (prefix) => `${prefix}_${sequence++}`,
    );
    assert.deepEqual(mapped.words.map((word) => word.word), ['later', 'hello', 'world']);
    assert.equal(mapped.words[0].start, secondsToTicks(2));
    assert.equal(mapped.words[1].start, secondsToTicks(11));

    document = history.commit(
      document,
      new InitializeTranscriptCaptionsCommand(mapped.words, mapped.phrases, 4),
    ).document;
    const phraseToSplit = document.captionDocument!.phrases[1];
    const splitWord = phraseToSplit.wordIds[1];
    document = history.commit(
      document,
      new EditCaptionWordCommand(mapped.words[0].id, 'Later!', 5),
    ).document;
    document = history.commit(
      document,
      new RetimeCaptionWordCommand(
        mapped.words[0].id,
        secondsToTicks(2.2),
        secondsToTicks(3.2),
        6,
      ),
    ).document;
    document = history.commit(
      document,
      new SplitCaptionPhraseCommand(phraseToSplit.id, splitWord, 'phrase-split', 7),
    ).document;
    assert.equal(document.captionDocument!.phrases.length, 3);
    document = history.commit(
      document,
      new MergeCaptionPhrasesCommand(phraseToSplit.id, 'phrase-split', 8),
    ).document;
    assert.equal(document.captionDocument!.phrases.length, 2);
    assert.equal(document.captionDocument!.words[0].word, 'Later!');
  });
});
