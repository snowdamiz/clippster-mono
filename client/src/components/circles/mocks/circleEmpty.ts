import type { CirclePackage } from '../types';

/** Empty Circle — matches Tokend empty floating/main reference (no participants). */
export const circleEmptyPackage: CirclePackage = {
  id: 'mock-circle-empty',
  room: {
    id: 9001,
    title: 'Clippster Circles Reference',
    creatorSlug: 'seed-nova',
    creatorDisplayName: 'Seed Nova',
    creatorAvatarUrl: null,
    topicTags: ['seed', 'reference'],
  },
  seedParticipants: [],
  events: [],
  durationMs: 60_000,
  defaultFocusedSpeakerId: null,
};
