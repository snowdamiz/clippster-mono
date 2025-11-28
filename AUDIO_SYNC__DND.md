# Audio-Video Sync Fix for Livestream Recording

## Problem Analysis

After thorough review of [`record-livestream.mjs`](client/src-tauri/pumpfun-service/record-livestream.mjs), the audio sync issue stems from **timestamp source mismatch** between audio and video streams:

### Root Causes Identified

1. **Mismatched Timestamp Sources**:

   - Video uses presentation timestamps (`timestampUs` from LiveKit) - line 445-458
   - Audio uses arrival time (`Date.now()`) with no presentation timestamp - line 378-398

2. **Reference Time Calculation** (line 578-579):
   ```javascript
   this.referenceTime = Math.max(this.firstAudioTime, this.firstVideoTime);
   ```


This assumes first packets from both streams represent the same content moment - they don't.

3. **Double Offset Application**: The `AUDIO_OFFSET_MS = 1000` is applied to audio indexing, but the 1000ms jitter buffer (`latencyBuffer = 50` frames) already delays audio output.

4. **Missing Audio PTS**: The `@livekit/rtc-node` AudioStream frames do have timestamp information, but it's not being used.

---

## Solution Options

### Option A: Use Audio Presentation Timestamps (Recommended)

Modify the audio stream processing to use LiveKit's audio frame timestamps instead of arrival time, mirroring the video approach.

**Changes to [`record-livestream.mjs`](client/src-tauri/pumpfun-service/record-livestream.mjs)**:

1. Capture `firstAudioTimestampUs` similar to video
2. Calculate audio time indices using presentation timestamps
3. Compute a unified reference point based on both streams' first PTS values
4. Remove the hardcoded `AUDIO_OFFSET_MS` constant

**Pros**: Fixes the root cause, works for all streams

**Cons**: Requires understanding of LiveKit audio frame timestamp format

---

### Option B: FFmpeg-Based Timestamp Regeneration

Use FFmpeg's timestamp manipulation features to fix sync at encoding time.

**Changes**:

1. Add `-use_wallclock_as_timestamps 1` for video input
2. Add `-async 1` to correct audio drift
3. Add `-fflags +genpts` to regenerate presentation timestamps
```javascript
// Modified FFmpeg args
const args = [
  '-fflags', '+genpts',
  '-use_wallclock_as_timestamps', '1',
  // ... audio input ...
  '-f', 's16le', '-ac', '2', '-ar', '48000', '-i', 'pipe:0',
  // ... video input ...
  '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', `${width}x${height}`,
  '-framerate', '30', '-use_wallclock_as_timestamps', '1', '-i', 'pipe:3',
  '-async', '1',
  // ... rest of encoding options ...
];
```


**Pros**: Minimal code changes, FFmpeg handles sync

**Cons**: May introduce slight audio stretching/squeezing, less precise

---

### Option C: Unified Wall-Clock Based Synchronization

Rewrite both audio and video to use a shared wall-clock reference with proper buffering.

**Key Changes**:

1. Remove dependency on stream-specific timestamps
2. Buffer both streams with aligned start times
3. Write frames based on wall-clock elapsed time from a synchronized start
4. Add startup calibration period to measure initial offset
```javascript
// Pseudocode for unified sync
class UnifiedSyncRecorder {
  startRecording() {
    this.wallClockStart = null; // Set when both streams ready
    this.audioBuffer = new TimedBuffer();
    this.videoBuffer = new TimedBuffer();
  }
  
  onAudioFrame(frame) {
    const wallTime = Date.now();
    this.audioBuffer.add(wallTime, frame);
    this.tryStartIfReady();
  }
  
  onVideoFrame(frame) {
    const wallTime = Date.now();
    this.videoBuffer.add(wallTime, frame);
    this.tryStartIfReady();
  }
  
  tryStartIfReady() {
    if (!this.wallClockStart && this.audioBuffer.hasData() && this.videoBuffer.hasData()) {
      this.wallClockStart = Math.max(
        this.audioBuffer.firstTimestamp,
        this.videoBuffer.firstTimestamp
      );
      this.startEncoder();
      this.startOutputLoop();
    }
  }
}
```


**Pros**: Clean architecture, predictable behavior

**Cons**: Requires significant refactoring

---

### Option D: AI-Based Post-Processing Sync Correction

Add a post-processing step to detect and fix sync issues after recording.

**Implementation**:

1. After segment completion, run sync detection
2. Use cross-correlation between audio waveform and detected speech in video
3. Apply `ffmpeg -itsoffset` to correct detected offset
```javascript
async function detectAndFixSync(segmentPath) {
  // Extract audio for analysis
  const audioPath = await extractAudioForAnalysis(segmentPath);
  
  // Use voice activity detection to find speech patterns
  const audioVAD = await detectVoiceActivity(audioPath);
  
  // Extract video frames and detect lip movement/speech
  const videoSpeech = await detectVideoSpeech(segmentPath);
  
  // Cross-correlate to find offset
  const offset = crossCorrelate(audioVAD, videoSpeech);
  
  if (Math.abs(offset) > 50) { // More than 50ms offset
    await fixSyncWithFFmpeg(segmentPath, offset);
  }
}
```


**Pros**: Can fix any recording regardless of source, handles variable offsets

**Cons**: Adds processing time, requires additional dependencies (whisper/VAD models)

---

### Option E: Hybrid Approach (Recommended for Production)

Combine Option A (fix root cause) with Option D (safety net):

1. Implement proper PTS-based synchronization (Option A)
2. Add lightweight sync verification after each segment
3. Auto-correct if needed using FFmpeg

---

## Recommendation

**Start with Option A** - fixing the audio timestamp source is the correct architectural solution. The code already handles video timestamps properly; audio just needs the same treatment.

If Option A proves insufficient due to LiveKit SDK limitations, fall back to **Option B** (FFmpeg-based sync) as it's the least invasive change.

**Option D** (AI post-processing) should be implemented as an optional safety net regardless of which primary fix is chosen.

---

## Files to Modify

| File | Changes |

|------|---------|

| [`record-livestream.mjs`](client/src-tauri/pumpfun-service/record-livestream.mjs) | Audio timestamp handling, reference time calculation |

| [`pumpfun.rs`](client/src-tauri/src/pumpfun.rs) | Pass sync config if needed |

## Testing Strategy

1. Record multiple different streams (3-5 minimum)
2. Measure audio-video offset using waveform analysis
3. Verify consistent sync within ±50ms tolerance
4. Test across different network conditions