use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
};

use once_cell::sync::Lazy;
use serde::Serialize;
use tauri::Emitter;
use tokio::sync::oneshot;
use crate::storage;
use tokio::io::AsyncBufReadExt;
use base64::Engine;

#[cfg(target_os = "windows")]
#[allow(unused_imports)]
use std::os::windows::process::CommandExt;

/// On Windows, set CREATE_NO_WINDOW flag to prevent a visible console window.
#[cfg(target_os = "windows")]
fn no_window(cmd: &mut tokio::process::Command) -> &mut tokio::process::Command {
    cmd.creation_flags(0x08000000) // CREATE_NO_WINDOW
}

#[cfg(not(target_os = "windows"))]
fn no_window(cmd: &mut tokio::process::Command) -> &mut tokio::process::Command {
    cmd
}

// Recording state management
#[derive(Debug)]
struct TwitterRecordingEntry {
    stop_tx: Option<oneshot::Sender<()>>,
    task: tokio::task::JoinHandle<()>,
    broadcast_id: String, // Store broadcast_id to allow lookup by broadcast
}

// Track recordings by session_id instead of broadcast_id to allow multiple sessions per broadcast
// This enables both temp viewer sessions (4-sec segments) and persistent auto-detect sessions
// to record the same broadcast simultaneously in different directories
static TWITTER_ACTIVE_RECORDINGS: Lazy<Arc<Mutex<HashMap<String, TwitterRecordingEntry>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Event payloads for frontend communication
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TwitterSegmentReadyPayload {
    streamer_id: String,
    session_id: String,
    broadcast_id: String,
    mint_id: String,
    segment: u32,
    path: String,
    duration: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TwitterRecorderLogPayload {
    streamer_id: String,
    broadcast_id: String,
    mint_id: String,
    message: String,
    level: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TwitterStreamEndedPayload {
    streamer_id: String,
    session_id: String,
    broadcast_id: String,
    mint_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TwitterRecorderExitPayload {
    streamer_id: String,
    session_id: String,
    broadcast_id: String,
    mint_id: String,
    code: Option<i32>,
}

/// Validate and normalize Twitter/X URL
/// 
/// # Arguments
/// * `url` - Twitter broadcast or Space URL (supports both x.com and twitter.com)
#[tauri::command]
pub fn validate_twitter_url(url: String) -> Result<String, String> {
    let normalized = normalize_twitter_url(&url);
    
    // Validate URL format
    if normalized.contains("/i/broadcasts/") || normalized.contains("/i/spaces/") {
        Ok(normalized)
    } else {
        Err("Invalid Twitter URL. Must be a broadcast or Space URL.".to_string())
    }
}

/// Start recording a Twitter broadcast or Space using yt-dlp
/// 
/// # Arguments
/// * `url` - Twitter broadcast or Space URL
/// * `streamer_id` - Unique identifier for the streamer
/// * `session_id` - Unique identifier for this recording session
#[tauri::command]
pub async fn start_twitter_recording(
    app: tauri::AppHandle,
    url: String,
    streamer_id: String,
    session_id: String,
    segment_duration_minutes: Option<u32>,
) -> Result<(), String> {
    let normalized_url = normalize_twitter_url(&url);
    
    // Extract broadcast/space ID for tracking
    let broadcast_id = extract_broadcast_id(&normalized_url)?;
    
    // Check if this specific session is already recording
    // Allow multiple sessions per broadcast (e.g., temp viewer + persistent auto-detect)
    if TWITTER_ACTIVE_RECORDINGS.lock().unwrap().contains_key(&session_id) {
        println!("[Twitter] Session {} already recording, skipping duplicate start", session_id);
        return Ok(());
    }
    
    let output_dir = storage::get_livestream_recordings_dir()?;
    let session_dir = output_dir.join(&session_id);
    std::fs::create_dir_all(&session_dir)
        .map_err(|e| format!("Failed to create session directory: {}", e))?;
    
    let segment_duration = segment_duration_minutes.unwrap_or(5);
    let (stop_tx, stop_rx) = oneshot::channel();
    
    let broadcast_clone = broadcast_id.clone();
    let streamer_clone = streamer_id.clone();
    let session_clone = session_id.clone();
    let output_str = session_dir.to_string_lossy().to_string();
    let app_handle = app.clone();
    
    let session_for_cleanup = session_id.clone();
    let task = tokio::spawn(async move {
        if let Err(err) = run_twitter_recorder(
            app_handle,
            normalized_url,
            broadcast_clone.clone(),
            streamer_clone,
            session_clone,
            output_str,
            segment_duration,
            stop_rx,
        ).await {
            eprintln!("[TwitterRecorder] {}", err);
        }
        
        // Cleanup by session_id (not broadcast_id) since we track by session now
        TWITTER_ACTIVE_RECORDINGS.lock().unwrap().remove(&session_for_cleanup);
    });
    
    // Insert by session_id (not broadcast_id) to allow multiple sessions per broadcast
    TWITTER_ACTIVE_RECORDINGS.lock().unwrap().insert(
        session_id.clone(),
        TwitterRecordingEntry {
            stop_tx: Some(stop_tx),
            task,
            broadcast_id,
        },
    );
    
    Ok(())
}

async fn run_twitter_recorder(
    app: tauri::AppHandle,
    url: String,
    broadcast_id: String,
    streamer_id: String,
    session_id: String,
    output_dir: String,
    segment_duration_minutes: u32,
    mut stop_rx: oneshot::Receiver<()>,
) -> Result<(), String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    let ffmpeg_path = resolve_ffmpeg_binary()?;
    
    // HLS segment duration in seconds
    // For Auto-Detect/Record: use user-configured segment duration (e.g., 5 minutes = 300 seconds)
    // For Watch mode (segment_duration_minutes <= 1): use 4-second segments for low-latency playback
    let hls_segment_seconds = if segment_duration_minutes <= 1 {
        4 // Low-latency mode for live watching
    } else {
        segment_duration_minutes * 60 // Convert minutes to seconds for recording
    };
    
    let playlist_path = PathBuf::from(&output_dir).join("playlist.m3u8");
    let segment_pattern = PathBuf::from(&output_dir).join("segment_%04d.ts");
    
    let mut ytdlp_cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut ytdlp_cmd);
    
    ytdlp_cmd
        .arg(&url)
        .arg("-o").arg("-")
        .arg("--quiet")
        .arg("--no-part")
        .arg("--impersonate").arg("chrome")
        .arg("--ffmpeg-location").arg(&ffmpeg_path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    
    let mut ytdlp_child = ytdlp_cmd.spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;
    
    let ytdlp_stdout = ytdlp_child.stdout.take()
        .ok_or("Failed to get yt-dlp stdout")?;
    
    if let Some(ytdlp_stderr) = ytdlp_child.stderr.take() {
        let broadcast_log = broadcast_id.clone();
        let streamer_log = streamer_id.clone();
        let app_log = app.clone();
        
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(ytdlp_stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                println!("[TwitterRecorder] yt-dlp: {}", line);
                let _ = app_log.emit("recorder-log", TwitterRecorderLogPayload {
                    streamer_id: streamer_log.clone(),
                    broadcast_id: broadcast_log.clone(),
                    mint_id: broadcast_log.clone(),
                    message: line,
                    level: "info".to_string(),
                });
            }
        });
    }
    
    let ytdlp_stdout_std: std::process::Stdio = ytdlp_stdout.try_into()
        .map_err(|e| format!("Failed to convert stdout: {}", e))?;
    
    let mut ffmpeg_cmd = tokio::process::Command::new(&ffmpeg_path);
    no_window(&mut ffmpeg_cmd);
    
    ffmpeg_cmd
        .arg("-i").arg("pipe:0")
        .arg("-c:v").arg("copy")
        .arg("-c:a").arg("copy")
        .arg("-f").arg("hls")
        .arg("-hls_time").arg(hls_segment_seconds.to_string())
        .arg("-hls_list_size").arg("0")
        .arg("-hls_flags").arg("append_list+omit_endlist+temp_file")
        .arg("-hls_segment_filename").arg(segment_pattern.to_string_lossy().to_string())
        .arg(playlist_path.to_string_lossy().to_string())
        .stdin(ytdlp_stdout_std)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped());
    
    let mut ffmpeg_child = ffmpeg_cmd.spawn()
        .map_err(|e| format!("Failed to spawn FFmpeg: {}", e))?;
    
    // Drain FFmpeg stderr in background - only log important lines to avoid flooding
    if let Some(ffmpeg_stderr) = ffmpeg_child.stderr.take() {
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(ffmpeg_stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                // Only log important FFmpeg lines to avoid flooding server logs
                let dominated = line.contains("Opening") || line.contains("Skip");
                if !dominated {
                    println!("[TwitterRecorder] FFmpeg: {}", line);
                }
            }
        });
    }
    
    let mut last_emitted_segment: u32 = 0;
    
    loop {
        tokio::select! {
            status = ffmpeg_child.wait() => {
                println!("[TwitterRecorder] FFmpeg exited: {:?}", status);
                let _ = ytdlp_child.kill().await;
                
                let exit_status = status.ok();
                let _ = app.emit("recorder-exit", TwitterRecorderExitPayload {
                    streamer_id: streamer_id.clone(),
                    session_id: session_id.clone(),
                    broadcast_id: broadcast_id.clone(),
                    mint_id: broadcast_id.clone(),
                    code: exit_status.as_ref().and_then(|s| s.code()),
                });
                
                // If FFmpeg exited unsuccessfully, stream likely ended
                if let Some(exit_status) = exit_status {
                    if !exit_status.success() {
                        let _ = app.emit("stream-ended", TwitterStreamEndedPayload {
                            streamer_id: streamer_id.clone(),
                            session_id: session_id.clone(),
                            broadcast_id: broadcast_id.clone(),
                            mint_id: broadcast_id.clone(),
                        });
                    }
                }
                
                break;
            }
            
            _ = &mut stop_rx => {
                println!("[TwitterRecorder] Stop signal received");
                let _ = ffmpeg_child.kill().await;
                let _ = ytdlp_child.kill().await;
                break;
            }
            
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(2)) => {
                // Sequential segment detection: check for the next expected segment
                // With +temp_file flag, FFmpeg writes to .tmp then renames to .ts when complete
                let next_segment_index = last_emitted_segment;
                let seg_path = PathBuf::from(&output_dir).join(format!("segment_{:04}.ts", next_segment_index));
                
                if seg_path.exists() {
                    // Verify file is stable (not still being written)
                    let size1 = std::fs::metadata(&seg_path).ok().map(|m| m.len());
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    let size2 = std::fs::metadata(&seg_path).ok().map(|m| m.len());
                    
                    if let (Some(s1), Some(s2)) = (size1, size2) {
                        if s1 == s2 && s1 > 0 {
                            println!("[TwitterRecorder] Segment {} ready (size: {} bytes)", next_segment_index, s1);
                            
                            let segment_number = next_segment_index + 1;
                            
                            let _ = app.emit("segment-ready", TwitterSegmentReadyPayload {
                                streamer_id: streamer_id.clone(),
                                session_id: session_id.clone(),
                                broadcast_id: broadcast_id.clone(),
                                mint_id: broadcast_id.clone(),
                                segment: segment_number,
                                path: seg_path.to_string_lossy().to_string(),
                                duration: hls_segment_seconds as f64,
                            });
                            
                            last_emitted_segment = segment_number;
                        }
                    }
                }
            }
        }
    }
    
    Ok(())
}

/// Stop recording a Twitter broadcast or Space
/// Stops ALL sessions recording this broadcast (both temp viewer and persistent auto-detect)
#[tauri::command]
pub async fn stop_twitter_recording(url: String) -> Result<(), String> {
    let normalized_url = normalize_twitter_url(&url);
    let broadcast_id = extract_broadcast_id(&normalized_url)?;
    
    // Find all sessions recording this broadcast and collect their entries
    let entries: Vec<(String, TwitterRecordingEntry)> = {
        let mut recordings = TWITTER_ACTIVE_RECORDINGS.lock().unwrap();
        let session_ids: Vec<String> = recordings
            .iter()
            .filter(|(_, entry)| entry.broadcast_id == broadcast_id)
            .map(|(session_id, _)| session_id.clone())
            .collect();

        session_ids
            .into_iter()
            .filter_map(|session_id| {
                recordings.remove(&session_id).map(|entry| (session_id, entry))
            })
            .collect()
    };
    
    for (session_id, mut entry) in entries {
        if let Some(stop_tx) = entry.stop_tx.take() {
            let _ = stop_tx.send(());
        }
        if let Err(err) = entry.task.await {
            eprintln!("[TwitterRecorder] Join error for session {}: {}", session_id, err);
        }
    }
    
    Ok(())
}

/// Stop a specific Twitter recording session by session_id
/// Unlike stop_twitter_recording which stops ALL sessions for a broadcast,
/// this only stops the one specific session, leaving others untouched.
#[tauri::command]
pub async fn stop_twitter_recording_session(session_id: String) -> Result<(), String> {
    let entry_opt = {
        let mut recordings = TWITTER_ACTIVE_RECORDINGS.lock().unwrap();
        recordings.remove(&session_id)
    };

    if let Some(mut entry) = entry_opt {
        if let Some(stop_tx) = entry.stop_tx.take() {
            let _ = stop_tx.send(());
        }
        if let Err(err) = entry.task.await {
            eprintln!("[TwitterRecorder] Join error for session {}: {}", session_id, err);
        }
        println!("[TwitterRecorder] Stopped session: {}", session_id);
    } else {
        println!("[TwitterRecorder] No active session found for: {}", session_id);
    }

    Ok(())
}

/// Stop all active Twitter recordings
#[tauri::command]
pub async fn stop_all_twitter_recordings() -> Result<(), String> {
    let entries: Vec<(String, TwitterRecordingEntry)> = {
        let mut recordings = TWITTER_ACTIVE_RECORDINGS.lock().unwrap();
        recordings.drain().collect()
    };
    
    for (session_id, mut entry) in entries {
        if let Some(stop_tx) = entry.stop_tx.take() {
            let _ = stop_tx.send(());
        }
        if let Err(err) = entry.task.await {
            eprintln!("[TwitterRecorder] Join error for session {}: {}", session_id, err);
        }
    }
    
    Ok(())
}

/// Get the output directory for a Twitter recording session
#[tauri::command]
pub fn get_twitter_session_output_dir(session_id: String) -> Result<String, String> {
    let output_dir = storage::get_livestream_recordings_dir()?;
    let session_dir = output_dir.join(&session_id);
    Ok(session_dir.to_string_lossy().to_string())
}

/// Get list of active Twitter recording session IDs
#[tauri::command]
pub fn get_active_twitter_recordings() -> Result<Vec<String>, String> {
    let recordings = TWITTER_ACTIVE_RECORDINGS.lock().unwrap();
    Ok(recordings.keys().cloned().collect())
}

/// Check if a Twitter recording is currently active for a broadcast
#[tauri::command]
pub fn is_twitter_recording_active(url: String) -> bool {
    let normalized_url = normalize_twitter_url(&url);
    if let Ok(broadcast_id) = extract_broadcast_id(&normalized_url) {
        TWITTER_ACTIVE_RECORDINGS
            .lock()
            .unwrap()
            .values()
            .any(|entry| entry.broadcast_id == broadcast_id)
    } else {
        false
    }
}

/// Get metadata for a Twitter broadcast/space using yt-dlp
#[tauri::command]
pub async fn get_twitter_broadcast_info(url: String) -> Result<String, String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    let normalized_url = normalize_twitter_url(&url);
    
    println!("[Twitter] Fetching metadata for URL: {}", normalized_url);
    
    let mut cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut cmd);
    
    cmd.arg("--dump-json")
        .arg("--skip-download")
        .arg("--verbose")
        .arg("--impersonate").arg("chrome")
        .arg(&normalized_url);
    
    let output = cmd.output().await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;
    
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    
    // Log stderr for debugging (yt-dlp writes verbose output to stderr)
    if !stderr.is_empty() {
        println!("[Twitter] yt-dlp stderr: {}", stderr);
    }
    
    if !output.status.success() {
        eprintln!("[Twitter] yt-dlp failed with exit code: {:?}", output.status.code());
        eprintln!("[Twitter] stderr: {}", stderr);
        return Err(format!("yt-dlp failed: {}", stderr));
    }
    
    if stdout.trim().is_empty() {
        eprintln!("[Twitter] yt-dlp returned empty stdout");
        eprintln!("[Twitter] stderr: {}", stderr);
        return Err("No metadata returned from yt-dlp. The broadcast may be unavailable or expired.".to_string());
    }
    
    println!("[Twitter] Successfully fetched metadata ({} bytes)", stdout.len());
    
    // Return the JSON metadata
    Ok(stdout.to_string())
}

/// Get duration for a Twitter broadcast using yt-dlp + ffprobe
/// First extracts the direct stream URL using yt-dlp, then uses ffprobe to get duration
#[tauri::command]
pub async fn get_twitter_broadcast_duration(_app: tauri::AppHandle, manifest_url: String) -> Result<f64, String> {
    println!("[Twitter] Getting duration for URL: {}", manifest_url);
    
    // Step 1: Use yt-dlp to extract the direct stream URL
    let ytdlp_path = resolve_ytdlp_binary()?;
    
    println!("[Twitter] Extracting stream URL via yt-dlp...");
    let ytdlp_output = no_window(
        tokio::process::Command::new(&ytdlp_path)
            .arg("--get-url")
            .arg("--no-download")
            .arg("--no-warnings")
            .arg("--impersonate").arg("chrome")
            .arg(&manifest_url)
    )
    .output()
    .await
    .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;
    
    if !ytdlp_output.status.success() {
        let stderr = String::from_utf8_lossy(&ytdlp_output.stderr);
        return Err(format!("yt-dlp failed to extract stream URL: {}", stderr.chars().take(300).collect::<String>()));
    }
    
    let stream_url = String::from_utf8_lossy(&ytdlp_output.stdout).trim().to_string();
    if stream_url.is_empty() {
        return Err("yt-dlp returned empty stream URL".to_string());
    }
    
    println!("[Twitter] Got stream URL, probing duration with ffprobe...");
    
    // Step 2: Use ffprobe on the direct stream URL
    let ffprobe_path = resolve_sidecar_binary("ffprobe")?;
    
    let mut cmd = tokio::process::Command::new(&ffprobe_path);
    no_window(&mut cmd);
    
    let output = cmd
        .args([
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            &stream_url
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffprobe failed: {}", stderr));
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let duration_str = stdout.trim();
    
    println!("[Twitter] ffprobe duration output: {}", duration_str);
    
    if duration_str.is_empty() || duration_str == "N/A" {
        return Err("Duration not available".to_string());
    }
    
    duration_str.parse::<f64>()
        .map_err(|e| format!("Failed to parse duration: {}", e))
}

/// Download Twitter broadcast thumbnail and return as data URL
#[tauri::command]
pub async fn download_twitter_thumbnail(thumbnail_url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    let response = client.get(&thumbnail_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download thumbnail: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }
    
    let content_type = response.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();
    
    let bytes = response.bytes()
        .await
        .map_err(|e| format!("Failed to read thumbnail bytes: {}", e))?;
    
    let base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", content_type, base64))
}

/// Download a Twitter broadcast using yt-dlp
#[tauri::command]
pub async fn download_twitter_vod(
    app: tauri::AppHandle,
    download_id: String,
    title: String,
    vod_url: String,
    broadcast_id: String,
) -> Result<(), String> {
    use crate::downloads::{ACTIVE_DOWNLOADS, ACTIVE_DOWNLOAD_CANCELLERS, DOWNLOAD_METADATA, DownloadMetadata, DownloadResult, DownloadProgress};
    
    let ytdlp_path = resolve_ytdlp_binary()?;
    let ffmpeg_path = resolve_ffmpeg_binary()?;
    
    // Check if download already exists
    {
        let mut downloads = ACTIVE_DOWNLOADS.lock().unwrap();
        if downloads.contains_key(&download_id) {
            println!("[Twitter] Download already in progress: {}", download_id);
            return Err("Download already in progress".to_string());
        }
        downloads.insert(download_id.clone(), true);
    }

    // Resolve output path from storage
    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let safe_title = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    let filename = format!("twitter_{}_{}_{}.mp4", broadcast_id, safe_title, timestamp);
    let output_file = paths.videos.join(&filename);
    
    // Clean up when done
    let cleanup_download = {
        let download_id = download_id.clone();
        let downloads = ACTIVE_DOWNLOADS.clone();
        move || {
            println!("[Twitter] Cleaning up download: {}", download_id);
            let mut downloads = downloads.lock().unwrap();
            downloads.remove(&download_id);
        }
    };
    
    let (cancel_tx, mut cancel_rx) = oneshot::channel::<()>();
    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.insert(download_id.clone(), cancel_tx);
    }
    
    let download_id_clone = download_id.clone();
    let app_clone = app.clone();
    let output_file_str = output_file.to_string_lossy().to_string();

    // Store download metadata
    {
        let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
        metadata_map.insert(download_id.clone(), DownloadMetadata {
            output_path: Some(output_file_str.clone()),
            thumbnail_path: None,
            started_at: std::time::SystemTime::now(),
            process_id: None,
        });
    }
    
    // Fetch video duration for time-based progress
    println!("[Twitter] Fetching video duration for {}", broadcast_id);
    let total_duration = match get_twitter_broadcast_info(vod_url.clone()).await {
        Ok(json_str) => {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&json_str) {
                json.get("duration").and_then(|d| d.as_f64())
            } else {
                None
            }
        }
        Err(e) => {
            println!("[Twitter] Failed to fetch duration: {}", e);
            None
        }
    };
    
    if let Some(dur) = total_duration {
        println!("[Twitter] Video duration: {:.2}s", dur);
    }
    
    // Send initial progress
    let _ = app.emit("download-progress", DownloadProgress {
        download_id: download_id.clone(),
        progress: 0.0,
        current_time: None,
        total_time: total_duration,
        status: "Starting download...".to_string(),
    });
    
    tokio::spawn(async move {
        let mut cmd = tokio::process::Command::new(&ytdlp_path);
        no_window(&mut cmd);
        
        // yt-dlp --ffmpeg-location expects a DIRECTORY so it can find both ffmpeg and ffprobe
        let ffmpeg_dir = std::path::Path::new(&ffmpeg_path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ffmpeg_path.clone());
        
        cmd.arg(&vod_url)
            .arg("-o").arg(&output_file_str)
            .arg("--impersonate").arg("chrome")
            .arg("--ffmpeg-location").arg(&ffmpeg_dir)
            .arg("--format").arg("bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best")
            .arg("--concurrent-fragments").arg("16")  // 16x parallel downloads for speed
            .arg("--merge-output-format").arg("mp4")
            .arg("--newline")
            .arg("--progress")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                cleanup_download();
                let _ = app_clone.emit("download-error", DownloadResult {
                    download_id: download_id_clone.clone(),
                    success: false,
                    file_path: None,
                    thumbnail_path: None,
                    duration: None,
                    width: None,
                    height: None,
                    codec: None,
                    file_size: None,
                    error: Some(format!("Failed to spawn yt-dlp: {}", e)),
                });
                return;
            }
        };
        
        let stdout = child.stdout.take().expect("Failed to get stdout");
        let stderr = child.stderr.take().expect("Failed to get stderr");
        
        use tokio::io::{AsyncBufReadExt, BufReader};
        let mut stdout_reader = BufReader::new(stdout).lines();
        let mut stderr_reader = BufReader::new(stderr).lines();
        
        loop {
            tokio::select! {
                _ = &mut cancel_rx => {
                    println!("[Twitter] Download cancelled: {}", download_id_clone);
                    let _ = child.kill().await;
                    cleanup_download();
                    let _ = app_clone.emit("download-error", DownloadResult {
                        download_id: download_id_clone.clone(),
                        success: false,
                        file_path: None,
                        thumbnail_path: None,
                        duration: None,
                        width: None,
                        height: None,
                        codec: None,
                        file_size: None,
                        error: Some("Download cancelled".to_string()),
                    });
                    return;
                }
                line = stdout_reader.next_line() => {
                    match line {
                        Ok(Some(line)) => {
                            // Log all stdout for debugging
                            println!("[Twitter] yt-dlp: {}", line);
                            
                            if line.contains("[download]") && line.contains("%") {
                                if let Some(percent_str) = line.split_whitespace()
                                    .find(|s| s.ends_with('%'))
                                    .and_then(|s| s.trim_end_matches('%').parse::<f64>().ok())
                                {
                                    // Calculate current time from percentage if we have total duration
                                    let current_time = total_duration.map(|dur| (percent_str / 100.0) * dur);
                                    
                                    let _ = app_clone.emit("download-progress", DownloadProgress {
                                        download_id: download_id_clone.clone(),
                                        progress: percent_str,
                                        current_time,
                                        total_time: total_duration,
                                        status: format!("Downloading... {}%", percent_str as u32),
                                    });
                                }
                            }
                        }
                        Ok(None) => break,
                        Err(_) => break,
                    }
                }
                line = stderr_reader.next_line() => {
                    if let Ok(Some(line)) = line {
                        println!("[Twitter] yt-dlp stderr: {}", line);
                        
                        // Parse FFmpeg progress output: out_time=HH:MM:SS.MS
                        if line.starts_with("out_time=") && total_duration.is_some() {
                            if let Some(time_str) = line.strip_prefix("out_time=") {
                                // Parse time format HH:MM:SS.MS or -577014:32:22.775807 (invalid)
                                if !time_str.starts_with('-') {
                                    let parts: Vec<&str> = time_str.split(':').collect();
                                    if parts.len() == 3 {
                                        if let (Ok(hours), Ok(mins), Ok(secs)) = (
                                            parts[0].parse::<f64>(),
                                            parts[1].parse::<f64>(),
                                            parts[2].parse::<f64>()
                                        ) {
                                            let current_time = hours * 3600.0 + mins * 60.0 + secs;
                                            let total_dur = total_duration.unwrap();
                                            let progress = (current_time / total_dur * 100.0).min(100.0);
                                            
                                            let _ = app_clone.emit("download-progress", DownloadProgress {
                                                download_id: download_id_clone.clone(),
                                                progress,
                                                current_time: Some(current_time),
                                                total_time: total_duration,
                                                status: format!("Downloading... {}%", progress as u32),
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        let status = child.wait().await;
        cleanup_download();
        
        match status {
            Ok(exit_status) if exit_status.success() => {
                // Get file metadata
                let file_size = std::fs::metadata(&output_file_str).ok().map(|m| m.len());
                
                // Generate thumbnail
                println!("[Twitter] Generating thumbnail...");
                let thumbnail_path = paths.thumbnails.join(format!("{}_thumb.jpg", filename.replace(".mp4", "")));
                let thumbnail_result = no_window(tokio::process::Command::new(&ffmpeg_path)
                    .args([
                        "-hwaccel", "auto",
                        "-ss", "00:00:05",
                        "-i", &output_file_str,
                        "-vframes", "1",
                        "-vf", "scale=320:-1",
                        "-y",
                        thumbnail_path.to_str().unwrap_or(""),
                    ]))
                    .output()
                    .await;
                
                let thumbnail_path_str = match thumbnail_result {
                    Ok(output) if output.status.success() => {
                        println!("[Twitter] Thumbnail generated: {}", thumbnail_path.display());
                        Some(thumbnail_path.to_string_lossy().to_string())
                    }
                    _ => {
                        println!("[Twitter] Thumbnail generation failed");
                        None
                    }
                };
                
                // Get video info
                println!("[Twitter] Getting video info...");
                let video_path = std::path::Path::new(&output_file_str);
                let video_info = crate::ffmpeg_utils::get_video_info(&app_clone, video_path).await.ok();
                let (width, height, codec, duration) = if let Some(ref info) = video_info {
                    println!("[Twitter] Video info - width: {}, height: {}, codec: {}, duration: {:?}", 
                        info.width, info.height, info.codec, info.duration);
                    (Some(info.width), Some(info.height), Some(info.codec.clone()), info.duration)
                } else {
                    println!("[Twitter] Could not get video info");
                    (None, None, None, None)
                };
                
                let _ = app_clone.emit("download-complete", DownloadResult {
                    download_id: download_id_clone,
                    success: true,
                    file_path: Some(output_file_str.clone()),
                    thumbnail_path: thumbnail_path_str,
                    duration,
                    width,
                    height,
                    codec,
                    file_size,
                    error: None,
                });
            }
            _ => {
                let _ = app_clone.emit("download-error", DownloadResult {
                    download_id: download_id_clone,
                    success: false,
                    file_path: None,
                    thumbnail_path: None,
                    duration: None,
                    width: None,
                    height: None,
                    codec: None,
                    file_size: None,
                    error: Some("Download failed".to_string()),
                });
            }
        }
    });
    
    Ok(())
}

// Helper functions

/// Normalize Twitter/X URL to twitter.com format for yt-dlp compatibility
fn normalize_twitter_url(url: &str) -> String {
    url.trim()
        .replace("x.com", "twitter.com")
        .replace("https://twitter.com", "https://twitter.com") // Ensure https
}

/// Extract broadcast or space ID from URL
fn extract_broadcast_id(url: &str) -> Result<String, String> {
    if let Some(broadcast_part) = url.split("/i/broadcasts/").nth(1) {
        Ok(broadcast_part.split('/').next().unwrap_or("").to_string())
    } else if let Some(space_part) = url.split("/i/spaces/").nth(1) {
        Ok(space_part.split('/').next().unwrap_or("").to_string())
    } else {
        Err("Could not extract broadcast/space ID from URL".to_string())
    }
}

/// Resolve a sidecar binary path using Tauri's naming convention.
/// Tauri places sidecars next to the executable with -{target_triple} suffix.
/// In dev mode, they're in src-tauri/binaries/ with the same naming.
fn resolve_sidecar_binary(base_name: &str) -> Result<String, String> {
    let exe_path =
        std::env::current_exe().map_err(|e| format!("Failed to get executable path: {}", e))?;

    let exe_dir = exe_path.parent().ok_or("Failed to get parent directory")?;

    let target_triple = get_target_triple();

    #[cfg(target_os = "windows")]
    let binary_name = format!("{}-{}.exe", base_name, target_triple);

    #[cfg(not(target_os = "windows"))]
    let binary_name = format!("{}-{}", base_name, target_triple);

    // Production: sidecar is next to the executable
    let prod_path = exe_dir.join(&binary_name);
    if prod_path.exists() {
        println!(
            "[Twitter] Found {} at (prod): {}",
            base_name,
            prod_path.display()
        );
        return Ok(prod_path.to_string_lossy().to_string());
    }

    // macOS production bundle: Tauri strips the target triple from sidecar names
    #[cfg(target_os = "windows")]
    let bare_name = format!("{}.exe", base_name);
    #[cfg(not(target_os = "windows"))]
    let bare_name = base_name.to_string();

    let bare_path = exe_dir.join(&bare_name);
    if bare_path.exists() {
        println!(
            "[Twitter] Found {} at (bundle): {}",
            base_name,
            bare_path.display()
        );
        return Ok(bare_path.to_string_lossy().to_string());
    }

    // Development mode: check src-tauri/binaries/
    if let Some(target_dir) = exe_dir.parent() {
        if let Some(target_parent) = target_dir.parent() {
            let dev_path = target_parent.join("binaries").join(&binary_name);
            if dev_path.exists() {
                println!(
                    "[Twitter] Found {} at (dev): {}",
                    base_name,
                    dev_path.display()
                );
                return Ok(dev_path.to_string_lossy().to_string());
            }
        }
    }

    // Fallback to system PATH
    #[cfg(target_os = "windows")]
    let fallback = format!("{}.exe", base_name);

    #[cfg(not(target_os = "windows"))]
    let fallback = base_name.to_string();

    println!(
        "[Twitter] {} not found in bundle, falling back to PATH: {}",
        base_name, fallback
    );
    Ok(fallback)
}

fn get_target_triple() -> &'static str {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    return "x86_64-pc-windows-msvc";

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    return "x86_64-apple-darwin";

    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    return "aarch64-apple-darwin";

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    return "x86_64-unknown-linux-gnu";

    #[cfg(not(any(
        all(target_os = "windows", target_arch = "x86_64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "linux", target_arch = "x86_64")
    )))]
    compile_error!("Unsupported platform - only x86_64 Windows/Linux and x86_64/aarch64 macOS are supported");
}

fn resolve_ytdlp_binary() -> Result<String, String> {
    resolve_sidecar_binary("yt-dlp")
}

fn resolve_ffmpeg_binary() -> Result<String, String> {
    resolve_sidecar_binary("ffmpeg")
}

fn format_time_for_filename(seconds: f64) -> String {
    let h = (seconds / 3600.0) as u32;
    let m = ((seconds % 3600.0) / 60.0) as u32;
    let s = (seconds % 60.0) as u32;
    format!("{:02}{:02}{:02}", h, m, s)
}

/// Download a segment of a Twitter VOD using yt-dlp with time range
#[tauri::command]
pub async fn download_twitter_vod_segment(
    app: tauri::AppHandle,
    download_id: String,
    title: String,
    vod_url: String,
    broadcast_id: String,
    start_time: f64,
    end_time: f64,
) -> Result<(), String> {
    use crate::downloads::{ACTIVE_DOWNLOADS, ACTIVE_DOWNLOAD_CANCELLERS, DOWNLOAD_METADATA, DownloadMetadata, DownloadResult, DownloadProgress};
    
    println!("[Twitter] download_twitter_vod_segment called");
    
    if start_time < 0.0 || end_time <= start_time {
        return Err("Invalid time range specified".to_string());
    }

    let segment_duration = end_time - start_time;
    if segment_duration < 10.0 {
        return Err("Segment too short (minimum 10 seconds)".to_string());
    }

    {
        let mut downloads = ACTIVE_DOWNLOADS.lock().unwrap();
        if downloads.contains_key(&download_id) {
            return Err("Download already in progress".to_string());
        }
        downloads.insert(download_id.clone(), true);
    }

    let cleanup_download = {
        let download_id = download_id.clone();
        let downloads = ACTIVE_DOWNLOADS.clone();
        move || {
            let mut downloads = downloads.lock().unwrap();
            downloads.remove(&download_id);
        }
    };

    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let safe_title = title.chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    let start_formatted = format_time_for_filename(start_time);
    let end_formatted = format_time_for_filename(end_time);

    let filename = format!("twitter_{}_{}_{}_{}_{}.mp4", broadcast_id, safe_title, start_formatted, end_formatted, timestamp);
    let video_path = paths.videos.join(&filename);

    {
        let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
        metadata_map.insert(download_id.clone(), DownloadMetadata {
            output_path: Some(video_path.to_string_lossy().to_string()),
            thumbnail_path: None,
            started_at: std::time::SystemTime::now(),
            process_id: None,
        });
    }

    let _ = app.emit("download-progress", DownloadProgress {
        download_id: download_id.clone(),
        progress: 0.0,
        current_time: Some(0.0),
        total_time: Some(segment_duration),
        status: "Starting Twitter segment download...".to_string(),
    });

    let app_clone = app.clone();
    let download_id_clone = download_id.clone();

    let (cancel_tx, mut cancel_rx) = oneshot::channel();
    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.insert(download_id.clone(), cancel_tx);
    }

    let result = tokio::spawn(async move {
        let ytdlp_path = resolve_ytdlp_binary()?;
        let ffmpeg_path = resolve_ffmpeg_binary()?;
        let video_path_str = video_path.to_string_lossy().to_string();

        let section_arg = format!("*{:.0}-{:.0}", start_time, end_time);

        let mut cmd = tokio::process::Command::new(&ytdlp_path);
        no_window(&mut cmd);
        let ffmpeg_dir = std::path::Path::new(&ffmpeg_path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ffmpeg_path.clone());
        cmd.arg(&vod_url)
            .arg("-o").arg(&video_path_str)
            .arg("--impersonate").arg("chrome")
            .arg("--ffmpeg-location").arg(&ffmpeg_dir)
            .arg("--format").arg("bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best")
            .arg("--concurrent-fragments").arg("16")  // 16x parallel downloads for speed
            .arg("--merge-output-format").arg("mp4")
            .arg("--download-sections").arg(&section_arg)
            .arg("--force-keyframes-at-cuts")
            .arg("--newline")
            .arg("--progress")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let app_for_progress = app_clone.clone();
        let download_id_for_progress = download_id_clone.clone();
        let segment_dur = segment_duration;
        
        let stdout_task = stdout.map(|stdout| tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            let mut last_progress_time = std::time::Instant::now();
            
            while let Ok(Some(line)) = lines.next_line().await {
                if line.contains("% of") {
                    if let Some(pct_str) = line.split('%').next() {
                        let pct_str = pct_str.trim_start_matches(|c: char| !c.is_ascii_digit() && c != '.');
                        if let Ok(pct) = pct_str.trim().parse::<f64>() {
                            if last_progress_time.elapsed().as_millis() >= 500 {
                                let _ = app_for_progress.emit("download-progress", DownloadProgress {
                                    download_id: download_id_for_progress.clone(),
                                    progress: pct.min(99.0),
                                    current_time: Some((pct / 100.0) * segment_dur),
                                    total_time: Some(segment_dur),
                                    status: format!("Downloading segment: {:.1}%", pct),
                                });
                                last_progress_time = std::time::Instant::now();
                            }
                        }
                    }
                }
            }
        }));

        let stderr_task = stderr.map(|stderr| tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(_)) = lines.next_line().await {}
        }));

        let status = tokio::select! {
            result = child.wait() => result.map_err(|e| format!("Failed to wait: {}", e))?,
            _ = &mut cancel_rx => {
                let _ = child.kill().await;
                if let Some(task) = stdout_task { task.abort(); }
                if let Some(task) = stderr_task { task.abort(); }
                return Err("Cancelled".to_string());
            }
        };

        if let Some(task) = stderr_task { let _ = task.await; }
        if let Some(task) = stdout_task { let _ = task.await; }

        if !status.success() {
            return Err(format!("yt-dlp failed: {:?}", status.code()));
        }

        if !video_path.exists() {
            return Err("File not found".to_string());
        }

        let file_size = std::fs::metadata(&video_path).ok().map(|m| m.len());

        let thumbnail_path = paths.thumbnails.join(format!("{}_thumb.jpg", filename.replace(".mp4", "")));
        let mut thumb_cmd = tokio::process::Command::new(&ffmpeg_path);
        let thumbnail_result = no_window(&mut thumb_cmd)
            .args(["-hwaccel", "auto", "-ss", "00:00:01", "-i", &video_path_str, "-vframes", "1", "-vf", "scale=320:-1", "-y", thumbnail_path.to_str().unwrap_or("")])
            .output()
            .await;

        let thumbnail_path_str = match thumbnail_result {
            Ok(output) if output.status.success() => Some(thumbnail_path.to_string_lossy().to_string()),
            _ => None,
        };

        let video_info = tokio::time::timeout(
            std::time::Duration::from_secs(30),
            crate::ffmpeg_utils::get_video_info(&app_clone, &video_path)
        ).await;
        
        let (width, height, codec, actual_duration) = match video_info {
            Ok(Ok(info)) => (Some(info.width), Some(info.height), Some(info.codec.clone()), info.duration),
            _ => (None, None, None, None),
        };

        Ok(DownloadResult {
            download_id: download_id_clone,
            success: true,
            file_path: Some(video_path_str),
            thumbnail_path: thumbnail_path_str,
            duration: Some(actual_duration.unwrap_or(segment_duration)),
            width,
            height,
            codec,
            file_size,
            error: None,
        })
    }).await;

    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.remove(&download_id);
    }
    cleanup_download();

    match result {
        Ok(Ok(download_result)) => {
            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 100.0,
                current_time: None,
                total_time: None,
                status: "Completed!".to_string(),
            });
            let _ = app.emit("download-complete", download_result);
            Ok(())
        }
        Ok(Err(e)) => {
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
                error: Some(e.clone()),
            });
            Err(e)
        }
        Err(e) => {
            let error_msg = format!("Task failed: {}", e);
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
                error: Some(error_msg.clone()),
            });
            Err(error_msg)
        }
    }
}
