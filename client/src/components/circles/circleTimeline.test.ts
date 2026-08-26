import { describe, expect, it } from 'vitest';
import { listenerParticipants, reduceCircleTimeline, stageParticipants } from './circleTimeline';
import type { CircleParticipant, CircleTimelineEvent } from './types';

function p(
  userId: number,
  role: CircleParticipant['role'],
  displayName: string,
  audioEnabled = true
): CircleParticipant {
  return { id: userId, userId, role, displayName, audioEnabled };
}

describe('reduceCircleTimeline', () => {
  it('returns seed participants when there are no events', () => {
    const seed = [p(1, 'host', 'Host')];
    const state = reduceCircleTimeline(seed, [], 0);
    expect(state.participants).toHaveLength(1);
    expect(state.participants[0].displayName).toBe('Host');
    expect(state.activeSpeakerIds.size).toBe(0);
  });

  it('applies join / leave at scrub offset', () => {
    const events: CircleTimelineEvent[] = [
      {
        offsetMs: 1000,
        eventType: 'participant_joined',
        userId: 2,
        payload: { role: 'speaker', displayName: 'Guest' },
      },
      { offsetMs: 5000, eventType: 'participant_left', userId: 2 },
    ];

    const before = reduceCircleTimeline([], events, 500);
    expect(before.participants).toHaveLength(0);

    const mid = reduceCircleTimeline([], events, 1000);
    expect(mid.participants.map((x) => x.userId)).toEqual([2]);

    const after = reduceCircleTimeline([], events, 5000);
    expect(after.participants).toHaveLength(0);
  });

  it('handles role changes', () => {
    const seed = [p(1, 'listener', 'Pat', false)];
    const events: CircleTimelineEvent[] = [
      {
        offsetMs: 2000,
        eventType: 'role_changed',
        userId: 1,
        payload: { role: 'speaker', audioEnabled: true },
      },
    ];
    const state = reduceCircleTimeline(seed, events, 2000);
    expect(state.participants[0].role).toBe('speaker');
    expect(state.participants[0].audioEnabled).toBe(true);
  });

  it('tracks speaking active / inactive', () => {
    const seed = [p(1, 'host', 'Host'), p(2, 'speaker', 'Guest')];
    const events: CircleTimelineEvent[] = [
      { offsetMs: 100, eventType: 'speaker_active', userId: 1 },
      { offsetMs: 500, eventType: 'speaker_active', userId: 2 },
      { offsetMs: 800, eventType: 'speaker_inactive', userId: 1 },
    ];

    const both = reduceCircleTimeline(seed, events, 500);
    expect(both.activeSpeakerIds.has(1)).toBe(true);
    expect(both.activeSpeakerIds.has(2)).toBe(true);

    const after = reduceCircleTimeline(seed, events, 800);
    expect(after.activeSpeakerIds.has(1)).toBe(false);
    expect(after.activeSpeakerIds.has(2)).toBe(true);
  });

  it('clears speaking when participant leaves or mic disables', () => {
    const seed = [p(1, 'speaker', 'Guest')];
    const leaveEvents: CircleTimelineEvent[] = [
      { offsetMs: 100, eventType: 'speaker_active', userId: 1 },
      { offsetMs: 200, eventType: 'participant_left', userId: 1 },
    ];
    expect(reduceCircleTimeline(seed, leaveEvents, 200).activeSpeakerIds.size).toBe(0);

    const micEvents: CircleTimelineEvent[] = [
      { offsetMs: 100, eventType: 'speaker_active', userId: 1 },
      {
        offsetMs: 200,
        eventType: 'mic_changed',
        userId: 1,
        payload: { audioEnabled: false },
      },
    ];
    const muted = reduceCircleTimeline(seed, micEvents, 200);
    expect(muted.participants[0].audioEnabled).toBe(false);
    expect(muted.activeSpeakerIds.has(1)).toBe(false);
  });

  it('does not apply events after the playhead', () => {
    const seed = [p(1, 'host', 'Host')];
    const events: CircleTimelineEvent[] = [
      { offsetMs: 10_000, eventType: 'speaker_active', userId: 1 },
    ];
    const state = reduceCircleTimeline(seed, events, 9999);
    expect(state.activeSpeakerIds.has(1)).toBe(false);
  });
});

describe('stageParticipants / listenerParticipants', () => {
  it('splits and sorts stage vs listeners', () => {
    const participants = [
      p(3, 'speaker', 'Zed'),
      p(1, 'host', 'Host'),
      p(2, 'listener', 'Ann'),
      p(4, 'cohost', 'Co'),
    ];
    const stage = stageParticipants(participants);
    expect(stage.map((x) => x.role)).toEqual(['host', 'cohost', 'speaker']);
    expect(listenerParticipants(participants).map((x) => x.displayName)).toEqual(['Ann']);
  });
});
