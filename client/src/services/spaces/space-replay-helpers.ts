/**
 * Pure helpers for X Space replay: speaker segment sources, normalization,
 * active speaker resolution (no synthetic highlights), and stage snapshot → timeline events.
 */

import type {
  SpaceParticipant,
  SpaceSpeakerSegment,
  SpaceSpeakerSegmentSource,
  SpaceStageSnapshot,
  SpaceTimelineEvent,
} from '@/services/database/types';

export type { SpaceSpeakerSegmentSource };

export interface RawSpeakerEvent {
  room?: string;
  periscopeUserId: string;
  username?: string;
  displayName?: string;
  twitterId?: string;
  participantIndex?: number;
  eventType: 'speaking_started' | 'speaking_stopped';
  timestampNs: bigint;
  ntpForLiveFrame?: string;
  raw: unknown;
}

export interface ChatmanSpeakerSegment {
  periscopeUserId: string;
  xRestId?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;
  role?: SpaceParticipant['role'];
  startMs: number;
  endMs: number;
  source: 'chatman_replay';
}

export interface BuildSpeakerSegmentsOptions {
  durationMs?: number;
  spaceReplaySpeakerOffsetMs?: number;
}

type JsonObject = Record<string, unknown>;

/** Maps X replay timeline segments (Rust-injected or TS fallback) to stored rows with sources. */
export function mapSpeakerTimelineToStoredSegments(
  timeline: Array<{
    id: string;
    speakerId: string;
    start: number;
    end: number;
    source?: SpaceSpeakerSegmentSource;
    periscopeUserId?: string;
    xRestId?: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string | null;
    role?: SpaceParticipant['role'];
  }>
): SpaceSpeakerSegment[] {
  return timeline.map((seg) => ({
    id: seg.id,
    speaker_id: seg.speakerId,
    start: seg.start,
    end: seg.end,
    source: seg.source ?? deriveSegmentSourceFromId(seg.id),
    periscope_user_id: seg.periscopeUserId,
    x_rest_id: seg.xRestId,
    username: seg.username,
    display_name: seg.displayName,
    avatar_url: seg.avatarUrl,
    role: seg.role,
  }));
}

const SYNTHETIC_SOURCES: ReadonlySet<SpaceSpeakerSegmentSource> = new Set([
  'synthetic_equal',
  'synthetic_seed',
  'unknown',
]);

/** Heuristic: Rust / HLS / client segment id prefixes → source. */
export function deriveSegmentSourceFromId(segmentId: string): SpaceSpeakerSegmentSource {
  if (segmentId.startsWith('cm-') || segmentId.startsWith('chatman-')) return 'chatman_replay';
  if (segmentId.startsWith('ps-') || segmentId.startsWith('rt-')) return 'periscope';
  if (segmentId.startsWith('p-')) return 'periscope';
  if (segmentId.startsWith('sj-')) return 'stage_join';
  if (segmentId.startsWith('eq-')) return 'synthetic_equal';
  if (segmentId.startsWith('tl-')) return 'hls_id3';
  // Older saved seed segments used `${participantId}-${cursor}` ids without
  // source metadata. Treat those as placeholders so the UI does not claim an
  // unknown detector while also never highlighting them as ground truth.
  if (/-\d+(\.\d+)?$/.test(segmentId)) return 'synthetic_seed';
  return 'unknown';
}

export function isSyntheticSegmentSource(source: SpaceSpeakerSegmentSource | undefined): boolean {
  if (!source) return true;
  return SYNTHETIC_SOURCES.has(source) || source === 'stage_join';
}

/** stage_join timeline is not reliable enough for “who is speaking now” — treat like synthetic for highlights. */
export function sourceAllowsActiveHighlight(source: SpaceSpeakerSegmentSource | undefined): boolean {
  if (!source) return false;
  return (
    source === 'chatman_replay' ||
    source === 'periscope' ||
    source === 'hls_id3' ||
    source === 'manual'
  );
}

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'bigint') return value.toString();
  return undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseJsonObject(value: unknown): JsonObject | null {
  if (typeof value === 'string') {
    try {
      return asObject(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return asObject(value);
}

function timestampNsFrom(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string') {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

function participantPeriscopeId(participant: SpaceParticipant): string | undefined {
  return participant.periscope_user_id || participant.id;
}

function participantXRestId(participant: SpaceParticipant): string | undefined {
  return participant.x_rest_id || (/^\d+$/.test(participant.id) ? participant.id : undefined);
}

/** Parse Chatman replay history payloads into raw start/stop speaker events. */
export function parseChatmanReplayMessages(response: unknown): RawSpeakerEvent[] {
  const root = asObject(response);
  const messages = Array.isArray(root?.messages) ? root.messages : [];
  const events: RawSpeakerEvent[] = [];

  for (const message of messages) {
    const messageObj = asObject(message);
    const payload = parseJsonObject(messageObj?.payload);
    const body = parseJsonObject(payload?.body);
    if (!payload || !body) continue;
    if (numberValue(body.type) !== 40) continue;

    const eventCode = numberValue(body.guestBroadcastingEvent);
    if (eventCode !== 17 && eventCode !== 16) continue;

    const periscopeUserId = stringValue(body.guestRemoteID);
    const timestampNs = timestampNsFrom(payload.timestamp);
    if (!periscopeUserId || timestampNs === null) continue;

    const sender = asObject(payload.sender);
    events.push({
      room: stringValue(payload.room),
      periscopeUserId,
      username: stringValue(body.guestUsername) ?? stringValue(sender?.username),
      displayName: stringValue(sender?.display_name),
      twitterId: stringValue(sender?.twitter_id),
      participantIndex: numberValue(body.guestParticipantIndex),
      eventType: eventCode === 17 ? 'speaking_started' : 'speaking_stopped',
      timestampNs,
      ntpForLiveFrame: stringValue(body.ntpForLiveFrame),
      raw: body,
    });
  }

  return events;
}

/** Build timestamped speaker spans by matching Chatman guestRemoteID to AudioSpace periscope_user_id. */
export function buildSpeakerSegments(
  events: RawSpeakerEvent[],
  participants: SpaceParticipant[],
  spaceStartedAtMs: number,
  options: BuildSpeakerSegmentsOptions = {}
): ChatmanSpeakerSegment[] {
  const offsetMs = options.spaceReplaySpeakerOffsetMs ?? 0;
  const byPeriscopeId = new Map<string, SpaceParticipant>();
  for (const participant of participants) {
    const id = participantPeriscopeId(participant);
    if (id && !byPeriscopeId.has(id)) byPeriscopeId.set(id, participant);
  }

  const sorted = [...events].sort((a, b) =>
    a.timestampNs === b.timestampNs ? 0 : a.timestampNs < b.timestampNs ? -1 : 1
  );
  const open = new Map<string, { event: RawSpeakerEvent; startMs: number }>();
  const segments: ChatmanSpeakerSegment[] = [];

  const eventPlaybackMs = (event: RawSpeakerEvent) =>
    Number(event.timestampNs / 1_000_000n) - spaceStartedAtMs + offsetMs;

  const closeSegment = (periscopeUserId: string, endMs: number) => {
    const current = open.get(periscopeUserId);
    if (!current) return;
    open.delete(periscopeUserId);
    if (endMs <= current.startMs) return;

    const participant = byPeriscopeId.get(periscopeUserId);
    segments.push({
      periscopeUserId,
      xRestId: participant ? participantXRestId(participant) : current.event.twitterId,
      username: participant?.twitter_username ?? current.event.username,
      displayName: participant?.display_name ?? participant?.name ?? current.event.displayName,
      avatarUrl: participant?.avatar_url ?? null,
      role: participant?.role,
      startMs: Math.max(0, current.startMs),
      endMs: Math.max(0, endMs),
      source: 'chatman_replay',
    });
  };

  for (const event of sorted) {
    const t = eventPlaybackMs(event);
    if (event.eventType === 'speaking_started') {
      if (open.has(event.periscopeUserId)) {
        closeSegment(event.periscopeUserId, t);
      }
      open.set(event.periscopeUserId, { event, startMs: t });
    } else {
      closeSegment(event.periscopeUserId, t);
    }
  }

  const fallbackEndMs =
    options.durationMs ??
    (sorted.length > 0 ? Math.max(...sorted.map(eventPlaybackMs)) : spaceStartedAtMs);
  for (const [id, current] of Array.from(open.entries())) {
    const nextStart = sorted
      .filter((event) => event.eventType === 'speaking_started' && eventPlaybackMs(event) > current.startMs)
      .map(eventPlaybackMs)
      .sort((a, b) => a - b)[0];
    closeSegment(id, nextStart ?? fallbackEndMs);
  }

  return segments.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

export function getActiveSpeaker(
  currentTimeMs: number,
  speakerSegments: ChatmanSpeakerSegment[]
): ChatmanSpeakerSegment | null {
  const active = speakerSegments.filter(
    (segment) => currentTimeMs >= segment.startMs && currentTimeMs <= segment.endMs
  );
  if (active.length === 0) return null;
  active.sort((a, b) => b.startMs - a.startMs || a.endMs - b.endMs);
  return active[0] ?? null;
}

/** Attach source when missing (backward compat with older DB rows). */
export function withDerivedSegmentSources(segments: SpaceSpeakerSegment[]): SpaceSpeakerSegment[] {
  return segments.map((s) => ({
    ...s,
    source: s.source ?? deriveSegmentSourceFromId(s.id),
  }));
}

/** Sort by start, clamp to [0, duration], drop degenerate segments. */
export function normalizeSpeakerSegments(
  segments: SpaceSpeakerSegment[],
  durationSeconds: number
): SpaceSpeakerSegment[] {
  const d = Math.max(0, durationSeconds);
  const withSources = withDerivedSegmentSources(segments);
  const out: SpaceSpeakerSegment[] = [];
  for (const s of withSources) {
    const start = Math.max(0, Math.min(s.start, d));
    const end = Math.max(0, Math.min(s.end, d));
    if (end <= start) continue;
    out.push({ ...s, start, end });
  }
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  return out;
}

export interface ActiveSpeakersAtTimeResult {
  /** Ids that may show the “speaking” ring (Periscope, HLS ID3, or manual only). */
  highlightSpeakerIds: string[];
  /** All segment hits at t (including synthetic), for debugging / future use. */
  segmentHits: SpaceSpeakerSegment[];
  /** True when we only have synthetic/unknown/stage_join coverage at this instant. */
  hasReliableHighlight: boolean;
}

const EPS = 1e-4;

/** When overlaps exist, prefer the reliable segment with the latest start, then narrowest span. */
export function pickPrimaryReliableSegmentAtTime(
  t: number,
  segments: SpaceSpeakerSegment[]
): SpaceSpeakerSegment | null {
  const hits = segments.filter((s) => t + EPS >= s.start && t <= s.end + EPS);
  const reliable = hits.filter((s) => sourceAllowsActiveHighlight(s.source));
  if (reliable.length === 0) return null;
  reliable.sort((a, b) => {
    if (b.start !== a.start) return b.start - a.start;
    const da = a.end - a.start;
    const db = b.end - b.start;
    return da - db;
  });
  return reliable[0] ?? null;
}

/** Hero card: only real replay/manual speaker segments can name a current speaker. */
export function pickDisplaySpeakerAtTime(
  t: number,
  segments: SpaceSpeakerSegment[]
): { speakerId: string | null; mode: 'reliable' | 'estimated' | 'none' } {
  const withSources = withDerivedSegmentSources(segments);
  const rel = pickPrimaryReliableSegmentAtTime(t, withSources);
  if (rel) return { speakerId: rel.speaker_id, mode: 'reliable' };
  return { speakerId: null, mode: 'none' };
}

export function activeSpeakersAtTime(
  t: number,
  segments: SpaceSpeakerSegment[],
  _durationSeconds: number
): ActiveSpeakersAtTimeResult {
  const hits = segments.filter((s) => t + EPS >= s.start && t <= s.end + EPS);
  const reliable = hits.filter((s) => sourceAllowsActiveHighlight(s.source));
  const primary = pickPrimaryReliableSegmentAtTime(t, segments);
  const highlightIds = primary ? [primary.speaker_id] : [...new Set(reliable.map((s) => s.speaker_id))];
  return {
    highlightSpeakerIds: highlightIds,
    segmentHits: hits,
    hasReliableHighlight: highlightIds.length > 0,
  };
}

let timelineEventCounter = 0;
function nextTimelineEventId(): string {
  timelineEventCounter += 1;
  return `te-${Date.now()}-${timelineEventCounter}`;
}

/** Build join/leave stage events from HLS (or any) monotonic stage snapshots. */
export function buildTimelineEventsFromStageSnapshots(
  snapshots: SpaceStageSnapshot[],
  _participants: SpaceParticipant[]
): SpaceTimelineEvent[] {
  if (snapshots.length === 0) return [];
  const sorted = [...snapshots].sort((a, b) => a.t - b.t);
  const events: SpaceTimelineEvent[] = [];
  let prev = new Set<string>();
  for (const snap of sorted) {
    const next = new Set(snap.on_stage_user_ids);
    const added: string[] = [];
    const removed: string[] = [];
    for (const id of next) {
      if (!prev.has(id)) added.push(id);
    }
    for (const id of prev) {
      if (!next.has(id)) removed.push(id);
    }
    if (added.length) {
      events.push({
        id: nextTimelineEventId(),
        t: snap.t,
        type: 'joined_stage',
        user_ids: added,
        detail: 'On-stage',
      });
    }
    if (removed.length) {
      events.push({
        id: nextTimelineEventId(),
        t: snap.t,
        type: 'left_stage',
        user_ids: removed,
        detail: 'Off stage',
      });
    }
    prev = next;
  }
  return events;
}

/** Speaker change cues from reliable segments only (Periscope / HLS / manual). */
export function buildSpeakerChangedTimelineEvents(segments: SpaceSpeakerSegment[]): SpaceTimelineEvent[] {
  const withSources = withDerivedSegmentSources(segments);
  const reliable = withSources.filter((s) => sourceAllowsActiveHighlight(s.source));
  reliable.sort((a, b) => a.start - b.start || a.end - b.end);
  const events: SpaceTimelineEvent[] = [];
  let prev: string | null = null;
  for (const seg of reliable) {
    if (prev !== seg.speaker_id) {
      events.push({
        id: nextTimelineEventId(),
        t: seg.start,
        type: 'speaker_changed',
        user_ids: [seg.speaker_id],
        detail: 'Speaking',
      });
      prev = seg.speaker_id;
    }
  }
  return events;
}

export interface StageJoinHintRow {
  userId: string;
  /** Seconds from Space start (replay timeline). */
  offsetSecs: number;
}

/** Join cues from GraphQL stage schedule when HLS stage snapshots are missing. */
export function buildTimelineEventsFromStageJoinHints(
  rows: StageJoinHintRow[],
  durationSeconds: number
): SpaceTimelineEvent[] {
  const d = Math.max(0, durationSeconds);
  const events: SpaceTimelineEvent[] = [];
  const sorted = [...rows].sort((a, b) => a.offsetSecs - b.offsetSecs);
  for (const row of sorted) {
    const t = Math.min(Math.max(0, row.offsetSecs), d);
    events.push({
      id: nextTimelineEventId(),
      t,
      type: 'joined_stage',
      user_ids: [row.userId],
      detail: 'Joined stage',
    });
  }
  return events;
}

function timelineEventSortKey(e: SpaceTimelineEvent): number {
  return e.t;
}

/** Merge and sort replay feed events; drops duplicate rows at same t/type/users. */
export function mergeAndSortTimelineEvents(events: SpaceTimelineEvent[]): SpaceTimelineEvent[] {
  const sorted = [...events].sort((a, b) => timelineEventSortKey(a) - timelineEventSortKey(b));
  const out: SpaceTimelineEvent[] = [];
  const seen = new Set<string>();
  for (const e of sorted) {
    const key = `${e.type}|${e.t.toFixed(3)}|${e.user_ids.slice().sort().join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/** Single place to assemble replay feed: HLS stage events, GraphQL join hints, speaker-changed cues. */
export function buildSpaceTimelineEventsPayload(
  participants: SpaceParticipant[],
  stageSnapshots: SpaceStageSnapshot[],
  speakerSegments: SpaceSpeakerSegment[],
  joinHints: StageJoinHintRow[],
  durationSeconds: number
): SpaceTimelineEvent[] {
  const dur = Math.max(0, durationSeconds);
  const fromSnapshots = buildTimelineEventsFromStageSnapshots(stageSnapshots, participants);
  /** Always merge join hints — HLS snapshots may be sparse while AudioSpace stage times still gate roster. */
  const fromHints = joinHints.length > 0 ? buildTimelineEventsFromStageJoinHints(joinHints, dur) : [];
  const fromSpeakerChanges = buildSpeakerChangedTimelineEvents(speakerSegments);
  return mergeAndSortTimelineEvents([...fromSnapshots, ...fromHints, ...fromSpeakerChanges]);
}
