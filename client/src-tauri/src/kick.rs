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

// Recording state management
#[derive(Debug)]
struct KickRecordingEntry {
    stop_tx: Option<oneshot::Sender<()>>,
    task: tokio::task::JoinHandle<()>,
}

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

static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .expect("Failed to build reqwest client")
});

/// Response from Kick channel API
#[derive(Debug, Deserialize, Serialize)]
pub struct KickChannelResponse {
    pub id: Option<i64>,
    pub slug: Option<String>,
    pub user: Option<KickUser>,
    pub livestream: Option<KickLivestream>,
    pub playback_url: Option<String>,
    #[serde(default)]
    pub verified: bool,
    pub followers_count: Option<i64>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct KickUser {
    pub id: Option<i64>,
    pub username: Option<String>,
    pub profile_pic: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct KickLivestream {
    pub id: Option<i64>,
    pub slug: Option<String>,
    pub session_title: Option<String>,
    pub created_at: Option<String>,
    pub viewer_count: Option<i64>,
    pub thumbnail: Option<KickThumbnail>,
    pub is_live: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct KickThumbnail {
    pub url: Option<String>,
}

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

/// Check if a Kick channel is live
/// 
/// # Arguments
/// * `channel` - The Kick channel slug/username (e.g., "xqc", "ninja")
#[tauri::command]
pub async fn check_kick_livestream(channel: String) -> Result<String, String> {
    let channel_slug = normalize_channel_slug(&channel);
    
    // Kick's public API endpoint for channel info
    let url = format!("https://kick.com/api/v2/channels/{}", channel_slug);
    
    let response = HTTP_CLIENT
        .get(&url)
        .header("Accept", "application/json")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Referer", "https://kick.com/")
        .header("Origin", "https://kick.com")
        .header("Sec-Fetch-Dest", "empty")
        .header("Sec-Fetch-Mode", "cors")
        .header("Sec-Fetch-Site", "same-origin")
        .header("Sec-Ch-Ua", "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"")
        .header("Sec-Ch-Ua-Mobile", "?0")
        .header("Sec-Ch-Ua-Platform", "\"Windows\"")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if response.status() == 404 {
        // Channel not found
        let status = KickLiveStatus {
            is_live: false,
            channel_id: None,
            channel_slug: Some(channel_slug),
            username: None,
            profile_image_url: None,
            stream_title: None,
            viewer_count: None,
            thumbnail_url: None,
            playback_url: None,
            started_at: None,
        };
        return Ok(serde_json::to_string(&status).unwrap());
    }

    if !response.status().is_success() {
        return Err(format!("Kick API error: {}", response.status()));
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Parse the response
    let channel_data: KickChannelResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse Kick response: {} - Body: {}", e, &body[..body.len().min(500)]))?;

    // Build the live status response
    let is_live = channel_data.livestream.as_ref()
        .map(|ls| ls.is_live.unwrap_or(false))
        .unwrap_or(false);

    let status = KickLiveStatus {
        is_live,
        channel_id: channel_data.id,
        channel_slug: channel_data.slug.clone(),
        username: channel_data.user.as_ref().and_then(|u| u.username.clone()),
        profile_image_url: channel_data.user.as_ref().and_then(|u| u.profile_pic.clone()),
        stream_title: channel_data.livestream.as_ref().and_then(|ls| ls.session_title.clone()),
        viewer_count: channel_data.livestream.as_ref().and_then(|ls| ls.viewer_count),
        thumbnail_url: channel_data.livestream.as_ref()
            .and_then(|ls| ls.thumbnail.as_ref())
            .and_then(|t| t.url.clone()),
        playback_url: channel_data.playback_url,
        started_at: channel_data.livestream.as_ref().and_then(|ls| ls.created_at.clone()),
    };

    Ok(serde_json::to_string(&status).unwrap())
}

/// Get the HLS stream URL for a Kick channel
/// This extracts the m3u8 URL needed for playback and recording
#[tauri::command]
pub async fn get_kick_stream_url(channel: String) -> Result<String, String> {
    let channel_slug = normalize_channel_slug(&channel);
    
    // First check if channel is live and get playback URL
    let url = format!("https://kick.com/api/v2/channels/{}", channel_slug);
    
    let response = HTTP_CLIENT
        .get(&url)
        .header("Accept", "application/json")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Referer", "https://kick.com/")
        .header("Origin", "https://kick.com")
        .header("Sec-Fetch-Dest", "empty")
        .header("Sec-Fetch-Mode", "cors")
        .header("Sec-Fetch-Site", "same-origin")
        .header("Sec-Ch-Ua", "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"")
        .header("Sec-Ch-Ua-Mobile", "?0")
        .header("Sec-Ch-Ua-Platform", "\"Windows\"")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Channel not found or API error: {}", response.status()));
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let channel_data: KickChannelResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Check if live
    let is_live = channel_data.livestream.as_ref()
        .map(|ls| ls.is_live.unwrap_or(false))
        .unwrap_or(false);

    if !is_live {
        return Err("Channel is not currently live".to_string());
    }

    // The playback_url from the API is the HLS m3u8 URL
    if let Some(playback_url) = channel_data.playback_url {
        Ok(playback_url)
    } else {
        // Fallback: construct the URL based on known Kick CDN patterns
        // Kick uses Amazon IVS for streaming
        Err("Could not determine stream URL - playback_url not available".to_string())
    }
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
pub async fn check_streamlink_available() -> Result<bool, String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    
    let output = tokio::process::Command::new(&ytdlp_path)
        .arg("--version")
        .output()
        .await;

    match output {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

/// Get yt-dlp version info
#[tauri::command]
pub async fn get_streamlink_version() -> Result<String, String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    
    let output = tokio::process::Command::new(&ytdlp_path)
        .arg("--version")
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

/// Start recording a Kick livestream using Streamlink
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
    
    // Check if already recording this channel
    if KICK_ACTIVE_RECORDINGS.lock().unwrap().contains_key(&channel_slug) {
        return Err(format!("Already recording channel: {}", channel_slug));
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
        }
    });

    KICK_ACTIVE_RECORDINGS.lock().unwrap().insert(
        channel_slug,
        KickRecordingEntry {
            stop_tx: Some(stop_tx),
            task,
        },
    );

    Ok(())
}

/// Stop recording a Kick livestream
#[tauri::command]
pub async fn stop_kick_recording(channel_slug: String) -> Result<(), String> {
    let channel_slug = normalize_channel_slug(&channel_slug);
    let entry = KICK_ACTIVE_RECORDINGS.lock().unwrap().remove(&channel_slug);
    
    if let Some(entry) = entry {
        if let Some(tx) = entry.stop_tx {
            let _ = tx.send(());
        }
        if let Err(err) = entry.task.await {
            eprintln!("[KickRecorder] Join error: {}", err);
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

/// Run the yt-dlp recorder process with HLS output via FFmpeg
/// Pipes yt-dlp output directly to FFmpeg to avoid URL expiration issues
async fn run_kick_recorder(
    app: tauri::AppHandle,
    channel_slug: String,
    streamer_id: String,
    session_id: String,
    output_dir: String,
    segment_duration_minutes: u32,
    mut stop_rx: oneshot::Receiver<()>,
) -> Result<(), String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    let ffmpeg_path = resolve_ffmpeg_binary()?;
    let kick_url = format!("https://kick.com/{}", channel_slug);
    
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

    // Emit log for recording start
    let _ = app.emit("recorder-log", KickRecorderLogPayload {
        streamer_id: streamer_id.clone(),
        channel_slug: channel_slug.clone(),
        message: format!("Starting stream capture for {}", channel_slug),
        level: "info".to_string(),
    });

    // Spawn yt-dlp to output stream to stdout
    // yt-dlp <url> -o - outputs raw video to stdout
    // Pass full path to ffmpeg binary (yt-dlp accepts either directory or full binary path)
    let mut ytdlp_cmd = tokio::process::Command::new(&ytdlp_path);
    ytdlp_cmd
        .arg(&kick_url)
        .arg("-o").arg("-")  // Output to stdout
        .arg("--quiet")      // Suppress progress output
        .arg("--no-part")    // Don't use .part files
        .arg("--ffmpeg-location").arg(&ffmpeg_path)  // Full path to ffmpeg binary
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    println!("[KickRecorder] Starting yt-dlp: {} {} --ffmpeg-location {}", ytdlp_path, kick_url, ffmpeg_path);

    let mut ytdlp_child = ytdlp_cmd.spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

    let ytdlp_stdout = ytdlp_child.stdout.take()
        .ok_or("Failed to get yt-dlp stdout")?;

    // Convert tokio ChildStdout to std Stdio for piping to FFmpeg
    let ytdlp_stdout_std: std::process::Stdio = ytdlp_stdout.try_into()
        .map_err(|_| "Failed to convert yt-dlp stdout")?;

    let _ = app.emit("recorder-log", KickRecorderLogPayload {
        streamer_id: streamer_id.clone(),
        channel_slug: channel_slug.clone(),
        message: format!("Starting HLS recording for {}", channel_slug),
        level: "info".to_string(),
    });

    // Spawn FFmpeg to read from yt-dlp's stdout and output HLS
    let mut ffmpeg_cmd = tokio::process::Command::new(&ffmpeg_path);
    ffmpeg_cmd
        .arg("-i").arg("pipe:0")       // Read from stdin (piped from yt-dlp)
        .arg("-c").arg("copy")         // Copy codec (no re-encoding)
        .arg("-f").arg("hls")          // HLS output format
        .arg("-hls_time").arg(hls_segment_seconds.to_string())
        .arg("-hls_list_size").arg("0")  // Keep all segments in playlist
        .arg("-hls_flags").arg("append_list+omit_endlist")  // Live streaming flags
        .arg("-hls_segment_filename").arg(segment_pattern.to_string_lossy().to_string())
        .arg(playlist_path.to_string_lossy().to_string())
        .stdin(ytdlp_stdout_std)       // Pipe yt-dlp output to FFmpeg
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    println!("[KickRecorder] Starting ffmpeg HLS output to: {}", playlist_path.display());

    let mut ffmpeg_child = ffmpeg_cmd.spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

    let recording_start = std::time::Instant::now();
    let mut segment_count: u32 = 0;

    // Monitor for new segments and stop signal
    loop {
        tokio::select! {
            // Check if FFmpeg exited
            status = ffmpeg_child.wait() => {
                match status {
                    Ok(exit_status) => {
                        println!("[KickRecorder] FFmpeg exited with status: {:?}", exit_status);
                        
                        // Kill yt-dlp too
                        let _ = ytdlp_child.kill().await;
                        
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
                let _ = ytdlp_child.kill().await;
                break;
            }
            
            // Periodically check for new segments and emit events
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(2)) => {
                // Count segments in output directory
                if let Ok(entries) = std::fs::read_dir(&output_dir) {
                    let new_count = entries
                        .filter_map(|e| e.ok())
                        .filter(|e| e.path().extension().map(|ext| ext == "ts").unwrap_or(false))
                        .count() as u32;
                    
                    if new_count > segment_count {
                        // New segments available
                        for seg in segment_count..new_count {
                            let seg_path = PathBuf::from(&output_dir).join(format!("segment_{:04}.ts", seg));
                            if seg_path.exists() {
                                let _ = app.emit("segment-ready", KickSegmentReadyPayload {
                                    streamer_id: streamer_id.clone(),
                                    session_id: session_id.clone(),
                                    channel_slug: channel_slug.clone(),
                                    mint_id: channel_slug.clone(), // For Kick, mintId = channel_slug
                                    segment: seg,
                                    path: seg_path.to_string_lossy().to_string(),
                                    duration: hls_segment_seconds as f64,
                                });
                            }
                        }
                        segment_count = new_count;
                        
                        let _ = app.emit("recorder-log", KickRecorderLogPayload {
                            streamer_id: streamer_id.clone(),
                            channel_slug: channel_slug.clone(),
                            message: format!("Recording: {} segments, {:.0}s", segment_count, recording_start.elapsed().as_secs_f64()),
                            level: "info".to_string(),
                        });
                    }
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
