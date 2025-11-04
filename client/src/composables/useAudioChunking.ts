import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useToast } from '@/composables/useToast'

export interface AudioChunk {
  chunk_id: string
  file_path: string
  filename: string
  start_time: number
  end_time: number
  duration: number
  base64_data: string
  file_size: number
}

export interface ChunkingProgress {
  stage: 'detecting_duration' | 'extracting_chunks' | 'encoding_chunks' | 'completed' | 'error'
  currentChunk: number
  totalChunks: number
  currentStageProgress: number
  overallProgress: number
  message: string
}

export function useAudioChunking() {
  const isExtracting = ref(false)
  const isChunking = ref(false)
  const progress = ref<ChunkingProgress>({
    stage: 'detecting_duration',
    currentChunk: 0,
    totalChunks: 0,
    currentStageProgress: 0,
    overallProgress: 0,
    message: ''
  })
  const chunks = ref<AudioChunk[]>([])
  const error = ref<string | null>(null)
  const { success: showSuccess, error: showError } = useToast()

  // Computed properties for easier use
  const isProcessing = computed(() => isExtracting.value || isChunking.value)
  const progressPercentage = computed(() => Math.round(progress.value.overallProgress))
  const currentStageName = computed(() => {
    switch (progress.value.stage) {
      case 'detecting_duration':
        return 'Detecting video duration...'
      case 'extracting_chunks':
        return `Extracting chunk ${progress.value.currentChunk} of ${progress.value.totalChunks}...`
      case 'encoding_chunks':
        return `Encoding chunk ${progress.value.currentChunk} of ${progress.value.totalChunks}...`
      case 'completed':
        return 'Audio chunking completed'
      case 'error':
        return 'Error occurred'
      default:
        return 'Processing...'
    }
  })

  async function extractAndChunkVideo(
    videoPath: string,
    projectId: string,
    options: {
      chunkDurationMinutes?: number
      overlapSeconds?: number
    } = {}
  ): Promise<{ success: boolean; chunks?: AudioChunk[]; error?: string }> {
    if (isProcessing.value) {
      return { success: false, error: 'Already processing audio' }
    }

    const {
      chunkDurationMinutes = 30, // Default 30-minute chunks
      overlapSeconds = 30 // Default 30-second overlap
    } = options

    try {
      isExtracting.value = true
      error.value = null
      chunks.value = []

      // Reset progress
      progress.value = {
        stage: 'detecting_duration',
        currentChunk: 0,
        totalChunks: 0,
        currentStageProgress: 0,
        overallProgress: 5,
        message: 'Analyzing video file...'
      }

      console.log('[AudioChunking] Starting chunk extraction:', {
        videoPath,
        projectId,
        chunkDurationMinutes,
        overlapSeconds
      })

      // Call the Rust function
      const audioChunks = await invoke<AudioChunk[]>('extract_and_chunk_audio', {
        videoPath,
        projectId,
        chunkDurationMinutes,
        overlapSeconds
      })

      // Update progress
      progress.value = {
        stage: 'completed',
        currentChunk: audioChunks.length,
        totalChunks: audioChunks.length,
        currentStageProgress: 100,
        overallProgress: 100,
        message: `Successfully created ${audioChunks.length} audio chunks`
      }

      chunks.value = audioChunks

      const totalSize = audioChunks.reduce((sum, chunk) => sum + chunk.file_size, 0)
      const totalDuration = audioChunks.reduce((sum, chunk) => sum + chunk.duration, 0)

      console.log('[AudioChunking] Chunking completed:', {
        chunksCount: audioChunks.length,
        totalSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
        totalDuration: `${(totalDuration / 60).toFixed(2)} minutes`,
        averageChunkSize: `${(totalSize / audioChunks.length / 1024 / 1024).toFixed(2)}MB`
      })

      showSuccess(
        'Audio chunked successfully',
        `Created ${audioChunks.length} chunks totaling ${(totalSize / 1024 / 1024).toFixed(1)}MB`
      )

      return { success: true, chunks: audioChunks }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      error.value = errorMessage

      progress.value = {
        stage: 'error',
        currentChunk: 0,
        totalChunks: 0,
        currentStageProgress: 0,
        overallProgress: 0,
        message: `Error: ${errorMessage}`
      }

      console.error('[AudioChunking] Chunking failed:', errorMessage)
      showError('Audio chunking failed', errorMessage)

      return { success: false, error: errorMessage }
    } finally {
      isExtracting.value = false
      isChunking.value = false
    }
  }

  // Estimate chunk count before processing (for UI planning)
  function estimateChunkCount(
    videoDurationSeconds: number,
    chunkDurationMinutes: number = 30
  ): number {
    const chunkDurationSeconds = chunkDurationMinutes * 60
    return Math.ceil(videoDurationSeconds / chunkDurationSeconds)
  }

  // Get file size estimates
  function getFileSizeEstimates(
    videoDurationMinutes: number,
    chunkDurationMinutes: number = 30
  ): {
    estimatedTotalSizeMB: number
    estimatedChunkSizeMB: number
    estimatedChunkCount: number
  } {
    // Rough estimate: 1 minute of video ≈ 1.5MB OGG audio at quality level 1
    const estimatedTotalSizeMB = videoDurationMinutes * 1.5
    const estimatedChunkCount = Math.ceil(videoDurationMinutes / chunkDurationMinutes)
    const estimatedChunkSizeMB = estimatedTotalSizeMB / estimatedChunkCount

    return {
      estimatedTotalSizeMB,
      estimatedChunkSizeMB,
      estimatedChunkCount
    }
  }

  // Validate chunk parameters
  function validateChunkParameters(
    videoDurationSeconds: number,
    chunkDurationMinutes: number,
    overlapSeconds: number
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (chunkDurationMinutes < 5 || chunkDurationMinutes > 120) {
      errors.push('Chunk duration must be between 5 and 120 minutes')
    }

    if (overlapSeconds < 0 || overlapSeconds > 300) {
      errors.push('Overlap must be between 0 and 300 seconds')
    }

    if (overlapSeconds >= chunkDurationMinutes * 60) {
      errors.push('Overlap cannot be larger than chunk duration')
    }

    if (videoDurationSeconds < 60) {
      errors.push('Video is too short for chunking (minimum 1 minute)')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  function reset() {
    isExtracting.value = false
    isChunking.value = false
    progress.value = {
      stage: 'detecting_duration',
      currentChunk: 0,
      totalChunks: 0,
      currentStageProgress: 0,
      overallProgress: 0,
      message: ''
    }
    chunks.value = []
    error.value = null
  }

  return {
    // State
    isExtracting: readonly(isExtracting),
    isChunking: readonly(isChunking),
    isProcessing,
    progress: readonly(progress),
    chunks: readonly(chunks),
    error: readonly(error),

    // Computed
    progressPercentage,
    currentStageName,

    // Methods
    extractAndChunkVideo,
    estimateChunkCount,
    getFileSizeEstimates,
    validateChunkParameters,
    reset
  }
}
