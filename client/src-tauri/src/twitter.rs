use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
};

use once_cell::sync::Lazy;
use serde::Serialize;
use tokio::sync::oneshot;
use tauri::Emitter;

use crate::storage;
use tokio::io::AsyncBufReadExt;

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
}

static TWITTER_ACTIVE_RECORDINGS: Lazy<Arc<Mutex<HashMap<String, TwitterRecordingEntry>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Event payloads for frontend communication
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TwitterSegmentReadyPayload {
    streamer_id: String,
    session_id: String,
    broadcast_id: String,
    segment: u32,
    path: String,
    duration: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TwitterRecorderLogPayload {
    streamer_id: String,
    broadcast_id: String,
    message: String,
    level: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TwitterStreamEndedPayload {
    streamer_id: String,
    session_id: String,
    broadcast_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TwitterRecorderExitPayload {
    streamer_id: String,
    session_id: String,
    broadcast_id: String,
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
    
    // Check if already recording this broadcast
    if TWITTER_ACTIVE_RECORDINGS.lock().unwrap().contains_key(&broadcast_id) {
        println!("[Twitter] Recording already active for {}, sharing existing session", broadcast_id);
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
        
        TWITTER_ACTIVE_RECORDINGS.lock().unwrap().remove(&broadcast_clone);
    });
    
    TWITTER_ACTIVE_RECORDINGS.lock().unwrap().insert(
        broadcast_id,
        TwitterRecordingEntry {
            stop_tx: Some(stop_tx),
            task,
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
    
    let hls_segment_seconds = segment_duration_minutes * 60;
    let playlist_path = PathBuf::from(&output_dir).join("playlist.m3u8");
    let segment_pattern = PathBuf::from(&output_dir).join("segment_%04d.ts");
    
    let mut ytdlp_cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut ytdlp_cmd);
    
    ytdlp_cmd
        .arg(&url)
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
        let broadcast_log = broadcast_id.clone();
        let streamer_log = streamer_id.clone();
        let app_log = app.clone();
        
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(ytdlp_stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                println!("[TwitterRecorder] yt-dlp: {}", line);
                let _ = app_log.emit("twitter-recorder-log", TwitterRecorderLogPayload {
                    streamer_id: streamer_log.clone(),
                    broadcast_id: broadcast_log.clone(),
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
        let broadcast_log = broadcast_id.clone();
        let streamer_log = streamer_id.clone();
        let app_log = app.clone();
        
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(ffmpeg_stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                println!("[TwitterRecorder] FFmpeg: {}", line);
                let _ = app_log.emit("twitter-recorder-log", TwitterRecorderLogPayload {
                    streamer_id: streamer_log.clone(),
                    broadcast_id: broadcast_log.clone(),
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
                println!("[TwitterRecorder] FFmpeg exited: {:?}", status);
                let _ = ytdlp_child.kill().await;
                
                let exit_status = status.ok();
                let _ = app.emit("twitter-recorder-exit", TwitterRecorderExitPayload {
                    streamer_id: streamer_id.clone(),
                    session_id: session_id.clone(),
                    broadcast_id: broadcast_id.clone(),
                    code: exit_status.as_ref().and_then(|s| s.code()),
                });
                
                // If FFmpeg exited unsuccessfully, stream likely ended
                if let Some(exit_status) = exit_status {
                    if !exit_status.success() {
                        let _ = app.emit("stream-ended", TwitterStreamEndedPayload {
                            streamer_id: streamer_id.clone(),
                            session_id: session_id.clone(),
                            broadcast_id: broadcast_id.clone(),
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
                let next_segment_index = last_emitted_segment;
                let seg_path = PathBuf::from(&output_dir).join(format!("segment_{:04}.ts", next_segment_index));
                
                if seg_path.exists() {
                    let size1 = std::fs::metadata(&seg_path).ok().map(|m| m.len());
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    let size2 = std::fs::metadata(&seg_path).ok().map(|m| m.len());
                    
                    if let (Some(s1), Some(s2)) = (size1, size2) {
                        if s1 == s2 && s1 > 0 {
                            let segment_number = next_segment_index + 1;
                            
                            let _ = app.emit("twitter-segment-ready", TwitterSegmentReadyPayload {
                                streamer_id: streamer_id.clone(),
                                session_id: session_id.clone(),
                                broadcast_id: broadcast_id.clone(),
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
#[tauri::command]
pub async fn stop_twitter_recording(url: String) -> Result<(), String> {
    let normalized_url = normalize_twitter_url(&url);
    let broadcast_id = extract_broadcast_id(&normalized_url)?;
    
    let entry_opt = {
        let mut recordings = TWITTER_ACTIVE_RECORDINGS.lock().unwrap();
        recordings.remove(&broadcast_id)
    };
    
    if let Some(mut entry) = entry_opt {
        if let Some(stop_tx) = entry.stop_tx.take() {
            let _ = stop_tx.send(());
        }
        
        let _ = entry.task.await;
        println!("[Twitter] Stopped recording for {}", broadcast_id);
        Ok(())
    } else {
        Err(format!("No active recording for broadcast: {}", broadcast_id))
    }
}

/// Stop all active Twitter recordings
#[tauri::command]
pub async fn stop_all_twitter_recordings() -> Result<(), String> {
    let broadcast_ids: Vec<String> = {
        let recordings = TWITTER_ACTIVE_RECORDINGS.lock().unwrap();
        recordings.keys().cloned().collect()
    };
    
    for broadcast_id in broadcast_ids {
        let url = format!("https://twitter.com/i/broadcasts/{}", broadcast_id);
        let _ = stop_twitter_recording(url).await;
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

/// Get list of active Twitter recordings
#[tauri::command]
pub fn get_active_twitter_recordings() -> Result<Vec<String>, String> {
    let recordings = TWITTER_ACTIVE_RECORDINGS.lock().unwrap();
    Ok(recordings.keys().cloned().collect())
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
