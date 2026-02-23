/**
 * Global Clip Build Event Handler
 *
 * This service listens for clip-build-complete events from the Rust backend
 * and ensures the database is always updated, regardless of which view is active.
 *
 * This solves the issue where clips get stuck in "building" status when the user
 * navigates away from the view that initiated the build.
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { updateClipBuildStatus, updateClipBuild, getClipBuilds } from './database/clip-build';
import { getClip } from './database/clips';
import { useToast } from '@/composables/useToast';
import { getTranscriptByProjectId } from './database/transcripts';
import { getDatabase, generateId, timestamp } from './database/core';
import { invoke } from '@tauri-apps/api/core';

interface ClipBuildCompletePayload {
  clip_id: string;
  project_id: string;
  success: boolean;
  output_path: string | null;
  all_output_paths: string[];
  thumbnail_path: string | null;
  duration: number | null;
  file_size: number | null;
  error: string | null;
}

let unlistenComplete: UnlistenFn | null = null;
let isInitialized = false;

/**
 * Copy transcript from project level to clip segments
 * This makes clips self-contained so they retain transcripts even if the source project is deleted
 */
async function copyTranscriptToClipSegments(clipId: string, projectId: string): Promise<void> {
  console.log(`[GlobalClipBuildHandler] Copying transcript to clip segments for: ${clipId}`);
  
  try {
    // Get the clip to verify it exists
    const clip = await getClip(clipId);
    if (!clip) {
      console.warn(`[GlobalClipBuildHandler] Clip not found: ${clipId}`);
      return;
    }
    
    // Get the project-level transcript
    const transcript = await getTranscriptByProjectId(projectId);
    if (!transcript || !transcript.text) {
      console.log(`[GlobalClipBuildHandler] No transcript found for project: ${projectId}`);
      return;
    }
    
    console.log(`[GlobalClipBuildHandler] Found project transcript: ${transcript.text.length} characters`);
    
    // Extract only the relevant portion for this clip based on start_time and end_time
    let clipTranscript = transcript.text;
    let clipRawJson: string | null = null;
    const startTime = clip.start_time || 0;
    const endTime = clip.end_time || clip.duration || 0;
    
    // Extract word-level timing data from raw_json and build clip-specific raw_json
    // with times offset to 0-based (relative to clip start)
    try {
      const transcriptData = JSON.parse(transcript.raw_json);
      console.log(`[GlobalClipBuildHandler] Parsed raw_json, keys: ${Object.keys(transcriptData).join(', ')}`);
      
      const clipData: any = {};
      
      // Extract words in the clip's time range and offset to 0-based
      if (transcriptData.words && Array.isArray(transcriptData.words)) {
        const clipWords = transcriptData.words
          .filter((w: any) => (w.start ?? 0) >= startTime && (w.start ?? 0) < endTime)
          .map((w: any) => ({
            ...w,
            start: (w.start ?? 0) - startTime,
            end: (w.end ?? 0) - startTime,
          }));
        if (clipWords.length > 0) {
          clipData.words = clipWords;
          console.log(`[GlobalClipBuildHandler] Extracted ${clipWords.length} words for clip time range`);
        }
      }
      
      // Extract segments in the clip's time range and offset to 0-based
      if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
        const clipSegments = transcriptData.segments
          .filter((seg: any) => (seg.start ?? 0) < endTime && (seg.end ?? 0) > startTime)
          .map((seg: any) => {
            const offsetSeg = {
              ...seg,
              start: Math.max(0, (seg.start ?? 0) - startTime),
              end: (seg.end ?? 0) - startTime,
            };
            // Also offset words within segments if present
            if (seg.words && Array.isArray(seg.words)) {
              offsetSeg.words = seg.words
                .filter((w: any) => (w.start ?? 0) >= startTime && (w.start ?? 0) < endTime)
                .map((w: any) => ({
                  ...w,
                  start: (w.start ?? 0) - startTime,
                  end: (w.end ?? 0) - startTime,
                }));
            }
            return offsetSeg;
          });
        
        if (clipSegments.length > 0) {
          clipData.segments = clipSegments;
          clipTranscript = clipSegments.map((s: any) => s.text || '').join(' ');
          console.log(`[GlobalClipBuildHandler] Extracted ${clipSegments.length} segments from raw_json for time range ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`);
        }
      }
      
      // Build the clip-specific raw_json if we extracted any data
      if (clipData.words || clipData.segments) {
        clipRawJson = JSON.stringify(clipData);
        console.log(`[GlobalClipBuildHandler] Built clip raw_json: ${clipRawJson.length} chars`);
      }
    } catch (parseError) {
      console.warn(`[GlobalClipBuildHandler] Failed to parse raw_json:`, parseError);
    }
    
    // Fallback: try transcript_segments table if we didn't get data from raw_json
    if (clipTranscript === transcript.text || !clipRawJson) {
      try {
        const db = await getDatabase();
        const segments = await db.select<Array<{ text: string; start_time: number; end_time: number }>>(
          `SELECT text, start_time, end_time 
           FROM transcript_segments 
           WHERE transcript_id = ? 
           AND start_time < ? 
           AND end_time > ?
           ORDER BY segment_index`,
          [transcript.id, endTime, startTime]
        );
        
        if (segments.length > 0) {
          clipTranscript = segments.map(s => s.text).join(' ');
          console.log(`[GlobalClipBuildHandler] Extracted ${segments.length} transcript segments for clip time range ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`);

          // Build clipRawJson from transcript_segments if raw_json didn't cover the range
          if (!clipRawJson) {
            const synthSegments = segments.map(s => {
              const segStart = Math.max(0, s.start_time - startTime);
              const segEnd = s.end_time - startTime;
              const words = (s.text || '').trim().split(/\s+/).filter(Boolean);
              const duration = segEnd - segStart;
              const wordDur = words.length > 0 ? duration / words.length : 0;
              return {
                start: segStart,
                end: segEnd,
                text: s.text,
                words: words.map((w: string, i: number) => ({
                  word: w,
                  start: segStart + i * wordDur,
                  end: segStart + (i + 1) * wordDur,
                })),
              };
            });
            clipRawJson = JSON.stringify({ segments: synthSegments });
            console.log(`[GlobalClipBuildHandler] Built clip raw_json from transcript_segments: ${clipRawJson.length} chars`);
          }
        } else {
          console.log(`[GlobalClipBuildHandler] Using full transcript as fallback (${clipTranscript.length} chars)`);
        }
      } catch (segmentError) {
        console.warn(`[GlobalClipBuildHandler] Failed to query transcript segments:`, segmentError);
      }
    }
    
    console.log(`[GlobalClipBuildHandler] Clip-specific transcript: ${clipTranscript.length} characters, raw_json: ${clipRawJson ? 'yes' : 'no'}`);
    
    // Calculate audio peaks for the clip
    let audioPeaksJson: string | null = null;
    try {
      console.log(`[GlobalClipBuildHandler] Calculating audio peaks for clip...`);
      const videoPath = clip.built_file_path || clip.file_path;
      
      if (videoPath) {
        // Use Tauri command to detect audio peaks
        const peaks = await invoke<Array<{ time: number; amplitude: number }>>('detect_audio_peaks', {
          videoPath,
          threshold: 0.3,
          minInterval: 0.5
        });
        
        if (peaks && peaks.length > 0) {
          audioPeaksJson = JSON.stringify(peaks);
          console.log(`[GlobalClipBuildHandler] Detected ${peaks.length} audio peaks`);
        }
      }
    } catch (peakError) {
      console.warn(`[GlobalClipBuildHandler] Failed to calculate audio peaks:`, peakError);
      // Continue without peaks - not critical
    }
    
    // Get database connection
    const db = await getDatabase();
    
    // Create a clip version for this clip if it doesn't exist
    const versionId = generateId();
    const now = timestamp();
    
    // Check if clip already has a current_version_id
    const existingVersion = await db.select<{ current_version_id: string | null }[]>(
      'SELECT current_version_id FROM clips WHERE id = ?',
      [clipId]
    );
    
    let actualVersionId = versionId;
    
    if (existingVersion[0]?.current_version_id) {
      // Use existing version
      actualVersionId = existingVersion[0].current_version_id;
      console.log(`[GlobalClipBuildHandler] Using existing version: ${actualVersionId}`);
    } else {
      // Create new version
      await db.execute(
        `INSERT INTO clip_versions (id, clip_id, session_id, version_number, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [versionId, clipId, 'build', 1, now]
      );
      
      // Update clip to point to this version
      await db.execute(
        'UPDATE clips SET current_version_id = ? WHERE id = ?',
        [versionId, clipId]
      );
      
      console.log(`[GlobalClipBuildHandler] Created clip version: ${versionId}`);
    }
    
    // Check if segments already exist for this version
    const existingSegments = await db.select<any[]>(
      'SELECT id FROM clip_segments WHERE clip_version_id = ?',
      [actualVersionId]
    );
    
    if (existingSegments.length > 0) {
      console.log(`[GlobalClipBuildHandler] Clip already has ${existingSegments.length} segments, updating instead of creating new`);
      
      // Update the first segment with new transcript, raw_json, and audio peaks
      await db.execute(
        `UPDATE clip_segments 
         SET transcript = ?, transcript_raw_json = ?, audio_peaks = ?
         WHERE clip_version_id = ? AND segment_index = 0`,
        [clipTranscript, clipRawJson, audioPeaksJson, actualVersionId]
      );
      
      const peaksInfo = audioPeaksJson ? ` + ${JSON.parse(audioPeaksJson).length} audio peaks` : '';
      const rawJsonInfo = clipRawJson ? ' + word-level timing' : '';
      console.log(`[GlobalClipBuildHandler] ✅ Updated existing clip segment (${clipTranscript.length} chars${rawJsonInfo}${peaksInfo})`);
      return;
    }
    
    // Create a single segment with the clip-specific transcript and audio peaks
    const segmentId = generateId();
    const segmentDuration = endTime - startTime;
    
    await db.execute(
      `INSERT INTO clip_segments (id, clip_version_id, segment_index, start_time, end_time, duration, transcript, transcript_raw_json, audio_peaks, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [segmentId, actualVersionId, 0, startTime, endTime, segmentDuration, clipTranscript, clipRawJson, audioPeaksJson, now]
    );
    
    const peaksInfo = audioPeaksJson ? ` + ${JSON.parse(audioPeaksJson).length} audio peaks` : '';
    const rawJsonInfo = clipRawJson ? ' + word-level timing' : '';
    console.log(`[GlobalClipBuildHandler] ✅ Successfully copied transcript to clip segment (${clipTranscript.length} chars${rawJsonInfo}${peaksInfo})`);
  } catch (error) {
    console.error(`[GlobalClipBuildHandler] Error copying transcript:`, error);
    throw error;
  }
}

/**
 * Handle clip build completion event
 * This is the global handler that always updates the database
 */
async function handleClipBuildComplete(event: { payload: ClipBuildCompletePayload }) {
  const payload = event.payload;

  if (!payload || !payload.clip_id) {
    console.error(
      '[GlobalClipBuildHandler] Received clip-build-complete event with invalid payload'
    );
    return;
  }

  const { clip_id, success, output_path, thumbnail_path, duration, file_size, error } = payload;

  console.log(`[GlobalClipBuildHandler] Processing clip-build-complete for: ${clip_id}`, {
    success,
    output_path,
    error,
  });

  const isCancelled = error && (error.includes('cancelled') || error.includes('Cancelled'));

  try {
    if (success) {
      console.log(`[GlobalClipBuildHandler] Updating database for successful build: ${clip_id}`);

      // Update the clips table (legacy support)
      await updateClipBuildStatus(clip_id, 'completed', {
        progress: 100,
        builtFilePath: output_path || undefined,
        builtThumbnailPath: thumbnail_path || undefined,
        builtDuration: duration || undefined,
        builtFileSize: file_size || undefined,
        error: undefined,
      });

      // Also update the clip_builds table - find the most recent building record
      try {
        const builds = await getClipBuilds(clip_id);
        const buildingBuild = builds.find((b) => b.status === 'building');
        if (buildingBuild) {
          console.log(`[GlobalClipBuildHandler] Updating clip_builds record: ${buildingBuild.id}`);
          await updateClipBuild(buildingBuild.id, {
            status: 'completed',
            progress: 100,
            filePath: output_path || undefined,
            outputPaths: payload.all_output_paths || (output_path ? [output_path] : []),
            thumbnailPath: thumbnail_path || undefined,
            duration: duration || undefined,
            fileSize: file_size || undefined,
          });
          console.log(`[GlobalClipBuildHandler] clip_builds record updated successfully`);
        } else {
          console.warn(
            `[GlobalClipBuildHandler] No building record found in clip_builds for clip: ${clip_id}`
          );
        }
      } catch (buildError) {
        console.error(`[GlobalClipBuildHandler] Failed to update clip_builds:`, buildError);
      }

      console.log(`[GlobalClipBuildHandler] Database updated successfully for clip: ${clip_id}`);

      // Show success toast
      const { success: showSuccess } = useToast();
      showSuccess('Clip Build Complete', 'Your clip has been built successfully', undefined, 'clips');
      
      // Copy transcript from project to clip segments for self-contained clips
      try {
        await copyTranscriptToClipSegments(clip_id, payload.project_id);
      } catch (transcriptError) {
        console.error(`[GlobalClipBuildHandler] Failed to copy transcript to clip segments:`, transcriptError);
        // Don't fail the build if transcript copy fails
      }
    } else if (isCancelled) {
      console.log(`[GlobalClipBuildHandler] Resetting cancelled build: ${clip_id}`);
      await updateClipBuildStatus(clip_id, 'pending', {
        progress: 0,
        error: 'Build cancelled by user',
      });

      // Update clip_builds table for cancelled build
      try {
        const builds = await getClipBuilds(clip_id);
        const buildingBuild = builds.find((b) => b.status === 'building');
        if (buildingBuild) {
          await updateClipBuild(buildingBuild.id, {
            status: 'failed',
            progress: 0,
            errorMessage: 'Build cancelled by user',
          });
        }
      } catch (buildError) {
        console.error(
          `[GlobalClipBuildHandler] Failed to update clip_builds for cancelled build:`,
          buildError
        );
      }
    } else {
      console.log(`[GlobalClipBuildHandler] Marking build as failed: ${clip_id}`);
      await updateClipBuildStatus(clip_id, 'failed', {
        error: error || 'Unknown build error',
      });

      // Show error toast for failed builds
      const { error: showError } = useToast();
      showError('Clip Build Failed', error || 'Unknown build error', undefined, 'clips');

      // Update clip_builds table for failed build
      try {
        const builds = await getClipBuilds(clip_id);
        const buildingBuild = builds.find((b) => b.status === 'building');
        if (buildingBuild) {
          await updateClipBuild(buildingBuild.id, {
            status: 'failed',
            errorMessage: error || 'Unknown build error',
          });
        }
      } catch (buildError) {
        console.error(
          `[GlobalClipBuildHandler] Failed to update clip_builds for failed build:`,
          buildError
        );
      }
    }
  } catch (dbError) {
    console.error(
      `[GlobalClipBuildHandler] Failed to update database for clip ${clip_id}:`,
      dbError
    );
  }
}

/**
 * Initialize the global clip build event handler
 * Should be called once when the app starts (e.g., in App.vue)
 */
export async function initClipBuildEventHandler(): Promise<void> {
  if (isInitialized) {
    console.log('[GlobalClipBuildHandler] Already initialized, skipping');
    return;
  }

  try {
    console.log('[GlobalClipBuildHandler] Initializing global clip build event handler...');

    unlistenComplete = await listen<ClipBuildCompletePayload>(
      'clip-build-complete',
      handleClipBuildComplete
    );

    isInitialized = true;
    console.log(
      '[GlobalClipBuildHandler] Global clip build event handler initialized successfully'
    );
  } catch (error) {
    console.error('[GlobalClipBuildHandler] Failed to initialize:', error);
  }
}

/**
 * Cleanup the global clip build event handler
 * Should be called when the app is unmounting (if needed)
 */
export function cleanupClipBuildEventHandler(): void {
  if (unlistenComplete) {
    unlistenComplete();
    unlistenComplete = null;
  }
  isInitialized = false;
  console.log('[GlobalClipBuildHandler] Cleaned up global clip build event handler');
}

/**
 * Check if the handler is initialized
 */
export function isClipBuildEventHandlerInitialized(): boolean {
  return isInitialized;
}
