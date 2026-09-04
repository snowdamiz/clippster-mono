import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canExtendBuffer,
  extendBuffer,
  initialAdjustWindow,
  selectionIsDirty,
  trimSelection,
} from './clipAdjust.ts';

describe('clipAdjust', () => {
  it('pads selection with ±15s context inside media bounds', () => {
    const window = initialAdjustWindow({
      selectStart: 30,
      selectEnd: 60,
      mediaDuration: 120,
    });
    assert.equal(window.bufferStart, 15);
    assert.equal(window.bufferEnd, 75);
    assert.equal(window.selectStart, 30);
    assert.equal(window.selectEnd, 60);
  });

  it('clamps context at media start and end', () => {
    const window = initialAdjustWindow({
      selectStart: 5,
      selectEnd: 20,
      mediaDuration: 25,
    });
    assert.equal(window.bufferStart, 0);
    assert.equal(window.bufferEnd, 25);
  });

  it('extends buffer by 15s from either edge', () => {
    const left = extendBuffer('start', 15, 75, 120);
    assert.deepEqual(left, { bufferStart: 0, bufferEnd: 75, extended: true });

    const right = extendBuffer('end', 0, 75, 120);
    assert.deepEqual(right, { bufferStart: 0, bufferEnd: 90, extended: true });

    assert.equal(extendBuffer('start', 0, 75, 120).extended, false);
    assert.equal(canExtendBuffer('start', 0, 75, 120), false);
    assert.equal(canExtendBuffer('end', 0, 120, 120), false);
  });

  it('trims selection only within the loaded buffer', () => {
    const inward = trimSelection({
      edge: 'start',
      deltaSeconds: 5,
      selectStart: 30,
      selectEnd: 60,
      bufferStart: 15,
      bufferEnd: 75,
    });
    assert.deepEqual(inward, { selectStart: 35, selectEnd: 60 });

    const outward = trimSelection({
      edge: 'start',
      deltaSeconds: -20,
      selectStart: 30,
      selectEnd: 60,
      bufferStart: 15,
      bufferEnd: 75,
    });
    assert.deepEqual(outward, { selectStart: 15, selectEnd: 60 });
  });

  it('detects dirty selection against originals', () => {
    assert.equal(selectionIsDirty(30, 60, 30, 60), false);
    assert.equal(selectionIsDirty(20, 60, 30, 60), true);
  });
});
