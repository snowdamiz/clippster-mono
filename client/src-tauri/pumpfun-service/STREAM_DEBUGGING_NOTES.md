# PumpFun Stream Recording - Debugging Session Notes

**Date**: December 9, 2025  
**Stream Tested**: `B1oEzGes1QxVZoxR3abiwAyL4jcPRF2s2ok5Yerrpump` (rasmr)  
**Stream Type**: OBS via RTMP to PumpFun

---

## Summary

This document captures the debugging session for a problematic PumpFun livestream that exhibited multiple issues during live clipping. The streamer was using **OBS via RTMP** to broadcast to PumpFun, which introduced unique challenges not seen with native PumpFun streams.

---

## Issues Encountered

### 1. Audio Stuttering/Robotic/Slow-Mo Sound
**Symptoms**:
- Audio sounded robotic, stuttering, and slow-motion
- Other streams did not have this issue

**Root Cause**: 
The stream had **TWO audio tracks**:
- `TR_AMNsnuXLFK96eP` (Track 1)
- `TR_AMJdpSHtrcLRvv` (Track 2)

When both tracks were mixed together in the AudioMixer, **phase cancellation** occurred, causing the robotic/stuttering sound.

**Fix Implemented**:
Initially tried using only the first track, but this caused other issues. Currently configured to mix both tracks (may still have some audio artifacts - needs testing).

**File**: `record-livestream.mjs`  
**Location**: `bindAudioStream()` function

---

### 2. Audio Out of Sync with Video
**Symptoms**:
- Audio was massively delayed compared to video
- Wall-clock arrival difference was -1204ms (audio arrived 1.2 seconds before video)

**Root Cause**:
For OBS/RTMP streams, the first audio track may be a "monitor" track with inherent delay, while the second track is the properly synced main audio.

**Attempted Fixes**:
1. Wall-clock compensation based on arrival time difference (removed - caused more issues)
2. Track switching to use second track (removed - caused zero audio)
3. Currently using simple PTS-based sync with `AUDIO_ADVANCE_MS = 210`

**Status**: May still have sync issues on some streams - needs further testing.

---

### 3. Green Screen / Video Corruption
**Symptoms**:
- First ~11 seconds of recording showed green/magenta horizontal lines
- Classic I420 stride/format corruption pattern

**Root Cause #1 - Buffer Reuse**:
LiveKit may reuse video frame buffers before we finish copying the data.

**Fix**: Copy plane data immediately after `getPlane()`:
```javascript
const yPlaneCopy = Buffer.from(yPlane.slice());
const uPlaneCopy = Buffer.from(uPlane.slice());
const vPlaneCopy = Buffer.from(vPlane.slice());
```

**Root Cause #2 - Resolution Change Mid-Stream**:
The stream started at **1280x720** then changed to **640x360**. During the transition:
- FFmpeg was still configured for 1280x720
- We were sending 640x360 frames (691,200 bytes)
- FFmpeg expected 1,382,400 bytes → **CORRUPTION**

**Fix**: 
- Skip frames immediately when resolution doesn't match expected
- Wait for 30 consecutive frames at new resolution before restarting encoder
- Clear video queue of wrong-resolution frames

**File**: `record-livestream.mjs`  
**Location**: Video processing loop, resolution change handling

---

### 4. Frozen Video / Frame Reuse
**Symptoms**:
- 24% of video frames were reused (frozen video)
- Log showed: `targetTimestampUs: 4923332, queueMinTs: 5187000`

**Root Cause**:
After encoder restart (due to resolution change), the video queue's minimum timestamp was **higher** than the target timestamp we were looking for. This meant all frame lookups failed.

**Fix**: Added catch-up logic in `syncVideoToAudio()`:
```javascript
if (targetTimestampUs < queueMinTs) {
    // Skip ahead in frame count to match the queue
    const framesToSkip = Math.floor(Number(gapUs) / 33333.33);
    this.videoFramesWritten += framesToSkip;
}
```

---

## Diagnostic Logging Added

The following diagnostic logs were added to help debug future issues:

### Audio Diagnostics
- `DIAG: Audio track metadata` - Shows track info including whether it's first/additional track
- `DIAG: AudioStream configured` - Shows target sample rate, channels, frame size
- `DIAG: Stream audio profile` - Shows actual vs expected frame sizes
- `DIAG: Audio frame arrival rate anomaly` - Detects sample rate issues

### Video Diagnostics
- `DIAG: Converted frame methods/props` - Shows what methods are available on video frames
- `DIAG: Stream video profile` - Shows resolution, stride info, potential issues
- `DIAG: Extracting plane data` - Shows buffer sizes, strides, first bytes for first 3 frames
- `DIAG: Resolution change starting/confirmed` - Tracks resolution changes

### Sync Diagnostics
- `DIAG: Sync health report` - Periodic report (every 30s) showing A/V drift, frame counts
- `DIAG: Skipping ahead to match queue` - When video catches up after dropped frames
- `DIAG: Video frame reuse count` - Tracks frozen video issues

---

## Configuration Constants

```javascript
const AUDIO_ADVANCE_MS = 210;        // Manual audio sync offset (ms)
const AUDIO_FALLBACK_OFFSET_MS = 0;  // Fallback if sync setup fails
const DEBUG_SYNC = true;             // Enable sync debugging
const DIAGNOSTIC_MODE = true;        // Enable comprehensive logging
const SYNC_HEALTH_INTERVAL_MS = 30000; // Log sync health every 30s
```

---

## Known Issues / TODO

### Needs Testing
1. **Audio sync** - May still be off for OBS/RTMP streams
2. **Audio quality** - Mixing both tracks may still cause some artifacts
3. **Resolution change handling** - New logic needs verification with live stream

### Potential Improvements
1. **Smart audio track selection** - Detect which track is "main" vs "monitor"
2. **Configurable audio offset** - Per-stream audio sync adjustment
3. **Better resolution change detection** - Faster response, less dropped frames

---

## Stream Characteristics (rasmr stream)

```
Mint ID: B1oEzGes1QxVZoxR3abiwAyL4jcPRF2s2ok5Yerrpump
Broadcast Method: OBS via RTMP
Initial Resolution: 1280x720
Final Resolution: 640x360
Audio Tracks: 2
Audio Sample Rate: 48000 Hz
Audio Channels: 2 (stereo)
Audio Frame Size: 3840 bytes (correct)
Video FPS: 30
```

---

## Files Modified

- `client/src-tauri/pumpfun-service/record-livestream.mjs`
  - Audio track handling
  - Video buffer copying
  - Resolution change detection
  - Video timestamp synchronization
  - Extensive diagnostic logging

---

## Testing Checklist for Next Session

- [ ] Find another OBS/RTMP streamer on PumpFun
- [ ] Record at least 2-3 minutes to catch resolution changes
- [ ] Check diagnostic logs for:
  - [ ] Audio track count and metadata
  - [ ] Resolution changes detected
  - [ ] Frame reuse count (should be low)
  - [ ] Sync health reports
- [ ] Verify output video:
  - [ ] No green screen artifacts
  - [ ] No frozen video segments
  - [ ] Audio in sync with video
  - [ ] Audio quality (no robotic sound)
- [ ] Compare with a native PumpFun stream to ensure we didn't break anything




