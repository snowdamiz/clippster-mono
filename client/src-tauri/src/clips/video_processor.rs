use futures::future::join_all;
use std::sync::{Arc, Mutex};
use tauri_plugin_shell::ShellExt;

use super::encoder::{
    build_hwaccel_args, detect_hardware_encoder, get_quality_settings, run_ffmpeg_with_fallback,
};
use super::font_manager::get_fonts_dir;
use super::types::{
    build_time_based_filter_string, AspectRatio, AudioSettings, MusicTrackSettings,
    StickerSettings, VideoFilterSegment, WatermarkSettings,
};
use super::video_info::{calculate_crop_params, get_video_info, IntroOutroCache};

/// Ensure a dimension is even (required by H.264/libx264)
/// Rounds up to the nearest even number
fn make_even(n: u32) -> u32 {
    if n.is_multiple_of(2) {
        n
    } else {
        n + 1
    }
}

/// Check if a file is a video file based on extension
/// Used to determine if we need to add loop flags for animated watermarks/overlays
fn is_video_file(path: &str) -> bool {
    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    matches!(ext.to_lowercase().as_str(), "mp4" | "mov")
}

/// Build time-based FFmpeg filter string from filter segments
/// This creates a filter string with enable expressions for each segment's time range
fn build_video_filter_string(segments: Option<&Vec<VideoFilterSegment>>) -> Option<String> {
    let segments = segments?;
    build_time_based_filter_string(segments)
}

/// Combine video filter segments with an effects filter chain
/// Returns a combined filter string that includes both color grading and visual effects
fn build_combined_filter_string(
    video_filter_segments: Option<&Vec<VideoFilterSegment>>,
    effects_filter_chain: Option<&str>,
) -> Option<String> {
    let video_filters = build_video_filter_string(video_filter_segments);

    match (video_filters, effects_filter_chain) {
        (Some(vf), Some(ef)) => Some(format!("{},{}", vf, ef)),
        (Some(vf), None) => Some(vf),
        (None, Some(ef)) => Some(ef.to_string()),
        (None, None) => None,
    }
}

/// Build time-based filter string with adjusted time offsets
/// Used when the output video starts at a different time than the source
/// offset: the time offset to add to all filter start/end times
#[allow(dead_code)]
fn build_video_filter_string_with_offset(
    segments: Option<&Vec<VideoFilterSegment>>,
    offset: f64,
) -> Option<String> {
    let segments = segments?;
    if segments.is_empty() {
        return None;
    }

    let mut all_filters = Vec::new();

    for segment in segments {
        // Adjust the segment times by the offset
        let adjusted_start = (segment.start_time - offset).max(0.0);
        let adjusted_end = segment.end_time - offset;

        // Only include segments that are within the current video portion
        if adjusted_end > 0.0 {
            if let Some(filter_str) = segment
                .settings
                .to_ffmpeg_filter_with_enable(adjusted_start, adjusted_end)
            {
                all_filters.push(filter_str);
            }
        }
    }

    if all_filters.is_empty() {
        None
    } else {
        Some(all_filters.join(","))
    }
}

/// Get filter segments that overlap with a specific time range
/// Returns segments with times adjusted relative to the segment's start
fn get_overlapping_filter_segments(
    segments: Option<&Vec<VideoFilterSegment>>,
    segment_start: f64,
    segment_end: f64,
) -> Option<Vec<VideoFilterSegment>> {
    let filter_segments = segments?;
    if filter_segments.is_empty() {
        return None;
    }

    let mut overlapping = Vec::new();

    for filter_seg in filter_segments {
        // Check if this filter segment overlaps with the video segment
        let overlap_start = filter_seg.start_time.max(segment_start);
        let overlap_end = filter_seg.end_time.min(segment_end);

        if overlap_start < overlap_end {
            // Adjust times to be relative to the output segment (starting at 0)
            let adjusted_start = overlap_start - segment_start;
            let adjusted_end = overlap_end - segment_start;

            overlapping.push(VideoFilterSegment {
                id: filter_seg.id.clone(),
                start_time: adjusted_start,
                end_time: adjusted_end,
                settings: filter_seg.settings.clone(),
            });
        }
    }

    if overlapping.is_empty() {
        None
    } else {
        Some(overlapping)
    }
}

// Helper struct to hold audio processing configuration
#[allow(dead_code)]
pub struct AudioProcessingConfig {
    // Simple audio filter for original audio (no music tracks)
    pub simple_filter: Option<String>,
    // Additional input files for music tracks
    pub additional_inputs: Vec<String>,
    // Complex filter graph for mixing audio (when music tracks present)
    pub complex_filter: Option<String>,
    // Whether we need to use filter_complex for audio
    pub needs_complex_audio: bool,
}

// Helper function to build audio filter string for FFmpeg
// Combines volume adjustment and normalization
// This is the simple version for cases without music tracks
fn build_audio_filter(audio_settings: Option<&AudioSettings>) -> Option<String> {
    let settings = audio_settings?;

    let mut filters = Vec::new();

    // Combine clip-level originalAudioDb with project-level volume
    // Both are in dB, so we add them together
    let original_db = settings.original_audio_db.unwrap_or(0.0);
    let total_db = original_db + settings.volume;

    // Volume adjustment (in dB)
    if total_db != 0.0 {
        filters.push(format!("volume={}dB", total_db));
    }

    // Normalization (loudnorm filter - industry standard -16 LUFS)
    if settings.normalize {
        filters.push("loudnorm=I=-16:TP=-1.5:LRA=11".to_string());
    }

    if filters.is_empty() {
        None
    } else {
        Some(filters.join(","))
    }
}

/// Combine audio settings filter with audio effects filter chain
/// Returns a combined audio filter string for FFmpeg -af parameter
fn build_combined_audio_filter(
    audio_settings: Option<&AudioSettings>,
    audio_effects_filter_chain: Option<&str>,
) -> Option<String> {
    let audio_filter = build_audio_filter(audio_settings);

    match (audio_filter, audio_effects_filter_chain) {
        (Some(af), Some(ef)) => Some(format!("{},{}", af, ef)),
        (Some(af), None) => Some(af),
        (None, Some(ef)) => Some(ef.to_string()),
        (None, None) => None,
    }
}

// Helper function to build complete audio processing config
// Handles both simple (no music tracks) and complex (with music tracks) cases
#[allow(dead_code)]
fn build_audio_processing_config(
    audio_settings: Option<&AudioSettings>,
    _clip_duration: f64,
) -> AudioProcessingConfig {
    let settings = match audio_settings {
        Some(s) => s,
        None => {
            return AudioProcessingConfig {
                simple_filter: None,
                additional_inputs: Vec::new(),
                complex_filter: None,
                needs_complex_audio: false,
            }
        }
    };

    // Get non-muted music tracks
    let music_tracks: Vec<&MusicTrackSettings> = settings
        .music_tracks
        .as_ref()
        .map(|tracks| tracks.iter().filter(|t| !t.is_muted).collect())
        .unwrap_or_default();

    // If no music tracks, use simple filter
    if music_tracks.is_empty() {
        return AudioProcessingConfig {
            simple_filter: build_audio_filter(audio_settings),
            additional_inputs: Vec::new(),
            complex_filter: None,
            needs_complex_audio: false,
        };
    }

    // Build complex audio filter for mixing music tracks
    let mut filter_parts = Vec::new();
    let mut additional_inputs = Vec::new();

    // Calculate total gain for original audio
    let original_db = settings.original_audio_db.unwrap_or(0.0);
    let total_db = original_db + settings.volume;

    // Process original audio (input 0)
    if total_db != 0.0 {
        filter_parts.push(format!("[0:a]volume={}dB[orig]", total_db));
    } else {
        filter_parts.push("[0:a]acopy[orig]".to_string());
    }

    // Process each music track
    let mut mix_inputs = vec!["[orig]".to_string()];
    for (i, track) in music_tracks.iter().enumerate() {
        let input_idx = i + 1; // Input 0 is the video, music tracks start at 1
        let track_label = format!("music{}", i);

        // Add input file
        additional_inputs.push(track.file_path.clone());

        // Build filter chain for this track:
        // 1. Apply gain (dB)
        // 2. Apply fade in/out
        // 3. Trim/pad to match timing
        let mut track_filters = Vec::new();

        // Apply gain
        if track.gain_db != 0.0 {
            track_filters.push(format!("volume={}dB", track.gain_db));
        }

        // Apply pan
        if track.pan != 0.0 {
            track_filters.push(format!("stereotools=balance_out={}", track.pan));
        }

        // Apply fade in (if > 0)
        if track.fade_in > 0.0 {
            track_filters.push(format!("afade=t=in:st=0:d={}", track.fade_in));
        }

        // Calculate track duration for fade out
        let track_duration = track.end_time - track.start_time;
        if track_duration > 0.0 && track.fade_out > 0.0 {
            let fade_out_start = (track_duration - track.fade_out).max(0.0);
            track_filters.push(format!(
                "afade=t=out:st={}:d={}",
                fade_out_start, track.fade_out
            ));
        }

        // Build the filter chain for this track
        let filter_chain = if track_filters.is_empty() {
            format!("[{}:a]acopy[{}]", input_idx, track_label)
        } else {
            format!(
                "[{}:a]{}[{}]",
                input_idx,
                track_filters.join(","),
                track_label
            )
        };
        filter_parts.push(filter_chain);

        // Add delay to position the track at the correct time in the clip
        // adelay uses milliseconds
        if track.start_time > 0.0 {
            let delay_ms = (track.start_time * 1000.0) as i64;
            let delayed_label = format!("{}d", track_label);
            filter_parts.push(format!(
                "[{}]adelay={}:all=1[{}]",
                track_label, delay_ms, delayed_label
            ));
            mix_inputs.push(format!("[{}]", delayed_label));
        } else {
            mix_inputs.push(format!("[{}]", track_label));
        }
    }

    // Mix all audio tracks together
    let mix_input_str = mix_inputs.join("");
    let num_inputs = music_tracks.len() + 1; // Original + music tracks
    filter_parts.push(format!(
        "{}amix=inputs={}:duration=first:dropout_transition=0[mixed]",
        mix_input_str, num_inputs
    ));

    // Apply normalization if enabled (on the final mixed output)
    if settings.normalize {
        filter_parts.push("[mixed]loudnorm=I=-16:TP=-1.5:LRA=11[aout]".to_string());
    } else {
        filter_parts.push("[mixed]acopy[aout]".to_string());
    }

    let complex_filter = filter_parts.join(";");
    println!(
        "[Rust] Built complex audio filter with {} music tracks: {}",
        music_tracks.len(),
        complex_filter
    );

    AudioProcessingConfig {
        simple_filter: None, // Not used when we have complex audio
        additional_inputs,
        complex_filter: Some(complex_filter),
        needs_complex_audio: true,
    }
}

// Helper function to calculate watermark position for FFmpeg overlay filter
// position_x and position_y are percentages (0-100) from top-left corner
// The position is calculated so the watermark center is at the specified percentage
fn get_watermark_overlay_position(position_x: u32, position_y: u32) -> String {
    // Calculate position based on percentage, centering the watermark on the point
    // This matches the CSS behavior: left: X%, top: Y%, transform: translate(-50%, -50%)
    //
    // Formula: position = (video_size * percentage / 100) - (overlay_size / 2)
    // This centers the watermark on the percentage point
    let x_expr = format!("main_w*{}/100-overlay_w/2", position_x);
    let y_expr = format!("main_h*{}/100-overlay_h/2", position_y);
    format!("x={}:y={}", x_expr, y_expr)
}

// Helper function to probe image dimensions using FFmpeg
// Used when watermark dimensions aren't stored in the database
async fn probe_image_dimensions(
    app: &tauri::AppHandle,
    image_path: &str,
) -> (Option<u32>, Option<u32>) {
    let shell = app.shell();

    // Use FFmpeg to get image info
    let output = match shell
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))
    {
        Ok(cmd) => {
            match cmd
                .args(["-nostdin", "-i", image_path, "-f", "null", "-"])
                .output()
                .await
            {
                Ok(out) => out,
                Err(e) => {
                    println!("[Rust] Failed to probe image dimensions: {}", e);
                    return (None, None);
                }
            }
        }
        Err(e) => {
            println!("[Rust] Failed to get ffmpeg sidecar: {}", e);
            return (None, None);
        }
    };

    // Parse dimensions from FFmpeg stderr
    let stderr = String::from_utf8_lossy(&output.stderr);
    println!("[Rust] FFmpeg probe output for image:\n{}", stderr);

    // Try multiple parsing approaches
    for line in stderr.lines() {
        // Look for Video stream line
        if line.contains("Video:") {
            println!("[Rust] Found video line: {}", line);

            // Method 1: Look for WxH pattern with regex-like matching
            // Patterns: "1920x1080", "1920x1080,", "1920x1080 [SAR"
            let parts: Vec<&str> = line.split_whitespace().collect();
            for part in &parts {
                // Skip parts that are clearly not dimensions
                if part.contains("0x") || part.starts_with("(") {
                    continue;
                }
                // Check for NxN pattern
                if let Some(x_pos) = part.find('x') {
                    let before = &part[..x_pos];
                    let after = &part[x_pos + 1..];
                    // Extract just the numeric parts
                    let w_str: String = before.chars().filter(|c| c.is_numeric()).collect();
                    let h_str: String = after.chars().take_while(|c| c.is_numeric()).collect();

                    if let (Ok(w), Ok(h)) = (w_str.parse::<u32>(), h_str.parse::<u32>()) {
                        if w >= 100 && h >= 100 && w < 100000 && h < 100000 {
                            println!("[Rust] Probed image dimensions: {}x{}", w, h);
                            return (Some(w), Some(h));
                        }
                    }
                }
            }

            // Method 2: Look for comma-separated values containing dimensions
            let comma_parts: Vec<&str> = line.split(',').collect();
            for part in comma_parts {
                let trimmed = part.trim();
                if let Some(x_pos) = trimmed.find('x') {
                    if x_pos > 0 && x_pos < trimmed.len() - 1 {
                        let before = &trimmed[..x_pos];
                        let after = &trimmed[x_pos + 1..];
                        let w_str: String = before
                            .chars()
                            .rev()
                            .take_while(|c| c.is_numeric())
                            .collect::<String>()
                            .chars()
                            .rev()
                            .collect();
                        let h_str: String = after.chars().take_while(|c| c.is_numeric()).collect();

                        if let (Ok(w), Ok(h)) = (w_str.parse::<u32>(), h_str.parse::<u32>()) {
                            if w >= 100 && h >= 100 && w < 100000 && h < 100000 {
                                println!("[Rust] Probed image dimensions (method 2): {}x{}", w, h);
                                return (Some(w), Some(h));
                            }
                        }
                    }
                }
            }
        }
    }

    println!("[Rust] Could not parse image dimensions from FFmpeg output");
    (None, None)
}

// Helper function to convert AspectRatio to string format (e.g., "16:9")
fn aspect_ratio_to_string(aspect_ratio: &AspectRatio) -> String {
    // Convert float ratio to common aspect ratio strings
    let ratio = aspect_ratio.width / aspect_ratio.height;

    if (ratio - 16.0 / 9.0).abs() < 0.01 {
        "16:9".to_string()
    } else if (ratio - 9.0 / 16.0).abs() < 0.01 {
        "9:16".to_string()
    } else if (ratio - 1.0).abs() < 0.01 {
        "1:1".to_string()
    } else if (ratio - 4.0 / 5.0).abs() < 0.01 {
        "4:5".to_string()
    } else {
        format!(
            "{}:{}",
            aspect_ratio.width as u32, aspect_ratio.height as u32
        )
    }
}

// Resolved watermark settings for a specific aspect ratio
#[derive(Debug)]
struct ResolvedWatermark {
    file_path: String,
    width: Option<u32>,
    height: Option<u32>,
    position_x: u32,
    position_y: u32,
    opacity: u32,
    scale: u32,
    is_full_frame_overlay: bool, // When true, position at 0,0 with 100% scale
}

// Helper function to get watermark settings for a specific aspect ratio
// Returns None if watermark is disabled for this aspect ratio
// Now supports per-ratio watermark images (different watermark files for different ratios)
fn get_watermark_for_aspect_ratio(
    watermark: &WatermarkSettings,
    aspect_ratio: Option<&str>,
) -> Option<ResolvedWatermark> {
    // Check if we have per-ratio settings
    if let Some(per_ratio) = &watermark.per_ratio_settings {
        if let Some(ratio) = aspect_ratio {
            // Try to get the config for this specific aspect ratio
            let ratio_config = match ratio {
                "16:9" => per_ratio.ratio_16_9.as_ref(),
                "9:16" => per_ratio.ratio_9_16.as_ref(),
                "1:1" => per_ratio.ratio_1_1.as_ref(),
                "4:5" => per_ratio.ratio_4_5.as_ref(),
                _ => None,
            };

            // Check if we found a config for this ratio
            match ratio_config {
                Some(config) => {
                    // Per-ratio config exists - use it (may have custom watermark and/or position)
                    // Use per-ratio watermark file if available, otherwise fall back to default
                    let file_path = config
                        .file_path
                        .clone()
                        .unwrap_or_else(|| watermark.file_path.clone());
                    let width = config.width.or(watermark.width);
                    let height = config.height.or(watermark.height);

                    // Use per-ratio position if available, otherwise fall back to default position
                    let (position_x, position_y, opacity, scale, is_full_frame_overlay) =
                        if let Some(pos) = &config.position {
                            (
                                pos.x,
                                pos.y,
                                pos.opacity,
                                pos.scale,
                                pos.is_full_frame_overlay.unwrap_or(false),
                            )
                        } else {
                            // No custom position for this ratio - use default position
                            (
                                watermark.position_x,
                                watermark.position_y,
                                watermark.opacity,
                                watermark.scale,
                                false,
                            )
                        };

                    let has_custom_watermark = config.file_path.is_some()
                        && config.file_path.as_ref() != Some(&watermark.file_path);
                    let has_custom_position = config.position.is_some();

                    println!("[Rust] Using per-ratio watermark for {}: file={}, custom_wm={}, custom_pos={}, x={}%, y={}%, opacity={}%, scale={}%, full_frame={}", 
                             ratio, file_path, has_custom_watermark, has_custom_position, position_x, position_y, opacity, scale, is_full_frame_overlay);

                    return Some(ResolvedWatermark {
                        file_path,
                        width,
                        height,
                        position_x,
                        position_y,
                        opacity,
                        scale,
                        is_full_frame_overlay,
                    });
                }
                None => {
                    // Config is explicitly None/null for this ratio - watermark disabled
                    println!(
                        "[Rust] Watermark disabled for aspect ratio {} (config is null)",
                        ratio
                    );
                    return None;
                }
            }
        }
    }

    // Fall back to default watermark settings (no per-ratio settings provided)
    println!("[Rust] Using default watermark settings (no per-ratio config)");
    Some(ResolvedWatermark {
        file_path: watermark.file_path.clone(),
        width: watermark.width,
        height: watermark.height,
        position_x: watermark.position_x,
        position_y: watermark.position_y,
        opacity: watermark.opacity,
        scale: watermark.scale,
        is_full_frame_overlay: false, // Default settings don't have this flag
    })
}

// Helper function to apply watermark to a video file with aspect ratio awareness
async fn apply_watermark_to_video_with_ratio(
    app: &tauri::AppHandle,
    input_path: &std::path::Path,
    watermark: &WatermarkSettings,
    quality: &str,
    aspect_ratio: Option<&str>,
) -> Result<(), String> {
    if !watermark.enabled {
        return Ok(());
    }

    // Get the appropriate watermark settings for this aspect ratio
    // Returns None if watermark is disabled for this ratio
    // Now supports per-ratio watermark images
    let Some(resolved) = get_watermark_for_aspect_ratio(watermark, aspect_ratio) else {
        // Watermark is disabled for this aspect ratio
        return Ok(());
    };

    let pos_x = resolved.position_x;
    let pos_y = resolved.position_y;
    let opacity_pct = resolved.opacity;
    let scale_pct = resolved.scale;
    let watermark_file_path = &resolved.file_path;

    let _shell = app.shell();

    // Get video info for calculating watermark size
    let video_info = get_video_info(app, input_path.to_str().ok_or("Invalid input path")?).await?;
    let video_width = video_info.width;
    let video_height = video_info.height;

    // Get watermark dimensions - use resolved values if available, otherwise probe the image file
    println!(
        "[Rust] Watermark settings received - width: {:?}, height: {:?}, file_path: {}",
        resolved.width, resolved.height, watermark_file_path
    );
    let (wm_actual_width, wm_actual_height) = match (resolved.width, resolved.height) {
        (Some(w), Some(h)) if w > 0 && h > 0 => {
            println!(
                "[Rust] Using watermark dimensions from database: {}x{}",
                w, h
            );
            (Some(w), Some(h))
        }
        _ => {
            // Database doesn't have dimensions - probe the watermark image file
            println!(
                "[Rust] Watermark dimensions not in database or zero, probing image file: {}",
                watermark_file_path
            );
            let probed = probe_image_dimensions(app, watermark_file_path).await;
            println!("[Rust] Probed dimensions result: {:?}", probed);
            probed
        }
    };
    println!(
        "[Rust] Final watermark dimensions: width={:?}, height={:?}",
        wm_actual_width, wm_actual_height
    );

    // Check for explicit full-frame overlay flag first (user-configured)
    // If not set, fall back to dimension-based detection for backward compatibility
    let is_full_frame_watermark = if resolved.is_full_frame_overlay {
        println!("[Rust] ✓ Full-frame overlay mode enabled via user setting");
        true
    } else {
        // Detect if this watermark is effectively a full-frame 16:9 canvas.
        // Accept common HD+ sizes to avoid strict 1920x1080 requirement (e.g., 2560x1440 will still scale down).
        match (wm_actual_width, wm_actual_height) {
            (Some(w), Some(h)) => {
                let ratio = (w as f32) / (h as f32);
                let ratio_diff = (ratio - (16.0 / 9.0)).abs();
                println!("[Rust] Checking full-frame: dimensions {}x{}, ratio={:.4}, diff from 16:9={:.4}, w>={}, h>={}",
                         w, h, ratio, ratio_diff, w >= 1600, h >= 900);
                let is_full = ratio_diff < 0.02 && w >= 1600 && h >= 900;
                if is_full {
                    println!("[Rust] ✓ Detected full-frame 16:9 watermark: {}x{}", w, h);
                } else {
                    println!("[Rust] ✗ NOT a full-frame watermark (ratio_diff={:.4} < 0.02? {}, w>=1600? {}, h>=900? {})", 
                             ratio_diff, ratio_diff < 0.02, w >= 1600, h >= 900);
                }
                is_full
            }
            _ => {
                println!(
                    "[Rust] Could not determine watermark dimensions, using standard placement"
                );
                false
            }
        }
    };
    println!(
        "[Rust] is_full_frame_watermark = {} (flag={}, auto-detect={})",
        is_full_frame_watermark, resolved.is_full_frame_overlay, !resolved.is_full_frame_overlay
    );

    // Calculate opacity (FFmpeg uses 0-1 range)
    let opacity = opacity_pct as f32 / 100.0;

    // Build the filter_complex for watermark overlay
    // Full-frame 1920x1080 watermarks are scaled to the output frame and pinned to 0,0.
    // Standard PNGs keep the existing percentage-based position/scale behavior.
    println!(
        "[Rust] Building filter_complex for watermark (is_full_frame={})",
        is_full_frame_watermark
    );
    let filter_complex = if is_full_frame_watermark {
        let wm_width = video_width;
        let wm_height = video_height;
        let filter = format!(
            "[1:v]scale={}:{},format=rgba,colorchannelmixer=aa={}[wm];[0:v][wm]overlay=0:0",
            wm_width, wm_height, opacity
        );
        println!(
            "[Rust] FULL-FRAME watermark filter: scaling to {}x{}, opacity={}, filter={}",
            wm_width, wm_height, opacity, filter
        );
        filter
    } else {
        // Calculate watermark width based on scale percentage of video width
        let wm_width = (video_width as f32 * (scale_pct as f32 / 100.0)) as u32;

        // Build the position string using X/Y percentages
        let position = get_watermark_overlay_position(pos_x, pos_y);

        let filter = format!(
            "[1:v]scale={}:-1,format=rgba,colorchannelmixer=aa={}[wm];[0:v][wm]overlay={}",
            wm_width, opacity, position
        );
        println!(
            "[Rust] STANDARD watermark filter: width={} ({}% of {}), pos=({}, {}), opacity={}, filter={}",
            wm_width, scale_pct, video_width, pos_x, pos_y, opacity_pct, filter
        );
        filter
    };

    // Create temporary output path
    let temp_output = input_path.with_extension("watermarked.mp4");

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    println!("[Rust] Watermark position: x={}%, y={}%", pos_x, pos_y);

    // Build encoder-specific args with hardware acceleration
    let mut args = build_hwaccel_args(&encoder, true);

    // Add main video input
    args.extend(vec![
        "-i".to_string(),
        input_path.to_string_lossy().to_string(),
    ]);

    // Add watermark input with loop flags if it's a video
    if is_video_file(watermark_file_path) {
        args.extend(vec![
            "-stream_loop".to_string(),
            "-1".to_string(), // Loop infinitely
            "-i".to_string(),
            watermark_file_path.clone(),
        ]);
    } else {
        args.extend(vec!["-i".to_string(), watermark_file_path.clone()]);
    }

    args.extend(vec![
        "-filter_complex".to_string(),
        filter_complex,
        "-shortest".to_string(), // Stop when shortest input ends
        "-c:v".to_string(),
        encoder.codec.clone(),
    ]);

    // Add preset if applicable
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    // Add common parameters
    args.extend_from_slice(&[
        "-c:a".to_string(),
        "copy".to_string(),
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        "-movflags".to_string(),
        "+faststart".to_string(),
        "-y".to_string(),
        temp_output.to_string_lossy().to_string(),
    ]);

    println!("[Rust] Applying watermark to video...");

    // Use fallback helper for hardware encoder resilience
    run_ffmpeg_with_fallback(app, args, &encoder, quality, None)
        .await
        .map_err(|e| format!("FFmpeg watermark failed: {}", e))?;

    // Replace original file with watermarked version
    std::fs::remove_file(input_path)
        .map_err(|e| format!("Failed to remove original file: {}", e))?;
    std::fs::rename(&temp_output, input_path)
        .map_err(|e| format!("Failed to rename watermarked file: {}", e))?;

    println!("[Rust] Watermark applied successfully");

    Ok(())
}

// Build single-segment clip with aspect ratio and quality settings
// Note: output_format is unused here because the path already has the correct extension
#[allow(clippy::too_many_arguments)]
pub async fn build_single_segment_clip_with_settings(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    subtitle_path: Option<&std::path::Path>,
    aspect_ratio: &AspectRatio,
    quality: &str,
    frame_rate: u32,
    _output_format: &str, // Format already applied in output_path extension
    intro_path: Option<&str>,
    outro_path: Option<&str>,
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>,
    watermark_settings: Option<&WatermarkSettings>,
    audio_settings: Option<&AudioSettings>,
    video_filter_segments: Option<&Vec<VideoFilterSegment>>,
    effects_filter_chain: Option<&str>,
    audio_effects_filter_chain: Option<&str>,
) -> Result<(), String> {
    let shell = app.shell();
    let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
    let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
    let duration = end_time - start_time;

    println!("[Rust] ===== SINGLE-SEGMENT FUNCTION ENTERED =====");
    println!(
        "[Rust] intro_path: {:?}, outro_path: {:?}",
        intro_path, outro_path
    );
    println!(
        "[Rust] Building single segment with aspect ratio {}:{}",
        aspect_ratio.width, aspect_ratio.height
    );

    // Get video info for cropping
    let video_info = get_video_info(app, video_path).await?;
    println!(
        "[Rust] Video info retrieved: {}x{}",
        video_info.width, video_info.height
    );
    let (crop_w, crop_h, crop_x, crop_y) =
        calculate_crop_params(video_info.width, video_info.height, aspect_ratio);

    // Get quality settings (unused in this path, but kept for reference)
    let (_preset, _crf) = get_quality_settings(quality);

    // Build combined video filter string (color grading + effects)
    // Filter times are relative to the output (0 = clip start), so we use the segments directly
    let video_filter_str =
        build_combined_filter_string(video_filter_segments, effects_filter_chain);

    // Build combined audio filter string (audio settings + audio effects)
    let audio_filter_str = build_combined_audio_filter(audio_settings, audio_effects_filter_chain);

    println!("[Rust] About to check intro/outro condition...");
    // If intro or outro is present, we need to use the concat approach
    if intro_path.is_some() || outro_path.is_some() {
        println!("[Rust] ===== INTRO/OUTRO PATH DETECTED =====");
        println!("[Rust] Intro or outro detected, using concat approach for single segment");

        // Get storage paths for temporary files
        let paths = crate::storage::init_storage_dirs()
            .map_err(|e| format!("Failed to get storage paths: {}", e))?;

        let temp_dir = paths
            .temp
            .join(format!("clip_single_segment_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;

        // Detect hardware encoder for better performance
        println!(
            "[Rust] ABOUT TO CALL detect_hardware_encoder (intro/outro path) with quality: {}",
            quality
        );
        let encoder = detect_hardware_encoder(app, quality).await;
        println!(
            "[Rust] RETURNED FROM detect_hardware_encoder (intro/outro path), codec: {}",
            encoder.codec
        );

        // Extract the main segment without subtitles (we'll add them later if needed)
        let segment_file = temp_dir.join("main_segment.mp4");

        // Build crop filter with optional time-based color grading
        let crop_filter = if let Some(ref filter_str) = video_filter_str {
            println!(
                "[Rust] Applying time-based video color filters in intro/outro path: {}",
                filter_str
            );
            format!(
                "crop={}:{}:{}:{},{}",
                crop_w, crop_h, crop_x, crop_y, filter_str
            )
        } else {
            format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y)
        };

        // Build encoder-specific args with hardware acceleration
        // Crop filter is CPU-based, so we disable GPU decode to avoid transfer overhead
        let mut args = build_hwaccel_args(&encoder, true);

        // Combined seeking: input seek (fast) to ~5s before, then output seek (accurate) to exact frame
        // This avoids both slow full-decode AND frozen/stuttering first frames
        let input_seek = (start_time - 5.0).max(0.0);
        let output_seek = start_time - input_seek;

        args.extend(vec![
            "-ss".to_string(),
            format!("{:.3}", input_seek),
            "-i".to_string(),
            video_path.to_string(),
            "-ss".to_string(),
            format!("{:.3}", output_seek),
            "-t".to_string(),
            format!("{:.3}", duration),
            "-vf".to_string(),
            crop_filter.clone(),
            "-c:v".to_string(),
            encoder.codec.clone(),
        ]);

        // Add preset if applicable
        if let Some(enc_preset) = &encoder.preset {
            args.push("-preset".to_string());
            args.push(enc_preset.clone());
        }

        // Add quality parameter
        args.push(encoder.quality_param.clone());
        args.push(encoder.quality_value.clone());

        // Force keyframe at start to prevent frozen/laggy frames
        args.extend_from_slice(&[
            "-g".to_string(),
            "60".to_string(),
            "-force_key_frames".to_string(),
            "expr:gte(t,0)".to_string(),
        ]);

        // Add audio filter if present
        if let Some(ref af) = audio_filter_str {
            args.push("-af".to_string());
            args.push(af.clone());
        }

        // Add common parameters
        // Use -fps_mode cfr to ensure constant frame rate and prevent black frames at start
        // Always re-encode audio to AAC with matching params so concat with intro/outro
        // produces a uniform audio stream (prevents missing audio on social platforms)
        args.extend_from_slice(&[
            "-fps_mode".to_string(),
            "cfr".to_string(),
            "-r".to_string(),
            frame_rate.to_string(),
            "-c:a".to_string(),
            "aac".to_string(),
            "-b:a".to_string(),
            "192k".to_string(),
            "-ar".to_string(),
            "48000".to_string(),
            "-ac".to_string(),
            "2".to_string(),
            "-pix_fmt".to_string(),
            "yuv420p".to_string(),
            "-avoid_negative_ts".to_string(),
            "make_zero".to_string(),
            "-y".to_string(),
            segment_file.to_string_lossy().to_string(),
        ]);

        // Use fallback helper for hardware encoder resilience
        run_ffmpeg_with_fallback(app, args, &encoder, quality, None)
            .await
            .map_err(|e| format!("Failed to extract segment: {}", e))?;

        // Apply watermark to the main segment BEFORE concatenation with intro/outro
        // This ensures the watermark only appears on the main content, not on intro/outro
        if let Some(wm) = watermark_settings {
            if wm.enabled {
                println!(
                    "[Rust] Applying watermark to main segment (before concat with intro/outro)"
                );
                let ar_str = aspect_ratio_to_string(aspect_ratio);
                apply_watermark_to_video_with_ratio(app, &segment_file, wm, quality, Some(&ar_str))
                    .await?;
            }
        }

        // Process intro and outro if provided
        let mut intro_file: Option<std::path::PathBuf> = None;
        let mut outro_file: Option<std::path::PathBuf> = None;

        if let Some(intro) = intro_path {
            println!("[Rust] Processing intro video...");
            intro_file = Some(
                prepare_intro_outro_for_concat(
                    app,
                    intro,
                    &temp_dir,
                    "intro",
                    aspect_ratio,
                    quality,
                    frame_rate,
                    crop_w,
                    crop_h,
                    intro_outro_cache.clone(),
                )
                .await?,
            );
        }

        if let Some(outro) = outro_path {
            println!("[Rust] Processing outro video...");
            outro_file = Some(
                prepare_intro_outro_for_concat(
                    app,
                    outro,
                    &temp_dir,
                    "outro",
                    aspect_ratio,
                    quality,
                    frame_rate,
                    crop_w,
                    crop_h,
                    intro_outro_cache.clone(),
                )
                .await?,
            );
        }

        // Create concat list file
        let concat_file = temp_dir.join("concat_list.txt");
        let mut concat_content = String::new();

        // Add intro if present
        if let Some(intro_path) = &intro_file {
            concat_content.push_str(&format!("file '{}'\n", intro_path.display()));
        }

        // Add main segment
        concat_content.push_str(&format!("file '{}'\n", segment_file.display()));

        // Add outro if present
        if let Some(outro_path) = &outro_file {
            concat_content.push_str(&format!("file '{}'\n", outro_path.display()));
        }

        std::fs::write(&concat_file, concat_content)
            .map_err(|e| format!("Failed to write concat file: {}", e))?;

        // Concatenate files
        let concat_output_path = if subtitle_path.is_some() {
            temp_dir.join("concat_output.mp4")
        } else {
            output_path.to_path_buf()
        };

        let output = shell
            .sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args([
                "-nostdin",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                concat_file.to_str().ok_or("Invalid concat file path")?,
                "-c",
                "copy",
                "-movflags",
                "+faststart",
                "-avoid_negative_ts",
                "make_zero",
                "-y",
                concat_output_path.to_str().ok_or("Invalid output path")?,
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to concatenate: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("FFmpeg concatenation failed: {}", stderr));
        }

        // If subtitles are present, burn them now
        if let Some(sub_path) = subtitle_path {
            println!("[Rust] Burning subtitles with hardware acceleration...");

            let sub_arg = sub_path
                .to_string_lossy()
                .replace("\\", "/")
                .replace(":", "\\:");

            // Build ass filter without fontsdir parameter to avoid path escaping issues
            // libass will use system fonts by default
            let vf_arg = format!("format=rgb24,ass='{}'", sub_arg);

            // Set fontconfig path for FFmpeg to find our custom fonts
            let fontconfig_path = paths.temp.join("fonts.conf");

            // Build encoder-specific args with hardware acceleration
            let mut subtitle_args = build_hwaccel_args(&encoder, true);

            subtitle_args.extend(vec![
                "-i".to_string(),
                concat_output_path.to_string_lossy().to_string(),
                "-vf".to_string(),
                vf_arg.clone(),
                "-c:v".to_string(),
                encoder.codec.clone(),
            ]);

            // Add preset if applicable
            if let Some(enc_preset) = &encoder.preset {
                subtitle_args.push("-preset".to_string());
                subtitle_args.push(enc_preset.clone());
            }

            // Add quality parameter
            subtitle_args.push(encoder.quality_param.clone());
            subtitle_args.push(encoder.quality_value.clone());

            // Add audio filter if audio settings or audio effects are provided
            if let Some(ref af) = audio_filter_str {
                println!("[Rust] Applying audio filter (with subtitles): {}", af);
                subtitle_args.push("-af".to_string());
                subtitle_args.push(af.clone());
            }

            // Add common parameters
            subtitle_args.extend_from_slice(&[
                "-c:a".to_string(),
                if audio_filter_str.is_none() {
                    "copy".to_string()
                } else {
                    "aac".to_string()
                },
                "-pix_fmt".to_string(),
                "yuv420p".to_string(),
                "-movflags".to_string(),
                "+faststart".to_string(),
                "-y".to_string(),
                output_path.to_string_lossy().to_string(),
            ]);

            if audio_filter_str.is_some() {
                subtitle_args.extend_from_slice(&["-b:a".to_string(), "192k".to_string()]);
            }

            // Add -nostdin to subtitle_args at the beginning
            subtitle_args.insert(0, "-nostdin".to_string());

            let output = shell
                .sidecar("ffmpeg")
                .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
                .env(
                    "FONTCONFIG_FILE",
                    fontconfig_path.to_string_lossy().to_string(),
                )
                .args(subtitle_args)
                .output()
                .await
                .map_err(|e| format!("Failed to burn subtitles: {}", e))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("FFmpeg subtitle burning failed: {}", stderr));
            }
        } else if audio_filter_str.is_some() {
            // No subtitles but audio settings/effects provided - need to apply audio filter
            // Re-encode with audio filter
            println!("[Rust] Applying audio filter (no subtitles, with intro/outro)...");

            if let Some(ref af) = audio_filter_str {
                let audio_args = vec![
                    "-nostdin".to_string(),
                    "-i".to_string(),
                    concat_output_path.to_string_lossy().to_string(),
                    "-c:v".to_string(),
                    "copy".to_string(),
                    "-af".to_string(),
                    af.clone(),
                    "-c:a".to_string(),
                    "aac".to_string(),
                    "-b:a".to_string(),
                    "192k".to_string(),
                    "-y".to_string(),
                    output_path.to_string_lossy().to_string(),
                ];

                let output = shell
                    .sidecar("ffmpeg")
                    .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
                    .args(audio_args)
                    .output()
                    .await
                    .map_err(|e| format!("Failed to apply audio filter: {}", e))?;

                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("FFmpeg audio filter failed: {}", stderr));
                }
            }
        }

        // Clean up temporary files
        let _ = std::fs::remove_dir_all(&temp_dir);

        // Note: Watermark was already applied to main segment before concat
        // (so it doesn't appear on intro/outro)

        return Ok(());
    }

    // Original single-segment path (no intro/outro)
    // Detect hardware encoder for better performance
    println!(
        "[Rust] ABOUT TO CALL detect_hardware_encoder with quality: {}",
        quality
    );
    let encoder = detect_hardware_encoder(app, quality).await;
    println!(
        "[Rust] RETURNED FROM detect_hardware_encoder, codec: {}",
        encoder.codec
    );

    // Get fonts directory for subtitle rendering
    let fonts_dir = get_fonts_dir(app).ok();

    // Build video filter combining crop + color grading + subtitles in ONE PASS
    // Only Force RGB24 if using subtitles for accurate color rendering
    let mut vf_parts = Vec::new();

    // Only add crop filter if actual cropping is needed
    let needs_crop =
        crop_w != video_info.width || crop_h != video_info.height || crop_x != 0 || crop_y != 0;
    if needs_crop {
        println!(
            "[Rust] Crop needed: {}x{} from {}x{} at ({}, {})",
            crop_w, crop_h, video_info.width, video_info.height, crop_x, crop_y
        );
        vf_parts.push(format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y));
    } else {
        println!("[Rust] No crop needed - video already matches target aspect ratio");
    }

    // Apply time-based color grading filters (eq, hue, vignette, etc.) after crop
    if let Some(ref filter_str) = video_filter_str {
        println!(
            "[Rust] Applying time-based video color filters: {}",
            filter_str
        );
        vf_parts.push(filter_str.clone());
    }

    if let Some(path) = subtitle_path {
        vf_parts.push("format=rgb24".to_string());

        let path_str = path
            .to_string_lossy()
            .replace("\\", "/")
            .replace(":", "\\:");
        // Add fonts directory parameter to ass filter
        if let Some(ref fdir) = fonts_dir {
            let fonts_dir_str = fdir
                .to_string_lossy()
                .replace("\\", "/")
                .replace(":", "\\:");
            vf_parts.push(format!("ass='{}':fontsdir='{}'", path_str, fonts_dir_str));
        } else {
            vf_parts.push(format!("ass='{}'", path_str));
        }
    }

    // Determine if we're using CPU filters
    let uses_cpu_filters = !vf_parts.is_empty();

    // Build encoder-specific args with hardware acceleration
    let mut args = build_hwaccel_args(&encoder, uses_cpu_filters);

    // Combined seeking: input seek (fast) to ~5s before, then output seek (accurate) to exact frame
    // This avoids both slow full-decode AND frozen/stuttering first frames
    let input_seek = (start_time - 5.0).max(0.0);
    let output_seek = start_time - input_seek;

    args.extend(vec![
        "-ss".to_string(),
        format!("{:.3}", input_seek),
        "-i".to_string(),
        video_path.to_string(),
        "-ss".to_string(),
        format!("{:.3}", output_seek),
        "-t".to_string(),
        format!("{:.3}", duration),
    ]);

    // Only add -vf if we have filters to apply
    if !vf_parts.is_empty() {
        let vf_arg = vf_parts.join(",");
        args.push("-vf".to_string());
        args.push(vf_arg);
    }

    args.extend(vec!["-c:v".to_string(), encoder.codec.clone()]);

    // Add preset if applicable
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    // Force keyframe at start to prevent frozen/laggy frames
    // GOP size of 60 frames = 1 keyframe per second at 60fps
    args.extend_from_slice(&[
        "-g".to_string(),
        "60".to_string(),
        "-force_key_frames".to_string(),
        "expr:gte(t,0)".to_string(),
    ]);

    // Add audio filter if audio settings or audio effects are provided
    if let Some(ref af) = audio_filter_str {
        println!("[Rust] Applying audio filter: {}", af);
        args.push("-af".to_string());
        args.push(af.clone());
    }

    let copy_audio = audio_filter_str.is_none();

    // Add common parameters
    // Use -fps_mode cfr to ensure constant frame rate and prevent black frames at start
    // when using input seeking with crop/filter operations
    args.extend_from_slice(&[
        "-fps_mode".to_string(),
        "cfr".to_string(),
        "-r".to_string(),
        frame_rate.to_string(),
    ]);
    if copy_audio {
        args.extend_from_slice(&["-c:a".to_string(), "copy".to_string()]);
    } else {
        args.extend_from_slice(&[
            "-c:a".to_string(),
            "aac".to_string(),
            "-b:a".to_string(),
            "192k".to_string(),
        ]);
    }
    args.extend_from_slice(&[
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        "-movflags".to_string(),
        "+faststart".to_string(),
        "-avoid_negative_ts".to_string(),
        "make_zero".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    // Set fontconfig path for FFmpeg to find our custom fonts
    let fontconfig_path = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?
        .temp
        .join("fonts.conf");

    // Use fallback helper for hardware encoder resilience
    let env_vars = vec![(
        "FONTCONFIG_FILE",
        fontconfig_path.to_string_lossy().to_string(),
    )];
    run_ffmpeg_with_fallback(app, args, &encoder, quality, Some(env_vars))
        .await
        .map_err(|e| format!("FFmpeg failed: {}", e))?;

    // Apply watermark if enabled (after all other processing)
    if let Some(wm) = watermark_settings {
        if wm.enabled {
            let ar_str = aspect_ratio_to_string(aspect_ratio);
            apply_watermark_to_video_with_ratio(app, output_path, wm, quality, Some(&ar_str))
                .await?;
        }
    }

    Ok(())
}

// Build multi-segment clip with aspect ratio and quality settings
// Note: output_format is unused here because the path already has the correct extension
#[allow(clippy::too_many_arguments)]
pub async fn build_multi_segment_clip_with_settings(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segments: &[serde_json::Value],
    subtitle_path: Option<&std::path::Path>,
    aspect_ratio: &AspectRatio,
    quality: &str,
    frame_rate: u32,
    _output_format: &str, // Format already applied in output_path extension
    intro_path: Option<&str>,
    outro_path: Option<&str>,
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>,
    watermark_settings: Option<&WatermarkSettings>,
    audio_settings: Option<&AudioSettings>,
    video_filter_segments: Option<&Vec<VideoFilterSegment>>,
    effects_filter_chain: Option<&str>,
) -> Result<(), String> {
    let shell = app.shell();

    // Get storage paths for temporary files
    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let temp_dir = paths
        .temp
        .join(format!("clip_segments_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    println!(
        "[Rust] Building {} segments with aspect ratio {}:{}",
        segments.len(),
        aspect_ratio.width,
        aspect_ratio.height
    );

    // Get video info for cropping
    let video_info = get_video_info(app, video_path).await?;
    let (crop_w, crop_h, crop_x, crop_y) =
        calculate_crop_params(video_info.width, video_info.height, aspect_ratio);

    // Get quality settings (unused in this path, but kept for reference)
    let (_preset, _crf) = get_quality_settings(quality);

    // Detect hardware encoder for better performance
    println!(
        "[Rust] ===== MULTI-SEGMENT PATH DETECTED ({} segments) =====",
        segments.len()
    );
    println!(
        "[Rust] ABOUT TO CALL detect_hardware_encoder (multi-segment path) with quality: {}",
        quality
    );
    let encoder = detect_hardware_encoder(app, quality).await;
    println!(
        "[Rust] RETURNED FROM detect_hardware_encoder (multi-segment path), codec: {}",
        encoder.codec
    );

    // Calculate output time offsets for each segment (used for time-based filters)
    // Each segment's filters need to be adjusted relative to where it appears in the final output
    let mut segment_output_offsets: Vec<f64> = Vec::new();
    let mut cumulative_duration = 0.0;
    for segment in segments {
        segment_output_offsets.push(cumulative_duration);
        let start_time: f64 = segment["start_time"].as_f64().unwrap_or(0.0);
        let end_time: f64 = segment["end_time"].as_f64().unwrap_or(0.0);
        cumulative_duration += end_time - start_time;
    }

    // Extract segments with cropping IN PARALLEL for speed
    // Each segment gets its own filter with time-adjusted enable expressions
    println!(
        "[Rust] Extracting {} segments in parallel with time-based filters...",
        segments.len()
    );
    let segment_tasks: Vec<_> = segments
        .iter()
        .enumerate()
        .map(|(i, segment)| {
            let start_time: f64 = segment["start_time"].as_f64().unwrap_or(0.0);
            let end_time: f64 = segment["end_time"].as_f64().unwrap_or(0.0);
            let duration = end_time - start_time;
            let segment_file = temp_dir.join(format!("segment_{:03}.mp4", i));
            let video_path = video_path.to_string();
            let app = app.clone();
            let encoder = encoder.clone();
            let quality = quality.to_string();
            let frame_rate_str = frame_rate.to_string();
            let output_offset = segment_output_offsets[i];
            let effects_filter = effects_filter_chain.map(|s| s.to_string());

            // Get filters that overlap with this segment's output time range
            // and adjust their times to be relative to this segment (starting at 0)
            let segment_filter_str = if let Some(filter_segments) = video_filter_segments {
                let overlapping = get_overlapping_filter_segments(
                    Some(filter_segments),
                    output_offset,
                    output_offset + duration,
                );
                if let Some(ref segs) = overlapping {
                    build_time_based_filter_string(segs)
                } else {
                    None
                }
            } else {
                None
            };

            // Combine segment filters with effects filter chain
            let combined_filter_str = match (&segment_filter_str, &effects_filter) {
                (Some(sf), Some(ef)) => Some(format!("{},{}", sf, ef)),
                (Some(sf), None) => Some(sf.clone()),
                (None, Some(ef)) => Some(ef.clone()),
                (None, None) => None,
            };

            // Build crop filter with optional time-based color grading and effects for this segment
            let crop_filter = if let Some(ref filter_str) = combined_filter_str {
                format!(
                    "crop={}:{}:{}:{},{}",
                    crop_w, crop_h, crop_x, crop_y, filter_str
                )
            } else {
                format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y)
            };

            if segment_filter_str.is_some() {
                println!("[Rust] Segment {} has time-based filters applied", i);
            }

            // Check if audio should be muted for this segment
            let mute_audio = segment["mute_audio"].as_bool().unwrap_or(false);

            async move {
                let _shell = app.shell();

                // Build encoder-specific args with hardware acceleration
                let mut args = build_hwaccel_args(&encoder, true);

                // Combined seeking: input seek (fast) to ~5s before, then output seek (accurate)
                let input_seek = (start_time - 5.0).max(0.0);
                let output_seek = start_time - input_seek;

                args.extend(vec![
                    "-ss".to_string(),
                    format!("{:.3}", input_seek),
                    "-i".to_string(),
                    video_path.clone(),
                    "-ss".to_string(),
                    format!("{:.3}", output_seek),
                    "-t".to_string(),
                    format!("{:.3}", duration),
                    "-vf".to_string(),
                    crop_filter.clone(),
                    "-c:v".to_string(),
                    encoder.codec.clone(),
                ]);

                // Add preset if applicable
                if let Some(preset) = &encoder.preset {
                    args.push("-preset".to_string());
                    args.push(preset.clone());
                }

                // Add quality parameter
                args.push(encoder.quality_param.clone());
                args.push(encoder.quality_value.clone());

                // Force keyframe at start to prevent frozen/laggy frames at segment boundaries
                args.extend_from_slice(&[
                    "-g".to_string(),
                    "60".to_string(),
                    "-force_key_frames".to_string(),
                    "expr:gte(t,0)".to_string(),
                ]);

                // Add audio parameters (mute if audio was extracted)
                // Always re-encode to AAC so all segments have uniform codec for clean concat
                if mute_audio {
                    args.extend_from_slice(&[
                        "-an".to_string(), // No audio
                    ]);
                } else {
                    args.extend_from_slice(&[
                        "-c:a".to_string(),
                        "aac".to_string(),
                        "-b:a".to_string(),
                        "192k".to_string(),
                        "-ar".to_string(),
                        "48000".to_string(),
                        "-ac".to_string(),
                        "2".to_string(),
                    ]);
                }

                // Add common parameters
                // Use -fps_mode cfr to ensure constant frame rate and prevent black frames at start
                args.extend_from_slice(&[
                    "-fps_mode".to_string(),
                    "cfr".to_string(),
                    "-r".to_string(),
                    frame_rate_str.clone(),
                    "-pix_fmt".to_string(),
                    "yuv420p".to_string(),
                    "-avoid_negative_ts".to_string(),
                    "make_zero".to_string(),
                    "-y".to_string(),
                    segment_file.to_string_lossy().to_string(),
                ]);

                // Use fallback helper for hardware encoder resilience
                run_ffmpeg_with_fallback(&app, args, &encoder, &quality, None)
                    .await
                    .map_err(|e| format!("Failed to extract segment {}: {}", i, e))?;

                Ok::<std::path::PathBuf, String>(segment_file)
            }
        })
        .collect();

    // Wait for all segments to complete in parallel
    let segment_results = join_all(segment_tasks).await;

    // Check for errors and collect successful segment files
    let mut segment_files = Vec::new();
    for (i, result) in segment_results.into_iter().enumerate() {
        match result {
            Ok(path) => segment_files.push(path),
            Err(e) => return Err(format!("Segment {} failed: {}", i, e)),
        }
    }

    println!(
        "[Rust] All {} segments extracted successfully",
        segment_files.len()
    );

    // Apply watermark to each segment BEFORE concatenation with intro/outro
    // This ensures the watermark only appears on the main content, not on intro/outro
    if let Some(wm) = watermark_settings {
        if wm.enabled {
            println!(
                "[Rust] Applying watermark to {} segments (before concat with intro/outro)",
                segment_files.len()
            );
            let ar_str = aspect_ratio_to_string(aspect_ratio);
            for segment_file in &segment_files {
                apply_watermark_to_video_with_ratio(app, segment_file, wm, quality, Some(&ar_str))
                    .await?;
            }
        }
    }

    // Process intro and outro if provided
    let mut intro_file: Option<std::path::PathBuf> = None;
    let mut outro_file: Option<std::path::PathBuf> = None;

    if let Some(intro) = intro_path {
        println!("[Rust] Processing intro video...");
        intro_file = Some(
            prepare_intro_outro_for_concat(
                app,
                intro,
                &temp_dir,
                "intro",
                aspect_ratio,
                quality,
                frame_rate,
                crop_w,
                crop_h,
                intro_outro_cache.clone(),
            )
            .await?,
        );
    }

    if let Some(outro) = outro_path {
        println!("[Rust] Processing outro video...");
        outro_file = Some(
            prepare_intro_outro_for_concat(
                app,
                outro,
                &temp_dir,
                "outro",
                aspect_ratio,
                quality,
                frame_rate,
                crop_w,
                crop_h,
                intro_outro_cache.clone(),
            )
            .await?,
        );
    }

    // Create concat list file with intro, segments, and outro
    let concat_file = temp_dir.join("concat_list.txt");
    let mut concat_content = String::new();

    // Add intro if present
    if let Some(intro_path) = &intro_file {
        concat_content.push_str(&format!("file '{}'\n", intro_path.display()));
    }

    // Add main clip segments
    for segment_file in &segment_files {
        concat_content.push_str(&format!("file '{}'\n", segment_file.display()));
    }

    // Add outro if present
    if let Some(outro_path) = &outro_file {
        concat_content.push_str(&format!("file '{}'\n", outro_path.display()));
    }

    std::fs::write(&concat_file, concat_content)
        .map_err(|e| format!("Failed to write concat file: {}", e))?;

    // Concatenate segments
    let concat_output_path = if subtitle_path.is_some() {
        temp_dir.join("concat_output.mp4")
    } else {
        output_path.to_path_buf()
    };

    let output = shell
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-nostdin",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            concat_file.to_str().ok_or("Invalid concat file path")?,
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            "-avoid_negative_ts",
            "make_zero",
            "-y",
            concat_output_path.to_str().ok_or("Invalid output path")?,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to concatenate segments: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg concatenation failed: {}", stderr));
    }

    // If subtitles are present, burn them now with hardware acceleration
    if let Some(sub_path) = subtitle_path {
        println!("[Rust] Burning subtitles with hardware acceleration...");

        let sub_arg = sub_path
            .to_string_lossy()
            .replace("\\", "/")
            .replace(":", "\\:");

        // Build ass filter without fontsdir parameter to avoid path escaping issues
        // Force RGB24 for accurate subtitle color rendering
        // libass will use system fonts by default
        let vf_arg = format!("format=rgb24,ass='{}'", sub_arg);

        // Set fontconfig path for FFmpeg to find our custom fonts
        let fontconfig_path = paths.temp.join("fonts.conf");

        // Build encoder-specific args with hardware acceleration
        let mut subtitle_args = build_hwaccel_args(&encoder, true);

        subtitle_args.extend(vec![
            "-i".to_string(),
            concat_output_path.to_string_lossy().to_string(),
            "-vf".to_string(),
            vf_arg.clone(),
            "-c:v".to_string(),
            encoder.codec.clone(),
        ]);

        // Add preset if applicable
        if let Some(enc_preset) = &encoder.preset {
            subtitle_args.push("-preset".to_string());
            subtitle_args.push(enc_preset.clone());
        }

        // Add quality parameter
        subtitle_args.push(encoder.quality_param.clone());
        subtitle_args.push(encoder.quality_value.clone());

        let audio_filter = build_audio_filter(audio_settings);
        let copy_audio = audio_filter.is_none();

        // Add audio filter if audio settings are provided
        if let Some(af) = audio_filter {
            println!(
                "[Rust] Applying audio filter (multi-segment with subtitles): {}",
                af
            );
            subtitle_args.push("-af".to_string());
            subtitle_args.push(af);
        }

        // Add common parameters
        subtitle_args.extend_from_slice(&[
            "-c:a".to_string(),
            if copy_audio {
                "copy".to_string()
            } else {
                "aac".to_string()
            },
            "-pix_fmt".to_string(),
            "yuv420p".to_string(),
            "-movflags".to_string(),
            "+faststart".to_string(),
            "-y".to_string(),
            output_path.to_string_lossy().to_string(),
        ]);
        if !copy_audio {
            subtitle_args.extend_from_slice(&["-b:a".to_string(), "192k".to_string()]);
        }

        // Add -nostdin to subtitle_args at the beginning
        subtitle_args.insert(0, "-nostdin".to_string());

        let output = shell
            .sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .env(
                "FONTCONFIG_FILE",
                fontconfig_path.to_string_lossy().to_string(),
            )
            .args(subtitle_args)
            .output()
            .await
            .map_err(|e| format!("Failed to burn subtitles: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("FFmpeg subtitle burning failed: {}", stderr));
        }
    } else if audio_settings.is_some() {
        // No subtitles but audio settings provided - need to apply audio filter
        println!("[Rust] Applying audio filter (multi-segment, no subtitles)...");

        if let Some(af) = build_audio_filter(audio_settings) {
            let audio_args = vec![
                "-nostdin".to_string(),
                "-i".to_string(),
                concat_output_path.to_string_lossy().to_string(),
                "-c:v".to_string(),
                "copy".to_string(),
                "-af".to_string(),
                af.clone(),
                "-c:a".to_string(),
                "aac".to_string(),
                "-b:a".to_string(),
                "192k".to_string(),
                "-y".to_string(),
                output_path.to_string_lossy().to_string(),
            ];

            let output = shell
                .sidecar("ffmpeg")
                .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
                .args(audio_args)
                .output()
                .await
                .map_err(|e| format!("Failed to apply audio filter: {}", e))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("FFmpeg audio filter failed: {}", stderr));
            }
        }
    }

    // Clean up temporary files
    let _ = std::fs::remove_dir_all(&temp_dir);
    println!("[Rust] Multi-segment build successful, cleaned up temp files");

    // Note: Watermark was already applied to segments before concat
    // (so it doesn't appear on intro/outro)

    Ok(())
}

// Helper function to prepare intro/outro for concatenation with the main clip
// This processes the intro/outro to match the aspect ratio, frame rate, and resolution
// Includes caching to avoid re-processing the same intro/outro multiple times
#[allow(clippy::too_many_arguments)]
pub async fn prepare_intro_outro_for_concat(
    app: &tauri::AppHandle,
    intro_outro_path: &str,
    temp_dir: &std::path::Path,
    file_prefix: &str,
    aspect_ratio: &AspectRatio,
    quality: &str,
    frame_rate: u32,
    crop_w: u32,
    crop_h: u32,
    cache: Arc<Mutex<IntroOutroCache>>,
) -> Result<std::path::PathBuf, String> {
    // Create cache key based on all relevant parameters
    let cache_key = (
        intro_outro_path.to_string(),
        format!("{}:{}", aspect_ratio.width, aspect_ratio.height),
        frame_rate,
        crop_w,
        crop_h,
    );

    // Check if already processed in this build session
    {
        let cache_lock = cache.lock().unwrap();
        if let Some(cached_path) = cache_lock.get(&cache_key) {
            if cached_path.exists() {
                println!(
                    "[Rust] Using cached {} from: {}",
                    file_prefix,
                    cached_path.display()
                );
                return Ok(cached_path.clone());
            }
        }
    } // Lock is dropped here before any await points

    let _shell = app.shell();
    println!(
        "[Rust] Preparing {} for concat with aspect ratio {}:{}",
        file_prefix, aspect_ratio.width, aspect_ratio.height
    );

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Create output path in temp directory
    let output_path = temp_dir.join(format!("{}_processed.mp4", file_prefix));

    // Build scale + pad filter to fit intro/outro within target dimensions
    // This maintains aspect ratio and adds black bars if needed (letterbox/pillarbox)
    // Use trunc(iw/2)*2 to force even dimensions — scale with force_original_aspect_ratio=decrease
    // can round up by 1px, causing pad to fail with "padded dimensions cannot be smaller than input"
    let scale_pad_filter = format!(
        "scale={}:{}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black",
        crop_w, crop_h, crop_w, crop_h
    );

    // Build encoder-specific args with hardware acceleration
    let mut args = build_hwaccel_args(&encoder, true);

    args.extend(vec![
        "-i".to_string(),
        intro_outro_path.to_string(),
        "-vf".to_string(),
        scale_pad_filter,
        "-c:v".to_string(),
        encoder.codec.clone(),
    ]);

    // Add preset if applicable
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    // Force keyframe at start to prevent frozen/laggy frames at concat boundaries
    args.extend_from_slice(&[
        "-g".to_string(),
        "60".to_string(),
        "-force_key_frames".to_string(),
        "expr:gte(t,0)".to_string(),
    ]);

    // Add common parameters
    // Use -fps_mode cfr to ensure constant frame rate and prevent black frames at start
    // aresample=async=1 fixes A/V sync by forcing audio samples to align with video PTS
    // (intro/outro files often have non-zero audio start PTS that causes delay after concat)
    args.extend_from_slice(&[
        "-fps_mode".to_string(),
        "cfr".to_string(),
        "-r".to_string(),
        frame_rate.to_string(),
        "-af".to_string(),
        "aresample=async=1".to_string(),
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        "192k".to_string(),
        "-ar".to_string(),
        "48000".to_string(),
        "-ac".to_string(),
        "2".to_string(),
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        "-avoid_negative_ts".to_string(),
        "make_zero".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    // Process the intro/outro with fallback helper for hardware encoder resilience
    run_ffmpeg_with_fallback(app, args, &encoder, quality, None)
        .await
        .map_err(|e| format!("FFmpeg failed to process {}: {}", file_prefix, e))?;

    println!(
        "[Rust] Successfully processed {} to: {}",
        file_prefix,
        output_path.display()
    );

    // Cache the result (lock only for the insertion)
    {
        let mut cache_lock = cache.lock().unwrap();
        cache_lock.insert(cache_key, output_path.clone());
    }

    Ok(output_path)
}

// ============================================================================
// SPEAKER-AWARE FRAMING BUILDERS
// ============================================================================
// These functions are used when the client passes a FramingStrategy
// from the server's speaker detection API. They enable:
// - Split screen exports (gaming/screen share content)
// - Dynamic panning (IRL/mobile content)
// - Static centered crop (talking head content)
//
// Integration: The orchestrator calls `build_clip_with_framing_strategy`
// when a FramingStrategy is available for portrait (9:16) exports.
// ============================================================================

use super::types::{FramingMode, FramingStrategy, ManualFramingConfig, PanKeyframe};

/// Builds a split screen clip with two video regions stacked vertically.
///
/// This is used for gaming/screen share content where the speaker is in one corner
/// and the main content (gameplay, presentation) occupies the rest of the frame.
///
/// The resulting video has:
/// - Top region: Content area (e.g., gameplay)
/// - Bottom region: Speaker area
#[allow(clippy::too_many_arguments)]
pub async fn build_split_screen_clip(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    strategy: &FramingStrategy,
    target_aspect_ratio: &str, // Target aspect ratio (e.g., "9:16", "4:5", "1:1")
    quality: &str,
    frame_rate: u32,
    audio_settings: Option<&AudioSettings>,
    video_filter_segments: Option<&Vec<VideoFilterSegment>>,
    effects_filter_chain: Option<&str>,
) -> Result<(), String> {
    // Build combined filter string (color grading + effects)
    let video_filter_str =
        build_combined_filter_string(video_filter_segments, effects_filter_chain);
    let _shell = app.shell();
    let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
    let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
    let duration = end_time - start_time;

    let layout = strategy
        .layout
        .as_ref()
        .ok_or("Split screen strategy missing layout configuration")?;

    // Parse target aspect ratio from parameter
    let aspect =
        parse_aspect_ratio_string(target_aspect_ratio).unwrap_or(super::types::AspectRatio {
            width: 9.0,
            height: 16.0,
        });

    println!(
        "[Rust] Building split screen clip with ratio: {}, aspect: {}:{}",
        layout.split_ratio, aspect.width, aspect.height
    );

    // Get video info for pixel calculations
    let video_info = get_video_info(app, video_path).await?;
    let source_w = video_info.width as f64;
    let source_h = video_info.height as f64;

    // Calculate output dimensions based on target aspect ratio
    // Use 1080 as base width, calculate height from aspect ratio
    // Ensure dimensions are even (required by H.264/libx264)
    let output_w: u32 = 1080;
    let output_h: u32 = make_even(((output_w as f32) * aspect.height / aspect.width) as u32);

    // Calculate heights for each split region in the output (ensure even for H.264)
    let top_output_height = make_even((output_h as f64 * layout.split_ratio) as u32);
    let bottom_output_height = make_even(output_h - top_output_height);

    // Calculate the CORRECT aspect ratio for each split region
    // This is crucial - each split has its own aspect ratio, not the overall 9:16
    let top_split_aspect = output_w as f64 / top_output_height as f64;
    let bottom_split_aspect = output_w as f64 / bottom_output_height as f64;

    println!(
        "[Rust] Top split aspect: {:.4} ({}x{})",
        top_split_aspect, output_w, top_output_height
    );
    println!(
        "[Rust] Bottom split aspect: {:.4} ({}x{})",
        bottom_split_aspect, output_w, bottom_output_height
    );

    // Get normalized crop regions from the layout
    let top_crop = &layout.top_region;
    let bottom_crop = &layout.bottom_region;

    // Calculate top region center point (from normalized coords)
    // Use the center point from the crop region (calculated intelligently by Elixir)
    let top_center_x = top_crop.x + top_crop.width / 2.0;
    let top_center_y = top_crop.y + top_crop.height / 2.0;

    // Calculate bottom region center point (speaker position)
    let bottom_center_x = bottom_crop.x + bottom_crop.width / 2.0;
    let bottom_center_y = bottom_crop.y + bottom_crop.height / 2.0;

    // Calculate crop dimensions that maintain the correct aspect ratio for each split
    // Top region: crop from source with aspect ratio matching top_split_aspect
    // Use full available area (no zoom constraint)
    let (top_crop_w, top_crop_h, top_x, top_y) = calculate_aspect_preserving_crop(
        source_w as u32,
        source_h as u32,
        top_split_aspect,
        top_center_x,
        top_center_y,
    );

    // Bottom region: crop from source with aspect ratio matching bottom_split_aspect
    // Use the width/height from layout as maximum bounds to zoom into facecam
    // CRITICAL: Always maintain exact aspect ratio - never stretch!
    // For facecam, we want aggressive zooming - apply constraint if crop size is smaller than full frame
    let (bottom_crop_w, bottom_crop_h, bottom_x, bottom_y) = if bottom_crop.width > 0.0
        && bottom_crop.height > 0.0
        && (bottom_crop.width < 0.8 || bottom_crop.height < 0.8)
    {
        // Layout specifies a zoomed crop size - use it as constraint
        // The Elixir server has calculated the estimated facecam window size and sent it as
        // normalized width/height values that should fit the entire facecam window
        let max_w_norm = bottom_crop.width;
        let max_h_norm = bottom_crop.height;

        // Elixir now calculates a tight, face-centered crop with proper aspect ratio
        // We should use those dimensions directly - they already have adequate padding
        // and the correct aspect ratio for the bottom split

        // Convert normalized constraint dimensions to pixels
        let constraint_w = (source_w * max_w_norm) as u32;
        let constraint_h = (source_h * max_h_norm) as u32;

        // The Elixir-provided dimensions should already have the correct aspect ratio
        // But verify and adjust if needed to match bottom_split_aspect exactly
        let current_aspect = constraint_w as f64 / constraint_h as f64;

        let (final_w, final_h) = if (current_aspect - bottom_split_aspect).abs() < 0.01 {
            // Aspect ratio is already correct, use as-is
            (constraint_w, constraint_h)
        } else if current_aspect > bottom_split_aspect {
            // Crop is too wide - use width, calculate tighter height
            let h = (constraint_w as f64 / bottom_split_aspect) as u32;
            (constraint_w, h)
        } else {
            // Crop is too tall - use height, calculate tighter width
            let w = (constraint_h as f64 * bottom_split_aspect) as u32;
            (w, constraint_h)
        };

        // Ensure we don't exceed source dimensions
        let final_w = final_w.min(source_w as u32);
        let final_h = final_h.min(source_h as u32);

        println!(
            "[Rust] Using constraint-based crop for facecam zoom: {}x{} (from norm: {}x{})",
            final_w, final_h, max_w_norm, max_h_norm
        );

        // Recalculate position to center on speaker with new dimensions
        let center_x_px = (source_w * bottom_center_x) as i32;
        let center_y_px = (source_h * bottom_center_y) as i32;

        let mut final_x = center_x_px - (final_w as i32 / 2);
        let mut final_y = center_y_px - (final_h as i32 / 2);

        // Clamp to valid range
        let source_w_u32 = source_w as u32;
        let source_h_u32 = source_h as u32;
        final_x = final_x
            .max(0)
            .min((source_w_u32.saturating_sub(final_w)) as i32);
        final_y = final_y
            .max(0)
            .min((source_h_u32.saturating_sub(final_h)) as i32);

        (final_w, final_h, final_x as u32, final_y as u32)
    } else {
        // No zoom constraint - use normal aspect-preserving crop
        calculate_aspect_preserving_crop(
            source_w as u32,
            source_h as u32,
            bottom_split_aspect,
            bottom_center_x,
            bottom_center_y,
        )
    };

    println!(
        "[Rust] Top crop: {}x{} at ({},{})",
        top_crop_w, top_crop_h, top_x, top_y
    );
    println!(
        "[Rust] Bottom crop: {}x{} at ({},{})",
        bottom_crop_w, bottom_crop_h, bottom_x, bottom_y
    );

    // Build complex filter for split screen
    // Each crop maintains the correct aspect ratio for its output region
    // Use force_original_aspect_ratio=decrease to prevent stretching - crop to fit instead

    // Add time-based color grading filter if present (applied after vstack)
    if video_filter_str.is_some() {
        println!(
            "[Rust] Applying time-based video color filters in split screen: {:?}",
            video_filter_str
        );
    }

    let filter_complex = if let Some(ref color_filter) = video_filter_str {
        format!(
            "[0:v]split=2[top_src][bottom_src];\
            [top_src]crop={}:{}:{}:{},scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black[top];\
            [bottom_src]crop={}:{}:{}:{},scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black[bottom];\
            [top][bottom]vstack=inputs=2,{}[outv]",
            top_crop_w, top_crop_h, top_x, top_y, output_w, top_output_height, output_w, top_output_height,
            bottom_crop_w, bottom_crop_h, bottom_x, bottom_y, output_w, bottom_output_height, output_w, bottom_output_height,
            color_filter
        )
    } else {
        format!(
            "[0:v]split=2[top_src][bottom_src];\
            [top_src]crop={}:{}:{}:{},scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black[top];\
            [bottom_src]crop={}:{}:{}:{},scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black[bottom];\
            [top][bottom]vstack=inputs=2[outv]",
            top_crop_w, top_crop_h, top_x, top_y, output_w, top_output_height, output_w, top_output_height,
            bottom_crop_w, bottom_crop_h, bottom_x, bottom_y, output_w, bottom_output_height, output_w, bottom_output_height
        )
    };

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Build FFmpeg args with hardware acceleration
    // filter_complex uses CPU filters, so disable GPU decode
    let mut args = build_hwaccel_args(&encoder, true);

    // Combined seeking: input seek (fast) to ~5s before, then output seek (accurate)
    let input_seek = (start_time - 5.0).max(0.0);
    let output_seek = start_time - input_seek;

    args.extend(vec![
        "-ss".to_string(),
        format!("{:.3}", input_seek),
        "-i".to_string(),
        video_path.to_string(),
        "-ss".to_string(),
        format!("{:.3}", output_seek),
        "-t".to_string(),
        format!("{:.3}", duration),
        "-filter_complex".to_string(),
        filter_complex,
        "-map".to_string(),
        "[outv]".to_string(),
        "-map".to_string(),
        "0:a?".to_string(),
        "-c:v".to_string(),
        encoder.codec.clone(),
    ]);

    // Add encoder preset
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    let audio_filter = build_audio_filter(audio_settings);
    let copy_audio = audio_filter.is_none();

    // Add audio filter if settings provided
    if let Some(af) = audio_filter {
        args.push("-af".to_string());
        args.push(af);
    }

    // Common output parameters
    // Use -fps_mode cfr to ensure constant frame rate and prevent black frames at start
    // when using input seeking with complex filter graphs
    args.extend_from_slice(&[
        "-fps_mode".to_string(),
        "cfr".to_string(),
        "-r".to_string(),
        frame_rate.to_string(),
        "-c:a".to_string(),
        if copy_audio {
            "copy".to_string()
        } else {
            "aac".to_string()
        },
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        "-movflags".to_string(),
        "+faststart".to_string(),
        "-avoid_negative_ts".to_string(),
        "make_zero".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);
    if !copy_audio {
        args.extend_from_slice(&["-b:a".to_string(), "192k".to_string()]);
    }

    println!("[Rust] Running split screen FFmpeg command...");

    // Use fallback helper for hardware encoder resilience
    run_ffmpeg_with_fallback(app, args, &encoder, quality, None)
        .await
        .map_err(|e| format!("FFmpeg split screen failed: {}", e))?;

    println!("[Rust] Split screen clip built successfully");
    Ok(())
}

/// Parses an aspect ratio string (e.g., "9:16", "1:1", "4:5") into an AspectRatio struct.
fn parse_aspect_ratio_string(ratio_str: &str) -> Option<super::types::AspectRatio> {
    let parts: Vec<&str> = ratio_str.split(':').collect();
    if parts.len() != 2 {
        return None;
    }

    let width: f32 = parts[0].parse().ok()?;
    let height: f32 = parts[1].parse().ok()?;

    Some(super::types::AspectRatio { width, height })
}

/// Calculates crop dimensions that preserve a target aspect ratio, centered on a point.
///
/// Given source dimensions, target aspect ratio, and a center point (normalized 0-1),
/// returns (crop_width, crop_height, crop_x, crop_y) in pixels.
fn calculate_aspect_preserving_crop(
    source_w: u32,
    source_h: u32,
    target_aspect: f64, // width / height
    center_x: f64,      // normalized 0-1
    center_y: f64,      // normalized 0-1
) -> (u32, u32, u32, u32) {
    let source_aspect = source_w as f64 / source_h as f64;

    // Ensure crop dimensions are even (required by H.264/libx264)
    let (crop_w, crop_h) = if target_aspect > source_aspect {
        // Target is wider - use full width, crop height
        let w = make_even(source_w);
        let h = make_even((source_w as f64 / target_aspect) as u32);
        (w, h)
    } else {
        // Target is taller - use full height, crop width
        let h = make_even(source_h);
        let w = make_even((source_h as f64 * target_aspect) as u32);
        (w, h)
    };

    // Calculate crop position centered on the given point
    let center_x_px = (source_w as f64 * center_x) as i32;
    let center_y_px = (source_h as f64 * center_y) as i32;

    let mut crop_x = center_x_px - (crop_w as i32 / 2);
    let mut crop_y = center_y_px - (crop_h as i32 / 2);

    // Clamp to valid range
    crop_x = crop_x.max(0).min((source_w - crop_w) as i32);
    crop_y = crop_y.max(0).min((source_h - crop_h) as i32);

    (crop_w, crop_h, crop_x as u32, crop_y as u32)
}

/// Builds a dynamic pan clip that smoothly follows speakers across frames.
///
/// Uses keyframes to interpolate crop position over time, creating a smooth
/// panning effect that keeps the subject in frame.
#[allow(clippy::too_many_arguments)]
pub async fn build_dynamic_pan_clip(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    strategy: &FramingStrategy,
    target_aspect_ratio: &str, // Target aspect ratio (e.g., "9:16", "4:5", "1:1")
    quality: &str,
    frame_rate: u32,
    audio_settings: Option<&AudioSettings>,
    video_filter_segments: Option<&Vec<VideoFilterSegment>>,
    effects_filter_chain: Option<&str>,
) -> Result<(), String> {
    // Build combined filter string (color grading + effects)
    let video_filter_str =
        build_combined_filter_string(video_filter_segments, effects_filter_chain);
    let _shell = app.shell();
    let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
    let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
    let duration = end_time - start_time;

    let keyframes = strategy
        .keyframes
        .as_ref()
        .ok_or("Dynamic pan strategy missing keyframes")?;

    // Parse target aspect ratio from parameter
    let aspect =
        parse_aspect_ratio_string(target_aspect_ratio).unwrap_or(super::types::AspectRatio {
            width: 9.0,
            height: 16.0,
        });

    println!(
        "[Rust] Building dynamic pan clip with {} keyframes, aspect: {}:{}",
        keyframes.len(),
        aspect.width,
        aspect.height
    );

    // Get video info
    let video_info = get_video_info(app, video_path).await?;
    let source_w = video_info.width;
    let source_h = video_info.height;

    // Calculate crop dimensions for target aspect ratio
    // Ensure dimensions are even (required by H.264/libx264)
    let target_aspect = aspect.width as f64 / aspect.height as f64;
    let source_aspect = source_w as f64 / source_h as f64;

    let (crop_w, crop_h) = if target_aspect < source_aspect {
        // Crop width (most common case: 16:9 to 9:16)
        let h = make_even(source_h);
        let w = make_even((h as f64 * target_aspect) as u32);
        (w, h)
    } else {
        // Crop height
        let w = make_even(source_w);
        let h = make_even((w as f64 / target_aspect) as u32);
        (w, h)
    };

    // Build pan expression from keyframes
    let pan_expr = build_pan_expression(keyframes, source_w, crop_w, start_time, duration);

    // Build video filter with optional time-based color grading
    let vf = if let Some(ref filter_str) = video_filter_str {
        println!(
            "[Rust] Applying time-based video color filters in dynamic pan: {}",
            filter_str
        );
        format!("crop={}:{}:{}:0,{}", crop_w, crop_h, pan_expr, filter_str)
    } else {
        format!("crop={}:{}:{}:0", crop_w, crop_h, pan_expr)
    };

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Build FFmpeg args with hardware acceleration
    // Crop filter is CPU-based, so disable GPU decode
    let mut args = build_hwaccel_args(&encoder, true);

    // Combined seeking: input seek (fast) to ~5s before, then output seek (accurate)
    let input_seek = (start_time - 5.0).max(0.0);
    let output_seek = start_time - input_seek;

    args.extend(vec![
        "-ss".to_string(),
        format!("{:.3}", input_seek),
        "-i".to_string(),
        video_path.to_string(),
        "-ss".to_string(),
        format!("{:.3}", output_seek),
        "-t".to_string(),
        format!("{:.3}", duration),
        "-vf".to_string(),
        vf,
        "-c:v".to_string(),
        encoder.codec.clone(),
    ]);

    // Add encoder preset
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    let audio_filter = build_audio_filter(audio_settings);
    let copy_audio = audio_filter.is_none();

    // Add audio filter if settings provided
    if let Some(af) = audio_filter {
        args.push("-af".to_string());
        args.push(af);
    }

    // Common output parameters
    // Use -fps_mode cfr to ensure constant frame rate and prevent black frames at start
    // when using input seeking with complex filter graphs
    args.extend_from_slice(&[
        "-fps_mode".to_string(),
        "cfr".to_string(),
        "-r".to_string(),
        frame_rate.to_string(),
        "-c:a".to_string(),
        if copy_audio {
            "copy".to_string()
        } else {
            "aac".to_string()
        },
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        "-movflags".to_string(),
        "+faststart".to_string(),
        "-avoid_negative_ts".to_string(),
        "make_zero".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);
    if !copy_audio {
        args.extend_from_slice(&["-b:a".to_string(), "192k".to_string()]);
    }

    println!("[Rust] Running dynamic pan FFmpeg command...");

    // Use fallback helper for hardware encoder resilience
    run_ffmpeg_with_fallback(app, args, &encoder, quality, None)
        .await
        .map_err(|e| format!("FFmpeg dynamic pan failed: {}", e))?;

    println!("[Rust] Dynamic pan clip built successfully");
    Ok(())
}

/// Builds FFmpeg expression for panning based on keyframes.
///
/// Creates a linear interpolation expression that smoothly transitions
/// between keyframe positions.
fn build_pan_expression(
    keyframes: &[PanKeyframe],
    source_width: u32,
    crop_width: u32,
    segment_start: f64,
    segment_duration: f64,
) -> String {
    if keyframes.is_empty() {
        // Default to center
        let center = (source_width - crop_width) / 2;
        return center.to_string();
    }

    if keyframes.len() == 1 {
        // Single keyframe - static position
        let x = (keyframes[0].crop_x * source_width as f64) as u32;
        let clamped = x.min(source_width - crop_width);
        return clamped.to_string();
    }

    // Filter keyframes to those within segment time range
    let relevant_keyframes: Vec<&PanKeyframe> = keyframes
        .iter()
        .filter(|kf| {
            kf.timestamp >= segment_start && kf.timestamp <= segment_start + segment_duration
        })
        .collect();

    if relevant_keyframes.is_empty() {
        // No keyframes in range, use first keyframe position
        let x = (keyframes[0].crop_x * source_width as f64) as u32;
        let clamped = x.min(source_width - crop_width);
        return clamped.to_string();
    }

    // For simplicity, use linear interpolation between first and last relevant keyframe
    let first = relevant_keyframes.first().unwrap();
    let last = relevant_keyframes.last().unwrap();

    let start_x = ((first.crop_x * source_width as f64) as u32).min(source_width - crop_width);
    let end_x = ((last.crop_x * source_width as f64) as u32).min(source_width - crop_width);

    let kf_duration = last.timestamp - first.timestamp;

    if kf_duration < 0.5 || (start_x as i32 - end_x as i32).abs() < 10 {
        // Minimal change - use average position
        let avg_x = (start_x + end_x) / 2;
        return avg_x.to_string();
    }

    // Linear interpolation: start + (end - start) * (t - start_t) / duration
    // Note: 't' in FFmpeg is time in seconds from start of output
    let relative_start = first.timestamp - segment_start;

    format!(
        "{}+({})*(t-{})/{}",
        start_x,
        end_x as i32 - start_x as i32,
        relative_start,
        kf_duration
    )
}

/// Letterbox / crop main source to output canvas (matches POI Scale 16:9 mode).
/// For Use 16:9 mode, use `build_use16x9_sharp_layer` instead.
fn push_letterboxed_source_transform_chain(
    filter_parts: &mut Vec<String>,
    input_tag: &str,
    output_tag: &str,
    transform: &super::types::SourceTransform,
    output_w: u32,
    output_h: u32,
    source_w: f64,
    source_h: f64,
    blur_sigma: Option<f64>,
) {
    let base_w = output_w as f64;
    let base_h = base_w / (source_w / source_h);
    let scaled_w = make_even((base_w * transform.scale) as u32);
    let scaled_h = make_even((base_h * transform.scale) as u32);
    let center_x = (output_w as f64 - scaled_w as f64) / 2.0;
    let center_y = (output_h as f64 - scaled_h as f64) / 2.0;
    let offset_x = transform.x * output_w as f64;
    let offset_y = transform.y * output_h as f64;
    let final_x = center_x + offset_x;
    let final_y = center_y + offset_y;

    let blur_clause = blur_sigma
        .filter(|&s| s > 0.01)
        .map(|s| format!(",gblur=sigma={}", s.clamp(0.1, 40.0)))
        .unwrap_or_default();

    if scaled_w > output_w || scaled_h > output_h {
        let crop_x = (-final_x).max(0.0) as u32;
        let crop_y = (-final_y).max(0.0) as u32;
        filter_parts.push(format!(
            "[{}]scale={}:{}:flags=lanczos,crop={}:{}:{}:{}{}[{}]",
            input_tag,
            scaled_w,
            scaled_h,
            output_w,
            output_h,
            crop_x,
            crop_y,
            blur_clause,
            output_tag
        ));
    } else {
        // Scale 16:9 mode: pad with black bars
        filter_parts.push(format!(
            "[{}]scale={}:{}:flags=lanczos,pad={}:{}:{}:{}:black{}[{}]",
            input_tag,
            scaled_w,
            scaled_h,
            output_w,
            output_h,
            final_x as i32,
            final_y as i32,
            blur_clause,
            output_tag
        ));
    }
}

/// Build the sharp layer for Use 16:9 mode - scales to fit and positions for overlay.
/// Returns the overlay X and Y position for the sharp layer.
fn build_use16x9_sharp_layer(
    filter_parts: &mut Vec<String>,
    input_tag: &str,
    output_tag: &str,
    transform: &super::types::SourceTransform,
    output_w: u32,
    output_h: u32,
    source_w: f64,
    source_h: f64,
) -> (i32, i32) {
    let base_w = output_w as f64;
    let base_h = base_w / (source_w / source_h);
    let scaled_w = make_even((base_w * transform.scale) as u32);
    let scaled_h = make_even((base_h * transform.scale) as u32);
    let center_x = (output_w as f64 - scaled_w as f64) / 2.0;
    let center_y = (output_h as f64 - scaled_h as f64) / 2.0;
    let offset_x = transform.x * output_w as f64;
    let offset_y = transform.y * output_h as f64;
    let overlay_x = (center_x + offset_x) as i32;
    let overlay_y = (center_y + offset_y) as i32;

    // Scale the sharp content (no padding, no blur - this is the crisp foreground)
    filter_parts.push(format!(
        "[{}]scale={}:{}:flags=lanczos[{}]",
        input_tag,
        scaled_w,
        scaled_h,
        output_tag
    ));

    (overlay_x, overlay_y)
}

/// Collect unique, existing filesystem paths for POI regions that use uploaded media.
fn collect_external_media_paths_for_multi_region(config: &ManualFramingConfig) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut push_path = |p: &str| {
        let t = p.trim();
        if t.is_empty() || t.starts_with("blob:") {
            return;
        }
        if !std::path::Path::new(t).exists() {
            eprintln!(
                "[WARN] POI external media path missing (export will skip): {}",
                t
            );
            return;
        }
        if !out.iter().any(|x| x == t) {
            out.push(t.to_string());
        }
    };
    for r in &config.regions {
        if let Some(ref id) = r.media_asset_id {
            push_path(id);
        }
    }
    if let Some(segs) = &config.segment_configs {
        for s in segs {
            for r in &s.regions {
                if let Some(ref id) = r.media_asset_id {
                    push_path(id);
                }
            }
        }
    }
    out
}

/// Builds a multi-region clip with user-defined crop regions composited together.
///
/// This is used for manual POI (Point of Interest) framing where the user defines
/// multiple regions from the source video and their positions in the output canvas.
///
/// Each region is:
/// 1. Cropped from the source video
/// 2. Scaled to fit its output rect
/// 3. Placed on the output canvas
#[allow(clippy::too_many_arguments)]
pub async fn build_multi_region_clip(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    config: &ManualFramingConfig,
    target_aspect_ratio: &str,
    quality: &str,
    frame_rate: u32,
    audio_settings: Option<&AudioSettings>,
    video_filter_segments: Option<&Vec<VideoFilterSegment>>,
    effects_filter_chain: Option<&str>,
) -> Result<(), String> {
    // Build combined filter string (color grading + effects)
    let video_filter_str =
        build_combined_filter_string(video_filter_segments, effects_filter_chain);
    let _shell = app.shell();
    let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
    let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
    let duration = end_time - start_time;

    // Parse target aspect ratio
    let aspect =
        parse_aspect_ratio_string(target_aspect_ratio).unwrap_or(super::types::AspectRatio {
            width: 9.0,
            height: 16.0,
        });

    // Debug: Log incoming config
    println!(
        "[Rust] build_multi_region_clip called with config: source_frame_mode={:?}, blur_enabled={:?}, blur_amount={:?}, regions={}, source_transform={:?}",
        config.source_frame_mode,
        config.blur_enabled,
        config.blur_amount,
        config.regions.len(),
        config.source_transform
    );

    // If no regions but sourceTransform is set (scale mode), create a full-frame region.
    // use16x9 mode may have no regions — composite blur+sharp only.
    let mut working_config = config.clone();
    let use_16x9 = matches!(
        working_config.source_frame_mode.as_deref(),
        Some("use16x9")
    );
    println!("[Rust] use_16x9 mode detected: {}", use_16x9);
    if working_config.regions.is_empty() && working_config.source_transform.is_some() && !use_16x9 {
        println!("[Rust] No regions defined but sourceTransform is set - creating full-frame region");
        // Create a full-frame region that uses the entire source
        working_config.regions.push(super::types::ManualRegion {
            id: "full_frame".to_string(),
            color: "#ffffff".to_string(),
            label: Some("Full Frame".to_string()),
            source: super::types::NormalizedBBox {
                x: 0.0,
                y: 0.0,
                width: 1.0,
                height: 1.0,
            },
            output: super::types::NormalizedBBox {
                x: 0.0,
                y: 0.0,
                width: 1.0,
                height: 1.0,
            },
            media_asset_id: None,
            media_type: None,
        });
    } else if working_config.regions.is_empty() && !use_16x9 {
        return Err("MultiRegion config has no regions defined and no sourceTransform".to_string());
    }

    // Check if we have time-based segment configs
    let has_segments = working_config.segment_configs.is_some() 
        && !working_config.segment_configs.as_ref().unwrap().is_empty();
    
    if has_segments {
        println!(
            "[Rust] Building multi-region clip with TIME-BASED SEGMENTS: {} base regions, {} segments",
            working_config.regions.len(),
            working_config.segment_configs.as_ref().unwrap().len()
        );
    } else {
        println!(
            "[Rust] Building multi-region clip with {} regions, aspect: {}:{}",
            working_config.regions.len(),
            aspect.width,
            aspect.height
        );
    }

    // Get video info for pixel calculations
    let video_info = get_video_info(app, video_path).await?;
    let source_w = video_info.width as f64;
    let source_h = video_info.height as f64;

    // Calculate output dimensions (1080p base width)
    // Ensure dimensions are even (required by H.264/libx264)
    let output_w: u32 = 1080;
    let output_h: u32 = make_even(((output_w as f32) * aspect.height / aspect.width) as u32);

    println!("[Rust] Output dimensions: {}x{}", output_w, output_h);

    // Build FFmpeg complex filter for multi-region compositing
    // Strategy:
    // 1. Input video gets labeled as [v]
    // 2. For each region, crop from [v] and scale to output size
    // 3. Create black canvas and overlay each region at its output position
    // 4. If segments exist, use enable filter to switch regions based on time

    let mut filter_parts: Vec<String> = Vec::new();
    let mut region_labels: Vec<(String, u32, u32, Option<String>)> = Vec::new();

    // Blur amount: 0 = no blur, >0 = blur enabled
    // The UI slider goes 0-30, we convert to sigma by dividing by 5
    let blur_amount_cfg = working_config.blur_amount.unwrap_or(0.0);
    let blur_enabled = blur_amount_cfg > 0.0;
    let blur_sigma = if blur_enabled {
        (blur_amount_cfg / 5.0).clamp(0.1, 6.0)
    } else {
        0.0
    };

    // Build processed main-video label: use16x9 (blur fill + sharp), scale+transform+optional blur, or raw input
    let source_label = if use_16x9 {
        let transform = working_config
            .source_transform
            .clone()
            .unwrap_or(super::types::SourceTransform {
                scale: 1.0,
                x: 0.0,
                y: 0.0,
            });
        println!(
            "[Rust] Use 16:9 mode: sourceTransform scale={}, x={}, y={}, blur_amount={}, blur_enabled={}",
            transform.scale, transform.x, transform.y, blur_amount_cfg, blur_enabled
        );

        filter_parts.push("[0:v]split=2[vin_u9a][vin_u9b]".to_string());
        // Background: scale to cover, crop to output size, optionally blur
        // blur_amount is 0-30 from UI; map to sigma range of 0-40 for noticeable blur on HD video
        if blur_enabled && blur_amount_cfg > 0.0 {
            let bg_sigma = (blur_amount_cfg * 1.33).clamp(1.0, 40.0);
            println!("[Rust] Use 16:9 blur: amount={} -> sigma={}", blur_amount_cfg, bg_sigma);
            filter_parts.push(format!(
                "[vin_u9a]scale={}:{}:force_original_aspect_ratio=increase,crop={}:{}:(iw-ow)/2:(ih-oh)/2,gblur=sigma={}[v_u9_blur]",
                output_w, output_h, output_w, output_h, bg_sigma
            ));
        } else {
            // No blur - just scale and crop
            filter_parts.push(format!(
                "[vin_u9a]scale={}:{}:force_original_aspect_ratio=increase,crop={}:{}:(iw-ow)/2:(ih-oh)/2[v_u9_blur]",
                output_w, output_h, output_w, output_h
            ));
        }
        // Build the sharp layer for Use 16:9 mode and get overlay position
        let (overlay_x, overlay_y) = build_use16x9_sharp_layer(
            &mut filter_parts,
            "vin_u9b",
            "v_u9_sharp",
            &transform,
            output_w,
            output_h,
            source_w,
            source_h,
        );
        // Overlay the sharp layer onto the blurred background at the calculated position
        filter_parts.push(format!(
            "[v_u9_blur][v_u9_sharp]overlay={}:{}[v_use16_out]",
            overlay_x, overlay_y
        ));
        "v_use16_out"
    } else if let Some(ref transform) = working_config.source_transform {
        println!(
            "[Rust] Applying sourceTransform: scale={}, x={}, y={}",
            transform.scale, transform.x, transform.y
        );
        let blur_opt = if blur_enabled && blur_sigma > 0.01 {
            Some(blur_sigma)
        } else {
            None
        };
        push_letterboxed_source_transform_chain(
            &mut filter_parts,
            "0:v",
            "vsrc",
            transform,
            output_w,
            output_h,
            source_w,
            source_h,
            blur_opt,
        );
        "vsrc"
    } else {
        "0:v"
    };

    let crop_from_output_space = source_label != "0:v";
    let external_media_paths = collect_external_media_paths_for_multi_region(&working_config);
    if !external_media_paths.is_empty() {
        println!(
            "[Rust] Multi-region: {} external media input(s) for compositing",
            external_media_paths.len()
        );
    }

    // Helper function to build region filters
    let mut build_region_filters = |regions: &Vec<super::types::ManualRegion>, 
                                 prefix: &str, 
                                 enable_condition: Option<String>| -> Vec<(String, u32, u32, Option<String>)> {
        let mut labels = Vec::new();
        for (i, region) in regions.iter().enumerate() {
            let out_x = (region.output.x * output_w as f64) as u32;
            let out_y = (region.output.y * output_h as f64) as u32;
            let out_w = make_even((region.output.width * output_w as f64) as u32);
            let out_h = make_even((region.output.height * output_h as f64) as u32);
            let label = format!("{}{}", prefix, i);

            if let Some(ref media_path) = region.media_asset_id {
                let mp = media_path.trim();
                if !mp.is_empty() && !mp.starts_with("blob:") && std::path::Path::new(mp).exists() {
                    if let Some(pos) = external_media_paths.iter().position(|p| p == mp) {
                        let input_idx = pos + 1;
                        let is_image = matches!(region.media_type.as_deref(), Some("image"));
                        let filter = if is_image {
                            format!(
                                "[{}:v]scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[{}]",
                                input_idx, out_w, out_h, out_w, out_h, label
                            )
                        } else {
                            format!(
                                "[{}:v]trim=duration={},setpts=PTS-STARTPTS,scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[{}]",
                                input_idx, duration, out_w, out_h, out_w, out_h, label
                            )
                        };
                        filter_parts.push(filter);
                        labels.push((label, out_x, out_y, enable_condition.clone()));
                        continue;
                    } else {
                        eprintln!(
                            "[WARN] Region {} external media not in FFmpeg input list: {}",
                            region.id, mp
                        );
                    }
                }
            }

            // Validate and clamp source coordinates to valid range [0, 1]
            let source_x = region.source.x.clamp(0.0, 1.0);
            let source_y = region.source.y.clamp(0.0, 1.0);
            let source_width = region.source.width.clamp(0.0, 1.0);
            let source_height = region.source.height.clamp(0.0, 1.0);
            
            // Log warnings if values were clamped
            if source_x != region.source.x || source_y != region.source.y {
                eprintln!(
                    "[WARN] Region {} source position out of bounds: x={}, y={}. Clamped to: x={}, y={}",
                    region.id, region.source.x, region.source.y, source_x, source_y
                );
            }
            if source_width != region.source.width || source_height != region.source.height {
                eprintln!(
                    "[WARN] Region {} source dimensions out of bounds: width={}, height={}. Clamped to: width={}, height={}",
                    region.id, region.source.width, region.source.height, source_width, source_height
                );
            }
            
            // Calculate source crop in pixels
            let (crop_x, crop_y, mut crop_w, mut crop_h) = if crop_from_output_space {
                let x = (source_x * output_w as f64) as u32;
                let y = (source_y * output_h as f64) as u32;
                let w = make_even((source_width * output_w as f64) as u32);
                let h = make_even((source_height * output_h as f64) as u32);
                (x, y, w, h)
            } else {
                let x = (source_x * source_w) as u32;
                let y = (source_y * source_h) as u32;
                let w = make_even((source_width * source_w) as u32);
                let h = make_even((source_height * source_h) as u32);
                (x, y, w, h)
            };
            
            // Validate crop dimensions
            const MIN_CROP_PIXELS: u32 = 2; // FFmpeg minimum for most codecs
            
            // Ensure minimum dimensions
            if crop_w < MIN_CROP_PIXELS {
                eprintln!(
                    "[WARN] Region {} crop width too small: {}. Clamping to minimum: {}",
                    region.id, crop_w, MIN_CROP_PIXELS
                );
                crop_w = MIN_CROP_PIXELS;
            }
            if crop_h < MIN_CROP_PIXELS {
                eprintln!(
                    "[WARN] Region {} crop height too small: {}. Clamping to minimum: {}",
                    region.id, crop_h, MIN_CROP_PIXELS
                );
                crop_h = MIN_CROP_PIXELS;
            }
            
            // Ensure crop doesn't exceed source dimensions
            let max_w = if crop_from_output_space { output_w } else { source_w as u32 };
            let max_h = if crop_from_output_space { output_h } else { source_h as u32 };
            
            if crop_w > max_w {
                eprintln!(
                    "[WARN] Region {} crop width {} exceeds source width {}. Clamping to source width.",
                    region.id, crop_w, max_w
                );
                crop_w = max_w;
            }
            if crop_h > max_h {
                eprintln!(
                    "[WARN] Region {} crop height {} exceeds source height {}. Clamping to source height.",
                    region.id, crop_h, max_h
                );
                crop_h = max_h;
            }
            
            // Ensure crop dimensions are even (required by most codecs)
            crop_w = make_even(crop_w);
            crop_h = make_even(crop_h);
            
            // Recalculate position to ensure crop stays within bounds
            let crop_x = crop_x.min(max_w.saturating_sub(crop_w));
            let crop_y = crop_y.min(max_h.saturating_sub(crop_h));

            // Build crop and scale filter (without enable - we'll apply enable to overlay instead)
            let filter = format!(
                "[{}]crop={}:{}:{}:{},scale={}:{}:flags=lanczos[{}]",
                source_label, crop_w, crop_h, crop_x, crop_y, out_w, out_h, label
            );
            
            filter_parts.push(filter);

            // Store label with enable condition for overlay stage
            labels.push((label, out_x, out_y, enable_condition.clone()));
        }
        labels
    };

    // Build regions based on whether we have segments
    if has_segments {
        let segments = working_config.segment_configs.as_ref().unwrap();
        
        // Build base regions (active outside all segments)
        // Enable condition: NOT in any segment time range
        // IMPORTANT: Segment times are absolute, but after FFmpeg trim (-ss), timeline starts at 0
        // So we need to convert segment times to be relative to clip start
        let mut base_enable_parts = Vec::new();
        for seg in segments.iter() {
            // Convert absolute segment times to relative (from clip start)
            let relative_start = seg.start_time - start_time;
            let relative_end = seg.end_time - start_time;
            
            // For each segment, add condition: NOT (t >= start AND t <= end)
            // Which is: t < start OR t > end
            base_enable_parts.push(format!("lt(t,{})+gt(t,{})", relative_start, relative_end));
        }
        let base_enable = if base_enable_parts.is_empty() {
            None
        } else {
            // Base regions enabled when ANY of the "not in segment" conditions are true
            // But we want ALL segments to be false, so we use multiplication (AND logic)
            // Actually, we want: NOT (in seg1 OR in seg2 OR ...) = (NOT in seg1) AND (NOT in seg2) AND ...
            // For each segment: NOT (t >= start AND t <= end) = (t < start OR t > end)
            // We want base active when outside ALL segments
            // So: (t < seg1.start OR t > seg1.end) AND (t < seg2.start OR t > seg2.end) ...
            // In FFmpeg: multiply the conditions (1 = true, 0 = false)
            Some(format!("enable={}", base_enable_parts.join("*")))
        };
        
        println!("[Rust] Building base regions with enable condition: {:?}", base_enable);
        let base_labels = build_region_filters(&working_config.regions, "base_r", base_enable);
        region_labels.extend(base_labels);
        
        // Build segment-specific regions
        for (seg_idx, seg) in segments.iter().enumerate() {
            // Convert absolute segment times to relative (from clip start)
            let relative_start = seg.start_time - start_time;
            let relative_end = seg.end_time - start_time;
            
            // Enable condition: t >= start AND t <= end
            let seg_enable = format!(
                "enable=gte(t,{})*lte(t,{})",
                relative_start, relative_end
            );
            
            println!(
                "[Rust] Building segment {} regions ({:.2}s - {:.2}s relative to clip) with {} regions",
                seg_idx, relative_start, relative_end, seg.regions.len()
            );
            
            let seg_labels = build_region_filters(
                &seg.regions, 
                &format!("seg{}_r", seg_idx), 
                Some(seg_enable)
            );
            region_labels.extend(seg_labels);
        }
    } else {
        // No segments - build regions normally without enable filters
        region_labels = build_region_filters(&working_config.regions, "r", None);
    }

    if region_labels.is_empty() {
        if use_16x9 {
            println!("[Rust] Use 16:9 with no regions — output is blur+sharp composite only");
            if let Some(ref filter_str) = video_filter_str {
                filter_parts.push(format!(
                    "[{}]{}[vout_graded]",
                    source_label, filter_str
                ));
            } else {
                filter_parts.push(format!("[{}]format=yuv420p[vout]", source_label));
            }
        } else {
            return Err(
                "Multi-region build has no region layers to composite (unexpected)".to_string(),
            );
        }
    } else {
        // Create base canvas (black background)
        filter_parts.push(format!(
            "color=c=black:s={}x{}:d={}[base]",
            output_w, output_h, duration
        ));

        // Start with base canvas, overlay each region
        let mut current_label = "base".to_string();
        for (i, (region_label, out_x, out_y, enable_cond)) in region_labels.iter().enumerate() {
            let next_label = if i == region_labels.len() - 1 {
                "vout".to_string() // Final output
            } else {
                format!("tmp{}", i)
            };

            let mut overlay_filter = format!(
                "[{}][{}]overlay={}:{}",
                current_label, region_label, out_x, out_y
            );

            if let Some(ref cond) = enable_cond {
                let expr = cond.strip_prefix("enable=").unwrap_or(cond);
                overlay_filter.push_str(&format!(":enable='{}'", expr));
            }

            overlay_filter.push_str(&format!("[{}]", next_label));
            filter_parts.push(overlay_filter);

            current_label = next_label;
        }

        if let Some(ref filter_str) = video_filter_str {
            println!(
                "[Rust] Applying time-based video color filters in multi-region: {}",
                filter_str
            );
            filter_parts.push(format!("[vout]{}[vout_graded]", filter_str));
        }
    }

    let filter_complex = filter_parts.join(";");

    let map_label = if video_filter_str.is_some() {
        "[vout_graded]"
    } else {
        "[vout]"
    };

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Build FFmpeg args with hardware acceleration
    // Use -fps_mode cfr to ensure constant frame rate and prevent black frames at start
    // when using input seeking with complex filter graphs
    let mut args = build_hwaccel_args(&encoder, true);

    // Combined seeking: input seek (fast) to ~5s before, then output seek (accurate)
    let input_seek = (start_time - 5.0).max(0.0);
    let output_seek = start_time - input_seek;

    args.extend(vec![
        "-ss".to_string(),
        format!("{:.3}", input_seek),
        "-i".to_string(),
        video_path.to_string(),
        "-ss".to_string(),
        format!("{:.3}", output_seek),
        "-t".to_string(),
        format!("{:.3}", duration),
    ]);

    for ext in &external_media_paths {
        let p = ext.replace('\\', "/");
        let lower = ext.to_lowercase();
        let is_image = lower.ends_with(".png")
            || lower.ends_with(".jpg")
            || lower.ends_with(".jpeg")
            || lower.ends_with(".webp")
            || lower.ends_with(".gif")
            || lower.ends_with(".bmp");
        if is_image {
            args.push("-loop".to_string());
            args.push("1".to_string());
            args.push("-framerate".to_string());
            args.push(frame_rate.to_string());
            args.push("-t".to_string());
            args.push(format!("{:.3}", duration));
            args.push("-i".to_string());
            args.push(p);
        } else {
            args.push("-i".to_string());
            args.push(p);
            args.push("-t".to_string());
            args.push(format!("{:.3}", duration));
        }
    }

    args.extend(vec![
        "-filter_complex".to_string(),
        filter_complex,
        "-map".to_string(),
        map_label.to_string(),
        "-map".to_string(),
        "0:a?".to_string(), // Map audio if present
        "-c:v".to_string(),
        encoder.codec.clone(),
        "-fps_mode".to_string(),
        "cfr".to_string(),
        "-r".to_string(),
        frame_rate.to_string(),
    ]);

    // Add encoder preset
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    let audio_filter = build_audio_filter(audio_settings);
    let copy_audio = audio_filter.is_none();

    if let Some(af) = audio_filter {
        args.push("-af".to_string());
        args.push(af);
    }

    args.push("-c:a".to_string());
    if copy_audio {
        args.push("copy".to_string());
    } else {
        args.push("aac".to_string());
        args.push("-b:a".to_string());
        args.push("192k".to_string());
    }

    // Output - add avoid_negative_ts to prevent black frames at start
    args.push("-avoid_negative_ts".to_string());
    args.push("make_zero".to_string());
    args.push("-y".to_string());
    args.push(output_path.to_string_lossy().to_string());

    println!("[Rust] Running FFmpeg multi-region build...");

    // Use fallback helper for hardware encoder resilience
    run_ffmpeg_with_fallback(app, args, &encoder, quality, None)
        .await
        .map_err(|e| format!("FFmpeg multi-region build failed: {}", e))?;

    println!("[Rust] Multi-region clip built successfully");
    Ok(())
}

/// Builds a clip with framing strategy applied.
///
/// This is the main entry point that routes to the appropriate builder
/// based on the framing mode.
///
/// The `target_aspect_ratio` parameter allows overriding the strategy's aspect ratio
/// to support building multiple aspect ratios (9:16, 4:5, 1:1) from the same strategy.
#[allow(clippy::too_many_arguments)]
pub async fn build_clip_with_framing_strategy(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    strategy: &FramingStrategy,
    target_aspect_ratio: &str, // Override aspect ratio (e.g., "9:16", "4:5", "1:1")
    quality: &str,
    frame_rate: u32,
    subtitle_path: Option<&std::path::Path>,
    intro_path: Option<&str>,
    outro_path: Option<&str>,
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>,
    watermark_settings: Option<&WatermarkSettings>,
    audio_settings: Option<&AudioSettings>,
    video_filter_segments: Option<&Vec<VideoFilterSegment>>,
    effects_filter_chain: Option<&str>,
) -> Result<(), String> {
    println!(
        "[Rust] Building clip with framing strategy: {:?}, target: {}",
        strategy.mode, target_aspect_ratio
    );

    match strategy.mode {
        FramingMode::SplitScreen => {
            // For split screen, we build without subtitles first, then add them
            let temp_output = if subtitle_path.is_some() {
                let paths = crate::storage::init_storage_dirs()
                    .map_err(|e| format!("Failed to get storage paths: {}", e))?;
                Some(
                    paths
                        .temp
                        .join(format!("split_temp_{}.mp4", uuid::Uuid::new_v4())),
                )
            } else {
                None
            };

            let output_path_buf = output_path.to_path_buf();
            let build_path = temp_output.as_ref().unwrap_or(&output_path_buf);

            build_split_screen_clip(
                app,
                video_path,
                build_path,
                segment,
                strategy,
                target_aspect_ratio,
                quality,
                frame_rate,
                audio_settings,
                video_filter_segments,
                effects_filter_chain,
            )
            .await?;

            // Add subtitles if needed
            if let (Some(temp), Some(sub_path)) = (&temp_output, subtitle_path) {
                burn_subtitles_to_video(app, temp, output_path, sub_path, quality).await?;
                let _ = std::fs::remove_file(temp);
            }
        }
        FramingMode::DynamicPan => {
            let temp_output = if subtitle_path.is_some() {
                let paths = crate::storage::init_storage_dirs()
                    .map_err(|e| format!("Failed to get storage paths: {}", e))?;
                Some(
                    paths
                        .temp
                        .join(format!("pan_temp_{}.mp4", uuid::Uuid::new_v4())),
                )
            } else {
                None
            };

            let output_path_buf = output_path.to_path_buf();
            let build_path = temp_output.as_ref().unwrap_or(&output_path_buf);

            build_dynamic_pan_clip(
                app,
                video_path,
                build_path,
                segment,
                strategy,
                target_aspect_ratio,
                quality,
                frame_rate,
                audio_settings,
                video_filter_segments,
                effects_filter_chain,
            )
            .await?;

            // Add subtitles if needed
            if let (Some(temp), Some(sub_path)) = (&temp_output, subtitle_path) {
                burn_subtitles_to_video(app, temp, output_path, sub_path, quality).await?;
                let _ = std::fs::remove_file(temp);
            }
        }
        FramingMode::Static => {
            // Parse target aspect ratio from parameter (e.g., "9:16", "1:1", "4:5")
            let aspect_ratio = parse_aspect_ratio_string(target_aspect_ratio).unwrap_or(
                super::types::AspectRatio {
                    width: 9.0,
                    height: 16.0,
                },
            );

            println!(
                "[Rust] Static mode with aspect ratio: {}:{}",
                aspect_ratio.width, aspect_ratio.height
            );

            build_single_segment_clip_with_settings(
                app,
                video_path,
                output_path,
                segment,
                subtitle_path,
                &aspect_ratio,
                quality,
                frame_rate,
                "mp4",
                intro_path,
                outro_path,
                intro_outro_cache,
                watermark_settings,
                audio_settings,
                video_filter_segments,
                effects_filter_chain,
                None, // Audio effects not passed through framing strategy path
            )
            .await?;
        }
        FramingMode::MultiRegion => {
            // Manual multi-region mode with user-defined regions
            let multi_region_config = strategy
                .multi_region
                .as_ref()
                .ok_or("MultiRegion mode requires multi_region configuration")?;

            let temp_output = if subtitle_path.is_some() {
                let paths = crate::storage::init_storage_dirs()
                    .map_err(|e| format!("Failed to get storage paths: {}", e))?;
                Some(
                    paths
                        .temp
                        .join(format!("multi_region_temp_{}.mp4", uuid::Uuid::new_v4())),
                )
            } else {
                None
            };

            let output_path_buf = output_path.to_path_buf();
            let build_path = temp_output.as_ref().unwrap_or(&output_path_buf);

            build_multi_region_clip(
                app,
                video_path,
                build_path,
                segment,
                multi_region_config,
                target_aspect_ratio,
                quality,
                frame_rate,
                audio_settings,
                video_filter_segments,
                effects_filter_chain,
            )
            .await?;

            // Add subtitles if needed
            if let (Some(temp), Some(sub_path)) = (&temp_output, subtitle_path) {
                burn_subtitles_to_video(app, temp, output_path, sub_path, quality).await?;
                let _ = std::fs::remove_file(temp);
            }

            // Handle intro/outro concatenation for MultiRegion mode
            if intro_path.is_some() || outro_path.is_some() {
                println!("[Rust] MultiRegion mode: intro/outro detected, preparing concatenation");
                
                let paths = crate::storage::init_storage_dirs()
                    .map_err(|e| format!("Failed to get storage paths: {}", e))?;
                let temp_dir = paths.temp.join(format!("multi_region_concat_{}", uuid::Uuid::new_v4()));
                std::fs::create_dir_all(&temp_dir)
                    .map_err(|e| format!("Failed to create temp directory: {}", e))?;

                // Parse target aspect ratio for intro/outro preparation
                let aspect_ratio = parse_aspect_ratio_string(target_aspect_ratio).unwrap_or(
                    super::types::AspectRatio {
                        width: 9.0,
                        height: 16.0,
                    },
                );

                // Calculate output dimensions for intro/outro (not crop dimensions)
                // Use standard width of 1080px and calculate height based on aspect ratio
                let output_w = 1080u32;
                let output_h = (output_w as f32 * aspect_ratio.height / aspect_ratio.width) as u32;
                
                println!("[Rust] MultiRegion: Output dimensions for intro/outro: {}x{}", output_w, output_h);

                // Prepare intro/outro to match aspect ratio
                let mut intro_file: Option<std::path::PathBuf> = None;
                let mut outro_file: Option<std::path::PathBuf> = None;

                if let Some(intro) = intro_path {
                    println!("[Rust] MultiRegion: Processing intro video...");
                    intro_file = Some(
                        prepare_intro_outro_for_concat(
                            app,
                            intro,
                            &temp_dir,
                            "intro",
                            &aspect_ratio,
                            quality,
                            frame_rate,
                            output_w,
                            output_h,
                            intro_outro_cache.clone(),
                        )
                        .await?,
                    );
                }

                if let Some(outro) = outro_path {
                    println!("[Rust] MultiRegion: Processing outro video...");
                    outro_file = Some(
                        prepare_intro_outro_for_concat(
                            app,
                            outro,
                            &temp_dir,
                            "outro",
                            &aspect_ratio,
                            quality,
                            frame_rate,
                            output_w,
                            output_h,
                            intro_outro_cache.clone(),
                        )
                        .await?,
                    );
                }

                // Move the main clip to temp and concatenate
                let main_clip_temp = temp_dir.join("main_clip.mp4");
                std::fs::copy(output_path, &main_clip_temp)
                    .map_err(|e| format!("Failed to copy main clip: {}", e))?;

                // Build concat list
                let concat_list_path = temp_dir.join("concat_list.txt");
                let mut concat_content = String::new();

                if let Some(ref intro) = intro_file {
                    concat_content.push_str(&format!("file '{}'\n", intro.to_string_lossy().replace("\\", "/")));
                }

                concat_content.push_str(&format!("file '{}'\n", main_clip_temp.to_string_lossy().replace("\\", "/")));

                if let Some(ref outro) = outro_file {
                    concat_content.push_str(&format!("file '{}'\n", outro.to_string_lossy().replace("\\", "/")));
                }

                std::fs::write(&concat_list_path, concat_content)
                    .map_err(|e| format!("Failed to write concat list: {}", e))?;

                // Run FFmpeg concat
                println!("[Rust] MultiRegion: Concatenating intro/main/outro...");
                let output = app
                    .shell()
                    .sidecar("ffmpeg")
                    .unwrap()
                    .args([
                        "-nostdin",
                        "-f",
                        "concat",
                        "-safe",
                        "0",
                        "-i",
                        &concat_list_path.to_string_lossy(),
                        "-c",
                        "copy",
                        "-movflags",
                        "+faststart",
                        "-y",
                        &output_path.to_string_lossy(),
                    ])
                    .output()
                    .await
                    .map_err(|e| format!("Failed to run ffmpeg concat: {}", e))?;

                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("FFmpeg concat failed: {}", stderr));
                }

                println!("[Rust] MultiRegion: Concatenation complete");

                // Clean up temp directory
                let _ = std::fs::remove_dir_all(&temp_dir);
            }
        }
    }

    // Apply watermark if enabled (after all other processing)
    if let Some(wm) = watermark_settings {
        if wm.enabled {
            apply_watermark_to_video_with_ratio(
                app,
                output_path,
                wm,
                quality,
                Some(target_aspect_ratio),
            )
            .await?;
        }
    }

    Ok(())
}

/// Builds a multi-segment clip with framing strategy applied.
///
/// This extracts each segment, applies the framing strategy, then concatenates them.
#[allow(clippy::too_many_arguments)]
pub async fn build_multi_segment_clip_with_framing_strategy(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segments: &[serde_json::Value],
    strategy: &FramingStrategy,
    target_aspect_ratio: &str, // Target aspect ratio (e.g., "9:16", "4:5", "1:1")
    quality: &str,
    frame_rate: u32,
    subtitle_path: Option<&std::path::Path>,
    intro_path: Option<&str>,
    outro_path: Option<&str>,
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>,
    watermark_settings: Option<&WatermarkSettings>,
    audio_settings: Option<&AudioSettings>,
    video_filter_segments: Option<&Vec<VideoFilterSegment>>,
    effects_filter_chain: Option<&str>,
) -> Result<(), String> {
    use futures::future::join_all;

    println!(
        "[Rust] Building multi-segment clip with framing strategy: {:?}, target: {}",
        strategy.mode, target_aspect_ratio
    );
    println!("[Rust] Processing {} segments", segments.len());

    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    // Extract each segment with framing applied in parallel
    let temp_files: Vec<std::path::PathBuf> = segments
        .iter()
        .enumerate()
        .map(|(i, _)| {
            paths
                .temp
                .join(format!("segment_framed_{}_{}.mp4", uuid::Uuid::new_v4(), i))
        })
        .collect();

    // Build each segment with framing strategy
    let target_aspect_ratio_owned = target_aspect_ratio.to_string();
    let effects_filter_owned = effects_filter_chain.map(|s| s.to_string());
    let segment_tasks: Vec<_> = segments
        .iter()
        .enumerate()
        .map(|(i, segment)| {
            let app = app.clone();
            let video_path = video_path.to_string();
            let temp_path = temp_files[i].clone();
            let strategy = strategy.clone();
            let quality = quality.to_string();
            let audio_settings = audio_settings.cloned();
            let video_filter_segments = video_filter_segments.cloned();
            let effects_filter = effects_filter_owned.clone();
            let target_ar = target_aspect_ratio_owned.clone();

            async move {
                println!(
                    "[Rust] Building framed segment {}/{}",
                    i + 1,
                    segments.len()
                );

                match strategy.mode {
                    FramingMode::SplitScreen => {
                        build_split_screen_clip(
                            &app,
                            &video_path,
                            &temp_path,
                            segment,
                            &strategy,
                            &target_ar,
                            &quality,
                            frame_rate,
                            audio_settings.as_ref(),
                            video_filter_segments.as_ref(),
                            effects_filter.as_deref(),
                        )
                        .await?;
                    }
                    FramingMode::DynamicPan => {
                        build_dynamic_pan_clip(
                            &app,
                            &video_path,
                            &temp_path,
                            segment,
                            &strategy,
                            &target_ar,
                            &quality,
                            frame_rate,
                            audio_settings.as_ref(),
                            video_filter_segments.as_ref(),
                            effects_filter.as_deref(),
                        )
                        .await?;
                    }
                    FramingMode::Static => {
                        // For static mode, use the target aspect ratio
                        let aspect_ratio = parse_aspect_ratio_string(&target_ar).unwrap_or(
                            super::types::AspectRatio {
                                width: 9.0,
                                height: 16.0,
                            },
                        );
                        extract_segment_with_crop(
                            &app,
                            &video_path,
                            &temp_path,
                            segment,
                            &aspect_ratio,
                            &quality,
                            frame_rate,
                            audio_settings.as_ref(),
                            video_filter_segments.as_ref(),
                            effects_filter.as_deref(),
                        )
                        .await?;
                    }
                    FramingMode::MultiRegion => {
                        // For multi-region mode, use the manual config
                        if let Some(multi_region) = &strategy.multi_region {
                            build_multi_region_clip(
                                &app,
                                &video_path,
                                &temp_path,
                                segment,
                                multi_region,
                                &target_ar,
                                &quality,
                                frame_rate,
                                audio_settings.as_ref(),
                                video_filter_segments.as_ref(),
                                effects_filter.as_deref(),
                            )
                            .await?;
                        } else {
                            // Fallback to static if no multi-region config
                            let aspect_ratio = parse_aspect_ratio_string(&target_ar).unwrap_or(
                                super::types::AspectRatio {
                                    width: 9.0,
                                    height: 16.0,
                                },
                            );
                            extract_segment_with_crop(
                                &app,
                                &video_path,
                                &temp_path,
                                segment,
                                &aspect_ratio,
                                &quality,
                                frame_rate,
                                audio_settings.as_ref(),
                                video_filter_segments.as_ref(),
                                effects_filter.as_deref(),
                            )
                            .await?;
                        }
                    }
                }

                Ok::<(), String>(())
            }
        })
        .collect();

    // Wait for all segments to be processed
    let results = join_all(segment_tasks).await;
    for (i, result) in results.into_iter().enumerate() {
        if let Err(e) = result {
            // Clean up temp files
            for temp_file in &temp_files {
                let _ = std::fs::remove_file(temp_file);
            }
            return Err(format!("Failed to build segment {}: {}", i + 1, e));
        }
    }

    println!(
        "[Rust] All {} segments processed, concatenating...",
        segments.len()
    );

    // Create concat file
    let concat_file = paths
        .temp
        .join(format!("concat_{}.txt", uuid::Uuid::new_v4()));
    let concat_content: String = temp_files
        .iter()
        .map(|f| format!("file '{}'", f.to_string_lossy().replace("\\", "/")))
        .collect::<Vec<_>>()
        .join("\n");

    std::fs::write(&concat_file, &concat_content)
        .map_err(|e| format!("Failed to write concat file: {}", e))?;

    // Determine if we need a temp output for post-processing
    let needs_post_processing =
        subtitle_path.is_some() || intro_path.is_some() || outro_path.is_some();
    let concat_output = if needs_post_processing {
        paths
            .temp
            .join(format!("concat_out_{}.mp4", uuid::Uuid::new_v4()))
    } else {
        output_path.to_path_buf()
    };

    // Concatenate segments
    let _shell = app.shell();
    let encoder = detect_hardware_encoder(app, quality).await;

    let mut args = build_hwaccel_args(&encoder, false);

    args.extend(vec![
        "-f".to_string(),
        "concat".to_string(),
        "-safe".to_string(),
        "0".to_string(),
        "-i".to_string(),
        concat_file.to_string_lossy().to_string(),
        "-c:v".to_string(),
        encoder.codec.clone(),
    ]);

    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    args.extend_from_slice(&[
        "-c:a".to_string(),
        "copy".to_string(),
        "-r".to_string(),
        frame_rate.to_string(),
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        "-movflags".to_string(),
        "+faststart".to_string(),
        "-y".to_string(),
        concat_output.to_string_lossy().to_string(),
    ]);

    // Use fallback helper for hardware encoder resilience
    run_ffmpeg_with_fallback(app, args, &encoder, quality, None)
        .await
        .map_err(|e| format!("FFmpeg concat failed: {}", e))?;

    // Clean up segment temp files
    for temp_file in &temp_files {
        let _ = std::fs::remove_file(temp_file);
    }
    let _ = std::fs::remove_file(&concat_file);

    // Add subtitles if needed
    if let Some(sub_path) = subtitle_path {
        burn_subtitles_to_video(app, &concat_output, output_path, sub_path, quality).await?;
        if needs_post_processing {
            let _ = std::fs::remove_file(&concat_output);
        }
    } else if concat_output != output_path.to_path_buf() {
        // Move to final output
        std::fs::rename(&concat_output, output_path)
            .map_err(|e| format!("Failed to move output: {}", e))?;
    }

    // Note: Intro/outro not yet supported for framing strategy multi-segment builds
    // The intro/outro cache is available but would need additional implementation
    let _ = intro_path;
    let _ = outro_path;
    let _ = intro_outro_cache;

    // Apply watermark if enabled
    if let Some(wm) = watermark_settings {
        if wm.enabled {
            apply_watermark_to_video_with_ratio(
                app,
                output_path,
                wm,
                quality,
                Some(target_aspect_ratio),
            )
            .await?;
        }
    }

    println!("[Rust] Multi-segment framed clip built successfully");
    Ok(())
}

/// Helper to extract a segment with simple center crop (for Static framing mode)
#[allow(clippy::too_many_arguments)]
async fn extract_segment_with_crop(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    aspect_ratio: &super::types::AspectRatio,
    quality: &str,
    frame_rate: u32,
    audio_settings: Option<&AudioSettings>,
    video_filter_segments: Option<&Vec<VideoFilterSegment>>,
    effects_filter_chain: Option<&str>,
) -> Result<(), String> {
    // Build combined filter string (color grading + effects)
    let video_filter_str =
        build_combined_filter_string(video_filter_segments, effects_filter_chain);
    let _shell = app.shell();
    let encoder = detect_hardware_encoder(app, quality).await;

    let start = segment
        .get("start_time")
        .and_then(|v| v.as_f64())
        .ok_or("Missing start_time")?;
    let end = segment
        .get("end_time")
        .and_then(|v| v.as_f64())
        .ok_or("Missing end_time")?;
    let duration = end - start;

    // Get video dimensions for crop calculation
    let video_info = get_video_info(app, video_path).await?;
    let (crop_w, crop_h, crop_x, crop_y) =
        calculate_crop_params(video_info.width, video_info.height, aspect_ratio);

    // Build crop filter with optional time-based color grading
    let crop_filter = format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y);
    let scale_filter = "scale=1080:1920:flags=lanczos";

    // Add time-based color grading filters if present
    let vf = if let Some(ref filter_str) = video_filter_str {
        println!(
            "[Rust] Applying time-based video color filters in extract_segment_with_crop: {}",
            filter_str
        );
        format!("{},{},{}", crop_filter, filter_str, scale_filter)
    } else {
        format!("{},{}", crop_filter, scale_filter)
    };

    let mut args = build_hwaccel_args(&encoder, true);

    // Combined seeking: input seek (fast) to ~5s before, then output seek (accurate)
    let input_seek = (start - 5.0).max(0.0);
    let output_seek = start - input_seek;

    args.extend(vec![
        "-ss".to_string(),
        format!("{:.3}", input_seek),
        "-i".to_string(),
        video_path.to_string(),
        "-ss".to_string(),
        format!("{:.3}", output_seek),
        "-t".to_string(),
        duration.to_string(),
        "-vf".to_string(),
        vf,
        "-c:v".to_string(),
        encoder.codec.clone(),
    ]);

    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    // Audio filter
    let mut af_parts = Vec::new();
    if let Some(settings) = audio_settings {
        if settings.volume != 0.0 {
            af_parts.push(format!("volume={}dB", settings.volume));
        }
    }

    if !af_parts.is_empty() {
        args.push("-af".to_string());
        args.push(af_parts.join(","));
    }

    let has_audio_filter = !af_parts.is_empty();
    args.extend_from_slice(&[
        "-c:a".to_string(),
        if has_audio_filter {
            "aac".to_string()
        } else {
            "copy".to_string()
        },
        "-r".to_string(),
        frame_rate.to_string(),
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        "-movflags".to_string(),
        "+faststart".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);
    if has_audio_filter {
        args.extend_from_slice(&["-b:a".to_string(), "192k".to_string()]);
    }

    // Use fallback helper for hardware encoder resilience
    run_ffmpeg_with_fallback(app, args, &encoder, quality, None)
        .await
        .map_err(|e| format!("FFmpeg crop failed: {}", e))?;

    Ok(())
}

/// Burns subtitles onto a video file.
async fn burn_subtitles_to_video(
    app: &tauri::AppHandle,
    input_path: &std::path::Path,
    output_path: &std::path::Path,
    subtitle_path: &std::path::Path,
    quality: &str,
) -> Result<(), String> {
    let _shell = app.shell();
    let encoder = detect_hardware_encoder(app, quality).await;

    let sub_arg = subtitle_path
        .to_string_lossy()
        .replace("\\", "/")
        .replace(":", "\\:");
    
    // Build ass filter without fontsdir parameter to avoid path escaping issues
    // libass will use system fonts by default
    let vf_arg = format!("format=rgb24,ass='{}'", sub_arg);

    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;
    let fontconfig_path = paths.temp.join("fonts.conf");

    let mut args = build_hwaccel_args(&encoder, true);

    args.extend(vec![
        "-i".to_string(),
        input_path.to_string_lossy().to_string(),
        "-vf".to_string(),
        vf_arg,
        "-c:v".to_string(),
        encoder.codec.clone(),
    ]);

    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    args.extend_from_slice(&[
        "-c:a".to_string(),
        "copy".to_string(),
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        "-movflags".to_string(),
        "+faststart".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    // Use fallback helper for hardware encoder resilience
    let env_vars = vec![(
        "FONTCONFIG_FILE",
        fontconfig_path.to_string_lossy().to_string(),
    )];
    run_ffmpeg_with_fallback(app, args, &encoder, quality, Some(env_vars))
        .await
        .map_err(|e| format!("FFmpeg subtitle burning failed: {}", e))?;

    Ok(())
}

/// Apply sticker overlays to a video file
/// This handles emoji, image, and gif stickers with position, scale, rotation and timing
pub async fn apply_stickers_to_video(
    app: &tauri::AppHandle,
    input_path: &std::path::Path,
    stickers: &[StickerSettings],
    aspect_ratio: &str,
    quality: &str,
) -> Result<(), String> {
    if stickers.is_empty() {
        return Ok(());
    }

    let _shell = app.shell();

    // Get video info for calculating sticker positions
    let video_info = get_video_info(app, input_path.to_str().ok_or("Invalid input path")?).await?;
    let video_width = video_info.width as f64;
    let video_height = video_info.height as f64;

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Create temporary output path
    let temp_output = input_path.with_extension("stickers.mp4");

    // Separate emoji and image stickers
    let emoji_stickers: Vec<_> = stickers
        .iter()
        .filter(|s| s.sticker_type == "emoji")
        .collect();
    let image_stickers: Vec<_> = stickers
        .iter()
        .filter(|s| s.sticker_type == "image" || s.sticker_type == "gif")
        .collect();

    // Build filter complex for stickers
    let mut filter_parts: Vec<String> = Vec::new();
    let mut input_count = 1; // Start from 1 (0 is the main video)
    let mut overlay_inputs: Vec<String> = Vec::new();

    // Label the main video
    filter_parts.push("[0:v]null[base]".to_string());
    let mut current_label = "base".to_string();

    // Process emoji stickers using drawtext filter
    for (idx, sticker) in emoji_stickers.iter().enumerate() {
        // Get position for this aspect ratio (fallback to default)
        let (pos_x_pct, pos_y_pct, scale, _rotation) =
            if let Some(ref configs) = sticker.per_ratio_configs {
                if let Some(config) = configs.get(aspect_ratio) {
                    (
                        config.position.x,
                        config.position.y,
                        config.scale,
                        config.rotation,
                    )
                } else {
                    (
                        sticker.position_x,
                        sticker.position_y,
                        sticker.scale,
                        sticker.rotation,
                    )
                }
            } else {
                (
                    sticker.position_x,
                    sticker.position_y,
                    sticker.scale,
                    sticker.rotation,
                )
            };

        // Calculate pixel position (center-anchored)
        let pos_x = (pos_x_pct / 100.0 * video_width) as i32;
        let pos_y = (pos_y_pct / 100.0 * video_height) as i32;

        // Base font size for emojis at 1080p (48px scaled)
        let base_font_size = 48.0 * (video_height / 1080.0) * scale;
        let font_size = base_font_size.round() as u32;

        // Escape the emoji text for FFmpeg
        let emoji_escaped = sticker
            .sticker_path
            .replace("'", "'\\''")
            .replace(":", "\\:");

        let next_label = format!("e{}", idx);

        // Build drawtext filter with enable expression for timing
        // Note: drawtext doesn't support rotation well, so we use it only for basic emoji display
        let drawtext = format!(
            "[{}]drawtext=text='{}':fontsize={}:x={}-(text_w/2):y={}-(text_h/2):enable='between(t,{:.3},{:.3})'[{}]",
            current_label,
            emoji_escaped,
            font_size,
            pos_x,
            pos_y,
            sticker.start_time,
            sticker.end_time,
            next_label
        );

        filter_parts.push(drawtext);
        current_label = next_label;
    }

    // Process image stickers using overlay filter
    for (idx, sticker) in image_stickers.iter().enumerate() {
        // Get position for this aspect ratio (fallback to default)
        let (pos_x_pct, pos_y_pct, scale, rotation) =
            if let Some(ref configs) = sticker.per_ratio_configs {
                if let Some(config) = configs.get(aspect_ratio) {
                    (
                        config.position.x,
                        config.position.y,
                        config.scale,
                        config.rotation,
                    )
                } else {
                    (
                        sticker.position_x,
                        sticker.position_y,
                        sticker.scale,
                        sticker.rotation,
                    )
                }
            } else {
                (
                    sticker.position_x,
                    sticker.position_y,
                    sticker.scale,
                    sticker.rotation,
                )
            };

        // Calculate pixel position (center-anchored)
        let pos_x = (pos_x_pct / 100.0 * video_width) as i32;
        let pos_y = (pos_y_pct / 100.0 * video_height) as i32;

        // Calculate scaled size (base size is 10% of video height, then apply scale)
        let base_size = (video_height * 0.1) as i32;
        let scaled_size = (base_size as f64 * scale).round() as i32;

        let sticker_label = format!("st{}", idx);
        let next_label = format!("o{}", idx);

        // Scale and rotate the sticker image
        // Note: rotation in FFmpeg is in radians, frontend uses degrees
        let rotation_rad = rotation * std::f64::consts::PI / 180.0;

        // Build sticker preprocessing filter
        let sticker_filter = if rotation.abs() > 0.01 {
            format!(
                "[{}:v]scale={}:-1,rotate={}:c=none:ow=rotw({}):oh=roth({})[{}]",
                input_count, scaled_size, rotation_rad, rotation_rad, rotation_rad, sticker_label
            )
        } else {
            format!(
                "[{}:v]scale={}:-1[{}]",
                input_count, scaled_size, sticker_label
            )
        };

        filter_parts.push(sticker_filter);

        // Overlay with timing and center-anchor positioning
        // x and y are adjusted to center the sticker on the position
        let overlay = format!(
            "[{}][{}]overlay=x={}-(overlay_w/2):y={}-(overlay_h/2):enable='between(t,{:.3},{:.3})'[{}]",
            current_label,
            sticker_label,
            pos_x,
            pos_y,
            sticker.start_time,
            sticker.end_time,
            next_label
        );

        filter_parts.push(overlay);
        current_label = next_label;

        overlay_inputs.push(sticker.sticker_path.clone());
        input_count += 1;
    }

    // If we have no filters, return early
    if filter_parts.len() <= 1 {
        return Ok(());
    }

    // Build FFmpeg args
    let mut args = vec!["-i".to_string(), input_path.to_string_lossy().to_string()];

    // Add image sticker inputs
    for sticker_path in &overlay_inputs {
        args.push("-i".to_string());
        args.push(sticker_path.clone());
    }

    // Build filter complex string
    let filter_complex = filter_parts.join(";");

    args.extend(vec![
        "-filter_complex".to_string(),
        filter_complex,
        "-map".to_string(),
        format!("[{}]", current_label),
        "-map".to_string(),
        "0:a?".to_string(), // Map audio if present
        "-c:v".to_string(),
        encoder.codec.clone(),
    ]);

    // Add preset if applicable
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    // Add audio settings
    args.push("-c:a".to_string());
    args.push("copy".to_string());
    args.push("-y".to_string());
    args.push(temp_output.to_string_lossy().to_string());

    println!("[Rust] Applying {} stickers to video", stickers.len());

    // Use fallback helper for hardware encoder resilience
    run_ffmpeg_with_fallback(app, args, &encoder, quality, None)
        .await
        .map_err(|e| format!("FFmpeg sticker overlay failed: {}", e))?;

    // Replace original with sticker-overlayed version
    std::fs::remove_file(input_path)
        .map_err(|e| format!("Failed to remove original file: {}", e))?;
    std::fs::rename(&temp_output, input_path)
        .map_err(|e| format!("Failed to rename sticker output: {}", e))?;

    println!("[Rust] Stickers applied successfully");
    Ok(())
}

/// Apply clip watermark overlays to a video file
/// This handles watermarks from the clip editor with position, scale, opacity and timing
pub async fn apply_clip_watermarks_to_video(
    app: &tauri::AppHandle,
    input_path: &std::path::Path,
    watermarks: &[super::types::ClipWatermarkSettings],
    aspect_ratio: &str,
    quality: &str,
) -> Result<(), String> {
    if watermarks.is_empty() {
        return Ok(());
    }

    let _shell = app.shell();

    // Get video info for calculating watermark positions
    let video_info = get_video_info(app, input_path.to_str().ok_or("Invalid input path")?).await?;
    let video_width = video_info.width as f64;
    let video_height = video_info.height as f64;

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Create temporary output path
    let temp_output = input_path.with_extension("watermarks.mp4");

    // Build filter complex for watermarks
    let mut filter_parts: Vec<String> = Vec::new();
    let mut input_count = 1; // Start from 1 (0 is the main video)
    let mut overlay_inputs: Vec<String> = Vec::new();

    // Label the main video
    filter_parts.push("[0:v]null[base]".to_string());
    let mut current_label = "base".to_string();

    // Process watermarks using overlay filter
    for (idx, watermark) in watermarks.iter().enumerate() {
        // Get position and settings for this aspect ratio (fallback to default)
        let (pos_x_pct, pos_y_pct, scale, opacity, is_full_frame) =
            if let Some(ref configs) = watermark.per_ratio_configs {
                if let Some(config) = configs.get(aspect_ratio) {
                    (
                        config.position.x,
                        config.position.y,
                        config.scale,
                        config.opacity,
                        config.is_full_frame_overlay.unwrap_or(false),
                    )
                } else {
                    (
                        watermark.position_x,
                        watermark.position_y,
                        watermark.scale,
                        watermark.opacity,
                        false,
                    )
                }
            } else {
                (
                    watermark.position_x,
                    watermark.position_y,
                    watermark.scale,
                    watermark.opacity,
                    false,
                )
            };

        // Calculate alpha (opacity is 0-100)
        let alpha = opacity / 100.0;

        let watermark_label = format!("wm{}", idx);
        let next_label = format!("wo{}", idx);

        // Build watermark preprocessing and overlay based on full-frame mode
        let (watermark_filter, overlay) = if is_full_frame {
            // Full-frame overlay: scale to video size, position at 0,0
            let wm_filter = format!(
                "[{}:v]scale={}:{},format=rgba,colorchannelmixer=aa={}[{}]",
                input_count, video_width as i32, video_height as i32, alpha, watermark_label
            );

            let ovl = format!(
                "[{}][{}]overlay=0:0:enable='between(t,{:.3},{:.3})'[{}]",
                current_label,
                watermark_label,
                watermark.start_time,
                watermark.end_time,
                next_label
            );

            println!(
                "[Rust] Clip watermark {} using FULL-FRAME mode: video={}x{}, alpha={}",
                idx, video_width as i32, video_height as i32, alpha
            );

            (wm_filter, ovl)
        } else {
            // Standard positioning with center-anchor
            // Calculate pixel position (center-anchored)
            let pos_x = (pos_x_pct / 100.0 * video_width) as i32;
            let pos_y = (pos_y_pct / 100.0 * video_height) as i32;

            // Calculate scaled width (scale is percentage of video width)
            let scaled_width = (video_width * scale / 100.0).round() as i32;

            // Build watermark preprocessing filter with scale and alpha
            // format=rgba ensures we have alpha channel, colorchannelmixer modifies the alpha
            let wm_filter = format!(
                "[{}:v]scale={}:-1,format=rgba,colorchannelmixer=aa={}[{}]",
                input_count, scaled_width, alpha, watermark_label
            );

            // Overlay with timing and center-anchor positioning
            let ovl = format!(
                "[{}][{}]overlay=x={}-(overlay_w/2):y={}-(overlay_h/2):enable='between(t,{:.3},{:.3})'[{}]",
                current_label,
                watermark_label,
                pos_x,
                pos_y,
                watermark.start_time,
                watermark.end_time,
                next_label
            );

            println!(
                "[Rust] Clip watermark {} using STANDARD mode: pos=({}, {}), scale={}, alpha={}",
                idx, pos_x, pos_y, scaled_width, alpha
            );

            (wm_filter, ovl)
        };

        filter_parts.push(watermark_filter);
        filter_parts.push(overlay);
        current_label = next_label;

        overlay_inputs.push(watermark.watermark_path.clone());
        input_count += 1;
    }

    // If we have no filters, return early
    if filter_parts.len() <= 1 {
        return Ok(());
    }

    // Build FFmpeg args with hardware acceleration
    let mut args = build_hwaccel_args(&encoder, true);

    args.extend(vec![
        "-i".to_string(),
        input_path.to_string_lossy().to_string(),
    ]);

    // Add watermark inputs with loop flags for video files
    for watermark_path in &overlay_inputs {
        if is_video_file(watermark_path) {
            args.push("-stream_loop".to_string());
            args.push("-1".to_string());
        }
        args.push("-i".to_string());
        args.push(watermark_path.clone());
    }

    // Build filter complex string
    let filter_complex = filter_parts.join(";");

    args.extend(vec![
        "-filter_complex".to_string(),
        filter_complex,
        "-shortest".to_string(), // Stop when shortest input ends
        "-map".to_string(),
        format!("[{}]", current_label),
        "-map".to_string(),
        "0:a?".to_string(), // Map audio if present
        "-c:v".to_string(),
        encoder.codec.clone(),
    ]);

    // Add preset if applicable
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    // Add audio settings
    args.push("-c:a".to_string());
    args.push("copy".to_string());
    args.push("-y".to_string());
    args.push(temp_output.to_string_lossy().to_string());

    println!(
        "[Rust] Applying {} clip watermarks to video",
        watermarks.len()
    );

    // Use fallback helper for hardware encoder resilience
    run_ffmpeg_with_fallback(app, args, &encoder, quality, None)
        .await
        .map_err(|e| format!("FFmpeg clip watermark overlay failed: {}", e))?;

    // Replace original with watermark-overlayed version
    std::fs::remove_file(input_path)
        .map_err(|e| format!("Failed to remove original file: {}", e))?;
    std::fs::rename(&temp_output, input_path)
        .map_err(|e| format!("Failed to rename watermark output: {}", e))?;

    println!("[Rust] Clip watermarks applied successfully");
    Ok(())
}

/// Apply layout overlays to a video file (from creator profile or VOD preset)
/// These are static image overlays (borders, decorative elements) that cover the full clip duration
pub async fn apply_layout_overlays_to_video(
    app: &tauri::AppHandle,
    input_path: &std::path::Path,
    overlays: &[super::types::LayoutOverlaySettings],
    aspect_ratio: &str,
    quality: &str,
) -> Result<(), String> {
    if overlays.is_empty() {
        return Ok(());
    }

    let video_info = get_video_info(app, input_path.to_str().ok_or("Invalid input path")?).await?;
    let video_width = video_info.width as f64;
    let video_height = video_info.height as f64;

    let encoder = detect_hardware_encoder(app, quality).await;

    let temp_output = input_path.with_extension("overlays.mp4");

    let mut filter_parts: Vec<String> = Vec::new();
    let mut input_count = 1;
    let mut overlay_inputs: Vec<String> = Vec::new();

    filter_parts.push("[0:v]null[base]".to_string());
    let mut current_label = "base".to_string();

    for (idx, overlay) in overlays.iter().enumerate() {
        // Resolve per-ratio settings (like watermarks do with per_ratio_configs)
        let (pos_x_pct, pos_y_pct, scale_val, alpha, is_full_frame) =
            if let Some(ref configs) = overlay.per_ratio_settings {
                if let Some(Some(config)) = configs.get(aspect_ratio) {
                    let s = if config.scale > 0.0 {
                        config.scale
                    } else if config.width > 0.0 {
                        config.width
                    } else if overlay.scale > 0.0 {
                        overlay.scale
                    } else {
                        overlay.width
                    };
                    (
                        config.x,
                        config.y,
                        s,
                        config.opacity / 100.0,
                        config.is_full_frame_overlay.unwrap_or(false),
                    )
                } else {
                    let s = if overlay.scale > 0.0 {
                        overlay.scale
                    } else {
                        overlay.width
                    };
                    (
                        overlay.x,
                        overlay.y,
                        s,
                        overlay.opacity / 100.0,
                        overlay.is_full_frame_overlay.unwrap_or(false),
                    )
                }
            } else {
                let s = if overlay.scale > 0.0 {
                    overlay.scale
                } else {
                    overlay.width
                };
                (
                    overlay.x,
                    overlay.y,
                    s,
                    overlay.opacity / 100.0,
                    overlay.is_full_frame_overlay.unwrap_or(false),
                )
            };

        let ovl_label = format!("ol{}", idx);
        let next_label = format!("oo{}", idx);

        let (ovl_filter, ovl_cmd) = if is_full_frame {
            let f = format!(
                "[{}:v]scale={}:{},format=rgba,colorchannelmixer=aa={}[{}]",
                input_count, video_width as i32, video_height as i32, alpha, ovl_label
            );
            let o = format!(
                "[{}][{}]overlay=0:0[{}]",
                current_label, ovl_label, next_label
            );
            println!(
                "[Rust] Layout overlay {} FULL-FRAME: {}x{}, alpha={}",
                idx, video_width as i32, video_height as i32, alpha
            );
            (f, o)
        } else {
            let pos_x = (pos_x_pct / 100.0 * video_width) as i32;
            let pos_y = (pos_y_pct / 100.0 * video_height) as i32;
            let scaled_width = (video_width * scale_val / 100.0).round() as i32;

            let f = format!(
                "[{}:v]scale={}:-1,format=rgba,colorchannelmixer=aa={}[{}]",
                input_count, scaled_width, alpha, ovl_label
            );
            let o = format!(
                "[{}][{}]overlay=x={}-(overlay_w/2):y={}-(overlay_h/2)[{}]",
                current_label, ovl_label, pos_x, pos_y, next_label
            );
            println!(
                "[Rust] Layout overlay {} STANDARD: pos=({}, {}), scale={}, alpha={}",
                idx, pos_x, pos_y, scaled_width, alpha
            );
            (f, o)
        };

        filter_parts.push(ovl_filter);
        filter_parts.push(ovl_cmd);
        current_label = next_label;

        overlay_inputs.push(overlay.image_path.clone());
        input_count += 1;
    }

    if filter_parts.len() <= 1 {
        return Ok(());
    }

    let mut args = build_hwaccel_args(&encoder, true);

    args.extend(vec![
        "-i".to_string(),
        input_path.to_string_lossy().to_string(),
    ]);

    // Add overlay inputs with loop flags for video files
    for path in &overlay_inputs {
        if is_video_file(path) {
            args.push("-stream_loop".to_string());
            args.push("-1".to_string());
        }
        args.push("-i".to_string());
        args.push(path.clone());
    }

    let filter_complex = filter_parts.join(";");

    args.extend(vec![
        "-filter_complex".to_string(),
        filter_complex,
        "-shortest".to_string(), // Stop when shortest input ends
        "-map".to_string(),
        format!("[{}]", current_label),
        "-map".to_string(),
        "0:a?".to_string(),
        "-c:v".to_string(),
        encoder.codec.clone(),
    ]);

    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    args.push("-c:a".to_string());
    args.push("copy".to_string());
    args.push("-y".to_string());
    args.push(temp_output.to_string_lossy().to_string());

    println!(
        "[Rust] Applying {} layout overlays to video",
        overlays.len()
    );

    run_ffmpeg_with_fallback(app, args, &encoder, quality, None)
        .await
        .map_err(|e| format!("FFmpeg layout overlay failed: {}", e))?;

    std::fs::remove_file(input_path)
        .map_err(|e| format!("Failed to remove original file: {}", e))?;
    std::fs::rename(&temp_output, input_path)
        .map_err(|e| format!("Failed to rename overlay output: {}", e))?;

    println!("[Rust] Layout overlays applied successfully");
    Ok(())
}

/// Apply rendered text overlay images to a video file
/// This handles advanced text overlays that were pre-rendered to PNG (chat bubbles, gradients, glows, etc.)
pub async fn apply_rendered_text_overlays_to_video(
    app: &tauri::AppHandle,
    input_path: &std::path::Path,
    rendered_overlays: &[(String, super::types::TextOverlaySettings)], // (image_path, overlay_settings)
    aspect_ratio: &str,
    quality: &str,
    time_offset: f64, // Intro duration offset for timing
) -> Result<(), String> {
    if rendered_overlays.is_empty() {
        return Ok(());
    }

    // Get video info for calculating positions
    let video_info = get_video_info(app, input_path.to_str().ok_or("Invalid input path")?).await?;
    let video_width = video_info.width as f64;
    let video_height = video_info.height as f64;

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Create temporary output path
    let temp_output = input_path.with_extension("textimg.mp4");

    // Build filter complex for text image overlays
    let mut filter_parts: Vec<String> = Vec::new();
    let mut input_count = 1; // Start from 1 (0 is the main video)
    let mut overlay_inputs: Vec<String> = Vec::new();

    // Label the main video
    filter_parts.push("[0:v]null[base]".to_string());
    let mut current_label = "base".to_string();

    // Process each rendered text overlay
    for (idx, (image_path, overlay)) in rendered_overlays.iter().enumerate() {
        // Get position for this aspect ratio (fallback to default)
        let (pos_x_pct, pos_y_pct) = if let Some(ref configs) = overlay.per_ratio_configs {
            if let Some(config) = configs.get(aspect_ratio) {
                (config.position.x, config.position.y)
            } else {
                (overlay.position_x, overlay.position_y)
            }
        } else {
            (overlay.position_x, overlay.position_y)
        };

        // Calculate pixel position (center-anchored)
        let pos_x = (pos_x_pct / 100.0 * video_width) as i32;
        let pos_y = (pos_y_pct / 100.0 * video_height) as i32;

        let text_label = format!("txt{}", idx);
        let next_label = format!("to{}", idx);

        // Prepare the text image (ensure RGBA format)
        let text_filter = format!("[{}:v]format=rgba[{}]", input_count, text_label);

        filter_parts.push(text_filter);

        // Overlay with timing and center-anchor positioning
        // Add time_offset (intro duration) to timing so overlays appear at correct time
        let adjusted_start = overlay.start_time + time_offset;
        let adjusted_end = overlay.end_time + time_offset;
        let overlay_filter = format!(
            "[{}][{}]overlay=x={}-(overlay_w/2):y={}-(overlay_h/2):enable='between(t,{:.3},{:.3})'[{}]",
            current_label,
            text_label,
            pos_x,
            pos_y,
            adjusted_start,
            adjusted_end,
            next_label
        );

        filter_parts.push(overlay_filter);
        current_label = next_label;

        overlay_inputs.push(image_path.clone());
        input_count += 1;
    }

    // If we have no filters, return early
    if filter_parts.len() <= 1 {
        return Ok(());
    }

    // Build FFmpeg args
    let mut args = vec!["-i".to_string(), input_path.to_string_lossy().to_string()];

    // Add text image inputs
    for image_path in &overlay_inputs {
        args.push("-i".to_string());
        args.push(image_path.clone());
    }

    // Build filter complex string
    let filter_complex = filter_parts.join(";");
    println!("[Rust] TEXT OVERLAY FILTER: {}", filter_complex);

    args.extend(vec![
        "-filter_complex".to_string(),
        filter_complex,
        "-map".to_string(),
        format!("[{}]", current_label),
        "-map".to_string(),
        "0:a?".to_string(), // Map audio if present
        "-c:v".to_string(),
        encoder.codec.clone(),
    ]);

    // Add preset if applicable
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    // Add audio settings
    args.push("-c:a".to_string());
    args.push("copy".to_string());
    args.push("-y".to_string());
    args.push(temp_output.to_string_lossy().to_string());

    println!(
        "[Rust] Applying {} rendered text overlays to video",
        rendered_overlays.len()
    );
    println!("[Rust] TEXT OVERLAY ARGS: {:?}", args);

    // Use fallback helper for hardware encoder resilience
    run_ffmpeg_with_fallback(app, args, &encoder, quality, None)
        .await
        .map_err(|e| format!("FFmpeg rendered text overlay failed: {}", e))?;

    // Replace original with text-overlayed version
    std::fs::remove_file(input_path)
        .map_err(|e| format!("Failed to remove original file: {}", e))?;
    std::fs::rename(&temp_output, input_path)
        .map_err(|e| format!("Failed to rename text overlay output: {}", e))?;

    println!("[Rust] Rendered text overlays applied successfully");
    Ok(())
}

/// Apply pre-rendered subtitle overlay images to a video file
/// This handles pixel-perfect subtitle rendering by compositing pre-rendered PNG frames
pub async fn apply_subtitle_overlays_to_video(
    app: &tauri::AppHandle,
    input_path: &std::path::Path,
    subtitle_overlays: &[super::types::SubtitleOverlaySettings],
    quality: &str,
) -> Result<(), String> {
    if subtitle_overlays.is_empty() {
        return Ok(());
    }

    println!(
        "[Rust] Applying {} pre-rendered subtitle overlays to video (pixel-perfect mode)",
        subtitle_overlays.len()
    );

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Create temporary output path
    let temp_output = input_path.with_extension("subtitles.mp4");

    // Build filter complex for subtitle overlays
    let mut filter_parts: Vec<String> = Vec::new();
    let mut input_count = 1; // Start from 1 (0 is the main video)
    let mut overlay_inputs: Vec<String> = Vec::new();

    // Label the main video
    filter_parts.push("[0:v]null[base]".to_string());
    let mut current_label = "base".to_string();

    // Process each subtitle overlay frame
    for (idx, overlay) in subtitle_overlays.iter().enumerate() {
        // Subtitle overlays are full-frame PNGs already positioned correctly
        // The text is already rendered at the correct position within the PNG

        let sub_label = format!("sub{}", idx);
        let next_label = format!("so{}", idx);

        // Prepare the subtitle image (ensure RGBA format)
        let sub_filter = format!("[{}:v]format=rgba[{}]", input_count, sub_label);
        filter_parts.push(sub_filter);

        // Overlay with timing - subtitle PNGs are full-frame so we position at 0,0
        // The PNG already contains the positioned text on a transparent background
        let overlay_filter = format!(
            "[{}][{}]overlay=x=0:y=0:enable='between(t,{:.3},{:.3})'[{}]",
            current_label,
            sub_label,
            overlay.start_time,
            overlay.end_time,
            next_label
        );

        filter_parts.push(overlay_filter);
        current_label = next_label;

        overlay_inputs.push(overlay.image_path.clone());
        input_count += 1;
    }

    // If we have no filters, return early
    if filter_parts.len() <= 1 {
        return Ok(());
    }

    // Build FFmpeg args
    let mut args = vec!["-i".to_string(), input_path.to_string_lossy().to_string()];

    // Add subtitle image inputs
    for image_path in &overlay_inputs {
        args.push("-i".to_string());
        args.push(image_path.clone());
    }

    // Build filter complex string
    let filter_complex = filter_parts.join(";");
    let filter_complex_len = filter_complex.len();

    args.extend(vec![
        "-filter_complex".to_string(),
        filter_complex,
        "-map".to_string(),
        format!("[{}]", current_label),
        "-map".to_string(),
        "0:a?".to_string(), // Map audio if present
        "-c:v".to_string(),
        encoder.codec.clone(),
    ]);

    // Add preset if applicable
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    // Add audio settings
    args.push("-c:a".to_string());
    args.push("copy".to_string());
    args.push("-y".to_string());
    args.push(temp_output.to_string_lossy().to_string());

    println!(
        "[Rust] FFmpeg command for subtitle overlays: {} inputs, filter_complex length: {}",
        overlay_inputs.len() + 1,
        filter_complex_len
    );

    // Use fallback helper for hardware encoder resilience
    run_ffmpeg_with_fallback(app, args, &encoder, quality, None)
        .await
        .map_err(|e| format!("FFmpeg subtitle overlay failed: {}", e))?;

    // Replace original with subtitled version
    std::fs::remove_file(input_path)
        .map_err(|e| format!("Failed to remove original file: {}", e))?;
    std::fs::rename(&temp_output, input_path)
        .map_err(|e| format!("Failed to rename subtitle overlay output: {}", e))?;

    println!("[Rust] Pre-rendered subtitle overlays applied successfully");
    Ok(())
}

/// Segment definition for preview generation
#[derive(Debug, serde::Deserialize)]
pub struct PreviewSegment {
    pub start_time: f64, // Start time in source video (seconds)
    pub end_time: f64,   // End time in source video (seconds)
}

/// Preview tier for progressive cache
#[allow(dead_code)]
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PreviewTier {
    Proxy, // 720p, fast encode
    Hq,    // 1080p, balanced encode
}

/// Timeline segment for preview chunk rendering
/// Maps edited timeline time to source video time
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineSegment {
    pub source_start: f64,   // Start time in source video
    pub source_end: f64,     // End time in source video
    pub timeline_start: f64, // Start time in edited timeline
    pub timeline_end: f64,   // End time in edited timeline
}

/// Preview chunk generation result
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewChunkResult {
    pub chunk_index: u32,
    pub output_path: String,
    pub duration: f64,
}

/// Preview manifest result
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewManifestResult {
    pub manifest_path: String,
    pub streaming_url: String,
    pub chunk_count: u32,
    pub total_duration: f64,
}

/// Generate a low-quality preview video with all segment cuts pre-applied.
/// This eliminates runtime seeking by creating a single continuous video file.
///
/// Returns the path to the generated preview video file.
#[tauri::command]
pub async fn generate_segment_preview(
    app: tauri::AppHandle,
    video_path: String,
    segments: Vec<PreviewSegment>,
    output_filename: String,
) -> Result<String, String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] generate_segment_preview called:");
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   segments count: {}", segments.len());
    println!("[Rust]   output_filename: {}", output_filename);

    if segments.is_empty() {
        return Err("No segments provided for preview generation".to_string());
    }

    // Get storage paths for temporary files
    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    // Create temp directory for this preview generation
    let preview_id = uuid::Uuid::new_v4();
    let temp_dir = paths.temp.join(format!("preview_{}", preview_id));
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // Preview output directory (persistent for caching)
    let preview_output_dir = paths.temp.join("segment_previews");
    std::fs::create_dir_all(&preview_output_dir)
        .map_err(|e| format!("Failed to create preview output directory: {}", e))?;

    let shell = app.shell();

    // For single segment, just extract directly without concat overhead
    if segments.len() == 1 {
        let seg = &segments[0];
        let duration = seg.end_time - seg.start_time;
        let output_path = preview_output_dir.join(format!("{}.mp4", output_filename));

        println!(
            "[Rust] Single segment preview: {}s to {}s (duration: {}s)",
            seg.start_time, seg.end_time, duration
        );

        // Build FFmpeg args for fast preview generation
        // Use input seeking (-ss before -i) for faster seeking
        let args = vec![
            "-nostdin".to_string(),
            "-ss".to_string(),
            seg.start_time.to_string(),
            "-i".to_string(),
            video_path.clone(),
            "-t".to_string(),
            duration.to_string(),
            // Scale to 480p (height) while maintaining aspect ratio
            "-vf".to_string(),
            "scale=-2:480".to_string(),
            "-c:v".to_string(),
            "libx264".to_string(),
            "-preset".to_string(),
            "ultrafast".to_string(),
            "-crf".to_string(),
            "28".to_string(),
            "-c:a".to_string(),
            "aac".to_string(),
            "-b:a".to_string(),
            "128k".to_string(),
            "-movflags".to_string(),
            "+faststart".to_string(),
            "-y".to_string(),
            output_path.to_string_lossy().to_string(),
        ];

        let output = shell
            .sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args(args)
            .output()
            .await
            .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let _ = std::fs::remove_dir_all(&temp_dir);
            return Err(format!("FFmpeg preview generation failed: {}", stderr));
        }

        // Cleanup temp dir
        let _ = std::fs::remove_dir_all(&temp_dir);

        println!(
            "[Rust] Single segment preview generated: {}",
            output_path.display()
        );
        return Ok(output_path.to_string_lossy().to_string());
    }

    // Multi-segment: Extract each segment, then concatenate
    println!("[Rust] Multi-segment preview: {} segments", segments.len());

    let mut segment_files: Vec<std::path::PathBuf> = Vec::new();

    // Extract each segment in parallel for better performance
    let mut extract_tasks = Vec::new();

    for (i, seg) in segments.iter().enumerate() {
        let shell_clone = app.shell();
        let video_path_clone = video_path.clone();
        let temp_dir_clone = temp_dir.clone();
        let start_time = seg.start_time;
        let end_time = seg.end_time;
        let duration = end_time - start_time;

        let task = async move {
            let segment_file = temp_dir_clone.join(format!("seg_{:03}.mp4", i));

            println!(
                "[Rust] Extracting segment {}: {}s to {}s (duration: {}s)",
                i, start_time, end_time, duration
            );

            let args = vec![
                "-nostdin".to_string(),
                "-ss".to_string(),
                start_time.to_string(),
                "-i".to_string(),
                video_path_clone,
                "-t".to_string(),
                duration.to_string(),
                // Scale to 480p for preview quality
                "-vf".to_string(),
                "scale=-2:480".to_string(),
                "-c:v".to_string(),
                "libx264".to_string(),
                "-preset".to_string(),
                "ultrafast".to_string(),
                "-crf".to_string(),
                "28".to_string(),
                "-c:a".to_string(),
                "aac".to_string(),
                "-b:a".to_string(),
                "128k".to_string(),
                // Ensure consistent format for concat
                "-pix_fmt".to_string(),
                "yuv420p".to_string(),
                "-y".to_string(),
                segment_file.to_string_lossy().to_string(),
            ];

            let output = shell_clone
                .sidecar("ffmpeg")
                .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
                .args(args)
                .output()
                .await
                .map_err(|e| format!("Failed to run ffmpeg for segment {}: {}", i, e))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!(
                    "FFmpeg segment {} extraction failed: {}",
                    i, stderr
                ));
            }

            Ok::<std::path::PathBuf, String>(segment_file)
        };

        extract_tasks.push(task);
    }

    // Wait for all segment extractions to complete
    let results = join_all(extract_tasks).await;

    for (i, result) in results.into_iter().enumerate() {
        match result {
            Ok(path) => segment_files.push(path),
            Err(e) => {
                // Cleanup on error
                let _ = std::fs::remove_dir_all(&temp_dir);
                return Err(format!("Failed to extract segment {}: {}", i, e));
            }
        }
    }

    println!(
        "[Rust] All {} segments extracted, concatenating...",
        segment_files.len()
    );

    // Create concat list file
    let concat_file = temp_dir.join("concat_list.txt");
    let mut concat_content = String::new();

    for segment_file in &segment_files {
        // FFmpeg concat demuxer requires forward slashes
        let escaped_path = segment_file.to_string_lossy().replace('\\', "/");
        concat_content.push_str(&format!("file '{}'\n", escaped_path));
    }

    std::fs::write(&concat_file, &concat_content)
        .map_err(|e| format!("Failed to write concat list: {}", e))?;

    // Concatenate all segments
    let output_path = preview_output_dir.join(format!("{}.mp4", output_filename));

    let concat_args = vec![
        "-nostdin".to_string(),
        "-f".to_string(),
        "concat".to_string(),
        "-safe".to_string(),
        "0".to_string(),
        "-i".to_string(),
        concat_file.to_string_lossy().to_string(),
        "-c".to_string(),
        "copy".to_string(),
        "-movflags".to_string(),
        "+faststart".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ];

    let output = shell
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(concat_args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg concat: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err(format!("FFmpeg concat failed: {}", stderr));
    }

    // Cleanup temp directory
    let _ = std::fs::remove_dir_all(&temp_dir);

    println!(
        "[Rust] Preview generated successfully: {}",
        output_path.display()
    );
    Ok(output_path.to_string_lossy().to_string())
}

/// Delete a preview file by path
/// Used for cleanup when generating new previews or closing the editor
#[tauri::command]
pub async fn delete_segment_preview(preview_path: String) -> Result<(), String> {
    println!("[Rust] Deleting segment preview: {}", preview_path);

    let path = std::path::Path::new(&preview_path);
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| format!("Failed to delete preview file: {}", e))?;
        println!("[Rust] Preview file deleted successfully");
    } else {
        println!("[Rust] Preview file does not exist, skipping deletion");
    }

    Ok(())
}

/// Preview chunk edit data - contains all overlays/effects for rendering
#[allow(dead_code)]
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewChunkEditData {
    /// Text overlays to render
    #[serde(default)]
    pub text_overlays: Vec<PreviewTextOverlay>,
    /// Sticker overlays to render
    #[serde(default)]
    pub stickers: Vec<PreviewSticker>,
    /// Watermark overlays to render
    #[serde(default)]
    pub watermarks: Vec<PreviewWatermark>,
    /// Video filter segments (color grading, etc.)
    #[serde(default)]
    pub filter_segments: Vec<PreviewFilterSegment>,
    /// Audio tracks to mix
    #[serde(default)]
    pub audio_tracks: Vec<PreviewAudioTrack>,
    /// Main video volume in dB
    #[serde(default)]
    pub video_volume_db: f64,
}

/// Audio track for preview rendering
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewAudioTrack {
    pub file_path: String,
    pub start_time: f64,
    pub end_time: f64,
    pub volume: f64,
    #[serde(default)]
    pub is_muted: bool,
}

/// Text overlay for preview rendering
#[allow(dead_code)]
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewTextOverlay {
    pub id: String,
    pub text: String,
    pub start_time: f64,
    pub end_time: f64,
    pub position_x: f64,
    pub position_y: f64,
    pub style: serde_json::Value,
    pub animation: String,
    #[serde(default)]
    pub per_ratio_configs: Option<serde_json::Value>,
    #[serde(default)]
    pub preview_height: Option<f64>,
}

/// Sticker overlay for preview rendering
#[allow(dead_code)]
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewSticker {
    pub id: String,
    pub sticker_path: String,
    pub sticker_type: String,
    pub start_time: f64,
    pub end_time: f64,
    pub position_x: f64,
    pub position_y: f64,
    pub scale: f64,
    pub rotation: f64,
    pub animation: String,
    #[serde(default)]
    pub per_ratio_configs: Option<serde_json::Value>,
}

/// Watermark overlay for preview rendering
#[allow(dead_code)]
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewWatermark {
    pub id: String,
    pub watermark_path: String,
    pub start_time: f64,
    pub end_time: f64,
    pub position_x: f64,
    pub position_y: f64,
    pub scale: f64,
    pub opacity: f64,
    #[serde(default)]
    pub per_ratio_configs: Option<serde_json::Value>,
}

/// Video filter segment for preview rendering
#[allow(dead_code)]
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewFilterSegment {
    pub start_time: f64,
    pub end_time: f64,
    pub filter_type: String,
    pub settings: serde_json::Value,
}

/// Result of building preview filter complex
struct PreviewFilterResult {
    /// Video filter complex string
    filter_complex: String,
    /// Additional input files (watermarks, stickers, audio tracks)
    additional_inputs: Vec<String>,
    /// Whether audio mixing is needed
    needs_audio_mix: bool,
    /// Audio filter complex (if audio mixing is needed)
    audio_filter: Option<String>,
    /// Number of audio inputs (starting after video inputs)
    audio_input_count: usize,
}

/// Build FFmpeg filter complex for preview chunk with overlays and audio mixing
/// Returns filter result with video filter, audio filter, and additional inputs
fn build_preview_filter_complex(
    edit_data: &PreviewChunkEditData,
    chunk_start: f64,
    chunk_duration: f64,
    resolution_height: u32,
    video_width: u32,
    video_height: u32,
    _aspect_ratio: &str,
) -> PreviewFilterResult {
    let chunk_end = chunk_start + chunk_duration;
    let mut filter_parts: Vec<String> = Vec::new();
    let mut additional_inputs: Vec<String> = Vec::new();

    // Start with scaling the input video
    filter_parts.push(format!("[0:v]scale=-2:{}[scaled]", resolution_height));

    let mut current_label = "scaled".to_string();
    let mut input_index = 1; // Start at 1, 0 is the main video

    // Add color filter segments that overlap with this chunk
    for filter_seg in &edit_data.filter_segments {
        // Check if filter overlaps with chunk
        if filter_seg.end_time > chunk_start && filter_seg.start_time < chunk_end {
            // Calculate enable expression relative to chunk start
            let enable_start = (filter_seg.start_time - chunk_start).max(0.0);
            let enable_end = (filter_seg.end_time - chunk_start).min(chunk_duration);

            // Build color filter based on settings
            if let Some(settings) = filter_seg.settings.as_object() {
                let mut color_filters: Vec<String> = Vec::new();

                if let Some(brightness) = settings.get("brightness").and_then(|v| v.as_f64()) {
                    if brightness != 0.0 {
                        color_filters.push(format!("eq=brightness={:.2}", brightness / 100.0));
                    }
                }
                if let Some(contrast) = settings.get("contrast").and_then(|v| v.as_f64()) {
                    if contrast != 0.0 {
                        color_filters.push(format!("eq=contrast={:.2}", 1.0 + contrast / 100.0));
                    }
                }
                if let Some(saturation) = settings.get("saturation").and_then(|v| v.as_f64()) {
                    if saturation != 0.0 {
                        color_filters
                            .push(format!("eq=saturation={:.2}", 1.0 + saturation / 100.0));
                    }
                }

                if !color_filters.is_empty() {
                    let next_label = format!("filt{}", input_index);
                    let filter_chain = color_filters.join(",");
                    filter_parts.push(format!(
                        "[{}]{}:enable='between(t,{:.3},{:.3})'[{}]",
                        current_label, filter_chain, enable_start, enable_end, next_label
                    ));
                    current_label = next_label;
                    input_index += 1;
                }
            }
        }
    }

    // Add text overlays that overlap with this chunk
    for text_overlay in &edit_data.text_overlays {
        // Check if overlay overlaps with chunk
        if text_overlay.end_time > chunk_start && text_overlay.start_time < chunk_end {
            // Calculate enable expression relative to chunk start
            let enable_start = (text_overlay.start_time - chunk_start).max(0.0);
            let enable_end = (text_overlay.end_time - chunk_start).min(chunk_duration);

            // Get style properties
            let style = text_overlay.style.as_object();
            let font_size = style
                .and_then(|s| s.get("fontSize"))
                .and_then(|v| v.as_f64())
                .unwrap_or(48.0) as u32;
            let font_color = style
                .and_then(|s| s.get("color"))
                .and_then(|v| v.as_str())
                .unwrap_or("#FFFFFF");

            // Scale font size for resolution
            let scale_factor = resolution_height as f64 / video_height as f64;
            let scaled_font_size = (font_size as f64 * scale_factor) as u32;

            // Calculate position in pixels
            let x_pos =
                (video_width as f64 * text_overlay.position_x / 100.0 * scale_factor) as i32;
            let y_pos =
                (video_height as f64 * text_overlay.position_y / 100.0 * scale_factor) as i32;

            // Escape text for FFmpeg drawtext
            let escaped_text = text_overlay
                .text
                .replace("\\", "\\\\")
                .replace("'", "'\\''")
                .replace(":", "\\:");

            // Convert hex color to FFmpeg format
            let ffmpeg_color = if let Some(stripped) = font_color.strip_prefix('#') {
                format!("0x{}", stripped)
            } else {
                font_color.to_string()
            };

            let next_label = format!("txt{}", input_index);
            filter_parts.push(format!(
                "[{}]drawtext=text='{}':fontsize={}:fontcolor={}:x={}:y={}:enable='between(t,{:.3},{:.3})'[{}]",
                current_label, escaped_text, scaled_font_size, ffmpeg_color, x_pos, y_pos, enable_start, enable_end, next_label
            ));
            current_label = next_label;
            input_index += 1;
        }
    }

    // Add watermark overlays that overlap with this chunk
    for watermark in &edit_data.watermarks {
        // Check if watermark overlaps with chunk
        if watermark.end_time > chunk_start && watermark.start_time < chunk_end {
            // Calculate enable expression relative to chunk start
            let enable_start = (watermark.start_time - chunk_start).max(0.0);
            let enable_end = (watermark.end_time - chunk_start).min(chunk_duration);

            // Add watermark image as input
            additional_inputs.push(watermark.watermark_path.clone());

            // Calculate position and scale
            let scale_factor = resolution_height as f64 / video_height as f64;
            let wm_scale = watermark.scale / 100.0 * scale_factor;
            let x_pos = format!("main_w*{}/100-overlay_w/2", watermark.position_x);
            let y_pos = format!("main_h*{}/100-overlay_h/2", watermark.position_y);
            let opacity = watermark.opacity / 100.0;

            let wm_input_idx = additional_inputs.len(); // 1-indexed since 0 is main video
            let next_label = format!("wm{}", input_index);

            // Scale watermark and apply opacity
            filter_parts.push(format!(
                "[{}:v]scale=iw*{:.2}:ih*{:.2},format=rgba,colorchannelmixer=aa={:.2}[wm_scaled{}]",
                wm_input_idx, wm_scale, wm_scale, opacity, input_index
            ));

            // Overlay watermark on video
            filter_parts.push(format!(
                "[{}][wm_scaled{}]overlay={}:{}:enable='between(t,{:.3},{:.3})'[{}]",
                current_label, input_index, x_pos, y_pos, enable_start, enable_end, next_label
            ));
            current_label = next_label;
            input_index += 1;
        }
    }

    // Add sticker overlays that overlap with this chunk
    for sticker in &edit_data.stickers {
        // Check if sticker overlaps with chunk
        if sticker.end_time > chunk_start && sticker.start_time < chunk_end {
            // Only handle image/gif stickers (not emoji)
            if sticker.sticker_type == "image" || sticker.sticker_type == "gif" {
                // Calculate enable expression relative to chunk start
                let enable_start = (sticker.start_time - chunk_start).max(0.0);
                let enable_end = (sticker.end_time - chunk_start).min(chunk_duration);

                // Add sticker image as input
                additional_inputs.push(sticker.sticker_path.clone());

                // Calculate position and scale
                let scale_factor = resolution_height as f64 / video_height as f64;
                let sticker_scale = sticker.scale * scale_factor;
                let x_pos = format!("main_w*{}/100-overlay_w/2", sticker.position_x);
                let y_pos = format!("main_h*{}/100-overlay_h/2", sticker.position_y);

                let sticker_input_idx = additional_inputs.len();
                let next_label = format!("stk{}", input_index);

                // Scale sticker
                filter_parts.push(format!(
                    "[{}:v]scale=iw*{:.2}:ih*{:.2},format=rgba[stk_scaled{}]",
                    sticker_input_idx, sticker_scale, sticker_scale, input_index
                ));

                // Overlay sticker on video
                filter_parts.push(format!(
                    "[{}][stk_scaled{}]overlay={}:{}:enable='between(t,{:.3},{:.3})'[{}]",
                    current_label, input_index, x_pos, y_pos, enable_start, enable_end, next_label
                ));
                current_label = next_label;
                input_index += 1;
            }
        }
    }

    // Track video input count before adding audio inputs
    let video_input_count = additional_inputs.len() + 1; // +1 for main video

    // Build audio mixing filter for audio tracks that overlap with this chunk
    let mut audio_inputs: Vec<String> = Vec::new();
    let mut audio_filter_parts: Vec<String> = Vec::new();

    for audio_track in &edit_data.audio_tracks {
        // Check if audio track overlaps with chunk
        if audio_track.end_time > chunk_start
            && audio_track.start_time < chunk_end
            && !audio_track.is_muted
        {
            audio_inputs.push(audio_track.file_path.clone());

            // Calculate trim and delay for this audio track
            let track_offset_in_chunk = (audio_track.start_time - chunk_start).max(0.0);
            let trim_start = (chunk_start - audio_track.start_time).max(0.0);
            let trim_end = (chunk_end - audio_track.start_time)
                .min(audio_track.end_time - audio_track.start_time);

            let audio_input_idx = video_input_count + audio_inputs.len() - 1;
            let volume = audio_track.volume;

            // Build audio filter for this track: trim, volume adjust, delay
            let track_label = format!("a{}", audio_inputs.len());
            if track_offset_in_chunk > 0.0 {
                audio_filter_parts.push(format!(
                    "[{}:a]atrim=start={:.3}:end={:.3},asetpts=PTS-STARTPTS,volume={:.2},adelay={}|{}[{}]",
                    audio_input_idx, trim_start, trim_end, volume,
                    (track_offset_in_chunk * 1000.0) as i64,
                    (track_offset_in_chunk * 1000.0) as i64,
                    track_label
                ));
            } else {
                audio_filter_parts.push(format!(
                    "[{}:a]atrim=start={:.3}:end={:.3},asetpts=PTS-STARTPTS,volume={:.2}[{}]",
                    audio_input_idx, trim_start, trim_end, volume, track_label
                ));
            }
        }
    }

    // Add audio inputs to additional_inputs
    additional_inputs.extend(audio_inputs.clone());

    // Build audio mix filter if we have audio tracks
    let (needs_audio_mix, audio_filter) = if !audio_filter_parts.is_empty() {
        // Mix all audio tracks with main video audio
        let mut mix_inputs = vec!["[0:a]".to_string()];
        for i in 1..=audio_filter_parts.len() {
            mix_inputs.push(format!("[a{}]", i));
        }

        let mix_filter = format!(
            "{};{}amix=inputs={}:duration=first:dropout_transition=0[aout]",
            audio_filter_parts.join(";"),
            mix_inputs.join(""),
            mix_inputs.len()
        );

        (true, Some(mix_filter))
    } else {
        (false, None)
    };

    // Final output label for video
    let filter_complex = if filter_parts.len() == 1 {
        // Only scaling, no overlays
        format!("[0:v]scale=-2:{}[vout]", resolution_height)
    } else {
        // Rename final label to vout
        let last_part = filter_parts.pop().unwrap();
        let final_part = last_part.replace(&format!("[{}]", current_label), "[vout]");
        filter_parts.push(final_part.replace(&format!("'[{}]", current_label), "'[vout]"));

        // Fix: the replacement above might not work correctly, let's just add a null filter
        filter_parts.push(format!("[{}]null[vout]", current_label));
        filter_parts.join(";")
    };

    PreviewFilterResult {
        filter_complex,
        additional_inputs,
        needs_audio_mix,
        audio_filter,
        audio_input_count: audio_inputs.len(),
    }
}

/// Generate a single preview chunk for the progressive preview cache.
/// Renders a 3-second (or shorter) segment of the edited timeline into an HLS-compatible .ts file.
///
/// This command renders the timeline including all effects, transitions, overlays, and audio.
///
/// # Arguments
/// * `app` - Tauri app handle
/// * `clip_id` - Unique clip identifier
/// * `video_path` - Path to the source video file
/// * `tier` - Preview tier ("proxy" for 720p, "hq" for 1080p)
/// * `chunk_index` - 0-based index of the chunk
/// * `chunk_start` - Start time in the edited timeline (seconds)
/// * `chunk_duration` - Duration of the chunk (typically 3.0 seconds)
/// * `segments` - Timeline segments mapping edited time to source time
/// * `edit_data` - Optional edit data containing overlays, effects, and audio tracks
/// * `aspect_ratio` - Aspect ratio for rendering (e.g., "16:9", "9:16")
///
/// # Returns
/// Result containing the chunk output path and metadata
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn generate_preview_chunk(
    app: tauri::AppHandle,
    clip_id: String,
    video_path: String,
    tier: String,
    chunk_index: u32,
    chunk_start: f64,
    chunk_duration: f64,
    segments: Vec<TimelineSegment>,
    edit_data: Option<PreviewChunkEditData>,
    aspect_ratio: Option<String>,
) -> Result<PreviewChunkResult, String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] generate_preview_chunk called:");
    println!("[Rust]   clip_id: {}", clip_id);
    println!("[Rust]   tier: {}", tier);
    println!("[Rust]   chunk_index: {}", chunk_index);
    println!("[Rust]   chunk_start: {}s", chunk_start);
    println!("[Rust]   chunk_duration: {}s", chunk_duration);
    println!("[Rust]   segments count: {}", segments.len());
    if let Some(ref data) = edit_data {
        println!("[Rust]   text_overlays: {}", data.text_overlays.len());
        println!("[Rust]   stickers: {}", data.stickers.len());
        println!("[Rust]   watermarks: {}", data.watermarks.len());
        println!("[Rust]   filter_segments: {}", data.filter_segments.len());
        println!("[Rust]   audio_tracks: {}", data.audio_tracks.len());
    }
    println!("[Rust]   aspect_ratio: {:?}", aspect_ratio);

    // Validate tier
    let (resolution_height, preset, crf, audio_bitrate) = match tier.as_str() {
        "proxy" => (720, "ultrafast", "28", "128k"),
        "hq" => (1080, "medium", "23", "192k"),
        _ => return Err(format!("Invalid tier: {}. Must be 'proxy' or 'hq'", tier)),
    };

    // Get storage paths
    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    // Create preview cache directory structure
    let tier_dir = if tier == "proxy" {
        "proxy_720"
    } else {
        "hq_1080"
    };
    let preview_dir = paths
        .temp
        .join("previews")
        .join(format!("clip_{}", clip_id))
        .join(tier_dir);
    std::fs::create_dir_all(&preview_dir)
        .map_err(|e| format!("Failed to create preview directory: {}", e))?;

    let chunk_end = chunk_start + chunk_duration;

    // Find which segments overlap with this chunk's timeline range
    let mut overlapping_segments: Vec<(f64, f64, f64, f64)> = Vec::new(); // (source_start, source_end, timeline_start, timeline_end)

    for seg in &segments {
        // Check if segment overlaps with chunk time range
        if seg.timeline_end > chunk_start && seg.timeline_start < chunk_end {
            // Calculate the overlap
            let overlap_timeline_start = seg.timeline_start.max(chunk_start);
            let overlap_timeline_end = seg.timeline_end.min(chunk_end);

            // Map timeline overlap back to source time
            let seg_duration = seg.timeline_end - seg.timeline_start;
            let source_duration = seg.source_end - seg.source_start;
            let time_scale = if seg_duration > 0.0 {
                source_duration / seg_duration
            } else {
                1.0
            };

            let offset_in_seg = overlap_timeline_start - seg.timeline_start;
            let overlap_source_start = seg.source_start + (offset_in_seg * time_scale);
            let overlap_source_end = overlap_source_start
                + ((overlap_timeline_end - overlap_timeline_start) * time_scale);

            overlapping_segments.push((
                overlap_source_start,
                overlap_source_end,
                overlap_timeline_start,
                overlap_timeline_end,
            ));
        }
    }

    if overlapping_segments.is_empty() {
        return Err(format!(
            "No segments overlap with chunk time range [{}, {}]",
            chunk_start, chunk_end
        ));
    }

    let shell = app.shell();
    let output_path = preview_dir.join(format!("seg_{:03}.ts", chunk_index));

    // Get video dimensions for overlay positioning (default to 1920x1080 if not available)
    let (video_width, video_height) = (1920u32, 1080u32);
    let aspect_ratio_str = aspect_ratio.as_deref().unwrap_or("16:9");

    // For single segment overlap, extract directly
    if overlapping_segments.len() == 1 {
        let (source_start, source_end, _, _) = overlapping_segments[0];
        let duration = source_end - source_start;

        println!(
            "[Rust] Single segment chunk: source {}s to {}s (duration: {}s)",
            source_start, source_end, duration
        );

        // Build args based on whether we have edit data with overlays/audio
        let args = if let Some(ref data) = edit_data {
            let has_overlays = !data.text_overlays.is_empty()
                || !data.watermarks.is_empty()
                || !data.stickers.is_empty()
                || !data.filter_segments.is_empty()
                || !data.audio_tracks.is_empty();

            if has_overlays {
                let filter_result = build_preview_filter_complex(
                    data,
                    chunk_start,
                    chunk_duration,
                    resolution_height,
                    video_width,
                    video_height,
                    aspect_ratio_str,
                );

                println!(
                    "[Rust] Using filter_complex for overlays: {}",
                    filter_result.filter_complex
                );
                if filter_result.needs_audio_mix {
                    println!(
                        "[Rust] Audio mixing enabled with {} tracks",
                        filter_result.audio_input_count
                    );
                }

                let mut args = vec![
                    "-ss".to_string(),
                    source_start.to_string(),
                    "-i".to_string(),
                    video_path.clone(),
                ];

                // Add additional inputs for watermarks/stickers/audio
                for input_path in &filter_result.additional_inputs {
                    args.push("-i".to_string());
                    args.push(input_path.clone());
                }

                // Build combined filter_complex with video and audio filters
                let full_filter = if filter_result.needs_audio_mix {
                    if let Some(ref audio_filter) = filter_result.audio_filter {
                        format!("{};{}", filter_result.filter_complex, audio_filter)
                    } else {
                        filter_result.filter_complex.clone()
                    }
                } else {
                    filter_result.filter_complex.clone()
                };

                args.extend(vec![
                    "-t".to_string(),
                    duration.to_string(),
                    "-filter_complex".to_string(),
                    full_filter,
                    "-map".to_string(),
                    "[vout]".to_string(),
                ]);

                // Map audio output
                if filter_result.needs_audio_mix {
                    args.push("-map".to_string());
                    args.push("[aout]".to_string());
                } else {
                    args.push("-map".to_string());
                    args.push("0:a?".to_string());
                }

                args.extend(vec![
                    "-c:v".to_string(),
                    "libx264".to_string(),
                    "-preset".to_string(),
                    preset.to_string(),
                    "-crf".to_string(),
                    crf.to_string(),
                    "-c:a".to_string(),
                    "aac".to_string(),
                    "-b:a".to_string(),
                    audio_bitrate.to_string(),
                    "-f".to_string(),
                    "mpegts".to_string(),
                    "-y".to_string(),
                    output_path.to_string_lossy().to_string(),
                ]);
                args
            } else {
                // No overlays, use simple scaling
                vec![
                    "-nostdin".to_string(),
                    "-ss".to_string(),
                    source_start.to_string(),
                    "-i".to_string(),
                    video_path.clone(),
                    "-t".to_string(),
                    duration.to_string(),
                    "-vf".to_string(),
                    format!("scale=-2:{}", resolution_height),
                    "-c:v".to_string(),
                    "libx264".to_string(),
                    "-preset".to_string(),
                    preset.to_string(),
                    "-crf".to_string(),
                    crf.to_string(),
                    "-c:a".to_string(),
                    "aac".to_string(),
                    "-b:a".to_string(),
                    audio_bitrate.to_string(),
                    "-f".to_string(),
                    "mpegts".to_string(),
                    "-y".to_string(),
                    output_path.to_string_lossy().to_string(),
                ]
            }
        } else {
            // No edit data, use simple scaling
            vec![
                "-nostdin".to_string(),
                "-ss".to_string(),
                source_start.to_string(),
                "-i".to_string(),
                video_path.clone(),
                "-t".to_string(),
                duration.to_string(),
                "-vf".to_string(),
                format!("scale=-2:{}", resolution_height),
                "-c:v".to_string(),
                "libx264".to_string(),
                "-preset".to_string(),
                preset.to_string(),
                "-crf".to_string(),
                crf.to_string(),
                "-c:a".to_string(),
                "aac".to_string(),
                "-b:a".to_string(),
                audio_bitrate.to_string(),
                "-f".to_string(),
                "mpegts".to_string(),
                "-y".to_string(),
                output_path.to_string_lossy().to_string(),
            ]
        };

        let output = shell
            .sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args(args)
            .output()
            .await
            .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!(
                "FFmpeg preview chunk generation failed: {}",
                stderr
            ));
        }

        println!(
            "[Rust] Preview chunk {} generated: {}",
            chunk_index,
            output_path.display()
        );

        return Ok(PreviewChunkResult {
            chunk_index,
            output_path: output_path.to_string_lossy().to_string(),
            duration,
        });
    }

    // Multi-segment chunk: extract each part and concatenate
    println!(
        "[Rust] Multi-segment chunk: {} segments",
        overlapping_segments.len()
    );

    let temp_dir = paths
        .temp
        .join(format!("chunk_temp_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    let mut segment_files: Vec<std::path::PathBuf> = Vec::new();
    let mut total_duration = 0.0;

    for (i, (source_start, source_end, _, _)) in overlapping_segments.iter().enumerate() {
        let duration = source_end - source_start;
        total_duration += duration;

        let segment_file = temp_dir.join(format!("part_{:03}.ts", i));

        let args = vec![
            "-nostdin".to_string(),
            "-ss".to_string(),
            source_start.to_string(),
            "-i".to_string(),
            video_path.clone(),
            "-t".to_string(),
            duration.to_string(),
            "-vf".to_string(),
            format!("scale=-2:{}", resolution_height),
            "-c:v".to_string(),
            "libx264".to_string(),
            "-preset".to_string(),
            preset.to_string(),
            "-crf".to_string(),
            crf.to_string(),
            "-c:a".to_string(),
            "aac".to_string(),
            "-b:a".to_string(),
            audio_bitrate.to_string(),
            "-f".to_string(),
            "mpegts".to_string(),
            "-y".to_string(),
            segment_file.to_string_lossy().to_string(),
        ];

        let output = shell
            .sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args(args)
            .output()
            .await
            .map_err(|e| format!("Failed to run ffmpeg for segment {}: {}", i, e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let _ = std::fs::remove_dir_all(&temp_dir);
            return Err(format!(
                "FFmpeg segment {} extraction failed: {}",
                i, stderr
            ));
        }

        segment_files.push(segment_file);
    }

    // Concatenate all parts using concat protocol (for .ts files)
    let concat_input = segment_files
        .iter()
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .collect::<Vec<_>>()
        .join("|");

    let concat_args = vec![
        "-nostdin".to_string(),
        "-i".to_string(),
        format!("concat:{}", concat_input),
        "-c".to_string(),
        "copy".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ];

    let output = shell
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(concat_args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg concat: {}", e))?;

    // Cleanup temp directory
    let _ = std::fs::remove_dir_all(&temp_dir);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg concat failed: {}", stderr));
    }

    println!(
        "[Rust] Preview chunk {} generated (multi-segment): {}",
        chunk_index,
        output_path.display()
    );

    Ok(PreviewChunkResult {
        chunk_index,
        output_path: output_path.to_string_lossy().to_string(),
        duration: total_duration,
    })
}

/// Write an HLS manifest file for the preview cache.
/// Creates an index.m3u8 file that references all available chunks.
///
/// # Arguments
/// * `clip_id` - Unique clip identifier
/// * `tier` - Preview tier ("proxy" or "hq")
/// * `chunks` - List of chunk results with their durations
///
/// # Returns
/// Result containing the manifest path and streaming URL
#[tauri::command]
pub async fn write_preview_manifest(
    clip_id: String,
    tier: String,
    chunks: Vec<PreviewChunkResult>,
) -> Result<PreviewManifestResult, String> {
    println!("[Rust] write_preview_manifest called:");
    println!("[Rust]   clip_id: {}", clip_id);
    println!("[Rust]   tier: {}", tier);
    println!("[Rust]   chunks count: {}", chunks.len());

    if chunks.is_empty() {
        return Err("No chunks provided for manifest".to_string());
    }

    // Get storage paths
    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    // Preview cache directory
    let tier_dir = if tier == "proxy" {
        "proxy_720"
    } else {
        "hq_1080"
    };
    let preview_dir = paths
        .temp
        .join("previews")
        .join(format!("clip_{}", clip_id))
        .join(tier_dir);

    // Calculate total duration and max chunk duration (for target duration)
    let total_duration: f64 = chunks.iter().map(|c| c.duration).sum();
    let max_chunk_duration = chunks
        .iter()
        .map(|c| c.duration)
        .fold(0.0_f64, |a, b| a.max(b));
    let target_duration = (max_chunk_duration.ceil() as u32).max(3);

    // Build HLS manifest content
    let mut manifest = String::new();
    manifest.push_str("#EXTM3U\n");
    manifest.push_str("#EXT-X-VERSION:3\n");
    manifest.push_str(&format!("#EXT-X-TARGETDURATION:{}\n", target_duration));
    manifest.push_str("#EXT-X-MEDIA-SEQUENCE:0\n");
    manifest.push_str("#EXT-X-PLAYLIST-TYPE:VOD\n");

    // Sort chunks by index to ensure correct order
    let mut sorted_chunks = chunks.clone();
    sorted_chunks.sort_by_key(|c| c.chunk_index);

    for chunk in &sorted_chunks {
        manifest.push_str(&format!("#EXTINF:{:.6},\n", chunk.duration));
        manifest.push_str(&format!("seg_{:03}.ts\n", chunk.chunk_index));
    }

    manifest.push_str("#EXT-X-ENDLIST\n");

    // Write manifest file (playlist.m3u8 is expected by the local /hls route)
    let manifest_path = preview_dir.join("playlist.m3u8");
    std::fs::write(&manifest_path, &manifest)
        .map_err(|e| format!("Failed to write manifest file: {}", e))?;

    // Compatibility: also write index.m3u8 for any legacy consumers
    let legacy_manifest_path = preview_dir.join("index.m3u8");
    let _ = std::fs::write(&legacy_manifest_path, &manifest);

    // Generate streaming URL (file:// protocol for local playback)
    let streaming_url = format!(
        "file:///{}",
        manifest_path.to_string_lossy().replace('\\', "/")
    );

    println!(
        "[Rust] Preview manifest written: {}",
        manifest_path.display()
    );
    println!("[Rust] Streaming URL: {}", streaming_url);

    Ok(PreviewManifestResult {
        manifest_path: manifest_path.to_string_lossy().to_string(),
        streaming_url,
        chunk_count: sorted_chunks.len() as u32,
        total_duration,
    })
}

/// Delete the preview cache for a clip.
/// Removes all preview files (proxy and HQ) for the specified clip.
#[tauri::command]
pub async fn delete_preview_cache(clip_id: String) -> Result<(), String> {
    println!("[Rust] delete_preview_cache called for clip: {}", clip_id);

    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let preview_dir = paths
        .temp
        .join("previews")
        .join(format!("clip_{}", clip_id));

    if preview_dir.exists() {
        std::fs::remove_dir_all(&preview_dir)
            .map_err(|e| format!("Failed to delete preview cache: {}", e))?;
        println!("[Rust] Preview cache deleted: {}", preview_dir.display());
    } else {
        println!("[Rust] Preview cache does not exist, skipping deletion");
    }

    Ok(())
}

/// Get the preview cache directory path for a clip.
/// Returns the base path where preview files are stored.
#[tauri::command]
pub async fn get_preview_cache_path(clip_id: String, tier: String) -> Result<String, String> {
    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let tier_dir = if tier == "proxy" {
        "proxy_720"
    } else {
        "hq_1080"
    };
    let preview_dir = paths
        .temp
        .join("previews")
        .join(format!("clip_{}", clip_id))
        .join(tier_dir);

    Ok(preview_dir.to_string_lossy().to_string())
}
