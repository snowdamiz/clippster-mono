import { getDatabase, timestamp, generateId } from './core';
import { createProject } from './projects';
import type {
  LivestreamSegmentRecord,
  LivestreamSessionRecord,
  MonitoredStreamerRecord,
} from './types';

function toSqlBool(value: number | boolean): number {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return value;
}

export async function getAllMonitoredStreamers(): Promise<MonitoredStreamerRecord[]> {
  const db = await getDatabase();
  return await db.select<MonitoredStreamerRecord[]>(
    'SELECT * FROM monitored_streamers ORDER BY created_at DESC'
  );
}

export async function getMonitoredStreamer(id: string): Promise<MonitoredStreamerRecord | null> {
  const db = await getDatabase();
  const result = await db.select<MonitoredStreamerRecord[]>(
    'SELECT * FROM monitored_streamers WHERE id = ?',
    [id]
  );
  return result[0] || null;
}

export async function getMonitoredStreamerByMint(
  mintId: string
): Promise<MonitoredStreamerRecord | null> {
  const db = await getDatabase();
  const result = await db.select<MonitoredStreamerRecord[]>(
    'SELECT * FROM monitored_streamers WHERE mint_id = ?',
    [mintId]
  );
  return result[0] || null;
}

export async function createMonitoredStreamer(
  mintId: string,
  displayName: string
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    'INSERT INTO monitored_streamers (id, mint_id, display_name, last_check_timestamp, is_currently_live, current_session_id, created_at, updated_at) VALUES (?, ?, ?, NULL, 0, NULL, ?, ?)',
    [id, mintId, displayName, now, now]
  );

  return id;
}

export async function updateMonitoredStreamer(
  id: string,
  updates: Partial<{
    display_name: string;
    last_check_timestamp: number | null;
    is_currently_live: number | boolean;
    current_session_id: string | null;
  }>
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.display_name !== undefined) {
    fields.push('display_name = ?');
    values.push(updates.display_name);
  }

  if (updates.last_check_timestamp !== undefined) {
    fields.push('last_check_timestamp = ?');
    values.push(updates.last_check_timestamp);
  }

  if (updates.is_currently_live !== undefined) {
    fields.push('is_currently_live = ?');
    values.push(toSqlBool(updates.is_currently_live));
  }

  if (updates.current_session_id !== undefined) {
    fields.push('current_session_id = ?');
    values.push(updates.current_session_id);
  }

  if (fields.length === 0) {
    return;
  }

  fields.push('updated_at = ?');
  values.push(timestamp());
  values.push(id);

  await db.execute(`UPDATE monitored_streamers SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteMonitoredStreamer(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM monitored_streamers WHERE id = ?', [id]);
}

export async function createLivestreamSession(
  monitoredStreamerId: string,
  mintId: string,
  displayName: string,
  streamStartTime?: number
): Promise<{ sessionId: string; projectId: string }> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const startTime = streamStartTime ?? now;

  const projectName = `${displayName || mintId.slice(0, 6)} Live ${new Date().toLocaleString()}`;
  const projectDescription = `PumpFun livestream for ${displayName} (${mintId})`;
  const projectId = await createProject(projectName, projectDescription);

  await db.execute(
    'INSERT INTO livestream_sessions (id, monitored_streamer_id, mint_id, stream_start_time, stream_end_time, is_recording, total_segments, processed_segments, created_at, updated_at, project_id) VALUES (?, ?, ?, ?, NULL, 1, 0, 0, ?, ?, ?)',
    [id, monitoredStreamerId, mintId, startTime, now, now, projectId]
  );

  await updateMonitoredStreamer(monitoredStreamerId, {
    is_currently_live: 1,
    current_session_id: id,
    last_check_timestamp: now,
  });

  return { sessionId: id, projectId };
}

export async function getLivestreamSession(id: string): Promise<LivestreamSessionRecord | null> {
  const db = await getDatabase();
  const result = await db.select<LivestreamSessionRecord[]>(
    'SELECT * FROM livestream_sessions WHERE id = ?',
    [id]
  );
  return result[0] || null;
}

export async function getActiveLivestreamSessions(): Promise<LivestreamSessionRecord[]> {
  const db = await getDatabase();
  return await db.select<LivestreamSessionRecord[]>(
    'SELECT * FROM livestream_sessions WHERE is_recording = 1 ORDER BY stream_start_time DESC'
  );
}

export async function endLivestreamSession(
  sessionId: string,
  streamEndTime?: number
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();
  const session = await getLivestreamSession(sessionId);

  if (!session) {
    return;
  }

  await db.execute(
    'UPDATE livestream_sessions SET stream_end_time = ?, is_recording = 0, updated_at = ? WHERE id = ?',
    [streamEndTime ?? now, now, sessionId]
  );

  await updateMonitoredStreamer(session.monitored_streamer_id, {
    is_currently_live: 0,
    current_session_id: null,
    last_check_timestamp: now,
  });
}

export async function updateLivestreamSessionProgress(
  sessionId: string,
  updates: Partial<{
    totalSegmentsDelta: number;
    processedSegmentsDelta: number;
    isRecording: boolean;
  }>
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (typeof updates.totalSegmentsDelta === 'number' && updates.totalSegmentsDelta !== 0) {
    fields.push('total_segments = total_segments + ?');
    values.push(updates.totalSegmentsDelta);
  }

  if (typeof updates.processedSegmentsDelta === 'number' && updates.processedSegmentsDelta !== 0) {
    fields.push('processed_segments = processed_segments + ?');
    values.push(updates.processedSegmentsDelta);
  }

  if (updates.isRecording !== undefined) {
    fields.push('is_recording = ?');
    values.push(toSqlBool(updates.isRecording));
  }

  if (fields.length === 0) {
    return;
  }

  fields.push('updated_at = ?');
  values.push(timestamp());
  values.push(sessionId);

  await db.execute(`UPDATE livestream_sessions SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function createLivestreamSegment(
  sessionId: string,
  payload: {
    segmentNumber: number;
    startTimeOffset: number;
    duration: number;
    status?: LivestreamSegmentRecord['status'];
    rawVideoId?: string | null;
  }
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    'INSERT INTO livestream_segments (id, session_id, segment_number, start_time_offset, duration, raw_video_id, status, clips_detected, error_message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)',
    [
      id,
      sessionId,
      payload.segmentNumber,
      payload.startTimeOffset,
      payload.duration,
      payload.rawVideoId || null,
      payload.status || 'recording',
      now,
      now,
    ]
  );

  await updateLivestreamSessionProgress(sessionId, { totalSegmentsDelta: 1 });

  return id;
}

export async function getLivestreamSegment(
  segmentId: string
): Promise<LivestreamSegmentRecord | null> {
  const db = await getDatabase();
  const result = await db.select<LivestreamSegmentRecord[]>(
    'SELECT * FROM livestream_segments WHERE id = ?',
    [segmentId]
  );
  return result[0] || null;
}

export async function getSegmentsBySession(sessionId: string): Promise<LivestreamSegmentRecord[]> {
  const db = await getDatabase();
  return await db.select<LivestreamSegmentRecord[]>(
    'SELECT * FROM livestream_segments WHERE session_id = ? ORDER BY segment_number ASC',
    [sessionId]
  );
}

export async function updateLivestreamSegment(
  segmentId: string,
  updates: Partial<{
    raw_video_id: string | null;
    status: LivestreamSegmentRecord['status'];
    clips_detected: number;
    error_message: string | null;
  }>
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.raw_video_id !== undefined) {
    fields.push('raw_video_id = ?');
    values.push(updates.raw_video_id);
  }

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }

  if (updates.clips_detected !== undefined) {
    fields.push('clips_detected = ?');
    values.push(updates.clips_detected);
  }

  if (updates.error_message !== undefined) {
    fields.push('error_message = ?');
    values.push(updates.error_message);
  }

  if (fields.length === 0) {
    return;
  }

  fields.push('updated_at = ?');
  values.push(timestamp());
  values.push(segmentId);

  await db.execute(`UPDATE livestream_segments SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function updateSegmentStatus(
  segmentId: string,
  status: LivestreamSegmentRecord['status'],
  errorMessage?: string | null
): Promise<void> {
  await updateLivestreamSegment(segmentId, {
    status,
    error_message: errorMessage ?? null,
  });
}
