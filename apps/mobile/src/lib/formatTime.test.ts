import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatPlaybackClock } from './formatTime';

describe('formatPlaybackClock', () => {
  it('always includes minutes and hundredths', () => {
    assert.equal(formatPlaybackClock(13.71), '0:13.71');
    assert.equal(formatPlaybackClock(656.32), '10:56.32');
    assert.equal(formatPlaybackClock(0), '0:00.00');
    assert.equal(formatPlaybackClock(0.01), '0:00.01');
    assert.equal(formatPlaybackClock(0.02), '0:00.02');
    assert.equal(formatPlaybackClock(0.03), '0:00.03');
  });
});
