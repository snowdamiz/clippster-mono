import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateExportMetadata } from './exportValidation';

describe('validateExportMetadata', () => {
  it('accepts compatible H.264/AAC output within one frame', () => {
    assert.doesNotThrow(() =>
      validateExportMetadata(
        {
          width: 1080,
          height: 1920,
          duration: 30.02,
          videoCodec: 'h264',
          audioCodec: 'aac',
        },
        { width: 1080, height: 1920, duration: 30, frameTolerance: 1 / 30 },
      ),
    );
  });

  it('rejects wrong dimensions, codecs, missing audio, and timing drift', () => {
    const expected = { width: 1920, height: 1080, duration: 30, frameTolerance: 1 / 30 };
    assert.throws(
      () =>
        validateExportMetadata(
          { width: 1080, height: 1920, duration: 30, videoCodec: 'h264', audioCodec: 'aac' },
          expected,
        ),
      /dimensions/,
    );
    assert.throws(
      () =>
        validateExportMetadata(
          { width: 1920, height: 1080, duration: 30, videoCodec: 'mpeg4', audioCodec: 'aac' },
          expected,
        ),
      /H\.264/,
    );
    assert.throws(
      () =>
        validateExportMetadata(
          { width: 1920, height: 1080, duration: 30, videoCodec: 'h264', audioCodec: null },
          expected,
        ),
      /AAC/,
    );
    assert.throws(
      () =>
        validateExportMetadata(
          { width: 1920, height: 1080, duration: 31, videoCodec: 'h264', audioCodec: 'aac' },
          expected,
        ),
      /one-frame/,
    );
  });
});
