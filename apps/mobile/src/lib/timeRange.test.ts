import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatClockTime, parseClockTime } from './timeRange';

describe('precise video range clock input', () => {
  it('accepts minute and hour clock values', () => {
    assert.equal(parseClockTime('12:08'), 728);
    assert.equal(parseClockTime('01:12:08'), 4328);
    assert.equal(parseClockTime('00:00'), 0);
  });
  it('rejects incomplete, negative and overflowing fields', () => {
    for (const input of ['', '12', '1:', '-1:20', '1:60', '1:60:00', 'abc:00']) assert.equal(parseClockTime(input), null);
  });
  it('round-trips source video positions', () => {
    for (const seconds of [0, 59, 60, 728, 3600, 4328, 359999]) assert.equal(parseClockTime(formatClockTime(seconds)), seconds);
  });
});
