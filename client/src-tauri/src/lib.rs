use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::process::Stdio;
use tauri::{Emitter, Manager};
use warp::Filter;

mod storage;
mod ffmpeg_utils;

use ffmpeg_utils::{
    extract_duration_from_ffmpeg_output, parse_ffmpeg_time,
    parse_video_info_from_ffmpeg_output, parse_duration_from_ffmpeg_output,
    get_video_duration_sync, get_video_info, VideoInfo, VideoValidationResult
};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AuthResult {
    signature: String,
    public_key: String,
    message: String,
    nonce: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PaymentResult {
    signature: String,
    pack_key: String,
    auth_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DownloadProgress {
    download_id: String,
    progress: f64,
    current_time: Option<f64>,
    total_time: Option<f64>,
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DownloadResult {
    download_id: String,
    success: bool,
    file_path: Option<String>,
    thumbnail_path: Option<String>,
    duration: Option<f64>,
    width: Option<u32>,
    height: Option<u32>,
    codec: Option<String>,
    file_size: Option<u64>,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AssetUploadResult {
    upload_id: String,
    success: bool,
    file_path: Option<String>,
    thumbnail_path: Option<String>,
    duration: Option<f64>,
    error: Option<String>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
struct AudioChunk {
    chunk_id: String,
    file_path: String,
    filename: String,
    start_time: f64,
    end_time: f64,
    duration: f64,
    base64_data: String,
    file_size: u64,
}

static AUTH_RESULT: Lazy<Arc<Mutex<Option<AuthResult>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));
static PAYMENT_RESULT: Lazy<Arc<Mutex<Option<PaymentResult>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));
static ACTIVE_DOWNLOADS: Lazy<Arc<Mutex<HashMap<String, bool>>>> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

#[derive(Debug, Clone)]
struct DownloadMetadata {
    output_path: Option<String>,
    thumbnail_path: Option<String>,
    #[allow(dead_code)]
    started_at: std::time::SystemTime,
    #[allow(dead_code)]
    process_id: Option<u32>,
}

static DOWNLOAD_METADATA: Lazy<Arc<Mutex<HashMap<String, DownloadMetadata>>>> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));
static CLIP_GENERATION_IN_PROGRESS: Lazy<Arc<Mutex<bool>>> = Lazy::new(|| Arc::new(Mutex::new(false)));
static AUTH_SERVER_PORT: u16 = 48274;
static PAYMENT_SERVER_PORT: u16 = 48275;
static VIDEO_SERVER_PORT: u16 = 48276;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn open_wallet_auth_window(app: tauri::AppHandle) -> Result<(), String> {
    // Start local callback server if not already running
    start_auth_callback_server(app.clone());

    // Open the wallet auth page in the user's default browser
    let auth_url = format!("http://localhost:{}/wallet-auth", AUTH_SERVER_PORT);

    tauri_plugin_opener::open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn open_wallet_payment_window(
    app: tauri::AppHandle,
    pack_key: String,
    pack_name: String,
    hours: u32,
    usd: f64,
    sol: f64,
    company_wallet: String,
    auth_token: String
) -> Result<(), String> {
    // Start payment callback server
    start_payment_callback_server(app.clone());

    // Build payment URL with query parameters
    let payment_url = format!(
        "http://localhost:{}/wallet-payment?packKey={}&packName={}&hours={}&usd={}&sol={}&companyWallet={}&authToken={}",
        PAYMENT_SERVER_PORT,
        urlencoding::encode(&pack_key),
        urlencoding::encode(&pack_name),
        hours,
        usd,
        sol,
        urlencoding::encode(&company_wallet),
        urlencoding::encode(&auth_token)
    );

    tauri_plugin_opener::open_url(payment_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn close_auth_window(_app: tauri::AppHandle) -> Result<(), String> {
    // No-op for browser-based flow, but keep for compatibility
    Ok(())
}

#[tauri::command]
async fn poll_auth_result() -> Result<Option<AuthResult>, String> {
    let result = AUTH_RESULT.lock().unwrap().clone();
    if result.is_some() {
        // Clear after retrieval
        *AUTH_RESULT.lock().unwrap() = None;
    }
    Ok(result)
}

#[tauri::command]
async fn poll_payment_result() -> Result<Option<PaymentResult>, String> {
    let result = PAYMENT_RESULT.lock().unwrap().clone();
    if result.is_some() {
        // Clear after retrieval
        *PAYMENT_RESULT.lock().unwrap() = None;
    }
    Ok(result)
}

fn start_auth_callback_server(app: tauri::AppHandle) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static SERVER_STARTED: AtomicBool = AtomicBool::new(false);

    if SERVER_STARTED.swap(true, Ordering::SeqCst) {
        return; // Server already running
    }

    tokio::spawn(async move {
        let auth_result = AUTH_RESULT.clone();
        let app_handle = app.clone();

        // Serve the wallet-auth.html page
        let wallet_auth_page = warp::path("wallet-auth")
            .map(|| warp::reply::html(include_str!("../../public/wallet-auth.html")));

        // Callback endpoint for auth result
        let auth_callback = warp::path("auth-callback")
            .and(warp::post())
            .and(warp::body::json())
            .map(move |result: AuthResult| {
                // Store the result
                *auth_result.lock().unwrap() = Some(result.clone());

                // Emit event to frontend
                let _ = app_handle.emit("wallet-auth-complete", result);

                warp::reply::json(&serde_json::json!({
                    "success": true,
                    "message": "Authentication received. You can close this tab."
                }))
            });

        // CORS configuration
        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "POST", "OPTIONS"])
            .allow_headers(vec!["Content-Type"]);

        let routes = wallet_auth_page.or(auth_callback).with(cors);

        println!("Starting local auth server on port {}", AUTH_SERVER_PORT);
        warp::serve(routes).run(([127, 0, 0, 1], AUTH_SERVER_PORT)).await;
    });
}

#[tauri::command]
fn get_video_server_port() -> u16 {
    VIDEO_SERVER_PORT
}

#[tauri::command]
async fn test_download_command(message: String) -> Result<String, String> {
    println!("[Rust] Test command called with message: {}", message);
    Ok(format!("Test command received: {}", message))
}

#[tauri::command]
async fn download_pumpfun_vod_segment(
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
        let mut cmd = tokio::process::Command::new("ffmpeg");
        cmd.args([
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
        ]);

        println!("[Rust] Spawning FFmpeg process for segment with real-time progress...");

        let result = tokio::spawn(async move {
            let mut child = cmd.stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn ffmpeg for segment: {}", e))?;
            let total_duration = total_segment_duration;

            // Clone for progress tracking
            let app_progress = app_clone_for_progress.clone();
            let download_id_progress = download_id_for_progress.clone();

            // Spawn a task to read stderr and parse progress
            let stderr = child.stderr.take().unwrap();
            let stderr_handle = tokio::spawn(async move {
                use tokio::io::AsyncBufReadExt;
                use tokio::io::BufReader;

                let mut reader = BufReader::new(stderr);
                let mut line = String::new();
                let mut last_progress_time = std::time::Instant::now();
                let mut lines_processed = 0;

                while let Ok(bytes_read) = reader.read_line(&mut line).await {
                    if bytes_read == 0 {
                        break; // EOF
                    }

                    lines_processed += 1;

                    // Log every 50th line to avoid spam
                    if lines_processed % 50 == 0 {
                        println!("[Rust] Processed {} lines from FFmpeg stderr for segment", lines_processed);
                    }

                    // Parse FFmpeg progress output
                    let line_trimmed = line.trim();

                    // Look for out_time= lines (current time in HH:MM:SS.ms format)
                    if line_trimmed.starts_with("out_time=") {
                        if let Some(time_str) = line_trimmed.strip_prefix("out_time=") {
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

                    line.clear();
                }

                println!("[Rust] FFmpeg stderr reading completed for segment, processed {} lines", lines_processed);
            });

            // Wait for the process to complete
            let status = child.wait().await;

            // Wait for stderr reading to finish
            let _ = stderr_handle.await;

            if let Ok(exit_status) = status {
                if exit_status.success() {
                    println!("[Rust] FFmpeg segment download completed successfully");
                    Ok(())
                } else {
                    println!("[Rust] FFmpeg segment download failed with status: {:?}", exit_status);
                    Err("FFmpeg segment download failed".to_string())
                }
            } else {
                println!("[Rust] Failed to get FFmpeg process status for segment: {:?}", status);
                Err("Failed to get FFmpeg process status for segment".to_string())
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

// Helper function to format time for filename
fn format_time_for_filename(seconds: f64) -> String {
    let h = (seconds / 3600.0) as u32;
    let m = ((seconds % 3600.0) / 60.0) as u32;
    let s = (seconds % 60.0) as u32;
    format!("{:02}{:02}{:02}", h, m, s)
}

#[tauri::command]
async fn download_pumpfun_vod(
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

        // Use tokio::process::Command for real-time progress tracking
        let mut cmd = tokio::process::Command::new("ffmpeg");
        cmd.args([
            "-i", &video_url,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            "-progress", "pipe:2",
            "-v", "error",
            "-y",
            video_path.to_str().ok_or("Invalid video path")?,
        ]);

        println!("[Rust] Spawning FFmpeg process with real-time progress...");

        let result = tokio::spawn(async move {
            let mut child = cmd.stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

            // Clone for progress tracking
            let app_progress = app_clone_for_progress.clone();
            let download_id_progress = download_id_for_progress.clone();
            let total_duration = duration_for_progress.unwrap_or(600.0);

            // Spawn a task to read stderr and parse progress
            let stderr = child.stderr.take().unwrap();
            let stderr_handle = tokio::spawn(async move {
                use tokio::io::AsyncBufReadExt;
                use tokio::io::BufReader;

                let mut reader = BufReader::new(stderr);
                let mut line = String::new();
                let mut last_progress_time = std::time::Instant::now();
                let mut lines_processed = 0;

                while let Ok(bytes_read) = reader.read_line(&mut line).await {
                    if bytes_read == 0 {
                        break; // EOF
                    }

                    lines_processed += 1;

                    // Log every 50th line to avoid spam
                    if lines_processed % 50 == 0 {
                        println!("[Rust] Processed {} lines from FFmpeg stderr", lines_processed);
                    }

                    // Parse FFmpeg progress output
                    let line_trimmed = line.trim();

                    // Look for out_time= lines (current time in HH:MM:SS.ms format)
                    if line_trimmed.starts_with("out_time=") {
                        if let Some(time_str) = line_trimmed.strip_prefix("out_time=") {
                            println!("[Rust] Found progress line: out_time={}", time_str);
                            if let Some(current_time) = parse_ffmpeg_time(time_str) {
                                let progress = ((current_time / total_duration) * 100.0).min(95.0);
                                println!("[Rust] Real progress: {:.1}% ({}s / {}s)", progress, current_time, total_duration);

                                // Only emit progress if it's been at least 1 second since last update
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

                    line.clear();
                }

                println!("[Rust] FFmpeg stderr reading completed, processed {} lines", lines_processed);
            });

            // Wait for the process to complete
            let status = child.wait().await;

            // Wait for stderr reading to finish
            let _ = stderr_handle.await;

            if let Ok(exit_status) = status {
                if exit_status.success() {
                    println!("[Rust] FFmpeg download completed successfully");
                    Ok(())
                } else {
                    println!("[Rust] FFmpeg download failed with status: {:?}", exit_status);
                    Err("FFmpeg download failed".to_string())
                }
            } else {
                println!("[Rust] Failed to get FFmpeg process status: {:?}", status);
                Err("Failed to get FFmpeg process status".to_string())
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

#[tauri::command]
async fn extract_audio_from_video(
    app: tauri::AppHandle,
    video_path: String,
    output_path: String
) -> Result<(String, String), String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] extract_audio_from_video called with:");
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   output_path: {}", output_path);

    // Get storage paths for temporary file
    let paths = storage::init_storage_dirs()
        .map_err(|e| {
            println!("[Rust] Failed to get storage paths: {}", e);
            format!("Failed to get storage paths: {}", e)
        })?;

    // Create a unique temporary audio file path - OGG format for better compression
    let temp_audio_path = paths.videos.join(format!("temp_audio_{}_audio_only.ogg",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| format!("Failed to get timestamp: {}", e))?
            .as_secs()
    ));

    println!("[Rust] Temporary audio path: {}", temp_audio_path.display());

    // Use FFmpeg to extract audio as OGG Vorbis - optimized for transcription
    let shell = app.shell();
    println!("[Rust] Running FFmpeg to extract audio...");

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", &video_path,
            "-c:a", "libvorbis",  // OGG Vorbis codec (better compression)
            "-q:a", "1",          // Quality level 1 (~64-96k MP3 equivalent, optimal for transcription)
            "-vn",               // No video
            "-y",                // Overwrite output file
            temp_audio_path.to_str().ok_or("Invalid temporary audio path")?,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        println!("[Rust] FFmpeg failed:");
        println!("[Rust]   stderr: {}", stderr);
        println!("[Rust]   stdout: {}", stdout);
        return Err(format!("FFmpeg extraction failed: {}", stderr));
    }

    // Check FFmpeg output for any warnings
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !stderr.is_empty() {
        println!("[Rust] FFmpeg stderr (warnings): {}", stderr);
    }

    println!("[Rust] FFmpeg extraction completed successfully");

    // Read the MP3 file and return as base64 encoded data
    println!("[Rust] Reading MP3 file for base64 encoding...");
    let audio_bytes = std::fs::read(&temp_audio_path)
        .map_err(|e| {
            println!("[Rust] Failed to read temporary audio file: {}", e);
            format!("Failed to read audio file: {}", e)
        })?;

    println!("[Rust] Read {} bytes from audio file", audio_bytes.len());

    // Encode to base64
    use base64::{Engine as _, engine::general_purpose};
    let base64_data = general_purpose::STANDARD.encode(&audio_bytes);
    println!("[Rust] Encoded {} bytes to {} chars of base64", audio_bytes.len(), base64_data.len());

    // Get filename for return
    let filename = temp_audio_path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("audio.ogg");

    // Clean up the temporary file
    if let Err(e) = std::fs::remove_file(&temp_audio_path) {
        eprintln!("[Rust] Warning: Failed to remove temporary audio file {}: {}", temp_audio_path.display(), e);
    } else {
        println!("[Rust] Cleaned up temporary audio file");
    }

    println!("[Rust] Audio extraction completed successfully");
    Ok((filename.to_string(), base64_data))
}

#[tauri::command]
async fn extract_and_chunk_audio(
    app: tauri::AppHandle,
    video_path: String,
    project_id: String,
    chunk_duration_minutes: u32,
    overlap_seconds: u32
) -> Result<Vec<AudioChunk>, String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] extract_and_chunk_audio called with:");
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   project_id: {}", project_id);
    println!("[Rust]   chunk_duration_minutes: {}", chunk_duration_minutes);
    println!("[Rust]   overlap_seconds: {}", overlap_seconds);

    // Get storage paths for temporary files
    let paths = storage::init_storage_dirs()
        .map_err(|e| {
            println!("[Rust] Failed to get storage paths: {}", e);
            format!("Failed to get storage paths: {}", e)
        })?;

    let chunk_duration_secs = chunk_duration_minutes as f64 * 60.0;
    let overlap_secs = overlap_seconds as f64;
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

    // Calculate number of chunks needed
    let mut chunks = Vec::new();
    let mut current_start = 0.0;
    let mut chunk_index = 1;

    while current_start < video_duration {
        let current_end = (current_start + chunk_duration_secs).min(video_duration);
        let actual_duration = current_end - current_start;

        // Skip very small final chunks
        if actual_duration < 30.0 {
            println!("[Rust] Skipping small final chunk of {:.2} seconds", actual_duration);
            break;
        }

        println!("[Rust] Processing chunk {}: {:.2}s - {:.2}s (duration: {:.2}s)",
                chunk_index, current_start, current_end, actual_duration);

        // Create chunk file path
        let chunk_filename = format!("{}_chunk_{:03}.ogg", project_id, chunk_index);
        let chunk_path = paths.videos.join(&chunk_filename);

        // Extract chunk using FFmpeg
        let chunk_output = shell.sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args([
                "-i", &video_path,
                "-ss", &format!("{:.3}", current_start),
                "-t", &format!("{:.3}", actual_duration),
                "-c:a", "libvorbis",  // OGG Vorbis codec (better compression)
                "-q:a", "1",          // Quality level 1 (~64-96k MP3 equivalent, optimal for transcription)
                "-vn",               // No video
                "-y",                // Overwrite output file
                chunk_path.to_str().ok_or("Invalid chunk path")?,
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to run ffmpeg for chunk {}: {}", chunk_index, e))?;

        if !chunk_output.status.success() {
            let stderr = String::from_utf8_lossy(&chunk_output.stderr);
            println!("[Rust] FFmpeg chunk {} failed: {}", chunk_index, stderr);
            return Err(format!("FFmpeg chunk {} extraction failed: {}", chunk_index, stderr));
        }

        // Read chunk file and encode to base64
        let chunk_bytes = std::fs::read(&chunk_path)
            .map_err(|e| format!("Failed to read chunk file {}: {}", chunk_index, e))?;

        let base64_data = {
            use base64::{Engine as _, engine::general_purpose};
            general_purpose::STANDARD.encode(&chunk_bytes)
        };

        // Create audio chunk struct
        let audio_chunk = AudioChunk {
            chunk_id: format!("{}_{}", project_id, chunk_index),
            file_path: chunk_path.to_string_lossy().to_string(),
            filename: chunk_filename,
            start_time: current_start,
            end_time: current_end,
            duration: actual_duration,
            base64_data,
            file_size: chunk_bytes.len() as u64,
        };

        chunks.push(audio_chunk);
        println!("[Rust] Chunk {} completed: {} bytes", chunk_index, chunk_bytes.len());

        // Clean up temporary chunk file
        if let Err(e) = std::fs::remove_file(&chunk_path) {
            eprintln!("[Rust] Warning: Failed to remove chunk file {}: {}", chunk_path.display(), e);
        }

        // Move to next chunk (with overlap for long videos)
        current_start = current_end - if current_end < video_duration { overlap_secs } else { 0.0 };
        chunk_index += 1;

        // Safety check to prevent infinite loop
        if chunk_index > 100 {
            return Err("Too many chunks - possible infinite loop".to_string());
        }
    }

    println!("[Rust] Audio chunking completed successfully. Created {} chunks.", chunks.len());
    Ok(chunks)
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

// Clip building progress tracking structure
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ClipBuildProgress {
    clip_id: String,
    project_id: String,
    progress: f64,
    stage: String,
    message: String,
    error: Option<String>,
}

// Clip build result structure
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ClipBuildResult {
    clip_id: String,
    project_id: String,
    success: bool,
    output_path: Option<String>,
    thumbnail_path: Option<String>,
    duration: Option<f64>,
    file_size: Option<u64>,
    error: Option<String>,
}

// Active clip builds tracking
static ACTIVE_CLIP_BUILDS: Lazy<Arc<Mutex<HashMap<String, bool>>>> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Build clip from segments using FFmpeg
#[tauri::command]
async fn build_clip_from_segments(
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
    use tauri_plugin_shell::ShellExt;

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

// Build a single-segment clip (simple extraction)
async fn build_single_segment_clip(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    update_progress: &mut dyn Fn(&str, &str, f64)
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    let shell = app.shell();
    let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
    let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
    let duration = end_time - start_time;

    update_progress("extracting", &format!("Extracting segment: {:.2}s - {:.2}s", start_time, end_time), 30.0);

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

    update_progress("finalizing", "Finalizing single segment clip...", 80.0);

    Ok(())
}

// Build a multi-segment clip (concatenation)
async fn build_multi_segment_clip(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segments: &[serde_json::Value],
    update_progress: &mut dyn Fn(&str, &str, f64)
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    let shell = app.shell();
    update_progress("preparing", "Preparing multi-segment concatenation...", 30.0);

    // Build filter_complex for FFmpeg
    let mut video_filters = Vec::new();
    let mut audio_filters = Vec::new();
    let mut inputs: Vec<String> = Vec::new();
    let mut concat_inputs = Vec::new();

    for (i, segment) in segments.iter().enumerate() {
        let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
        let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;

        // Add input multiple times for each segment
        inputs.push("-i".to_string());
        inputs.push(video_path.to_string());

        // Video filter for this segment - use stream index directly
        let video_filter = format!(
            "[{}:0]trim=start={:.3}:end={:.3},setpts=PTS-STARTPTS[v{}]",
            i, start_time, end_time, i
        );
        video_filters.push(video_filter);

        // Audio filter for this segment - use stream index directly
        let audio_filter = format!(
            "[{}:1]atrim=start={:.3}:end={:.3},asetpts=PTS-STARTPTS[a{}]",
            i, start_time, end_time, i
        );
        audio_filters.push(audio_filter);

        // Add to concat inputs
        concat_inputs.push(format!("[v{}][a{}]", i, i));
    }

    update_progress("concatenating", "Concatenating segments...", 50.0);

    // Build the complete filter_complex
    let all_filters: Vec<String> = video_filters.iter().chain(audio_filters.iter()).cloned().collect();
    let filter_complex = format!(
        "{};concat=n={}:v=1:a=1[outv][outa]",
        all_filters.join(";"),
        segments.len()
    );

    println!("[Rust] Using filter_complex: {}", filter_complex);
    println!("[Rust] Number of inputs: {}", segments.len());
    println!("[Rust] Input files: {}", segments.len());

    // Prepare FFmpeg arguments
    let mut args: Vec<String> = inputs;
    args.push("-filter_complex".to_string());
    args.push(filter_complex);
    args.push("-map".to_string());
    args.push("[outv]".to_string());
    args.push("-map".to_string());
    args.push("[outa]".to_string());
    args.push("-c:v".to_string());
    args.push("libx264".to_string());  // Re-encode video for compatibility
    args.push("-preset".to_string());
    args.push("fast".to_string());
    args.push("-crf".to_string());
    args.push("23".to_string());
    args.push("-c:a".to_string());
    args.push("aac".to_string());  // Re-encode audio for compatibility
    args.push("-b:a".to_string());
    args.push("128k".to_string());
    args.push("-avoid_negative_ts".to_string());
    args.push("1".to_string());
    args.push("-y".to_string());  // Overwrite output file
    args.push(output_path.to_str().ok_or("Invalid output path")?.to_string());

    update_progress("processing", "Processing concatenated clip...", 70.0);

    println!("[Rust] Running FFmpeg with {} args", args.len());

    // Run FFmpeg
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg concatenation failed: {}", stderr));
    }

    update_progress("finalizing", "Finalizing multi-segment clip...", 80.0);

    Ok(())
}

// Generate thumbnail for the built clip
async fn generate_clip_thumbnail(
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

// Get video duration synchronously

// Cancel clip build
#[tauri::command]
async fn cancel_clip_build(clip_id: String) -> Result<bool, String> {
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
async fn is_clip_build_active(clip_id: String) -> Result<bool, String> {
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

async fn start_video_server_impl() {
    use std::sync::atomic::{AtomicBool, Ordering};
    static SERVER_STARTED: AtomicBool = AtomicBool::new(false);

    if SERVER_STARTED.swap(true, Ordering::SeqCst) {
        return; // Server already running
    }

    {
        use std::path::PathBuf;
        use warp::Reply;

        let video_route = warp::path!("video" / String)
            .and(warp::get())
            .and(warp::header::optional::<String>("range"))
            .and_then(|encoded_path: String, range_header: Option<String>| async move {
                // Decode the base64-encoded path
                use base64::{Engine as _, engine::general_purpose};
                let decoded = match general_purpose::STANDARD.decode(encoded_path) {
                    Ok(d) => d,
                    Err(_) => {
                        return Ok::<_, warp::Rejection>(warp::reply::with_status(
                            warp::reply::json(&serde_json::json!({"error": "Invalid path encoding"})),
                            warp::http::StatusCode::BAD_REQUEST
                        ).into_response());
                    }
                };

                let path_str = match String::from_utf8(decoded) {
                    Ok(s) => s,
                    Err(_) => {
                        return Ok(warp::reply::with_status(
                            warp::reply::json(&serde_json::json!({"error": "Invalid path encoding"})),
                            warp::http::StatusCode::BAD_REQUEST
                        ).into_response());
                    }
                };

                let file_path = PathBuf::from(&path_str);

                if !file_path.exists() {
                    return Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "File not found"})),
                        warp::http::StatusCode::NOT_FOUND
                    ).into_response());
                }

                // Get file metadata
                let metadata = match tokio::fs::metadata(&file_path).await {
                    Ok(m) => m,
                    Err(_) => {
                        return Ok(warp::reply::with_status(
                            warp::reply::json(&serde_json::json!({"error": "Cannot read file metadata"})),
                            warp::http::StatusCode::INTERNAL_SERVER_ERROR
                        ).into_response());
                    }
                };

                let file_size = metadata.len();

                // Determine content type
                let content_type = match file_path.extension().and_then(|e| e.to_str()) {
                    Some("mp4") => "video/mp4",
                    Some("webm") => "video/webm",
                    Some("mov") => "video/quicktime",
                    Some("avi") => "video/x-msvideo",
                    Some("mkv") => "video/x-matroska",
                    _ => "application/octet-stream",
                };

                // Always require range requests for large files to prevent memory overflow
                const LARGE_FILE_THRESHOLD: u64 = 50 * 1024 * 1024; // 50MB

                // Handle Range header for seeking support
                match range_header {
                    Some(range) => {
                        // Parse Range header: "bytes=start-end"
                        if let Some(range_str) = range.strip_prefix("bytes=") {
                            let parts: Vec<&str> = range_str.split('-').collect();
                            if parts.len() == 2 {
                                let start = if parts[0].is_empty() {
                                    0
                                } else {
                                    parts[0].parse::<u64>().unwrap_or(0)
                                };

                                let end = if parts[1].is_empty() {
                                    file_size - 1
                                } else {
                                    parts[1].parse::<u64>().unwrap_or(file_size - 1)
                                };

                                // Validate range and ensure it's not too large
                                if start < file_size && end < file_size && start <= end {
                                    let content_length = end - start + 1;

                                    // For very large ranges, serve the first 50MB chunk instead
                                    let actual_end = if content_length > LARGE_FILE_THRESHOLD {
                                        start + LARGE_FILE_THRESHOLD - 1
                                    } else {
                                        end
                                    };
                                    let actual_content_length = actual_end - start + 1;

                                    // Open file and seek to start position
                                    match tokio::fs::File::open(&file_path).await {
                                        Ok(mut file) => {
                                            use tokio::io::{AsyncSeekExt, AsyncReadExt};

                                            if let Err(e) = file.seek(std::io::SeekFrom::Start(start)).await {
                                                eprintln!("Failed to seek to position {}: {}", start, e);
                                                return Ok(warp::reply::with_status(
                                                    warp::reply::json(&serde_json::json!({"error": "Cannot seek in file"})),
                                                    warp::http::StatusCode::INTERNAL_SERVER_ERROR
                                                ).into_response());
                                            }

                                            let mut buffer = vec![0u8; actual_content_length as usize];
                                            if let Err(e) = file.read_exact(&mut buffer).await {
                                                eprintln!("Failed to read range {}-{}: {}", start, actual_end, e);
                                                return Ok(warp::reply::with_status(
                                                    warp::reply::json(&serde_json::json!({"error": "Cannot read file range"})),
                                                    warp::http::StatusCode::INTERNAL_SERVER_ERROR
                                                ).into_response());
                                            }

                                            eprintln!("Serving range {}-{}/{} ({} bytes, requested: {}-{}) for file: {}",
                                                start, actual_end, file_size, actual_content_length, start, end, file_path.display());

                                            // Return 206 Partial Content with actual served range
                                            let response = warp::reply::with_header(
                                                warp::reply::with_header(
                                                    buffer,
                                                    "Content-Range",
                                                    format!("bytes {}-{}/{}", start, actual_end, file_size)
                                                ),
                                                "Content-Length",
                                                actual_content_length.to_string()
                                            );

                                            let response = warp::reply::with_header(
                                                response,
                                                "Content-Type",
                                                content_type
                                            );

                                            let response = warp::reply::with_header(
                                                response,
                                                "Accept-Ranges",
                                                "bytes"
                                            );

                                            return Ok(warp::reply::with_status(
                                                response,
                                                warp::http::StatusCode::PARTIAL_CONTENT
                                            ).into_response());
                                        }
                                        Err(e) => {
                                            eprintln!("Failed to open file for range request: {}", e);
                                            return Ok(warp::reply::with_status(
                                                warp::reply::json(&serde_json::json!({"error": "Cannot open file"})),
                                                warp::http::StatusCode::INTERNAL_SERVER_ERROR
                                            ).into_response());
                                        }
                                    }
                                }
                            }
                        }

                        // If range parsing failed, return error
                        return Ok(warp::reply::with_status(
                            warp::reply::json(&serde_json::json!({"error": "Invalid range header"})),
                            warp::http::StatusCode::RANGE_NOT_SATISFIABLE
                        ).into_response());
                    }
                    None => {
                        // No range header - only serve small files entirely
                        if file_size <= LARGE_FILE_THRESHOLD {
                            // Small file: serve normally
                            let bytes = match tokio::fs::read(&file_path).await {
                                Ok(b) => b,
                                Err(e) => {
                                    eprintln!("Failed to read small file {}: {}", file_path.display(), e);
                                    return Ok(warp::reply::with_status(
                                        warp::reply::json(&serde_json::json!({"error": "Cannot read file"})),
                                        warp::http::StatusCode::INTERNAL_SERVER_ERROR
                                    ).into_response());
                                }
                            };

                            let response = warp::reply::with_header(
                                warp::reply::with_header(
                                    bytes,
                                    "Content-Length",
                                    file_size.to_string()
                                ),
                                "Content-Type",
                                content_type
                            );

                            let response = warp::reply::with_header(
                                response,
                                "Accept-Ranges",
                                "bytes"
                            );

                            return Ok(response.into_response());
                        } else {
                            // Large file without range: require range request
                            return Ok(warp::reply::with_status(
                                warp::reply::json(&serde_json::json!({
                                    "error": "Range header required",
                                    "message": "Files larger than 50MB require range requests",
                                    "file_size": file_size,
                                    "content_type": content_type
                                })),
                                warp::http::StatusCode::RANGE_NOT_SATISFIABLE
                            ).into_response());
                        }
                    }
                }
            });

        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "OPTIONS"])
            .allow_headers(vec!["Content-Type", "Range"]);

        let routes = video_route.with(cors);

    println!("Starting local video server on port {}", VIDEO_SERVER_PORT);
    warp::serve(routes).run(([127, 0, 0, 1], VIDEO_SERVER_PORT)).await;
    }
}

fn start_payment_callback_server(app: tauri::AppHandle) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static SERVER_STARTED: AtomicBool = AtomicBool::new(false);

    if SERVER_STARTED.swap(true, Ordering::SeqCst) {
        return; // Server already running
    }

    tokio::spawn(async move {
        let payment_result = PAYMENT_RESULT.clone();
        let app_handle = app.clone();

        // Serve the wallet-payment.html page
        let wallet_payment_page = warp::path("wallet-payment")
            .map(|| warp::reply::html(include_str!("../../public/wallet-payment.html")));

        // Callback endpoint for payment result
        let payment_callback = warp::path("payment-callback")
            .and(warp::post())
            .and(warp::body::json())
            .map(move |result: PaymentResult| {
                // Store the result
                *payment_result.lock().unwrap() = Some(result.clone());

                // Emit event to frontend
                let _ = app_handle.emit("wallet-payment-complete", result);

                warp::reply::json(&serde_json::json!({
                    "success": true,
                    "message": "Payment received. You can close this tab."
                }))
            });

        // CORS configuration
        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "POST", "OPTIONS"])
            .allow_headers(vec!["Content-Type"]);

        let routes = wallet_payment_page.or(payment_callback).with(cors);

        println!("Starting local payment server on port {}", PAYMENT_SERVER_PORT);
        warp::serve(routes).run(([127, 0, 0, 1], PAYMENT_SERVER_PORT)).await;
    });
}

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
                start_video_server_impl().await;
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
            open_wallet_auth_window,
            open_wallet_payment_window,
            close_auth_window,
            poll_auth_result,
            poll_payment_result,
            get_video_server_port,
            get_pumpfun_clips,
            test_download_command,
            download_pumpfun_vod,
            download_pumpfun_vod_segment,
            get_active_downloads_count,
            cancel_all_downloads,
            cancel_download,
            cleanup_completed_download,
            check_file_exists,
            validate_video_file,
            set_clip_generation_in_progress,
            is_clip_generation_in_progress,
            extract_audio_from_video,
            extract_and_chunk_audio,
            extract_audio_waveform,
            get_cached_waveform,
            save_waveform_to_cache,
                        storage::get_storage_paths,
            storage::copy_video_to_storage,
            storage::copy_asset_to_storage,
            storage::delete_asset_file,
            upload_asset_async,
            storage::generate_thumbnail,
            storage::save_temp_file,
            storage::read_file_as_data_url,
            storage::delete_video_file,
            storage::get_video_duration,
            build_clip_from_segments,
            cancel_clip_build,
            is_clip_build_active,
            setup_macos_titlebar,
            get_platform,
            show_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Get platform information
#[tauri::command]
fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

// Show the main window (used to hide window during loading)
#[tauri::command]
async fn show_main_window(window: tauri::Window) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())
}

// Async asset upload with thumbnail generation (follows PumpFun download pattern)
#[tauri::command]
async fn upload_asset_async(
    app: tauri::AppHandle,
    upload_id: String,
    asset_type: String,
    source_path: String,
    original_filename: String
) -> Result<(), String> {
    println!("[Rust] upload_asset_async called with:");
    println!("[Rust]   upload_id: {}", upload_id);
    println!("[Rust]   asset_type: {}", asset_type);
    println!("[Rust]   source_path: {}", source_path);
    println!("[Rust]   original_filename: {}", original_filename);

    // Extract the actual upload_id (everything before the colon)
    let actual_upload_id = upload_id.split(':').next().unwrap_or(&upload_id).to_string();

    let app_clone = app.clone();
    let upload_id_for_task = actual_upload_id.clone();
    let upload_id_for_result = upload_id.clone();

    let result = tokio::spawn(async move {
        let upload_id_for_event = upload_id_for_result.clone();
        println!("[Rust] Async asset upload task started for: {}", upload_id_for_task);

        // Copy asset to storage
        let copy_result = storage::copy_asset_to_storage(source_path, asset_type.clone(), app_clone.clone()).await;
        let (destination_path, thumbnail_path) = match copy_result {
            Ok(result) => {
                println!("[Rust] Asset copied to storage: {}", result.destination_path);
                (result.destination_path, result.thumbnail_path)
            }
            Err(e) => {
                println!("[Rust] Failed to copy asset: {}", e);
                let error_result = AssetUploadResult {
                    upload_id: upload_id_for_event.clone(),
                    success: false,
                    file_path: None,
                    thumbnail_path: None,
                    duration: None,
                    error: Some(format!("Failed to copy asset: {}", e)),
                };
                let _ = app_clone.emit("asset-upload-complete", error_result);
                return Err(e);
            }
        };

        // Get video duration
        let duration = match storage::get_video_duration(destination_path.clone()) {
            Ok(d) => {
                println!("[Rust] Asset duration: {:?}", d);
                Some(d)
            }
            Err(e) => {
                println!("[Rust] Failed to get asset duration: {}", e);
                None
            }
        };

        // Generate thumbnail if we don't have one
        let final_thumbnail_path = if thumbnail_path.is_none() {
            println!("[Rust] Generating thumbnail for asset...");
            match storage::generate_thumbnail(app_clone.clone(), destination_path.clone()).await {
                Ok(path) => {
                    println!("[Rust] Thumbnail generated: {}", path);
                    Some(path)
                }
                Err(e) => {
                    println!("[Rust] Failed to generate thumbnail: {}", e);
                    None
                }
            }
        } else {
            thumbnail_path
        };

        // Send success completion event with the original upload_id (containing metadata)
        let success_result = AssetUploadResult {
            upload_id: upload_id_for_event, // Use the original full upload_id with metadata
            success: true,
            file_path: Some(destination_path),
            thumbnail_path: final_thumbnail_path,
            duration,
            error: None,
        };

        println!("[Rust] Sending asset upload completion event...");
        let _ = app_clone.emit("asset-upload-complete", success_result);
        println!("[Rust] Asset upload completion event sent successfully");

        Ok(())
    }).await;

    match result {
        Ok(_) => {
            println!("[Rust] Async asset upload task completed successfully");
            Ok(())
        }
        Err(e) => {
            println!("[Rust] Async asset upload task failed: {}", e);
            let error_result = AssetUploadResult {
                upload_id: upload_id,
                success: false,
                file_path: None,
                thumbnail_path: None,
                duration: None,
                error: Some(format!("Upload task failed: {}", e)),
            };
            let _ = app.emit("asset-upload-complete", error_result);
            Err(format!("Upload task failed: {}", e))
        }
    }
}

// Setup macOS titlebar with transparent background
#[tauri::command]
async fn setup_macos_titlebar(_window: tauri::Window) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // On macOS, we use the window parameter to access the native NSWindow
        use cocoa::appkit::{NSColor, NSWindow};
        use cocoa::foundation::NSAutoreleasePool;
        use objc::msg_send;
        use objc::runtime::Sel;

        // Get the native window handle
        let ns_window = _window.ns_window().map_err(|e| format!("Failed to get NSWindow: {}", e))?;

        // Create an autorelease pool for memory management
        unsafe {
            let pool = NSAutoreleasePool::new(std::ptr::null_mut());

            // Set the background color to match the app's dark theme
            let bg_color = NSColor::colorWithRed_green_blue_alpha_(
                std::ptr::null_mut(),
                15.0 / 255.0,    // R - dark background
                15.0 / 255.0,    // G - dark background
                15.0 / 255.0,    // B - dark background
                1.0,             // Alpha - fully opaque
            );

            // Apply the background color to the window
            let _: () = msg_send![ns_window, setBackgroundColor_: bg_color];

            // Make sure the window is opaque for better performance
            let _: () = msg_send![ns_window, setOpaque_: cocoa::foundation::NO];

            // Clean up the autorelease pool
            let _: () = msg_send![pool, release];
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // On non-macOS platforms, this function does nothing
    }

    Ok(())
}
