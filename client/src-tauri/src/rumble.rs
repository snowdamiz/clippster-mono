use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
};

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tokio::sync::oneshot;
use tauri::Emitter;

use crate::storage;
use tokio::io::AsyncBufReadExt;
use crate::downloads::{
    DownloadProgress, DownloadResult, ACTIVE_DOWNLOADS, ACTIVE_DOWNLOAD_CANCELLERS, DOWNLOAD_METADATA,
    DownloadMetadata,
};

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
struct RumbleRecordingEntry {
    stop_tx: Option<oneshot::Sender<()>>,
    task: tokio::task::JoinHandle<()>,
}

static RUMBLE_ACTIVE_RECORDINGS: Lazy<Arc<Mutex<HashMap<String, RumbleRecordingEntry>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Event payloads for frontend communication
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RumbleSegmentReadyPayload {
    streamer_id: String,
    session_id: String,
    channel_name: String,
    segment: u32,
    path: String,
    duration: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RumbleRecorderLogPayload {
    streamer_id: String,
    channel_name: String,
    message: String,
    level: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RumbleStreamEndedPayload {
    streamer_id: String,
    session_id: String,
    channel_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RumbleRecorderExitPayload {
    streamer_id: String,
    session_id: String,
    channel_name: String,
    code: Option<i32>,
}

/// Simplified live status response for frontend
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RumbleLiveStatus {
    pub is_live: bool,
    pub channel_name: Option<String>,
    pub stream_title: Option<String>,
    pub viewer_count: Option<i64>,
    pub thumbnail_url: Option<String>,
    pub started_at: Option<String>,
}

/// VOD info from yt-dlp
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RumbleVod {
    pub video_id: String,
    pub title: Option<String>,
    pub duration: Option<f64>,
    pub view_count: Option<i64>,
    pub thumbnail_url: Option<String>,
    pub upload_date: Option<String>,
    pub url: String,
}

/// Check if a Rumble channel is live using yt-dlp metadata
/// 
/// # Arguments
/// * `channel` - Rumble channel name or URL
#[tauri::command]
pub async fn check_rumble_livestream(channel: String) -> Result<String, String> {
    let channel_name = normalize_channel_name(&channel);
    let ytdlp_path = resolve_ytdlp_binary()?;

    // Use --flat-playlist to list the channel's videos without downloading.
    // The live stream (if any) will have is_live=true in the entry.
    let channel_url = channel_to_url(&channel_name);

    let mut cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut cmd);

    cmd.arg("--flat-playlist")
        .arg("--dump-single-json")
        .arg("--no-warnings")
        .arg("--playlist-end").arg("5")
        .arg(&channel_url);

    let output = cmd.output().await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse the playlist JSON and look for a live entry
    if let Ok(playlist) = serde_json::from_str::<serde_json::Value>(stdout.trim()) {
        if let Some(entries) = playlist["entries"].as_array() {
            for entry in entries {
                let is_live = entry["is_live"].as_bool().unwrap_or(false)
                    || entry["live_status"].as_str().map(|s| s == "is_live").unwrap_or(false);
                if is_live {
                    let status = RumbleLiveStatus {
                        is_live: true,
                        channel_name: Some(channel_name),
                        stream_title: entry["title"].as_str().map(String::from),
                        viewer_count: entry["view_count"].as_i64(),
                        thumbnail_url: entry["thumbnail"].as_str().map(String::from),
                        started_at: entry["timestamp"].as_i64().map(|t| t.to_string()),
                    };
                    return Ok(serde_json::to_string(&status).unwrap());
                }
            }
        }
    }

    // Not live
    let status = RumbleLiveStatus {
        is_live: false,
        channel_name: Some(channel_name),
        stream_title: None,
        viewer_count: None,
        thumbnail_url: None,
        started_at: None,
    };
    Ok(serde_json::to_string(&status).unwrap())
}

/// Get list of VODs from a Rumble channel using yt-dlp
#[tauri::command]
pub async fn get_rumble_vods(channel: String, limit: Option<u32>) -> Result<String, String> {
    let channel_name = normalize_channel_name(&channel);
    let ytdlp_path = resolve_ytdlp_binary()?;
    
    let limit_str = limit.unwrap_or(10).to_string();
    let channel_url = channel_to_url(&channel_name);
    
    println!("[Rumble VODs] Fetching from: {}", channel_url);

    let mut cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut cmd);

    cmd.arg("--dump-json")
        .arg("--skip-download")
        .arg("--no-warnings")
        .arg("--ignore-errors")
        .arg("--playlist-end").arg(&limit_str)
        .arg(&channel_url);

    let output = cmd.output().await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if stdout.trim().is_empty() {
        return Err(format!("yt-dlp returned no output. stderr: {}", &stderr[..stderr.len().min(500)]));
    }

    let mut vods = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }
        let json: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let video_id = match json["id"].as_str() {
            Some(id) if !id.is_empty() => id.to_string(),
            _ => continue,
        };

        let url = json["webpage_url"].as_str()
            .map(String::from)
            .unwrap_or_else(|| format!("https://rumble.com/v{}.html", video_id));

        let vod = RumbleVod {
            video_id,
            title: json["title"].as_str().map(String::from),
            duration: json["duration"].as_f64(),
            view_count: json["view_count"].as_i64(),
            thumbnail_url: json["thumbnail"].as_str().map(String::from),
            upload_date: json["upload_date"].as_str().map(String::from),
            url,
        };
        vods.push(vod);
    }

    Ok(serde_json::to_string(&vods).unwrap())
}

/// Download a Rumble VOD using yt-dlp
#[tauri::command]
pub async fn download_rumble_vod(
    app: tauri::AppHandle,
    download_id: String,
    title: String,
    vod_url: String,
    channel_name: String,
) -> Result<(), String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    let ffmpeg_path = resolve_ffmpeg_binary()?;
    
    // Check if download already exists
    {
        let mut downloads = ACTIVE_DOWNLOADS.lock().unwrap();
        if downloads.contains_key(&download_id) {
            println!("[Rumble] Download already in progress: {}", download_id);
            return Err("Download already in progress".to_string());
        }
        downloads.insert(download_id.clone(), true);
    }

    // Resolve output path from storage (same as Twitch/Kick)
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

    let filename = format!("rumble_{}_{}_{}.mp4", channel_name, safe_title, timestamp);
    let output_file = paths.videos.join(&filename);
    
    // Clean up when done
    let cleanup_download = {
        let download_id = download_id.clone();
        let downloads = ACTIVE_DOWNLOADS.clone();
        move || {
            println!("[Rumble] Cleaning up download: {}", download_id);
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
    
    tokio::spawn(async move {
        let mut cmd = tokio::process::Command::new(&ytdlp_path);
        no_window(&mut cmd);
        
        cmd.arg("--ffmpeg-location").arg(&ffmpeg_path)
            .arg("-o").arg(&output_file_str)
            .arg("--newline")
            .arg(&vod_url)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        
        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
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
        
        let stderr = child.stderr.take().unwrap();
        
        let app_progress = app_clone.clone();
        let download_id_progress = download_id_clone.clone();
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(stderr);
            let mut lines = reader.lines();
            
            while let Ok(Some(line)) = lines.next_line().await {
                if line.contains("[download]") && line.contains("%") {
                    if let Some(percent_str) = line.split_whitespace()
                        .find(|s| s.ends_with('%'))
                        .and_then(|s| s.trim_end_matches('%').parse::<f64>().ok())
                    {
                        let _ = app_progress.emit("download-progress", DownloadProgress {
                            download_id: download_id_progress.clone(),
                            progress: percent_str,
                            current_time: None,
                            total_time: None,
                            status: "downloading".to_string(),
                        });
                    }
                }
            }
        });
        
        tokio::select! {
            status = child.wait() => {
                {
                    let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
                    cancellers.remove(&download_id_clone);
                }
                
                match status {
                    Ok(exit_status) if exit_status.success() => {
                        cleanup_download();
                        let _ = app_clone.emit("download-complete", DownloadResult {
                            download_id: download_id_clone,
                            success: true,
                            file_path: Some(output_file_str),
                            thumbnail_path: None,
                            duration: None,
                            width: None,
                            height: None,
                            codec: None,
                            file_size: None,
                            error: None,
                        });
                    }
                    Ok(exit_status) => {
                        cleanup_download();
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
                            error: Some(format!("yt-dlp exited with code: {:?}", exit_status.code())),
                        });
                    }
                    Err(e) => {
                        cleanup_download();
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
                            error: Some(format!("Failed to wait for yt-dlp: {}", e)),
                        });
                    }
                }
            }
            _ = &mut cancel_rx => {
                let _ = child.kill().await;
                {
                    let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
                    cancellers.remove(&download_id_clone);
                }
                cleanup_download();
                
                let _ = app_clone.emit("download-cancelled", DownloadResult {
                    download_id: download_id_clone,
                    success: false,
                    file_path: None,
                    thumbnail_path: None,
                    duration: None,
                    width: None,
                    height: None,
                    codec: None,
                    file_size: None,
                    error: Some("Download cancelled by user".to_string()),
                });
            }
        }
    });
    
    Ok(())
}

/// Start recording a Rumble livestream using yt-dlp
#[tauri::command]
pub async fn start_rumble_recording(
    app: tauri::AppHandle,
    channel: String,
    streamer_id: String,
    session_id: String,
    segment_duration_minutes: Option<u32>,
) -> Result<(), String> {
    let channel_name = normalize_channel_name(&channel);
    
    if RUMBLE_ACTIVE_RECORDINGS.lock().unwrap().contains_key(&channel_name) {
        println!("[Rumble] Recording already active for {}, sharing existing session", channel_name);
        return Ok(());
    }
    
    let output_dir = storage::get_livestream_recordings_dir()?;
    let session_dir = output_dir.join(&session_id);
    std::fs::create_dir_all(&session_dir)
        .map_err(|e| format!("Failed to create session directory: {}", e))?;
    
    // Use 4-second segments by default for smooth live playback.
    // If segment_duration_minutes is provided (persistent recording), convert to seconds.
    let segment_duration_secs = segment_duration_minutes
        .map(|m| m * 60)
        .unwrap_or(4);
    let (stop_tx, stop_rx) = oneshot::channel();
    
    let channel_clone = channel_name.clone();
    let streamer_clone = streamer_id.clone();
    let session_clone = session_id.clone();
    let output_str = session_dir.to_string_lossy().to_string();
    let app_handle = app.clone();
    
    let task = tokio::spawn(async move {
        if let Err(err) = run_rumble_recorder(
            app_handle,
            channel_clone.clone(),
            streamer_clone,
            session_clone,
            output_str,
            segment_duration_secs,
            stop_rx,
        ).await {
            eprintln!("[RumbleRecorder] {}", err);
        }
        
        RUMBLE_ACTIVE_RECORDINGS.lock().unwrap().remove(&channel_clone);
    });
    
    RUMBLE_ACTIVE_RECORDINGS.lock().unwrap().insert(
        channel_name,
        RumbleRecordingEntry {
            stop_tx: Some(stop_tx),
            task,
        },
    );
    
    Ok(())
}

async fn run_rumble_recorder(
    app: tauri::AppHandle,
    channel_name: String,
    streamer_id: String,
    session_id: String,
    output_dir: String,
    segment_duration_secs: u32,
    mut stop_rx: oneshot::Receiver<()>,
) -> Result<(), String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    let ffmpeg_path = resolve_ffmpeg_binary()?;
    
    let hls_segment_seconds = segment_duration_secs;
    let playlist_path = PathBuf::from(&output_dir).join("playlist.m3u8");
    let segment_pattern = PathBuf::from(&output_dir).join("segment_%04d.ts");
    
    // Resolve the live video URL from the channel page first.
    // The channel page is a playlist; we need the actual live video URL for streaming.
    let channel_url = channel_to_url(&channel_name);
    println!("[RumbleRecorder] Resolving live stream URL from: {}", channel_url);

    let mut resolve_cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut resolve_cmd);
    resolve_cmd
        .arg("--flat-playlist")
        .arg("--dump-single-json")
        .arg("--no-warnings")
        .arg("--playlist-end").arg("5")
        .arg(&channel_url);

    let resolve_output = resolve_cmd.output().await
        .map_err(|e| format!("Failed to resolve live URL: {}", e))?;
    let resolve_stdout = String::from_utf8_lossy(&resolve_output.stdout);

    // Find the live entry and get its URL
    let stream_url = if let Ok(playlist) = serde_json::from_str::<serde_json::Value>(resolve_stdout.trim()) {
        if let Some(entries) = playlist["entries"].as_array() {
            entries.iter().find(|e| {
                e["is_live"].as_bool().unwrap_or(false)
                    || e["live_status"].as_str().map(|s| s == "is_live").unwrap_or(false)
            }).and_then(|e| {
                e["url"].as_str().map(String::from)
                    .or_else(|| e["id"].as_str().map(|id| format!("https://rumble.com/v{}.html", id)))
            })
        } else { None }
    } else { None };

    let stream_url = stream_url.unwrap_or_else(|| {
        println!("[RumbleRecorder] No live entry found, falling back to channel URL");
        channel_url.clone()
    });

    println!("[RumbleRecorder] Streaming from: {}", stream_url);

    let mut ytdlp_cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut ytdlp_cmd);

    ytdlp_cmd
        .arg(&stream_url)
        .arg("-o").arg("-")
        .arg("--quiet")
        .arg("--no-part")
        .arg("--ffmpeg-location").arg(&ffmpeg_path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    
    let mut ytdlp_child = ytdlp_cmd.spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;
    
    let ytdlp_stdout = ytdlp_child.stdout.take()
        .ok_or("Failed to get yt-dlp stdout")?;
    
    if let Some(ytdlp_stderr) = ytdlp_child.stderr.take() {
        let channel_log = channel_name.clone();
        let streamer_log = streamer_id.clone();
        let app_log = app.clone();
        
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(ytdlp_stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                println!("[RumbleRecorder] yt-dlp: {}", line);
                let _ = app_log.emit("rumble-recorder-log", RumbleRecorderLogPayload {
                    streamer_id: streamer_log.clone(),
                    channel_name: channel_log.clone(),
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
    
    if let Some(ffmpeg_stderr) = ffmpeg_child.stderr.take() {
        let channel_log = channel_name.clone();
        let streamer_log = streamer_id.clone();
        let app_log = app.clone();
        
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(ffmpeg_stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                println!("[RumbleRecorder] FFmpeg: {}", line);
                let _ = app_log.emit("rumble-recorder-log", RumbleRecorderLogPayload {
                    streamer_id: streamer_log.clone(),
                    channel_name: channel_log.clone(),
                    message: line,
                    level: "info".to_string(),
                });
            }
        });
    }
    
    let mut last_emitted_segment: u32 = 0;
    
    loop {
        tokio::select! {
            status = ffmpeg_child.wait() => {
                println!("[RumbleRecorder] FFmpeg exited: {:?}", status);
                let _ = ytdlp_child.kill().await;
                
                let exit_status = status.ok();
                let _ = app.emit("rumble-recorder-exit", RumbleRecorderExitPayload {
                    streamer_id: streamer_id.clone(),
                    session_id: session_id.clone(),
                    channel_name: channel_name.clone(),
                    code: exit_status.as_ref().and_then(|s| s.code()),
                });
                
                // If FFmpeg exited unsuccessfully, stream likely ended
                if let Some(exit_status) = exit_status {
                    if !exit_status.success() {
                        let _ = app.emit("stream-ended", RumbleStreamEndedPayload {
                            streamer_id: streamer_id.clone(),
                            session_id: session_id.clone(),
                            channel_name: channel_name.clone(),
                        });
                    }
                }
                
                break;
            }
            
            _ = &mut stop_rx => {
                println!("[RumbleRecorder] Stop signal received");
                let _ = ffmpeg_child.kill().await;
                let _ = ytdlp_child.kill().await;
                break;
            }
            
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(2)) => {
                let next_segment_index = last_emitted_segment;
                let seg_path = PathBuf::from(&output_dir).join(format!("segment_{:04}.ts", next_segment_index));
                
                if seg_path.exists() {
                    let size1 = std::fs::metadata(&seg_path).ok().map(|m| m.len());
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    let size2 = std::fs::metadata(&seg_path).ok().map(|m| m.len());
                    
                    if let (Some(s1), Some(s2)) = (size1, size2) {
                        if s1 == s2 && s1 > 0 {
                            let segment_number = next_segment_index + 1;
                            
                            let _ = app.emit("rumble-segment-ready", RumbleSegmentReadyPayload {
                                streamer_id: streamer_id.clone(),
                                session_id: session_id.clone(),
                                channel_name: channel_name.clone(),
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

/// Stop recording a Rumble livestream
#[tauri::command]
pub async fn stop_rumble_recording(channel: String) -> Result<(), String> {
    let channel_name = normalize_channel_name(&channel);
    
    let entry_opt = {
        let mut recordings = RUMBLE_ACTIVE_RECORDINGS.lock().unwrap();
        recordings.remove(&channel_name)
    };
    
    if let Some(mut entry) = entry_opt {
        if let Some(stop_tx) = entry.stop_tx.take() {
            let _ = stop_tx.send(());
        }
        
        let _ = entry.task.await;
        println!("[Rumble] Stopped recording for {}", channel_name);
        Ok(())
    } else {
        Err(format!("No active recording for channel: {}", channel_name))
    }
}

/// Stop all active Rumble recordings
#[tauri::command]
pub async fn stop_all_rumble_recordings() -> Result<(), String> {
    let channels: Vec<String> = {
        let recordings = RUMBLE_ACTIVE_RECORDINGS.lock().unwrap();
        recordings.keys().cloned().collect()
    };
    
    for channel in channels {
        let _ = stop_rumble_recording(channel).await;
    }
    
    Ok(())
}

/// Get the output directory for a Rumble recording session
#[tauri::command]
pub fn get_rumble_session_output_dir(session_id: String) -> Result<String, String> {
    let output_dir = storage::get_livestream_recordings_dir()?;
    let session_dir = output_dir.join(&session_id);
    Ok(session_dir.to_string_lossy().to_string())
}

/// Get list of active Rumble recordings
#[tauri::command]
pub fn get_active_rumble_recordings() -> Result<Vec<String>, String> {
    let recordings = RUMBLE_ACTIVE_RECORDINGS.lock().unwrap();
    Ok(recordings.keys().cloned().collect())
}

// Helper functions

fn normalize_channel_name(input: &str) -> String {
    let trimmed = input.trim();

    // Full URL: extract path segment after /c/ or /user/
    if trimmed.contains("rumble.com") {
        if let Some(part) = trimmed.split("/c/").nth(1) {
            return format!("c/{}", part.split('/').next().unwrap_or(part));
        }
        if let Some(part) = trimmed.split("/user/").nth(1) {
            return format!("user/{}", part.split('/').next().unwrap_or(part));
        }
    }

    // Frontend already normalised to "c/name" or "user/name" or plain name
    trimmed.to_string()
}

fn channel_to_url(channel_name: &str) -> String {
    if channel_name.starts_with("c/") || channel_name.starts_with("user/") {
        format!("https://rumble.com/{}", channel_name)
    } else {
        format!("https://rumble.com/c/{}", channel_name)
    }
}

fn resolve_ytdlp_binary() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    let binary_name = "yt-dlp.exe";
    
    #[cfg(not(target_os = "windows"))]
    let binary_name = "yt-dlp";
    
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable directory: {}", e))?
        .parent()
        .ok_or("Failed to get parent directory")?
        .to_path_buf();
    
    let ytdlp_path = exe_dir.join(binary_name);
    
    if ytdlp_path.exists() {
        Ok(ytdlp_path)
    } else {
        Err(format!("yt-dlp binary not found at: {}", ytdlp_path.display()))
    }
}

fn resolve_ffmpeg_binary() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    let binary_name = "ffmpeg.exe";
    
    #[cfg(not(target_os = "windows"))]
    let binary_name = "ffmpeg";
    
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable directory: {}", e))?
        .parent()
        .ok_or("Failed to get parent directory")?
        .to_path_buf();
    
    let ffmpeg_path = exe_dir.join(binary_name);
    
    if ffmpeg_path.exists() {
        Ok(ffmpeg_path)
    } else {
        Err(format!("ffmpeg binary not found at: {}", ffmpeg_path.display()))
    }
}
