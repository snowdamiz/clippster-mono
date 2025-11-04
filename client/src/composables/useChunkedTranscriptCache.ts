import { ref, computed } from 'vue'
import {
  ensureChunkedTranscriptTables,
  createChunkedTranscript,
  storeTranscriptChunk,
  getChunkedTranscriptByRawVideoId,
  getTranscriptChunks,
  updateChunkedTranscriptCompleteness,
  getChunkMetadataForProcessing,
  type ChunkedTranscript,
  type TranscriptChunk
} from '@/services/database'
import { getRawVideoByPath } from '@/services/database'
import { useAudioChunking, type AudioChunk } from './useAudioChunking'
import { useToast } from '@/composables/useToast'

export interface ChunkTranscriptionResult {
  chunkId: string
  chunkIndex: number
  startTime: number
  endTime: number
  duration: number
  transcription: any
  success: boolean
  error?: string
}

export interface ChunkedTranscriptSession {
  id: string
  rawVideoId: string
  totalChunks: number
  chunkDurationMinutes: number
  overlapSeconds: number
  totalDuration: number
  completedChunks: number
  status: 'initializing' | 'extracting' | 'transcribing' | 'completed' | 'error'
  progress: number
  error: string | null
}

export function useChunkedTranscriptCache() {
  const currentSession = ref<ChunkedTranscriptSession | null>(null)
  const isProcessing = ref(false)
  const error = ref<string | null>(null)
  const { success: showSuccess, error: showError } = useToast()

  // Computed properties
  const sessionProgress = computed(() => currentSession.value?.progress || 0)
  const sessionStatus = computed(() => currentSession.value?.status || 'idle')
  const hasActiveSession = computed(() => !!currentSession.value)

  async function initializeChunkedTranscriptSession(
    rawVideoId: string,
    chunkDurationMinutes: number = 30,
    overlapSeconds: number = 30
  ): Promise<{ success: boolean; sessionId?: string; chunks?: AudioChunk[]; error?: string }> {
    try {
      isProcessing.value = true
      error.value = null

      console.log('[ChunkedTranscriptCache] Initializing chunked transcript session:', {
        rawVideoId,
        chunkDurationMinutes,
        overlapSeconds
      })

      // Check if chunked transcript already exists
      const existingChunked = await getChunkedTranscriptByRawVideoId(rawVideoId)
      if (existingChunked && existingChunked.is_complete) {
        console.log('[ChunkedTranscriptCache] Found existing complete chunked transcript')
        showSuccess('Transcript cached', 'Using existing chunked transcript for this video')
        return { success: true, sessionId: existingChunked.id }
      }

      // Get raw video record to access file path
      const { getRawVideo } = await import('@/services/database')
      const rawVideo = await getRawVideo(rawVideoId)
      if (!rawVideo) {
        throw new Error('Video not found in database.')
      }

      // Use audio chunking to get chunk information
      const { extractAndChunkVideo } = useAudioChunking()
      const chunkingResult = await extractAndChunkVideo(rawVideo.file_path, rawVideoId, {
        chunkDurationMinutes,
        overlapSeconds
      })

      if (!chunkingResult.success || !chunkingResult.chunks) {
        throw new Error(chunkingResult.error || 'Failed to chunk video')
      }

      const chunks = chunkingResult.chunks
      const totalDuration = chunks.reduce((sum, chunk) => sum + chunk.duration, 0)

      // Create chunked transcript record
      const chunkedTranscriptId = await createChunkedTranscript(
        rawVideoId,
        chunks.length,
        chunkDurationMinutes,
        overlapSeconds,
        totalDuration
      )

      // Initialize session
      currentSession.value = {
        id: chunkedTranscriptId,
        rawVideoId: rawVideoId,
        totalChunks: chunks.length,
        chunkDurationMinutes,
        overlapSeconds,
        totalDuration,
        completedChunks: 0,
        status: 'initializing',
        progress: 0,
        error: null
      }

      console.log('[ChunkedTranscriptCache] Session initialized:', {
        sessionId: chunkedTranscriptId,
        totalChunks: chunks.length,
        totalDuration
      })

      return { success: true, sessionId: chunkedTranscriptId, chunks }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      error.value = errorMessage
      console.error('[ChunkedTranscriptCache] Failed to initialize session:', errorMessage)
      showError('Initialization failed', errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      isProcessing.value = false
    }
  }

  async function storeChunkTranscription(
    sessionId: string,
    chunkIndex: number,
    chunkId: string,
    transcriptionResult: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[ChunkedTranscriptCache] Storing chunk transcription:', {
        sessionId,
        chunkIndex,
        chunkId,
        hasResult: !!transcriptionResult
      })

      if (!currentSession.value || currentSession.value.id !== sessionId) {
        throw new Error('No active session or session mismatch')
      }

      // Get chunked transcript to verify
      const chunkedTranscript = await getChunkedTranscriptByRawVideoId(
        currentSession.value.rawVideoId
      )
      if (!chunkedTranscript) {
        throw new Error('Chunked transcript not found')
      }

      // Store the chunk transcription
      const chunkText =
        transcriptionResult.text ||
        transcriptionResult.segments?.map((seg: any) => seg.text).join(' ') ||
        ''

      const chunkLanguage = transcriptionResult.language || 'english'
      const chunkSize = JSON.stringify(transcriptionResult).length

      await storeTranscriptChunk(
        chunkedTranscript.id,
        chunkIndex,
        chunkId,
        transcriptionResult.duration || 0,
        (transcriptionResult.duration || 0) + (transcriptionResult.start_time || 0),
        JSON.stringify(transcriptionResult),
        chunkText,
        chunkSize,
        chunkLanguage
      )

      // Update session progress
      currentSession.value.completedChunks += 1
      currentSession.value.progress =
        (currentSession.value.completedChunks / currentSession.value.totalChunks) * 100

      // Check if all chunks are complete
      await updateChunkedTranscriptCompleteness(chunkedTranscript.id)

      // Update session status if complete
      if (currentSession.value.completedChunks >= currentSession.value.totalChunks) {
        currentSession.value.status = 'completed'
        showSuccess(
          'Transcription complete',
          `All ${currentSession.value.totalChunks} chunks transcribed and cached`
        )
      }

      console.log('[ChunkedTranscriptCache] Chunk stored successfully:', {
        chunkIndex,
        progress: currentSession.value.progress,
        completed: currentSession.value.completedChunks,
        total: currentSession.value.totalChunks
      })

      return { success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('[ChunkedTranscriptCache] Failed to store chunk:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async function getCachedChunkMetadata(rawVideoId: string): Promise<{
    hasCachedTranscript: boolean
    chunks: Array<{
      chunk_id: string
      chunk_index: number
      start_time: number
      end_time: number
      raw_json: string
    }>
    totalDuration: number
    language: string | null
  } | null> {
    try {
      const metadata = await getChunkMetadataForProcessing(rawVideoId)

      if (metadata) {
        console.log('[ChunkedTranscriptCache] Found cached chunk metadata:', {
          chunksCount: metadata.chunks.length,
          totalDuration: metadata.totalDuration,
          language: metadata.language
        })
      }

      return metadata
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('[ChunkedTranscriptCache] Failed to get cached metadata:', errorMessage)
      return null
    }
  }

  async function getReconstructedTranscript(rawVideoId: string): Promise<any | null> {
    try {
      const chunkedTranscript = await getChunkedTranscriptByRawVideoId(rawVideoId)
      if (!chunkedTranscript || !chunkedTranscript.is_complete) {
        return null
      }

      const chunks = await getTranscriptChunks(chunkedTranscript.id)
      if (chunks.length === 0) {
        return null
      }

      console.log('[ChunkedTranscriptCache] Reconstructing transcript from chunks:', {
        chunkCount: chunks.length,
        totalDuration: chunkedTranscript.total_duration
      })

      // Sort chunks by index
      chunks.sort((a, b) => a.chunk_index - b.chunk_index)

      // Reconstruct full transcript from chunks
      const allSegments = chunks.flatMap((chunk) => {
        const chunkData = JSON.parse(chunk.raw_json)
        return chunkData.segments || []
      })

      const allWords = chunks.flatMap((chunk) => {
        const chunkData = JSON.parse(chunk.raw_json)
        return chunkData.words || []
      })

      const combinedText = chunks
        .map((chunk) => chunk.text)
        .join(' ')
        .trim()

      const reconstructedTranscript = {
        duration: chunkedTranscript.total_duration,
        text: combinedText,
        segments: allSegments,
        words: allWords,
        language: chunkedTranscript.language,
        chunk_reconstruction_metadata: {
          chunks_processed: chunks.length,
          total_segments: allSegments.length,
          total_words: allWords.length,
          reconstructed_at: new Date().toISOString(),
          chunk_ids: chunks.map((chunk) => chunk.chunk_id),
          chunked_transcript_id: chunkedTranscript.id
        }
      }

      console.log('[ChunkedTranscriptCache] Transcript reconstruction completed:', {
        totalDuration: reconstructedTranscript.duration,
        totalSegments: allSegments.length,
        totalWords: allWords.length
      })

      return reconstructedTranscript
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('[ChunkedTranscriptCache] Failed to reconstruct transcript:', errorMessage)
      return null
    }
  }

  async function clearCachedTranscript(
    rawVideoId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // This would delete the chunked transcript and all its chunks
      // Implementation depends on whether we want to support clearing cache
      console.log('[ChunkedTranscriptCache] Clear cached transcript not implemented yet')
      return { success: false, error: 'Clear cache not implemented' }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      return { success: false, error: errorMessage }
    }
  }

  function resetSession() {
    currentSession.value = null
    error.value = null
  }

  return {
    // State
    currentSession,
    isProcessing,
    error,

    // Computed
    sessionProgress,
    sessionStatus,
    hasActiveSession,

    // Methods
    initializeChunkedTranscriptSession,
    storeChunkTranscription,
    getCachedChunkMetadata,
    getReconstructedTranscript,
    clearCachedTranscript,
    resetSession
  }
}
