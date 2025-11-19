use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::Emitter;
use crate::storage;
use crate::ffmpeg_utils::{get_video_duration_sync, parse_video_info_from_ffmpeg_output};
use std::io::Write;
use tauri_plugin_shell::ShellExt;
use futures::future::join_all;

// Video info cache for eliminating redundant ffmpeg probes
static VIDEO_INFO_CACHE: Lazy<Arc<Mutex<HashMap<String, crate::ffmpeg_utils::VideoInfo>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Intro/outro processing cache per build session
type IntroOutroCache = HashMap<(String, String, u32, u32, u32), std::path::PathBuf>;

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
    pub border1_width: f32,
    pub border1_color: String,
    pub border2_width: f32,
    pub border2_color: String,
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
    run_number: Option<u32>,
    intro_path: Option<String>,
    intro_duration: Option<f64>,
    outro_path: Option<String>,
    outro_duration: Option<f64>
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
    println!("[Rust]   intro_path: {:?}", intro_path);
    println!("[Rust]   outro_path: {:?}", outro_path);

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
    let intro_path_clone = intro_path.clone();
    let outro_path_clone = outro_path.clone();

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
            run_number,
            intro_path_clone.as_deref(),
            intro_duration,
            outro_path_clone.as_deref(),
            outro_duration
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
    run_number: Option<u32>,
    intro_path: Option<&str>,
    intro_duration: Option<f64>,
    outro_path: Option<&str>,
    _outro_duration: Option<f64>
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
    
    // Create intro/outro cache for this build session (thread-safe for parallel builds)
    let intro_outro_cache = Arc::new(Mutex::new(IntroOutroCache::new()));

    // Build clips for all aspect ratios IN PARALLEL for maximum speed
    let total_ratios = aspect_ratios.len();
    println!("[Rust] Building {} aspect ratios in parallel...", total_ratios);
    
    let build_tasks: Vec<_> = aspect_ratios.iter().enumerate().map(|(ratio_idx, aspect_ratio_str)| {
        let app = app.clone();
        let video_path = video_path.to_string();
        let clip_id = clip_id.to_string();
        let project_id = project_id.to_string();
        let clip_base_dir = clip_base_dir.clone();
        let segments = segments.to_vec();
        let subtitle_settings = subtitle_settings.clone();
        let transcript_words = transcript_words.clone();
        let quality = quality.to_string();
        let output_format = output_format.to_string();
        let intro_path = intro_path.map(|s| s.to_string());
        let outro_path = outro_path.map(|s| s.to_string());
        let video_info = video_info.clone();
        let intro_outro_cache = intro_outro_cache.clone();
        let aspect_ratio_str = aspect_ratio_str.clone();
        
        async move {
            println!("[Rust] Building clip for aspect ratio: {}", aspect_ratio_str);
            
            let progress_start = 10.0 + (ratio_idx as f64 / total_ratios as f64) * 75.0;
            let _ = app.emit("clip-build-progress", ClipBuildProgress {
                clip_id: clip_id.clone(),
                project_id: project_id.clone(),
                progress: progress_start,
                stage: "building".to_string(),
                message: format!("Building {} ({}/{})", aspect_ratio_str, ratio_idx + 1, total_ratios),
                error: None,
            });

            // Parse aspect ratio string (e.g., "16:9")
            let aspect_ratio = parse_aspect_ratio(&aspect_ratio_str)?;
            
            // Create filename with aspect ratio (replace : with -) and selected format (mp4/mov)
            let ratio_suffix = aspect_ratio_str.replace(":", "-");
            let output_filename = format!("clip_{}.{}", ratio_suffix, output_format);
            let output_path = clip_base_dir.join(&output_filename);

            // Generate subtitle file if needed for this aspect ratio
            let subtitle_file = if let (Some(settings), Some(words)) = (&subtitle_settings, &transcript_words) {
                if settings.enabled {
                    // Get fonts directory
                    let fonts_dir = get_fonts_dir(&app).ok();
                    
                    let sub_path = clip_base_dir.join(format!("subtitles_{}.ass", ratio_suffix));
                    // Pass intro_duration as time offset for subtitle timings
                    let subtitle_offset = intro_duration.unwrap_or(0.0);
                    generate_ass_file(
                        settings, 
                        words, 
                        &segments, 
                        &sub_path, 
                        max_words.unwrap_or(4), 
                        Some(&aspect_ratio),
                        video_info.width,
                        video_info.height,
                        fonts_dir.as_deref(),
                        subtitle_offset
                    ).map_err(|e| format!("Failed to generate subtitle file: {}", e))?;
                    
                    Some(sub_path)
                } else {
                    None
                }
            } else {
                None
            };

            // Build clip based on segments with aspect ratio cropping
            // Note: We pass the Arc<Mutex<>> cache, and lock/unlock inside the build functions
            if segments.len() == 1 {
                println!("[Rust] Building single-segment clip for {}", aspect_ratio_str);
                build_single_segment_clip_with_settings(
                    &app,
                    &video_path,
                    &output_path,
                    &segments[0],
                    subtitle_file.as_deref(),
                    &aspect_ratio,
                    &quality,
                    frame_rate,
                    &output_format,
                    intro_path.as_deref(),
                    outro_path.as_deref(),
                    intro_outro_cache.clone()
                ).await?;
            } else {
                println!("[Rust] Building multi-segment clip for {} with {} segments", aspect_ratio_str, segments.len());
                build_multi_segment_clip_with_settings(
                    &app,
                    &video_path,
                    &output_path,
                    &segments,
                    subtitle_file.as_deref(),
                    &aspect_ratio,
                    &quality,
                    frame_rate,
                    &output_format,
                    intro_path.as_deref(),
                    outro_path.as_deref(),
                    intro_outro_cache.clone()
                ).await?;
            }

            // Clean up subtitle file
            if let Some(sub_path) = subtitle_file {
                let _ = std::fs::remove_file(sub_path);
            }

            // Generate thumbnail for the first aspect ratio
            let thumbnail = if ratio_idx == 0 {
                println!("[Rust] Generating thumbnail for first aspect ratio...");
                generate_clip_thumbnail_simple(&app, &output_path, &clip_id).await?
            } else {
                None
            };

            // Get file metadata
            let metadata = std::fs::metadata(&output_path)
                .map_err(|e| format!("Failed to get output file metadata: {}", e))?;
            let file_size = metadata.len();

            // Get clip duration (from first clip)
            let duration = if ratio_idx == 0 {
                get_video_duration_sync(&app, output_path.to_str().ok_or("Invalid output path")?).await.ok()
            } else {
                None
            };

            // Return build result
            Ok::<_, String>((
                output_path.to_string_lossy().to_string(),
                file_size,
                duration,
                thumbnail,
                ratio_idx
            ))
        }
    }).collect();

    // Wait for all aspect ratios to complete in parallel
    let build_results = join_all(build_tasks).await;
    
    // Process results
    for result in build_results {
        match result {
            Ok((output_path_str, file_size, duration, thumbnail, ratio_idx)) => {
                all_output_paths.push(output_path_str.clone());
                total_file_size += file_size;
                
                if ratio_idx == 0 {
                    first_output_path = Some(output_path_str);
                    first_thumbnail_path = thumbnail;
                    clip_duration = duration;
                }
            },
            Err(e) => return Err(format!("Aspect ratio build failed: {}", e)),
        }
    }
    
    println!("[Rust] All {} aspect ratios built successfully in parallel!", total_ratios);

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

// Hardware encoder configuration
#[derive(Debug, Clone)]
struct EncoderConfig {
    codec: String,
    preset: Option<String>,
    quality_param: String,
    quality_value: String,
}

// Detect available hardware encoders and return optimal encoder config
async fn detect_hardware_encoder(app: &tauri::AppHandle, quality: &str) -> EncoderConfig {
    let shell = app.shell();
    
    // Try to get ffmpeg encoder list
    let encoder_check = shell.sidecar("ffmpeg")
        .map_err(|_| ())
        .and_then(|cmd| Ok(cmd.args(["-encoders"])));
    
    if let Ok(cmd) = encoder_check {
        if let Ok(output) = cmd.output().await {
            let encoders = String::from_utf8_lossy(&output.stdout);
            
            // Check for NVIDIA NVENC (best quality/speed)
            if encoders.contains("h264_nvenc") {
                println!("[Rust] Hardware encoder detected: NVIDIA NVENC");
                let (_, crf) = get_quality_settings(quality);
                return EncoderConfig {
                    codec: "h264_nvenc".to_string(),
                    preset: Some("p4".to_string()), // p4 = medium quality preset
                    quality_param: "-cq".to_string(),
                    quality_value: crf.to_string(), // NVENC uses same CRF values
                };
            }
            
            // Check for Intel Quick Sync
            if encoders.contains("h264_qsv") {
                println!("[Rust] Hardware encoder detected: Intel Quick Sync");
                let (_, crf) = get_quality_settings(quality);
                return EncoderConfig {
                    codec: "h264_qsv".to_string(),
                    preset: None,
                    quality_param: "-global_quality".to_string(),
                    quality_value: crf.to_string(),
                };
            }
            
            // Check for Apple VideoToolbox (macOS)
            if encoders.contains("h264_videotoolbox") {
                println!("[Rust] Hardware encoder detected: Apple VideoToolbox");
                // VideoToolbox uses different quality scale, map CRF to bitrate
                let quality_value = match quality {
                    "low" => "2000000",   // 2 Mbps
                    "medium" => "5000000", // 5 Mbps
                    "high" => "10000000",  // 10 Mbps
                    _ => "5000000",
                };
                return EncoderConfig {
                    codec: "h264_videotoolbox".to_string(),
                    preset: None,
                    quality_param: "-b:v".to_string(),
                    quality_value: quality_value.to_string(),
                };
            }
        }
    }
    
    // Fallback to software encoder
    println!("[Rust] No hardware encoder detected, using libx264");
    let (preset, crf) = get_quality_settings(quality);
    EncoderConfig {
        codec: "libx264".to_string(),
        preset: Some(preset.to_string()),
        quality_param: "-crf".to_string(),
        quality_value: crf.to_string(),
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
    _output_format: &str,  // Format already applied in output_path extension
    intro_path: Option<&str>,
    outro_path: Option<&str>,
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>
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
    
    // Get quality settings (unused in this path, but kept for reference)
    let (_preset, _crf) = get_quality_settings(quality);
    
    // If intro or outro is present, we need to use the concat approach
    if intro_path.is_some() || outro_path.is_some() {
        println!("[Rust] Intro or outro detected, using concat approach for single segment");
        
        // Get storage paths for temporary files
        let paths = storage::init_storage_dirs()
            .map_err(|e| format!("Failed to get storage paths: {}", e))?;

        let temp_dir = paths.temp.join(format!("clip_single_segment_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;

        // Detect hardware encoder for better performance
        let encoder = detect_hardware_encoder(app, quality).await;

        // Extract the main segment without subtitles (we'll add them later if needed)
        let segment_file = temp_dir.join("main_segment.mp4");
        let crop_filter = format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y);

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
        }

        // Clean up temporary files
        let _ = std::fs::remove_dir_all(&temp_dir);

        return Ok(());
    }

    // Original single-segment path (no intro/outro)
    // Detect hardware encoder for better performance
    let encoder = detect_hardware_encoder(app, quality).await;
    
    // Get fonts directory for subtitle rendering
    let fonts_dir = get_fonts_dir(app).ok();

    // Build video filter combining crop + subtitles in ONE PASS
    // Force RGB24 for accurate subtitle color rendering before applying ASS
    let mut vf_parts = vec![
        format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y),
        "format=rgb24".to_string()
    ];
    
    if let Some(path) = subtitle_path {
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
    let fontconfig_path = storage::init_storage_dirs()
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
    _output_format: &str,  // Format already applied in output_path extension
    intro_path: Option<&str>,
    outro_path: Option<&str>,
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>
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

    // Get quality settings (unused in this path, but kept for reference)
    let (_preset, _crf) = get_quality_settings(quality);
    
    // Detect hardware encoder for better performance
    let encoder = detect_hardware_encoder(app, quality).await;

    // Extract segments with cropping IN PARALLEL for speed
    println!("[Rust] Extracting {} segments in parallel...", segments.len());
    let segment_tasks: Vec<_> = segments.iter().enumerate().map(|(i, segment)| {
        let start_time: f64 = segment["start_time"].as_f64().unwrap_or(0.0);
        let end_time: f64 = segment["end_time"].as_f64().unwrap_or(0.0);
        let duration = end_time - start_time;
        let segment_file = temp_dir.join(format!("segment_{:03}.mp4", i));
        let crop_filter = crop_filter.clone();
        let video_path = video_path.to_string();
        let app = app.clone();
        let encoder = encoder.clone();
        let frame_rate_str = frame_rate.to_string();

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

// Helper function to prepare intro/outro for concatenation with the main clip
// This processes the intro/outro to match the aspect ratio, frame rate, and resolution
// Includes caching to avoid re-processing the same intro/outro multiple times
async fn prepare_intro_outro_for_concat(
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
    use tauri_plugin_shell::ShellExt;
    
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

    // Get video info for the intro/outro
    let video_info = get_video_info(app, intro_outro_path).await?;
    let (crop_x, crop_y) = calculate_crop_position(video_info.width, video_info.height, crop_w, crop_h);

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Create output path in temp directory
    let output_path = temp_dir.join(format!("{}_processed.mp4", file_prefix));

    // Build crop filter
    let crop_filter = format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y);

    // Build encoder-specific args
    let mut args = vec![
        "-i".to_string(), intro_outro_path.to_string(),
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

// Helper function to calculate crop position (center crop)
fn calculate_crop_position(video_width: u32, video_height: u32, crop_w: u32, crop_h: u32) -> (u32, u32) {
    let crop_x = if video_width > crop_w {
        (video_width - crop_w) / 2
    } else {
        0
    };
    let crop_y = if video_height > crop_h {
        (video_height - crop_h) / 2
    } else {
        0
    };
    (crop_x, crop_y)
}

// Helper function to get video info with caching to eliminate redundant probes
async fn get_video_info(app: &tauri::AppHandle, video_path: &str) -> Result<crate::ffmpeg_utils::VideoInfo, String> {
    // Check cache first
    {
        let cache = VIDEO_INFO_CACHE.lock().unwrap();
        if let Some(info) = cache.get(video_path) {
            println!("[Rust] Using cached video info for: {}", video_path);
            return Ok(info.clone());
        }
    }
    
    // Not in cache, fetch from ffmpeg
    println!("[Rust] Fetching video info from ffmpeg for: {}", video_path);
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
    let info = if let Ok(info) = parse_video_info_from_ffmpeg_output(&stderr) {
        info
    } else {
        // If that fails, try alternative parsing
        println!("[Rust] Standard parsing failed, trying alternative method...");
        parse_video_info_alternative(&stderr)?
    };
    
    // Cache the result
    {
        let mut cache = VIDEO_INFO_CACHE.lock().unwrap();
        cache.insert(video_path.to_string(), info.clone());
    }
    
    Ok(info)
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

// Helper to get fonts directory and create fontconfig
fn get_fonts_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    
    // In dev mode, fonts are in src-tauri/fonts
    // In production, fonts are in the resource directory
    let fonts_dir = if cfg!(debug_assertions) {
        // Navigate up to find the project root
        let current_exe = std::env::current_exe()
            .map_err(|e| format!("Failed to get current exe: {}", e))?;
        
        // In dev mode, exe is in target/debug/, so go up to src-tauri then to fonts
        let src_tauri_dir = current_exe
            .parent().unwrap() // debug
            .parent().unwrap() // target
            .parent().unwrap(); // src-tauri
        
        src_tauri_dir.join("fonts")
    } else {
        // Production mode: use bundled fonts from resource directory
        let resource_dir = app.path()
            .resource_dir()
            .map_err(|e| format!("Failed to get resource directory: {}", e))?;
        resource_dir.join("fonts")
    };
    
    println!("[Rust] Fonts directory: {}", fonts_dir.display());
    println!("[Rust] Fonts directory exists: {}", fonts_dir.exists());
    
    if fonts_dir.exists() {
        // List font files found
        if let Ok(entries) = std::fs::read_dir(&fonts_dir) {
            println!("[Rust] Font files found:");
            for entry in entries.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    if name.ends_with(".ttf") || name.ends_with(".otf") {
                        println!("[Rust]   - {}", name);
                    }
                }
            }
        }
    }
    
    // Create fontconfig file to tell FFmpeg where to find fonts
    create_fontconfig_file(&fonts_dir)?;
    
    Ok(fonts_dir)
}

// Helper to create fontconfig file for FFmpeg
fn create_fontconfig_file(fonts_dir: &std::path::Path) -> Result<(), String> {
    let storage_paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;
    
    let fontconfig_path = storage_paths.temp.join("fonts.conf");
    
    // Convert Windows path to Unix-style path for fontconfig
    let fonts_dir_str = fonts_dir.to_string_lossy().replace("\\", "/");
    
    let fontconfig_content = format!(
        r#"<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
    <dir>{}</dir>
    <cachedir>{}/font-cache</cachedir>
</fontconfig>
"#,
        fonts_dir_str,
        storage_paths.temp.to_string_lossy().replace("\\", "/")
    );
    
    std::fs::write(&fontconfig_path, fontconfig_content)
        .map_err(|e| format!("Failed to write fontconfig file: {}", e))?;
    
    println!("[Rust] Created fontconfig at: {}", fontconfig_path.display());
    
    Ok(())
}

// Helper to embed fonts directly in ASS file
fn embed_fonts_in_ass(
    file: &mut std::fs::File,
    fonts_dir: &std::path::Path,
    settings: &SubtitleSettings
) -> Result<(), String> {
    use std::io::Read;
    
    // Determine which font files we need based on font family and weight
    let font_files_to_embed = get_required_font_files(settings);
    
    // ASS fonts section uses UUencoded format
    writeln!(file, "[Fonts]").unwrap();
    
    for font_filename in font_files_to_embed {
        let font_path = fonts_dir.join(&font_filename);
        
        if !font_path.exists() {
            println!("[Rust] Warning: Font file not found: {} - FFmpeg will use system fallback", font_path.display());
            continue;
        }
        
        println!("[Rust] Embedding font: {}", font_filename);
        
        // Read font file
        let mut font_file = std::fs::File::open(&font_path)
            .map_err(|e| format!("Failed to open font file {}: {}", font_filename, e))?;
        
        let mut font_data = Vec::new();
        font_file.read_to_end(&mut font_data)
            .map_err(|e| format!("Failed to read font file {}: {}", font_filename, e))?;
        
        println!("[Rust] Font file size: {} bytes", font_data.len());
        
        // Encode as UUencoded (ASS standard for embedded fonts)
        let encoded = uuencode_data(&font_data);
        
        // Write font header - use filename WITHOUT extension (ASS format requirement)
        let font_name_without_ext = font_filename.trim_end_matches(".ttf").trim_end_matches(".otf");
        writeln!(file, "fontname: {}", font_name_without_ext).unwrap();
        
        // Write encoded data
        for line in encoded {
            writeln!(file, "{}", line).unwrap();
        }
        
        writeln!(file, "").unwrap();
    }
    
    Ok(())
}

// Helper to get required font files for embedding
fn get_required_font_files(settings: &SubtitleSettings) -> Vec<String> {
    let mut files = Vec::new();
    
    // Determine font file based on family and weight
    let weight_suffix = if settings.font_weight >= 700 {
        "Bold"
    } else if settings.font_weight >= 600 {
        "SemiBold"
    } else if settings.font_weight >= 500 {
        "Medium"
    } else if settings.font_weight < 400 && settings.font_weight >= 300 {
        "Light"
    } else if settings.font_weight < 300 {
        "Thin"
    } else {
        "Regular"
    };
    
    // Build font filename
    let font_file = match settings.font_family.as_str() {
        "Open Sans" => {
            // Handle space in name
            if weight_suffix == "Regular" {
                "OpenSans-Regular.ttf".to_string()
            } else {
                format!("OpenSans-{}.ttf", weight_suffix)
            }
        },
        "Bebas Neue" => {
            // Bebas Neue only has Regular weight
            "BebasNeue-Regular.ttf".to_string()
        },
        _ => {
            // Standard format: FontName-Weight.ttf
            if weight_suffix == "Regular" {
                format!("{}-Regular.ttf", settings.font_family)
            } else {
                format!("{}-{}.ttf", settings.font_family, weight_suffix)
            }
        }
    };
    
    files.push(font_file);
    files
}

// UUencode data for ASS font embedding (ASS uses UUencoding, not base64)
fn uuencode_data(data: &[u8]) -> Vec<String> {
    let mut lines = Vec::new();
    
    for chunk in data.chunks(45) { // UUencode uses 45 bytes per line (60 chars output)
        let mut line = String::new();
        
        // Length character: 45 bytes = 'M' in UUencode
        let len_char = (chunk.len() as u8 + 32) as char;
        line.push(len_char);
        
        // Encode the chunk
        for group in chunk.chunks(3) {
            let mut buf = [0u8; 3];
            for (i, &byte) in group.iter().enumerate() {
                buf[i] = byte;
            }
            
            // UUencode: split 3 bytes into 4 6-bit values, add 32 to each
            let b1 = ((buf[0] >> 2) & 0x3f) + 32;
            let b2 = ((((buf[0] & 0x03) << 4) | ((buf[1] >> 4) & 0x0f)) & 0x3f) + 32;
            let b3 = ((((buf[1] & 0x0f) << 2) | ((buf[2] >> 6) & 0x03)) & 0x3f) + 32;
            let b4 = ((buf[2] & 0x3f)) + 32;
            
            line.push(b1 as char);
            line.push(b2 as char);
            
            if group.len() > 1 {
                line.push(b3 as char);
            }
            if group.len() > 2 {
                line.push(b4 as char);
            }
        }
        
        lines.push(line);
    }
    
    lines
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
    video_height: u32,
    fonts_dir: Option<&std::path::Path>,
    time_offset: f64  // Offset to add to all subtitle times (e.g., intro duration)
) -> Result<(), String> {
    let mut file = std::fs::File::create(output_path)
        .map_err(|e| format!("Failed to create subtitle file: {}", e))?;

    // Generate ASS header with normalized 1080p height coordinate system
    // This ensures font sizes match the frontend which uses 1080p as reference
    let play_res_y = 1080;
    let play_res_x = (video_width as f64 * (1080.0 / video_height as f64)).round() as u32;

    writeln!(file, "[Script Info]").unwrap();
    writeln!(file, "ScriptType: v4.00+").unwrap();
    writeln!(file, "PlayResX: {}", play_res_x).unwrap();
    writeln!(file, "PlayResY: {}", play_res_y).unwrap();
    writeln!(file, "WrapStyle: 1").unwrap(); // Word wrapping
    writeln!(file, "ScaledBorderAndShadow: yes").unwrap();
    writeln!(file, "").unwrap();
    
    // Embed fonts if available
    if let Some(fonts_path) = fonts_dir {
        println!("[Rust] Attempting to embed fonts from: {}", fonts_path.display());
        if fonts_path.exists() {
            println!("[Rust] Fonts directory exists, embedding...");
            embed_fonts_in_ass(&mut file, fonts_path, settings)?;
        } else {
            println!("[Rust] WARNING: Fonts directory does not exist! Fonts will not be embedded.");
        }
    } else {
        println!("[Rust] WARNING: No fonts directory provided, fonts will not be embedded.");
    }
    
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
            // Note: Style definitions do NOT use the trailing '&' that override tags use
            format!("&H00{}{}{}", b, g, r).to_uppercase()
        } else {
            "&H00FFFFFF".to_string()
        }
    };

    let primary_color = convert_color(&settings.text_color);
    let border1_color = convert_color(&settings.border1_color);
    let border2_color = convert_color(&settings.border2_color);
    let _back_color = convert_color(&settings.background_color);

    println!("[Rust] Subtitle colors - Text: {}, Border1: {}, Border2: {}, Background: {}", 
        settings.text_color, settings.border1_color, settings.border2_color, settings.background_color);
    println!("[Rust] ASS colors - Primary: {}, Border1: {}, Border2: {}", primary_color, border1_color, border2_color);
    println!("[Rust] Using font: {}", settings.font_family);

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

    // Apply a correction factor to match the frontend visual size for font size
    // The frontend preview renders fonts larger relative to the video frame due to DPI/scaling differences
    let font_size_scale = font_size_scale * 1.5;

    let adjusted_font_size = (settings.font_size * font_size_scale).round();
    // CSS WebkitTextStroke is centered on the path, so only half extends outwards.
    // ASS Outline is entirely outwards. To match the visual thickness of the frontend,
    // we need to divide the stroke width by 2.
    let adjusted_border1_width = settings.border1_width * font_size_scale * 0.8;
    let adjusted_border2_width = settings.border2_width * font_size_scale * 0.8;
    // ASS Shadow parameter is an offset depth, calculate from shadow offset X/Y
    // Use the magnitude of the offset vector for proper shadow distance
    let shadow_offset_magnitude = ((settings.shadow_offset_x.powi(2) + settings.shadow_offset_y.powi(2)).sqrt()) * font_size_scale;
    let adjusted_shadow = shadow_offset_magnitude;
    let adjusted_letter_spacing = settings.letter_spacing * font_size_scale;

    println!("[Rust] Font size: {} -> {} (scale: {})", settings.font_size, adjusted_font_size, font_size_scale);

    // Calculate margins and positioning to match VideoPlayer.vue
    // Vue uses a container with width=maxWidth% centered on screen
    // And positions it using top=positionPercentage% and translate(-50%, -50%)
    
    let adjusted_padding = settings.padding * font_size_scale;
    let box_width_px = play_res_x as f64 * (settings.max_width as f64 / 100.0);
    
    // Calculate margins to constrain text to box_width - 2*padding
    // The box is centered on screen, so margins are symmetric
    let side_margin = (play_res_x as f64 - box_width_px) / 2.0;
    let margin_l = (side_margin + adjusted_padding as f64).round() as i32;
    let margin_r = (side_margin + adjusted_padding as f64).round() as i32;
    
    // Calculate target position for \pos(x,y)
    // X: Center of screen + Offset (percentage of box width)
    let shift_x_px = box_width_px * (settings.text_offset_x as f64 / 100.0);
    let target_x = (play_res_x as f64 / 2.0) + shift_x_px;
    
    // Y: Position% of screen + Offset (percentage of height)
    // We approximate height as 2 lines + padding for the offset calculation
    let approx_height = (adjusted_font_size as f64 * 2.0) + (adjusted_padding as f64 * 2.0);
    let shift_y_px = approx_height * (settings.text_offset_y as f64 / 100.0);
    
    // Apply a vertical correction to raise the subtitles slightly
    // The font scaling (1.5x) pushes the bottom edge down, so we compensate by moving the center up
    // We use a factor of the font size as a heuristic for the correction
    let vertical_correction = (adjusted_font_size as f64) * 0.3;
    
    let target_y = (play_res_y as f64 * (settings.position_percentage as f64 / 100.0)) + shift_y_px - vertical_correction;
    
    // Use Alignment 5 (Middle Center) to match Vue's translate(-50%, -50%)
    let alignment = 5;
    let margin_v = 10; // Not used for positioning with \pos, but required by Style
    
    let pos_tag = format!("{{\\pos({:.0},{:.0})}}", target_x, target_y);

    // For embedded fonts, we need to reference the actual font family name 
    // and use \fw tags for specific weights, as standard ASS only supports Bold/Italic.
    // This avoids issues where libass fails to match a constructed name like "Montserrat-Bold"
    // if the internal family name is just "Montserrat".
    
    // We'll use the base family name in the Style
    let font_name_for_style = settings.font_family.clone();
    
    // But we still need to embed the specific font file corresponding to the weight.
    // (This is handled by get_required_font_files and embed_fonts_in_ass)

    // Standard ASS Bold flag (only for generic bold, specific weights handled via \fw)
    let bold = if settings.font_weight >= 700 { -1 } else { 0 };
    
    println!("[Rust] Font name for ASS: {}", font_name_for_style);

    // Generate two styles for layered borders
    // Layer ordering: shadow (bottom) > border2 (middle) > border1 (top) > text
    
    // Style 1: Border2Layer (bottom layer with larger outline = border1 + border2)
    // ASS Style format:
    // Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, 
    // Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, 
    // BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
    let total_border_width = adjusted_border1_width + adjusted_border2_width;
    
    // Use shadow_color for BackColour (which controls Shadow color in BorderStyle=1)
    let shadow_color_ass = convert_color(&settings.shadow_color);
    
    // Calculate word spacing separator
    // Frontend uses flex gap which replaces the space character.
    // In ASS, we use a space character, so we need to adjust its spacing to match the desired gap.
    // We assume a standard space width of ~0.25em.
    // Target width = word_spacing * font_size
    // Required spacing = Target width - Estimated space width
    let space_glyph_width = adjusted_font_size * 0.25;
    let target_word_gap = settings.word_spacing * adjusted_font_size;
    let space_char_spacing = (target_word_gap - space_glyph_width).max(0.0);
    
    // Separator: Set spacing for space char, then space char, then reset spacing for next word
    let word_separator = format!("{{\\fsp{:.1}}} {{\\fsp{:.1}}}", space_char_spacing, adjusted_letter_spacing);

    writeln!(file, "Style: Border2Layer,{},{},{},{},{},{},{},0,0,0,100,100,{},0,1,{},{},{},{},{},{},1",
        font_name_for_style,
        adjusted_font_size,
        primary_color,
        primary_color, // SecondaryColour
        border2_color, // OutlineColour (border2 color)
        shadow_color_ass, // BackColour (Shadow color)
        bold,
        adjusted_letter_spacing,
        total_border_width, // Outline (total width)
        adjusted_shadow, // Shadow (drop shadow)
        alignment,
        margin_l,
        margin_r,
        margin_v
    ).unwrap();

    // Style 2: Border1Layer (top layer with smaller outline = border1 only)
    writeln!(file, "Style: Border1Layer,{},{},{},{},{},{},{},0,0,0,100,100,{},0,1,{},{},{},{},{},{},1",
        font_name_for_style,
        adjusted_font_size,
        primary_color,
        primary_color, // SecondaryColour
        border1_color, // OutlineColour (border1 color)
        "&H00000000".to_string(), // No background for top layer
        bold,
        adjusted_letter_spacing,
        adjusted_border1_width, // Outline (border1 only)
        0.0, // No shadow on top layer
        alignment,
        margin_l,
        margin_r,
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
                // Calculate relative timing and add the time offset (e.g., intro duration)
                let start_rel = word.start - clip_seg_start + current_clip_time + time_offset;
                let end_rel = word.end - clip_seg_start + current_clip_time + time_offset;
                
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
            time_offset  // Start at the time offset (after intro)
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
            
            // Strategy: Render text in four layers for dual borders + animation
            // Layer 0: Border2Layer base text (shadow + outer border)
            // Layer 1: Border2Layer active word animation (shadow + outer border, scaled)
            // Layer 2: Border1Layer base text (inner border)
            // Layer 3: Border1Layer active word animation (inner border, scaled)
            
            // Layer 0: Border2Layer base text with all words at normal size
            // Use \fw tag to ensure correct font weight
            let weight_tag = format!("{{\\fw{}}}", settings.font_weight);
            let base_text = chunk.iter().map(|w| format!("{}{}", weight_tag, w.word)).collect::<Vec<_>>().join(&word_separator);
            
            writeln!(file, "Dialogue: 0,{},{},Border2Layer,,0,0,0,,{}{}",
                format_time(t_start),
                format_time(t_end),
                pos_tag,
                base_text
            ).unwrap();
            
            // Layer 2: Border1Layer base text with all words at normal size
            writeln!(file, "Dialogue: 2,{},{},Border1Layer,,0,0,0,,{}{}",
                format_time(t_start),
                format_time(t_end),
                pos_tag,
                base_text
            ).unwrap();
            
            // Layers 1 & 3: If there's an active word, render it scaled on top (for both border layers)
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
                            "{}{{\\r\\t({},{},\\fscx115\\fscy115)}}{}{{\\fscx100\\fscy100}}",
                            weight_tag,
                            word_start_in_interval,
                            scale_up_end,
                            word.word
                        ));
                    } else {
                        // Use {\alpha&HFF&} to make word invisible (maintains spacing)
                        // Still include weight tag to maintain spacing metrics
                        positioned_text_parts.push(format!("{}{{\\alpha&HFF&}}{}", weight_tag, word.word));
                    }
                }
                
                let overlay_text = positioned_text_parts.join(&word_separator);
                
                // Layer 1: Border2Layer active word (shadow + outer border)
                writeln!(file, "Dialogue: 1,{},{},Border2Layer,,0,0,0,,{}{}",
                    format_time(t_start),
                    format_time(t_end),
                    pos_tag,
                    overlay_text
                ).unwrap();
                
                // Layer 3: Border1Layer active word (inner border)
                writeln!(file, "Dialogue: 3,{},{},Border1Layer,,0,0,0,,{}{}",
                    format_time(t_start),
                    format_time(t_end),
                    pos_tag,
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
