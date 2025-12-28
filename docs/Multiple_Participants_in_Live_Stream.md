# Multiple Participants in Live Stream (Guests on Stage)

## Overview

PumpFun allows streamers to have "guests on stage" - viewers can request to join, and if approved, they can:
- Talk (audio)
- Live stream video
- Screen share
- etc.

The creator can pin guest streams to the main screen, show them alongside themselves, or in various layouts. Guests can have 8-10 people on stage at once (exact number TBD).

---

## Current Implementation Analysis

### How LiveKit Works (PumpFun's Backend)

LiveKit is an **SFU (Selective Forwarding Unit)**:
- Each participant publishes their own video/audio tracks separately
- Viewers receive **separate tracks** for each participant (not a pre-composed view)
- The client decides what to display and how

When PumpFun has guests on stage:
- **Host**: publishes video track + audio track (identity likely contains mint ID)
- **Guest 1**: publishes video track + audio track (identity likely `{id}-viewer-{random}`)
- **Guest 2**: publishes video track + audio track
- ...etc (up to 8-10 guests)

---

## Current Behavior Summary

### HLS Recording (`record-livestream.mjs`)

| Track Type | Behavior | Code Location |
|------------|----------|---------------|
| **Video** | ❌ Only captures FIRST video track (likely host) | Lines 655-677 |
| **Audio** | ✅ Mixes ALL audio tracks together via `AudioMixer` | Lines 237-334, 680-917 |

**Video handling code:**
```javascript
if (track.kind === TrackKind.KIND_VIDEO && !this.videoReader) {
  // Only FIRST video track is captured
  this.bindVideoStream(track);
} else if (track.kind === TrackKind.KIND_VIDEO && this.videoReader) {
  // Additional video tracks are SKIPPED
  log('DIAG: Video track skipped (already have reader)');
}
```

**Audio handling - AudioMixer supports multiple tracks:**
```javascript
class AudioMixer {
  mixChunk(timeIndex, buffer, trackId = null) {
    // Mixes multiple audio tracks together
    // Each track identified by trackId
  }
}
```

### Frontend Viewer (`useLivestreamViewer.ts`)

| Track Type | Behavior | Code Location |
|------------|----------|---------------|
| **Video** | ❌ Single variable - overwrites with new tracks | Lines 676-688 |
| **Audio** | ❌ Single variable - overwrites with new tracks | Lines 676-688 |
| **Participant Info** | ❌ Completely ignored | `_participant` parameter unused |

**Code:**
```typescript
function handleTrackSubscribed(
  track: RemoteTrack,
  _publication: RemoteTrackPublication,
  _participant: RemoteParticipant  // ← IGNORED - no participant tracking
) {
  if (track.kind === Track.Kind.Video) {
    remoteVideoTrack = track as RemoteVideoTrack;  // Single variable - overwrites
  } else if (track.kind === Track.Kind.Audio) {
    remoteAudioTrack = track as RemoteAudioTrack;  // Single variable - overwrites
  }
}
```

---

## What Users Experience

| Feature | Current Support | Notes |
|---------|----------------|-------|
| **Hear guest audio** | ✅ Yes | AudioMixer combines all tracks |
| **See host's view** | ✅ Yes | First video track captured |
| **See individual guest video** | ❌ No | Only first video track captured |
| **User-controlled participant switching** | ❌ No | No UI or track management |
| **Select who to view** | ❌ No | Dependent on what PumpFun sends first |

---

## Diagnostic Logging (Already Exists)

The recording script has `DIAGNOSTIC_MODE = true` and logs participant/track info:

```javascript
// On TrackPublished event
log('DIAG: TrackPublished event', {
    publicationSid: publication?.sid,
    kind: publication?.kind,
    participantIdentity: participant?.identity,  // WHO published
    isSubscribed: publication?.isSubscribed
});

// On room connect - lists all participants
for (const [sid, participant] of this.room.remoteParticipants) {
    log('DIAG: Remote participant', {
        identity: participant?.identity,
        sid,
        tracks: trackInfo
    });
}
```

### Expected Log Output with Guests

When viewing a stream with guests, you should see logs like:
```
DIAG: Remote participant { identity: "abc123pump", tracks: [video, audio] }  // Host
DIAG: Remote participant { identity: "xyz-viewer-456", tracks: [video, audio] }  // Guest 1
DIAG: Remote participant { identity: "def-viewer-789", tracks: [video, audio] }  // Guest 2
DIAG: Video track skipped (already have reader) { trackSid: "TR_xyz..." }  // Guest video SKIPPED
DIAG: Audio track subscribed { trackId: "TR_xyz...", trackNumber: 2 }  // Guest audio MIXED
```

---

## Files Involved

| File | Purpose |
|------|---------|
| `client/src-tauri/pumpfun-service/record-livestream.mjs` | HLS recording - handles track capture |
| `client/src/composables/useLivestreamViewer.ts` | Frontend viewer - LiveKit room connection |
| `client/src/components/LivestreamWatchDialog.vue` | Watch dialog UI |
| `client/src/composables/useDvrRecording.ts` | DVR recording - also has participant handling |

---

## To Fully Support Multi-Participant

### 1. Track Management
Change from single variables to Maps:
```typescript
// Instead of:
let remoteVideoTrack: RemoteVideoTrack | null = null;
let remoteAudioTrack: RemoteAudioTrack | null = null;

// Use:
const participantTracks = new Map<string, {
  video: RemoteVideoTrack | null;
  audio: RemoteAudioTrack | null;
  identity: string;
  isHost: boolean;
}>();
```

### 2. UI for Participant Selection
- Grid view showing all participants
- Speaker view (highlight active speaker)
- Participant list/thumbnails
- Click to focus on a participant

### 3. Individual Volume Controls
- Per-participant audio mixing
- Mute/unmute individual guests
- Volume sliders per participant

### 4. Recording Changes
Options:
- Capture multiple video tracks (picture-in-picture layout)
- Allow user to select which track to record
- Record all tracks separately for post-production

---

## Proposed Enhanced Diagnostic Logging

Add this to `handleTrackSubscribed` in `record-livestream.mjs`:
```javascript
log('MULTI-PARTICIPANT INFO', {
    totalParticipants: this.room.remoteParticipants.size,
    totalVideoTracks: [...this.room.remoteParticipants.values()]
        .flatMap(p => [...p.trackPublications.values()])
        .filter(t => t.kind === TrackKind.KIND_VIDEO).length,
    totalAudioTracks: [...this.room.remoteParticipants.values()]
        .flatMap(p => [...p.trackPublications.values()])
        .filter(t => t.kind === TrackKind.KIND_AUDIO).length,
    isCapturingVideo: !!this.videoReader,
    audioTracksBeingMixed: this.audioTracks.size,
    participants: [...this.room.remoteParticipants.values()].map(p => ({
        identity: p.identity,
        videoTracks: [...p.trackPublications.values()].filter(t => t.kind === TrackKind.KIND_VIDEO).length,
        audioTracks: [...p.trackPublications.values()].filter(t => t.kind === TrackKind.KIND_AUDIO).length
    }))
});
```

---

## Investigation TODO

- [ ] Watch a stream WITH guests on stage and capture diagnostic logs
- [ ] Verify how many video/audio tracks PumpFun sends per participant
- [ ] Check if PumpFun sends a "composed" video track or individual tracks
- [ ] Determine participant identity format (host vs guest)
- [ ] Test if audio mixer is actually receiving multiple tracks
- [ ] Document exact number of guests allowed (reportedly 8-10)

---

## References

- PumpFun LiveKit API: `https://livestream-api.pump.fun`
- LiveKit Cloud URL: `https://pump-prod-tg2x8veh.livekit.cloud`
- Note: PumpFun's livestreaming was temporarily suspended in Nov 2024 for moderation improvements, but has been reinstated with new moderation systems.

---

*Last Updated: December 2024*

