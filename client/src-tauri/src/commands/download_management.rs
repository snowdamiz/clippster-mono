use std::fs;
use crate::downloads::{ACTIVE_DOWNLOADS, DOWNLOAD_METADATA};
use crate::storage;

/// Cancels all active downloads and cleans up partial files
///
/// This function will:
/// - Cancel all active downloads
/// - Remove partial video and thumbnail files
/// - Clean up metadata tracking
///
/// # Returns
/// A list of download IDs that were cancelled
#[tauri::command]
pub async fn cancel_all_downloads() -> Result<Vec<String>, String> {
    let mut downloads = ACTIVE_DOWNLOADS.lock().unwrap();
    let download_ids: Vec<String> = downloads.keys().cloned().collect();

    // Get storage paths to clean up partial files
    let paths = match storage::init_storage_dirs() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[Rust] Failed to get storage paths for cleanup: {}", e);
            return Err(format!("Failed to get storage paths: {}", e));
        }
    };

    // Remove partial download files
    let mut cleaned_files = Vec::new();
    for download_id in &download_ids {
        // Look for partial files matching the download ID pattern
        if let Ok(entries) = fs::read_dir(&paths.videos) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                    if filename.contains(download_id) || filename.starts_with("pumpfun_") {
                        if let Err(e) = fs::remove_file(&path) {
                            eprintln!("[Rust] Failed to remove partial file {}: {}", path.display(), e);
                        } else {
                            cleaned_files.push(path.to_string_lossy().to_string());
                            println!("[Rust] Removed partial file: {}", path.display());
                        }
                    }
                }
            }
        }

        // Also clean up partial thumbnails
        if let Ok(entries) = fs::read_dir(&paths.thumbnails) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                    if filename.contains(download_id) {
                        if let Err(e) = fs::remove_file(&path) {
                            eprintln!("[Rust] Failed to remove partial thumbnail {}: {}", path.display(), e);
                        } else {
                            cleaned_files.push(path.to_string_lossy().to_string());
                            println!("[Rust] Removed partial thumbnail: {}", path.display());
                        }
                    }
                }
            }
        }
    }

    // Clear all active downloads
    downloads.clear();
    println!("[Rust] Cancelled {} downloads and cleaned up {} files", download_ids.len(), cleaned_files.len());

    Ok(download_ids)
}

/// Cancels a specific download by ID and cleans up associated files
///
/// # Arguments
/// * `download_id` - The unique identifier of the download to cancel
///
/// # Returns
/// True if cancellation was successful, false otherwise
#[tauri::command]
pub async fn cancel_download(download_id: String) -> Result<bool, String> {
    println!("[Rust] Canceling download: {}", download_id);

    // Since we only allow 1 concurrent download, we can safely kill all FFmpeg processes
    // This is much more reliable than trying to track individual processes
    #[allow(unused_assignments)]
    let mut ffmpeg_killed = false;
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        println!("[Rust] Terminating FFmpeg processes (1 concurrent download limit)");

        match Command::new("taskkill")
            .args(["/F", "/IM", "ffmpeg.exe"])
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    println!("[Rust] Successfully terminated FFmpeg processes");
                    ffmpeg_killed = true;
                } else {
                    println!("[Rust] No FFmpeg processes were running");
                    ffmpeg_killed = false;
                }
            }
            Err(e) => {
                println!("[Rust] Failed to terminate FFmpeg processes: {}", e);
                ffmpeg_killed = false;
            },
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;

        match Command::new("pkill")
            .args(["-f", "ffmpeg"])
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    println!("[Rust] Successfully terminated FFmpeg processes");
                    ffmpeg_killed = true;
                } else {
                    println!("[Rust] No FFmpeg processes were running");
                    ffmpeg_killed = false;
                }
            }
            Err(e) => {
                println!("[Rust] Failed to terminate FFmpeg processes: {}", e);
                ffmpeg_killed = false;
            },
        }
    }

    // Give processes a moment to terminate and release file handles
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Get metadata for cleanup
    let metadata = {
        let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
        metadata_map.remove(&download_id)
    };

    // Clean up files if we have metadata
    if let Some(meta) = metadata {
        println!("[Rust] Cleaning up files for cancelled download: {}", download_id);

        // Remove video file if it exists
        if let Some(video_path) = meta.output_path {
            match std::fs::remove_file(&video_path) {
                Ok(()) => println!("[Rust] Removed partial video file: {}", video_path),
                Err(e) => println!("[Rust] Failed to remove partial video file {}: {}", video_path, e),
            }
        }

        // Remove thumbnail file if it exists
        if let Some(thumbnail_path) = meta.thumbnail_path {
            match std::fs::remove_file(&thumbnail_path) {
                Ok(()) => println!("[Rust] Removed partial thumbnail file: {}", thumbnail_path),
                Err(e) => println!("[Rust] Failed to remove partial thumbnail file {}: {}", thumbnail_path, e),
            }
        }
    }

    // Remove from active downloads
    let mut downloads = ACTIVE_DOWNLOADS.lock().unwrap();
    let was_active = downloads.remove(&download_id).is_some();
    drop(downloads);

    // Consider cancellation successful if:
    // 1. The download was active in our tracking, OR
    // 2. We successfully killed FFmpeg processes (indicates cancellation worked)
    let cancellation_successful = was_active || ffmpeg_killed;

    if was_active {
        println!("[Rust] Successfully cancelled download: {}", download_id);
    } else if ffmpeg_killed {
        println!("[Rust] Download was not active in tracking, but FFmpeg was killed - cancellation successful: {}", download_id);
    } else {
        println!("[Rust] Cancellation attempt failed - download not active and no FFmpeg processes killed: {}", download_id);
    }

    Ok(cancellation_successful)
}

/// Cleans up metadata for a completed download
///
/// This function removes download metadata from tracking while keeping the downloaded files.
///
/// # Arguments
/// * `download_id` - The ID of the completed download to clean up
#[tauri::command]
pub async fn cleanup_completed_download(download_id: String) -> Result<(), String> {
    println!("[Rust] Cleaning up metadata for completed download: {}", download_id);

    // Remove metadata for completed downloads (keep the files)
    let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
    metadata_map.remove(&download_id);

    Ok(())
}