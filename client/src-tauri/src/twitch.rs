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
use crate::downloads::{
    DownloadProgress, DownloadResult, ACTIVE_DOWNLOADS, ACTIVE_DOWNLOAD_CANCELLERS, DOWNLOAD_METADATA,
    DownloadMetadata,
};
use crate::ffmpeg_utils::{get_video_info, parse_ffmpeg_time};

#[cfg(target_os = "windows")]
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
    let output = no_window(tokio::process::Command::new(&ytdlp_path)
        .arg("--dump-json")
        .arg("--skip-download")
        .arg("--playlist-end")
        .arg(limit.to_string())
        .arg(&twitch_url))
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
                    .map(|s| {
                        // yt-dlp returns date as YYYYMMDD, convert to ISO format YYYY-MM-DD
                        if s.len() == 8 {
                            format!("{}-{}-{}", &s[0..4], &s[4..6], &s[6..8])
                        } else {
                            s.to_string()
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

/// Get list of active Twitch recording channel names
#[tauri::command]
pub fn get_active_twitch_recordings() -> Vec<String> {
    TWITCH_ACTIVE_RECORDINGS.lock().unwrap().keys().cloned().collect()
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
    no_window(&mut ytdlp_cmd);
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
    no_window(&mut ffmpeg_cmd);
    ffmpeg_cmd
        .arg("-i").arg("pipe:0")       // Read from stdin (piped from yt-dlp)
        // Re-encode to H.264 Baseline + AAC for guaranteed MSE/WebView2 compatibility.
        // -c copy can pass through codecs (HEVC, VP9) that MSE rejects in production.
        .arg("-c:v").arg("libx264")
        .arg("-preset").arg("ultrafast")  // Minimize CPU usage for live streaming
        .arg("-tune").arg("zerolatency")  // Low-latency encoding
        .arg("-profile:v").arg("baseline") // Baseline profile = widest MSE compatibility
        .arg("-level").arg("4.0")
        .arg("-crf").arg("23")            // Reasonable quality
        .arg("-c:a").arg("aac")
        .arg("-b:a").arg("128k")
        .arg("-f").arg("hls")          // HLS output format
        .arg("-hls_time").arg(hls_segment_seconds.to_string())
        .arg("-hls_list_size").arg("0")  // Keep all segments in playlist
        .arg("-hls_flags").arg("append_list+omit_endlist+temp_file")  // Live streaming flags + atomic writes
        .arg("-hls_segment_filename").arg(segment_pattern.to_string_lossy().to_string())
        .arg(playlist_path.to_string_lossy().to_string())
        .stdin(ytdlp_stdout_std)       // Pipe yt-dlp output to FFmpeg
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    println!("[TwitchRecorder] Starting ffmpeg HLS output to: {}", playlist_path.display());

    let mut ffmpeg_child = ffmpeg_cmd.spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

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
                // Check for the next expected segment (FFmpeg uses 0-indexed naming)
                // We track last_emitted_segment in 1-indexed format for frontend
                // So next segment file is segment_{last_emitted_segment:04}.ts (0-indexed)
                let next_segment_index = last_emitted_segment; // 0-indexed file number
                let seg_path = PathBuf::from(&output_dir).join(format!("segment_{:04}.ts", next_segment_index));
                
                // With +temp_file flag, the .ts file only exists once FFmpeg has finished
                // writing it (it writes to .tmp first, then atomically renames).
                // We still do a stability check as a safety measure.
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
                            
                            println!("[TwitchRecorder] Segment {} ready: {} ({} bytes)", 
                                segment_number, seg_path.display(), s1);
                            
                            let _ = app.emit("segment-ready", TwitchSegmentReadyPayload {
                                streamer_id: streamer_id.clone(),
                                session_id: session_id.clone(),
                                channel_name: channel_name.clone(),
                                mint_id: channel_name.clone(), // For Twitch, mintId = channel_name
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
                    let _ = app.emit("recorder-log", TwitchRecorderLogPayload {
                        streamer_id: streamer_id.clone(),
                        channel_name: channel_name.clone(),
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
    let _ = app.emit("recorder-exit", TwitchRecorderExitPayload {
        streamer_id,
        session_id,
        channel_name,
        code: Some(0),
    });

    Ok(())
}

/// Download a Twitch VOD using yt-dlp
#[tauri::command]
pub async fn download_twitch_vod(
    app: tauri::AppHandle,
    download_id: String,
    title: String,
    video_url: String,
    channel_name: String
) -> Result<(), String> {
    println!("[Twitch] download_twitch_vod called with:");
    println!("[Twitch]   download_id: {}", download_id);
    println!("[Twitch]   title: {}", title);
    println!("[Twitch]   video_url: {}", video_url);
    println!("[Twitch]   channel_name: {}", channel_name);

    // Check if download already exists
    {
        let mut downloads = ACTIVE_DOWNLOADS.lock().unwrap();
        if downloads.contains_key(&download_id) {
            println!("[Twitch] Download already in progress: {}", download_id);
            return Err("Download already in progress".to_string());
        }
        downloads.insert(download_id.clone(), true);
        println!("[Twitch] Download registered: {}", download_id);
    }

    // Clean up when done
    let cleanup_download = {
        let download_id = download_id.clone();
        let downloads = ACTIVE_DOWNLOADS.clone();
        move || {
            println!("[Twitch] Cleaning up download: {}", download_id);
            let mut downloads = downloads.lock().unwrap();
            downloads.remove(&download_id);
        }
    };

    // Get storage paths
    println!("[Twitch] Getting storage paths...");
    let paths = storage::init_storage_dirs()
        .map_err(|e| {
            println!("[Twitch] Failed to get storage paths: {}", e);
            format!("Failed to get storage paths: {}", e)
        })?;

    println!("[Twitch] Storage paths retrieved. Videos dir: {}", paths.videos.display());

    // Generate filename
    let safe_title = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    let filename = format!("twitch_{}_{}_{}.mp4", channel_name, safe_title, timestamp);
    let video_path = paths.videos.join(&filename);

    println!("[Twitch] Generated filename: {}", filename);
    println!("[Twitch] Full video path: {}", video_path.display());

    // Store download metadata
    {
        let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
        metadata_map.insert(download_id.clone(), DownloadMetadata {
            output_path: Some(video_path.to_string_lossy().to_string()),
            thumbnail_path: None,
            started_at: std::time::SystemTime::now(),
            process_id: None,
        });
    }

    // Send initial progress
    let progress_result = app.emit("download-progress", DownloadProgress {
        download_id: download_id.clone(),
        progress: 0.0,
        current_time: None,
        total_time: None,
        status: "Fetching video info...".to_string(),
    });

    if let Err(e) = progress_result {
        println!("[Twitch] Failed to emit initial progress: {}", e);
    }

    // Clone for async block
    let app_clone = app.clone();
    let download_id_clone = download_id.clone();
    println!("[Twitch] Starting async download task...");

    let (cancel_tx, mut cancel_rx) = oneshot::channel();
    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.insert(download_id.clone(), cancel_tx);
    }

    let result = tokio::spawn(async move {
        println!("[Twitch] Async task started for download: {}", download_id_clone);

        let ytdlp_path = resolve_ytdlp_binary()?;
        let ffmpeg_path = resolve_ffmpeg_binary()?;
        let video_path_str = video_path.to_string_lossy().to_string();

        println!("[Twitch] Using yt-dlp: {}", ytdlp_path);
        println!("[Twitch] Using ffmpeg: {}", ffmpeg_path);

        // Get video duration first for progress reporting
        println!("[Twitch] Fetching video duration...");
        let duration_output = no_window(tokio::process::Command::new(&ytdlp_path)
            .arg("--print")
            .arg("duration")
            .arg(&video_url))
            .output()
            .await
            .map_err(|e| format!("Failed to fetch duration: {}", e))?;

        let total_duration = if duration_output.status.success() {
            let duration_str = String::from_utf8_lossy(&duration_output.stdout).trim().to_string();
            duration_str.parse::<f64>().ok()
        } else {
            None
        };
        
        println!("[Twitch] Total duration: {:?}", total_duration);

        // Run yt-dlp to download the VOD
        let mut cmd = tokio::process::Command::new(&ytdlp_path);
        no_window(&mut cmd);
        cmd.arg(&video_url)
            .arg("-o").arg(&video_path_str)
            .arg("--ffmpeg-location").arg(&ffmpeg_path)
            .arg("--no-part")  // Don't use .part files
            .arg("--newline")  // Output progress on new lines
            .arg("--progress")  // Show progress
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        println!("[Twitch] Running yt-dlp command...");

        let mut child = cmd.spawn()
            .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        // Read stdout for progress updates (yt-dlp outputs progress to stdout)
        let app_for_progress = app_clone.clone();
        let download_id_for_progress = download_id_clone.clone();
        let duration_for_progress = total_duration;
        
        let stdout_task = stdout.map(|stdout| tokio::spawn(async move {
                use tokio::io::{AsyncBufReadExt, BufReader};
                let reader = BufReader::new(stdout);
                let mut lines = reader.lines();
                let mut last_progress_time = std::time::Instant::now();
                
                while let Ok(Some(line)) = lines.next_line().await {
                    // Parse yt-dlp progress output
                    // Format: [download]  XX.X% of ~XXX.XXMIB at XXX.XXKIB/s ETA XX:XX
                    if line.contains("% of") || line.contains("100% of") {
                        if let Some(pct_str) = line.split('%').next() {
                            let pct_str = pct_str.trim_start_matches(|c: char| !c.is_ascii_digit() && c != '.');
                            if let Ok(pct) = pct_str.trim().parse::<f64>() {
                                if last_progress_time.elapsed().as_millis() >= 500 {
                                    let current_time = duration_for_progress.map(|dur| (pct / 100.0) * dur);

                                    let _ = app_for_progress.emit("download-progress", DownloadProgress {
                                        download_id: download_id_for_progress.clone(),
                                        progress: pct.min(99.0),
                                        current_time,
                                        total_time: duration_for_progress,
                                        status: format!("Downloading: {:.1}%", pct),
                                    });
                                    last_progress_time = std::time::Instant::now();
                                }
                            }
                        }
                    } else if !line.is_empty() {
                        println!("[Twitch] yt-dlp: {}", line);
                    }
                }
            }));

        // Drain stderr for warnings/errors
        let stderr_task = stderr.map(|stderr| tokio::spawn(async move {
                use tokio::io::{AsyncBufReadExt, BufReader};
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    if !line.is_empty() {
                        println!("[Twitch] yt-dlp stderr: {}", line);
                    }
                }
            }));

        let mut stdout_task = stdout_task;
        let mut stderr_task = stderr_task;

        // Wait for yt-dlp to complete or cancellation
        let status = tokio::select! {
            result = child.wait() => result
                .map_err(|e| format!("Failed to wait for yt-dlp: {}", e))?,
            _ = &mut cancel_rx => {
                println!("[Twitch] Download cancelled, terminating yt-dlp...");
                let _ = child.kill().await;
                if let Some(task) = stdout_task.take() {
                    task.abort();
                }
                if let Some(task) = stderr_task.take() {
                    task.abort();
                }
                return Err("Download cancelled".to_string());
            }
        };

        // Wait for output tasks
        if let Some(task) = stderr_task {
            let _ = task.await;
        }
        if let Some(task) = stdout_task {
            let _ = task.await;
        }

        if !status.success() {
            return Err(format!("yt-dlp failed with exit code: {:?}", status.code()));
        }

        println!("[Twitch] yt-dlp download completed successfully");

        // Verify the file exists
        if !video_path.exists() {
            return Err("Download completed but file not found".to_string());
        }

        // Wait a moment for file system to flush and release locks
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        // Get file metadata
        let metadata = std::fs::metadata(&video_path)
            .map_err(|e| format!("Failed to get file metadata: {}", e))?;
        let file_size = metadata.len();

        // Generate thumbnail
        println!("[Twitch] Generating thumbnail...");
        let thumbnail_path = paths.thumbnails.join(format!("{}_thumb.jpg", filename.replace(".mp4", "")));
        let thumbnail_result = no_window(tokio::process::Command::new(&ffmpeg_path)
            .args([
                "-hwaccel", "auto",
                "-ss", "00:00:01",
                "-i", &video_path_str,
                "-vframes", "1",
                "-vf", "scale=320:-1",
                "-y",
                thumbnail_path.to_str().ok_or("Invalid thumbnail path")?,
            ]))
            .output()
            .await;

        let thumbnail_path_str = match thumbnail_result {
            Ok(output) if output.status.success() => {
                println!("[Twitch] Thumbnail generated: {}", thumbnail_path.display());
                Some(thumbnail_path.to_string_lossy().to_string())
            }
            _ => {
                println!("[Twitch] Thumbnail generation failed");
                None
            }
        };

        // Get video info with timeout to prevent hanging
        println!("[Twitch] Getting video info...");
        let video_info = tokio::time::timeout(
            std::time::Duration::from_secs(30),
            get_video_info(&app_clone, &video_path)
        ).await;
        
        let (width, height, codec, duration) = match video_info {
            Ok(Ok(info)) => {
                println!("[Twitch] Video info - width: {}, height: {}, codec: {}, duration: {:?}", 
                    info.width, info.height, info.codec, info.duration);
                (Some(info.width), Some(info.height), Some(info.codec.clone()), info.duration)
            }
            Ok(Err(e)) => {
                println!("[Twitch] Failed to get video info: {}", e);
                (None, None, None, None)
            }
            Err(_) => {
                println!("[Twitch] Video info timed out after 30 seconds");
                (None, None, None, None)
            }
        };

        println!("[Twitch] Download task completed successfully");
        Ok(DownloadResult {
            download_id: download_id_clone,
            success: true,
            file_path: Some(video_path_str),
            thumbnail_path: thumbnail_path_str,
            duration,
            width,
            height,
            codec,
            file_size: Some(file_size),
            error: None,
        })
    }).await;

    println!("[Twitch] Async task completed");

    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.remove(&download_id);
    }

    cleanup_download();

    println!("[Twitch] Processing download result...");
    match result {
        Ok(Ok(download_result)) => {
            println!("[Twitch] Download successful!");

            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 100.0,
                current_time: None,
                total_time: None,
                status: "Download completed!".to_string(),
            });

            let _ = app.emit("download-complete", download_result);

            Ok(())
        }
        Ok(Err(e)) => {
            let error_msg = format!("Download failed: {}", e);
            println!("[Twitch] Download failed: {}", error_msg);

            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 0.0,
                current_time: None,
                total_time: None,
                status: error_msg.clone(),
            });

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
            println!("[Twitch] Download task failed: {}", error_msg);

            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 0.0,
                current_time: None,
                total_time: None,
                status: error_msg.clone(),
            });

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

/// Download a segment of a Twitch VOD using yt-dlp with time range
#[tauri::command]
pub async fn download_twitch_vod_segment(
    app: tauri::AppHandle,
    download_id: String,
    title: String,
    video_url: String,
    channel_name: String,
    start_time: f64,
    end_time: f64
) -> Result<(), String> {
    println!("[Twitch] download_twitch_vod_segment called with:");
    println!("[Twitch]   download_id: {}", download_id);
    println!("[Twitch]   title: {}", title);
    println!("[Twitch]   video_url: {}", video_url);
    println!("[Twitch]   channel_name: {}", channel_name);
    println!("[Twitch]   start_time: {}", start_time);
    println!("[Twitch]   end_time: {}", end_time);

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
            println!("[Twitch] Download already in progress: {}", download_id);
            return Err("Download already in progress".to_string());
        }
        downloads.insert(download_id.clone(), true);
        println!("[Twitch] Download registered: {}", download_id);
    }

    // Clean up when done
    let cleanup_download = {
        let download_id = download_id.clone();
        let downloads = ACTIVE_DOWNLOADS.clone();
        move || {
            println!("[Twitch] Cleaning up download: {}", download_id);
            let mut downloads = downloads.lock().unwrap();
            downloads.remove(&download_id);
        }
    };

    // Get storage paths
    println!("[Twitch] Getting storage paths...");
    let paths = storage::init_storage_dirs()
        .map_err(|e| {
            println!("[Twitch] Failed to get storage paths: {}", e);
            format!("Failed to get storage paths: {}", e)
        })?;

    println!("[Twitch] Storage paths retrieved. Videos dir: {}", paths.videos.display());

    // Generate filename with segment info
    let safe_title = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    // Format times for filename
    let start_formatted = format_time_for_filename(start_time);
    let end_formatted = format_time_for_filename(end_time);

    let filename = format!("twitch_{}_{}_{}_{}_{}.mp4",
        channel_name, safe_title, start_formatted, end_formatted, timestamp);
    let video_path = paths.videos.join(&filename);

    println!("[Twitch] Generated filename: {}", filename);
    println!("[Twitch] Full video path: {}", video_path.display());

    // Store download metadata
    {
        let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
        metadata_map.insert(download_id.clone(), DownloadMetadata {
            output_path: Some(video_path.to_string_lossy().to_string()),
            thumbnail_path: None,
            started_at: std::time::SystemTime::now(),
            process_id: None,
        });
    }

    // Send initial progress
    let progress_result = app.emit("download-progress", DownloadProgress {
        download_id: download_id.clone(),
        progress: 0.0,
        current_time: Some(0.0),
        total_time: Some(segment_duration),
        status: "Starting Twitch segment download...".to_string(),
    });

    if let Err(e) = progress_result {
        println!("[Twitch] Failed to emit initial progress: {}", e);
    }

    // Clone for async block
    let app_clone = app.clone();
    let download_id_clone = download_id.clone();
    println!("[Twitch] Starting async segment download task...");

    let (cancel_tx, mut cancel_rx) = oneshot::channel();
    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.insert(download_id.clone(), cancel_tx);
    }

    let result = tokio::spawn(async move {
        println!("[Twitch] Async task started for segment download: {}", download_id_clone);

        let ytdlp_path = resolve_ytdlp_binary()?;
        let ffmpeg_path = resolve_ffmpeg_binary()?;
        let video_path_str = video_path.to_string_lossy().to_string();

        println!("[Twitch] Using yt-dlp: {}", ytdlp_path);
        println!("[Twitch] Using ffmpeg: {}", ffmpeg_path);

        // yt-dlp supports --download-sections for time-based downloads
        // Format: "*start_time-end_time" where times are in seconds or HH:MM:SS
        let section_arg = format!("*{:.0}-{:.0}", start_time, end_time);

        // Run yt-dlp to download the segment
        let mut cmd = tokio::process::Command::new(&ytdlp_path);
        no_window(&mut cmd);
        cmd.arg(&video_url)
            .arg("-o").arg(&video_path_str)
            .arg("--ffmpeg-location").arg(&ffmpeg_path)
            .arg("--external-downloader").arg("ffmpeg")
            .arg("--external-downloader-args").arg("ffmpeg:-progress pipe:2 -nostats")
            .arg("--download-sections").arg(&section_arg)
            .arg("--force-keyframes-at-cuts")  // Ensure clean cuts
            .arg("--no-part")  // Don't use .part files
            .arg("--newline")  // Output progress on new lines
            .arg("--progress")  // Show progress
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        println!("[Twitch] Running yt-dlp command with section: {}", section_arg);

        let mut child = cmd.spawn()
            .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        // Read stdout for progress updates (yt-dlp outputs progress to stdout)
        let app_for_progress = app_clone.clone();
        let download_id_for_progress = download_id_clone.clone();
        let app_for_stdout = app_for_progress.clone();
        let download_id_for_stdout = download_id_for_progress.clone();
        let app_for_stderr = app_for_progress.clone();
        let download_id_for_stderr = download_id_for_progress.clone();
        let segment_dur = segment_duration;
        
        let stdout_task = stdout.map(|stdout| tokio::spawn(async move {
                use tokio::io::{AsyncBufReadExt, BufReader};
                let reader = BufReader::new(stdout);
                let mut lines = reader.lines();
                let mut last_progress_time = std::time::Instant::now();
                
                while let Ok(Some(line)) = lines.next_line().await {
                    // Parse yt-dlp progress output
                    if line.contains("% of") || line.contains("100% of") {
                        if let Some(pct_str) = line.split('%').next() {
                            let pct_str = pct_str.trim_start_matches(|c: char| !c.is_ascii_digit() && c != '.');
                            if let Ok(pct) = pct_str.trim().parse::<f64>() {
                                if last_progress_time.elapsed().as_millis() >= 500 {
                                    let current_time = (pct / 100.0) * segment_dur;
                                    let _ = app_for_stdout.emit("download-progress", DownloadProgress {
                                        download_id: download_id_for_stdout.clone(),
                                        progress: pct.min(99.0),
                                        current_time: Some(current_time),
                                        total_time: Some(segment_dur),
                                        status: format!("Downloading segment: {:.1}%", pct),
                                    });
                                    last_progress_time = std::time::Instant::now();
                                }
                            }
                        }
                    } else if !line.is_empty() {
                        println!("[Twitch] yt-dlp: {}", line);
                    }
                }
            }));

        // Drain stderr for warnings/errors + progress fallback
        let stderr_task = if let Some(stderr) = stderr {
            Some(tokio::spawn(async move {
                use tokio::io::{AsyncBufReadExt, BufReader};
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();
                let mut last_progress_time = std::time::Instant::now();
                while let Ok(Some(line)) = lines.next_line().await {
                    if let Some(time_str) = line.strip_prefix("out_time=") {
                        if let Some(current_time) = parse_ffmpeg_time(time_str) {
                            if current_time >= 0.0 && last_progress_time.elapsed().as_millis() >= 500 {
                                let progress = ((current_time / segment_dur) * 100.0).clamp(0.0, 99.0);
                                let _ = app_for_stderr.emit("download-progress", DownloadProgress {
                                    download_id: download_id_for_stderr.clone(),
                                    progress,
                                    current_time: Some(current_time),
                                    total_time: Some(segment_dur),
                                    status: format!("Downloading segment: {:.1}%", progress),
                                });
                                last_progress_time = std::time::Instant::now();
                            }
                        }
                        continue;
                    }
                    if line.contains("% of") || line.contains("100% of") {
                        if let Some(pct_str) = line.split('%').next() {
                            let pct_str = pct_str.trim_start_matches(|c: char| !c.is_ascii_digit() && c != '.');
                            if let Ok(pct) = pct_str.trim().parse::<f64>() {
                                if last_progress_time.elapsed().as_millis() >= 500 {
                                    let current_time = (pct / 100.0) * segment_dur;
                                    let _ = app_for_stderr.emit("download-progress", DownloadProgress {
                                        download_id: download_id_for_stderr.clone(),
                                        progress: pct.min(99.0),
                                        current_time: Some(current_time),
                                        total_time: Some(segment_dur),
                                        status: format!("Downloading segment: {:.1}%", pct),
                                    });
                                    last_progress_time = std::time::Instant::now();
                                }
                            }
                        }
                    } else if !line.is_empty() {
                        println!("[Twitch] yt-dlp stderr: {}", line);
                    }
                }
            }))
        } else {
            None
        };

        let mut stdout_task = stdout_task;
        let mut stderr_task = stderr_task;

        // Wait for yt-dlp to complete or cancellation
        let status = tokio::select! {
            result = child.wait() => result
                .map_err(|e| format!("Failed to wait for yt-dlp: {}", e))?,
            _ = &mut cancel_rx => {
                println!("[Twitch] Segment download cancelled, terminating yt-dlp...");
                let _ = child.kill().await;
                if let Some(task) = stdout_task.take() {
                    task.abort();
                }
                if let Some(task) = stderr_task.take() {
                    task.abort();
                }
                return Err("Segment download cancelled".to_string());
            }
        };

        // Wait for output tasks
        if let Some(task) = stderr_task {
            let _ = task.await;
        }
        if let Some(task) = stdout_task {
            let _ = task.await;
        }

        if !status.success() {
            return Err(format!("yt-dlp failed with exit code: {:?}", status.code()));
        }

        println!("[Twitch] yt-dlp segment download completed successfully");

        // Verify the file exists
        if !video_path.exists() {
            return Err("Download completed but file not found".to_string());
        }

        // Get file metadata
        let metadata = std::fs::metadata(&video_path)
            .map_err(|e| format!("Failed to get file metadata: {}", e))?;
        let file_size = metadata.len();

        // Generate thumbnail
        println!("[Twitch] Generating thumbnail for segment...");
        let thumbnail_path = paths.thumbnails.join(format!("{}_thumb.jpg", filename.replace(".mp4", "")));
        let thumbnail_result = no_window(tokio::process::Command::new(&ffmpeg_path)
            .args([
                "-hwaccel", "auto",
                "-ss", "00:00:01",
                "-i", &video_path_str,
                "-vframes", "1",
                "-vf", "scale=320:-1",
                "-y",
                thumbnail_path.to_str().ok_or("Invalid thumbnail path")?,
            ]))
            .output()
            .await;

        let thumbnail_path_str = match thumbnail_result {
            Ok(output) if output.status.success() => {
                println!("[Twitch] Thumbnail generated: {}", thumbnail_path.display());
                Some(thumbnail_path.to_string_lossy().to_string())
            }
            _ => {
                println!("[Twitch] Thumbnail generation failed");
                None
            }
        };

        // Get video info with timeout to prevent hanging
        println!("[Twitch] Getting segment video info...");
        let video_info = tokio::time::timeout(
            std::time::Duration::from_secs(30),
            get_video_info(&app_clone, &video_path)
        ).await;
        
        let (width, height, codec, actual_duration) = match video_info {
            Ok(Ok(info)) => {
                println!("[Twitch] Segment video info - width: {}, height: {}, codec: {}, duration: {:?}", 
                    info.width, info.height, info.codec, info.duration);
                (Some(info.width), Some(info.height), Some(info.codec.clone()), info.duration)
            }
            Ok(Err(e)) => {
                println!("[Twitch] Failed to get segment video info: {}", e);
                (None, None, None, None)
            }
            Err(_) => {
                println!("[Twitch] Segment video info timed out after 30 seconds");
                (None, None, None, None)
            }
        };

        // Use actual duration from file if available
        let final_duration = actual_duration.unwrap_or(segment_duration);

        println!("[Twitch] Segment download task completed successfully");
        Ok(DownloadResult {
            download_id: download_id_clone,
            success: true,
            file_path: Some(video_path_str),
            thumbnail_path: thumbnail_path_str,
            duration: Some(final_duration),
            width,
            height,
            codec,
            file_size: Some(file_size),
            error: None,
        })
    }).await;

    println!("[Twitch] Async segment download task completed");

    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.remove(&download_id);
    }

    cleanup_download();

    println!("[Twitch] Processing segment download result...");
    match result {
        Ok(Ok(download_result)) => {
            println!("[Twitch] Segment download successful!");

            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 100.0,
                current_time: None,
                total_time: None,
                status: "Segment download completed!".to_string(),
            });

            let _ = app.emit("download-complete", download_result);

            Ok(())
        }
        Ok(Err(e)) => {
            let error_msg = format!("Segment download failed: {}", e);
            println!("[Twitch] Segment download failed: {}", error_msg);

            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 0.0,
                current_time: None,
                total_time: None,
                status: error_msg.clone(),
            });

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
            println!("[Twitch] Segment download task failed: {}", error_msg);

            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 0.0,
                current_time: None,
                total_time: None,
                status: error_msg.clone(),
            });

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

/// Helper function to format time for filename
fn format_time_for_filename(seconds: f64) -> String {
    let h = (seconds / 3600.0) as u32;
    let m = ((seconds % 3600.0) / 60.0) as u32;
    let s = (seconds % 60.0) as u32;
    format!("{:02}{:02}{:02}", h, m, s)
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
