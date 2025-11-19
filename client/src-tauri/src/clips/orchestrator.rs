use std::sync::{Arc, Mutex};
use futures::future::join_all;
use tauri::Emitter;

use super::types::{SubtitleSettings, WordInfo, WhisperSegment, ClipBuildProgress, ClipBuildResult};
use super::video_info::{get_video_info, parse_aspect_ratio, IntroOutroCache};
use super::subtitle::generate_ass_file;
use super::video_processor::{build_single_segment_clip_with_settings, build_multi_segment_clip_with_settings};
use super::thumbnail::generate_clip_thumbnail_simple;
use super::font_manager::get_fonts_dir;

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
pub async fn build_clip_internal_simple(
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
    let paths = crate::storage::init_storage_dirs()
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
                crate::ffmpeg_utils::get_video_duration_sync(&app, output_path.to_str().ok_or("Invalid output path")?).await.ok()
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

