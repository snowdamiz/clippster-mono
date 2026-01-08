use tauri::Emitter;
use tauri_plugin_shell::ShellExt;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use super::encoder::detect_hardware_encoder;
use super::types::WatermarkSettings;
use crate::storage;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipExtractionProgress {
    pub progress: f64,
    pub message: String,
}

/// Segment info passed from frontend
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SegmentInfo {
    #[serde(rename = "segmentNumber")]
    pub _segment_number: i32,
    pub file_path: String,
    pub start_time: f64,
    #[serde(rename = "duration")]
    pub _duration: f64,
    pub end_time: f64,
}

/// Extract a clip from recorded livestream segments
/// 
/// This function:
/// 1. Finds all segment files that cover the requested time range
/// 2. Concatenates them if needed
/// 3. Extracts the precise clip duration
/// 4. Applies watermark if provided
/// 5. Returns the output file path
#[tauri::command]
pub async fn extract_livestream_clip(
    app: tauri::AppHandle,
    session_id: String,
    clip_end_time: f64,      // Current playback position (seconds from stream start)
    clip_duration: f64,      // How many seconds to capture (10-90)
    clip_name: String,
    segments: Vec<SegmentInfo>,
    project_id: Option<String>,
    watermark_id: Option<String>,
    watermark_settings: Option<String>,  // JSON string of watermark settings
) -> Result<String, String> {
    println!("[Rust] extract_livestream_clip called:");
    println!("[Rust]   session_id: {}", session_id);
    println!("[Rust]   clip_end_time: {}s", clip_end_time);
    println!("[Rust]   clip_duration: {}s", clip_duration);
    println!("[Rust]   clip_name: {}", clip_name);
    println!("[Rust]   segments count: {}", segments.len());
    println!("[Rust]   watermark_id: {:?}", watermark_id);

    // Calculate clip start time
    let clip_start_time = clip_end_time - clip_duration;
    if clip_start_time < 0.0 {
        return Err(format!(
            "Not enough recorded content. Requested {}s but only {}s available before this point.",
            clip_duration, clip_end_time
        ));
    }

    // Emit progress
    let _ = app.emit("clip-extraction-progress", ClipExtractionProgress {
        progress: 5.0,
        message: "Finding relevant segments...".to_string(),
    });

    // Find segments that cover the requested time range
    let relevant_segments: Vec<&SegmentInfo> = segments.iter()
        .filter(|seg| {
            // A segment is relevant if it overlaps with our clip range
            seg.end_time > clip_start_time && seg.start_time < clip_end_time
        })
        .collect();

    if relevant_segments.is_empty() {
        return Err("No recorded segments found for the requested time range".to_string());
    }

    println!("[Rust] Found {} relevant segments", relevant_segments.len());

    // Verify all segment files exist
    for seg in &relevant_segments {
        if !std::path::Path::new(&seg.file_path).exists() {
            return Err(format!("Segment file not found: {}", seg.file_path));
        }
    }

    let _ = app.emit("clip-extraction-progress", ClipExtractionProgress {
        progress: 10.0,
        message: "Preparing clip extraction...".to_string(),
    });

    // Get storage paths for temp and output
    let storage_paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let temp_dir = storage_paths.temp.join("livestream_clips");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // Determine output directory
    let output_dir = if let Some(ref pid) = project_id {
        storage_paths.clips.join(pid)
    } else {
        storage_paths.clips.join("livestream").join(&session_id)
    };
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create output directory: {}", e))?;

    // Generate output filename
    let safe_name = sanitize_filename(&clip_name);
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let output_filename = format!("{}_{}.mp4", safe_name, timestamp);
    let output_path = output_dir.join(&output_filename);

    let _ = app.emit("clip-extraction-progress", ClipExtractionProgress {
        progress: 15.0,
        message: "Extracting clip from segments...".to_string(),
    });

    // If single segment, extract directly
    // If multiple segments, we need to concatenate first then extract
    let extracted_path = if relevant_segments.len() == 1 {
        extract_single_segment_clip(
            &app,
            relevant_segments[0],
            clip_start_time,
            clip_duration,
            &temp_dir,
        ).await?
    } else {
        extract_multi_segment_clip(
            &app,
            &relevant_segments,
            clip_start_time,
            clip_end_time,
            clip_duration,
            &temp_dir,
        ).await?
    };

    let _ = app.emit("clip-extraction-progress", ClipExtractionProgress {
        progress: 60.0,
        message: "Processing video...".to_string(),
    });

    // Parse watermark settings if provided
    let wm_settings: Option<WatermarkSettings> = if let Some(wm_json) = watermark_settings {
        match serde_json::from_str(&wm_json) {
            Ok(settings) => Some(settings),
            Err(e) => {
                println!("[Rust] Failed to parse watermark settings: {}", e);
                None
            }
        }
    } else {
        None
    };

    // Apply watermark if settings are provided
    if let Some(ref wm) = wm_settings {
        if wm.enabled {
            let _ = app.emit("clip-extraction-progress", ClipExtractionProgress {
                progress: 70.0,
                message: "Applying watermark...".to_string(),
            });

            apply_watermark_to_clip(&app, &extracted_path, wm, "high").await?;
        }
    }

    let _ = app.emit("clip-extraction-progress", ClipExtractionProgress {
        progress: 90.0,
        message: "Finalizing clip...".to_string(),
    });

    // Move to final output location
    std::fs::copy(&extracted_path, &output_path)
        .map_err(|e| format!("Failed to copy clip to output: {}", e))?;
    
    // Cleanup temp file
    let _ = std::fs::remove_file(&extracted_path);

    // Validate the resulting clip has real duration (defensive against empty outputs).
    // If duration is missing/zero but the file is non-trivial in size, allow it (some muxers omit duration).
    // Otherwise, return a descriptive error that includes file size.
    let clip_path_str = output_path.to_string_lossy().to_string();
    let meta = std::fs::metadata(&output_path)
        .map_err(|e| format!("Failed to stat clip file {}: {}", clip_path_str, e))?;
    let file_size = meta.len();

    match crate::clips::video_info::get_video_info(&app, &clip_path_str).await {
        Ok(info) => {
            let duration = info.duration.unwrap_or(0.0);
            if duration <= 0.01 {
                if file_size < 1_000 {
                    return Err(format!(
                        "Clip file has zero duration after extraction (size {} bytes): {}",
                        file_size, clip_path_str
                    ));
                } else {
                    println!(
                        "[Rust] Clip duration missing/zero but file is {} bytes, accepting: {}",
                        file_size, clip_path_str
                    );
                }
            }
        }
        Err(e) => {
            if file_size < 1_000 {
                return Err(format!(
                    "Failed to inspect clip duration and file is too small ({} bytes): {} ({})",
                    file_size, clip_path_str, e
                ));
            } else {
                println!(
                    "[Rust] Failed to inspect clip duration ({}), but file is {} bytes, accepting: {}",
                    e, file_size, clip_path_str
                );
            }
        }
    }

    let _ = app.emit("clip-extraction-progress", ClipExtractionProgress {
        progress: 100.0,
        message: "Clip created successfully!".to_string(),
    });

    println!("[Rust] Clip extracted successfully: {}", output_path.display());

    Ok(output_path.to_string_lossy().to_string())
}

/// Extract clip from a single segment
async fn extract_single_segment_clip(
    app: &tauri::AppHandle,
    segment: &SegmentInfo,
    clip_start_time: f64,
    clip_duration: f64,
    temp_dir: &PathBuf,
) -> Result<PathBuf, String> {
    let shell = app.shell();
    
    // Calculate seek position within this segment
    let seek_in_segment = clip_start_time - segment.start_time;
    
    let output_path = temp_dir.join(format!("clip_{}.mp4", uuid::Uuid::new_v4()));

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, "high").await;

    let mut args = vec![
        "-ss".to_string(), seek_in_segment.to_string(),
        "-i".to_string(), segment.file_path.clone(),
        "-t".to_string(), clip_duration.to_string(),
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
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-avoid_negative_ts".to_string(), "make_zero".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    println!("[Rust] Running FFmpeg for single segment extraction...");

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg extraction failed: {}", stderr));
    }

    Ok(output_path)
}

/// Extract clip spanning multiple segments (requires concatenation)
async fn extract_multi_segment_clip(
    app: &tauri::AppHandle,
    segments: &[&SegmentInfo],
    clip_start_time: f64,
    _clip_end_time: f64,
    clip_duration: f64,
    temp_dir: &PathBuf,
) -> Result<PathBuf, String> {
    let shell = app.shell();

    // First, concatenate all relevant segments
    let concat_list_path = temp_dir.join(format!("concat_{}.txt", uuid::Uuid::new_v4()));
    let concat_output_path = temp_dir.join(format!("concat_{}.mp4", uuid::Uuid::new_v4()));

    // Create concat list file
    let mut concat_content = String::new();
    for seg in segments {
        // FFmpeg concat demuxer requires forward slashes and escaped single quotes
        let escaped_path = seg.file_path.replace('\\', "/").replace("'", "'\\''");
        concat_content.push_str(&format!("file '{}'\n", escaped_path));
    }

    std::fs::write(&concat_list_path, &concat_content)
        .map_err(|e| format!("Failed to write concat list: {}", e))?;

    println!("[Rust] Created concat list with {} segments", segments.len());

    // Concatenate segments
    let concat_args = vec![
        "-f".to_string(), "concat".to_string(),
        "-safe".to_string(), "0".to_string(),
        "-i".to_string(), concat_list_path.to_string_lossy().to_string(),
        "-c".to_string(), "copy".to_string(),
        "-y".to_string(),
        concat_output_path.to_string_lossy().to_string(),
    ];

    let concat_output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(concat_args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg concat: {}", e))?;

    if !concat_output.status.success() {
        let stderr = String::from_utf8_lossy(&concat_output.stderr);
        // Cleanup
        let _ = std::fs::remove_file(&concat_list_path);
        return Err(format!("FFmpeg concat failed: {}", stderr));
    }

    // Cleanup concat list
    let _ = std::fs::remove_file(&concat_list_path);

    // Now extract the precise clip from the concatenated file
    // The concatenated file starts at the first segment's start time
    let first_segment_start = segments.first().map(|s| s.start_time).unwrap_or(0.0);
    let seek_position = clip_start_time - first_segment_start;

    let output_path = temp_dir.join(format!("clip_{}.mp4", uuid::Uuid::new_v4()));

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, "high").await;

    let mut args = vec![
        "-ss".to_string(), seek_position.to_string(),
        "-i".to_string(), concat_output_path.to_string_lossy().to_string(),
        "-t".to_string(), clip_duration.to_string(),
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
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-avoid_negative_ts".to_string(), "make_zero".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    println!("[Rust] Running FFmpeg for multi-segment extraction (seek: {}s, duration: {}s)...", seek_position, clip_duration);

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    // Cleanup concatenated file
    let _ = std::fs::remove_file(&concat_output_path);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg extraction failed: {}", stderr));
    }

    Ok(output_path)
}

/// Apply watermark to clip using FFmpeg
async fn apply_watermark_to_clip(
    app: &tauri::AppHandle,
    clip_path: &PathBuf,
    watermark: &WatermarkSettings,
    quality: &str,
) -> Result<(), String> {
    if !watermark.enabled || watermark.file_path.is_empty() {
        return Ok(());
    }

    let shell = app.shell();

    // Get video info to calculate watermark position
    let video_info = crate::clips::video_info::get_video_info(
        app,
        clip_path.to_str().ok_or("Invalid clip path")?
    ).await?;

    let video_width = video_info.width;
    let video_height = video_info.height;

    // Get watermark settings
    let pos_x = watermark.position_x;
    let pos_y = watermark.position_y;
    let opacity_pct = watermark.opacity;
    let scale_pct = watermark.scale;

    let opacity = (opacity_pct as f32 / 100.0).min(1.0);

    // Check if this is a full-frame watermark
    let wm_width = watermark.width.unwrap_or(0);
    let wm_height = watermark.height.unwrap_or(0);
    let is_full_frame = wm_width >= 1600 && wm_height >= 900;

    let filter_complex = if is_full_frame {
        format!(
            "[1:v]scale={}:{},format=rgba,colorchannelmixer=aa={}[wm];[0:v][wm]overlay=0:0",
            video_width, video_height, opacity
        )
    } else {
        // Calculate watermark width based on scale percentage
        let scaled_wm_width = (video_width as f32 * (scale_pct as f32 / 100.0)) as u32;
        
        // Calculate position
        let x_pos = format!("(W-w)*{}/100", pos_x);
        let y_pos = format!("(H-h)*{}/100", pos_y);

        format!(
            "[1:v]scale={}:-1,format=rgba,colorchannelmixer=aa={}[wm];[0:v][wm]overlay={}:{}",
            scaled_wm_width, opacity, x_pos, y_pos
        )
    };

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Create temp output path
    let temp_output = clip_path.with_extension("watermarked.mp4");

    let mut args = vec![
        "-i".to_string(), clip_path.to_string_lossy().to_string(),
        "-i".to_string(), watermark.file_path.clone(),
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

    println!("[Rust] Applying watermark to clip...");

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

    // Replace original with watermarked version
    std::fs::remove_file(clip_path)
        .map_err(|e| format!("Failed to remove original clip: {}", e))?;
    std::fs::rename(&temp_output, clip_path)
        .map_err(|e| format!("Failed to rename watermarked clip: {}", e))?;

    println!("[Rust] Watermark applied successfully");

    Ok(())
}

/// Sanitize filename to remove invalid characters
fn sanitize_filename(name: &str) -> String {
    let invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    let mut result = name.to_string();
    for c in invalid_chars {
        result = result.replace(c, "_");
    }
    // Trim whitespace and limit length
    result.trim().chars().take(100).collect()
}

