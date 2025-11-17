use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::Emitter;
use crate::storage;
use crate::ffmpeg_utils::get_video_duration_sync;

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

// Build clip from segments using FFmpeg
#[tauri::command]
pub async fn build_clip_from_segments(
    app: tauri::AppHandle,
    project_id: String,
    clip_id: String,
    video_path: String,
    segments: Vec<serde_json::Value>
) -> Result<(), String> {

    println!("[Rust] build_clip_from_segments called with:");
    println!("[Rust]   project_id: {}", project_id);
    println!("[Rust]   clip_id: {}", clip_id);
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   segments count: {}", segments.len());

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
    let project_id_clone = project_id.clone();
    let video_path_clone = video_path.clone();
    let segments_clone = segments.clone();

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
            &video_path_clone,
            &segments_clone
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

// Simplified internal clip building implementation (without progress callbacks)
async fn build_clip_internal_simple(
    app: &tauri::AppHandle,
    project_id: &str,
    clip_id: &str,
    video_path: &str,
    segments: &[serde_json::Value]
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
    let clips_dir = paths.clips.join(format!("project_{}", project_id));
    std::fs::create_dir_all(&clips_dir)
        .map_err(|e| format!("Failed to create clips directory: {}", e))?;

    // Output file path
    let output_filename = format!("clip_{}.mp4", clip_id);
    let output_path = clips_dir.join(&output_filename);

    // Emit building progress
    let _ = app.emit("clip-build-progress", ClipBuildProgress {
        clip_id: clip_id.to_string(),
        project_id: project_id.to_string(),
        progress: 10.0,
        stage: "building".to_string(),
        message: "Building clip from segments...".to_string(),
        error: None,
    });

    if segments.len() == 1 {
        // Single segment - simple extraction
        println!("[Rust] Building single-segment clip");
        build_single_segment_clip_simple(
            app,
            video_path,
            &output_path,
            &segments[0]
        ).await?
    } else {
        // Multiple segments - concatenation required
        println!("[Rust] Building multi-segment clip with {} segments", segments.len());
        build_multi_segment_clip_simple(
            app,
            video_path,
            &output_path,
            segments
        ).await?
    }

    // Emit finalizing progress
    let _ = app.emit("clip-build-progress", ClipBuildProgress {
        clip_id: clip_id.to_string(),
        project_id: project_id.to_string(),
        progress: 90.0,
        stage: "finalizing".to_string(),
        message: "Finalizing clip...".to_string(),
        error: None,
    });

    // Generate thumbnail
    println!("[Rust] About to generate thumbnail for clip...");
    let thumbnail_path = generate_clip_thumbnail_simple(app, &output_path, clip_id).await?;
    println!("[Rust] Thumbnail generation completed");

    // Get file metadata
    println!("[Rust] Getting file metadata...");
    let metadata = std::fs::metadata(&output_path)
        .map_err(|e| format!("Failed to get output file metadata: {}", e))?;
    let file_size = Some(metadata.len());
    println!("[Rust] File metadata obtained: {} bytes", file_size.unwrap_or(0));

    // Get clip duration
    println!("[Rust] Getting clip duration...");
    let duration = get_video_duration_sync(app, output_path.to_str().ok_or("Invalid output path")?).await.ok();
    println!("[Rust] Clip duration obtained: {:?}", duration);

    // Emit completion progress
    println!("[Rust] Emitting completion progress event...");
    let result = ClipBuildResult {
        clip_id: clip_id.to_string(),
        project_id: project_id.to_string(),
        success: true,
        output_path: Some(output_path.to_string_lossy().to_string()),
        thumbnail_path: thumbnail_path.map(|p| p.to_string_lossy().to_string()),
        duration,
        file_size,
        error: None,
    };

    println!("[Rust] Clip build result: success={}, output_path={:?}", result.success, result.output_path);

    let _ = app.emit("clip-build-progress", ClipBuildProgress {
        clip_id: clip_id.to_string(),
        project_id: project_id.to_string(),
        progress: 100.0,
        stage: "completed".to_string(),
        message: "Clip built successfully!".to_string(),
        error: None,
    });

    println!("[Rust] Completion progress event emitted");

    Ok(result)
}

// Cancel clip build
#[tauri::command]
pub async fn cancel_clip_build(clip_id: String) -> Result<bool, String> {
    println!("[Rust] Canceling clip build: {}", clip_id);

    let mut active_builds = ACTIVE_CLIP_BUILDS.lock().unwrap();

    if active_builds.remove(&clip_id).is_some() {
        println!("[Rust] Successfully cancelled clip build: {}", clip_id);
        Ok(true)
    } else {
        println!("[Rust] No active clip build found for: {}", clip_id);
        Ok(false)
    }
}

// Check if clip build is active
#[tauri::command]
pub async fn is_clip_build_active(clip_id: String) -> Result<bool, String> {
    let active_builds = ACTIVE_CLIP_BUILDS.lock().unwrap();
    Ok(active_builds.contains_key(&clip_id))
}

// ===== SIMPLIFIED CLIP BUILDING FUNCTIONS (no progress callbacks) =====

// Simplified build single-segment clip (no progress callback)
async fn build_single_segment_clip_simple(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    let shell = app.shell();
    let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
    let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
    let duration = end_time - start_time;

    println!("[Rust] Extracting single segment: {:.2}s - {:.2}s (duration: {:.2}s)", start_time, end_time, duration);

    // Use FFmpeg to extract the segment
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-ss", &format!("{:.3}", start_time),
            "-i", video_path,
            "-t", &format!("{:.3}", duration),
            "-c", "copy",  // Copy streams without re-encoding
            "-avoid_negative_ts", "1",  // Handle timestamp issues
            "-y",  // Overwrite output file
            output_path.to_str().ok_or("Invalid output path")?,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg extraction failed: {}", stderr));
    }

    Ok(())
}

// Simplified build multi-segment clip (no progress callback)
async fn build_multi_segment_clip_simple(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segments: &[serde_json::Value]
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    let shell = app.shell();

    // Get storage paths for temporary files
    let paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let temp_dir = paths.temp.join(format!("clip_segments_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    println!("[Rust] Building {} segments using concat demuxer approach", segments.len());

    // Create temporary segment files
    let mut segment_files = Vec::new();
    for (i, segment) in segments.iter().enumerate() {
        let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
        let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
        let duration = end_time - start_time;

        let segment_file = temp_dir.join(format!("segment_{:03}.mp4", i));

        // Extract segment using simple copy mode
        let output = shell.sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args([
                "-ss", &format!("{:.3}", start_time),
                "-i", video_path,
                "-t", &format!("{:.3}", duration),
                "-c", "copy",  // Copy streams without re-encoding
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
        println!("[Rust] Extracted segment {} to: {:?}", i, segment_file);
    }

    // Create concat list file
    let concat_file = temp_dir.join("concat_list.txt");
    let mut concat_content = String::new();
    for segment_file in &segment_files {
        concat_content.push_str(&format!("file '{}'\n", segment_file.display()));
    }

    std::fs::write(&concat_file, concat_content)
        .map_err(|e| format!("Failed to write concat file: {}", e))?;

    println!("[Rust] Created concat list file: {:?}", concat_file);

    // Concatenate using concat demuxer
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file.to_str().ok_or("Invalid concat file path")?,
            "-c", "copy",  // Copy streams without re-encoding
            "-avoid_negative_ts", "1",
            "-y",
            output_path.to_str().ok_or("Invalid output path")?,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to concatenate segments: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg concatenation failed: {}", stderr));
    }

    // Clean up temporary files
    let _ = std::fs::remove_dir_all(&temp_dir);
    println!("[Rust] Concatenation successful, cleaned up temp files");

    Ok(())
}

// Simplified generate thumbnail (no progress callback)
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
        println!("[Rust] Thumbnail generated successfully: {}", thumbnail_path.display());
        Ok(Some(thumbnail_path))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("[Rust] Failed to generate thumbnail: {}", stderr);
        Ok(None)
    }
}