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
struct TwitchRecordingEntry {
    stop_tx: Option<oneshot::Sender<()>>,
    task: tokio::task::JoinHandle<()>,
}

static TWITCH_ACTIVE_RECORDINGS: Lazy<Arc<Mutex<HashMap<String, TwitchRecordingEntry>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Event payloads for frontend communication
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TwitchSegmentReadyPayload {
    streamer_id: String,
    session_id: String,
    channel_name: String,
    mint_id: String, // For Twitch, this is the same as channel_name
    segment: u32,
    path: String,
    duration: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TwitchRecorderLogPayload {
    streamer_id: String,
    channel_name: String,
    message: String,
    level: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TwitchStreamEndedPayload {
    streamer_id: String,
    session_id: String,
    channel_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TwitchRecorderExitPayload {
    streamer_id: String,
    session_id: String,
    channel_name: String,
    code: Option<i32>,
}

static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .expect("Failed to build reqwest client")
});

// Twitch's public Client-ID (same one used by the website)
const TWITCH_CLIENT_ID: &str = "kimne78kx3ncx6brgo4mv6wki5h1ko";

/// Response from Twitch GQL API for user/stream info
#[derive(Debug, Deserialize, Serialize)]
pub struct TwitchGqlResponse {
    pub data: Option<TwitchGqlData>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TwitchGqlData {
    pub user: Option<TwitchUser>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitchUser {
    pub id: Option<String>,
    pub login: Option<String>,
    pub display_name: Option<String>,
    #[serde(rename = "profileImageURL")]
    pub profile_image_url: Option<String>,
    pub description: Option<String>,
    pub stream: Option<TwitchStream>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitchStream {
    pub id: Option<String>,
    pub title: Option<String>,
    pub viewers_count: Option<i64>,
    pub created_at: Option<String>,
    pub game: Option<TwitchGame>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TwitchGame {
    pub name: Option<String>,
}

/// Simplified live status response for frontend
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitchLiveStatus {
    pub is_live: bool,
    pub channel_id: Option<String>,
    pub channel_name: Option<String>,
    pub display_name: Option<String>,
    pub profile_image_url: Option<String>,
    pub stream_title: Option<String>,
    pub viewer_count: Option<i64>,
    pub game_name: Option<String>,
    pub started_at: Option<String>,
}

/// VOD info from yt-dlp
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitchVod {
    pub vod_id: String,
    pub title: Option<String>,
    pub duration: Option<f64>,
    pub view_count: Option<i64>,
    pub thumbnail_url: Option<String>,
    pub created_at: Option<String>,
    pub url: String,
}

/// Check if a Twitch channel is live using the public GQL endpoint
/// 
/// # Arguments
/// * `channel` - The Twitch channel name/login (e.g., "xqc", "ninja")
#[tauri::command]
pub async fn check_twitch_livestream(channel: String) -> Result<String, String> {
    let channel_name = normalize_channel_name(&channel);
    
    // Use Twitch's public GQL endpoint (same as their website)
    let url = "https://gql.twitch.tv/gql";
    
    // GraphQL query to get user and stream info
    let query = serde_json::json!({
        "query": format!(r#"
            query {{
                user(login: "{}") {{
                    id
                    login
                    displayName
                    profileImageURL(width: 300)
                    description
                    stream {{
                        id
                        title
                        viewersCount
                        createdAt
                        game {{
                            name
                        }}
                    }}
                }}
            }}
        "#, channel_name)
    });

    let response = HTTP_CLIENT
        .post(url)
        .header("Client-Id", TWITCH_CLIENT_ID)
        .header("Content-Type", "application/json")
        .json(&query)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Twitch GQL error: {}", response.status()));
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Parse the response
    let gql_response: TwitchGqlResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse Twitch response: {} - Body: {}", e, &body[..body.len().min(500)]))?;

    // Build the live status response
    let user = gql_response.data.and_then(|d| d.user);
    
    let status = if let Some(user) = user {
        let is_live = user.stream.is_some();
        let stream = user.stream.as_ref();
        
        TwitchLiveStatus {
            is_live,
            channel_id: user.id,
            channel_name: user.login,
            display_name: user.display_name,
            profile_image_url: user.profile_image_url,
            stream_title: stream.and_then(|s| s.title.clone()),
            viewer_count: stream.and_then(|s| s.viewers_count),
            game_name: stream.and_then(|s| s.game.as_ref()).and_then(|g| g.name.clone()),
            started_at: stream.and_then(|s| s.created_at.clone()),
        }
    } else {
        // User not found
        TwitchLiveStatus {
            is_live: false,
            channel_id: None,
            channel_name: Some(channel_name),
            display_name: None,
            profile_image_url: None,
            stream_title: None,
            viewer_count: None,
            game_name: None,
            started_at: None,
        }
    };

    Ok(serde_json::to_string(&status).unwrap())
}

/// Get VODs for a Twitch channel using yt-dlp
#[tauri::command]
pub async fn get_twitch_vods(channel: String, limit: Option<u32>) -> Result<String, String> {
    let channel_name = normalize_channel_name(&channel);
    let limit = limit.unwrap_or(20);
    
    let ytdlp_path = resolve_ytdlp_binary()?;
    let twitch_url = format!("https://twitch.tv/{}/videos", channel_name);
    
    // Use yt-dlp to get playlist info
    // Note: We don't use --flat-playlist because it doesn't include upload_date
    // This is slower but provides complete metadata including timestamps
    let output = tokio::process::Command::new(&ytdlp_path)
        .arg("--dump-json")
        .arg("--skip-download")
        .arg("--playlist-end")
        .arg(limit.to_string())
        .arg(&twitch_url)
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    
    // Parse each line as a separate JSON object (yt-dlp outputs one per line)
    let mut vods: Vec<TwitchVod> = Vec::new();
    
    for line in stdout.lines() {
        if line.trim().is_empty() {
            continue;
        }
        
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
            let vod = TwitchVod {
                vod_id: json.get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                title: json.get("title")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                duration: json.get("duration")
                    .and_then(|v| v.as_f64()),
                view_count: json.get("view_count")
                    .and_then(|v| v.as_i64()),
                thumbnail_url: json.get("thumbnail")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                created_at: json.get("upload_date")
                    .and_then(|v| v.as_str())
                    .and_then(|s| {
                        // yt-dlp returns date as YYYYMMDD, convert to ISO format YYYY-MM-DD
                        if s.len() == 8 {
                            Some(format!("{}-{}-{}", &s[0..4], &s[4..6], &s[6..8]))
                        } else {
                            Some(s.to_string())
                        }
                    }),
                url: json.get("webpage_url")
                    .or_else(|| json.get("url"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
            };
            
            if !vod.vod_id.is_empty() {
                vods.push(vod);
            }
        }
    }

    Ok(serde_json::to_string(&vods).unwrap())
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
        println!("[Twitch] Found {} at (prod): {}", base_name, prod_path.display());
        return Ok(prod_path.to_string_lossy().to_string());
    }

    // Development mode: check src-tauri/binaries/
    if let Some(target_dir) = exe_dir.parent() {
        if let Some(target_parent) = target_dir.parent() {
            let dev_path = target_parent.join("binaries").join(&binary_name);
            if dev_path.exists() {
                println!("[Twitch] Found {} at (dev): {}", base_name, dev_path.display());
                return Ok(dev_path.to_string_lossy().to_string());
            }
        }
    }

    // Fallback to system PATH
    #[cfg(target_os = "windows")]
    let fallback = format!("{}.exe", base_name);
    
    #[cfg(not(target_os = "windows"))]
    let fallback = base_name.to_string();
    
    println!("[Twitch] {} not found in bundle, falling back to PATH: {}", base_name, fallback);
    Ok(fallback)
}

/// Resolve the yt-dlp binary path
fn resolve_ytdlp_binary() -> Result<String, String> {
    resolve_sidecar_binary("yt-dlp")
}

/// Resolve FFmpeg binary path
fn resolve_ffmpeg_binary() -> Result<String, String> {
    resolve_sidecar_binary("ffmpeg")
}

/// Normalize channel name from various input formats
/// Handles: "xqc", "twitch.tv/xqc", "https://twitch.tv/xqc", etc.
fn normalize_channel_name(input: &str) -> String {
    let input = input.trim();
    
    // Remove protocol and domain if present
    let name = if input.contains("twitch.tv/") {
        input.split("twitch.tv/").last().unwrap_or(input)
    } else {
        input
    };
    
    // Remove any trailing slashes, paths, or query params
    let name = name.split('/').next().unwrap_or(name);
    let name = name.split('?').next().unwrap_or(name);
    let name = name.split('#').next().unwrap_or(name);
    let name = name.trim_matches('/');
    
    name.to_lowercase()
}

/// Start recording a Twitch livestream using yt-dlp
/// Records to segmented files for DVR and clipping functionality
#[tauri::command]
pub async fn start_twitch_recording(
    app: tauri::AppHandle,
    channel_name: String,
    streamer_id: String,
    session_id: String,
    segment_duration_minutes: Option<u32>,
) -> Result<(), String> {
    let channel_name = normalize_channel_name(&channel_name);
    
    // Check if already recording this channel
    if TWITCH_ACTIVE_RECORDINGS.lock().unwrap().contains_key(&channel_name) {
        return Err(format!("Already recording channel: {}", channel_name));
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
    let channel_clone = channel_name.clone();
    let streamer_clone = streamer_id.clone();
    let session_clone = session_id.clone();
    let output_str = session_dir.to_string_lossy().to_string();
    let app_handle = app.clone();

    // Emit log that recording is starting
    let _ = app.emit("recorder-log", TwitchRecorderLogPayload {
        streamer_id: streamer_id.clone(),
        channel_name: channel_name.clone(),
        message: format!("Starting Twitch recording for {}", channel_name),
        level: "info".to_string(),
    });

    let task = tokio::spawn(async move {
        if let Err(err) = run_twitch_recorder(
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
            eprintln!("[TwitchRecorder] {}", err);
        }
    });

    TWITCH_ACTIVE_RECORDINGS.lock().unwrap().insert(
        channel_name,
        TwitchRecordingEntry {
            stop_tx: Some(stop_tx),
            task,
        },
    );

    Ok(())
}

/// Stop recording a Twitch livestream
#[tauri::command]
pub async fn stop_twitch_recording(channel_name: String) -> Result<(), String> {
    let channel_name = normalize_channel_name(&channel_name);
    let entry = TWITCH_ACTIVE_RECORDINGS.lock().unwrap().remove(&channel_name);
    
    if let Some(entry) = entry {
        if let Some(tx) = entry.stop_tx {
            let _ = tx.send(());
        }
        if let Err(err) = entry.task.await {
            eprintln!("[TwitchRecorder] Join error: {}", err);
        }
    }
    Ok(())
}

/// Stop all active Twitch recordings
#[tauri::command]
pub async fn stop_all_twitch_recordings() -> Result<(), String> {
    let mut recordings = TWITCH_ACTIVE_RECORDINGS.lock().unwrap();
    for (_, entry) in recordings.drain() {
        if let Some(tx) = entry.stop_tx {
            let _ = tx.send(());
        }
    }
    Ok(())
}

/// Get count of active Twitch recordings
#[allow(dead_code)]
pub fn get_active_twitch_recordings_count() -> usize {
    TWITCH_ACTIVE_RECORDINGS.lock().unwrap().len()
}

/// Get the output directory for a Twitch session (for HLS playback)
#[tauri::command]
pub async fn get_twitch_session_output_dir(session_id: String) -> Result<String, String> {
    let output_dir = storage::get_livestream_recordings_dir()
        .map_err(|e| format!("Failed to get recordings directory: {}", e))?;
    
    let session_dir = output_dir.join(&session_id);
    Ok(session_dir.to_string_lossy().to_string())
}

/// Run the yt-dlp recorder process with HLS output via FFmpeg
/// Pipes yt-dlp output directly to FFmpeg to avoid URL expiration issues
async fn run_twitch_recorder(
    app: tauri::AppHandle,
    channel_name: String,
    streamer_id: String,
    session_id: String,
    output_dir: String,
    segment_duration_minutes: u32,
    mut stop_rx: oneshot::Receiver<()>,
) -> Result<(), String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    let ffmpeg_path = resolve_ffmpeg_binary()?;
    let twitch_url = format!("https://twitch.tv/{}", channel_name);
    
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
    let _ = app.emit("recorder-log", TwitchRecorderLogPayload {
        streamer_id: streamer_id.clone(),
        channel_name: channel_name.clone(),
        message: format!("Starting stream capture for {}", channel_name),
        level: "info".to_string(),
    });

    // Spawn yt-dlp to output stream to stdout
    let mut ytdlp_cmd = tokio::process::Command::new(&ytdlp_path);
    ytdlp_cmd
        .arg(&twitch_url)
        .arg("-o").arg("-")  // Output to stdout
        .arg("--quiet")      // Suppress progress output
        .arg("--no-part")    // Don't use .part files
        .arg("--ffmpeg-location").arg(&ffmpeg_path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    println!("[TwitchRecorder] Starting yt-dlp: {} {} --ffmpeg-location {}", ytdlp_path, twitch_url, ffmpeg_path);

    let mut ytdlp_child = ytdlp_cmd.spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

    let ytdlp_stdout = ytdlp_child.stdout.take()
        .ok_or("Failed to get yt-dlp stdout")?;

    // Convert tokio ChildStdout to std Stdio for piping to FFmpeg
    let ytdlp_stdout_std: std::process::Stdio = ytdlp_stdout.try_into()
        .map_err(|_| "Failed to convert yt-dlp stdout")?;

    let _ = app.emit("recorder-log", TwitchRecorderLogPayload {
        streamer_id: streamer_id.clone(),
        channel_name: channel_name.clone(),
        message: format!("Starting HLS recording for {}", channel_name),
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

    println!("[TwitchRecorder] Starting ffmpeg HLS output to: {}", playlist_path.display());

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
                        println!("[TwitchRecorder] FFmpeg exited with status: {:?}", exit_status);
                        
                        // Kill yt-dlp too
                        let _ = ytdlp_child.kill().await;
                        
                        if !exit_status.success() {
                            // Stream might have ended - emit event
                            let _ = app.emit("stream-ended", TwitchStreamEndedPayload {
                                streamer_id: streamer_id.clone(),
                                session_id: session_id.clone(),
                                channel_name: channel_name.clone(),
                            });
                        }
                    }
                    Err(e) => {
                        eprintln!("[TwitchRecorder] FFmpeg wait error: {}", e);
                    }
                }
                break;
            }
            
            // Check for stop signal
            _ = &mut stop_rx => {
                println!("[TwitchRecorder] Stop signal received, killing processes...");
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
                                // FFmpeg uses 0-indexed segments, but frontend expects 1-indexed
                                let segment_number = seg + 1;
                                let _ = app.emit("segment-ready", TwitchSegmentReadyPayload {
                                    streamer_id: streamer_id.clone(),
                                    session_id: session_id.clone(),
                                    channel_name: channel_name.clone(),
                                    mint_id: channel_name.clone(), // For Twitch, mintId = channel_name
                                    segment: segment_number,
                                    path: seg_path.to_string_lossy().to_string(),
                                    duration: hls_segment_seconds as f64,
                                });
                            }
                        }
                        segment_count = new_count;
                        
                        let _ = app.emit("recorder-log", TwitchRecorderLogPayload {
                            streamer_id: streamer_id.clone(),
                            channel_name: channel_name.clone(),
                            message: format!("Recording: {} segments, {:.0}s", segment_count, recording_start.elapsed().as_secs_f64()),
                            level: "info".to_string(),
                        });
                    }
                }
            }
        }
    }

    // Emit exit event
    let _ = app.emit("recorder-exit", TwitchRecorderExitPayload {
        streamer_id,
        session_id,
        channel_name,
        code: Some(0),
    });

    Ok(())
}

/// Download a Twitch VOD using yt-dlp
/// This is a placeholder that returns an error directing users to use yt-dlp directly
/// Full VOD downloads for Twitch work via the frontend using the VOD URL
#[tauri::command]
pub async fn download_twitch_vod(
    _app: tauri::AppHandle,
    _download_id: String,
    _title: String,
    video_url: String,
    _channel_name: String
) -> Result<(), String> {
    // Twitch VODs are downloaded via yt-dlp in the frontend
    // The video_url is passed directly to yt-dlp
    println!("[Twitch] VOD download requested for: {}", video_url);
    Err("Twitch VOD downloads should use the frontend download system with yt-dlp".to_string())
}

/// Download a segment of a Twitch VOD
#[tauri::command]
pub async fn download_twitch_vod_segment(
    _app: tauri::AppHandle,
    _download_id: String,
    _title: String,
    video_url: String,
    _channel_name: String,
    _start_time: f64,
    _end_time: f64
) -> Result<(), String> {
    println!("[Twitch] VOD segment download requested for: {}", video_url);
    Err("Twitch VOD segment downloads should use the frontend download system with yt-dlp".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_channel_name() {
        assert_eq!(normalize_channel_name("xqc"), "xqc");
        assert_eq!(normalize_channel_name("XQC"), "xqc");
        assert_eq!(normalize_channel_name("twitch.tv/xqc"), "xqc");
        assert_eq!(normalize_channel_name("https://twitch.tv/xqc"), "xqc");
        assert_eq!(normalize_channel_name("https://twitch.tv/xqc/"), "xqc");
        assert_eq!(normalize_channel_name("https://twitch.tv/xqc/videos"), "xqc");
        assert_eq!(normalize_channel_name("https://twitch.tv/xqc?ref=123"), "xqc");
    }
}
