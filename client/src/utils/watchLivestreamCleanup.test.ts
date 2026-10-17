import { describe, expect, it } from 'vitest';
import { isWatchLivestreamSessionId } from './watchLivestreamCleanup';

describe('isWatchLivestreamSessionId', () => {
  it('matches watch and auto-dvr session prefixes', () => {
    expect(isWatchLivestreamSessionId('kick-view-soljakey-123')).toBe(true);
    expect(isWatchLivestreamSessionId('kick-dvr-soljakey-123')).toBe(true);
    expect(isWatchLivestreamSessionId('twitch-view-xqc-123')).toBe(true);
    expect(isWatchLivestreamSessionId('twitch-dvr-xqc-123')).toBe(true);
    expect(isWatchLivestreamSessionId('youtube-view-UC123-456')).toBe(true);
    expect(isWatchLivestreamSessionId('youtube-dvr-UC123-456')).toBe(true);
    expect(isWatchLivestreamSessionId('rumble-view-abc-1')).toBe(true);
    expect(isWatchLivestreamSessionId('rumble-dvr-abc-1')).toBe(true);
    expect(isWatchLivestreamSessionId('twitter-view-123')).toBe(true);
    expect(isWatchLivestreamSessionId('twitter-dvr-123')).toBe(true);
  });

  it('does not match record/auto-detect UUID session ids', () => {
    expect(isWatchLivestreamSessionId('1659f3fe-36f9-45e1-b37f-9e6d0a453040')).toBe(false);
    expect(isWatchLivestreamSessionId('kick-record-soljakey-123')).toBe(false);
    expect(isWatchLivestreamSessionId('')).toBe(false);
  });
});
