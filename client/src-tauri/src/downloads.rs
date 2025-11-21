use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::Emitter;
use once_cell::sync::Lazy;

use crate::ffmpeg_utils::{
    parse_ffmpeg_time, get_video_info, extract_duration_from_ffmpeg_output
};
use crate::storage;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DownloadProgress {
    pub download_id: String,
    pub progress: f64,
    pub current_time: Option<f64>,
    pub total_time: Option<f64>,
    pub status: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DownloadResult {
    pub download_id: String,
    pub success: bool,
    pub file_path: Option<String>,
    pub thumbnail_path: Option<String>,
    pub duration: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub codec: Option<String>,
    pub file_size: Option<u64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DownloadMetadata {
    pub output_path: Option<String>,
    pub thumbnail_path: Option<String>,
    #[allow(dead_code)]
    pub started_at: std::time::SystemTime,
    #[allow(dead_code)]
    pub process_id: Option<u32>,
}

use tauri_plugin_shell::process::CommandChild;

pub static ACTIVE_DOWNLOADS: Lazy<Arc<Mutex<HashMap<String, bool>>>> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));
pub static ACTIVE_FFMPEG_PROCESSES: Lazy<Arc<Mutex<HashMap<String, CommandChild>>>> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));
pub static DOWNLOAD_METADATA: Lazy<Arc<Mutex<HashMap<String, DownloadMetadata>>>> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Helper function to format time for filename
fn format_time_for_filename(seconds: f64) -> String {
    let h = (seconds / 3600.0) as u32;
    let m = ((seconds % 3600.0) / 60.0) as u32;
    let s = (seconds % 60.0) as u32;
    format!("{:02}{:02}{:02}", h, m, s)
}

#[tauri::command]
pub async fn download_pumpfun_vod_segment(
    app: tauri::AppHandle,
    download_id: String,
    title: String,
    video_url: String,
    mint_id: String,
    start_time: f64,
    end_time: f64
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] download_pumpfun_vod_segment called with:");
    println!("[Rust]   download_id: {}", download_id);
    println!("[Rust]   title: {}", title);
    println!("[Rust]   video_url: {}", video_url);
    println!("[Rust]   mint_id: {}", mint_id);
    println!("[Rust]   start_time: {}", start_time);
    println!("[Rust]   end_time: {}", end_time);

    // Validate time range
    if start_time < 0.0 || end_time <= start_time {
        return Err("Invalid time range specified".to_string());
    }

    let segment_duration = end_time - start_time;
    if segment_duration < 10.0 {
        return Err("Segment too short (minimum 10 seconds)".to_string());
    }

    // Check if download already exists
    {
        let mut downloads = ACTIVE_DOWNLOADS.lock().unwrap();
        if downloads.contains_key(&download_id) {
            println!("[Rust] Download already in progress: {}", download_id);
            return Err("Download already in progress".to_string());
        }
        downloads.insert(download_id.clone(), true);
        println!("[Rust] Download registered: {}", download_id);
    }

    // Clean up when done
    let cleanup_download = {
        let download_id = download_id.clone();
        let downloads = ACTIVE_DOWNLOADS.clone();
        move || {
            println!("[Rust] Cleaning up download: {}", download_id);
            let mut downloads = downloads.lock().unwrap();
            downloads.remove(&download_id);
        }
    };

    // Get storage paths
    println!("[Rust] Getting storage paths...");
    let paths = storage::init_storage_dirs()
        .map_err(|e| {
            println!("[Rust] Failed to get storage paths: {}", e);
            format!("Failed to get storage paths: {}", e)
        })?;

    println!("[Rust] Storage paths retrieved. Videos dir: {}", paths.videos.display());

    // Generate filename with segment info
    let safe_title = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    let mint_prefix = if mint_id.len() >= 8 { &mint_id[..8] } else { &mint_id };

    // Format times for filename (start-end)
    let start_formatted = format_time_for_filename(start_time);
    let end_formatted = format_time_for_filename(end_time);

    let filename = format!("pumpfun_{}_{}_{}_{}_{}.mp4",
        mint_prefix, safe_title, start_formatted, end_formatted, timestamp);
    let video_path = paths.videos.join(&filename);

    println!("[Rust] Generated filename: {}", filename);
    println!("[Rust] Full video path: {}", video_path.display());

    // Store download metadata for cleanup
    {
        let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
        metadata_map.insert(download_id.clone(), DownloadMetadata {
            output_path: Some(video_path.to_string_lossy().to_string()),
            thumbnail_path: None, // We'll set this when/if it's generated
            started_at: std::time::SystemTime::now(),
            process_id: None,
        });
    }

    // Send initial progress
    println!("[Rust] Sending initial progress event...");
    let progress_result = app.emit("download-progress", DownloadProgress {
        download_id: download_id.clone(),
        progress: 0.0,
        current_time: Some(0.0),
        total_time: Some(segment_duration),
        status: "Starting segment download...".to_string(),
    });

    if let Err(e) = progress_result {
        println!("[Rust] Failed to emit initial progress: {}", e);
    } else {
        println!("[Rust] Initial progress sent successfully");
    }

    // Clone app handle for use in async block
    let app_clone = app.clone();
    let download_id_clone = download_id.clone();
    println!("[Rust] Starting async segment download task...");

    let result = tokio::spawn(async move {
        println!("[Rust] Async task started for segment download: {}", download_id_clone);

        let shell = app_clone.shell();
        println!("[Rust] Shell created successfully");

        // Download the video segment with real-time progress tracking
        println!("[Rust] Starting video segment download with real-time progress...");
        println!("[Rust] Efficient segment download: start_time={}, duration={}s", start_time, segment_duration);
        let app_clone_for_progress = app_clone.clone();
        let download_id_for_progress = download_id_clone.clone();
        let total_segment_duration = segment_duration;

        // Use FFmpeg to extract and download the segment efficiently
        // For HLS streams, we need additional flags for efficient seeking
        println!("[Rust] Spawning FFmpeg sidecar for segment with real-time progress...");

        let cmd = shell.sidecar("ffmpeg").map_err(|e| format!("Failed to create ffmpeg sidecar: {}", e))?;
        let (mut rx, child) = cmd.args([
            "-ss", &format!("{:.3}", start_time),  // Seek before input (efficient)
            "-i", &video_url,
            "-t", &format!("{:.3}", segment_duration),  // Duration
            "-c:v", "copy",  // Copy video stream
            "-c:a", "aac",   // Convert audio to AAC
            "-b:a", "128k",  // Audio bitrate
            "-avoid_negative_ts", "make_zero",  // Fix timestamp issues for segments
            "-movflags", "+faststart",
            "-progress", "pipe:2",
            "-v", "error",
            "-y",
            video_path.to_str().ok_or("Invalid video path")?,
        ]).spawn().map_err(|e| format!("Failed to spawn ffmpeg sidecar: {}", e))?;

        // Store process handle for cancellation
        {
            let mut processes = ACTIVE_FFMPEG_PROCESSES.lock().unwrap();
            processes.insert(download_id_clone.clone(), child);
        }

        let result = tokio::spawn(async move {
            let total_duration = total_segment_duration;
            let app_progress = app_clone_for_progress.clone();
            let download_id_progress = download_id_for_progress.clone();

            let mut line_buffer = String::new();
            let mut last_progress_time = std::time::Instant::now();
            let mut lines_processed = 0;
            let mut success = false;

            while let Some(event) = rx.recv().await {
                match event {
                    tauri_plugin_shell::process::CommandEvent::Stderr(data) => {
                        let chunk = String::from_utf8_lossy(&data);
                        line_buffer.push_str(&chunk);

                        while let Some(newline_pos) = line_buffer.find('\n') {
                            let line = line_buffer[..newline_pos].trim().to_string();
                            line_buffer.drain(..=newline_pos);

                            if line.is_empty() { continue; }

                            lines_processed += 1;
                            if lines_processed % 50 == 0 {
                                println!("[Rust] Processed {} lines from FFmpeg stderr for segment", lines_processed);
                            }

                            // Look for out_time= lines (current time in HH:MM:SS.ms format)
                            if line.starts_with("out_time=") {
                                if let Some(time_str) = line.strip_prefix("out_time=") {
                                    println!("[Rust] Found segment progress line: out_time={}", time_str);
                                    if let Some(current_time) = parse_ffmpeg_time(time_str) {
                                        // For segment downloads, calculate progress relative to segment duration
                                        let progress = ((current_time / total_duration) * 100.0).min(95.0);
                                        println!("[Rust] Segment progress: {:.1}% ({}s / {}s)", progress, current_time, total_duration);

                                        // Only emit progress if it's been at least 1 second since last update
                                        if last_progress_time.elapsed().as_secs() >= 1 {
                                            let progress_result = app_progress.emit("download-progress", DownloadProgress {
                                                download_id: download_id_progress.clone(),
                                                progress,
                                                current_time: Some(current_time),
                                                total_time: Some(total_duration),
                                                status: "Downloading segment...".to_string(),
                                            });

                                            if let Err(e) = progress_result {
                                                println!("[Rust] Failed to emit segment progress: {}", e);
                                            }
                                            last_progress_time = std::time::Instant::now();
                                        }
                                    } else {
                                        println!("[Rust] Failed to parse time from: {}", time_str);
                                    }
                                }
                            }
                        }
                    }
                    tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                        if let Some(code) = payload.code {
                            if code == 0 {
                                println!("[Rust] FFmpeg segment download completed successfully");
                                success = true;
                            } else {
                                println!("[Rust] FFmpeg segment download failed with status: {}", code);
                            }
                        }
                    }
                    _ => {}
                }
            }

            if success {
                Ok(())
            } else {
                Err("FFmpeg segment download failed".to_string())
            }
        }).await;

        match result {
            Ok(inner_result) => {
                match inner_result {
                    Ok(()) => {
                        // Segment download completed successfully
                    }
                    Err(e) => {
                        return Err(e);
                    }
                }
            }
            Err(e) => {
                return Err(format!("Task join error for segment: {}", e));
            }
        }

        println!("[Rust] Segment download completed successfully");

        // Get file metadata
        let metadata = match std::fs::metadata(&video_path) {
            Ok(meta) => {
                println!("[Rust] Segment file metadata obtained, size: {} bytes", meta.len());
                meta
            }
            Err(e) => {
                println!("[Rust] Failed to get segment file metadata: {}", e);
                return Err(format!("Failed to get segment file metadata: {}", e));
            }
        };
        let file_size = metadata.len();

        // Generate thumbnail for segment
        println!("[Rust] Generating thumbnail for segment...");
        let thumbnail_path = paths.thumbnails.join(format!("{}_thumb.jpg", filename.replace(".mp4", "")));
        let thumbnail_result = match shell.sidecar("ffmpeg") {
            Ok(ffmpeg) => {
                match ffmpeg.args([
                    "-i", video_path.to_str().ok_or("Invalid video path")?,
                    "-ss", "00:00:01",  // Use 1 second into the segment (same as regular download)
                    "-vframes", "1",
                    "-vf", "scale=320:-1",
                    "-y",
                    thumbnail_path.to_str().ok_or("Invalid thumbnail path")?,
                ]).output().await {
                    Ok(output) => {
                        println!("[Rust] Segment thumbnail generation completed, success: {}", output.status.success());
                        Some(output)
                    }
                    Err(e) => {
                        println!("[Rust] Failed to generate segment thumbnail: {}", e);
                        None
                    }
                }
            }
            Err(e) => {
                println!("[Rust] Failed to get ffmpeg for segment thumbnail: {}", e);
                None
            }
        };

        let thumbnail_path_str = if let Some(ref result) = thumbnail_result {
            if result.status.success() {
                println!("[Rust] Segment thumbnail saved to: {}", thumbnail_path.display());
                Some(thumbnail_path.to_string_lossy().to_string())
            } else {
                println!("[Rust] Segment thumbnail generation failed");
                None
            }
        } else {
            println!("[Rust] No segment thumbnail result");
            None
        };

        // Get video dimensions and codec info
        println!("[Rust] Getting detailed segment video info...");
        let video_info = get_video_info(&app_clone, &video_path).await.ok();
        let (width, height, codec) = if let Some(ref info) = video_info {
            println!("[Rust] Segment video info - width: {}, height: {}, codec: {}", info.width, info.height, info.codec);
            (Some(info.width), Some(info.height), Some(info.codec.clone()))
        } else {
            println!("[Rust] Could not get detailed segment video info");
            (None, None, None)
        };

        println!("[Rust] Segment download task completed successfully");
        Ok(DownloadResult {
            download_id: download_id_clone,
            success: true,
            file_path: Some(video_path.to_string_lossy().to_string()),
            thumbnail_path: thumbnail_path_str,
            duration: Some(segment_duration),
            width,
            height,
            codec,
            file_size: Some(file_size),
            error: None,
        })
    }).await;

    println!("[Rust] Async segment download task completed");

    cleanup_download();

    println!("[Rust] Processing segment download result...");
    match result {
        Ok(Ok(download_result)) => {
            println!("[Rust] Segment download successful! File: {:?}", download_result.file_path);

            // Send final progress
            println!("[Rust] Sending segment completion progress (100%)");
            let progress_result = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 100.0,
                current_time: None,
                total_time: None,
                status: "Segment download completed!".to_string(),
            });

            if let Err(e) = progress_result {
                println!("[Rust] Failed to send segment completion progress: {}", e);
            }

            // Send completion event
            println!("[Rust] Sending segment completion event...");
            let completion_result = app.emit("download-complete", download_result);
            if let Err(e) = completion_result {
                println!("[Rust] Failed to send segment completion event: {}", e);
            } else {
                println!("[Rust] Segment completion event sent successfully");
            }

            Ok(())
        }
        Ok(Err(e)) => {
            let error_msg = format!("Segment download failed: {}", e);
            println!("[Rust] Segment download failed: {}", error_msg);

            // Send error progress
            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 0.0,
                current_time: None,
                total_time: None,
                status: error_msg.clone(),
            });

            // Send error event
            let _ = app.emit("download-complete", DownloadResult {
                download_id,
                success: false,
                file_path: None,
                thumbnail_path: None,
                duration: None,
                width: None,
                height: None,
                codec: None,
                file_size: None,
                error: Some(error_msg),
            });

            Err(e)
        }
        Err(e) => {
            let error_msg = format!("Segment download task failed: {}", e);
            println!("[Rust] Segment download task failed: {}", error_msg);

            // Send error progress
            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 0.0,
                current_time: None,
                total_time: None,
                status: error_msg.clone(),
            });

            // Send error event
            let _ = app.emit("download-complete", DownloadResult {
                download_id,
                success: false,
                file_path: None,
                thumbnail_path: None,
                duration: None,
                width: None,
                height: None,
                codec: None,
                file_size: None,
                error: Some(error_msg),
            });

            Err(format!("Segment download task failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn download_pumpfun_vod(
    app: tauri::AppHandle,
    download_id: String,
    title: String,
    video_url: String,
    mint_id: String
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] download_pumpfun_vod called with:");
    println!("[Rust]   download_id: {}", download_id);
    println!("[Rust]   title: {}", title);
    println!("[Rust]   video_url: {}", video_url);
    println!("[Rust]   mint_id: {}", mint_id);

    // Check if download already exists
    {
        let mut downloads = ACTIVE_DOWNLOADS.lock().unwrap();
        if downloads.contains_key(&download_id) {
            println!("[Rust] Download already in progress: {}", download_id);
            return Err("Download already in progress".to_string());
        }
        downloads.insert(download_id.clone(), true);
        println!("[Rust] Download registered: {}", download_id);
    }

    // Clean up when done
    let cleanup_download = {
        let download_id = download_id.clone();
        let downloads = ACTIVE_DOWNLOADS.clone();
        move || {
            println!("[Rust] Cleaning up download: {}", download_id);
            let mut downloads = downloads.lock().unwrap();
            downloads.remove(&download_id);
        }
    };

    // Get storage paths
    println!("[Rust] Getting storage paths...");
    let paths = storage::init_storage_dirs()
        .map_err(|e| {
            println!("[Rust] Failed to get storage paths: {}", e);
            format!("Failed to get storage paths: {}", e)
        })?;

    println!("[Rust] Storage paths retrieved. Videos dir: {}", paths.videos.display());

    // Generate filename
    let safe_title = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    let mint_prefix = if mint_id.len() >= 8 { &mint_id[..8] } else { &mint_id };
    let filename = format!("pumpfun_{}_{}_{}.mp4", mint_prefix, safe_title, timestamp);
    let video_path = paths.videos.join(&filename);

    println!("[Rust] Generated filename: {}", filename);
    println!("[Rust] Full video path: {}", video_path.display());

    // Store download metadata for cleanup
    {
        let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
        metadata_map.insert(download_id.clone(), DownloadMetadata {
            output_path: Some(video_path.to_string_lossy().to_string()),
            thumbnail_path: None, // We'll set this when/if it's generated
            started_at: std::time::SystemTime::now(),
            process_id: None,
        });
    }

    // Send initial progress
    println!("[Rust] Sending initial progress event...");
    let progress_result = app.emit("download-progress", DownloadProgress {
        download_id: download_id.clone(),
        progress: 0.0,
        current_time: None,
        total_time: None,
        status: "Starting download...".to_string(),
    });

    if let Err(e) = progress_result {
        println!("[Rust] Failed to emit initial progress: {}", e);
    } else {
        println!("[Rust] Initial progress sent successfully");
    }

    // Clone app handle for use in async block
    let app_clone = app.clone();
    let download_id_clone = download_id.clone();
    println!("[Rust] Starting async download task...");

    let result = tokio::spawn(async move {
        println!("[Rust] Async task started for download: {}", download_id_clone);

        let shell = app_clone.shell();
        println!("[Rust] Shell created successfully");

        // Skip hardcoded progress steps - let real-time download progress handle everything

        // First, get video info to get duration
        println!("[Rust] Running ffmpeg to get video info for URL: {}", video_url);
        let info_output = match shell.sidecar("ffmpeg") {
            Ok(ffmpeg) => {
                println!("[Rust] FFmpeg sidecar obtained, running info command...");
                match ffmpeg.args([
                    "-i", &video_url,
                    "-f", "null",
                    "-t", "1",  // Only read first second to get metadata quickly
                    "-"
                ]).output().await {
                    Ok(output) => {
                        println!("[Rust] FFmpeg info command completed");
                        output
                    }
                    Err(e) => {
                        println!("[Rust] Failed to run ffmpeg info command: {}", e);
                        return Err(format!("Failed to run ffmpeg info: {}", e));
                    }
                }
            }
            Err(e) => {
                println!("[Rust] Failed to get ffmpeg sidecar: {}", e);
                return Err(format!("Failed to get ffmpeg sidecar: {}", e));
            }
        };

        // Extract duration from stderr
        let stderr = String::from_utf8_lossy(&info_output.stderr);
        let duration = extract_duration_from_ffmpeg_output(&stderr);
        println!("[Rust] Video duration extracted: {:?}", duration);

        // Download will start immediately with real-time progress

        // Now download the video with real-time progress tracking
        println!("[Rust] Starting video download with real-time progress...");
        let app_clone_for_progress = app_clone.clone();
        let download_id_for_progress = download_id_clone.clone();
        let duration_for_progress = duration;

        // Don't set initial progress here - let real-time progress calculation handle it
        // This prevents the progress from jumping backward when real-time updates start

        println!("[Rust] Spawning FFmpeg sidecar with real-time progress...");

        let cmd = shell.sidecar("ffmpeg").map_err(|e| format!("Failed to create ffmpeg sidecar: {}", e))?;
        let (mut rx, child) = cmd.args([
            "-i", &video_url,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            "-progress", "pipe:2",
            "-v", "error",
            "-y",
            video_path.to_str().ok_or("Invalid video path")?,
        ]).spawn().map_err(|e| format!("Failed to spawn ffmpeg sidecar: {}", e))?;

        // Store process handle for cancellation
        {
            let mut processes = ACTIVE_FFMPEG_PROCESSES.lock().unwrap();
            processes.insert(download_id_clone.clone(), child);
        }

        let result = tokio::spawn(async move {
            let total_duration = duration_for_progress.unwrap_or(600.0);
            let app_progress = app_clone_for_progress.clone();
            let download_id_progress = download_id_for_progress.clone();

            let mut line_buffer = String::new();
            let mut last_progress_time = std::time::Instant::now();
            let mut lines_processed = 0;
            let mut success = false;

            while let Some(event) = rx.recv().await {
                match event {
                    tauri_plugin_shell::process::CommandEvent::Stderr(data) => {
                        let chunk = String::from_utf8_lossy(&data);
                        line_buffer.push_str(&chunk);

                        while let Some(newline_pos) = line_buffer.find('\n') {
                            let line = line_buffer[..newline_pos].trim().to_string();
                            line_buffer.drain(..=newline_pos);

                            if line.is_empty() { continue; }

                            lines_processed += 1;
                            if lines_processed % 50 == 0 {
                                println!("[Rust] Processed {} lines from FFmpeg stderr", lines_processed);
                            }

                            if line.starts_with("out_time=") {
                                if let Some(time_str) = line.strip_prefix("out_time=") {
                                    println!("[Rust] Found progress line: out_time={}", time_str);
                                    if let Some(current_time) = parse_ffmpeg_time(time_str) {
                                        let progress = ((current_time / total_duration) * 100.0).min(95.0);
                                        println!("[Rust] Real progress: {:.1}% ({}s / {}s)", progress, current_time, total_duration);

                                        if last_progress_time.elapsed().as_secs() >= 1 {
                                            let progress_result = app_progress.emit("download-progress", DownloadProgress {
                                                download_id: download_id_progress.clone(),
                                                progress,
                                                current_time: Some(current_time),
                                                total_time: Some(total_duration),
                                                status: "Downloading video...".to_string(),
                                            });

                                            if let Err(e) = progress_result {
                                                println!("[Rust] Failed to emit progress: {}", e);
                                            }
                                            last_progress_time = std::time::Instant::now();
                                        }
                                    } else {
                                        println!("[Rust] Failed to parse time from: {}", time_str);
                                    }
                                }
                            }
                        }
                    }
                    tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                        if let Some(code) = payload.code {
                            if code == 0 {
                                println!("[Rust] FFmpeg download completed successfully");
                                success = true;
                            } else {
                                println!("[Rust] FFmpeg download failed with status: {}", code);
                            }
                        }
                    }
                    _ => {}
                }
            }

            if success {
                Ok(())
            } else {
                Err("FFmpeg download failed".to_string())
            }
        }).await;

        match result {
            Ok(inner_result) => {
                match inner_result {
                    Ok(()) => {
                        // Download completed successfully
                    }
                    Err(e) => {
                        return Err(e);
                    }
                }
            }
            Err(e) => {
                return Err(format!("Task join error: {}", e));
            }
        }

        println!("[Rust] Download completed successfully");

        // Get file metadata
        let metadata = match std::fs::metadata(&video_path) {
            Ok(meta) => {
                println!("[Rust] File metadata obtained, size: {} bytes", meta.len());
                meta
            }
            Err(e) => {
                println!("[Rust] Failed to get file metadata: {}", e);
                return Err(format!("Failed to get file metadata: {}", e));
            }
        };
        let file_size = metadata.len();

        // Generate thumbnail
        println!("[Rust] Generating thumbnail...");
        let thumbnail_path = paths.thumbnails.join(format!("{}_thumb.jpg", filename.replace(".mp4", "")));
        let thumbnail_result = match shell.sidecar("ffmpeg") {
            Ok(ffmpeg) => {
                match ffmpeg.args([
                    "-i", video_path.to_str().ok_or("Invalid video path")?,
                    "-ss", "00:00:01",
                    "-vframes", "1",
                    "-vf", "scale=320:-1",
                    "-y",
                    thumbnail_path.to_str().ok_or("Invalid thumbnail path")?,
                ]).output().await {
                    Ok(output) => {
                        println!("[Rust] Thumbnail generation completed, success: {}", output.status.success());
                        Some(output)
                    }
                    Err(e) => {
                        println!("[Rust] Failed to generate thumbnail: {}", e);
                        None
                    }
                }
            }
            Err(e) => {
                println!("[Rust] Failed to get ffmpeg for thumbnail: {}", e);
                None
            }
        };

        let thumbnail_path_str = if let Some(ref result) = thumbnail_result {
            if result.status.success() {
                println!("[Rust] Thumbnail saved to: {}", thumbnail_path.display());
                Some(thumbnail_path.to_string_lossy().to_string())
            } else {
                println!("[Rust] Thumbnail generation failed");
                None
            }
        } else {
            println!("[Rust] No thumbnail result");
            None
        };

        // Get video dimensions and codec info
        println!("[Rust] Getting detailed video info...");
        let video_info = get_video_info(&app_clone, &video_path).await.ok();
        let (width, height, codec) = if let Some(ref info) = video_info {
            println!("[Rust] Video info - width: {}, height: {}, codec: {}", info.width, info.height, info.codec);
            (Some(info.width), Some(info.height), Some(info.codec.clone()))
        } else {
            println!("[Rust] Could not get detailed video info");
            (None, None, None)
        };

        println!("[Rust] Download task completed successfully");
        Ok(DownloadResult {
            download_id: download_id_clone,
            success: true,
            file_path: Some(video_path.to_string_lossy().to_string()),
            thumbnail_path: thumbnail_path_str,
            duration,
            width,
            height,
            codec,
            file_size: Some(file_size),
            error: None,
        })
    }).await;

    println!("[Rust] Async task completed");

    cleanup_download();

    println!("[Rust] Processing download result...");
    match result {
        Ok(Ok(download_result)) => {
            println!("[Rust] Download successful! File: {:?}", download_result.file_path);

            // Send final progress
            println!("[Rust] Sending completion progress (100%)");
            let progress_result = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 100.0,
                current_time: None,
                total_time: None,
                status: "Download completed!".to_string(),
            });

            if let Err(e) = progress_result {
                println!("[Rust] Failed to send completion progress: {}", e);
            }

            // Send completion event
            println!("[Rust] Sending completion event...");
            let completion_result = app.emit("download-complete", download_result);
            if let Err(e) = completion_result {
                println!("[Rust] Failed to send completion event: {}", e);
            } else {
                println!("[Rust] Completion event sent successfully");
            }

            Ok(())
        }
        Ok(Err(e)) => {
            let error_msg = format!("Download failed: {}", e);
            println!("[Rust] Download failed: {}", error_msg);

            // Send error progress
            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 0.0,
                current_time: None,
                total_time: None,
                status: error_msg.clone(),
            });

            // Send error event
            let _ = app.emit("download-complete", DownloadResult {
                download_id,
                success: false,
                file_path: None,
                thumbnail_path: None,
                duration: None,
                width: None,
                height: None,
                codec: None,
                file_size: None,
                error: Some(error_msg),
            });

            Err(e)
        }
        Err(e) => {
            let error_msg = format!("Download task failed: {}", e);
            println!("[Rust] Download task failed: {}", error_msg);

            // Send error progress
            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 0.0,
                current_time: None,
                total_time: None,
                status: error_msg.clone(),
            });

            // Send error event
            let _ = app.emit("download-complete", DownloadResult {
                download_id,
                success: false,
                file_path: None,
                thumbnail_path: None,
                duration: None,
                width: None,
                height: None,
                codec: None,
                file_size: None,
                error: Some(error_msg),
            });

            Err(format!("Download task failed: {}", e))
        }
    }
}