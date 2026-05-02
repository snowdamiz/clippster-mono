import { describe, expect, it } from 'vitest';
import type { SpaceSpeakerSegment } from '@/services/database/types';
import {
  buildSpeakerSegments,
  buildSpaceTimelineEventsPayload,
  getActiveSpeaker,
  mergeAndSortTimelineEvents,
  normalizeSpeakerSegments,
  parseChatmanReplayMessages,
  pickDisplaySpeakerAtTime,
  pickPrimaryReliableSegmentAtTime,
} from './space-replay-helpers';

describe('normalizeSpeakerSegments', () => {
  it('clamps to duration and drops empty spans', () => {
    const segments: SpaceSpeakerSegment[] = [
      { id: 'a', speaker_id: '1', start: -1, end: 5, source: 'periscope' },
      { id: 'b', speaker_id: '2', start: 100, end: 90, source: 'periscope' },
      { id: 'c', speaker_id: '3', start: 2, end: 8, source: 'hls_id3' },
    ];
    const out = normalizeSpeakerSegments(segments, 10);
    expect(out.map((s) => s.id)).toContain('a');
    expect(out.map((s) => s.id)).not.toContain('b');
    expect(out.find((s) => s.id === 'a')).toMatchObject({ start: 0, end: 5 });
    expect(out.find((s) => s.id === 'c')).toMatchObject({ start: 2, end: 8 });
  });
});

describe('pickPrimaryReliableSegmentAtTime', () => {
  it('prefers latest-start reliable segment on overlaps', () => {
    const segments: SpaceSpeakerSegment[] = [
      { id: 'x', speaker_id: 'a', start: 0, end: 10, source: 'periscope' },
      { id: 'y', speaker_id: 'b', start: 3, end: 10, source: 'periscope' },
    ];
    const p = pickPrimaryReliableSegmentAtTime(5, segments);
    expect(p?.speaker_id).toBe('b');
  });
});

describe('pickDisplaySpeakerAtTime', () => {
  it('does not pretend stage schedules are active-speaker data', () => {
    const segments: SpaceSpeakerSegment[] = [
      { id: 'sj-0', speaker_id: '9', start: 0, end: 10, source: 'stage_join' },
    ];
    const d = pickDisplaySpeakerAtTime(2, segments);
    expect(d.mode).toBe('none');
    expect(d.speakerId).toBeNull();
  });
});

describe('buildSpaceTimelineEventsPayload', () => {
  it('merges stage join hints even when HLS snapshots exist', () => {
    const events = buildSpaceTimelineEventsPayload(
      [],
      [{ id: 's1', t: 0, on_stage_user_ids: ['1'] }],
      [],
      [{ userId: '2', offsetSecs: 10 }],
      100
    );
    const joined = events.filter((e) => e.type === 'joined_stage');
    expect(joined.some((e) => e.user_ids.includes('1'))).toBe(true);
    expect(joined.some((e) => e.user_ids.includes('2'))).toBe(true);
  });
});

describe('mergeAndSortTimelineEvents', () => {
  it('dedupes identical rows', () => {
    const merged = mergeAndSortTimelineEvents([
      { id: '1', t: 1, type: 'joined_stage', user_ids: ['a'] },
      { id: '2', t: 1, type: 'joined_stage', user_ids: ['a'] },
      { id: '3', t: 2, type: 'speaker_changed', user_ids: ['b'] },
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe('Chatman replay speaker events', () => {
  const participant = {
    id: '1JREmlAopMqjP',
    periscope_user_id: '1JREmlAopMqjP',
    x_rest_id: '1930356389123166208',
    twitter_username: 'pumpradiolive',
    display_name: 'PumpRadio',
    name: 'PumpRadio',
    avatar_url: 'https://example.com/avatar.jpg',
    role: 'speaker' as const,
  };

  function message(eventCode: 16 | 17, timestamp: string) {
    return {
      kind: 1,
      payload: JSON.stringify({
        room: '1dxYljvrbeQJX',
        body: JSON.stringify({
          guestBroadcastingEvent: eventCode,
          guestRemoteID: '1JREmlAopMqjP',
          guestUsername: 'pumpradiolive',
          ntpForLiveFrame: '17122558374426374144',
          type: 40,
        }),
        sender: {
          user_id: '1JREmlAopMqjP',
          username: 'pumpradiolive',
          display_name: 'PumpRadio',
          participant_index: 1483625331,
          twitter_id: '1930356389123166208',
        },
        timestamp,
      }),
    };
  }

  it('parses double-encoded Chatman replay payloads', () => {
    const events = parseChatmanReplayMessages({
      messages: [
        message(17, '1777667487424969762'),
        { payload: JSON.stringify({ body: JSON.stringify({ type: 1 }) }) },
        message(16, '1777667488193929391'),
      ],
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      room: '1dxYljvrbeQJX',
      periscopeUserId: '1JREmlAopMqjP',
      username: 'pumpradiolive',
      displayName: 'PumpRadio',
      twitterId: '1930356389123166208',
      eventType: 'speaking_started',
    });
    expect(events[0].timestampNs).toBe(1777667487424969762n);
    expect(events[1].eventType).toBe('speaking_stopped');
  });

  it('builds relative speaker segments by matching guestRemoteID to periscope_user_id', () => {
    const events = parseChatmanReplayMessages({
      messages: [
        message(17, '1777667487424969762'),
        message(16, '1777667488193929391'),
      ],
    });
    const startedAtMs = 1777667487000;
    const segments = buildSpeakerSegments(events, [participant], startedAtMs);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      periscopeUserId: '1JREmlAopMqjP',
      xRestId: '1930356389123166208',
      username: 'pumpradiolive',
      displayName: 'PumpRadio',
      startMs: 424,
      endMs: 1193,
      source: 'chatman_replay',
    });
  });

  it('returns the latest active Chatman segment only during its range', () => {
    const segment = {
      periscopeUserId: '1JREmlAopMqjP',
      username: 'pumpradiolive',
      displayName: 'PumpRadio',
      startMs: 424,
      endMs: 1193,
      source: 'chatman_replay' as const,
    };

    expect(getActiveSpeaker(423, [segment])).toBeNull();
    expect(getActiveSpeaker(500, [segment])?.displayName).toBe('PumpRadio');
    expect(getActiveSpeaker(1194, [segment])).toBeNull();
  });
});
