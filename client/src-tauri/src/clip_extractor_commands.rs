use crate::utils::file_utils;
use crate::video::ffmpeg::extract_clip_segment;
use crate::video::ffmpeg::extract_waveform_data;
use crate::video::ffmpeg::generate_thumbnail_at_time;
use std::path::Path;
use tauri::command;

/// Extract a clip segment from a video file
#[command]
pub async fn extract_clip(
    source_path: String,
    output_path: String,
    start_time: f64,
    end_time: f64,
) -> Result<(), String> {
    println!("[Rust] Extracting clip: {} -> {}", source_path, output_path);
    println!("[Rust] Time range: {}s - {}s", start_time, end_time);

    let src = Path::new(&source_path);
    if !src.exists() {
        return Err(format!(
            "Source video not found: {}. Use a full absolute path to the VOD file (bare filenames fail unless they exist in the app working directory).",
            source_path
        ));
    }
    let source_resolved = src
        .canonicalize()
        .map_err(|e| format!("Could not resolve source video path: {} ({})", source_path, e))?;
    let source_path = source_resolved.to_string_lossy().to_string();
    println!("[Rust] Resolved source path: {}", source_path);

    // Ensure output directory exists
    if let Some(parent) = Path::new(&output_path).parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            return Err(format!("Failed to create output directory: {}", e));
        }
    }

    // Extract the clip using FFmpeg
    extract_clip_segment(&source_path, &output_path, start_time, end_time)
        .await
        .map_err(|e| format!("FFmpeg extraction failed: {}", e))?;

    if let Ok(meta) = std::fs::metadata(&output_path) {
        const MIN_EXTRACT_BYTES: u64 = 512;
        if meta.len() < MIN_EXTRACT_BYTES {
            let _ = std::fs::remove_file(&output_path);
            return Err(format!(
                "Extracted segment is too small ({} bytes). The source file may be wrong, still downloading, or the clip time range is invalid for this VOD.",
                meta.len()
            ));
        }
    }

    println!("[Rust] ✓ Clip extracted successfully: {}", output_path);
    Ok(())
}

/// Generate a thumbnail from a video file at a specific time
#[command]
pub async fn generate_clip_thumbnail(
    video_path: String,
    output_path: String,
    time: f64,
) -> Result<(), String> {
    println!(
        "[Rust] Generating thumbnail: {} -> {} at {}s",
        video_path, output_path, time
    );

    // Ensure output directory exists
    if let Some(parent) = Path::new(&output_path).parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            return Err(format!("Failed to create output directory: {}", e));
        }
    }

    // Generate thumbnail using FFmpeg
    generate_thumbnail_at_time(&video_path, &output_path, time)
        .await
        .map_err(|e| format!("FFmpeg thumbnail generation failed: {}", e))?;

    println!("[Rust] ✓ Thumbnail generated: {}", output_path);
    Ok(())
}

/// Generate waveform data from a video file
#[command]
pub async fn generate_waveform(video_path: String, output_path: String) -> Result<(), String> {
    println!(
        "[Rust] Generating waveform: {} -> {}",
        video_path, output_path
    );

    // Ensure output directory exists
    if let Some(parent) = Path::new(&output_path).parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            return Err(format!("Failed to create output directory: {}", e));
        }
    }

    // Extract waveform using FFmpeg
    extract_waveform_data(&video_path, &output_path)
        .await
        .map_err(|e| format!("FFmpeg waveform extraction failed: {}", e))?;

    println!("[Rust] ✓ Waveform generated: {}", output_path);
    Ok(())
}

/// Delete a file
#[command]
pub async fn delete_file(path: String) -> Result<(), String> {
    println!("[Rust] Deleting file: {}", path);

    file_utils::delete_file(&path).map_err(|e| format!("Failed to delete file: {}", e))?;

    println!("[Rust] ✓ File deleted: {}", path);
    Ok(())
}

/// Check if a file exists
#[command]
pub async fn file_exists(path: String) -> Result<bool, String> {
    let exists = file_utils::file_exists(&path);
    println!("[Rust] File exists check: {} -> {}", path, exists);
    Ok(exists)
}
