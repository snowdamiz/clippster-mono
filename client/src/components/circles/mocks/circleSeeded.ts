import type { CirclePackage, CircleParticipant, CircleTimelineEvent } from '../types';

function participant(
  userId: number,
  role: CircleParticipant['role'],
  displayName: string,
  audioEnabled = true
): CircleParticipant {
  return {
    id: userId,
    userId,
    role,
    displayName,
    // null → Tokend-style letter stock avatar (matches reference screenshots)
    avatarUrl: null,
    audioEnabled,
  };
}

/** Matches Tokend seeded reference: 5 on stage, 4 listeners. */
const seedParticipants: CircleParticipant[] = [
  participant(1, 'host', 'Seed Nova'),
  participant(2, 'cohost', 'Orbit Host'),
  participant(3, 'speaker', 'Halo Speaker'),
  participant(4, 'speaker', 'Pulse Guest', false),
  participant(5, 'speaker', 'Quark Voice'),
  participant(6, 'listener', 'Listener One', false),
  participant(7, 'listener', 'Listener Two', false),
  participant(8, 'listener', 'Listener Three', false),
  participant(9, 'listener', 'Listener Four', false),
];

/** Speaking at t=0 matches Tokend CLIPPSTER_CIRCLES_REFERENCE_SPEAKING_IDS = {1, 3}. */
const events: CircleTimelineEvent[] = [
  { offsetMs: 0, eventType: 'speaker_active', userId: 1 },
  { offsetMs: 0, eventType: 'speaker_active', userId: 3 },
  { offsetMs: 8_000, eventType: 'speaker_inactive', userId: 1 },
  { offsetMs: 14_000, eventType: 'speaker_inactive', userId: 3 },

  {
    offsetMs: 15_000,
    eventType: 'participant_joined',
    userId: 10,
    payload: {
      id: 10,
      role: 'listener',
      displayName: 'Late Joiner',
      avatarUrl: null,
      audioEnabled: false,
    },
  },
  {
    offsetMs: 20_000,
    eventType: 'role_changed',
    userId: 10,
    payload: { role: 'speaker', audioEnabled: true },
  },
  { offsetMs: 22_000, eventType: 'speaker_active', userId: 10 },
  { offsetMs: 28_000, eventType: 'speaker_inactive', userId: 10 },

  { offsetMs: 30_000, eventType: 'speaker_active', userId: 2 },
  {
    offsetMs: 32_000,
    eventType: 'mic_changed',
    userId: 1,
    payload: { audioEnabled: false },
  },
  { offsetMs: 36_000, eventType: 'speaker_inactive', userId: 2 },
  {
    offsetMs: 37_000,
    eventType: 'mic_changed',
    userId: 1,
    payload: { audioEnabled: true },
  },

  { offsetMs: 40_000, eventType: 'participant_left', userId: 5 },

  { offsetMs: 45_000, eventType: 'speaker_active', userId: 1 },
  { offsetMs: 46_000, eventType: 'speaker_active', userId: 3 },
  { offsetMs: 52_000, eventType: 'speaker_inactive', userId: 3 },
  { offsetMs: 55_000, eventType: 'speaker_inactive', userId: 1 },
  { offsetMs: 56_000, eventType: 'speaker_active', userId: 3 },
];

/** Seeded Circle — matches Tokend reference fixtures + speaking set. */
export const circleSeededPackage: CirclePackage = {
  id: 'mock-circle-seeded',
  room: {
    id: 9002,
    title: 'Clippster Circles Reference',
    creatorSlug: 'seed-nova',
    creatorDisplayName: 'Seed Nova',
    creatorAvatarUrl: null,
    topicTags: ['seed', 'reference'],
  },
  seedParticipants,
  events,
  durationMs: 60_000,
  defaultFocusedSpeakerId: 3,
};
