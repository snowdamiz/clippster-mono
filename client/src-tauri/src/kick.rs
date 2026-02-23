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

#[cfg(target_os = "windows")]
#[allow(unused_imports)]
use std::os::windows::process::CommandExt;

/// On Windows, set CREATE_NO_WINDOW flag to prevent a visible console window.
/// On other platforms, this is a no-op.
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
struct KickRecordingEntry {
    stop_tx: Option<oneshot::Sender<()>>,
    task: tokio::task::JoinHandle<()>,
    channel_slug: String, // Store channel_slug to allow lookup by channel
}

// Track recordings by session_id instead of channel_slug to allow multiple sessions per channel
// This enables both temp viewer sessions (4-sec segments) and persistent auto-detect sessions (5-min segments)
// to record the same channel simultaneously in different directories
static KICK_ACTIVE_RECORDINGS: Lazy<Arc<Mutex<HashMap<String, KickRecordingEntry>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Event payloads for frontend communication
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct KickSegmentReadyPayload {
    streamer_id: String,
    session_id: String,
    channel_slug: String,
    mint_id: String, // For Kick, this is the same as channel_slug
    segment: u32,
    path: String,
    duration: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct KickRecorderLogPayload {
    streamer_id: String,
    channel_slug: String,
    message: String,
    level: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct KickStreamEndedPayload {
    streamer_id: String,
    session_id: String,
    channel_slug: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct KickRecorderExitPayload {
    streamer_id: String,
    session_id: String,
    channel_slug: String,
    code: Option<i32>,
}

/// HTTP client for Kick's public API (api.kick.com).
/// This endpoint is NOT behind Cloudflare JS challenges, unlike kick.com/api/v2.
static KICK_API_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .expect("Failed to build reqwest client")
});

/// Simplified live status response for frontend
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KickLiveStatus {
    pub is_live: bool,
    pub channel_id: Option<i64>,
    pub channel_slug: Option<String>,
    pub username: Option<String>,
    pub profile_image_url: Option<String>,
    pub stream_title: Option<String>,
    pub viewer_count: Option<i64>,
    pub thumbnail_url: Option<String>,
    pub playback_url: Option<String>,
    pub started_at: Option<String>,
}

/// Check if a Kick channel is live using api.kick.com (fast, no Cloudflare).
/// This endpoint returns livestream metadata instantly without spawning yt-dlp.
/// The playback_url is not available from this endpoint — use get_kick_stream_url
/// or fetch_kick_playback_url (via yt-dlp) when the actual HLS URL is needed.
/// 
/// # Arguments
/// * `channel` - The Kick channel slug/username (e.g., "xqc", "ninja")
#[tauri::command]
pub async fn check_kick_livestream(channel: String) -> Result<String, String> {
    let channel_slug = normalize_channel_slug(&channel);

    // First fetch channel metadata to get username and profile image
    let channel_url = format!("https://api.kick.com/private/v1/channels/{}", channel_slug);
    println!("[Kick] Fetching channel metadata for {} via api.kick.com", channel_slug);

    let channel_response = KICK_API_CLIENT
        .get(&channel_url)
        .header("Accept", "application/json")
        .send()
        .await;

    let (username, profile_image_url, channel_id) = match channel_response {
        Ok(resp) if resp.status().is_success() => {
            match resp.text().await {
                Ok(body) => {
                    println!("[Kick] Channel API response body (first 500 chars): {}", body.chars().take(500).collect::<String>());
                    match serde_json::from_str::<serde_json::Value>(&body) {
                        Ok(json) => {
                            // Try multiple possible response structures
                            // 1. Check if data exists at root level
                            let data = json.get("data").or(Some(&json));
                            
                            // Try to get username from multiple possible locations
                            let username = data
                                .and_then(|d| {
                                    d.get("username")
                                        .or_else(|| d.get("user").and_then(|u| u.get("username")))
                                        .or_else(|| d.get("slug"))
                                })
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string());
                            
                            // Try to get profile image from multiple possible locations
                            let profile_image = data
                                .and_then(|d| {
                                    d.get("profile_image_url")
                                        .or_else(|| d.get("user").and_then(|u| u.get("profile_pic")))
                                        .or_else(|| d.get("user").and_then(|u| u.get("profile_image_url")))
                                        .or_else(|| d.get("profile_pic"))
                                })
                                .and_then(|v| v.as_str())
                                .filter(|s| !s.is_empty())
                                .map(|s| s.to_string());
                            
                            let chan_id = data
                                .and_then(|d| d.get("id"))
                                .and_then(|v| v.as_i64());
                            
                            println!("[Kick] Parsed channel metadata - username: {:?}, profile_image: {:?}, id: {:?}", 
                                username, profile_image.as_ref().map(|s| s.chars().take(50).collect::<String>()), chan_id);
                            (username, profile_image, chan_id)
                        }
                        Err(e) => {
                            println!("[Kick] Failed to parse channel API JSON: {}", e);
                            (None, None, None)
                        }
                    }
                }
                Err(e) => {
                    println!("[Kick] Failed to read channel API response body: {}", e);
                    (None, None, None)
                }
            }
        }
        Ok(resp) => {
            println!("[Kick] Channel API returned non-success status: {}", resp.status());
            (None, None, None)
        }
        Err(e) => {
            println!("[Kick] Channel API request failed: {}", e);
            (None, None, None)
        }
    };

    // Now check livestream status
    let api_url = format!("https://api.kick.com/private/v1/channels/{}/livestream", channel_slug);
    println!("[Kick] Checking livestream status for {} via api.kick.com", channel_slug);

    let response = KICK_API_CLIENT
        .get(&api_url)
        .header("Accept", "application/json")
        .send()
        .await;

    match response {
        Ok(resp) if resp.status().is_success() => {
            let body = resp.text().await
                .map_err(|e| format!("Failed to read api.kick.com response: {}", e))?;

            let json: serde_json::Value = serde_json::from_str(&body)
                .map_err(|e| format!("Failed to parse api.kick.com response: {}", e))?;

            // Check if livestream data exists in the response
            let livestream = json.pointer("/data/livestream");

            if let Some(ls) = livestream {
                // Channel has livestream data — it's live
                let title = ls.pointer("/metadata/title")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let viewers = ls.get("viewers_count").and_then(|v| v.as_i64());
                let thumbnail = ls.get("thumbnail_url")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string());
                let started_at = ls.get("started_at")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                println!("[Kick] Channel {} is live: {}", channel_slug, title.as_deref().unwrap_or("?"));

                let status = KickLiveStatus {
                    is_live: true,
                    channel_id,
                    channel_slug: Some(channel_slug),
                    username,
                    profile_image_url,
                    stream_title: title,
                    viewer_count: viewers,
                    thumbnail_url: thumbnail,
                    playback_url: None, // Not available from this endpoint
                    started_at,
                };
                return Ok(serde_json::to_string(&status).unwrap());
            } else {
                // No livestream data — channel is not live
                println!("[Kick] Channel {} is not live", channel_slug);
                let status = KickLiveStatus {
                    is_live: false,
                    channel_id,
                    channel_slug: Some(channel_slug),
                    username,
                    profile_image_url,
                    stream_title: None,
                    viewer_count: None,
                    thumbnail_url: None,
                    playback_url: None,
                    started_at: None,
                };
                return Ok(serde_json::to_string(&status).unwrap());
            }
        }
        Ok(resp) => {
            println!("[Kick] api.kick.com returned {} for {}, channel likely doesn't exist", resp.status(), channel_slug);
            let status = KickLiveStatus {
                is_live: false,
                channel_id,
                channel_slug: Some(channel_slug),
                username,
                profile_image_url,
                stream_title: None,
                viewer_count: None,
                thumbnail_url: None,
                playback_url: None,
                started_at: None,
            };
            return Ok(serde_json::to_string(&status).unwrap());
        }
        Err(e) => {
            println!("[Kick] api.kick.com request failed for {}: {}", channel_slug, e);
            // Return not-live on network errors rather than failing the whole command
            let status = KickLiveStatus {
                is_live: false,
                channel_id,
                channel_slug: Some(channel_slug),
                username,
                profile_image_url,
                stream_title: None,
                viewer_count: None,
                thumbnail_url: None,
                playback_url: None,
                started_at: None,
            };
            return Ok(serde_json::to_string(&status).unwrap());
        }
    }
}

/// Get the HLS stream URL for a Kick channel using yt-dlp.
/// yt-dlp handles Kick's Cloudflare challenges internally.
#[tauri::command]
pub async fn get_kick_stream_url(channel: String) -> Result<String, String> {
    let channel_slug = normalize_channel_slug(&channel);
    let ytdlp_path = resolve_ytdlp_binary()?;
    let kick_url = format!("https://kick.com/{}", channel_slug);

    println!("[Kick] Getting stream URL for {} via yt-dlp", channel_slug);

    let output = no_window(tokio::process::Command::new(&ytdlp_path)
        .arg("--get-url")
        .arg("--no-download")
        .arg("--no-warnings")
        .arg(&kick_url))
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Channel not live or not found: {}", stderr.chars().take(300).collect::<String>()));
    }

    let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if url.is_empty() {
        return Err("yt-dlp returned empty URL".to_string());
    }

    println!("[Kick] Got stream URL for {}", channel_slug);
    Ok(url)
}

/// Get the target triple for the current platform (matches Tauri's sidecar naming)
fn get_target_triple() -> &'static str {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    return "x86_64-pc-windows-msvc";
    
    #[cfg(all(target_os = "windows", target_arch = "aarch64"))]
    return "aarch64-pc-windows-msvc";
    
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    return "x86_64-unknown-linux-gnu";
    
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    return "aarch64-unknown-linux-gnu";
    
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    return "x86_64-apple-darwin";
    
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    return "aarch64-apple-darwin";
}

/// Resolve a sidecar binary path using Tauri's naming convention.
/// Tauri places sidecars next to the executable with -{target_triple} suffix.
/// In dev mode, they're in src-tauri/binaries/ with the same naming.
fn resolve_sidecar_binary(base_name: &str) -> Result<String, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;
    
    let exe_dir = exe_path
        .parent()
        .ok_or("Failed to get parent directory")?;

    let target_triple = get_target_triple();
    
    #[cfg(target_os = "windows")]
    let binary_name = format!("{}-{}.exe", base_name, target_triple);
    
    #[cfg(not(target_os = "windows"))]
    let binary_name = format!("{}-{}", base_name, target_triple);

    // Production: sidecar is next to the executable
    let prod_path = exe_dir.join(&binary_name);
    if prod_path.exists() {
        println!("[Kick] Found {} at (prod): {}", base_name, prod_path.display());
        return Ok(prod_path.to_string_lossy().to_string());
    }

    // macOS production bundle: Tauri strips the target triple from sidecar names
    #[cfg(target_os = "windows")]
    let bare_name = format!("{}.exe", base_name);
    #[cfg(not(target_os = "windows"))]
    let bare_name = base_name.to_string();

    let bare_path = exe_dir.join(&bare_name);
    if bare_path.exists() {
        println!("[Kick] Found {} at (bundle): {}", base_name, bare_path.display());
        return Ok(bare_path.to_string_lossy().to_string());
    }

    // Development mode: check src-tauri/binaries/
    // In dev, exe is in target/debug/, binaries are in src-tauri/binaries/
    if let Some(target_dir) = exe_dir.parent() {
        if let Some(target_parent) = target_dir.parent() {
            let dev_path = target_parent.join("binaries").join(&binary_name);
            if dev_path.exists() {
                println!("[Kick] Found {} at (dev): {}", base_name, dev_path.display());
                return Ok(dev_path.to_string_lossy().to_string());
            }
        }
    }

    // Fallback to system PATH
    #[cfg(target_os = "windows")]
    let fallback = format!("{}.exe", base_name);
    
    #[cfg(not(target_os = "windows"))]
    let fallback = base_name.to_string();
    
    println!("[Kick] {} not found in bundle, falling back to PATH: {}", base_name, fallback);
    Ok(fallback)
}

/// Resolve the yt-dlp binary path
fn resolve_ytdlp_binary() -> Result<String, String> {
    resolve_sidecar_binary("yt-dlp")
}

/// Check if yt-dlp is available on the system
#[tauri::command]
pub async fn check_ytdlp_available() -> Result<bool, String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    
    let output = no_window(tokio::process::Command::new(&ytdlp_path)
        .arg("--version"))
        .output()
        .await;

    match output {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

/// Get yt-dlp version info
#[tauri::command]
pub async fn get_ytdlp_version() -> Result<String, String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    
    let output = no_window(tokio::process::Command::new(&ytdlp_path)
        .arg("--version"))
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(format!("yt-dlp {}", version))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("yt-dlp error: {}", stderr))
    }
}

/// Normalize channel slug from various input formats
/// Handles: "xqc", "kick.com/xqc", "https://kick.com/xqc", etc.
fn normalize_channel_slug(input: &str) -> String {
    let input = input.trim();
    
    // Remove protocol and domain if present
    let slug = if input.contains("kick.com/") {
        input.split("kick.com/").last().unwrap_or(input)
    } else {
        input
    };
    
    // Remove any trailing slashes or query params
    let slug = slug.split('?').next().unwrap_or(slug);
    let slug = slug.split('#').next().unwrap_or(slug);
    let slug = slug.trim_matches('/');
    
    slug.to_lowercase()
}

/// Start recording a Kick livestream using yt-dlp + FFmpeg
/// Records to segmented files for DVR and clipping functionality
#[tauri::command]
pub async fn start_kick_recording(
    app: tauri::AppHandle,
    channel_slug: String,
    streamer_id: String,
    session_id: String,
    segment_duration_minutes: Option<u32>,
) -> Result<(), String> {
    let channel_slug = normalize_channel_slug(&channel_slug);
    
    // Check if this specific session is already recording
    // Allow multiple sessions per channel (e.g., temp viewer + persistent auto-detect)
    if KICK_ACTIVE_RECORDINGS.lock().unwrap().contains_key(&session_id) {
        println!("[Kick] Session {} already recording, skipping duplicate start", session_id);
        return Ok(());
    }

    // Get output directory
    let output_dir = storage::get_livestream_recordings_dir()
        .map_err(|e| format!("Failed to get recordings directory: {}", e))?;
    
    let session_dir = output_dir.join(&session_id);
    std::fs::create_dir_all(&session_dir)
        .map_err(|e| format!("Failed to create session directory: {}", e))?;

    let segment_duration = segment_duration_minutes.unwrap_or(5);
    
    // Create stop channel
    let (stop_tx, stop_rx) = oneshot::channel();

    // Clone values for the async task
    let channel_clone = channel_slug.clone();
    let streamer_clone = streamer_id.clone();
    let session_clone = session_id.clone();
    let output_str = session_dir.to_string_lossy().to_string();
    let app_handle = app.clone();

    // Emit log that recording is starting
    let _ = app.emit("recorder-log", KickRecorderLogPayload {
        streamer_id: streamer_id.clone(),
        channel_slug: channel_slug.clone(),
        message: format!("Starting Kick recording for {}", channel_slug),
        level: "info".to_string(),
    });

    let streamer_for_err = streamer_id.clone();
    let channel_for_err = channel_slug.clone();
    let app_for_err = app.clone();
    let session_for_cleanup = session_id.clone();
    let task = tokio::spawn(async move {
        if let Err(err) = run_kick_recorder(
            app_handle,
            channel_clone,
            streamer_clone,
            session_clone,
            output_str,
            segment_duration,
            stop_rx,
        )
        .await
        {
            eprintln!("[KickRecorder] {}", err);
            // Emit error to frontend so it's visible in WebView console
            let _ = app_for_err.emit("recorder-log", KickRecorderLogPayload {
                streamer_id: streamer_for_err,
                channel_slug: channel_for_err,
                message: format!("Recording failed: {}", err),
                level: "error".to_string(),
            });
        }
        // Clean up the recording entry when the task exits (success or error)
        // Remove by session_id (not channel_slug) since we track by session now
        KICK_ACTIVE_RECORDINGS.lock().unwrap().remove(&session_for_cleanup);
        println!("[KickRecorder] Cleaned up recording entry for session {}", session_for_cleanup);
    });

    // Insert by session_id (not channel_slug) to allow multiple sessions per channel
    KICK_ACTIVE_RECORDINGS.lock().unwrap().insert(
        session_id.clone(),
        KickRecordingEntry {
            stop_tx: Some(stop_tx),
            task,
            channel_slug: channel_slug.clone(),
        },
    );

    Ok(())
}

/// Stop recording a Kick livestream
/// Stops ALL sessions recording this channel (both temp viewer and persistent auto-detect)
#[tauri::command]
pub async fn stop_kick_recording(channel_slug: String) -> Result<(), String> {
    let channel_slug = normalize_channel_slug(&channel_slug);
    
    // Find all sessions recording this channel and collect their entries
    // We need to collect entries (not just IDs) to avoid holding the lock across await
    let entries: Vec<(String, KickRecordingEntry)> = {
        let mut recordings = KICK_ACTIVE_RECORDINGS.lock().unwrap();
        let session_ids: Vec<String> = recordings
            .iter()
            .filter(|(_, entry)| entry.channel_slug == channel_slug)
            .map(|(session_id, _)| session_id.clone())
            .collect();
        
        session_ids
            .into_iter()
            .filter_map(|session_id| {
                recordings.remove(&session_id).map(|entry| (session_id, entry))
            })
            .collect()
    }; // Lock is dropped here
    
    // Stop each session (no lock held during await)
    for (session_id, entry) in entries {
        if let Some(tx) = entry.stop_tx {
            let _ = tx.send(());
        }
        if let Err(err) = entry.task.await {
            eprintln!("[KickRecorder] Join error for session {}: {}", session_id, err);
        }
    }
    
    Ok(())
}

/// Stop all active Kick recordings
#[tauri::command]
pub async fn stop_all_kick_recordings() -> Result<(), String> {
    let mut recordings = KICK_ACTIVE_RECORDINGS.lock().unwrap();
    for (_, entry) in recordings.drain() {
        if let Some(tx) = entry.stop_tx {
            let _ = tx.send(());
        }
    }
    Ok(())
}

/// Get count of active Kick recordings
#[allow(dead_code)]
pub fn get_active_kick_recordings_count() -> usize {
    KICK_ACTIVE_RECORDINGS.lock().unwrap().len()
}

/// Get list of active Kick recording channel slugs
#[tauri::command]
pub fn get_active_kick_recordings() -> Vec<String> {
    KICK_ACTIVE_RECORDINGS.lock().unwrap().keys().cloned().collect()
}

/// Check if a Kick recording is currently active for a channel
#[tauri::command]
pub fn is_kick_recording_active(channel_slug: String) -> bool {
    let channel_slug = normalize_channel_slug(&channel_slug);
    // Check if any session is recording this channel
    KICK_ACTIVE_RECORDINGS
        .lock()
        .unwrap()
        .values()
        .any(|entry| entry.channel_slug == channel_slug)
}

/// Get the output directory for a Kick session (for HLS playback)
#[tauri::command]
pub async fn get_kick_session_output_dir(session_id: String) -> Result<String, String> {
    let output_dir = storage::get_livestream_recordings_dir()
        .map_err(|e| format!("Failed to get recordings directory: {}", e))?;
    
    let session_dir = output_dir.join(&session_id);
    Ok(session_dir.to_string_lossy().to_string())
}

/// Resolve FFmpeg binary path
fn resolve_ffmpeg_binary() -> Result<String, String> {
    resolve_sidecar_binary("ffmpeg")
}

/// Fetch the HLS playback URL for a Kick channel using yt-dlp.
/// yt-dlp handles Kick's Cloudflare challenges internally.
async fn fetch_kick_playback_url(channel_slug: &str) -> Result<String, String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    let kick_url = format!("https://kick.com/{}", channel_slug);

    println!("[Kick] Fetching playback URL for {} via yt-dlp", channel_slug);

    let output = no_window(tokio::process::Command::new(&ytdlp_path)
        .arg("--get-url")
        .arg("--no-download")
        .arg("--no-warnings")
        .arg(&kick_url))
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Kick channel {} is not live or not found: {}", channel_slug, stderr.chars().take(300).collect::<String>()));
    }

    let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if url.is_empty() {
        return Err(format!("yt-dlp returned empty URL for {}", channel_slug));
    }

    println!("[Kick] Got playback URL for {}", channel_slug);
    Ok(url)
}

/// Run the recorder: fetch HLS playback URL via yt-dlp, then pass directly to FFmpeg.
/// yt-dlp handles Kick's Cloudflare challenges internally.
async fn run_kick_recorder(
    app: tauri::AppHandle,
    channel_slug: String,
    streamer_id: String,
    session_id: String,
    output_dir: String,
    segment_duration_minutes: u32,
    mut stop_rx: oneshot::Receiver<()>,
) -> Result<(), String> {
    let ffmpeg_path = resolve_ffmpeg_binary()?;

    let ffmpeg_exists = std::path::Path::new(&ffmpeg_path).exists();
    let _ = app.emit("recorder-log", KickRecorderLogPayload {
        streamer_id: streamer_id.clone(),
        channel_slug: channel_slug.clone(),
        message: format!("Resolved ffmpeg: {} (exists: {}), output: {}", ffmpeg_path, ffmpeg_exists, output_dir),
        level: "info".to_string(),
    });

    if !ffmpeg_exists {
        return Err(format!("ffmpeg binary not found at: {}", ffmpeg_path));
    }

    // Fetch the HLS playback URL directly from Kick's API
    let _ = app.emit("recorder-log", KickRecorderLogPayload {
        streamer_id: streamer_id.clone(),
        channel_slug: channel_slug.clone(),
        message: format!("Fetching stream URL from Kick API for {}", channel_slug),
        level: "info".to_string(),
    });

    let playback_url = fetch_kick_playback_url(&channel_slug).await?;

    let _ = app.emit("recorder-log", KickRecorderLogPayload {
        streamer_id: streamer_id.clone(),
        channel_slug: channel_slug.clone(),
        message: format!("Got playback URL, starting FFmpeg HLS capture for {}", channel_slug),
        level: "info".to_string(),
    });

    println!("[KickRecorder] Playback URL: {}", playback_url);

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

    // Spawn FFmpeg to read the Kick HLS stream directly and re-segment it
    let mut ffmpeg_cmd = tokio::process::Command::new(&ffmpeg_path);
    no_window(&mut ffmpeg_cmd);
    ffmpeg_cmd
        // Pass browser-like headers so Kick's CDN accepts the request
        .arg("-headers").arg("Referer: https://kick.com/\r\nOrigin: https://kick.com\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n")
        .arg("-i").arg(&playback_url)  // Direct HLS m3u8 URL from Kick API
        // Re-encode to H.264 Baseline + AAC for guaranteed MSE/WebView2 compatibility.
        // -c copy can pass through codecs (HEVC, VP9) that MSE rejects in production.
        .arg("-c:v").arg("libx264")
        .arg("-preset").arg("ultrafast")   // Minimize CPU usage for live streaming
        .arg("-tune").arg("zerolatency")   // Low-latency encoding
        .arg("-profile:v").arg("baseline") // Baseline profile = widest MSE compatibility
        .arg("-level").arg("4.0")
        .arg("-crf").arg("23")             // Reasonable quality
        .arg("-c:a").arg("aac")
        .arg("-b:a").arg("128k")
        .arg("-f").arg("hls")              // HLS output format
        .arg("-hls_time").arg(hls_segment_seconds.to_string())
        .arg("-hls_list_size").arg("0")    // Keep all segments in playlist
        .arg("-hls_flags").arg("append_list+omit_endlist+temp_file") // Live streaming flags + atomic writes
        .arg("-hls_segment_filename").arg(segment_pattern.to_string_lossy().to_string())
        .arg(playlist_path.to_string_lossy().to_string())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null()) // FFmpeg writes HLS to files, not stdout
        .stderr(std::process::Stdio::piped());

    println!("[KickRecorder] Starting ffmpeg HLS output to: {}", playlist_path.display());

    let mut ffmpeg_child = ffmpeg_cmd.spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

    // CRITICAL: Drain FFmpeg stderr in a background task to prevent pipe buffer deadlock.
    // FFmpeg writes progress and diagnostic info to stderr continuously.
    // On macOS, if this pipe buffer fills (~64KB), FFmpeg blocks and never produces HLS output.
    if let Some(ffmpeg_stderr) = ffmpeg_child.stderr.take() {
        let app_for_ffmpeg_stderr = app.clone();
        let streamer_id_for_ffmpeg = streamer_id.clone();
        let channel_slug_for_ffmpeg = channel_slug.clone();
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(ffmpeg_stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                // Only log important FFmpeg messages (errors, warnings) to avoid spam
                let line_lower = line.to_lowercase();
                if line_lower.contains("error") || line_lower.contains("fatal") {
                    println!("[KickRecorder] FFmpeg ERROR: {}", line);
                    let _ = app_for_ffmpeg_stderr.emit("recorder-log", KickRecorderLogPayload {
                        streamer_id: streamer_id_for_ffmpeg.clone(),
                        channel_slug: channel_slug_for_ffmpeg.clone(),
                        message: format!("FFmpeg: {}", line),
                        level: "error".to_string(),
                    });
                } else if line_lower.contains("warning") {
                    println!("[KickRecorder] FFmpeg warning: {}", line);
                } else {
                    // Silently drain other output (progress, codec info, etc.)
                    // This is the critical part - just reading it prevents the deadlock
                }
            }
        });
    }

    let recording_start = std::time::Instant::now();
    let mut last_emitted_segment: u32 = 0; // Track the last segment we emitted (1-indexed)
    let mut last_log_time = std::time::Instant::now();

    // Monitor for new segments and stop signal
    loop {
        tokio::select! {
            // Check if FFmpeg exited
            status = ffmpeg_child.wait() => {
                match status {
                    Ok(exit_status) => {
                        println!("[KickRecorder] FFmpeg exited with status: {:?}", exit_status);
                        let _ = app.emit("recorder-log", KickRecorderLogPayload {
                            streamer_id: streamer_id.clone(),
                            channel_slug: channel_slug.clone(),
                            message: format!("FFmpeg exited with status: {:?} (after {:.0}s, {} segments)", exit_status, recording_start.elapsed().as_secs_f64(), last_emitted_segment),
                            level: if exit_status.success() { "info".to_string() } else { "error".to_string() },
                        });

                        if !exit_status.success() {
                            // Stream might have ended - emit event
                            let _ = app.emit("stream-ended", KickStreamEndedPayload {
                                streamer_id: streamer_id.clone(),
                                session_id: session_id.clone(),
                                channel_slug: channel_slug.clone(),
                            });
                        }
                    }
                    Err(e) => {
                        eprintln!("[KickRecorder] FFmpeg wait error: {}", e);
                    }
                }
                break;
            }
            
            // Check for stop signal
            _ = &mut stop_rx => {
                println!("[KickRecorder] Stop signal received, killing processes...");
                let _ = ffmpeg_child.kill().await;
                break;
            }
            
            // Periodically check for new segments and emit events
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(2)) => {
                // Check for the next expected segment (FFmpeg uses 0-indexed naming)
                // We track last_emitted_segment in 1-indexed format for frontend
                // So next segment file is segment_{last_emitted_segment:04}.ts (0-indexed)
                let next_segment_index = last_emitted_segment; // 0-indexed file number
                let seg_path = PathBuf::from(&output_dir).join(format!("segment_{:04}.ts", next_segment_index));
                
                // Check if the next segment file exists and is stable (not being written)
                if seg_path.exists() {
                    // Verify file is stable by checking size twice with a small delay
                    let size1 = std::fs::metadata(&seg_path).ok().map(|m| m.len());
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    let size2 = std::fs::metadata(&seg_path).ok().map(|m| m.len());
                    
                    // If sizes match and file is non-empty, segment is complete
                    if let (Some(s1), Some(s2)) = (size1, size2) {
                        if s1 == s2 && s1 > 0 {
                            // Segment is ready - emit event
                            let segment_number = next_segment_index + 1; // Frontend expects 1-indexed
                            
                            println!("[KickRecorder] Segment {} ready: {} ({} bytes)", 
                                segment_number, seg_path.display(), s1);
                            
                            let _ = app.emit("segment-ready", KickSegmentReadyPayload {
                                streamer_id: streamer_id.clone(),
                                session_id: session_id.clone(),
                                channel_slug: channel_slug.clone(),
                                mint_id: channel_slug.clone(), // For Kick, mintId = channel_slug
                                segment: segment_number,
                                path: seg_path.to_string_lossy().to_string(),
                                duration: hls_segment_seconds as f64,
                            });
                            
                            last_emitted_segment = segment_number;
                        }
                    }
                }
                
                // Emit periodic status log (every 10 seconds)
                if last_log_time.elapsed().as_secs() >= 10 {
                    let _ = app.emit("recorder-log", KickRecorderLogPayload {
                        streamer_id: streamer_id.clone(),
                        channel_slug: channel_slug.clone(),
                        message: format!("Recording: {} segments, {:.0}s", 
                            last_emitted_segment, 
                            recording_start.elapsed().as_secs_f64()),
                        level: "info".to_string(),
                    });
                    last_log_time = std::time::Instant::now();
                }
            }
        }
    }

    // Emit exit event
    let _ = app.emit("recorder-exit", KickRecorderExitPayload {
        streamer_id,
        session_id,
        channel_slug,
        code: Some(0),
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_channel_slug() {
        assert_eq!(normalize_channel_slug("xqc"), "xqc");
        assert_eq!(normalize_channel_slug("XQC"), "xqc");
        assert_eq!(normalize_channel_slug("kick.com/xqc"), "xqc");
        assert_eq!(normalize_channel_slug("https://kick.com/xqc"), "xqc");
        assert_eq!(normalize_channel_slug("https://kick.com/xqc/"), "xqc");
        assert_eq!(normalize_channel_slug("https://kick.com/xqc?ref=123"), "xqc");
    }
}
