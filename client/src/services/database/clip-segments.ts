import { getDatabase, timestamp, generateId } from './core';
import type { ClipSegment, ClipVersion } from './types';

// Get adjacent clip segments for collision detection
export async function getAdjacentClipSegments(
  clipId: string,
  segmentIndex: number
): Promise<{ previous: ClipSegment | null; next: ClipSegment | null }> {
  const db = await getDatabase();

  // Get the current version ID for this clip
  const clipVersions = await db.select<ClipVersion[]>(
    'SELECT id FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC LIMIT 1',
    [clipId]
  );

  if (clipVersions.length === 0) {
    return { previous: null, next: null };
  }

  const versionId = clipVersions[0].id;

  // Get all segments for this clip version, ordered by time
  const segments = await db.select<ClipSegment[]>(
    'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY start_time, segment_index',
    [versionId]
  );

  if (segments.length === 0 || segmentIndex < 0 || segmentIndex >= segments.length) {
    return { previous: null, next: null };
  }

  return {
    previous: segmentIndex > 0 ? segments[segmentIndex - 1] : null,
    next: segmentIndex < segments.length - 1 ? segments[segmentIndex + 1] : null,
  };
}

// Get all clip segments for a clip (ordered by time)
export async function getClipSegmentsByClipId(clipId: string): Promise<ClipSegment[]> {
  const db = await getDatabase();

  // Get the current version ID for this clip
  const clipVersions = await db.select<ClipVersion[]>(
    'SELECT id FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC LIMIT 1',
    [clipId]
  );

  if (clipVersions.length === 0) {
    return [];
  }

  const versionId = clipVersions[0].id;

  return await db.select<ClipSegment[]>(
    'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY start_time, segment_index ASC',
    [versionId]
  );
}

// Get clip segments by version ID
export async function getClipSegmentsByVersionId(versionId: string): Promise<ClipSegment[]> {
  const db = await getDatabase();
  return await db.select<ClipSegment[]>(
    'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY segment_index ASC',
    [versionId]
  );
}

// Update a single clip segment's timing
export async function updateClipSegment(
  clipId: string,
  segmentIndex: number,
  startTime: number,
  endTime: number
): Promise<void> {
  const db = await getDatabase();
  const duration = endTime - startTime;

  // Get the current version ID for this clip
  const clipVersions = await db.select<ClipVersion[]>(
    'SELECT id FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC LIMIT 1',
    [clipId]
  );

  if (clipVersions.length === 0) {
    throw new Error('No clip version found for clip');
  }

  const versionId = clipVersions[0].id;

  // Update the clip segment
  await db.execute(
    'UPDATE clip_segments SET start_time = ?, end_time = ?, duration = ? WHERE clip_version_id = ? AND segment_index = ?',
    [startTime, endTime, duration, versionId, segmentIndex]
  );
}

// Split a clip segment into two separate segments at a specific time
export async function splitClipSegment(
  clipId: string,
  segmentIndex: number,
  cutTime: number
): Promise<{ leftSegmentIndex: number; rightSegmentIndex: number }> {
  const db = await getDatabase();

  // Get the current version ID for this clip
  const clipVersions = await db.select<ClipVersion[]>(
    'SELECT id FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC LIMIT 1',
    [clipId]
  );

  if (clipVersions.length === 0) {
    throw new Error('No clip version found for clip');
  }

  const versionId = clipVersions[0].id;

  // Get the segment to split and all subsequent segments
  const segments = await db.select<ClipSegment[]>(
    'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY start_time, segment_index',
    [versionId]
  );

  if (segments.length <= segmentIndex) {
    throw new Error('Segment not found');
  }

  const segmentToSplit = segments[segmentIndex];

  // Validate cut time is within segment bounds
  if (cutTime <= segmentToSplit.start_time || cutTime >= segmentToSplit.end_time) {
    throw new Error('Cut time must be within segment boundaries');
  }

  // Validate minimum segment durations (0.5 seconds each)
  const leftDuration = cutTime - segmentToSplit.start_time;
  const rightDuration = segmentToSplit.end_time - cutTime;

  if (leftDuration < 0.5 || rightDuration < 0.5) {
    throw new Error('Both segments must be at least 0.5 seconds long');
  }

  try {
    // Split the transcript if it contains word-level timing
    let leftTranscript = null;
    let rightTranscript = null;

    if (segmentToSplit.transcript) {
      let transcriptData;

      try {
        transcriptData = JSON.parse(segmentToSplit.transcript);
      } catch (parseError) {
        // Transcript is plain text, not JSON - handle as plain text split

        // For plain text, we'll use a simple approach: keep original on left, none on right
        // This preserves the transcript content without requiring word-level timing
        leftTranscript = segmentToSplit.transcript;
        // Right segment gets no transcript for plain text splits
      }

      // Handle different transcript formats only if we successfully parsed JSON
      if (transcriptData) {
        if (transcriptData.words && Array.isArray(transcriptData.words)) {
          // Split words array
          const leftWords = [];
          const rightWords = [];

          for (const word of transcriptData.words) {
            if (word.end !== undefined && word.end <= cutTime) {
              leftWords.push(word);
            } else if (word.start !== undefined && word.start >= cutTime) {
              rightWords.push(word);
            }
          }

          leftTranscript = JSON.stringify({ ...transcriptData, words: leftWords });
          rightTranscript = JSON.stringify({ ...transcriptData, words: rightWords });
        } else if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
          // Split segments array
          const leftSegments = [];
          const rightSegments = [];

          for (const seg of transcriptData.segments) {
            if (seg.end !== undefined && seg.end <= cutTime) {
              leftSegments.push(seg);
            } else if (seg.start !== undefined && seg.start >= cutTime) {
              rightSegments.push(seg);
            }
          }

          leftTranscript = JSON.stringify({ ...transcriptData, segments: leftSegments });
          rightTranscript = JSON.stringify({ ...transcriptData, segments: rightSegments });
        } else if (Array.isArray(transcriptData)) {
          // Split direct array of words
          const leftWords = [];
          const rightWords = [];

          for (const word of transcriptData) {
            if (word.end !== undefined && word.end <= cutTime) {
              leftWords.push(word);
            } else if (word.start !== undefined && word.start >= cutTime) {
              rightWords.push(word);
            }
          }

          leftTranscript = JSON.stringify(leftWords);
          rightTranscript = JSON.stringify(rightWords);
        }
      }
    }

    // Create the two new segments
    const leftSegmentId = generateId();
    const rightSegmentId = generateId();
    const now = timestamp();

    // First, shift all segments that come after the original segment up by 1
    // This creates space for our new right segment
    await db.execute(
      `UPDATE clip_segments
       SET segment_index = segment_index + 1
       WHERE clip_version_id = ? AND segment_index > ?`,
      [versionId, segmentIndex]
    );

    // Delete the original segment to free up its index
    await db.execute('DELETE FROM clip_segments WHERE id = ?', [segmentToSplit.id]);

    // Now insert the left segment at the original index
    await db.execute(
      `INSERT INTO clip_segments (
        id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        leftSegmentId,
        versionId,
        segmentIndex,
        segmentToSplit.start_time,
        cutTime,
        leftDuration,
        leftTranscript,
        now,
      ]
    );

    // Insert right segment at index + 1 (which is now free due to the shift)
    await db.execute(
      `INSERT INTO clip_segments (
        id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rightSegmentId,
        versionId,
        segmentIndex + 1,
        cutTime,
        segmentToSplit.end_time,
        rightDuration,
        rightTranscript,
        now,
      ]
    );

    return {
      leftSegmentIndex: segmentIndex,
      rightSegmentIndex: segmentIndex + 1,
    };
  } catch (error) {
    throw new Error(
      `Failed to split segment: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Delete a clip segment
export async function deleteClipSegment(clipId: string, segmentIndex: number): Promise<void> {
  const db = await getDatabase();

  try {
    // Get the current clip version to find the segment
    const clip = await db.select<{ current_version_id: string }[]>(
      'SELECT current_version_id FROM clips WHERE id = ?',
      [clipId]
    );

    if (clip.length === 0) {
      throw new Error('Clip not found');
    }

    const versionId = clip[0].current_version_id;

    // Get all segments to determine segment count
    const segments = await db.select<{ id: string; segment_index: number }[]>(
      'SELECT id, segment_index FROM clip_segments WHERE clip_version_id = ? ORDER BY segment_index',
      [versionId]
    );

    if (segmentIndex < 0 || segmentIndex >= segments.length) {
      throw new Error('Invalid segment index');
    }

    // Don't allow deletion if it's the only segment
    if (segments.length <= 1) {
      throw new Error('Cannot delete the last segment of a clip');
    }

    const segmentToDelete = segments[segmentIndex];

    // Delete the segment
    await db.execute('DELETE FROM clip_segments WHERE id = ?', [segmentToDelete.id]);

    // Update segment indices for segments after the deleted one
    await db.execute(
      'UPDATE clip_segments SET segment_index = segment_index - 1 WHERE clip_version_id = ? AND segment_index > ?',
      [versionId, segmentIndex]
    );
  } catch (error) {
    throw new Error(
      `Failed to delete segment: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Realign transcript words within a moved clip segment
export async function realignClipSegment(
  clipId: string,
  segmentIndex: number,
  originalStartTime: number,
  originalEndTime: number,
  newStartTime: number,
  newEndTime: number
): Promise<void> {
  const db = await getDatabase();

  // Get the current version ID for this clip
  const clipVersions = await db.select<ClipVersion[]>(
    'SELECT id FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC LIMIT 1',
    [clipId]
  );

  if (clipVersions.length === 0) {
    throw new Error('No clip version found for clip');
  }

  const versionId = clipVersions[0].id;

  // Get the clip segment to realign
  const segments = await db.select<ClipSegment[]>(
    'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY start_time, segment_index',
    [versionId]
  );

  if (segments.length <= segmentIndex) {
    throw new Error('Segment not found');
  }

  // Calculate time shift and scale for realignment
  const timeShift = newStartTime - originalStartTime;
  const timeScale = (newEndTime - newStartTime) / (originalEndTime - originalStartTime);

  // Get the segment data
  const segment = segments[segmentIndex];
  if (!segment.transcript) {
    return;
  }

  try {
    // Parse the transcript to extract word-level timing if available
    let realignedTranscript = segment.transcript;

    // Check if transcript contains word-level timestamps (JSON format)
    if (segment.transcript.trim().startsWith('{') || segment.transcript.trim().startsWith('[')) {
      try {
        const transcriptData = JSON.parse(segment.transcript);

        // Handle different transcript formats
        if (transcriptData.words && Array.isArray(transcriptData.words)) {
          // Format: { words: [{word: "hello", start: 0.0, end: 0.5}, ...] }
          transcriptData.words.forEach((word: any) => {
            if (word.start !== undefined) word.start = word.start * timeScale + timeShift;
            if (word.end !== undefined) word.end = word.end * timeScale + timeShift;
          });
          realignedTranscript = JSON.stringify(transcriptData);
        } else if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
          // Format: { segments: [{start: 0.0, end: 2.0, text: "hello world"}] }
          transcriptData.segments.forEach((seg: any) => {
            if (seg.start !== undefined) seg.start = seg.start * timeScale + timeShift;
            if (seg.end !== undefined) seg.end = seg.end * timeScale + timeShift;
          });
          realignedTranscript = JSON.stringify(transcriptData);
        } else if (Array.isArray(transcriptData)) {
          // Format: [{word: "hello", start: 0.0, end: 0.5}, ...]
          transcriptData.forEach((word: any) => {
            if (word.start !== undefined) word.start = word.start * timeScale + timeShift;
            if (word.end !== undefined) word.end = word.end * timeScale + timeShift;
          });
          realignedTranscript = JSON.stringify(transcriptData);
        }
      } catch (parseError) {
        console.log('[Database] Transcript is not valid JSON, treating as plain text');
        // Keep as plain text, no word-level timing to adjust
      }
    }

    // Update the segment with realigned transcript
    await db.execute(
      'UPDATE clip_segments SET transcript = ? WHERE clip_version_id = ? AND segment_index = ?',
      [realignedTranscript, versionId, segmentIndex]
    );
  } catch (error) {
    console.error('[Database] Failed to realign segment transcript:', error);
    // Continue without transcript realignment - segment timing is still updated
  }
}
