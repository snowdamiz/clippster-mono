export type CircleLayout = 'main_room' | 'floating_panel';

export type CircleParticipantRole = 'host' | 'cohost' | 'speaker' | 'listener';

export type CircleParticipant = {
  id: number;
  userId: number;
  role: CircleParticipantRole;
  displayName: string;
  avatarUrl?: string | null;
  audioEnabled: boolean;
  mutedByMod?: boolean;
};

export type CircleRoomMeta = {
  id: number;
  title: string;
  creatorSlug: string;
  creatorDisplayName: string;
  creatorAvatarUrl?: string | null;
  topicTags?: string[];
};

export type CircleTimelineEventType =
  | 'participant_joined'
  | 'participant_left'
  | 'role_changed'
  | 'mic_changed'
  | 'speaker_active'
  | 'speaker_inactive';

export type CircleTimelineEvent = {
  offsetMs: number;
  eventType: CircleTimelineEventType;
  userId: number;
  payload?: Record<string, unknown>;
};

export type CircleStageState = {
  participants: CircleParticipant[];
  activeSpeakerIds: Set<number>;
};

/** Mock / future Tokend Circle package used for clip scrubbing. */
export type CirclePackage = {
  id: string;
  room: CircleRoomMeta;
  /** Participants present at t=0 (before applying timeline events). */
  seedParticipants: CircleParticipant[];
  events: CircleTimelineEvent[];
  durationMs: number;
  /** Optional default focus speaker for demo (userId). */
  defaultFocusedSpeakerId?: number | null;
};

/** Max on-stage slots shown in the floating Circle grid (1 host + 2 co-hosts + 10 speakers). */
export const FLOATING_STAGE_VISIBLE = 13;

/** Listener avatars shown in the floating card before overflow. */
export const FLOATING_LISTENER_AVATARS = 20;

/** Listener avatars shown in main-room clip preview. */
export const MAIN_ROOM_LISTENER_VISIBLE = 8;

export const STAGE_ROLES: ReadonlySet<CircleParticipantRole> = new Set([
  'host',
  'cohost',
  'speaker',
]);
