use tauri_plugin_shell::ShellExt;
use std::sync::{Arc, Mutex};
use futures::future::join_all;

use super::types::{AspectRatio, WatermarkSettings, AudioSettings, MusicTrackSettings, VideoFilterSegment, build_time_based_filter_string, StickerSettings};
use super::encoder::{detect_hardware_encoder, get_quality_settings};
use super::video_info::{get_video_info, calculate_crop_params, IntroOutroCache};
use super::font_manager::get_fonts_dir;

/// Build time-based FFmpeg filter string from filter segments
/// This creates a filter string with enable expressions for each segment's time range
fn build_video_filter_string(segments: Option<&Vec<VideoFilterSegment>>) -> Option<String> {
    let segments = segments?;
    build_time_based_filter_string(segments)
}

/// Build time-based filter string with adjusted time offsets
/// Used when the output video starts at a different time than the source
/// offset: the time offset to add to all filter start/end times
fn build_video_filter_string_with_offset(segments: Option<&Vec<VideoFilterSegment>>, offset: f64) -> Option<String> {
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
            if let Some(filter_str) = segment.settings.to_ffmpeg_filter_with_enable(adjusted_start, adjusted_end) {
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
    segment_end: f64
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

// Helper function to build complete audio processing config
// Handles both simple (no music tracks) and complex (with music tracks) cases
#[allow(dead_code)]
fn build_audio_processing_config(audio_settings: Option<&AudioSettings>, _clip_duration: f64) -> AudioProcessingConfig {
    let settings = match audio_settings {
        Some(s) => s,
        None => return AudioProcessingConfig {
            simple_filter: None,
            additional_inputs: Vec::new(),
            complex_filter: None,
            needs_complex_audio: false,
        },
    };

    // Get non-muted music tracks
    let music_tracks: Vec<&MusicTrackSettings> = settings.music_tracks
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
        
        // Apply fade in (if > 0)
        if track.fade_in > 0.0 {
            track_filters.push(format!("afade=t=in:st=0:d={}", track.fade_in));
        }
        
        // Calculate track duration for fade out
        let track_duration = track.end_time - track.start_time;
        if track_duration > 0.0 && track.fade_out > 0.0 {
            let fade_out_start = (track_duration - track.fade_out).max(0.0);
            track_filters.push(format!("afade=t=out:st={}:d={}", fade_out_start, track.fade_out));
        }
        
        // Build the filter chain for this track
        let filter_chain = if track_filters.is_empty() {
            format!("[{}:a]acopy[{}]", input_idx, track_label)
        } else {
            format!("[{}:a]{}[{}]", input_idx, track_filters.join(","), track_label)
        };
        filter_parts.push(filter_chain);
        
        // Add delay to position the track at the correct time in the clip
        // adelay uses milliseconds
        if track.start_time > 0.0 {
            let delay_ms = (track.start_time * 1000.0) as i64;
            let delayed_label = format!("{}d", track_label);
            filter_parts.push(format!("[{}]adelay={}:all=1[{}]", track_label, delay_ms, delayed_label));
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
    println!("[Rust] Built complex audio filter with {} music tracks: {}", music_tracks.len(), complex_filter);
    
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
async fn probe_image_dimensions(app: &tauri::AppHandle, image_path: &str) -> (Option<u32>, Option<u32>) {
    let shell = app.shell();
    
    // Use FFmpeg to get image info
    let output = match shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))
    {
        Ok(cmd) => {
            match cmd.args(["-i", image_path, "-f", "null", "-"]).output().await {
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
                    let after = &part[x_pos+1..];
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
                        let after = &trimmed[x_pos+1..];
                        let w_str: String = before.chars().rev().take_while(|c| c.is_numeric()).collect::<String>().chars().rev().collect();
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
    
    if (ratio - 16.0/9.0).abs() < 0.01 {
        "16:9".to_string()
    } else if (ratio - 9.0/16.0).abs() < 0.01 {
        "9:16".to_string()
    } else if (ratio - 1.0).abs() < 0.01 {
        "1:1".to_string()
    } else if (ratio - 4.0/5.0).abs() < 0.01 {
        "4:5".to_string()
    } else {
        format!("{}:{}", aspect_ratio.width as u32, aspect_ratio.height as u32)
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
}

// Helper function to get watermark settings for a specific aspect ratio
// Returns None if watermark is disabled for this aspect ratio
// Now supports per-ratio watermark images (different watermark files for different ratios)
fn get_watermark_for_aspect_ratio(watermark: &WatermarkSettings, aspect_ratio: Option<&str>) -> Option<ResolvedWatermark> {
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
                    let file_path = config.file_path.clone().unwrap_or_else(|| watermark.file_path.clone());
                    let width = config.width.or(watermark.width);
                    let height = config.height.or(watermark.height);
                    
                    // Use per-ratio position if available, otherwise fall back to default position
                    let (position_x, position_y, opacity, scale) = if let Some(pos) = &config.position {
                        (pos.x, pos.y, pos.opacity, pos.scale)
                    } else {
                        // No custom position for this ratio - use default position
                        (watermark.position_x, watermark.position_y, watermark.opacity, watermark.scale)
                    };
                    
                    let has_custom_watermark = config.file_path.is_some() && config.file_path.as_ref() != Some(&watermark.file_path);
                    let has_custom_position = config.position.is_some();
                    
                    println!("[Rust] Using per-ratio watermark for {}: file={}, custom_wm={}, custom_pos={}, x={}%, y={}%, opacity={}%, scale={}%", 
                             ratio, file_path, has_custom_watermark, has_custom_position, position_x, position_y, opacity, scale);
                    
                    return Some(ResolvedWatermark {
                        file_path,
                        width,
                        height,
                        position_x,
                        position_y,
                        opacity,
                        scale,
                    });
                }
                None => {
                    // Config is explicitly None/null for this ratio - watermark disabled
                    println!("[Rust] Watermark disabled for aspect ratio {} (config is null)", ratio);
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

    let shell = app.shell();
    
    // Get video info for calculating watermark size
    let video_info = get_video_info(app, input_path.to_str().ok_or("Invalid input path")?).await?;
    let video_width = video_info.width;
    let video_height = video_info.height;
    
    // Get watermark dimensions - use resolved values if available, otherwise probe the image file
    println!("[Rust] Watermark settings received - width: {:?}, height: {:?}, file_path: {}", 
             resolved.width, resolved.height, watermark_file_path);
    let (wm_actual_width, wm_actual_height) = match (resolved.width, resolved.height) {
        (Some(w), Some(h)) if w > 0 && h > 0 => {
            println!("[Rust] Using watermark dimensions from database: {}x{}", w, h);
            (Some(w), Some(h))
        }
        _ => {
            // Database doesn't have dimensions - probe the watermark image file
            println!("[Rust] Watermark dimensions not in database or zero, probing image file: {}", watermark_file_path);
            let probed = probe_image_dimensions(app, watermark_file_path).await;
            println!("[Rust] Probed dimensions result: {:?}", probed);
            probed
        }
    };
    println!("[Rust] Final watermark dimensions: width={:?}, height={:?}", wm_actual_width, wm_actual_height);
    
    // Detect if this watermark is effectively a full-frame 16:9 canvas.
    // Accept common HD+ sizes to avoid strict 1920x1080 requirement (e.g., 2560x1440 will still scale down).
    let is_full_frame_watermark = match (wm_actual_width, wm_actual_height) {
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
            println!("[Rust] Could not determine watermark dimensions, using standard placement");
            false
        }
    };
    println!("[Rust] is_full_frame_watermark = {}", is_full_frame_watermark);
    
    // Calculate opacity (FFmpeg uses 0-1 range)
    let opacity = opacity_pct as f32 / 100.0;
    
    // Build the filter_complex for watermark overlay
    // Full-frame 1920x1080 watermarks are scaled to the output frame and pinned to 0,0.
    // Standard PNGs keep the existing percentage-based position/scale behavior.
    println!("[Rust] Building filter_complex for watermark (is_full_frame={})", is_full_frame_watermark);
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
    
    // Build encoder-specific args
    let mut args = vec![
        "-i".to_string(), input_path.to_string_lossy().to_string(),
        "-i".to_string(), watermark_file_path.clone(),
        "-filter_complex".to_string(), filter_complex,
        "-c:v".to_string(), encoder.codec.clone(),
    ];
    
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
        "-c:a".to_string(), "copy".to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-y".to_string(),
        temp_output.to_string_lossy().to_string(),
    ]);
    
    println!("[Rust] Applying watermark to video...");
    
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to apply watermark: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg watermark failed: {}", stderr));
    }
    
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
pub async fn build_single_segment_clip_with_settings(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    subtitle_path: Option<&std::path::Path>,
    aspect_ratio: &AspectRatio,
    quality: &str,
    frame_rate: u32,
    _output_format: &str,  // Format already applied in output_path extension
    intro_path: Option<&str>,
    outro_path: Option<&str>,
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>,
    watermark_settings: Option<&WatermarkSettings>,
    audio_settings: Option<&AudioSettings>,
    video_filter_segments: Option<&Vec<VideoFilterSegment>>
) -> Result<(), String> {
    let shell = app.shell();
    let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
    let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
    let duration = end_time - start_time;

    println!("[Rust] Building single segment with aspect ratio {}:{}", aspect_ratio.width, aspect_ratio.height);

    // Get video info for cropping
    let video_info = get_video_info(app, video_path).await?;
    let (crop_w, crop_h, crop_x, crop_y) = calculate_crop_params(video_info.width, video_info.height, aspect_ratio);
    
    // Get quality settings (unused in this path, but kept for reference)
    let (_preset, _crf) = get_quality_settings(quality);
    
    // Build time-based video filter string
    // Filter times are relative to the output (0 = clip start), so we use the segments directly
    let video_filter_str = build_video_filter_string(video_filter_segments);
    
    // If intro or outro is present, we need to use the concat approach
    if intro_path.is_some() || outro_path.is_some() {
        println!("[Rust] Intro or outro detected, using concat approach for single segment");
        
        // Get storage paths for temporary files
        let paths = crate::storage::init_storage_dirs()
            .map_err(|e| format!("Failed to get storage paths: {}", e))?;

        let temp_dir = paths.temp.join(format!("clip_single_segment_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;

        // Detect hardware encoder for better performance
        let encoder = detect_hardware_encoder(app, quality).await;

        // Extract the main segment without subtitles (we'll add them later if needed)
        let segment_file = temp_dir.join("main_segment.mp4");
        
        // Build crop filter with optional time-based color grading
        let crop_filter = if let Some(ref filter_str) = video_filter_str {
            println!("[Rust] Applying time-based video color filters in intro/outro path: {}", filter_str);
            format!("crop={}:{}:{}:{},{}", crop_w, crop_h, crop_x, crop_y, filter_str)
        } else {
            format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y)
        };

        // Build encoder-specific args
        let mut args = vec![
            "-ss".to_string(), format!("{:.3}", start_time),
            "-i".to_string(), video_path.to_string(),
            "-t".to_string(), format!("{:.3}", duration),
            "-vf".to_string(), crop_filter.clone(),
            "-c:v".to_string(), encoder.codec.clone(),
        ];
        
        // Add preset if applicable
        if let Some(enc_preset) = &encoder.preset {
            args.push("-preset".to_string());
            args.push(enc_preset.clone());
        }
        
        // Add quality parameter
        args.push(encoder.quality_param.clone());
        args.push(encoder.quality_value.clone());
        
        // Add common parameters
        args.extend_from_slice(&[
            "-r".to_string(), frame_rate.to_string(),
            "-c:a".to_string(), "aac".to_string(),
            "-b:a".to_string(), "192k".to_string(),
            "-pix_fmt".to_string(), "yuv420p".to_string(),
            "-avoid_negative_ts".to_string(), "1".to_string(),
            "-y".to_string(),
            segment_file.to_string_lossy().to_string(),
        ]);

        let output = shell.sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args(args)
            .output()
            .await
            .map_err(|e| format!("Failed to extract segment: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to extract segment: {}", stderr));
        }

        // Apply watermark to the main segment BEFORE concatenation with intro/outro
        // This ensures the watermark only appears on the main content, not on intro/outro
        if let Some(wm) = watermark_settings {
            if wm.enabled {
                println!("[Rust] Applying watermark to main segment (before concat with intro/outro)");
                let ar_str = aspect_ratio_to_string(aspect_ratio);
                apply_watermark_to_video_with_ratio(app, &segment_file, wm, quality, Some(&ar_str)).await?;
            }
        }

        // Process intro and outro if provided
        let mut intro_file: Option<std::path::PathBuf> = None;
        let mut outro_file: Option<std::path::PathBuf> = None;

        if let Some(intro) = intro_path {
            println!("[Rust] Processing intro video...");
            intro_file = Some(prepare_intro_outro_for_concat(
                app,
                intro,
                &temp_dir,
                "intro",
                aspect_ratio,
                quality,
                frame_rate,
                crop_w,
                crop_h,
                intro_outro_cache.clone()
            ).await?);
        }

        if let Some(outro) = outro_path {
            println!("[Rust] Processing outro video...");
            outro_file = Some(prepare_intro_outro_for_concat(
                app,
                outro,
                &temp_dir,
                "outro",
                aspect_ratio,
                quality,
                frame_rate,
                crop_w,
                crop_h,
                intro_outro_cache.clone()
            ).await?);
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

        let output = shell.sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args([
                "-f", "concat",
                "-safe", "0",
                "-i", concat_file.to_str().ok_or("Invalid concat file path")?,
                "-c", "copy",
                "-avoid_negative_ts", "1",
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
            
            // Get fonts directory
            let fonts_dir_for_burn = get_fonts_dir(app).ok();
            
            let sub_arg = sub_path.to_string_lossy().replace("\\", "/").replace(":", "\\:");
            
            // Build ass filter with fontsdir parameter
            let vf_arg = if let Some(fdir) = fonts_dir_for_burn {
                let fonts_dir_str = fdir.to_string_lossy().replace("\\", "/").replace(":", "\\:");
                format!("format=rgb24,ass='{}':fontsdir='{}'", sub_arg, fonts_dir_str)
            } else {
                format!("format=rgb24,ass='{}'", sub_arg)
            };

            // Set fontconfig path for FFmpeg to find our custom fonts
            let fontconfig_path = paths.temp.join("fonts.conf");
            
            // Build encoder-specific args
            let mut subtitle_args = vec![
                "-i".to_string(), concat_output_path.to_string_lossy().to_string(),
                "-vf".to_string(), vf_arg.clone(),
                "-c:v".to_string(), encoder.codec.clone(),
            ];
            
            // Add preset if applicable
            if let Some(enc_preset) = &encoder.preset {
                subtitle_args.push("-preset".to_string());
                subtitle_args.push(enc_preset.clone());
            }
            
            // Add quality parameter
            subtitle_args.push(encoder.quality_param.clone());
            subtitle_args.push(encoder.quality_value.clone());
            
            // Add audio filter if audio settings are provided
            if let Some(af) = build_audio_filter(audio_settings) {
                println!("[Rust] Applying audio filter (with subtitles): {}", af);
                subtitle_args.push("-af".to_string());
                subtitle_args.push(af);
            }
            
            // Add common parameters
            subtitle_args.extend_from_slice(&[
                "-c:a".to_string(), "aac".to_string(),
                "-b:a".to_string(), "192k".to_string(),
                "-pix_fmt".to_string(), "yuv420p".to_string(),
                "-movflags".to_string(), "+faststart".to_string(),
                "-y".to_string(),
                output_path.to_string_lossy().to_string(),
            ]);

            let output = shell.sidecar("ffmpeg")
                .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
                .env("FONTCONFIG_FILE", fontconfig_path.to_string_lossy().to_string())
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
            // Re-encode with audio filter
            println!("[Rust] Applying audio filter (no subtitles, with intro/outro)...");
            
            if let Some(af) = build_audio_filter(audio_settings) {
                let audio_args = vec![
                    "-i".to_string(), concat_output_path.to_string_lossy().to_string(),
                    "-c:v".to_string(), "copy".to_string(),
                    "-af".to_string(), af,
                    "-c:a".to_string(), "aac".to_string(),
                    "-b:a".to_string(), "192k".to_string(),
                    "-y".to_string(),
                    output_path.to_string_lossy().to_string(),
                ];
                
                let output = shell.sidecar("ffmpeg")
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
    let encoder = detect_hardware_encoder(app, quality).await;
    
    // Get fonts directory for subtitle rendering
    let fonts_dir = get_fonts_dir(app).ok();

    // Build video filter combining crop + color grading + subtitles in ONE PASS
    // Only Force RGB24 if using subtitles for accurate color rendering
    let mut vf_parts = vec![
        format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y)
    ];
    
    // Apply time-based color grading filters (eq, hue, vignette, etc.) after crop
    if let Some(ref filter_str) = video_filter_str {
        println!("[Rust] Applying time-based video color filters: {}", filter_str);
        vf_parts.push(filter_str.clone());
    }
    
    if let Some(path) = subtitle_path {
        vf_parts.push("format=rgb24".to_string());
        
        let path_str = path.to_string_lossy().replace("\\", "/").replace(":", "\\:");
        // Add fonts directory parameter to ass filter
        if let Some(ref fdir) = fonts_dir {
            let fonts_dir_str = fdir.to_string_lossy().replace("\\", "/").replace(":", "\\:");
            vf_parts.push(format!("ass='{}':fontsdir='{}'", path_str, fonts_dir_str));
        } else {
            vf_parts.push(format!("ass='{}'", path_str));
        }
    }
    
    let vf_arg = vf_parts.join(",");

    // Build encoder-specific args
    let mut args = vec![
        "-ss".to_string(), format!("{:.3}", start_time),
        "-i".to_string(), video_path.to_string(),
        "-t".to_string(), format!("{:.3}", duration),
        "-vf".to_string(), vf_arg,
        "-c:v".to_string(), encoder.codec.clone(),
    ];
    
    // Add preset if applicable
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }
    
    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());
    
    // Add audio filter if audio settings are provided
    if let Some(af) = build_audio_filter(audio_settings) {
        println!("[Rust] Applying audio filter: {}", af);
        args.push("-af".to_string());
        args.push(af);
    }
    
    // Add common parameters
    args.extend_from_slice(&[
        "-r".to_string(), frame_rate.to_string(),
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-avoid_negative_ts".to_string(), "1".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    // Set fontconfig path for FFmpeg to find our custom fonts
    let fontconfig_path = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?
        .temp.join("fonts.conf");

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .env("FONTCONFIG_FILE", fontconfig_path.to_string_lossy().to_string())
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg failed: {}", stderr));
    }

    // Apply watermark if enabled (after all other processing)
    if let Some(wm) = watermark_settings {
        if wm.enabled {
            let ar_str = aspect_ratio_to_string(aspect_ratio);
            apply_watermark_to_video_with_ratio(app, output_path, wm, quality, Some(&ar_str)).await?;
        }
    }

    Ok(())
}

// Build multi-segment clip with aspect ratio and quality settings
// Note: output_format is unused here because the path already has the correct extension
pub async fn build_multi_segment_clip_with_settings(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segments: &[serde_json::Value],
    subtitle_path: Option<&std::path::Path>,
    aspect_ratio: &AspectRatio,
    quality: &str,
    frame_rate: u32,
    _output_format: &str,  // Format already applied in output_path extension
    intro_path: Option<&str>,
    outro_path: Option<&str>,
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>,
    watermark_settings: Option<&WatermarkSettings>,
    audio_settings: Option<&AudioSettings>,
    video_filter_segments: Option<&Vec<VideoFilterSegment>>
) -> Result<(), String> {
    let shell = app.shell();

    // Get storage paths for temporary files
    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let temp_dir = paths.temp.join(format!("clip_segments_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    println!("[Rust] Building {} segments with aspect ratio {}:{}", segments.len(), aspect_ratio.width, aspect_ratio.height);

    // Get video info for cropping
    let video_info = get_video_info(app, video_path).await?;
    let (crop_w, crop_h, crop_x, crop_y) = calculate_crop_params(video_info.width, video_info.height, aspect_ratio);
    
    // Get quality settings (unused in this path, but kept for reference)
    let (_preset, _crf) = get_quality_settings(quality);
    
    // Detect hardware encoder for better performance
    let encoder = detect_hardware_encoder(app, quality).await;

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
    println!("[Rust] Extracting {} segments in parallel with time-based filters...", segments.len());
    let segment_tasks: Vec<_> = segments.iter().enumerate().map(|(i, segment)| {
        let start_time: f64 = segment["start_time"].as_f64().unwrap_or(0.0);
        let end_time: f64 = segment["end_time"].as_f64().unwrap_or(0.0);
        let duration = end_time - start_time;
        let segment_file = temp_dir.join(format!("segment_{:03}.mp4", i));
        let video_path = video_path.to_string();
        let app = app.clone();
        let encoder = encoder.clone();
        let frame_rate_str = frame_rate.to_string();
        let output_offset = segment_output_offsets[i];
        
        // Get filters that overlap with this segment's output time range
        // and adjust their times to be relative to this segment (starting at 0)
        let segment_filter_str = if let Some(filter_segments) = video_filter_segments {
            let overlapping = get_overlapping_filter_segments(
                Some(filter_segments),
                output_offset,
                output_offset + duration
            );
            if let Some(ref segs) = overlapping {
                build_time_based_filter_string(segs)
            } else {
                None
            }
        } else {
            None
        };
        
        // Build crop filter with optional time-based color grading for this segment
        let crop_filter = if let Some(ref filter_str) = segment_filter_str {
            format!("crop={}:{}:{}:{},{}", crop_w, crop_h, crop_x, crop_y, filter_str)
        } else {
            format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y)
        };
        
        if segment_filter_str.is_some() {
            println!("[Rust] Segment {} has time-based filters applied", i);
        }

        async move {
            let shell = app.shell();
            
            // Build encoder-specific args
            let mut args = vec![
                "-ss".to_string(), format!("{:.3}", start_time),
                "-i".to_string(), video_path.clone(),
                "-t".to_string(), format!("{:.3}", duration),
                "-vf".to_string(), crop_filter.clone(),
                "-c:v".to_string(), encoder.codec.clone(),
            ];
            
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
                "-r".to_string(), frame_rate_str.clone(),
                "-c:a".to_string(), "aac".to_string(),
                "-b:a".to_string(), "192k".to_string(),
                "-pix_fmt".to_string(), "yuv420p".to_string(),
                "-avoid_negative_ts".to_string(), "1".to_string(),
                "-y".to_string(),
                segment_file.to_string_lossy().to_string(),
            ]);
            
            let output = shell.sidecar("ffmpeg")
                .map_err(|e| format!("Failed to get ffmpeg sidecar for segment {}: {}", i, e))?
                .args(args)
                .output()
                .await
                .map_err(|e| format!("Failed to extract segment {}: {}", i, e))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("Failed to extract segment {}: {}", i, stderr));
            }

            Ok::<std::path::PathBuf, String>(segment_file)
        }
    }).collect();

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
    
    println!("[Rust] All {} segments extracted successfully", segment_files.len());

    // Apply watermark to each segment BEFORE concatenation with intro/outro
    // This ensures the watermark only appears on the main content, not on intro/outro
    if let Some(wm) = watermark_settings {
        if wm.enabled {
            println!("[Rust] Applying watermark to {} segments (before concat with intro/outro)", segment_files.len());
            let ar_str = aspect_ratio_to_string(aspect_ratio);
            for segment_file in &segment_files {
                apply_watermark_to_video_with_ratio(app, segment_file, wm, quality, Some(&ar_str)).await?;
            }
        }
    }

    // Process intro and outro if provided
    let mut intro_file: Option<std::path::PathBuf> = None;
    let mut outro_file: Option<std::path::PathBuf> = None;

    if let Some(intro) = intro_path {
        println!("[Rust] Processing intro video...");
        intro_file = Some(prepare_intro_outro_for_concat(
            app,
            intro,
            &temp_dir,
            "intro",
            aspect_ratio,
            quality,
            frame_rate,
            crop_w,
            crop_h,
            intro_outro_cache.clone()
        ).await?);
    }

    if let Some(outro) = outro_path {
        println!("[Rust] Processing outro video...");
        outro_file = Some(prepare_intro_outro_for_concat(
            app,
            outro,
            &temp_dir,
            "outro",
            aspect_ratio,
            quality,
            frame_rate,
            crop_w,
            crop_h,
            intro_outro_cache.clone()
        ).await?);
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

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file.to_str().ok_or("Invalid concat file path")?,
            "-c", "copy",
            "-avoid_negative_ts", "1",
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
        
        // Get fonts directory for multi-segment path
        let fonts_dir_for_burn = get_fonts_dir(app).ok();
        
        let sub_arg = sub_path.to_string_lossy().replace("\\", "/").replace(":", "\\:");
        
        // Build ass filter with fontsdir parameter
        // Force RGB24 for accurate subtitle color rendering
        let vf_arg = if let Some(fdir) = fonts_dir_for_burn {
            let fonts_dir_str = fdir.to_string_lossy().replace("\\", "/").replace(":", "\\:");
            format!("format=rgb24,ass='{}':fontsdir='{}'", sub_arg, fonts_dir_str)
        } else {
            format!("format=rgb24,ass='{}'", sub_arg)
        };

        // Set fontconfig path for FFmpeg to find our custom fonts
        let fontconfig_path = paths.temp.join("fonts.conf");
        
        // Build encoder-specific args
        let mut subtitle_args = vec![
            "-i".to_string(), concat_output_path.to_string_lossy().to_string(),
            "-vf".to_string(), vf_arg.clone(),
            "-c:v".to_string(), encoder.codec.clone(),
        ];
        
        // Add preset if applicable
        if let Some(enc_preset) = &encoder.preset {
            subtitle_args.push("-preset".to_string());
            subtitle_args.push(enc_preset.clone());
        }
        
        // Add quality parameter
        subtitle_args.push(encoder.quality_param.clone());
        subtitle_args.push(encoder.quality_value.clone());
        
        // Add audio filter if audio settings are provided
        if let Some(af) = build_audio_filter(audio_settings) {
            println!("[Rust] Applying audio filter (multi-segment with subtitles): {}", af);
            subtitle_args.push("-af".to_string());
            subtitle_args.push(af);
        }
        
        // Add common parameters
        subtitle_args.extend_from_slice(&[
            "-c:a".to_string(), "aac".to_string(),
            "-b:a".to_string(), "192k".to_string(),
            "-pix_fmt".to_string(), "yuv420p".to_string(),
            "-movflags".to_string(), "+faststart".to_string(),
            "-y".to_string(),
            output_path.to_string_lossy().to_string(),
        ]);

        let output = shell.sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .env("FONTCONFIG_FILE", fontconfig_path.to_string_lossy().to_string())
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
                "-i".to_string(), concat_output_path.to_string_lossy().to_string(),
                "-c:v".to_string(), "copy".to_string(),
                "-af".to_string(), af,
                "-c:a".to_string(), "aac".to_string(),
                "-b:a".to_string(), "192k".to_string(),
                "-y".to_string(),
                output_path.to_string_lossy().to_string(),
            ];
            
            let output = shell.sidecar("ffmpeg")
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
    cache: Arc<Mutex<IntroOutroCache>>
) -> Result<std::path::PathBuf, String> {
    // Create cache key based on all relevant parameters
    let cache_key = (
        intro_outro_path.to_string(),
        format!("{}:{}", aspect_ratio.width, aspect_ratio.height),
        frame_rate,
        crop_w,
        crop_h
    );
    
    // Check if already processed in this build session
    {
        let cache_lock = cache.lock().unwrap();
        if let Some(cached_path) = cache_lock.get(&cache_key) {
            if cached_path.exists() {
                println!("[Rust] Using cached {} from: {}", file_prefix, cached_path.display());
                return Ok(cached_path.clone());
            }
        }
    } // Lock is dropped here before any await points
    
    let shell = app.shell();
    println!("[Rust] Preparing {} for concat with aspect ratio {}:{}", file_prefix, aspect_ratio.width, aspect_ratio.height);

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Create output path in temp directory
    let output_path = temp_dir.join(format!("{}_processed.mp4", file_prefix));

    // Build scale + pad filter to fit intro/outro within target dimensions
    // This maintains aspect ratio and adds black bars if needed (letterbox/pillarbox)
    let scale_pad_filter = format!(
        "scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black",
        crop_w, crop_h, crop_w, crop_h
    );

    // Build encoder-specific args
    let mut args = vec![
        "-i".to_string(), intro_outro_path.to_string(),
        "-vf".to_string(), scale_pad_filter,
        "-c:v".to_string(), encoder.codec.clone(),
    ];
    
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
        "-r".to_string(), frame_rate.to_string(),
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-avoid_negative_ts".to_string(), "1".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    // Process the intro/outro
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to process {}: {}", file_prefix, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg failed to process {}: {}", file_prefix, stderr));
    }

    println!("[Rust] Successfully processed {} to: {}", file_prefix, output_path.display());
    
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

use super::types::{FramingStrategy, FramingMode, PanKeyframe, ManualFramingConfig};

/// Builds a split screen clip with two video regions stacked vertically.
/// 
/// This is used for gaming/screen share content where the speaker is in one corner
/// and the main content (gameplay, presentation) occupies the rest of the frame.
/// 
/// The resulting video has:
/// - Top region: Content area (e.g., gameplay)
/// - Bottom region: Speaker area
pub async fn build_split_screen_clip(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    strategy: &FramingStrategy,
    target_aspect_ratio: &str,  // Target aspect ratio (e.g., "9:16", "4:5", "1:1")
    quality: &str,
    frame_rate: u32,
    audio_settings: Option<&AudioSettings>,
    video_filter_segments: Option<&Vec<VideoFilterSegment>>,
) -> Result<(), String> {
    // Build time-based filter string for the full clip duration
    let video_filter_str = build_video_filter_string(video_filter_segments);
    let shell = app.shell();
    let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
    let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
    let duration = end_time - start_time;

    let layout = strategy.layout.as_ref()
        .ok_or("Split screen strategy missing layout configuration")?;

    // Parse target aspect ratio from parameter
    let aspect = parse_aspect_ratio_string(target_aspect_ratio)
        .unwrap_or(super::types::AspectRatio { width: 9.0, height: 16.0 });
    
    println!("[Rust] Building split screen clip with ratio: {}, aspect: {}:{}", 
        layout.split_ratio, aspect.width, aspect.height);

    // Get video info for pixel calculations
    let video_info = get_video_info(app, video_path).await?;
    let source_w = video_info.width as f64;
    let source_h = video_info.height as f64;

    // Calculate output dimensions based on target aspect ratio
    // Use 1080 as base width, calculate height from aspect ratio
    let output_w: u32 = 1080;
    let output_h: u32 = ((output_w as f32) * aspect.height / aspect.width) as u32;

    // Calculate heights for each split region in the output
    let top_output_height = (output_h as f64 * layout.split_ratio) as u32;
    let bottom_output_height = output_h - top_output_height;

    // Calculate the CORRECT aspect ratio for each split region
    // This is crucial - each split has its own aspect ratio, not the overall 9:16
    let top_split_aspect = output_w as f64 / top_output_height as f64;
    let bottom_split_aspect = output_w as f64 / bottom_output_height as f64;
    
    println!("[Rust] Top split aspect: {:.4} ({}x{})", top_split_aspect, output_w, top_output_height);
    println!("[Rust] Bottom split aspect: {:.4} ({}x{})", bottom_split_aspect, output_w, bottom_output_height);

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
        source_w as u32, source_h as u32,
        top_split_aspect,
        top_center_x, top_center_y
    );
    
    // Bottom region: crop from source with aspect ratio matching bottom_split_aspect
    // Use the width/height from layout as maximum bounds to zoom into facecam
    // CRITICAL: Always maintain exact aspect ratio - never stretch!
    // For facecam, we want aggressive zooming - apply constraint if crop size is smaller than full frame
    let (bottom_crop_w, bottom_crop_h, bottom_x, bottom_y) = 
        if bottom_crop.width > 0.0 && bottom_crop.height > 0.0 && 
           (bottom_crop.width < 0.8 || bottom_crop.height < 0.8) {
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
            
            println!("[Rust] Using constraint-based crop for facecam zoom: {}x{} (from norm: {}x{})", 
                final_w, final_h, max_w_norm, max_h_norm);
            
            // Recalculate position to center on speaker with new dimensions
            let center_x_px = (source_w * bottom_center_x) as i32;
            let center_y_px = (source_h * bottom_center_y) as i32;
            
            let mut final_x = center_x_px - (final_w as i32 / 2);
            let mut final_y = center_y_px - (final_h as i32 / 2);
            
            // Clamp to valid range
            let source_w_u32 = source_w as u32;
            let source_h_u32 = source_h as u32;
            final_x = final_x.max(0).min((source_w_u32.saturating_sub(final_w)) as i32);
            final_y = final_y.max(0).min((source_h_u32.saturating_sub(final_h)) as i32);
            
            (final_w, final_h, final_x as u32, final_y as u32)
        } else {
            // No zoom constraint - use normal aspect-preserving crop
            calculate_aspect_preserving_crop(
                source_w as u32, source_h as u32,
                bottom_split_aspect,
                bottom_center_x, bottom_center_y
            )
        };
    
    println!("[Rust] Top crop: {}x{} at ({},{})", top_crop_w, top_crop_h, top_x, top_y);
    println!("[Rust] Bottom crop: {}x{} at ({},{})", bottom_crop_w, bottom_crop_h, bottom_x, bottom_y);

    // Build complex filter for split screen
    // Each crop maintains the correct aspect ratio for its output region
    // Use force_original_aspect_ratio=decrease to prevent stretching - crop to fit instead
    
    // Add time-based color grading filter if present (applied after vstack)
    if video_filter_str.is_some() {
        println!("[Rust] Applying time-based video color filters in split screen: {:?}", video_filter_str);
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

    // Build FFmpeg args
    let mut args = vec![
        "-ss".to_string(), format!("{:.3}", start_time),
        "-i".to_string(), video_path.to_string(),
        "-t".to_string(), format!("{:.3}", duration),
        "-filter_complex".to_string(), filter_complex,
        "-map".to_string(), "[outv]".to_string(),
        "-map".to_string(), "0:a?".to_string(),
        "-c:v".to_string(), encoder.codec.clone(),
    ];

    // Add encoder preset
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    // Add audio filter if settings provided
    if let Some(af) = build_audio_filter(audio_settings) {
        args.push("-af".to_string());
        args.push(af);
    }

    // Common output parameters
    args.extend_from_slice(&[
        "-r".to_string(), frame_rate.to_string(),
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    println!("[Rust] Running split screen FFmpeg command...");

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg split screen failed: {}", stderr));
    }

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
    target_aspect: f64,  // width / height
    center_x: f64,       // normalized 0-1
    center_y: f64,       // normalized 0-1
) -> (u32, u32, u32, u32) {
    let source_aspect = source_w as f64 / source_h as f64;
    
    let (crop_w, crop_h) = if target_aspect > source_aspect {
        // Target is wider - use full width, crop height
        let w = source_w;
        let h = (source_w as f64 / target_aspect) as u32;
        (w, h)
    } else {
        // Target is taller - use full height, crop width
        let h = source_h;
        let w = (source_h as f64 * target_aspect) as u32;
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
pub async fn build_dynamic_pan_clip(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    strategy: &FramingStrategy,
    target_aspect_ratio: &str,  // Target aspect ratio (e.g., "9:16", "4:5", "1:1")
    quality: &str,
    frame_rate: u32,
    audio_settings: Option<&AudioSettings>,
    video_filter_segments: Option<&Vec<VideoFilterSegment>>,
) -> Result<(), String> {
    // Build time-based filter string
    let video_filter_str = build_video_filter_string(video_filter_segments);
    let shell = app.shell();
    let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
    let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
    let duration = end_time - start_time;

    let keyframes = strategy.keyframes.as_ref()
        .ok_or("Dynamic pan strategy missing keyframes")?;

    // Parse target aspect ratio from parameter
    let aspect = parse_aspect_ratio_string(target_aspect_ratio)
        .unwrap_or(super::types::AspectRatio { width: 9.0, height: 16.0 });
    
    println!("[Rust] Building dynamic pan clip with {} keyframes, aspect: {}:{}", 
        keyframes.len(), aspect.width, aspect.height);

    // Get video info
    let video_info = get_video_info(app, video_path).await?;
    let source_w = video_info.width;
    let source_h = video_info.height;

    // Calculate crop dimensions for target aspect ratio
    let target_aspect = aspect.width as f64 / aspect.height as f64;
    let source_aspect = source_w as f64 / source_h as f64;
    
    let (crop_w, crop_h) = if target_aspect < source_aspect {
        // Crop width (most common case: 16:9 to 9:16)
        let h = source_h;
        let w = (h as f64 * target_aspect) as u32;
        (w, h)
    } else {
        // Crop height
        let w = source_w;
        let h = (w as f64 / target_aspect) as u32;
        (w, h)
    };

    // Build pan expression from keyframes
    let pan_expr = build_pan_expression(keyframes, source_w, crop_w, start_time, duration);

    // Build video filter with optional time-based color grading
    let vf = if let Some(ref filter_str) = video_filter_str {
        println!("[Rust] Applying time-based video color filters in dynamic pan: {}", filter_str);
        format!("crop={}:{}:{}:0,{}", crop_w, crop_h, pan_expr, filter_str)
    } else {
        format!("crop={}:{}:{}:0", crop_w, crop_h, pan_expr)
    };

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Build FFmpeg args
    let mut args = vec![
        "-ss".to_string(), format!("{:.3}", start_time),
        "-i".to_string(), video_path.to_string(),
        "-t".to_string(), format!("{:.3}", duration),
        "-vf".to_string(), vf,
        "-c:v".to_string(), encoder.codec.clone(),
    ];

    // Add encoder preset
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    // Add audio filter if settings provided
    if let Some(af) = build_audio_filter(audio_settings) {
        args.push("-af".to_string());
        args.push(af);
    }

    // Common output parameters
    args.extend_from_slice(&[
        "-r".to_string(), frame_rate.to_string(),
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    println!("[Rust] Running dynamic pan FFmpeg command...");

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg dynamic pan failed: {}", stderr));
    }

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
    segment_duration: f64
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
    let relevant_keyframes: Vec<&PanKeyframe> = keyframes.iter()
        .filter(|kf| kf.timestamp >= segment_start && kf.timestamp <= segment_start + segment_duration)
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

/// Builds a multi-region clip with user-defined crop regions composited together.
/// 
/// This is used for manual POI (Point of Interest) framing where the user defines
/// multiple regions from the source video and their positions in the output canvas.
/// 
/// Each region is:
/// 1. Cropped from the source video
/// 2. Scaled to fit its output rect
/// 3. Placed on the output canvas
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
) -> Result<(), String> {
    // Build time-based filter string
    let video_filter_str = build_video_filter_string(video_filter_segments);
    let shell = app.shell();
    let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
    let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
    let duration = end_time - start_time;

    if config.regions.is_empty() {
        return Err("MultiRegion config has no regions defined".to_string());
    }

    // Parse target aspect ratio
    let aspect = parse_aspect_ratio_string(target_aspect_ratio)
        .unwrap_or(super::types::AspectRatio { width: 9.0, height: 16.0 });
    
    println!("[Rust] Building multi-region clip with {} regions, aspect: {}:{}", 
        config.regions.len(), aspect.width, aspect.height);

    // Get video info for pixel calculations
    let video_info = get_video_info(app, video_path).await?;
    let source_w = video_info.width as f64;
    let source_h = video_info.height as f64;

    // Calculate output dimensions (1080p base width)
    let output_w: u32 = 1080;
    let output_h: u32 = ((output_w as f32) * aspect.height / aspect.width) as u32;

    println!("[Rust] Output dimensions: {}x{}", output_w, output_h);

    // Build FFmpeg complex filter for multi-region compositing
    // Strategy:
    // 1. Input video gets labeled as [v]
    // 2. For each region, crop from [v] and scale to output size
    // 3. Create black canvas and overlay each region at its output position
    
    let mut filter_parts: Vec<String> = Vec::new();
    let mut region_labels: Vec<(String, u32, u32)> = Vec::new();

    // For each region, create crop and scale filters
    for (i, region) in config.regions.iter().enumerate() {
        // Calculate source crop in pixels
        let crop_x = (region.source.x * source_w) as u32;
        let crop_y = (region.source.y * source_h) as u32;
        let crop_w = (region.source.width * source_w) as u32;
        let crop_h = (region.source.height * source_h) as u32;

        // Calculate output position and size in pixels
        let out_x = (region.output.x * output_w as f64) as u32;
        let out_y = (region.output.y * output_h as f64) as u32;
        let out_w = (region.output.width * output_w as f64) as u32;
        let out_h = (region.output.height * output_h as f64) as u32;

        println!("[Rust] Region {}: crop={}:{}:{}:{} -> scale={}:{} @ ({},{})", 
            i, crop_w, crop_h, crop_x, crop_y, out_w, out_h, out_x, out_y);

        let label = format!("r{}", i);
        
        // Crop from input and scale to output size
        // Using lanczos scaling for better quality
        filter_parts.push(format!(
            "[0:v]crop={}:{}:{}:{},scale={}:{}:flags=lanczos[{}]",
            crop_w, crop_h, crop_x, crop_y, out_w, out_h, label
        ));
        
        region_labels.push((label, out_x, out_y));
    }

    // Create base canvas (black background)
    filter_parts.push(format!(
        "color=c=black:s={}x{}:d={}[base]",
        output_w, output_h, duration
    ));

    // Build overlay chain
    // Start with base canvas, overlay each region
    let mut current_label = "base".to_string();
    for (i, (region_label, out_x, out_y)) in region_labels.iter().enumerate() {
        let next_label = if i == region_labels.len() - 1 {
            "vout".to_string() // Final output
        } else {
            format!("tmp{}", i)
        };

        filter_parts.push(format!(
            "[{}][{}]overlay={}:{}[{}]",
            current_label, region_label, out_x, out_y, next_label
        ));

        current_label = next_label;
    }

    // Add time-based color grading filter if present (applied after final composition)
    if let Some(ref filter_str) = video_filter_str {
        println!("[Rust] Applying time-based video color filters in multi-region: {}", filter_str);
        // Apply filter to the final vout output
        filter_parts.push(format!("[vout]{}[vout_graded]", filter_str));
    }
    
    let filter_complex = filter_parts.join(";");
    
    // Use graded output if color filter was applied
    let map_label = if video_filter_str.is_some() {
        "[vout_graded]"
    } else {
        "[vout]"
    };

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Build FFmpeg args
    let mut args = vec![
        "-ss".to_string(), format!("{:.3}", start_time),
        "-i".to_string(), video_path.to_string(),
        "-t".to_string(), format!("{:.3}", duration),
        "-filter_complex".to_string(), filter_complex,
        "-map".to_string(), map_label.to_string(),
        "-map".to_string(), "0:a?".to_string(), // Map audio if present
        "-c:v".to_string(), encoder.codec.clone(),
        "-r".to_string(), frame_rate.to_string(),
    ];

    // Add encoder preset
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    // Add audio settings
    args.push("-c:a".to_string());
    args.push("aac".to_string());
    args.push("-b:a".to_string());
    args.push("192k".to_string());

    // Add audio gain if specified
    if let Some(audio) = audio_settings {
        if audio.volume != 0.0 {
            let af = format!("volume={}dB", audio.volume);
            args.push("-af".to_string());
            args.push(af);
        }
    }

    // Output
    args.push("-y".to_string());
    args.push(output_path.to_string_lossy().to_string());

    println!("[Rust] Running FFmpeg multi-region build...");
    
    let output = shell.command("ffmpeg")
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Failed to run FFmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg multi-region build failed: {}", stderr));
    }

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
pub async fn build_clip_with_framing_strategy(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    strategy: &FramingStrategy,
    target_aspect_ratio: &str,  // Override aspect ratio (e.g., "9:16", "4:5", "1:1")
    quality: &str,
    frame_rate: u32,
    subtitle_path: Option<&std::path::Path>,
    intro_path: Option<&str>,
    outro_path: Option<&str>,
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>,
    watermark_settings: Option<&WatermarkSettings>,
    audio_settings: Option<&AudioSettings>,
    video_filter_segments: Option<&Vec<VideoFilterSegment>>,
) -> Result<(), String> {
    println!("[Rust] Building clip with framing strategy: {:?}, target: {}", strategy.mode, target_aspect_ratio);

    match strategy.mode {
        FramingMode::SplitScreen => {
            // For split screen, we build without subtitles first, then add them
            let temp_output = if subtitle_path.is_some() {
                let paths = crate::storage::init_storage_dirs()
                    .map_err(|e| format!("Failed to get storage paths: {}", e))?;
                Some(paths.temp.join(format!("split_temp_{}.mp4", uuid::Uuid::new_v4())))
            } else {
                None
            };

            let output_path_buf = output_path.to_path_buf();
            let build_path = temp_output.as_ref().unwrap_or(&output_path_buf);
            
            build_split_screen_clip(
                app, video_path, build_path, segment, strategy, target_aspect_ratio, quality, frame_rate, audio_settings, video_filter_segments
            ).await?;

            // Add subtitles if needed
            if let (Some(temp), Some(sub_path)) = (&temp_output, subtitle_path) {
                burn_subtitles_to_video(app, temp, output_path, sub_path, quality).await?;
                let _ = std::fs::remove_file(temp);
            }
        },
        FramingMode::DynamicPan => {
            let temp_output = if subtitle_path.is_some() {
                let paths = crate::storage::init_storage_dirs()
                    .map_err(|e| format!("Failed to get storage paths: {}", e))?;
                Some(paths.temp.join(format!("pan_temp_{}.mp4", uuid::Uuid::new_v4())))
            } else {
                None
            };

            let output_path_buf = output_path.to_path_buf();
            let build_path = temp_output.as_ref().unwrap_or(&output_path_buf);

            build_dynamic_pan_clip(
                app, video_path, build_path, segment, strategy, target_aspect_ratio, quality, frame_rate, audio_settings, video_filter_segments
            ).await?;

            // Add subtitles if needed
            if let (Some(temp), Some(sub_path)) = (&temp_output, subtitle_path) {
                burn_subtitles_to_video(app, temp, output_path, sub_path, quality).await?;
                let _ = std::fs::remove_file(temp);
            }
        },
        FramingMode::Static => {
            // Parse target aspect ratio from parameter (e.g., "9:16", "1:1", "4:5")
            let aspect_ratio = parse_aspect_ratio_string(target_aspect_ratio)
                .unwrap_or(super::types::AspectRatio { width: 9.0, height: 16.0 });
            
            println!("[Rust] Static mode with aspect ratio: {}:{}", aspect_ratio.width, aspect_ratio.height);
            
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
                None, // Don't apply watermark inside, we apply it at the end of this function to handle per-ratio settings correctly
                audio_settings,
                video_filter_segments,
            ).await?;
        },
        FramingMode::MultiRegion => {
            // Manual multi-region mode with user-defined regions
            let multi_region_config = strategy.multi_region.as_ref()
                .ok_or("MultiRegion mode requires multi_region configuration")?;

            let temp_output = if subtitle_path.is_some() {
                let paths = crate::storage::init_storage_dirs()
                    .map_err(|e| format!("Failed to get storage paths: {}", e))?;
                Some(paths.temp.join(format!("multi_region_temp_{}.mp4", uuid::Uuid::new_v4())))
            } else {
                None
            };

            let output_path_buf = output_path.to_path_buf();
            let build_path = temp_output.as_ref().unwrap_or(&output_path_buf);

            build_multi_region_clip(
                app, video_path, build_path, segment, multi_region_config, target_aspect_ratio, quality, frame_rate, audio_settings, video_filter_segments
            ).await?;

            // Add subtitles if needed
            if let (Some(temp), Some(sub_path)) = (&temp_output, subtitle_path) {
                burn_subtitles_to_video(app, temp, output_path, sub_path, quality).await?;
                let _ = std::fs::remove_file(temp);
            }
        },
    }

    // Apply watermark if enabled (after all other processing)
    if let Some(wm) = watermark_settings {
        if wm.enabled {
            apply_watermark_to_video_with_ratio(app, output_path, wm, quality, Some(target_aspect_ratio)).await?;
        }
    }

    Ok(())
}

/// Builds a multi-segment clip with framing strategy applied.
/// 
/// This extracts each segment, applies the framing strategy, then concatenates them.
pub async fn build_multi_segment_clip_with_framing_strategy(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segments: &[serde_json::Value],
    strategy: &FramingStrategy,
    target_aspect_ratio: &str,  // Target aspect ratio (e.g., "9:16", "4:5", "1:1")
    quality: &str,
    frame_rate: u32,
    subtitle_path: Option<&std::path::Path>,
    intro_path: Option<&str>,
    outro_path: Option<&str>,
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>,
    watermark_settings: Option<&WatermarkSettings>,
    audio_settings: Option<&AudioSettings>,
    video_filter_segments: Option<&Vec<VideoFilterSegment>>,
) -> Result<(), String> {
    use futures::future::join_all;
    
    println!("[Rust] Building multi-segment clip with framing strategy: {:?}, target: {}", strategy.mode, target_aspect_ratio);
    println!("[Rust] Processing {} segments", segments.len());

    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    // Extract each segment with framing applied in parallel
    let temp_files: Vec<std::path::PathBuf> = segments.iter()
        .enumerate()
        .map(|(i, _)| paths.temp.join(format!("segment_framed_{}_{}.mp4", uuid::Uuid::new_v4(), i)))
        .collect();

    // Build each segment with framing strategy
    let target_aspect_ratio_owned = target_aspect_ratio.to_string();
    let segment_tasks: Vec<_> = segments.iter().enumerate().map(|(i, segment)| {
        let app = app.clone();
        let video_path = video_path.to_string();
        let temp_path = temp_files[i].clone();
        let strategy = strategy.clone();
        let quality = quality.to_string();
        let audio_settings = audio_settings.cloned();
        let video_filter_segments = video_filter_segments.cloned();
        let target_ar = target_aspect_ratio_owned.clone();

        async move {
            println!("[Rust] Building framed segment {}/{}", i + 1, segments.len());
            
            match strategy.mode {
                FramingMode::SplitScreen => {
                    build_split_screen_clip(
                        &app, &video_path, &temp_path, segment, &strategy, &target_ar, &quality, frame_rate, audio_settings.as_ref(), video_filter_segments.as_ref()
                    ).await?;
                },
                FramingMode::DynamicPan => {
                    build_dynamic_pan_clip(
                        &app, &video_path, &temp_path, segment, &strategy, &target_ar, &quality, frame_rate, audio_settings.as_ref(), video_filter_segments.as_ref()
                    ).await?;
                },
                FramingMode::Static => {
                    // For static mode, use the target aspect ratio
                    let aspect_ratio = parse_aspect_ratio_string(&target_ar)
                        .unwrap_or(super::types::AspectRatio { width: 9.0, height: 16.0 });
                    extract_segment_with_crop(&app, &video_path, &temp_path, segment, &aspect_ratio, &quality, frame_rate, audio_settings.as_ref(), video_filter_segments.as_ref()).await?;
                },
                FramingMode::MultiRegion => {
                    // For multi-region mode, use the manual config
                    if let Some(multi_region) = &strategy.multi_region {
                        build_multi_region_clip(
                            &app, &video_path, &temp_path, segment, multi_region, &target_ar, &quality, frame_rate, audio_settings.as_ref(), video_filter_segments.as_ref()
                        ).await?;
                    } else {
                        // Fallback to static if no multi-region config
                        let aspect_ratio = parse_aspect_ratio_string(&target_ar)
                            .unwrap_or(super::types::AspectRatio { width: 9.0, height: 16.0 });
                        extract_segment_with_crop(&app, &video_path, &temp_path, segment, &aspect_ratio, &quality, frame_rate, audio_settings.as_ref(), video_filter_segments.as_ref()).await?;
                    }
                },
            }
            
            Ok::<(), String>(())
        }
    }).collect();

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

    println!("[Rust] All {} segments processed, concatenating...", segments.len());

    // Create concat file
    let concat_file = paths.temp.join(format!("concat_{}.txt", uuid::Uuid::new_v4()));
    let concat_content: String = temp_files.iter()
        .map(|f| format!("file '{}'", f.to_string_lossy().replace("\\", "/")))
        .collect::<Vec<_>>()
        .join("\n");
    
    std::fs::write(&concat_file, &concat_content)
        .map_err(|e| format!("Failed to write concat file: {}", e))?;

    // Determine if we need a temp output for post-processing
    let needs_post_processing = subtitle_path.is_some() || intro_path.is_some() || outro_path.is_some();
    let concat_output = if needs_post_processing {
        paths.temp.join(format!("concat_out_{}.mp4", uuid::Uuid::new_v4()))
    } else {
        output_path.to_path_buf()
    };

    // Concatenate segments
    let shell = app.shell();
    let encoder = detect_hardware_encoder(app, quality).await;
    
    let mut args = vec![
        "-f".to_string(), "concat".to_string(),
        "-safe".to_string(), "0".to_string(),
        "-i".to_string(), concat_file.to_string_lossy().to_string(),
        "-c:v".to_string(), encoder.codec.clone(),
    ];

    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());
    
    args.extend_from_slice(&[
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-r".to_string(), frame_rate.to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-y".to_string(),
        concat_output.to_string_lossy().to_string(),
    ]);

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    // Clean up segment temp files
    for temp_file in &temp_files {
        let _ = std::fs::remove_file(temp_file);
    }
    let _ = std::fs::remove_file(&concat_file);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg concat failed: {}", stderr));
    }

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
            apply_watermark_to_video_with_ratio(app, output_path, wm, quality, Some(target_aspect_ratio)).await?;
        }
    }

    println!("[Rust] Multi-segment framed clip built successfully");
    Ok(())
}

/// Helper to extract a segment with simple center crop (for Static framing mode)
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
) -> Result<(), String> {
    // Build time-based filter string
    let video_filter_str = build_video_filter_string(video_filter_segments);
    let shell = app.shell();
    let encoder = detect_hardware_encoder(app, quality).await;
    
    let start = segment.get("start_time")
        .and_then(|v| v.as_f64())
        .ok_or("Missing start_time")?;
    let end = segment.get("end_time")
        .and_then(|v| v.as_f64())
        .ok_or("Missing end_time")?;
    let duration = end - start;

    // Get video dimensions for crop calculation
    let video_info = get_video_info(app, video_path).await?;
    let (crop_w, crop_h, crop_x, crop_y) = calculate_crop_params(
        video_info.width, video_info.height, aspect_ratio
    );

    // Build crop filter with optional time-based color grading
    let crop_filter = format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y);
    let scale_filter = "scale=1080:1920:flags=lanczos";
    
    // Add time-based color grading filters if present
    let vf = if let Some(ref filter_str) = video_filter_str {
        println!("[Rust] Applying time-based video color filters in extract_segment_with_crop: {}", filter_str);
        format!("{},{},{}", crop_filter, filter_str, scale_filter)
    } else {
        format!("{},{}", crop_filter, scale_filter)
    };

    let mut args = vec![
        "-ss".to_string(), start.to_string(),
        "-i".to_string(), video_path.to_string(),
        "-t".to_string(), duration.to_string(),
        "-vf".to_string(), vf,
        "-c:v".to_string(), encoder.codec.clone(),
    ];

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

    args.extend_from_slice(&[
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-r".to_string(), frame_rate.to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg crop failed: {}", stderr));
    }

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
    let shell = app.shell();
    let encoder = detect_hardware_encoder(app, quality).await;

    let sub_arg = subtitle_path.to_string_lossy().replace("\\", "/").replace(":", "\\:");
    let vf_arg = format!("format=rgb24,ass='{}'", sub_arg);

    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;
    let fontconfig_path = paths.temp.join("fonts.conf");

    let mut args = vec![
        "-i".to_string(), input_path.to_string_lossy().to_string(),
        "-vf".to_string(), vf_arg,
        "-c:v".to_string(), encoder.codec.clone(),
    ];

    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    args.extend_from_slice(&[
        "-c:a".to_string(), "copy".to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .env("FONTCONFIG_FILE", fontconfig_path.to_string_lossy().to_string())
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to burn subtitles: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg subtitle burning failed: {}", stderr));
    }

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

    let shell = app.shell();
    
    // Get video info for calculating sticker positions
    let video_info = get_video_info(app, input_path.to_str().ok_or("Invalid input path")?).await?;
    let video_width = video_info.width as f64;
    let video_height = video_info.height as f64;
    
    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;
    
    // Create temporary output path
    let temp_output = input_path.with_extension("stickers.mp4");
    
    // Separate emoji and image stickers
    let emoji_stickers: Vec<_> = stickers.iter()
        .filter(|s| s.sticker_type == "emoji")
        .collect();
    let image_stickers: Vec<_> = stickers.iter()
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
        let (pos_x_pct, pos_y_pct, scale, rotation) = if let Some(ref configs) = sticker.per_ratio_configs {
            if let Some(config) = configs.get(aspect_ratio) {
                (config.position.x, config.position.y, config.scale, config.rotation)
            } else {
                (sticker.position_x, sticker.position_y, sticker.scale, sticker.rotation)
            }
        } else {
            (sticker.position_x, sticker.position_y, sticker.scale, sticker.rotation)
        };
        
        // Calculate pixel position (center-anchored)
        let pos_x = (pos_x_pct / 100.0 * video_width) as i32;
        let pos_y = (pos_y_pct / 100.0 * video_height) as i32;
        
        // Base font size for emojis at 1080p (48px scaled)
        let base_font_size = 48.0 * (video_height / 1080.0) * scale;
        let font_size = base_font_size.round() as u32;
        
        // Escape the emoji text for FFmpeg
        let emoji_escaped = sticker.sticker_path
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
        let (pos_x_pct, pos_y_pct, scale, rotation) = if let Some(ref configs) = sticker.per_ratio_configs {
            if let Some(config) = configs.get(aspect_ratio) {
                (config.position.x, config.position.y, config.scale, config.rotation)
            } else {
                (sticker.position_x, sticker.position_y, sticker.scale, sticker.rotation)
            }
        } else {
            (sticker.position_x, sticker.position_y, sticker.scale, sticker.rotation)
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
    let mut args = vec![
        "-i".to_string(), input_path.to_string_lossy().to_string(),
    ];
    
    // Add image sticker inputs
    for sticker_path in &overlay_inputs {
        args.push("-i".to_string());
        args.push(sticker_path.clone());
    }
    
    // Build filter complex string
    let filter_complex = filter_parts.join(";");
    
    args.extend(vec![
        "-filter_complex".to_string(), filter_complex,
        "-map".to_string(), format!("[{}]", current_label),
        "-map".to_string(), "0:a?".to_string(), // Map audio if present
        "-c:v".to_string(), encoder.codec.clone(),
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
    args.push("aac".to_string());
    args.push("-y".to_string());
    args.push(temp_output.to_string_lossy().to_string());
    
    println!("[Rust] Applying {} stickers to video", stickers.len());
    
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to apply stickers: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("[Rust] FFmpeg sticker overlay stderr: {}", stderr);
        return Err(format!("FFmpeg sticker overlay failed: {}", stderr));
    }
    
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

    let shell = app.shell();
    
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
        let (pos_x_pct, pos_y_pct, scale, opacity) = if let Some(ref configs) = watermark.per_ratio_configs {
            if let Some(config) = configs.get(aspect_ratio) {
                (config.position.x, config.position.y, config.scale, config.opacity)
            } else {
                (watermark.position_x, watermark.position_y, watermark.scale, watermark.opacity)
            }
        } else {
            (watermark.position_x, watermark.position_y, watermark.scale, watermark.opacity)
        };
        
        // Calculate pixel position (center-anchored)
        let pos_x = (pos_x_pct / 100.0 * video_width) as i32;
        let pos_y = (pos_y_pct / 100.0 * video_height) as i32;
        
        // Calculate scaled width (scale is percentage of video width)
        let scaled_width = (video_width * scale / 100.0).round() as i32;
        
        // Calculate alpha (opacity is 0-100)
        let alpha = opacity / 100.0;
        
        let watermark_label = format!("wm{}", idx);
        let next_label = format!("wo{}", idx);
        
        // Build watermark preprocessing filter with scale and alpha
        // format=rgba ensures we have alpha channel, colorchannelmixer modifies the alpha
        let watermark_filter = format!(
            "[{}:v]scale={}:-1,format=rgba,colorchannelmixer=aa={}[{}]",
            input_count, scaled_width, alpha, watermark_label
        );
        
        filter_parts.push(watermark_filter);
        
        // Overlay with timing and center-anchor positioning
        let overlay = format!(
            "[{}][{}]overlay=x={}-(overlay_w/2):y={}-(overlay_h/2):enable='between(t,{:.3},{:.3})'[{}]",
            current_label,
            watermark_label,
            pos_x,
            pos_y,
            watermark.start_time,
            watermark.end_time,
            next_label
        );
        
        filter_parts.push(overlay);
        current_label = next_label;
        
        overlay_inputs.push(watermark.watermark_path.clone());
        input_count += 1;
    }
    
    // If we have no filters, return early
    if filter_parts.len() <= 1 {
        return Ok(());
    }
    
    // Build FFmpeg args
    let mut args = vec![
        "-i".to_string(), input_path.to_string_lossy().to_string(),
    ];
    
    // Add watermark image inputs
    for watermark_path in &overlay_inputs {
        args.push("-i".to_string());
        args.push(watermark_path.clone());
    }
    
    // Build filter complex string
    let filter_complex = filter_parts.join(";");
    
    args.extend(vec![
        "-filter_complex".to_string(), filter_complex,
        "-map".to_string(), format!("[{}]", current_label),
        "-map".to_string(), "0:a?".to_string(), // Map audio if present
        "-c:v".to_string(), encoder.codec.clone(),
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
    args.push("aac".to_string());
    args.push("-y".to_string());
    args.push(temp_output.to_string_lossy().to_string());
    
    println!("[Rust] Applying {} clip watermarks to video", watermarks.len());
    
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to apply clip watermarks: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("[Rust] FFmpeg clip watermark overlay stderr: {}", stderr);
        return Err(format!("FFmpeg clip watermark overlay failed: {}", stderr));
    }
    
    // Replace original with watermark-overlayed version
    std::fs::remove_file(input_path)
        .map_err(|e| format!("Failed to remove original file: {}", e))?;
    std::fs::rename(&temp_output, input_path)
        .map_err(|e| format!("Failed to rename watermark output: {}", e))?;
    
    println!("[Rust] Clip watermarks applied successfully");
    Ok(())
}

