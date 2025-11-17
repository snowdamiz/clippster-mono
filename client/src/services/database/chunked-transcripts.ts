import { getDatabase, timestamp, generateId } from './core';
import type { ChunkedTranscript, TranscriptChunk } from './types';

// === CHUNKED TRANSCRIPT FUNCTIONS ===

// Tables are created via Tauri migrations (021_add_chunked_transcripts.sql)
// No need for inline table creation

// Create a new chunked transcript record
export async function createChunkedTranscript(
  rawVideoId: string,
  totalChunks: number,
  chunkDurationMinutes: number,
  overlapSeconds: number,
  totalDuration: number,
  language?: string
): Promise<string> {
  const db = await getDatabase();

  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO chunked_transcripts (
      id, raw_video_id, total_chunks, chunk_duration_minutes, overlap_seconds,
      total_duration, language, is_complete, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      rawVideoId,
      totalChunks,
      chunkDurationMinutes,
      overlapSeconds,
      totalDuration,
      language || null,
      false,
      now,
      now,
    ]
  );

  return id;
}

// Store a transcript chunk
export async function storeTranscriptChunk(
  chunkedTranscriptId: string,
  chunkIndex: number,
  chunkId: string,
  startTime: number,
  endTime: number,
  rawJson: string,
  text: string,
  fileSize: number,
  language?: string
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const duration = endTime - startTime;

  await db.execute(
    `INSERT INTO transcript_chunks (
      id, chunked_transcript_id, chunk_index, chunk_id, start_time, end_time,
      duration, raw_json, text, language, file_size, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      chunkedTranscriptId,
      chunkIndex,
      chunkId,
      startTime,
      endTime,
      duration,
      rawJson,
      text,
      language || null,
      fileSize,
      now,
    ]
  );

  return id;
}

// Get chunked transcript by raw video ID
export async function getChunkedTranscriptByRawVideoId(
  rawVideoId: string
): Promise<ChunkedTranscript | null> {
  const db = await getDatabase();
  const result = await db.select<ChunkedTranscript[]>(
    'SELECT * FROM chunked_transcripts WHERE raw_video_id = ? ORDER BY created_at DESC',
    [rawVideoId]
  );
  return result[0] || null;
}

// Get all chunks for a chunked transcript
export async function getTranscriptChunks(chunkedTranscriptId: string): Promise<TranscriptChunk[]> {
  const db = await getDatabase();
  return await db.select<TranscriptChunk[]>(
    'SELECT * FROM transcript_chunks WHERE chunked_transcript_id = ? ORDER BY chunk_index',
    [chunkedTranscriptId]
  );
}

// Check if all chunks are complete
export async function updateChunkedTranscriptCompleteness(
  chunkedTranscriptId: string
): Promise<void> {
  const db = await getDatabase();

  const chunks = await getTranscriptChunks(chunkedTranscriptId);
  const chunkedTranscript = await db.select<ChunkedTranscript[]>(
    'SELECT * FROM chunked_transcripts WHERE id = ?',
    [chunkedTranscriptId]
  );

  if (chunkedTranscript.length === 0) {
    throw new Error('Chunked transcript not found');
  }

  const isComplete = chunks.length >= chunkedTranscript[0].total_chunks;
  const now = timestamp();

  await db.execute('UPDATE chunked_transcripts SET is_complete = ?, updated_at = ? WHERE id = ?', [
    isComplete,
    now,
    chunkedTranscriptId,
  ]);
}

// Get chunk metadata for sending to server (instead of full transcript)
export async function getChunkMetadataForProcessing(rawVideoId: string): Promise<{
  hasChunkedTranscript: boolean;
  chunks: Array<{
    chunk_id: string;
    chunk_index: number;
    start_time: number;
    end_time: number;
    raw_json: string;
  }>;
  totalDuration: number;
  language: string | null;
} | null> {
  const chunkedTranscript = await getChunkedTranscriptByRawVideoId(rawVideoId);
  if (!chunkedTranscript || !chunkedTranscript.is_complete) {
    return null;
  }

  const chunks = await getTranscriptChunks(chunkedTranscript.id);

  return {
    hasChunkedTranscript: true,
    chunks: chunks.map((chunk) => ({
      chunk_id: chunk.chunk_id,
      chunk_index: chunk.chunk_index,
      start_time: chunk.start_time,
      end_time: chunk.end_time,
      raw_json: chunk.raw_json,
    })),
    totalDuration: chunkedTranscript.total_duration,
    language: chunkedTranscript.language,
  };
}
