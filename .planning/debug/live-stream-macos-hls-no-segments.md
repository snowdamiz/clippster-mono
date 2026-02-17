---
status: investigating
trigger: "Live streams don't work on macOS but work perfectly on Windows. The HLS playback system connects to the stream via yt-dlp but no segments are ever written/found, causing the video player to remain empty."
created: 2026-02-16T00:00:00Z
updated: 2026-02-16T00:00:00Z
---

## Current Focus

hypothesis: Unknown - gathering initial evidence
test: Read Rust backend get_hls_segments and DVR management code
expecting: Find path handling or process spawning differences between macOS and Windows
next_action: Search for get_hls_segments Rust command implementation

## Symptoms

expected: When watching a Kick live stream (e.g., xqc), the HLS segments should be downloaded by yt-dlp into the DVR output directory, and the HLS playback system should pick them up and play the stream in the video element.

actual: The system connects to Kick via yt-dlp and reports "Connected to Kick stream via yt-dlp (using existing DVR)" but:
- get_hls_segments returns no segments (repeated 100+ times)
- [HlsPlayback] Playlist not available after max wait time
- Debug overlay shows: segs: 0, totalDur: 0.0s, videoEl: ready:0, src:empty
- hlsInit: false, hlsErr: "Playlist not available - recording may not have started"
- The video element has no source set

errors:
- [Debug] [LiveViewer] No segments returned from get_hls_segments (repeated ~120+ times)
- [Warning] [HlsPlayback] Playlist not available after max wait time
- [Error] ActivityTracker ping 500 errors (likely unrelated)
- HLS output dir: /Users/sn0w/Library/Application Support/Clippster/users/1/livestream_recordings/kick-view-xqc-1771294786573

reproduction: Open Clippster on macOS, try to watch any Kick live stream. Works on Windows, not macOS.

started: Current issue on macOS, Windows works fine.

## Eliminated

(none yet)

## Evidence

(none yet)

## Resolution

root_cause:
fix:
verification:
files_changed: []
