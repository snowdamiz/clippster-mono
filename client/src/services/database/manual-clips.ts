import { getDatabase, timestamp, generateId } from './core';
import { getProject } from './projects';
import { createClipVersion } from './clip-versions';
import { createClipDetectionSession } from './clip-detection-sessions';
import { getTranscriptByProjectId } from './transcripts';

/**
 * Extract transcript text for a specific time range from the raw transcript JSON
 */
export function extractTranscriptForTimeRange(
  rawJson: string,
  startTime: number,
  endTime: number
): string {
  try {
    const data = JSON.parse(rawJson);
    const words: string[] = [];

    if (data.segments && Array.isArray(data.segments)) {
      for (const segment of data.segments) {
        // Check if segment overlaps with our time range
        if (segment.end < startTime || segment.start > endTime) {
          continue;
        }

        // If segment has words, extract words within time range
        if (segment.words && Array.isArray(segment.words)) {
          for (const word of segment.words) {
            const wordStart = word.start || 0;
            const wordEnd = word.end || wordStart;

            // Include word if it overlaps with our time range
            if (wordEnd >= startTime && wordStart <= endTime) {
              const wordText = word.word || word.text || '';
              if (wordText.trim()) {
                words.push(wordText.trim());
              }
            }
          }
        } else if (segment.text) {
          // Fallback: if no word-level timing, include segment text if it overlaps
          if (segment.start >= startTime && segment.end <= endTime) {
            words.push(segment.text.trim());
          }
        }
      }
    }

    return words.join(' ').replace(/\s+/g, ' ').trim();
  } catch (error) {
    console.error('[ManualClips] Failed to extract transcript:', error);
    return '';
  }
}

/**
 * Create a manual clip with proper versioning and session management
 * This allows users to manually mark a section of video as a clip
 */
export async function createManualClip(
  projectId: string,
  clipData: {
    name: string;
    startTime: number;
    endTime: number;
    description?: string;
  },
  filePath?: string
): Promise<string> {
  const db = await getDatabase();
  const clipId = generateId();
  const now = timestamp();

  // Look up the project name to store it on the clip
  const project = await getProject(projectId);
  const projectName = project?.name || null;

  // Create a session for manual clips (we group all manual clips under special sessions)
  // Check if there's an existing "manual" session for today, or create a new one
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let sessionId: string;

  // Try to find an existing manual session for this project
  const existingSession = await db.select<{ id: string }[]>(
    `SELECT id FROM clip_detection_sessions 
     WHERE project_id = ? AND prompt = 'Manual clip creation' 
     ORDER BY created_at DESC LIMIT 1`,
    [projectId]
  );

  if (existingSession.length > 0) {
    sessionId = existingSession[0].id;
    // Update the session's clip count
    await db.execute(
      `UPDATE clip_detection_sessions 
       SET total_clips_detected = total_clips_detected + 1 
       WHERE id = ?`,
      [sessionId]
    );
  } else {
    // Create a new session for manual clips
    sessionId = await createClipDetectionSession(projectId, 'Manual clip creation', {
      detectionModel: 'manual',
      totalClipsDetected: 1,
      runColor: '#22C55E', // Green color for manual clips
    });
  }

  // Get transcript for the project to extract text for this time range
  let segmentTranscript = '';
  try {
    const transcript = await getTranscriptByProjectId(projectId);
    if (transcript?.raw_json) {
      segmentTranscript = extractTranscriptForTimeRange(
        transcript.raw_json,
        clipData.startTime,
        clipData.endTime
      );
    }
  } catch (error) {
    console.error('[ManualClips] Failed to extract transcript for segment:', error);
  }

  // Create the clip record
  await db.execute(
    `INSERT INTO clips (
      id, project_id, project_name, name, file_path, start_time, end_time,
      detection_session_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clipId,
      projectId,
      projectName,
      clipData.name,
      filePath || '',
      clipData.startTime,
      clipData.endTime,
      sessionId,
      now,
      now,
    ]
  );

  // Create the initial version (use 'detected' as the change type for initial clip creation)
  const versionId = await createClipVersion(
    clipId,
    sessionId,
    1,
    {
      name: clipData.name,
      startTime: clipData.startTime,
      endTime: clipData.endTime,
      description: clipData.description || 'Manually created clip',
      viralityScore: 0, // Manual clips don't have virality scores
      detectionReason: 'User manually marked this section as a clip',
    },
    'detected', // Use 'detected' for initial clip creation (matches AI-detected clips)
    'Manual clip creation'
  );

  // Create the segment for this clip
  const segmentId = generateId();
  const duration = clipData.endTime - clipData.startTime;

  await db.execute(
    `INSERT INTO clip_segments (
      id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      segmentId,
      versionId,
      0, // First segment
      clipData.startTime,
      clipData.endTime,
      duration,
      segmentTranscript || null,
      now,
    ]
  );

  // Update the clip with the current version
  await db.execute('UPDATE clips SET current_version_id = ? WHERE id = ?', [versionId, clipId]);

  console.log('[ManualClips] Created manual clip:', {
    clipId,
    name: clipData.name,
    startTime: clipData.startTime,
    endTime: clipData.endTime,
    hasTranscript: !!segmentTranscript,
  });

  return clipId;
}
