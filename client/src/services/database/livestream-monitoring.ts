import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
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
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<MonitoredStreamerRecord[]>(
      'SELECT * FROM monitored_streamers WHERE user_id IS NULL ORDER BY created_at DESC'
    );
  }

  return await db.select<MonitoredStreamerRecord[]>(
    'SELECT * FROM monitored_streamers WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC',
    [userId]
  );
}

export async function getAutoDvrStreamers(): Promise<MonitoredStreamerRecord[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<MonitoredStreamerRecord[]>(
      'SELECT * FROM monitored_streamers WHERE user_id IS NULL AND auto_dvr = 1 ORDER BY created_at DESC'
    );
  }

  return await db.select<MonitoredStreamerRecord[]>(
    'SELECT * FROM monitored_streamers WHERE (user_id = ? OR user_id IS NULL) AND auto_dvr = 1 ORDER BY created_at DESC',
    [userId]
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
  const userId = getCurrentUserId();

  if (userId === null) {
    const result = await db.select<MonitoredStreamerRecord[]>(
      'SELECT * FROM monitored_streamers WHERE mint_id = ? AND user_id IS NULL',
      [mintId]
    );
    return result[0] || null;
  }

  const result = await db.select<MonitoredStreamerRecord[]>(
    'SELECT * FROM monitored_streamers WHERE mint_id = ? AND (user_id = ? OR user_id IS NULL)',
    [mintId, userId]
  );
  return result[0] || null;
}

export async function createMonitoredStreamer(
  mintId: string,
  displayName: string,
  profileImageUrl?: string,
  segmentDurationMinutes: number = 5,
  autoDvr: boolean = false,
  platform: string = 'pumpfun'
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    'INSERT INTO monitored_streamers (id, mint_id, display_name, platform, last_check_timestamp, is_currently_live, current_session_id, profile_image_url, stream_thumbnail_url, segment_duration_minutes, auto_dvr, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, 0, NULL, ?, NULL, ?, ?, ?, ?, ?)',
    [
      id,
      mintId,
      displayName,
      platform,
      profileImageUrl || null,
      segmentDurationMinutes,
      autoDvr ? 1 : 0,
      userId,
      now,
      now,
    ]
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('monitored-streamers-updated', {
        detail: { action: 'created', streamerId: id, mintId, platform },
      })
    );
  }

  return id;
}

export async function updateMonitoredStreamer(
  id: string,
  updates: Partial<{
    display_name: string;
    last_check_timestamp: number | null;
    is_currently_live: number | boolean;
    current_session_id: string | null;
    profile_image_url: string | null;
    stream_thumbnail_url: string | null;
    segment_duration_minutes: number;
    auto_dvr: number | boolean;
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

  if (updates.profile_image_url !== undefined) {
    fields.push('profile_image_url = ?');
    values.push(updates.profile_image_url);
  }

  if (updates.stream_thumbnail_url !== undefined) {
    fields.push('stream_thumbnail_url = ?');
    values.push(updates.stream_thumbnail_url);
  }

  if (updates.segment_duration_minutes !== undefined) {
    fields.push('segment_duration_minutes = ?');
    values.push(updates.segment_duration_minutes);
  }

  if (updates.auto_dvr !== undefined) {
    fields.push('auto_dvr = ?');
    values.push(toSqlBool(updates.auto_dvr));
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

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('monitored-streamers-updated', {
        detail: { action: 'deleted', streamerId: id },
      })
    );
  }
}

export async function createLivestreamSession(
  monitoredStreamerId: string,
  mintId: string,
  displayName: string,
  streamStartTime?: number,
  platform?: 'PumpFun' | 'Kick' | 'YouTube' | 'Twitch' | 'Rumble' | 'Twitter' | 'Manual'
): Promise<{ sessionId: string; projectId: string }> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const startTime = streamStartTime ?? now;

  // Try to find an existing parent project for this streamer from today's sessions
  // This ensures segments from reconnects/multiple sessions on the SAME DAY are grouped together
  // but creates a new project each calendar day
  const startOfToday = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000); // Midnight today (Unix timestamp)
  const recentCutoff = startOfToday;
  const existingSession = await db.select<{ project_id: string }[]>(
    `SELECT project_id FROM livestream_sessions 
     WHERE monitored_streamer_id = ? AND project_id IS NOT NULL AND created_at > ?
     ORDER BY created_at DESC LIMIT 1`,
    [monitoredStreamerId, recentCutoff]
  );

  let projectId: string;

  if (existingSession.length > 0 && existingSession[0].project_id) {
    // Verify the project still exists before reusing (it might have been cleaned up)
    const existingProject = await db.select<{ id: string }[]>(
      'SELECT id FROM projects WHERE id = ?',
      [existingSession[0].project_id]
    );

    if (existingProject.length > 0) {
      // Reuse existing parent project
      projectId = existingSession[0].project_id;
      console.log('[LiveMonitor] Reusing existing parent project:', projectId);
    } else {
      // Project was deleted, create a new one
      const projectName = `${displayName || mintId.slice(0, 6)} Live ${new Date().toLocaleString()}`;
      const projectDescription = `${platform || 'PumpFun'} livestream for ${displayName} (${mintId})`;
      projectId = await createProject(projectName, projectDescription, undefined, platform || 'PumpFun');
      console.log(
        '[LiveMonitor] Previous project was deleted, created new parent project:',
        projectId
      );
    }
  } else {
    // Create a new parent project for this streamer
    const projectName = `${displayName || mintId.slice(0, 6)} Live ${new Date().toLocaleString()}`;
    const projectDescription = `${platform || 'PumpFun'} livestream for ${displayName} (${mintId})`;
    projectId = await createProject(projectName, projectDescription, undefined, platform || 'PumpFun');
    console.log('[LiveMonitor] Created new parent project:', projectId);
  }

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

export async function getLivestreamSessionByProjectId(
  projectId: string
): Promise<LivestreamSessionRecord | null> {
  const db = await getDatabase();
  const result = await db.select<LivestreamSessionRecord[]>(
    'SELECT * FROM livestream_sessions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1',
    [projectId]
  );
  return result[0] || null;
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

  // Check if segment already exists to avoid unique constraint violation
  const existing = await db.select<LivestreamSegmentRecord[]>(
    'SELECT id FROM livestream_segments WHERE session_id = ? AND segment_number = ?',
    [sessionId, payload.segmentNumber]
  );

  if (existing.length > 0) {
    // If it exists, update it instead of failing, or just return the ID
    // Let's return the ID to be safe, assuming it's the same segment
    return existing[0].id;
  }

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

/**
 * Create a project specifically for clips from watch mode (temp recording).
 * This is called when a user creates their first clip while watching without recording.
 * Project name format: "{displayName} - {YYYY-MM-DD}"
 */
export async function createLivestreamClipProject(
  displayName: string,
  mintId: string,
  platform?: 'PumpFun' | 'Kick' | 'YouTube' | 'Twitch' | 'Rumble' | 'Twitter' | 'Manual'
): Promise<string> {
  // Format date as YYYY-MM-DD
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const projectName = `${displayName} - ${dateStr}`;
  const platformName = platform || 'PumpFun';
  const projectDescription = `Clips from ${platformName} livestream ${displayName} (${mintId})`;

  // Reuse an existing project for this stream/day if it already exists
  const db = await getDatabase();
  const userId = getCurrentUserId();

  const existing = await db.select<{ id: string }[]>(
    userId === null
      ? 'SELECT id FROM projects WHERE name = ? AND platform = ? AND user_id IS NULL LIMIT 1'
      : 'SELECT id FROM projects WHERE name = ? AND platform = ? AND (user_id = ? OR user_id IS NULL) LIMIT 1',
    userId === null ? [projectName, platformName] : [projectName, platformName, userId]
  );

  if (existing[0]?.id) {
    console.log('[LiveMonitor] Reusing existing clip project for watch mode:', existing[0].id, projectName);
    return existing[0].id;
  }
  
  // Use the existing createProject function
  const projectId = await createProject(projectName, projectDescription, undefined, platformName);
  
  console.log('[LiveMonitor] Created clip project for watch mode:', projectId, projectName);
  
  return projectId;
}