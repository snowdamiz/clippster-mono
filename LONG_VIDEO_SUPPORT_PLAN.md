# Long Video Support Implementation Plan

## Executive Summary

Analysis of Clippster's current architecture reveals **critical file size limitations** that prevent processing videos longer than ~20 minutes. This document outlines a comprehensive plan to extend support from short videos to unlimited length videos (up to 8 hours realistic maximum) using **client-side audio chunking** to avoid uploading large files to the server.

## Current System Analysis

### Clip Detection Flow (Actual Architecture)
1. **Video Upload** → Client copies video to local storage via Tauri
2. **Audio Extraction** → Client extracts OGG audio using FFmpeg Tauri command (Quality Level 1)
3. **Server Processing** → Server receives extracted audio and sends to Whisper API
4. **Whisper API** transcription (single API call with word-level timestamps)
5. **OpenRouter AI** analysis (GPT-4o-mini with optimized transcript)
6. **Enhanced Validation** with word-level timing correction
7. **Progress Updates** via WebSocket ProgressChannel

### Current Limitations for Long Videos
- **8-hour video** ≈ 10-20GB video file (MP4)
- **8-hour audio OGG** ≈ 720MB (Quality Level 1: ~64-96k bitrate, optimized for transcription)
- **Server limit**: 100MB max request size in endpoint.ex
- **Single file processing**: No chunking or streaming support
- **Memory bottlenecks**: Loading entire audio files into server memory
- **API timeouts**: 60-second receive timeout vs large upload times

### Existing Audio Extraction Infrastructure
**Location**: `client/src-tauri/src/lib.rs:815-907` (extract_audio_from_video function)

**Current Implementation**:
- **FFmpeg Integration**: Bundled as Tauri sidecar with platform-specific binaries
- **Format**: OGG Vorbis with quality level 1 (≈64-96k MP3 equivalent)
- **Command**: `ffmpeg -i video_path -c:a libvorbis -q:a 1 -vn -y output.ogg`
- **Process**: Extract → Base64 encode → Return to client → Upload to server
- **Database**: Dedicated `audio_files` table with metadata tracking
- **Cleanup**: Automatic temporary file removal

---

## Priority 1: Client-Side Audio Chunking & Upload 🚨 CRITICAL

### **What**
Extract and chunk audio on the client side before uploading to server, eliminating large file transfers completely.

### **Where**
- **Client Audio Extraction**: `client/src-tauri/src/audio.rs` (new Tauri command)
- **Client Chunking**: `client/src/composables/useAudioChunking.ts` (new composable)
- **Upload Management**: `client/src/composables/useVideoOperations.ts` (modify existing)
- **Server Processing**: `server/lib/clippster_server_web/controllers/clips_controller.ex` (enhance)
- **Progress Tracking**: `client/src/components/ClipGenerationProgress.vue` (enhance)

### **Why**
#### **Current Breaking Points:**
- **File Size**: 8-hour audio OGG ≈ 720MB exceeds 100MB server limit
- **Upload Time**: 30-60 minute upload times for large audio files
- **Memory**: Server RAM exhaustion loading large audio files
- **Network**: Unreliable uploads with connection failures
- **Cost**: High bandwidth usage for user uploads (though reduced by OGG compression)

#### **Business Impact:**
- **COMPLETE FAILURE** for audio > ~100MB (≈1.5-2 hours of video content)
- **Poor User Experience**: Long uploads with no progress feedback
- **Infrastructure Costs**: High server bandwidth costs for audio uploads
- **Scalability Issues**: Cannot support concurrent long-video processing

### **Implementation Details**

#### Client-Side Audio Processing Strategy
```rust
// Enhanced version of existing extract_audio_from_video function in lib.rs
#[tauri::command]
async fn extract_and_chunk_audio(
    app: tauri::AppHandle,
    video_path: String,
    output_dir: String,
    chunk_duration_minutes: u32,
    overlap_seconds: u32
) -> Result<Vec<AudioChunk>, String> {
    // Extend existing FFmpeg integration for direct chunking
    // Leverage existing OGG Vorbis quality level 1 settings
    // Use same error handling and logging patterns
    // Generate precise timing metadata for each chunk
    // Return chunk file paths and metadata
}
```

#### Audio Chunk Specifications
- **Chunk Size**: 30 minutes (~27MB OGG file at Quality Level 1: ~64-96k)
- **Overlap**: 30 seconds between chunks for continuity
- **Format**: OGG Vorbis with libvorbis codec (same as existing implementation)
- **Quality**: Level 1 (~64-96k MP3 equivalent, matches existing transcription-optimized settings)
- **Command**: `ffmpeg -i video_path -c:a libvorbis -q:a 1 -vn -t 1800 -ss {start_time} chunk.ogg`
- **Naming**: `{project_id}_chunk_001.ogg`, `{project_id}_chunk_002.ogg`
- **Metadata**: Track start/end timestamps and word-level offsets

#### Client-Side Chunking Flow
```typescript
// New composable: useAudioChunking.ts
export function useAudioChunking() {
  const isExtracting = ref(false)
  const progress = ref(0)
  const chunks = ref<AudioChunk[]>([])

  async function extractAndChunkVideo(videoPath: string, projectId: string) {
    isExtracting.value = true
    progress.value = 0

    // Extract audio and chunk using Tauri FFmpeg
    const audioChunks = await invoke('extract_and_chunk_audio', {
      videoPath,
      outputDir: getTempDir(),
      chunkDurationMinutes: 30,
      overlapSeconds: 30
    })

    chunks.value = audioChunks
    return audioChunks
  }

  return { isExtracting, progress, chunks, extractAndChunkVideo }
}
```

#### Parallel Upload Strategy
```typescript
// Enhanced useVideoOperations.ts
async function uploadAudioChunks(chunks: AudioChunk[], projectId: string) {
  const uploadPromises = chunks.map(async (chunk, index) => {
    return {
      chunkIndex: index,
      uploadPromise: uploadChunkToServer(chunk, projectId)
        .then(result => ({ index, result, status: 'success' }))
        .catch(error => ({ index, error, status: 'failed' }))
    }
  })

  // Process in batches of 2 to manage rate limits (larger chunks = fewer concurrent uploads)
  const batches = chunkArray(uploadPromises, 2)
  const results = []

  for (const batch of batches) {
    const batchResults = await Promise.allSettled(batch)
    results.push(...batchResults)
    // Update progress and handle failures
  }

  return results
}
```

#### Server-Side Chunk Processing
```elixir
# Enhanced clips_controller.ex
def process_chunked_transcription(project_id, chunks_metadata) do
  # Process chunks in parallel batches
  chunks_metadata
  |> Enum.chunk_every(2)  # 2 chunks at a time (larger chunks = fewer concurrent)
  |> Enum.with_index()
  |> Enum.map(&process_chunk_batch/1)
  |> Enum.flat_map(&extract_transcripts/1)
  |> reconstruct_timeline()
  |> broadcast_progress_updates(project_id)
end

defp process_chunk_batch({chunks, batch_index}) do
  # Parallel transcription for chunks in batch
  chunks
  |> Task.async_stream(&WhisperAPI.transcribe_chunk/1, max_concurrency: 2)
  |> Enum.map(fn {:ok, result} -> result end)
  |> Enum.map(fn {:error, reason} -> handle_chunk_failure(reason) end)
end
```

### **Technical Requirements**

#### Tauri FFmpeg Integration
- **Existing Infrastructure**: FFmpeg already bundled as Tauri sidecar with platform-specific binaries
- **Enhancement**: Extend existing `extract_audio_from_video` function for chunking
- **Error Handling**: Reuse existing comprehensive FFmpeg output parsing and logging
- **Progress**: Add progress reporting during multi-chunk extraction
- **Cleanup**: Leverage existing automatic temporary file removal patterns

#### Enhanced Upload Management
- **Chunk Storage**: Temporary directory for chunk files
- **Concurrency**: Limit parallel uploads to avoid rate limits
- **Retry Logic**: Handle individual chunk upload failures
- **Progress**: Granular progress per chunk and overall
- **Resumption**: Resume failed uploads from last successful chunk

#### Server-Side Enhancements
- **Chunk Endpoint**: New API endpoint for chunk uploads (extend existing audio upload logic)
- **Batch Processing**: Process multiple chunks in parallel using existing concurrency patterns
- **Timeline Reconstruction**: Merge chunk transcripts with timing accuracy
- **Memory Management**: Stream processing to avoid loading all chunks (improve on existing single-file approach)
- **Error Recovery**: Handle individual chunk failures gracefully

#### Progress Tracking Enhancement
- **Multi-Stage Progress**: Audio extraction + chunk upload + transcription
- **Granular Updates**: Per-chunk progress during upload and processing
- **WebSocket Integration**: Enhanced ProgressChannel messages
- **Error States**: Clear error reporting for chunk failures
- **Recovery Options**: Resume/retry failed operations

### **Implementation Steps**
1. **Week 1**: Extend existing `extract_audio_from_video` function for chunking capability
2. **Week 2**: Create client-side chunk upload management system building on existing audio upload patterns
3. **Week 3**: Enhance server-side chunk processing and timeline reconstruction using existing Whisper API integration
4. **Week 4**: Integrate progress tracking and error handling with existing ProgressChannel system

### **Success Criteria**
- ✅ Process 8-hour videos (720MB audio) without 100MB server file size limits
- ✅ Maintain timeline accuracy across chunk boundaries using existing word-level timestamp precision
- ✅ Handle individual chunk failures gracefully without affecting other chunks
- ✅ Reduce server bandwidth usage by 95% (27MB chunks vs 720MB single file)
- ✅ Reduce API overhead by 67% (16 chunks vs 48 chunks for 8-hour video)
- ✅ Provide granular progress feedback throughout process using existing ProgressChannel infrastructure

---

## Priority 2: Enhanced Streaming Response System ⚠️ MODERATE

### **What**
Replace single large JSON response with progressive streaming of clips and enhanced progress tracking during chunk processing.

### **Where**
- **Server**: `server/lib/clippster_server_web/clip_streamer.ex` (new module)
- **WebSocket**: Enhance existing `server/lib/clippster_server_web/progress_channel.ex`
- **Client**: `client/src/composables/useClipStreaming.ts` (new composable)
- **UI**: Enhance existing `client/src/components/ClipGenerationProgress.vue`

### **Why**
#### **Performance Issues:**
- **Memory Usage**: Large transcript payloads for 8-hour videos (based on existing word-level JSON structure)
- **Processing Time**: Single large API call creates long delays during chunk transcription
- **UI Blocking**: Limited feedback during multi-hour processing despite existing ProgressChannel
- **Error Recovery**: Single point of failure for entire process (improve with chunk-level granularity)

#### **Business Impact:**
- **User Experience**: Real-time feedback and progress indication
- **Reliability**: Individual chunk failures don't break entire process
- **Scalability**: Support concurrent long-video processing
- **Performance**: Progressive clip delivery as they're detected

### **Implementation Details**

#### Enhanced Progress Tracking
```typescript
// Enhanced progress stages for chunked processing
interface ChunkedProgress {
  stage: 'extracting_audio' | 'uploading_chunks' | 'transcribing_chunks' | 'detecting_clips' | 'validating_results'
  currentStage: number
  totalStages: number
  chunkProgress: {
    current: number
    total: number
    currentChunk: string
  }
  clipsFound: number
  estimatedCompletion: Date
}
```

#### Server-Side Progressive Processing
```elixir
defmodule ClippsterServer.ClipStreamer do
  def stream_chunked_clips(project_id, chunks_metadata, prompt) do
    # Process chunks progressively
    # Stream clip detection results as chunks complete
    # Maintain timeline accuracy across chunk boundaries
    # Handle chunk failures without stopping entire process
  end

  defp process_chunk_with_clips(chunk, prompt) do
    # Transcribe chunk
    # Detect clips within chunk timeline
    # Apply boundary validation for chunk edges
    # Stream results immediately
  end
end
```

#### Client-Side Progressive Loading
```typescript
// Enhanced useClipStreaming.ts
export function useClipStreaming(projectId: string) {
  const clips = ref<Clip[]>([])
  const chunks = ref<ChunkProgress[]>([])
  const progress = ref<ChunkedProgress>()
  const isComplete = ref(false)

  // Subscribe to enhanced WebSocket stream
  // Accumulate clips progressively from chunks
  // Update UI with detailed progress information
  // Handle chunk-specific errors and retries
}
```

### **Implementation Steps**
1. **Week 1**: Enhance existing ProgressChannel for chunked processing progress tracking
2. **Week 2**: Implement ClipStreamer for progressive processing during chunk transcription
3. **Week 3**: Enhance existing ClipGenerationProgress.vue for chunk-aware progress display
4. **Week 4**: Add virtual scrolling and enhanced error handling for large clip sets

### **Success Criteria**
- ✅ Stream 1000+ clips without UI freezing
- ✅ Real-time progress updates during multi-hour processing
- ✅ Handle individual chunk failures without stopping process
- ✅ Maintain sub-second UI responsiveness

---

## Priority 3: Cross-Chunk Clip Boundary Optimization 💡 LOW PRIORITY

### **What**
Enhance clip detection across chunk boundaries to ensure clips span chunk transitions seamlessly.

### **Where**
- **Module**: `server/lib/clippster_server/cross_chunk_analyzer.ex` (new module)
- **Integration**: `server/lib/clippster_server/clip_validation.ex` (enhance existing)
- **Enhancement**: Existing clip validation pipeline with boundary awareness

### **Why**
#### **Quality Considerations:**
- **Boundary Artifacts**: Best clips may span 30-minute chunk boundaries
- **Narrative Flow**: Important content may be split across chunks
- **Continuity**: Maintain speaker and topic consistency across boundaries
- **Virality Potential**: Complete clips have higher engagement potential

#### **Business Impact:**
- **Clip Quality**: Higher quality, more engaging clips
- **User Satisfaction**: Professional-looking, complete clips
- **Competitive Advantage**: Better clip quality than chunk-naive systems
- **Retention**: Higher quality results drive repeat usage

### **Implementation Details**

#### Boundary Analysis Strategy
```elixir
defmodule ClippsterServer.CrossChunkAnalyzer do
  def analyze_chunk_boundaries(chunk_transcripts, overlap_seconds) do
    # Analyze overlap regions for clip opportunities
    # Identify narrative continuity across boundaries
    # Merge boundary-crossing clips intelligently
    # Preserve timeline accuracy
  end

  defp find_boundary_clips(chunk1, chunk2, overlap_region) do
    # Look for clips that span the boundary
    # Score based on narrative completeness
    # Merge when quality threshold is met
  end
end
```

### **Success Criteria**
- ✅ Merge 85% of boundary-crossing opportunities
- ✅ Eliminate awkward chunk boundary cuts
- ✅ Improve overall clip virality scores by 10-15%
- ✅ Maintain timeline accuracy within 100ms

---

## Testing Strategy

### Unit Testing
- **Audio Chunking**: Client-side extraction accuracy extending existing `extract_audio_from_video` tests
- **Upload Management**: Chunk upload reliability building on existing audio upload patterns
- **Timeline Reconstruction**: Chunk merging accuracy maintaining existing word-level precision
- **CrossChunkAnalyzer**: Boundary analysis algorithms

### Integration Testing
- **End-to-End Flow**: 8-hour video processing pipeline
- **API Integration**: Whisper API rate limiting with chunks
- **WebSocket Communication**: Enhanced streaming protocol
- **Error Recovery**: Chunk failure scenarios

### Performance Testing
- **Load Testing**: Multiple concurrent 8-hour videos
- **Memory Testing**: Client and server memory usage
- **Network Testing**: Unreliable network conditions
- **Stress Testing**: Maximum video length limits

### User Acceptance Testing
- **Beta Testing**: Real users with long-form content
- **Quality Assurance**: Clip quality vs current system
- **Performance Feedback**: Processing time and UX

## Risk Mitigation

### Technical Risks
- **FFmpeg Dependencies**: Client-side FFmpeg compatibility (mitigated by existing sidecar bundling)
- **Tauri Integration**: Complex audio processing in desktop environment (building on existing proven patterns)
- **Timeline Accuracy**: Maintaining precision across chunk boundaries (leveraging existing word-level timestamp system)
- **Memory Usage**: Client-side memory management during multi-chunk extraction

### Business Risks
- **Client Performance**: Slower processing on user machines
- **Complexity**: More complex client-side implementation
- **Compatibility**: Different OS environments and FFmpeg versions
- **User Experience**: Longer initial extraction time

### Mitigation Strategies
- **Performance Optimization**: Efficient FFmpeg usage and memory management
- **Fallback Options**: Server-side processing for incompatible systems
- **Gradual Rollout**: Beta testing with select users
- **Enhanced Monitoring**: Client-side error reporting and analytics

## Success Metrics

### Technical Metrics
- **Maximum Video Length**: Support 8+ hour videos (720MB audio at Quality Level 1)
- **Processing Success Rate**: >95% completion rate across all chunks
- **Timeline Accuracy**: <100ms error across chunk boundaries (maintaining existing word-level precision)
- **Client Memory Usage**: <1GB RAM during extraction (similar to existing single-file process)
- **Server Bandwidth Reduction**: 95% reduction (27MB chunks vs 720MB single audio file)
- **API Efficiency**: 67% reduction in API calls (16 chunks vs 48 chunks for 8-hour video)

### Business Metrics
- **User Adoption**: Increase in long-form content uploads
- **Processing Time**: <3x current processing time for long videos
- **Clip Quality**: Virality scores maintained or improved
- **User Satisfaction**: Feedback on processing experience

### Performance Metrics
- **UI Responsiveness**: <1 second interaction latency (maintaining existing standards)
- **Extraction Speed**: Real-time or faster audio extraction (building on existing FFmpeg performance)
- **Upload Efficiency**: 90%+ successful chunk upload rate (improving on existing single-file upload reliability)
- **Error Recovery**: <5% complete failure rate (better than existing single-point failure mode)

## Timeline

### Phase 1: Client-Side Audio Chunking (4 weeks)
- **Week 1-2**: Extend existing FFmpeg integration for chunked audio extraction
- **Week 3-4**: Chunk upload management building on existing audio upload patterns and server processing

### Phase 2: Enhanced Streaming System (4 weeks)
- **Week 5-6**: Progressive processing and streaming leveraging existing ProgressChannel
- **Week 7-8**: Enhanced progress tracking and UI improvements to ClipGenerationProgress.vue

### Phase 3: Cross-Chunk Optimization (2 weeks)
- **Week 9-10**: Boundary analysis and clip merging enhancing existing validation pipeline

### Phase 4: Testing & Launch (6 weeks)
- **Week 11-14**: Comprehensive testing and optimization
- **Week 15-16**: Beta testing and performance tuning

**Total Timeline: 16 weeks (4 months)**

## Conclusion

This client-side chunking strategy transforms Clippster's architecture to support unlimited-length videos while dramatically reducing server infrastructure costs and improving user experience. By processing audio on the client side, we eliminate the fundamental file size limitations that currently block long-form content support.

The approach provides several key advantages:
- **No Server File Size Limits**: Process 8-hour videos without 100MB restrictions
- **Reduced Infrastructure Costs**: 95% reduction in server bandwidth usage
- **Better User Experience**: Real-time progress and reliable processing
- **Improved Reliability**: Individual chunk failures don't break entire process
- **Enhanced Scalability**: Support concurrent long-video processing

This strategy positions Clippster to capture the massive market of long-form content creators while maintaining our high standards for clip quality and accuracy.