import { getDatabase, timestamp } from './core';
import { getTranscriptByProjectId } from './transcripts';

// Update a word in the transcript and all related segments
export async function updateTranscriptWord(
  projectId: string,
  wordIndex: number,
  newText: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDatabase();

    // Get transcript for this project
    const transcript = await getTranscriptByProjectId(projectId);
    if (!transcript) {
      return { success: false, error: 'No transcript found for this project' };
    }

    // Parse the raw_json to update word data
    let transcriptData;
    try {
      transcriptData = JSON.parse(transcript.raw_json);
    } catch (parseError) {
      return { success: false, error: 'Failed to parse transcript data' };
    }

    // Find and update the word in different possible formats
    let wordUpdated = false;

    // Format 1: Direct words array
    if (transcriptData.words && Array.isArray(transcriptData.words)) {
      if (wordIndex < transcriptData.words.length) {
        const oldText = transcriptData.words[wordIndex].word;
        transcriptData.words[wordIndex].word = newText;
        wordUpdated = true;

        console.log(`[Database] Updated word ${wordIndex}: "${oldText}" -> "${newText}"`);
      }
    }

    // Format 2: Words in segments
    if (!wordUpdated && transcriptData.segments && Array.isArray(transcriptData.segments)) {
      let currentWordIndex = 0;
      for (const segment of transcriptData.segments) {
        if (segment.words && Array.isArray(segment.words)) {
          if (wordIndex < currentWordIndex + segment.words.length) {
            const segmentWordIndex = wordIndex - currentWordIndex;
            const oldText = segment.words[segmentWordIndex].word;
            segment.words[segmentWordIndex].word = newText;
            wordUpdated = true;

            console.log(`[Database] Updated word in segment: "${oldText}" -> "${newText}"`);
            break;
          }
          currentWordIndex += segment.words.length;
        }
      }
    }

    if (!wordUpdated) {
      return { success: false, error: 'Word not found in transcript' };
    }

    // Update the main text field by reconstructing from words
    let fullText = '';
    if (transcriptData.words && Array.isArray(transcriptData.words)) {
      fullText = transcriptData.words.map((w: any) => w.word).join(' ');
    } else if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
      fullText = transcriptData.segments
        .flatMap((seg: any) => seg.words || [])
        .map((w: any) => w.word)
        .join(' ');
    }

    // Update the transcript in the database
    await db.execute('UPDATE transcripts SET raw_json = ?, text = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(transcriptData),
      fullText,
      timestamp(),
      transcript.id,
    ]);

    // Update all clip segments that use this word
    await updateClipSegmentsWithWordChange(projectId, wordIndex, newText);

    return { success: true };
  } catch (error) {
    console.error('[Database] Failed to update transcript word:', error);
    return { success: false, error: 'Database update failed' };
  }
}

// Update clip segments that contain the changed word
async function updateClipSegmentsWithWordChange(
  projectId: string,
  wordIndex: number,
  newText: string
): Promise<void> {
  try {
    const db = await getDatabase();

    // Get all clips for this project with their segments
    const clips = await db.execute(
      `
      SELECT
        c.id as clip_id,
        cv.id as version_id,
        cs.segment_index,
        cs.transcript,
        cs.start_time,
        cs.end_time
      FROM clips c
      JOIN clip_versions cv ON c.id = cv.clip_id
      LEFT JOIN clip_segments cs ON cv.id = cs.clip_version_id
      WHERE c.project_id = ?
      ORDER BY c.id, cv.version_number, cs.segment_index
    `,
      [projectId]
    );

    const transcript = await getTranscriptByProjectId(projectId);
    if (!transcript) return;

    let transcriptData;
    try {
      transcriptData = JSON.parse(transcript.raw_json);
    } catch {
      return;
    }

    // Get all words to find timing info
    let allWords: any[] = [];
    if (transcriptData.words && Array.isArray(transcriptData.words)) {
      allWords = transcriptData.words;
    } else if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
      allWords = transcriptData.segments.flatMap((seg: any) => seg.words || []);
    }

    if (wordIndex >= allWords.length) return;

    const changedWord = allWords[wordIndex];
    const wordStartTime = changedWord.start;
    const wordEndTime = changedWord.end;

    // Update each segment that contains this word
    for (const row of clips as unknown as any[]) {
      if (!row.transcript) continue;

      // Check if this segment's time range contains the changed word
      if (row.start_time <= wordEndTime && row.end_time >= wordStartTime) {
        let segmentTranscriptData;
        try {
          segmentTranscriptData = JSON.parse(row.transcript);
        } catch {
          continue;
        }

        let segmentUpdated = false;

        // Update words in segment transcript
        if (segmentTranscriptData.words && Array.isArray(segmentTranscriptData.words)) {
          for (let i = 0; i < segmentTranscriptData.words.length; i++) {
            const segmentWord = segmentTranscriptData.words[i];
            // Match by timing since word indexes may differ
            if (
              Math.abs(segmentWord.start - wordStartTime) < 0.1 &&
              Math.abs(segmentWord.end - wordEndTime) < 0.1
            ) {
              segmentTranscriptData.words[i].word = newText;
              segmentUpdated = true;
              console.log(
                `[Database] Updated word in clip segment ${row.segment_index}: "${segmentWord.word}" -> "${newText}"`
              );
            }
          }
        }

        if (segmentUpdated) {
          // Update the segment transcript
          await db.execute(
            'UPDATE clip_segments SET transcript = ? WHERE clip_version_id = ? AND segment_index = ?',
            [JSON.stringify(segmentTranscriptData), row.version_id, row.segment_index]
          );
        }
      }
    }
  } catch (error) {
    console.error('[Database] Failed to update clip segments:', error);
  }
}

/**
 * Update one Whisper segment cell by index into `raw_json.segments` (matches parsed `whisperSegments` order).
 * Word rows: `wordIndex` into `segment.words`; empty `newText` removes that word.
 * Whole-segment rows (no word timings): pass `wordIndex: null` to replace `segment.text`.
 */
export async function updateTranscriptWhisperCell(
  projectId: string,
  whisperSegmentIndex: number,
  wordIndex: number | null,
  newText: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDatabase();
    const transcript = await getTranscriptByProjectId(projectId);
    if (!transcript?.raw_json) {
      return { success: false, error: 'No transcript found for this project' };
    }

    let transcriptData: any;
    try {
      transcriptData = JSON.parse(transcript.raw_json);
    } catch {
      return { success: false, error: 'Failed to parse transcript data' };
    }

    if (!transcriptData.segments || !Array.isArray(transcriptData.segments)) {
      return { success: false, error: 'Transcript has no segments array' };
    }

    const segment = transcriptData.segments[whisperSegmentIndex];
    if (!segment) {
      return { success: false, error: 'Invalid segment index' };
    }

    if (wordIndex !== null) {
      if (!segment.words || !Array.isArray(segment.words)) {
        return { success: false, error: 'Segment has no word-level timings' };
      }
      if (wordIndex < 0 || wordIndex >= segment.words.length) {
        return { success: false, error: 'Invalid word index' };
      }
      if (newText.trim() === '') {
        segment.words.splice(wordIndex, 1);
      } else {
        segment.words[wordIndex].word = newText.trim();
      }
      if (segment.words.length > 0) {
        segment.text = segment.words
          .map((w: any) => String(w.word ?? '').trim())
          .filter(Boolean)
          .join(' ');
      } else {
        segment.text = '';
      }
    } else {
      segment.text = newText;
    }

    const hasSegmentWords =
      Array.isArray(transcriptData.segments) &&
      transcriptData.segments.some((s: any) => s.words && Array.isArray(s.words) && s.words.length > 0);
    if (hasSegmentWords && transcriptData.words) {
      delete transcriptData.words;
    }

    let fullText = '';
    if (transcriptData.words && Array.isArray(transcriptData.words) && transcriptData.words.length > 0) {
      fullText = transcriptData.words.map((w: any) => String(w.word ?? '').trim()).filter(Boolean).join(' ');
    } else if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
      fullText = transcriptData.segments
        .map((s: any) => (s.text || '').trim())
        .filter(Boolean)
        .join(' ');
    }

    await db.execute('UPDATE transcripts SET raw_json = ?, text = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(transcriptData),
      fullText,
      timestamp(),
      transcript.id,
    ]);

    return { success: true };
  } catch (error) {
    console.error('[Database] Failed to update transcript whisper cell:', error);
    return { success: false, error: 'Database update failed' };
  }
}
