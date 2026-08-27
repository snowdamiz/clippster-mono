import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIMELINE_MAX_SECONDS,
  addAudioToTimeline,
  addImageToTimeline,
  addVideoToTimeline,
  createEditDocument,
  createVideoClip,
  deleteTimelineItem,
  getActiveTransition,
  remainingTimeline,
  resolveTimelineTime,
  setClipEffect,
  setClipSpeed,
  setTransitionIn,
  setVideoMuted,
  splitAtPlayhead,
  timelineDuration,
  trimTimelineVideo,
  withSourceDuration,
  mapWordsToTimeline,
} from './editDocument';

function doc(duration = 600) {
  return createEditDocument({
    kind: 'project',
    targetId: 'p1',
    sourcePath: '/video.mp4',
    sourceDuration: duration,
  });
}

describe('editDocument', () => {
  it('starts with a short slice of a long VOD, not the first two minutes', () => {
    const created = doc(600);
    assert.equal(created.videos[0].sourceStart, 0);
    assert.equal(created.videos[0].sourceEnd, 30);
    assert.equal(created.videos[0].sourceDuration, 600);
    assert.equal(timelineDuration(created), 30);
    assert.ok(timelineDuration(created) < TIMELINE_MAX_SECONDS);
  });

  it('lets a trim pull from later in the source as long as the timeline stays under two minutes', () => {
    const created = doc(600);
    const trimmed = trimTimelineVideo(created, created.videos[0].id, 'end', 90);
    assert.equal(trimmed.videos[0].sourceEnd, 90);
    assert.equal(timelineDuration(trimmed), 90);

    const tooLong = trimTimelineVideo(trimmed, trimmed.videos[0].id, 'end', 180);
    assert.equal(tooLong.videos[0].sourceEnd, 90);
  });

  it('uses the full clip range when it is already under two minutes', () => {
    const created = createEditDocument({
      kind: 'clip',
      targetId: 'c1',
      sourcePath: '/video.mp4',
      sourceDuration: 400,
      sourceStart: 90,
      sourceEnd: 130,
    });
    assert.equal(created.videos[0].sourceStart, 90);
    assert.equal(created.videos[0].sourceEnd, 130);
    assert.equal(timelineDuration(created), 40);
  });

  it('adds another source only up to the remaining two-minute budget', () => {
    const started = createEditDocument({
      kind: 'project',
      targetId: 'p1',
      sourcePath: '/video.mp4',
      sourceDuration: 600,
      sourceStart: 0,
      sourceEnd: 90,
    });
    const added = addVideoToTimeline(
      started,
      createVideoClip({
        sourceKind: 'clip',
        sourcePath: '/other.mp4',
        sourceDuration: 80,
        sourceStart: 0,
        sourceEnd: 80,
        label: 'Other clip',
      }),
    );
    assert.equal(added.videos.length, 2);
    assert.ok(Math.abs(timelineDuration(added) - TIMELINE_MAX_SECONDS) < 0.01);
    assert.ok(Math.abs(added.videos[1].sourceEnd - 30) < 0.01);
    assert.equal(remainingTimeline(added), 0);
  });

  it('splits, deletes, and mutes video tracks', () => {
    const created = createEditDocument({
      kind: 'project',
      targetId: 'p1',
      sourcePath: '/video.mp4',
      sourceDuration: 90,
      sourceStart: 0,
      sourceEnd: 90,
    });
    const split = splitAtPlayhead(created, 30);
    assert.equal(split.videos.length, 2);
    const muted = setVideoMuted(split, split.videos[0].id, true);
    assert.equal(muted.videos[0].muted, true);
    const removed = deleteTimelineItem(muted, muted.videos[0].id);
    assert.equal(removed.videos.length, 1);
    assert.equal(removed.videos[0].sourceStart, 30);
  });

  it('rejects a speed change that would exceed two minutes', () => {
    const created = createEditDocument({
      kind: 'project',
      targetId: 'p1',
      sourcePath: '/video.mp4',
      sourceDuration: 120,
      sourceStart: 0,
      sourceEnd: 120,
    });
    const slowed = setClipSpeed(created, created.videos[0].id, 0.5);
    assert.equal(slowed.videos[0].speed, 1);
  });

  it('maps timeline time back to source time across assembled clips', () => {
    const started = createEditDocument({
      kind: 'project',
      targetId: 'p1',
      sourcePath: '/a.mp4',
      sourceDuration: 600,
      sourceStart: 200,
      sourceEnd: 220,
    });
    const added = addVideoToTimeline(
      started,
      createVideoClip({
        sourceKind: 'upload',
        sourcePath: '/b.mp4',
        sourceDuration: 40,
        sourceStart: 0,
        sourceEnd: 20,
      }),
    );
    const resolved = resolveTimelineTime(added, 25);
    assert.ok(resolved);
    assert.equal(resolved?.clipIndex, 1);
    assert.ok(Math.abs((resolved?.sourceTime ?? 0) - 5) < 0.01);
  });

  it('places images and music on the assembled timeline', () => {
    const created = createEditDocument({
      kind: 'project',
      targetId: 'p1',
      sourcePath: '/video.mp4',
      sourceDuration: 90,
      sourceStart: 0,
      sourceEnd: 40,
    });
    const withImage = addImageToTimeline(created, { sourcePath: '/pic.png', timelineStart: 10 });
    assert.equal(withImage.images.length, 1);
    assert.equal(withImage.images[0].timelineStart, 10);
    assert.equal(withImage.images[0].duration, 5);

    const withMusic = addAudioToTimeline(withImage, {
      sourcePath: '/song.mp3',
      sourceDuration: 180,
      timelineStart: 0,
    });
    assert.equal(withMusic.audio.length, 1);
    assert.equal(withMusic.audio[0].sourceEnd, 40);
  });

  it('maps caption words onto the assembled timeline', () => {
    const started = createEditDocument({
      kind: 'project',
      targetId: 'p1',
      sourcePath: '/phone.mp4',
      sourceDuration: 40,
      sourceStart: 10,
      sourceEnd: 20,
    });
    const mapped = mapWordsToTimeline(started, {
      '/phone.mp4': [{ word: 'hey', start: 12, end: 13 }],
    });
    assert.equal(mapped.length, 1);
    assert.equal(mapped[0].word, 'hey');
    assert.ok(Math.abs(mapped[0].start - 2) < 0.01);
    assert.ok(Math.abs(mapped[0].end - 3) < 0.01);
  });

  it('stores a clip effect on the selected video', () => {
    const created = doc(40);
    const next = setClipEffect(created, created.videos[0].id, { type: 'sepia', intensity: 70 });
    assert.equal(next.videos[0].effect?.type, 'sepia');
    assert.equal(next.videos[0].effect?.intensity, 70);
    const cleared = setClipEffect(next, next.videos[0].id, null);
    assert.equal(cleared.videos[0].effect, null);
  });

  it('overlaps assembled time when a transition is set between clips', () => {
    const started = createEditDocument({
      kind: 'project',
      targetId: 'p1',
      sourcePath: '/a.mp4',
      sourceDuration: 20,
      sourceStart: 0,
      sourceEnd: 10,
    });
    const added = addVideoToTimeline(
      started,
      createVideoClip({
        sourceKind: 'upload',
        sourcePath: '/b.mp4',
        sourceDuration: 10,
        sourceStart: 0,
        sourceEnd: 10,
      }),
    );
    assert.equal(timelineDuration(added), 20);
    const dissolved = setTransitionIn(added, added.videos[1].id, 'dissolve');
    assert.ok(Math.abs(timelineDuration(dissolved) - 19.5) < 0.01);
    const atJoin = getActiveTransition(dissolved, 9.75);
    assert.equal(atJoin?.kind, 'dissolve');
    assert.ok((atJoin?.progress ?? 0) > 0.4 && (atJoin?.progress ?? 1) < 0.6);
    assert.equal(resolveTimelineTime(dissolved, 9.75)?.clip.id, dissolved.videos[1].id);
  });

  it('fills in a source duration without clamping a long video to two minutes', () => {
    const created = createEditDocument({
      kind: 'project',
      targetId: 'p1',
      sourcePath: '/video.mp4',
      sourceDuration: 0,
      sourceStart: 0,
      sourceEnd: 30,
    });
    const ready = withSourceDuration(created, '/video.mp4', 540);
    assert.equal(ready.videos[0].sourceDuration, 540);
    assert.equal(ready.videos[0].sourceEnd, 30);
    assert.equal(timelineDuration(ready), 30);
  });
});
