use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::Emitter;
use crate::storage;
use crate::ffmpeg_utils::{get_video_duration_sync, parse_video_info_from_ffmpeg_output};
use std::io::Write;
use tauri_plugin_shell::ShellExt;

// Subtitle settings structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleSettings {
    pub enabled: bool,
    pub font_family: String,
    pub font_size: f32,
    pub font_weight: u32,
    pub text_color: String,
    pub background_color: String,
    pub background_enabled: bool,
    pub outline_width: f32,
    pub outline_color: String,
    pub shadow_offset_x: f32,
    pub shadow_offset_y: f32,
    pub shadow_blur: f32,
    pub shadow_color: String,
    pub position: String,
    pub position_percentage: f32,
    pub max_width: f32,
    pub animation_style: String,
    pub line_height: f32,
    pub letter_spacing: f32,
    pub text_align: String,
    pub text_offset_x: f32,
    pub text_offset_y: f32,
    pub padding: f32,
    pub border_radius: f32,
    pub word_spacing: f32,
}

// Word info structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordInfo {
    pub word: String,
    pub start: f64,
    pub end: f64,
    pub confidence: Option<f64>,
}

// Whisper segment structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperSegment {
    pub id: i64,
    pub start: f64,
    pub end: f64,
    pub text: String,
    pub words: Option<Vec<WordInfo>>,
}

// Clip building progress tracking structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipBuildProgress {
    pub clip_id: String,
    pub project_id: String,
    pub progress: f64,
    pub stage: String,
    pub message: String,
    pub error: Option<String>,
}

// Clip build result structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipBuildResult {
    pub clip_id: String,
    pub project_id: String,
    pub success: bool,
    pub output_path: Option<String>,
    pub thumbnail_path: Option<String>,
    pub duration: Option<f64>,
    pub file_size: Option<u64>,
    pub error: Option<String>,
}

// Active clip builds tracking
static ACTIVE_CLIP_BUILDS: Lazy<Arc<Mutex<HashMap<String, bool>>>> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Aspect ratio structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AspectRatio {
    pub width: f32,
    pub height: f32,
}

// Build settings structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildSettings {
    pub aspect_ratios: Vec<String>,
    pub quality: String,
    pub frame_rate: u32,
    pub output_format: String,
}

// Build clip from segments using FFmpeg
#[tauri::command]
pub async fn build_clip_from_segments(
    app: tauri::AppHandle,
    project_id: String,
    clip_id: String,
    clip_name: String,
    video_path: String,
    segments: Vec<serde_json::Value>,
    subtitle_settings: Option<SubtitleSettings>,
    transcript_words: Option<Vec<WordInfo>>,
    transcript_segments: Option<Vec<WhisperSegment>>,
    max_words: Option<usize>,
    aspect_ratios: Vec<String>,
    quality: String,
    frame_rate: u32,
    output_format: String,
    run_number: Option<u32>
) -> Result<(), String> {

    println!("[Rust] build_clip_from_segments called with:");
    println!("[Rust]   project_id: {}", project_id);
    println!("[Rust]   clip_id: {}", clip_id);
    println!("[Rust]   clip_name: {}", clip_name);
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   segments count: {}", segments.len());
    println!("[Rust]   subtitles enabled: {}", subtitle_settings.as_ref().map(|s| s.enabled).unwrap_or(false));
    println!("[Rust]   max words: {}", max_words.unwrap_or(0));
    println!("[Rust]   aspect_ratios: {:?}", aspect_ratios);
    println!("[Rust]   quality: {}", quality);
    println!("[Rust]   frame_rate: {}", frame_rate);
    println!("[Rust]   output_format: {}", output_format);
    println!("[Rust]   run_number: {:?}", run_number);

    // Check if clip is already being built
    {
        let mut active_builds = ACTIVE_CLIP_BUILDS.lock().unwrap();
        if active_builds.contains_key(&clip_id) {
            return Err(format!("Clip {} is already being built", clip_id));
        }
        active_builds.insert(clip_id.clone(), true);
    }

    // Clone app handle for use in async block
    let app_clone = app.clone();
    let clip_id_clone = clip_id.clone();
    let clip_name_clone = clip_name.clone();
    let project_id_clone = project_id.clone();
    let video_path_clone = video_path.clone();
    let segments_clone = segments.clone();
    let subtitle_settings_clone = subtitle_settings.clone();
    let transcript_words_clone = transcript_words.clone();
    let transcript_segments_clone = transcript_segments.clone();
    let aspect_ratios_clone = aspect_ratios.clone();
    let quality_clone = quality.clone();
    let output_format_clone = output_format.clone();

    // Send initial progress
    let _ = app.emit("clip-build-progress", ClipBuildProgress {
        clip_id: clip_id.clone(),
        project_id: project_id.clone(),
        progress: 0.0,
        stage: "initializing".to_string(),
        message: "Starting clip build...".to_string(),
        error: None,
    });

    // Use tokio::spawn for background processing (following the download pattern)
    let _ = tokio::spawn(async move {
        println!("[Rust] Async task started for clip build: {}", clip_id_clone);

        let build_result = match build_clip_internal_simple(
            &app_clone,
            &project_id_clone,
            &clip_id_clone,
            &clip_name_clone,
            &video_path_clone,
            &segments_clone,
            subtitle_settings_clone,
            transcript_words_clone,
            transcript_segments_clone,
            max_words,
            &aspect_ratios_clone,
            &quality_clone,
            frame_rate,
            &output_format_clone,
            run_number
        ).await {
            Ok(result) => {
                println!("[Rust] Clip build completed successfully for: {}", clip_id_clone);
                result
            },
            Err(e) => {
                println!("[Rust] Clip build failed with error: {}", e);
                ClipBuildResult {
                    clip_id: clip_id_clone.clone(),
                    project_id: project_id_clone.clone(),
                    success: false,
                    output_path: None,
                    thumbnail_path: None,
                    duration: None,
                    file_size: None,
                    error: Some(e),
                }
            }
        };

        // Clean up active build tracking
        {
            let mut active_builds = ACTIVE_CLIP_BUILDS.lock().unwrap();
            active_builds.remove(&clip_id_clone);
            println!("[Rust] Removed from active builds: {}", clip_id_clone);
        }

        // Emit completion event
        println!("[Rust] About to emit clip-build-complete event...");
        let emit_result = app_clone.emit("clip-build-complete", &build_result);
        match emit_result {
            Ok(_) => println!("[Rust] clip-build-complete event emitted successfully"),
            Err(e) => println!("[Rust] Failed to emit clip-build-complete event: {}", e),
        }
    });

    Ok(())
}

// Helper function to sanitize a clip name for use as a folder name
fn sanitize_clip_name(name: &str) -> String {
    // Replace invalid filesystem characters with underscores
    let invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    let mut sanitized = name.to_string();
    
    for ch in invalid_chars {
        sanitized = sanitized.replace(ch, "_");
    }
    
    // Trim whitespace and dots from start/end (invalid on Windows)
    sanitized = sanitized.trim().trim_matches('.').to_string();
    
    // Limit length to avoid filesystem issues (keeping it reasonable)
    if sanitized.len() > 100 {
        sanitized.truncate(100);
    }
    
    // If empty after sanitization, use a default name
    if sanitized.is_empty() {
        sanitized = "clip".to_string();
    }
    
    sanitized
}

// Helper function to get or create the run folder for a project using database-tracked run numbers
// If run_number is None (manually generated clips), uses a special "manual" folder
fn get_or_create_run_folder(
    project_clips_dir: &std::path::Path,
    run_number: Option<u32>
) -> Result<std::path::PathBuf, String> {
    let run_folder = if let Some(run_num) = run_number {
        // Use the run number from the detection session
        project_clips_dir.join(format!("run-{}", run_num))
    } else {
        // For manually generated clips without a detection session, use a manual builds folder
        project_clips_dir.join("manual-builds")
    };
    
    std::fs::create_dir_all(&run_folder)
        .map_err(|e| format!("Failed to create run folder: {}", e))?;
    
    println!("[Rust] Using run folder: {}", run_folder.display());
    Ok(run_folder)
}

// Helper function to get or create the clip-specific folder within a run
fn get_or_create_clip_folder(
    run_folder: &std::path::Path,
    clip_name: &str
) -> Result<std::path::PathBuf, String> {
    let sanitized_name = sanitize_clip_name(clip_name);
    let clip_folder = run_folder.join(&sanitized_name);
    
    std::fs::create_dir_all(&clip_folder)
        .map_err(|e| format!("Failed to create clip folder: {}", e))?;
    
    println!("[Rust] Using clip folder: {}", clip_folder.display());
    Ok(clip_folder)
}

// Simplified internal clip building implementation (without progress callbacks)
async fn build_clip_internal_simple(
    app: &tauri::AppHandle,
    project_id: &str,
    clip_id: &str,
    clip_name: &str,
    video_path: &str,
    segments: &[serde_json::Value],
    subtitle_settings: Option<SubtitleSettings>,
    transcript_words: Option<Vec<WordInfo>>,
    _transcript_segments: Option<Vec<WhisperSegment>>,
    max_words: Option<usize>,
    aspect_ratios: &[String],
    quality: &str,
    frame_rate: u32,
    output_format: &str,
    run_number: Option<u32>
) -> Result<ClipBuildResult, String> {

    // Emit progress
    let _ = app.emit("clip-build-progress", ClipBuildProgress {
        clip_id: clip_id.to_string(),
        project_id: project_id.to_string(),
        progress: 0.0,
        stage: "initializing".to_string(),
        message: "Preparing to build clip...".to_string(),
        error: None,
    });

    // Get storage paths
    let paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    // Create project-specific clips directory in the clips folder
    let project_clips_dir = paths.clips.join(format!("project_{}", project_id));
    std::fs::create_dir_all(&project_clips_dir)
        .map_err(|e| format!("Failed to create project clips directory: {}", e))?;

    // Get or create the run folder for this build using the database-tracked run number
    let run_folder = get_or_create_run_folder(&project_clips_dir, run_number)?;

    // Get or create the clip-specific folder within the run
    let clip_base_dir = get_or_create_clip_folder(&run_folder, clip_name)?;

    // Get video dimensions for proper subtitle rendering
    let video_info = get_video_info(app, video_path).await?;
    println!("[Rust] Video dimensions: {}x{}", video_info.width, video_info.height);

    // Track all output paths for the result
    let mut all_output_paths = Vec::new();
    let mut first_output_path: Option<String> = None;
    let mut first_thumbnail_path: Option<std::path::PathBuf> = None;
    let mut total_file_size: u64 = 0;
    let mut clip_duration: Option<f64> = None;

    // Build clip for each aspect ratio
    let total_ratios = aspect_ratios.len();
    for (ratio_idx, aspect_ratio_str) in aspect_ratios.iter().enumerate() {
        println!("[Rust] Building clip for aspect ratio: {}", aspect_ratio_str);
        
        let progress_start = 10.0 + (ratio_idx as f64 / total_ratios as f64) * 75.0;
        let _ = app.emit("clip-build-progress", ClipBuildProgress {
            clip_id: clip_id.to_string(),
            project_id: project_id.to_string(),
            progress: progress_start,
            stage: "building".to_string(),
            message: format!("Building {} ({}/{})", aspect_ratio_str, ratio_idx + 1, total_ratios),
            error: None,
        });

        // Parse aspect ratio string (e.g., "16:9")
        let aspect_ratio = parse_aspect_ratio(aspect_ratio_str)?;
        
        // Create filename with aspect ratio (replace : with -) and selected format (mp4/mov)
        let ratio_suffix = aspect_ratio_str.replace(":", "-");
        let output_filename = format!("clip_{}.{}", ratio_suffix, output_format);  // Format is applied here!
        let output_path = clip_base_dir.join(&output_filename);

        // Generate subtitle file if needed for this aspect ratio
        let subtitle_file = if let (Some(settings), Some(words)) = (&subtitle_settings, &transcript_words) {
            if settings.enabled {
                let sub_path = clip_base_dir.join(format!("subtitles_{}.ass", ratio_suffix));
                generate_ass_file(
                    settings, 
                    words, 
                    segments, 
                    &sub_path, 
                    max_words.unwrap_or(4), 
                    Some(&aspect_ratio),
                    video_info.width,
                    video_info.height
                ).map_err(|e| format!("Failed to generate subtitle file: {}", e))?;
                Some(sub_path)
            } else {
                None
            }
        } else {
            None
        };

        // Build clip based on segments with aspect ratio cropping
        if segments.len() == 1 {
            println!("[Rust] Building single-segment clip for {}", aspect_ratio_str);
            build_single_segment_clip_with_settings(
                app,
                video_path,
                &output_path,
                &segments[0],
                subtitle_file.as_deref(),
                &aspect_ratio,
                quality,
                frame_rate,
                output_format
            ).await?;
        } else {
            println!("[Rust] Building multi-segment clip for {} with {} segments", aspect_ratio_str, segments.len());
            build_multi_segment_clip_with_settings(
                app,
                video_path,
                &output_path,
                segments,
                subtitle_file.as_deref(),
                &aspect_ratio,
                quality,
                frame_rate,
                output_format
            ).await?;
        }

        // Clean up subtitle file
        if let Some(sub_path) = subtitle_file {
            let _ = std::fs::remove_file(sub_path);
        }

        // Generate thumbnail for the first aspect ratio
        if ratio_idx == 0 {
            println!("[Rust] Generating thumbnail for first aspect ratio...");
            first_thumbnail_path = generate_clip_thumbnail_simple(app, &output_path, clip_id).await?;
        }

        // Get file metadata
        let metadata = std::fs::metadata(&output_path)
            .map_err(|e| format!("Failed to get output file metadata: {}", e))?;
        total_file_size += metadata.len();

        // Get clip duration (from first clip)
        if ratio_idx == 0 {
            clip_duration = get_video_duration_sync(app, output_path.to_str().ok_or("Invalid output path")?).await.ok();
        }

        // Track output paths
        let output_path_str = output_path.to_string_lossy().to_string();
        all_output_paths.push(output_path_str.clone());
        if first_output_path.is_none() {
            first_output_path = Some(output_path_str);
        }
    }

    // Emit completion progress
    println!("[Rust] Emitting completion progress event...");
    let result = ClipBuildResult {
        clip_id: clip_id.to_string(),
        project_id: project_id.to_string(),
        success: true,
        output_path: first_output_path,
        thumbnail_path: first_thumbnail_path.map(|p| p.to_string_lossy().to_string()),
        duration: clip_duration,
        file_size: Some(total_file_size),
        error: None,
    };

    let _ = app.emit("clip-build-progress", ClipBuildProgress {
        clip_id: clip_id.to_string(),
        project_id: project_id.to_string(),
        progress: 100.0,
        stage: "completed".to_string(),
        message: format!("Built {} clip(s) successfully!", total_ratios),
        error: None,
    });

    println!("[Rust] Built {} clips at: {:?}", total_ratios, all_output_paths);
    Ok(result)
}

// Helper function to parse aspect ratio string (e.g., "16:9") into AspectRatio struct
fn parse_aspect_ratio(ratio_str: &str) -> Result<AspectRatio, String> {
    let parts: Vec<&str> = ratio_str.split(':').collect();
    if parts.len() != 2 {
        return Err(format!("Invalid aspect ratio format: {}", ratio_str));
    }
    
    let width: f32 = parts[0].parse().map_err(|_| format!("Invalid width in aspect ratio: {}", parts[0]))?;
    let height: f32 = parts[1].parse().map_err(|_| format!("Invalid height in aspect ratio: {}", parts[1]))?;
    
    Ok(AspectRatio { width, height })
}

// Helper function to calculate cropping parameters for aspect ratio
fn calculate_crop_params(source_width: u32, source_height: u32, target_aspect: &AspectRatio) -> (u32, u32, u32, u32) {
    let source_aspect = source_width as f32 / source_height as f32;
    let target_aspect_value = target_aspect.width / target_aspect.height;
    
    let (crop_width, crop_height, crop_x, crop_y) = if source_aspect > target_aspect_value {
        // Source is wider - crop width
        let crop_width = (source_height as f32 * target_aspect_value) as u32;
        let crop_x = (source_width - crop_width) / 2;
        (crop_width, source_height, crop_x, 0)
    } else {
        // Source is taller - crop height
        let crop_height = (source_width as f32 / target_aspect_value) as u32;
        let crop_y = (source_height - crop_height) / 2;
        (source_width, crop_height, 0, crop_y)
    };
    
    (crop_width, crop_height, crop_x, crop_y)
}

// Helper function to get FFmpeg quality settings
fn get_quality_settings(quality: &str) -> (&str, &str) {
    match quality {
        "low" => ("faster", "28"),
        "medium" => ("medium", "23"),
        "high" => ("slow", "18"),
        _ => ("medium", "23"),
    }
}

// Cancel clip build
#[tauri::command]
pub async fn cancel_clip_build(clip_id: String) -> Result<bool, String> {
    println!("[Rust] Canceling clip build: {}", clip_id);
    let mut active_builds = ACTIVE_CLIP_BUILDS.lock().unwrap();
    if active_builds.remove(&clip_id).is_some() {
        Ok(true)
    } else {
        Ok(false)
    }
}

// Check if clip build is active
#[tauri::command]
pub async fn is_clip_build_active(clip_id: String) -> Result<bool, String> {
    let active_builds = ACTIVE_CLIP_BUILDS.lock().unwrap();
    Ok(active_builds.contains_key(&clip_id))
}

// Build single-segment clip with aspect ratio and quality settings
// Note: output_format is unused here because the path already has the correct extension
async fn build_single_segment_clip_with_settings(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    subtitle_path: Option<&std::path::Path>,
    aspect_ratio: &AspectRatio,
    quality: &str,
    frame_rate: u32,
    _output_format: &str  // Format already applied in output_path extension
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    let shell = app.shell();
    let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
    let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
    let duration = end_time - start_time;

    println!("[Rust] Building single segment with aspect ratio {}:{}", aspect_ratio.width, aspect_ratio.height);

    // Get video info for cropping
    let video_info = get_video_info(app, video_path).await?;
    let (crop_w, crop_h, crop_x, crop_y) = calculate_crop_params(video_info.width, video_info.height, aspect_ratio);
    
    // Get quality settings
    let (preset, crf) = get_quality_settings(quality);

    // Build video filter
    let mut vf_parts = vec![format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y)];
    
    if let Some(path) = subtitle_path {
        let path_str = path.to_string_lossy().replace("\\", "/").replace(":", "\\:");
        vf_parts.push(format!("ass='{}'", path_str));
    }
    
    let vf_arg = vf_parts.join(",");

    let args = vec![
        "-ss".to_string(), format!("{:.3}", start_time),
        "-i".to_string(), video_path.to_string(),
        "-t".to_string(), format!("{:.3}", duration),
        "-vf".to_string(), vf_arg,
        "-c:v".to_string(), "libx264".to_string(),
        "-preset".to_string(), preset.to_string(),
        "-crf".to_string(), crf.to_string(),
        "-r".to_string(), frame_rate.to_string(),
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-avoid_negative_ts".to_string(), "1".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ];

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg failed: {}", stderr));
    }

    Ok(())
}

// Build multi-segment clip with aspect ratio and quality settings
// Note: output_format is unused here because the path already has the correct extension
async fn build_multi_segment_clip_with_settings(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segments: &[serde_json::Value],
    subtitle_path: Option<&std::path::Path>,
    aspect_ratio: &AspectRatio,
    quality: &str,
    frame_rate: u32,
    _output_format: &str  // Format already applied in output_path extension
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    let shell = app.shell();

    // Get storage paths for temporary files
    let paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let temp_dir = paths.temp.join(format!("clip_segments_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    println!("[Rust] Building {} segments with aspect ratio {}:{}", segments.len(), aspect_ratio.width, aspect_ratio.height);

    // Get video info for cropping
    let video_info = get_video_info(app, video_path).await?;
    let (crop_w, crop_h, crop_x, crop_y) = calculate_crop_params(video_info.width, video_info.height, aspect_ratio);
    let crop_filter = format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y);

    // Get quality settings
    let (preset, crf) = get_quality_settings(quality);

    // Extract segments with cropping
    let mut segment_files = Vec::new();
    for (i, segment) in segments.iter().enumerate() {
        let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
        let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
        let duration = end_time - start_time;

        let segment_file = temp_dir.join(format!("segment_{:03}.mp4", i));

        let output = shell.sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args([
                "-ss", &format!("{:.3}", start_time),
                "-i", video_path,
                "-t", &format!("{:.3}", duration),
                "-vf", &crop_filter,
                "-c:v", "libx264",
                "-preset", preset,
                "-crf", crf,
                "-r", &frame_rate.to_string(),
                "-c:a", "aac",
                "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-avoid_negative_ts", "1",
                "-y",
                segment_file.to_str().ok_or("Invalid segment path")?,
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to extract segment {}: {}", i, e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to extract segment {}: {}", i, stderr));
        }

        segment_files.push(segment_file.clone());
    }

    // Create concat list file
    let concat_file = temp_dir.join("concat_list.txt");
    let mut concat_content = String::new();
    for segment_file in &segment_files {
        concat_content.push_str(&format!("file '{}'\n", segment_file.display()));
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

    // If subtitles are present, burn them now
    if let Some(sub_path) = subtitle_path {
        println!("[Rust] Burning subtitles...");
        
        let sub_arg = sub_path.to_string_lossy().replace("\\", "/").replace(":", "\\:");
        let vf_arg = format!("ass='{}'", sub_arg);

        let output = shell.sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args([
                "-i", concat_output_path.to_str().ok_or("Invalid concat output path")?,
                "-vf", &vf_arg,
                "-c:v", "libx264",
                "-preset", preset,
                "-crf", crf,
                "-c:a", "aac",
                "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                "-y",
                output_path.to_str().ok_or("Invalid output path")?,
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to burn subtitles: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("FFmpeg subtitle burning failed: {}", stderr));
        }
    }

    // Clean up temporary files
    let _ = std::fs::remove_dir_all(&temp_dir);
    println!("[Rust] Multi-segment build successful, cleaned up temp files");

    Ok(())
}

async fn generate_clip_thumbnail_simple(
    app: &tauri::AppHandle,
    clip_path: &std::path::Path,
    clip_id: &str
) -> Result<Option<std::path::PathBuf>, String> {
    use tauri_plugin_shell::ShellExt;
    let shell = app.shell();

    let paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let thumbnail_filename = format!("clip_{}_thumb.jpg", clip_id);
    let thumbnail_path = paths.thumbnails.join(thumbnail_filename);

    println!("[Rust] Generating thumbnail for clip: {}", clip_path.display());

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", clip_path.to_str().ok_or("Invalid clip path")?,
            "-ss", "00:00:01",  // Seek to 1 second
            "-vframes", "1",
            "-vf", "scale=320:-1",
            "-y",
            thumbnail_path.to_str().ok_or("Invalid thumbnail path")?,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg for thumbnail: {}", e))?;

    if output.status.success() {
        Ok(Some(thumbnail_path))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("[Rust] Failed to generate thumbnail: {}", stderr);
        Ok(None)
    }
}

// Helper function to get video info with improved parsing
async fn get_video_info(app: &tauri::AppHandle, video_path: &str) -> Result<crate::ffmpeg_utils::VideoInfo, String> {
    let shell = app.shell();
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", video_path,
            "-f", "null",
            "-",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg info: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    
    // Try the standard parser first
    if let Ok(info) = parse_video_info_from_ffmpeg_output(&stderr) {
        return Ok(info);
    }
    
    // If that fails, try alternative parsing
    println!("[Rust] Standard parsing failed, trying alternative method...");
    parse_video_info_alternative(&stderr)
}

// Alternative video info parser that's more flexible
fn parse_video_info_alternative(output: &str) -> Result<crate::ffmpeg_utils::VideoInfo, String> {
    use regex::Regex;
    
    let mut width = None;
    let mut height = None;
    let mut codec = None;
    
    // Look for resolution pattern: 1920x1080 or 1280x720, etc.
    let res_regex = Regex::new(r"(\d{3,5})x(\d{3,5})").map_err(|e| format!("Regex error: {}", e))?;
    
    for line in output.lines() {
        if line.contains("Video:") {
            println!("[Rust] Video line: {}", line);
            
            // Extract codec (first word after "Video: ")
            if let Some(codec_start) = line.find("Video: ") {
                let codec_part = &line[codec_start + 7..];
                if let Some(space_pos) = codec_part.find(|c: char| c.is_whitespace() || c == ',') {
                    codec = Some(codec_part[..space_pos].trim().to_string());
                }
            }
            
            // Extract resolution using regex
            if let Some(captures) = res_regex.captures(line) {
                width = captures.get(1).and_then(|m| m.as_str().parse().ok());
                height = captures.get(2).and_then(|m| m.as_str().parse().ok());
            }
            
            if width.is_some() && height.is_some() && codec.is_some() {
                break;
            }
        }
    }
    
    match (width, height, &codec) {
        (Some(w), Some(h), Some(c)) => {
            println!("[Rust] Parsed video info: {}x{}, codec: {}", w, h, c);
            Ok(crate::ffmpeg_utils::VideoInfo { width: w, height: h, codec: c.clone() })
        },
        _ => {
            println!("[Rust] Failed to parse - width: {:?}, height: {:?}, codec: {:?}", width, height, codec);
            Err("Could not parse video dimensions or codec from FFmpeg output".to_string())
        }
    }
}

// Helper to generate ASS file content
fn generate_ass_file(
    settings: &SubtitleSettings,
    all_words: &[WordInfo],
    clip_segments: &[serde_json::Value],
    output_path: &std::path::Path,
    max_words: usize,
    aspect_ratio: Option<&AspectRatio>,
    video_width: u32,
    video_height: u32
) -> Result<(), String> {
    let mut file = std::fs::File::create(output_path)
        .map_err(|e| format!("Failed to create subtitle file: {}", e))?;

    // Generate ASS header with actual video dimensions
    writeln!(file, "[Script Info]").unwrap();
    writeln!(file, "ScriptType: v4.00+").unwrap();
    writeln!(file, "PlayResX: {}", video_width).unwrap();
    writeln!(file, "PlayResY: {}", video_height).unwrap();
    writeln!(file, "WrapStyle: 1").unwrap(); // Word wrapping
    writeln!(file, "").unwrap();

    // Generate Style
    writeln!(file, "[V4+ Styles]").unwrap();
    writeln!(file, "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding").unwrap();

    // Convert colors (Hex #RRGGBB to &HAABBGGRR with alpha)
    // ASS format: &HAABBGGRR where AA is alpha (00=opaque, FF=transparent)
    let convert_color = |hex: &str| -> String {
        let hex = hex.trim_start_matches('#');
        if hex.len() >= 6 {
            let r = &hex[0..2];
            let g = &hex[2..4];
            let b = &hex[4..6];
            // ASS uses BGR order with alpha prefix (00 = fully opaque)
            format!("&H00{}{}{}&", b, g, r)
        } else {
            "&H00FFFFFF&".to_string()
        }
    };

    let primary_color = convert_color(&settings.text_color);
    let outline_color = convert_color(&settings.outline_color);
    let back_color = convert_color(&settings.background_color);

    println!("[Rust] Subtitle colors - Text: {}, Outline: {}, Background: {}", 
        settings.text_color, settings.outline_color, settings.background_color);
    println!("[Rust] ASS colors - Primary: {}, Outline: {}", primary_color, outline_color);

    // Calculate aspect ratio scaling (matches VideoPlayer.vue logic)
    let aspect_ratio_value = if let Some(ar) = aspect_ratio {
        ar.width / ar.height
    } else {
        16.0 / 9.0 // Default to 16:9
    };

    let font_size_scale = if aspect_ratio_value <= 0.9 {
        0.65 // Vertical formats (9:16, 4:5)
    } else if aspect_ratio_value > 0.9 && aspect_ratio_value <= 1.1 {
        0.78 // Square format (1:1)
    } else {
        1.0 // Wide formats (16:9, 21:9)
    };

    let adjusted_font_size = (settings.font_size * font_size_scale).round();
    let adjusted_outline_width = settings.outline_width * font_size_scale;
    let adjusted_shadow = settings.shadow_blur * font_size_scale;
    let adjusted_letter_spacing = settings.letter_spacing * font_size_scale;

    println!("[Rust] Font size: {} -> {} (scale: {})", settings.font_size, adjusted_font_size, font_size_scale);

    // Alignment: 1=Left, 2=Center, 3=Right (Subtitles usually bottom, so 1,2,3 for bottom; 4,5,6 for middle; 7,8,9 for top)
    let alignment = match settings.position.as_str() {
        "top" => 8,
        "middle" => 5,
        "bottom" => 2,
        _ => 2,
    };

    // Calculate MarginV based on positionPercentage and actual video height
    let margin_v = if settings.position == "bottom" {
        (video_height as f32 * (1.0 - settings.position_percentage / 100.0)) as i32
    } else if settings.position == "top" {
         (video_height as f32 * (settings.position_percentage / 100.0)) as i32
    } else {
        0
    };

    // Determine bold flag (ASS uses -1 for bold, 0 for normal)
    let bold = if settings.font_weight >= 700 { -1 } else { 0 };

    // ASS Style format:
    // Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, 
    // Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, 
    // BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
    writeln!(file, "Style: Default,{},{},{},{},{},{},{},0,0,0,100,100,{},0,1,{},{},{},10,10,{},1",
        settings.font_family,
        adjusted_font_size,
        primary_color,
        primary_color, // SecondaryColour (for karaoke, use same as primary)
        outline_color,
        if settings.background_enabled { back_color } else { "&H00000000&".to_string() },
        bold,
        adjusted_letter_spacing, // Spacing parameter
        adjusted_outline_width,
        adjusted_shadow,
        alignment,
        margin_v
    ).unwrap();

    writeln!(file, "").unwrap();
    writeln!(file, "[Events]").unwrap();
    writeln!(file, "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text").unwrap();

    // 1. Flatten words relative to clip timeline
    #[derive(Clone, Debug)]
    struct ClipWord {
        word: String,
        start: f64,
        end: f64,
    }

    let mut clip_timeline_words: Vec<ClipWord> = Vec::new();
    let mut current_clip_time = 0.0;

    for clip_segment in clip_segments {
        let clip_seg_start = clip_segment["start_time"].as_f64().unwrap_or(0.0);
        let clip_seg_end = clip_segment["end_time"].as_f64().unwrap_or(0.0);
        let clip_seg_duration = clip_seg_end - clip_seg_start;

        for word in all_words {
            // Filter words within this segment
            // Add buffer to catch boundary words
            if word.start >= clip_seg_start - 0.1 && word.end <= clip_seg_end + 0.1 {
                // Calculate relative timing
                let start_rel = word.start - clip_seg_start + current_clip_time;
                let end_rel = word.end - clip_seg_start + current_clip_time;
                
                clip_timeline_words.push(ClipWord {
                    word: word.word.clone(),
                    start: start_rel,
                    end: end_rel,
                });
            }
        }
        current_clip_time += clip_seg_duration;
    }

    // Sort by start time just in case
    clip_timeline_words.sort_by(|a, b| a.start.partial_cmp(&b.start).unwrap_or(std::cmp::Ordering::Equal));

    if clip_timeline_words.is_empty() {
        return Ok(());
    }

    // 2. Group words into chunks (pages)
    let chunks: Vec<&[ClipWord]> = clip_timeline_words.chunks(max_words).collect();

    // 3. Generate events for each chunk
    for chunk in chunks {
        if chunk.is_empty() { continue; }

        // Determine chunk visibility duration
        // The chunk is visible from the start of its first word
        // until the start of the first word of the NEXT chunk (or end of clip for last chunk)
        let _chunk_start_time = chunk.first().unwrap().start;
        
        // Find the end time: it's the start of the next word AFTER this chunk, or the end of this chunk's last word if no next word
        // Actually, the frontend logic says: "If no word is currently being spoken, find the next upcoming word"
        // So basically, this chunk stays active until the next chunk becomes active.
        // We can look ahead to the next chunk in the loop? 
        // But we are iterating chunks.
        
        // Let's iterate with index to peek ahead
    }

    let chunk_count = (clip_timeline_words.len() + max_words - 1) / max_words;
    
    for i in 0..chunk_count {
        let start_idx = i * max_words;
        let end_idx = std::cmp::min(start_idx + max_words, clip_timeline_words.len());
        let chunk = &clip_timeline_words[start_idx..end_idx];
        
        if chunk.is_empty() { continue; }

        // Visibility start: Start of first word
        // Or should it be the end of the previous chunk's last word?
        // Frontend: "currentWordIndex" logic finds word at current time.
        // If time is between chunks (gap), it finds "next upcoming word".
        // So if we are in gap between Chunk 0 and Chunk 1, Chunk 1 is active?
        // "If currentWordIndex == -1 (gap), find next upcoming word." -> Chunk 1.
        // So Chunk 1 starts becoming visible immediately after Chunk 0's last word ends?
        // Wait, no. If gap is huge, we probably don't want subtitles to switch early.
        // But let's stick to "Next upcoming word" logic.
        // So yes, immediately after Chunk 0 ends, Chunk 1 becomes active (previewing the text).
        
        // However, for the FIRST chunk, it should probably start at 0.0 (or clip start) if it's the first thing.
        // Let's assume: 
        // Chunk Start Time = (Previous Chunk Last Word End) OR (0.0 if first chunk)
        // Chunk End Time = (This Chunk Last Word End)
        
        // Wait, if we use "next upcoming word" logic:
        // Gap between C0_End and C1_Start: C1 is active.
        // So C1 starts at C0_End.
        // C0 ends at C0_End (last word end).
        
        // Let's refine:
        // Chunk 0 Start: 0.0 (Clip start) - To catch intro silence? Or C0.first.start?
        // Frontend: `visibleWords` shows filtering. If time < C0.first.start, next word is C0.first -> C0 active.
        // So C0 is active from 0.0.
        
        // Chunk i Start: If i==0 -> 0.0. Else -> Chunk[i-1].last.end.
        // Chunk i End: Chunk[i].last.end. 
        // (And the gap after C[i] is covered by C[i+1] starting at C[i].end)
        
        let chunk_visible_start = if i == 0 {
            0.0
        } else {
            clip_timeline_words[start_idx - 1].end
        };
        
        let chunk_visible_end = chunk.last().unwrap().end;
        
        // Now we need to generate events for each "state" within this chunk visibility.
        // States are defined by the word boundaries within the chunk.
        // Transitions happen at: word.start, word.end.
        
        // We have a timeline of points: chunk_visible_start, w0.start, w0.end, w1.start, w1.end... chunk_visible_end.
        // Sort and deduplicate these points.
        let mut points = Vec::new();
        points.push(chunk_visible_start);
        for word in chunk {
            points.push(word.start);
            points.push(word.end);
        }
        points.push(chunk_visible_end);
        points.sort_by(|a, b| a.partial_cmp(b).unwrap());
        points.dedup();
        
        // Iterate intervals
        for j in 0..points.len()-1 {
            let t_start = points[j];
            let t_end = points[j+1];
            
            if t_end - t_start < 0.01 { continue; } // Skip tiny intervals
            
            // Determine active word in this interval
            // A word is active if t_mid is inside [word.start, word.end]
            let t_mid = (t_start + t_end) / 2.0;
            let active_word_idx = chunk.iter().position(|w| t_mid >= w.start && t_mid <= w.end);
            
            // Format time to H:MM:SS.cc
            let format_time = |t: f64| -> String {
                let t = t.max(0.0);
                let hours = (t / 3600.0).floor() as u32;
                let mins = ((t % 3600.0) / 60.0).floor() as u32;
                let secs = (t % 60.0).floor() as u32;
                let centis = ((t % 1.0) * 100.0).round() as u32;
                format!("{}:{:02}:{:02}.{:02}", hours, mins, secs, centis)
            };
            
            // Strategy: Render text in two layers
            // Layer 0: All words at normal size (provides stable layout)
            // Layer 1: Active word only, scaled up, positioned exactly over the base word
            
            // Layer 0: Base text with all words at normal size
            let base_text = chunk.iter().map(|w| w.word.as_str()).collect::<Vec<_>>().join(" ");
            writeln!(file, "Dialogue: 0,{},{},Default,,0,0,0,,{}",
                format_time(t_start),
                format_time(t_end),
                base_text
            ).unwrap();
            
            // Layer 1: If there's an active word, render it scaled on top
            if let Some(active_idx) = active_word_idx {
                let active_word = &chunk[active_idx];
                let word_duration = active_word.end - active_word.start;
                let anim_duration_ms = calculate_animation_duration(word_duration);
                
                // Calculate when this word starts within the current interval
                let word_start_in_interval = if active_word.start > t_start {
                    ((active_word.start - t_start) * 1000.0) as u32
                } else {
                    0
                };
                
                let scale_up_end = word_start_in_interval + anim_duration_ms;
                
                // Build text with spaces to position the active word correctly
                // Use invisible characters (zero-width) for other words to maintain spacing
                let mut positioned_text_parts = Vec::new();
                for (k, word) in chunk.iter().enumerate() {
                    if k == active_idx {
                        // Active word with animation
                        positioned_text_parts.push(format!(
                            "{{\\r\\t({},{},\\fscx115\\fscy115)}}{}{{\\fscx100\\fscy100}}",
                            word_start_in_interval,
                            scale_up_end,
                            word.word
                        ));
                    } else {
                        // Use {\alpha&HFF&} to make word invisible (maintains spacing)
                        positioned_text_parts.push(format!("{{\\alpha&HFF&}}{}", word.word));
                    }
                }
                
                let overlay_text = positioned_text_parts.join(" ");
                
                // Render on layer 1 (on top of base layer)
                writeln!(file, "Dialogue: 1,{},{},Default,,0,0,0,,{}",
                    format_time(t_start),
                    format_time(t_end),
                    overlay_text
                ).unwrap();
            }
        }
    }

    Ok(())
}

// Calculate animation duration for a word (matches VideoPlayer.vue logic)
fn calculate_animation_duration(word_duration: f64) -> u32 {
    // Returns duration in milliseconds
    
    // For very short words (under 50ms), use instant transition
    if word_duration < 0.05 {
        return 0;
    }
    
    // For short words (50-100ms), use 30% of duration for responsive animation
    if word_duration < 0.1 {
        return ((word_duration * 0.3) * 1000.0) as u32;
    }
    
    // For medium words (100-200ms), use 35% of duration
    if word_duration < 0.2 {
        return ((word_duration * 0.35) * 1000.0) as u32;
    }
    
    // For normal words (200-400ms), use 40% of duration
    if word_duration < 0.4 {
        return ((word_duration * 0.4) * 1000.0) as u32;
    }
    
    // For longer words (400ms+), use 45% but cap at 200ms to prevent overly slow animations
    let calculated_duration = word_duration * 0.45;
    let capped_duration = calculated_duration.min(0.2);
    (capped_duration * 1000.0) as u32
}
