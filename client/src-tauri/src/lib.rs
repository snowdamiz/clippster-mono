use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::process::Stdio;
use tauri::{Emitter, Manager};
use warp::Filter;

mod storage;

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

static AUTH_RESULT: Lazy<Arc<Mutex<Option<AuthResult>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));
static PAYMENT_RESULT: Lazy<Arc<Mutex<Option<PaymentResult>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));
static ACTIVE_DOWNLOADS: Lazy<Arc<Mutex<HashMap<String, bool>>>> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));
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

#[derive(Debug, Clone)]
struct VideoInfo {
    width: u32,
    height: u32,
    codec: String,
}

async fn get_video_info(app: &tauri::AppHandle, video_path: &std::path::Path) -> Result<VideoInfo, String> {
    use tauri_plugin_shell::ShellExt;

    let output = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", video_path.to_str().ok_or("Invalid video path")?,
            "-f", "null",
            "-"
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg info: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    parse_video_info_from_ffmpeg_output(&stderr)
}

fn parse_video_info_from_ffmpeg_output(output: &str) -> Result<VideoInfo, String> {
    // Parse video stream info from FFmpeg output
    let mut width = None;
    let mut height = None;
    let mut codec = None;

    for line in output.lines() {
        if line.contains("Video:") {
            // Extract resolution
            if let Some(res_start) = line.find('(') {
                if let Some(res_end) = line[res_start..].find(')') {
                    let res_end_absolute = res_start + res_end;
                    let resolution = &line[res_start + 1..res_end_absolute];
                    if let Some(space_pos) = resolution.find(' ') {
                        let res_parts: Vec<&str> = resolution[..space_pos].split('x').collect();
                        if res_parts.len() == 2 {
                            width = res_parts[0].parse().ok();
                            height = res_parts[1].parse().ok();
                        }
                    }
                }
            }

            // Extract codec
            if let Some(codec_start) = line.find("Video: ") {
                let codec_part = &line[codec_start + 7..];
                if let Some(space_pos) = codec_part.find(' ') {
                    codec = Some(codec_part[..space_pos].to_string());
                }
            }
        }
    }

    match (width, height, codec) {
        (Some(w), Some(h), Some(c)) => Ok(VideoInfo { width: w, height: h, codec: c }),
        _ => Err("Could not parse video info".to_string()),
    }
}

fn extract_duration_from_ffmpeg_output(output: &str) -> Option<f64> {
    // Look for duration in format: Duration: 00:01:23.45
    for line in output.lines() {
        if line.contains("Duration:") {
            if let Some(duration_start) = line.find("Duration: ") {
                let duration_part = &line[duration_start + 10..];
                if let Some(comma_pos) = duration_part.find(',') {
                    let duration_str = &duration_part[..comma_pos];
                    return parse_duration_string(duration_str);
                }
            }
        }
    }
    None
}

fn parse_duration_string(duration_str: &str) -> Option<f64> {
    // Parse format HH:MM:SS.ms
    let parts: Vec<&str> = duration_str.split(':').collect();
    if parts.len() != 3 {
        return None;
    }

    let hours: f64 = parts[0].parse().ok()?;
    let minutes: f64 = parts[1].parse().ok()?;
    let seconds: f64 = parts[2].parse().ok()?;

    Some(hours * 3600.0 + minutes * 60.0 + seconds)
}

fn parse_ffmpeg_time(time_str: &str) -> Option<f64> {
    // Parse format HH:MM:SS.ms or HH:MM:SS
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() != 3 {
        return None;
    }

    let hours: f64 = parts[0].parse().ok()?;
    let minutes: f64 = parts[1].parse().ok()?;
    let seconds: f64 = parts[2].parse().ok()?;

    Some(hours * 3600.0 + minutes * 60.0 + seconds)
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
async fn check_file_exists(path: String) -> Result<bool, String> {
    use std::path::Path;
    Ok(Path::new(&path).exists())
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
            "-q:a", "3",          // Quality level 3 (~128k MP3 equivalent)
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
                    "sqlite:clippster_clean.db",
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
                            version: 14,
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

                    if active_count > 0 {
                        println!("[Rust] {} active downloads found, preventing close and showing dialog", active_count);

                        // Prevent the window from closing immediately
                        api.prevent_close();

                        // Emit event to frontend to show confirmation dialog
                        let _ = app_handle.emit("window-close-requested", active_count);
                    } else {
                        println!("[Rust] No active downloads, allowing close");
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
            get_active_downloads_count,
            cancel_all_downloads,
            check_file_exists,
            extract_audio_from_video,
            storage::get_storage_paths,
            storage::copy_video_to_storage,
            storage::generate_thumbnail,
            storage::read_file_as_data_url,
            storage::delete_video_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
