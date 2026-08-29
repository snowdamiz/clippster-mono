import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  adaptArgsForMobileEncoders,
  preferredMobileVideoCodec,
  stripAssFilters,
} from '../lib/ffmpegArgs';

describe('adaptArgsForMobileEncoders', () => {
  it('rewrites libx264 plans to h264_mediacodec and drops preset', () => {
    const adapted = adaptArgsForMobileEncoders([
      '-i',
      'in.mp4',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-c:a',
      'aac',
      '-y',
      'out.mp4',
    ]);
    assert.deepEqual(adapted, [
      '-i',
      'in.mp4',
      '-c:v',
      'h264_mediacodec',
      '-c:a',
      'aac',
      '-b:v',
      '4M',
      '-pix_fmt',
      'yuv420p',
      '-y',
      'out.mp4',
    ]);
  });

  it('rewrites libx264 plans to h264_videotoolbox for iOS', () => {
    const adapted = adaptArgsForMobileEncoders(
      ['-i', 'in.mp4', '-c:v', 'libx264', '-preset', 'veryfast', '-y', 'out.mp4'],
      'h264_videotoolbox',
    );
    assert.ok(adapted.includes('h264_videotoolbox'));
    assert.ok(adapted.includes('-b:v'));
    assert.ok(!adapted.includes('-preset'));
  });

  it('keeps stream-copy remux args unchanged', () => {
    const args = ['-i', 'in.mp4', '-c:v', 'copy', '-c:a', 'aac', '-y', 'out.mp4'];
    assert.deepEqual(adaptArgsForMobileEncoders(args), args);
  });

  it('falls back to mpeg4 quality mode', () => {
    const adapted = adaptArgsForMobileEncoders(
      ['-i', 'in.mp4', '-c:v', 'libx264', '-preset', 'veryfast', '-y', 'out.mp4'],
      'mpeg4',
    );
    assert.ok(adapted.includes('mpeg4'));
    assert.ok(adapted.includes('-q:v'));
    assert.ok(!adapted.includes('-preset'));
  });

  it('picks platform preferred codec', () => {
    assert.equal(preferredMobileVideoCodec('ios'), 'h264_videotoolbox');
    assert.equal(preferredMobileVideoCodec('android'), 'h264_mediacodec');
  });

  it('strips ASS caption filters', () => {
    const stripped = stripAssFilters([
      '-i',
      'in.mp4',
      '-vf',
      "ass=captions.ass",
      '-c:v',
      'mpeg4',
      '-y',
      'out.mp4',
    ]);
    assert.deepEqual(stripped, ['-i', 'in.mp4', '-c:v', 'mpeg4', '-y', 'out.mp4']);
    assert.equal(stripAssFilters(['-i', 'in.mp4', '-c:v', 'copy']), null);
  });
});
