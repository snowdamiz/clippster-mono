import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { secondsToTicks } from '../model/schema';
import {
  focalTimeForPinch,
  offsetPreservingFocalTime,
  scrollOffsetForTick,
  snapTimelineTick,
  tickForScrollOffset,
  timelineViewportHeight,
  TIMELINE_SECONDARY_TRACK_TOP,
} from './timelineGeometry';

describe('fixed-playhead timeline geometry', () => {
  it('maps centered scroll offset to the canonical integer timebase', () => {
    const tick = secondsToTicks(12.5);
    const offset = scrollOffsetForTick(tick, 40);
    assert.equal(offset, 500);
    assert.equal(tickForScrollOffset(offset, 40), tick);
  });

  it('preserves media time beneath an off-center pinch focal point', () => {
    const beforeOffset = 400;
    const focalX = 260;
    const viewportWidth = 400;
    const focalTick = focalTimeForPinch(beforeOffset, focalX, viewportWidth, 40);
    const afterOffset = offsetPreservingFocalTime(focalTick, focalX, viewportWidth, 80);
    assert.equal(
      focalTimeForPinch(afterOffset, focalX, viewportWidth, 80),
      focalTick,
    );
  });

  it('snaps only within the visible pixel threshold', () => {
    const boundaries = [secondsToTicks(5), secondsToTicks(10)];
    assert.deepEqual(
      snapTimelineTick(secondsToTicks(5.1), boundaries, 8, 40),
      { tick: secondsToTicks(5), snapped: true },
    );
    assert.deepEqual(
      snapTimelineTick(secondsToTicks(6), boundaries, 8, 40),
      { tick: secondsToTicks(6), snapped: false },
    );
  });

  it('sizes the timeline for two track rows by default and grows with more tracks', () => {
    const emptyHeight = timelineViewportHeight(0);
    const oneSecondary = timelineViewportHeight(1);
    const threeSecondary = timelineViewportHeight(3);
    assert.equal(emptyHeight, oneSecondary);
    assert.ok(emptyHeight > TIMELINE_SECONDARY_TRACK_TOP);
    assert.equal(threeSecondary - oneSecondary, 100);
  });
});
