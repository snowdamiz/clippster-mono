import { generateId, getCurrentUserId, getDatabase, timestamp } from './core';
import type {
  DownloadedSpaceMetadata,
  SpaceParticipant,
  SpaceSpeakerSegment,
  SpaceStageSnapshot,
} from './types';

export interface SpaceMetadataPayload {
  audioId: string;
  sourceUrl?: string;
  title?: string;
  participants?: SpaceParticipant[];
  speakerSegments?: SpaceSpeakerSegment[];
  /** Omit to leave existing DB value unchanged on update. */
  stageSnapshots?: SpaceStageSnapshot[];
}

export async function upsertDownloadedSpaceMetadata(payload: SpaceMetadataPayload): Promise<void> {
  const db = await getDatabase();
  const userId = getCurrentUserId();
  const now = timestamp();
  const existing = await getDownloadedSpaceMetadata(payload.audioId);

  const participantsJson = payload.participants ? JSON.stringify(payload.participants) : null;
  // `[]` must clear saved segments; only `undefined` preserves the existing column.
  const speakerSegmentsJson =
    payload.speakerSegments !== undefined ? JSON.stringify(payload.speakerSegments) : null;
  const stageSnapshotsJson =
    payload.stageSnapshots === undefined
      ? undefined
      : payload.stageSnapshots.length > 0
        ? JSON.stringify(payload.stageSnapshots)
        : null;

  if (existing) {
    await db.execute(
      `UPDATE downloaded_space_metadata
       SET source_url = ?, title = ?, participants_json = ?, speaker_segments_json = ?,
           stage_snapshots_json = ?, updated_at = ?
       WHERE audio_id = ?`,
      [
        payload.sourceUrl ?? existing.source_url ?? null,
        payload.title ?? existing.title ?? null,
        participantsJson ?? existing.participants_json ?? null,
        speakerSegmentsJson ?? existing.speaker_segments_json ?? null,
        stageSnapshotsJson !== undefined
          ? stageSnapshotsJson
          : (existing.stage_snapshots_json ?? null),
        now,
        payload.audioId,
      ]
    );
    return;
  }

  await db.execute(
    `INSERT INTO downloaded_space_metadata
     (id, audio_id, source_url, title, participants_json, speaker_segments_json, stage_snapshots_json, user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      payload.audioId,
      payload.sourceUrl ?? null,
      payload.title ?? null,
      participantsJson,
      speakerSegmentsJson,
      stageSnapshotsJson !== undefined ? stageSnapshotsJson : null,
      userId,
      now,
      now,
    ]
  );
}

export async function getDownloadedSpaceMetadata(audioId: string): Promise<DownloadedSpaceMetadata | null> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  const rows = userId === null
    ? await db.select<DownloadedSpaceMetadata[]>(
        'SELECT * FROM downloaded_space_metadata WHERE audio_id = ? AND user_id IS NULL LIMIT 1',
        [audioId]
      )
    : await db.select<DownloadedSpaceMetadata[]>(
        'SELECT * FROM downloaded_space_metadata WHERE audio_id = ? AND (user_id = ? OR user_id IS NULL) ORDER BY user_id DESC LIMIT 1',
        [audioId, userId]
      );

  return rows.length > 0 ? rows[0] : null;
}

export function parseSpaceParticipants(value: string | null): SpaceParticipant[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as SpaceParticipant[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseSpaceSpeakerSegments(value: string | null): SpaceSpeakerSegment[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as SpaceSpeakerSegment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseSpaceStageSnapshots(value: string | null): SpaceStageSnapshot[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as SpaceStageSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
