# Implementation Plan: Full GPU Pipeline Optimization

This plan outlines how to transition Clippster from a "CPU-centric" architecture (like Handbrake) to a "GPU-centric" architecture (like CapCut), focusing on the high-impact "Hardware Decoding" first.

## Phase 1: Hardware Decoding (The "Quick Win")
**Objective:** Eliminate the CPU bottleneck during video reading. Currently, the CPU decodes every frame and sends it to RAM. We will move this to the GPU.

### 1. Update Hardware Detection (`encoder.rs`)
We need to know not just which *encoder* is available (e.g., `h264_nvenc`), but which *decoding* strategy to use.

*   **Action:** Add `hw_accel_arg` to the `EncoderConfig` struct.
*   **Logic:**
    *   If **NVIDIA** detected: `hw_accel_arg = "cuda"` (or `auto`)
    *   If **macOS** detected: `hw_accel_arg = "videotoolbox"`
    *   If **Intel/Linux** detected: `hw_accel_arg = "auto"`
    *   **Fallback:** If unsure, use `auto`.

### 2. Modify Video Processor (`video_processor.rs`)
Inject the hardware acceleration flag *before* the input file argument.

**Before (Slow - CPU Decode):**
```rust
vec![
    "-i", "input.mp4",
    "-vf", "crop=...",
    "-c:v", "h264_nvenc"
]
```

**After (Fast - GPU Decode):**
```rust
vec![
    "-hwaccel", "auto",     // <--- The magic flag
    "-hwaccel_output_format", "nv12", // Keep in GPU memory format
    "-i", "input.mp4",
    "-vf", "scale_cuda=...,hwdownload,format=nv12", // GPU processing
    "-c:v", "h264_nvenc"
]
```

### 3. Update Fallback Logic (`run_ffmpeg_with_fallback`)
If hardware decoding fails (e.g., unsupported format), the fallback system must strip the `-hwaccel` flags and try again with standard CPU decoding.

---

## Phase 2: GPU-Accelerated Filters (High Performance)
**Objective:** Perform cropping, scaling, and color grading on the GPU. This avoids the expensive "download from GPU → process on CPU → upload to GPU" loop.

*   **NVIDIA:** Use `hwupload_cuda` → `crop_cuda` → `scale_cuda`.
*   **macOS:** Use `scale_videotoolbox`.
*   **Complexity:** Requires constructing different filter strings based on the detected hardware.

---

## Phase 3: Daemon Mode (Instant Start)
**Objective:** Remove the ~200ms startup cost of FFmpeg for every clip.

*   **Strategy:** Keep an FFmpeg process (or a custom Rust worker using `ffmpeg-next`) running in the background.
*   **Action:** Send commands via pipe instead of spawning new processes.

---

## Recommended Next Step
**Implement Phase 1 (Hardware Decoding) immediately.** It provides the highest ROI (Return on Investment) with minimal code changes and low risk.
