import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { moovIsBeforeMdat } from './mp4Boxes';

function box(type: string, payloadLength = 0): Uint8Array {
  const size = 8 + payloadLength;
  const bytes = new Uint8Array(size);
  bytes[0] = (size >>> 24) & 0xff;
  bytes[1] = (size >>> 16) & 0xff;
  bytes[2] = (size >>> 8) & 0xff;
  bytes[3] = size & 0xff;
  bytes[4] = type.charCodeAt(0);
  bytes[5] = type.charCodeAt(1);
  bytes[6] = type.charCodeAt(2);
  bytes[7] = type.charCodeAt(3);
  return bytes;
}

function concat(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

describe('moovIsBeforeMdat', () => {
  it('accepts faststart files (moov before mdat)', () => {
    assert.equal(moovIsBeforeMdat(concat(box('ftyp', 16), box('moov', 32), box('mdat', 64))), true);
  });

  it('rejects remuxes that left moov at the end', () => {
    assert.equal(moovIsBeforeMdat(concat(box('ftyp', 16), box('mdat', 64), box('moov', 32))), false);
  });
});
