use once_cell::sync::Lazy;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

mod storage;
mod ffmpeg_utils;
mod auth;
mod downloads;
mod audio;
mod clips;
mod video_server;
mod assets;
mod ui_utils;

use ffmpeg_utils::{
    extract_duration_from_ffmpeg_output,
    parse_video_info_from_ffmpeg_output, parse_duration_from_ffmpeg_output,
    VideoValidationResult
};

// Import download-related items from downloads module
use downloads::{ACTIVE_DOWNLOADS, DOWNLOAD_METADATA};

// Auth-related structs and functions moved to auth.rs module

// Download-related structs moved to downloads.rs module


// Download-related statics moved to downloads.rs module
static CLIP_GENERATION_IN_PROGRESS: Lazy<Arc<Mutex<bool>>> = Lazy::new(|| Arc::new(Mutex::new(false)));

// Video server port is now in video_server module
use video_server::VIDEO_SERVER_PORT;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Authentication functions moved to auth.rs module

#[tauri::command]
fn get_video_server_port() -> u16 {
    VIDEO_SERVER_PORT
}

#[tauri::command]
async fn test_download_command(message: String) -> Result<String, String> {
    println!("[Rust] Test command called with message: {}", message);
    Ok(format!("Test command received: {}", message))
}

// Download functions moved to downloads.rs module

// download_pumpfun_vod function moved to downloads.rs module






#[tauri::command]
async fn get_active_downloads_count() -> Result<usize, String> {
    let downloads = ACTIVE_DOWNLOADS.lock().unwrap();
    Ok(downloads.len())
}

#[tauri::command]
async fn cancel_all_downloads() -> Result<Vec<String>, String> {
    use std::fs;

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

#[tauri::command]
async fn cancel_download(download_id: String) -> Result<bool, String> {
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

#[tauri::command]
async fn cleanup_completed_download(download_id: String) -> Result<(), String> {
    println!("[Rust] Cleaning up metadata for completed download: {}", download_id);

    // Remove metadata for completed downloads (keep the files)
    let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
    metadata_map.remove(&download_id);

    Ok(())
}

#[tauri::command]
async fn check_file_exists(path: String) -> Result<bool, String> {
    use std::path::Path;
    Ok(Path::new(&path).exists())
}

#[tauri::command]
async fn validate_video_file(app: tauri::AppHandle, file_path: String) -> Result<VideoValidationResult, String> {
    use std::path::Path;
    use tauri_plugin_shell::ShellExt;

    println!("[Rust Validation] validate_video_file called with path: {}", file_path);

    let video_path = Path::new(&file_path);

    // Check if file exists
    if !video_path.exists() {
        return Ok(VideoValidationResult {
            is_valid: false,
            error: Some("Video file does not exist".to_string()),
            duration: None,
            width: None,
            height: None,
            codec: None,
            file_size: None,
        });
    }

    // Check file size (should be greater than 0)
    let metadata = match std::fs::metadata(video_path) {
        Ok(meta) => meta,
        Err(e) => {
            return Ok(VideoValidationResult {
                is_valid: false,
                error: Some(format!("Failed to read file metadata: {}", e)),
                duration: None,
                width: None,
                height: None,
                codec: None,
                file_size: None,
            });
        }
    };

    let file_size = metadata.len();
    if file_size == 0 {
        return Ok(VideoValidationResult {
            is_valid: false,
            error: Some("Video file is empty".to_string()),
            duration: None,
            width: None,
            height: None,
            codec: None,
            file_size: Some(0),
        });
    }

    // Use FFmpeg to validate video file integrity
    let shell = app.shell();

    let output = match shell.sidecar("ffmpeg") {
        Ok(ffmpeg) => {
            match ffmpeg.args([
                "-i", &file_path,
                "-f", "null",
                "-t", "1",  // Only validate first second to be fast
                "-"
            ]).output().await {
                Ok(output) => output,
                Err(e) => {
                    return Ok(VideoValidationResult {
                        is_valid: false,
                        error: Some(format!("Failed to run FFmpeg validation: {}", e)),
                        duration: None,
                        width: None,
                        height: None,
                        codec: None,
                        file_size: Some(file_size),
                    });
                }
            }
        }
        Err(e) => {
            return Ok(VideoValidationResult {
                is_valid: false,
                error: Some(format!("Failed to access FFmpeg: {}", e)),
                duration: None,
                width: None,
                height: None,
                codec: None,
                file_size: Some(file_size),
            });
        }
    };

    // Parse FFmpeg output for analysis
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Check if FFmpeg successfully processed the file
    if !output.status.success() {
        let error_msg = if stderr.contains("Invalid data found") {
            "Video file contains invalid data or corruption"
        } else if stderr.contains("moov atom not found") {
            "Video file is incomplete or corrupted - missing movie atom"
        } else if stderr.contains("Invalid argument") {
            "Video file format is not supported"
        } else if stderr.contains("No such file or directory") {
            "Video file not found"
        } else if stderr.contains("Permission denied") {
            "Permission denied accessing video file"
        } else {
            &format!("FFmpeg validation failed: {}", stderr)
        };

        return Ok(VideoValidationResult {
            is_valid: false,
            error: Some(error_msg.to_string()),
            duration: None,
            width: None,
            height: None,
            codec: None,
            file_size: Some(file_size),
        });
    }

    // Check for critical errors even when exit code is 0
    if stderr.contains("Invalid data found") && stderr.contains("corrupt") {
        return Ok(VideoValidationResult {
            is_valid: false,
            error: Some("Video file contains corruption".to_string()),
            duration: None,
            width: None,
            height: None,
            codec: None,
            file_size: Some(file_size),
        });
    }

    // Try to parse video information (optional - don't fail if we can't parse)
    let duration = extract_duration_from_ffmpeg_output(&stderr);
    let video_info = parse_video_info_from_ffmpeg_output(&stderr);

    match video_info {
        Ok(info) => {
            // Check for reasonable video dimensions
            if info.width == 0 || info.height == 0 {
                return Ok(VideoValidationResult {
                    is_valid: false,
                    error: Some("Invalid video dimensions (0x0)".to_string()),
                    duration,
                    width: Some(info.width),
                    height: Some(info.height),
                    codec: Some(info.codec),
                    file_size: Some(file_size),
                });
            }

            // Video is valid with parsed info
            Ok(VideoValidationResult {
                is_valid: true,
                error: None,
                duration,
                width: Some(info.width),
                height: Some(info.height),
                codec: Some(info.codec),
                file_size: Some(file_size),
            })
        }
        Err(_) => {
            // If we can't parse video info but FFmpeg succeeded, consider it valid
            // This can happen for some video formats or with minimal validation
            println!("[Validation] Could not parse detailed video info, but FFmpeg validation passed");
            Ok(VideoValidationResult {
                is_valid: true,
                error: None,
                duration,
                width: None,
                height: None,
                codec: None,
                file_size: Some(file_size),
            })
        }
    }
}


#[tauri::command]
async fn set_clip_generation_in_progress(in_progress: bool) -> Result<(), String> {
    let mut clip_gen = CLIP_GENERATION_IN_PROGRESS.lock().unwrap();
    *clip_gen = in_progress;
    println!("[Rust] Clip generation in progress set to: {}", in_progress);
    Ok(())
}

#[tauri::command]
async fn is_clip_generation_in_progress() -> Result<bool, String> {
    let clip_gen = CLIP_GENERATION_IN_PROGRESS.lock().unwrap();
    Ok(*clip_gen)
}



// Helper function to parse video duration from FFmpeg output

// Waveform peak data structure
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct WaveformPeak {
    min: f64,
    max: f64,
}

// Single resolution level data
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct WaveformResolution {
    peaks: Vec<WaveformPeak>,
    peak_count: u32,
    samples_per_peak: u32,
}

// Multi-resolution waveform data structure
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct WaveformData {
    sample_rate: u32,
    duration: f64,
    resolutions: std::collections::HashMap<String, WaveformResolution>,
}

// Helper function to determine optimal resolution for zoom level
#[allow(dead_code)]
fn get_optimal_resolution(effective_width: f64, duration: f64) -> String {
    // Calculate desired samples per pixel at current zoom
    let samples_per_pixel = (duration * 44100.0) / effective_width;

    // Select resolution based on zoom level
    if samples_per_pixel > 5000.0 {
        "low".to_string()      // 500 peaks - very zoomed out
    } else if samples_per_pixel > 2000.0 {
        "medium".to_string()   // 1000 peaks - zoomed out
    } else if samples_per_pixel > 800.0 {
        "high".to_string()     // 2000 peaks - normal
    } else if samples_per_pixel > 300.0 {
        "ultra".to_string()    // 4000 peaks - zoomed in
    } else {
        "extreme".to_string()  // 8000 peaks - very zoomed in
    }
}

// Database caching functions for waveform data

// Generate a hash for the video path for consistent lookup
fn generate_video_path_hash(video_path: &str) -> String {
    use std::hash::{Hash, Hasher};
    use std::collections::hash_map::DefaultHasher;

    let mut hasher = DefaultHasher::new();
    video_path.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

// Extract local file path from video URL
fn extract_local_path_from_url(video_url: &str) -> Result<String, String> {
    // Handle localhost video URLs
    if video_url.starts_with("http://localhost:48276/video/") {
        let encoded_path = video_url.strip_prefix("http://localhost:48276/video/")
            .ok_or("Invalid video URL format")?;

        // The path is base64 encoded, decode it
        use base64::{Engine as _, engine::general_purpose};
        let decoded_bytes = general_purpose::STANDARD.decode(encoded_path)
            .map_err(|e| format!("Failed to decode base64 video path: {}", e))?;

        let decoded_path = String::from_utf8(decoded_bytes)
            .map_err(|e| format!("Failed to convert decoded path to string: {}", e))?;

        Ok(decoded_path)
    } else if video_url.starts_with("http://") {
        // For other HTTP URLs, we can't get file metadata
        Err("Cannot get file metadata for remote URLs".to_string())
    } else {
        // Assume it's already a local path
        Ok(video_url.to_string())
    }
}

// Get file metadata for cache validation
fn get_video_file_metadata(video_path: &str) -> Result<(u64, u64), String> {
    // Extract local file path if it's a URL
    let local_path = extract_local_path_from_url(video_path)?;

    let metadata = std::fs::metadata(&local_path)
        .map_err(|e| format!("Failed to get video file metadata for {}: {}", local_path, e))?;

    let file_size = metadata.len();
    let modified_time = metadata.modified()
        .map_err(|e| format!("Failed to get file modification time: {}", e))?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to convert modification time: {}", e))?
        .as_secs();

    Ok((file_size, modified_time))
}

// Get cache file path for waveform data
fn get_waveform_cache_file_path(video_path_hash: &str) -> Result<std::path::PathBuf, String> {

    let paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    Ok(paths.temp.join(format!("waveform_cache_{}.json", video_path_hash)))
}

// Save waveform data to file cache
async fn save_waveform_to_file_cache(video_path_hash: &str, waveform_data: &WaveformData) -> Result<(), String> {
    use std::fs::File;
    use std::io::Write;

    let cache_file_path = get_waveform_cache_file_path(video_path_hash)?;

    let json_data = serde_json::to_string(waveform_data)
        .map_err(|e| format!("Failed to serialize waveform data: {}", e))?;

    let mut file = File::create(&cache_file_path)
        .map_err(|e| format!("Failed to create cache file: {}", e))?;

    file.write_all(json_data.as_bytes())
        .map_err(|e| format!("Failed to write cache file: {}", e))?;

    println!("[Rust] Waveform cached to file: {:?}", cache_file_path);
    Ok(())
}

// Load waveform data from file cache
async fn load_waveform_from_file_cache(video_path_hash: &str) -> Result<Option<WaveformData>, String> {
    use std::fs::File;
    use std::io::Read;

    let cache_file_path = get_waveform_cache_file_path(video_path_hash)?;

    if !cache_file_path.exists() {
        return Ok(None);
    }

    let mut file = File::open(&cache_file_path)
        .map_err(|e| format!("Failed to open cache file: {}", e))?;

    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read cache file: {}", e))?;

    let waveform_data: WaveformData = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to deserialize waveform data: {}", e))?;

    println!("[Rust] Waveform loaded from cache: {:?}", cache_file_path);
    Ok(Some(waveform_data))
}

#[tauri::command]
async fn get_cached_waveform(
    video_path: String,
) -> Result<Option<WaveformData>, String> {
    println!("[Rust] Checking for cached waveform for: {}", video_path);

    // Generate hash for video path
    let video_path_hash = generate_video_path_hash(&video_path);

    // Try to load from file cache
    match load_waveform_from_file_cache(&video_path_hash).await {
        Ok(Some(waveform_data)) => {
            println!("[Rust] Found cached waveform, returning it");
            return Ok(Some(waveform_data));
        }
        Ok(None) => {
            println!("[Rust] No cached waveform found in file cache");
        }
        Err(e) => {
            println!("[Rust] Error checking file cache: {}, proceeding with generation", e);
        }
    }

    Ok(None)
}

#[tauri::command]
async fn save_waveform_to_cache(
    video_path: String,
    _raw_video_id: String,
    waveform_data: WaveformData,
) -> Result<(), String> {
    println!("[Rust] Saving waveform data to cache for: {}", video_path);

    // Generate hash
    let video_path_hash = generate_video_path_hash(&video_path);
    let (file_size, _modified_time) = get_video_file_metadata(&video_path)?;

    println!("[Rust] Waveform data being saved:");
    println!("[Rust]   Hash: {}", video_path_hash);
    println!("[Rust]   File size: {}", file_size);
    println!("[Rust]   Resolution count: {}", waveform_data.resolutions.len());

    // Save to file cache
    save_waveform_to_file_cache(&video_path_hash, &waveform_data).await
}

#[tauri::command]
async fn extract_audio_waveform(
    app: tauri::AppHandle,
    video_path: String,
    target_samples: Option<u32>
) -> Result<WaveformData, String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] extract_audio_waveform called with:");
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   target_samples: {:?}", target_samples);

    // Check cache first
    match get_cached_waveform(video_path.clone()).await {
        Ok(Some(cached_waveform)) => {
            println!("[Rust] Returning cached waveform data");
            return Ok(cached_waveform);
        }
        Ok(None) => {
            println!("[Rust] No cached waveform found, proceeding with generation");
        }
        Err(e) => {
            println!("[Rust] Error checking cache: {}, proceeding with generation", e);
        }
    }

    // Define multiple resolution levels for adaptive rendering
    let resolution_levels = vec![
        ("low", 500),      // 500 peaks - very zoomed out
        ("medium", 1000),  // 1000 peaks - zoomed out
        ("high", 2000),    // 2000 peaks - normal view
        ("ultra", 4000),   // 4000 peaks - zoomed in
        ("extreme", 8000), // 8000 peaks - very zoomed in
    ];

    // Get storage paths for temporary files
    let paths = storage::init_storage_dirs()
        .map_err(|e| {
            println!("[Rust] Failed to get storage paths: {}", e);
            format!("Failed to get storage paths: {}", e)
        })?;

    // Create unique temporary audio file
    let temp_audio_path = paths.videos.join(format!("temp_waveform_{}.wav",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| format!("Failed to get timestamp: {}", e))?
            .as_secs()
    ));

    println!("[Rust] Temporary audio path: {}", temp_audio_path.display());

    let shell = app.shell();

    // First, get video duration using FFmpeg
    println!("[Rust] Getting video duration...");
    let duration_output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", &video_path,
            "-f", "null",
            "-"
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg for duration: {}", e))?;

    // Parse duration from FFmpeg output
    let stderr = String::from_utf8_lossy(&duration_output.stderr);
    let video_duration = parse_duration_from_ffmpeg_output(&stderr)
        .map_err(|e| format!("Failed to parse video duration: {}", e))?;

    println!("[Rust] Video duration: {:.2} seconds", video_duration);

    if video_duration <= 0.0 {
        return Err("Invalid video duration".to_string());
    }

    // Extract audio as WAV for processing (16-bit PCM, mono)
    println!("[Rust] Extracting audio as WAV...");
    let extract_output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", &video_path,
            "-vn",                    // No video
            "-acodec", "pcm_s16le",   // 16-bit PCM
            "-ar", "44100",           // 44.1kHz sample rate
            "-ac", "1",               // Mono
            "-y",                     // Overwrite output
            temp_audio_path.to_str().ok_or("Invalid temporary audio path")?,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to extract audio: {}", e))?;

    if !extract_output.status.success() {
        let stderr = String::from_utf8_lossy(&extract_output.stderr);
        return Err(format!("FFmpeg audio extraction failed: {}", stderr));
    }

    println!("[Rust] Audio extracted successfully");

    // Process the WAV file to extract multi-resolution waveform data
    let waveform_data = process_wav_file_multi_resolution(&temp_audio_path, &resolution_levels, video_duration)
        .map_err(|e| format!("Failed to process WAV file: {}", e))?;

    // Clean up temporary file
    if let Err(e) = std::fs::remove_file(&temp_audio_path) {
        eprintln!("[Rust] Warning: Failed to remove temporary audio file {}: {}", temp_audio_path.display(), e);
    } else {
        println!("[Rust] Cleaned up temporary audio file");
    }

    let total_peaks: u32 = waveform_data.resolutions.values()
        .map(|r| r.peak_count)
        .sum();
    println!("[Rust] Multi-resolution waveform extraction completed. Generated {} peaks across {} resolution levels.",
             total_peaks, waveform_data.resolutions.len());

    // Save to cache for future use
    let raw_video_id = format!("waveform_{}", generate_video_path_hash(&video_path));
    if let Err(e) = save_waveform_to_cache(video_path.clone(), raw_video_id, waveform_data.clone()).await {
        eprintln!("[Rust] Warning: Failed to cache waveform data: {}", e);
    }

    Ok(waveform_data)
}

// Process WAV file to extract multi-resolution waveform peaks
fn process_wav_file_multi_resolution(
    wav_path: &std::path::Path,
    resolution_levels: &[(&str, u32)],
    duration: f64
) -> Result<WaveformData, String> {
    use std::fs::File;
    use std::io::Read;

    println!("[Rust] Processing WAV file for multi-resolution: {}", wav_path.display());

    // Open and read WAV file
    let mut file = File::open(wav_path)
        .map_err(|e| format!("Failed to open WAV file: {}", e))?;

    // Read WAV header (44 bytes for standard WAV)
    let mut header = [0u8; 44];
    file.read_exact(&mut header)
        .map_err(|e| format!("Failed to read WAV header: {}", e))?;

    // Verify WAV format
    if &header[0..4] != b"RIFF" || &header[8..12] != b"WAVE" {
        return Err("Invalid WAV file format".to_string());
    }

    // Get sample rate from header (bytes 24-27)
    let sample_rate = u32::from_le_bytes([header[24], header[25], header[26], header[27]]);
    println!("[Rust] Sample rate: {} Hz", sample_rate);

    // Skip to audio data
    let mut data_pos = 12; // After RIFF header
    while data_pos < header.len() - 8 {
        if &header[data_pos..data_pos + 4] == b"data" {
            // Found data chunk, break without using data_pos since we read from current position
            break;
        }
        data_pos += 8;
    }

    // Read remaining file as audio data
    let mut audio_data = Vec::new();
    file.read_to_end(&mut audio_data)
        .map_err(|e| format!("Failed to read audio data: {}", e))?;

    println!("[Rust] Read {} bytes of audio data", audio_data.len());

    // Convert bytes to 16-bit samples (little-endian)
    let mut samples = Vec::new();
    for chunk in audio_data.chunks_exact(2) {
        if chunk.len() == 2 {
            let sample = i16::from_le_bytes([chunk[0], chunk[1]]) as f64 / i16::MAX as f64;
            samples.push(sample);
        }
    }

    println!("[Rust] Converted to {} audio samples", samples.len());

    if samples.is_empty() {
        return Err("No audio samples found".to_string());
    }

    // Generate multi-resolution peaks
    let mut resolutions = std::collections::HashMap::new();

    for &(level_name, target_peaks) in resolution_levels {
        println!("[Rust] Generating {} resolution with {} peaks", level_name, target_peaks);

        let samples_per_peak = (samples.len() as f64 / target_peaks as f64).ceil() as usize;
        let mut peaks = Vec::new();

        for i in 0..target_peaks {
            let start_idx = (i as usize * samples_per_peak).min(samples.len());
            let end_idx = ((i as usize + 1) * samples_per_peak).min(samples.len());

            if start_idx >= samples.len() {
                break;
            }

            let mut min = 0.0;
            let mut max = 0.0;

            // Find min and max in this chunk
            for &sample in &samples[start_idx..end_idx] {
                if sample < min { min = sample; }
                if sample > max { max = sample; }
            }

            peaks.push(WaveformPeak { min, max });
        }

        let resolution = WaveformResolution {
            peak_count: peaks.len() as u32,
            samples_per_peak: samples_per_peak as u32,
            peaks: peaks.clone(),
        };

        resolutions.insert(level_name.to_string(), resolution);
        println!("[Rust] Generated {} peaks for {} resolution", peaks.len(), level_name);
    }

    println!("[Rust] Multi-resolution waveform generation completed");

    Ok(WaveformData {
        sample_rate,
        duration,
        resolutions,
    })
}







#[tauri::command]
async fn get_pumpfun_clips(mint_id: String, limit: Option<u32>) -> Result<String, String> {
    use std::process::Command;
    
    let limit_str = limit.unwrap_or(20).to_string();
    
    // Get the path to the Node.js service
    // In dev mode, the script is in src-tauri/pumpfun-service/
    // In production, it should be bundled with the app
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;

    let exe_dir = exe_path
        .parent()
        .ok_or("Failed to get parent directory")?;

    // In development mode (tauri dev), the exe is in target/debug/
    // and we need to go up two levels to reach src-tauri/
    let dev_script_path = exe_dir
        .parent()  // Go from target/debug/ to target/
        .and_then(|p| p.parent())  // Go from target/ to src-tauri/
        .map(|p| p.join("pumpfun-service").join("fetch-clips.mjs"));

    // Try the current directory approach (for when running from src-tauri/)
    let current_dir_path = exe_dir
        .join("pumpfun-service")
        .join("fetch-clips.mjs");

    // Production path (bundled with app)
    let prod_script_path = exe_dir.join("pumpfun-service").join("fetch-clips.mjs");

    let script_path = if let Some(ref path) = dev_script_path {
        if path.exists() {
            path
        } else if current_dir_path.exists() {
            &current_dir_path
        } else {
            &prod_script_path
        }
    } else if current_dir_path.exists() {
        &current_dir_path
    } else {
        &prod_script_path
    };
    
    // Execute the Node.js script
    let output = Command::new("node")
        .arg(script_path)
        .arg(&mint_id)
        .arg(&limit_str)
        .output()
        .map_err(|e| format!("Failed to execute Node.js script: {}. Make sure Node.js is installed.", e))?;
    
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("PumpFun API error: {}", stderr))
    }
}


// Payment callback server function moved to auth.rs module

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("[Rust] Starting Tauri application");
    println!("[Rust] Registering SQL plugin...");
    
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:clippster_v21.db",
                    vec![
                        tauri_plugin_sql::Migration {
                            version: 1,
                            description: "initial_schema",
                            sql: include_str!("../migrations/001_initial_schema.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 2,
                            description: "add_raw_video_path",
                            sql: include_str!("../migrations/002_add_raw_video_path.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 3,
                            description: "add_raw_videos_table",
                            sql: include_str!("../migrations/003_add_raw_videos_table.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 4,
                            description: "transcripts_reference_raw_videos",
                            sql: include_str!("../migrations/004_transcripts_reference_raw_videos.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 5,
                            description: "make_project_id_nullable",
                            sql: include_str!("../migrations/005_make_project_id_nullable.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 6,
                            description: "add_original_filename",
                            sql: include_str!("../migrations/006_add_original_filename.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 7,
                            description: "add_thumbnail_path",
                            sql: include_str!("../migrations/007_add_thumbnail_path.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 8,
                            description: "remove_raw_video_path_field",
                            sql: include_str!("../migrations/008_remove_raw_video_path_field.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 9,
                            description: "add_audio_files_table",
                            sql: include_str!("../migrations/009_add_audio_files_table.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 10,
                            description: "add_clip_versioning",
                            sql: include_str!("../migrations/010_add_clip_versioning_fixed.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 11,
                            description: "add_project_thumbnail",
                            sql: include_str!("../migrations/013_add_project_thumbnail.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 12,
                            description: "add_original_project_field",
                            sql: include_str!("../migrations/012_add_original_project_field.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 13,
                            description: "add_clip_segments",
                            sql: include_str!("../migrations/014_add_clip_segments.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 15,
                            description: "add_clip_status",
                            sql: include_str!("../migrations/015_add_clip_status.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 16,
                            description: "add_run_color_to_clip_detection_sessions",
                            sql: include_str!("../migrations/016_add_run_color_to_clip_detection_sessions.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 17,
                            description: "add_waveform_data",
                            sql: include_str!("../migrations/017_add_waveform_data.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 18,
                            description: "drop_waveform_data",
                            sql: include_str!("../migrations/018_drop_waveform_data.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 20,
                            description: "simple_cascade_fix",
                            sql: include_str!("../migrations/020_simple_cascade_fix.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 21,
                            description: "add_chunked_transcripts",
                            sql: include_str!("../migrations/021_add_chunked_transcripts.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 22,
                            description: "add_segment_tracking",
                            sql: include_str!("../migrations/022_add_segment_tracking.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 23,
                            description: "add_intro_outro_thumbnails",
                            sql: include_str!("../migrations/023_add_intro_outro_thumbnails.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 24,
                            description: "add_intro_outro_thumbnail_status",
                            sql: include_str!("../migrations/024_add_intro_outro_thumbnail_status.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 25,
                            description: "add_waveform_caching",
                            sql: include_str!("../migrations/025_add_waveform_caching.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 26,
                            description: "add_clip_build_fields",
                            sql: include_str!("../migrations/026_add_clip_build_fields.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                          ],
                )
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            println!("[Rust] Application setup complete");
            println!("[Rust] SQL plugin should be registered");

            // Initialize storage directories
            if let Err(e) = storage::init_storage_dirs() {
                eprintln!("[Rust] Warning: Failed to initialize storage directories: {}", e);
            }

            // Start video streaming server in Tauri's async runtime
            let _app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                video_server::start_video_server_impl().await;
            });

            // Setup window close handler
            let app_handle = app.handle().clone();
            let window = app.get_webview_window("main").unwrap();

            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    println!("[Rust] Window close requested");

                    // Check if there are active downloads
                    let active_count = {
                        let downloads = ACTIVE_DOWNLOADS.lock().unwrap();
                        downloads.len()
                    };

                    // Check if clip generation is in progress
                    let clip_gen_in_progress = {
                        let clip_gen = CLIP_GENERATION_IN_PROGRESS.lock().unwrap();
                        *clip_gen
                    };

                    // Show dialog if there are active downloads OR clip generation in progress
                    if active_count > 0 || clip_gen_in_progress {
                        println!(
                            "[Rust] Operations in progress - Downloads: {}, Clip Generation: {}",
                            active_count, clip_gen_in_progress
                        );

                        // Prevent the window from closing immediately
                        api.prevent_close();

                        // Emit event to frontend to show confirmation dialog
                        let _ = app_handle.emit("window-close-requested", active_count);
                    } else {
                        println!("[Rust] No active operations, allowing close");
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            auth::open_wallet_auth_window,
            auth::open_wallet_payment_window,
            auth::close_auth_window,
            auth::poll_auth_result,
            auth::poll_payment_result,
            get_video_server_port,
            get_pumpfun_clips,
            test_download_command,
            downloads::download_pumpfun_vod,
            downloads::download_pumpfun_vod_segment,
            get_active_downloads_count,
            cancel_all_downloads,
            cancel_download,
            cleanup_completed_download,
            check_file_exists,
            validate_video_file,
            set_clip_generation_in_progress,
            is_clip_generation_in_progress,
            audio::extract_audio_from_video,
            audio::extract_and_chunk_audio,
            extract_audio_waveform,
            get_cached_waveform,
            save_waveform_to_cache,
            storage::get_storage_paths,
            storage::copy_video_to_storage,
            storage::copy_asset_to_storage,
            storage::delete_asset_file,
            assets::upload_asset_async,
            storage::generate_thumbnail,
            storage::save_temp_file,
            storage::read_file_as_data_url,
            storage::delete_video_file,
            storage::get_video_duration,
            clips::build_clip_from_segments,
            clips::cancel_clip_build,
            clips::is_clip_build_active,
            ui_utils::setup_macos_titlebar,
            ui_utils::get_platform,
            ui_utils::show_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}



