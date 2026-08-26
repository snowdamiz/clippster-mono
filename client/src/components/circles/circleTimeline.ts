import {
  STAGE_ROLES,
  type CircleParticipant,
  type CircleParticipantRole,
  type CircleStageState,
  type CircleTimelineEvent,
} from './types';

const ROLE_SORT_ORDER: Record<CircleParticipantRole, number> = {
  host: 0,
  cohost: 1,
  speaker: 2,
  listener: 3,
};

function cloneParticipant(p: CircleParticipant): CircleParticipant {
  return { ...p };
}

function asRole(value: unknown): CircleParticipantRole | null {
  if (value === 'host' || value === 'cohost' || value === 'speaker' || value === 'listener') {
    return value;
  }
  return null;
}

function participantFromJoinPayload(
  userId: number,
  payload: Record<string, unknown> | undefined
): CircleParticipant {
  const role = asRole(payload?.role) ?? 'listener';
  const displayName =
    typeof payload?.displayName === 'string' && payload.displayName.trim()
      ? payload.displayName
      : `User ${userId}`;
  const avatarUrl =
    typeof payload?.avatarUrl === 'string'
      ? payload.avatarUrl
      : payload?.avatarUrl === null
        ? null
        : undefined;
  const audioEnabled =
    typeof payload?.audioEnabled === 'boolean' ? payload.audioEnabled : role !== 'listener';
  const id = typeof payload?.id === 'number' && Number.isFinite(payload.id) ? payload.id : userId;

  return {
    id,
    userId,
    role,
    displayName,
    avatarUrl,
    audioEnabled,
    mutedByMod: payload?.mutedByMod === true,
  };
}

/**
 * Reduce seed participants + timeline events up to `offsetMs` into stage state.
 * Events at exactly `offsetMs` are included.
 */
export function reduceCircleTimeline(
  seedParticipants: CircleParticipant[],
  events: CircleTimelineEvent[],
  offsetMs: number
): CircleStageState {
  const byUserId = new Map<number, CircleParticipant>();
  for (const p of seedParticipants) {
    byUserId.set(p.userId, cloneParticipant(p));
  }

  const activeSpeakerIds = new Set<number>();
  const sorted = [...events].sort((a, b) => a.offsetMs - b.offsetMs || a.userId - b.userId);

  for (const event of sorted) {
    if (event.offsetMs > offsetMs) break;

    switch (event.eventType) {
      case 'participant_joined': {
        byUserId.set(event.userId, participantFromJoinPayload(event.userId, event.payload));
        break;
      }
      case 'participant_left': {
        byUserId.delete(event.userId);
        activeSpeakerIds.delete(event.userId);
        break;
      }
      case 'role_changed': {
        const existing = byUserId.get(event.userId);
        const role = asRole(event.payload?.role);
        if (existing && role) {
          byUserId.set(event.userId, {
            ...existing,
            role,
            audioEnabled:
              typeof event.payload?.audioEnabled === 'boolean'
                ? event.payload.audioEnabled
                : role !== 'listener'
                  ? existing.audioEnabled
                  : false,
          });
        }
        break;
      }
      case 'mic_changed': {
        const existing = byUserId.get(event.userId);
        if (existing) {
          const audioEnabled =
            typeof event.payload?.audioEnabled === 'boolean'
              ? event.payload.audioEnabled
              : existing.audioEnabled;
          byUserId.set(event.userId, {
            ...existing,
            audioEnabled,
            mutedByMod:
              typeof event.payload?.mutedByMod === 'boolean'
                ? event.payload.mutedByMod
                : existing.mutedByMod,
          });
          if (!audioEnabled) activeSpeakerIds.delete(event.userId);
        }
        break;
      }
      case 'speaker_active': {
        if (byUserId.has(event.userId)) activeSpeakerIds.add(event.userId);
        break;
      }
      case 'speaker_inactive': {
        activeSpeakerIds.delete(event.userId);
        break;
      }
      default:
        break;
    }
  }

  return {
    participants: Array.from(byUserId.values()),
    activeSpeakerIds,
  };
}

export function sortStageParticipants(participants: CircleParticipant[]): CircleParticipant[] {
  return [...participants].sort((a, b) => {
    const roleDiff = ROLE_SORT_ORDER[a.role] - ROLE_SORT_ORDER[b.role];
    if (roleDiff !== 0) return roleDiff;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function stageParticipants(participants: CircleParticipant[]): CircleParticipant[] {
  return sortStageParticipants(participants.filter((p) => STAGE_ROLES.has(p.role)));
}

export function listenerParticipants(participants: CircleParticipant[]): CircleParticipant[] {
  return [...participants]
    .filter((p) => p.role === 'listener')
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function roleBadgeLabel(role: CircleParticipantRole): string | null {
  if (role === 'host') return 'Host';
  if (role === 'cohost') return 'Cohost';
  if (role === 'speaker') return 'Speaker';
  return null;
}

export function avatarInitial(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}
