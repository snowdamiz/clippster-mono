import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isMasterPlaylist,
  parseMasterVariants,
  pickBestVariant,
  pickMobileVariant,
  parseMediaPlaylist,
  sliceSegmentsByTime,
} from './hlsPlaylist';

describe('hlsPlaylist', () => {
  it('picks the highest-bandwidth variant from a master playlist', () => {
    const text = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=1920x1080
1080p60/playlist.m3u8
`;
    const base = 'https://stream.kick.com/vod/master.m3u8';
    assert.equal(isMasterPlaylist(text), true);
    const best = pickBestVariant(parseMasterVariants(text, base));
    assert.equal(best?.url, 'https://stream.kick.com/vod/1080p60/playlist.m3u8');
    assert.equal(best?.bandwidth, 8_000_000);
  });

  it('prefers 720p over 1080p60 for mobile downloads', () => {
    const text = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
720p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=1920x1080
1080p60/playlist.m3u8
`;
    const mobile = pickMobileVariant(
      parseMasterVariants(text, 'https://stream.kick.com/vod/master.m3u8'),
    );
    assert.equal(mobile?.url, 'https://stream.kick.com/vod/720p/playlist.m3u8');
  });

  it('parses media segments and slices by time', () => {
    const text = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXTINF:10.000,
0.ts
#EXTINF:10.000,
1.ts
#EXTINF:10.000,
2.ts
#EXT-X-ENDLIST
`;
    const playlist = parseMediaPlaylist(
      text,
      'https://stream.kick.com/vod/1080p60/playlist.m3u8',
    );
    assert.equal(playlist.segments.length, 3);
    assert.equal(playlist.segments[0].url, 'https://stream.kick.com/vod/1080p60/0.ts');
    assert.equal(playlist.totalDuration, 30);

    const sliced = sliceSegmentsByTime(playlist.segments, { startTime: 10, endTime: 25 });
    assert.deepEqual(
      sliced.map((segment) => segment.url),
      [
        'https://stream.kick.com/vod/1080p60/1.ts',
        'https://stream.kick.com/vod/1080p60/2.ts',
      ],
    );
  });
});
