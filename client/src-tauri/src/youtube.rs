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
use crate::ffmpeg_utils::{get_video_info, parse_ffmpeg_time};

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
struct YouTubeRecordingEntry {
    stop_tx: Option<oneshot::Sender<()>>,
    task: tokio::task::JoinHandle<()>,
}

static YOUTUBE_ACTIVE_RECORDINGS: Lazy<Arc<Mutex<HashMap<String, YouTubeRecordingEntry>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Event payloads for frontend communication
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct YouTubeSegmentReadyPayload {
    streamer_id: String,
    session_id: String,
    channel_id: String,
    segment: u32,
    path: String,
    duration: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct YouTubeRecorderLogPayload {
    streamer_id: String,
    channel_id: String,
    message: String,
    level: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct YouTubeStreamEndedPayload {
    streamer_id: String,
    session_id: String,
    channel_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct YouTubeRecorderExitPayload {
    streamer_id: String,
    session_id: String,
    channel_id: String,
    code: Option<i32>,
}

static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .expect("Failed to build reqwest client")
});

/// Simplified live status response for frontend
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YouTubeLiveStatus {
    pub is_live: bool,
    pub channel_id: Option<String>,
    pub channel_name: Option<String>,
    pub stream_title: Option<String>,
    pub viewer_count: Option<String>,
    pub thumbnail_url: Option<String>,
    pub started_at: Option<String>,
}

/// VOD info from yt-dlp
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YouTubeVod {
    pub video_id: String,
    pub title: Option<String>,
    pub duration: Option<f64>,
    pub view_count: Option<i64>,
    pub thumbnail_url: Option<String>,
    pub upload_date: Option<String>,
    pub url: String,
}

/// Check if a YouTube channel is live using InnerTube API
/// 
/// # Arguments
/// * `channel` - YouTube channel ID (UC...) or handle (@username)
#[tauri::command]
pub async fn check_youtube_livestream(channel: String) -> Result<String, String> {
    let channel_id = normalize_channel_input(&channel);
    
    // Use YouTube's InnerTube API (same as their website)
    let url = "https://www.youtube.com/youtubei/v1/browse";
    
    // Determine if input is handle or channel ID
    let browse_id = if channel_id.starts_with('@') {
        // For handles, we need to resolve to channel ID first
        match resolve_handle_to_channel_id(&channel_id).await {
            Ok(id) => id,
            Err(e) => return Err(format!("Failed to resolve handle: {}", e)),
        }
    } else if channel_id.starts_with("UC") {
        channel_id.clone()
    } else {
        // Assume it's a channel ID without UC prefix
        format!("UC{}", channel_id)
    };
    
    let body = serde_json::json!({
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20250101"
            }
        },
        "browseId": browse_id
    });
    
    let response = HTTP_CLIENT
        .post(url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("InnerTube API request failed: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("InnerTube API error: {}", response.status()));
    }
    
    let data: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse InnerTube response: {}", e))?;
    
    // Parse response for live stream
    let is_live = check_if_live_from_response(&data);
    let stream_info = extract_stream_info(&data);
    
    let status = YouTubeLiveStatus {
        is_live,
        channel_id: Some(browse_id),
        channel_name: stream_info.channel_name,
        stream_title: stream_info.title,
        viewer_count: stream_info.viewer_count,
        thumbnail_url: stream_info.thumbnail,
        started_at: None,
    };
    
    Ok(serde_json::to_string(&status).unwrap())
}

/// Resolve YouTube handle (@username) to channel ID
async fn resolve_handle_to_channel_id(handle: &str) -> Result<String, String> {
    let url = "https://www.youtube.com/youtubei/v1/search";
    
    let body = serde_json::json!({
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20250101"
            }
        },
        "query": handle
    });
    
    let response = HTTP_CLIENT
        .post(url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Search API request failed: {}", e))?;
    
    let data: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse search response: {}", e))?;
    
    // Extract channel ID from search results
    if let Some(contents) = data["contents"]["twoColumnSearchResultsRenderer"]["primaryContents"]
        ["sectionListRenderer"]["contents"].as_array() 
    {
        for section in contents {
            if let Some(items) = section["itemSectionRenderer"]["contents"].as_array() {
                for item in items {
                    if let Some(channel_id) = item["channelRenderer"]["channelId"].as_str() {
                        return Ok(channel_id.to_string());
                    }
                }
            }
        }
    }
    
    Err("Could not resolve handle to channel ID".to_string())
}

struct StreamInfo {
    channel_name: Option<String>,
    title: Option<String>,
    viewer_count: Option<String>,
    thumbnail: Option<String>,
}

fn check_if_live_from_response(data: &serde_json::Value) -> bool {
    // Check for live badge in channel page
    if let Some(tabs) = data["contents"]["twoColumnBrowseResultsRenderer"]["tabs"].as_array() {
        for tab in tabs {
            if let Some(contents) = tab["tabRenderer"]["content"]["richGridRenderer"]["contents"].as_array() {
                for item in contents {
                    if let Some(renderer) = item.get("richItemRenderer") {
                        if let Some(badges) = renderer["content"]["videoRenderer"]["badges"].as_array() {
                            for badge in badges {
                                if let Some(label) = badge["metadataBadgeRenderer"]["label"].as_str() {
                                    if label == "LIVE" {
                                        return true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    false
}

fn extract_stream_info(data: &serde_json::Value) -> StreamInfo {
    let mut info = StreamInfo {
        channel_name: None,
        title: None,
        viewer_count: None,
        thumbnail: None,
    };
    
    // Extract channel name
    if let Some(name) = data["header"]["c4TabbedHeaderRenderer"]["title"].as_str() {
        info.channel_name = Some(name.to_string());
    }
    
    // Extract live stream info
    if let Some(tabs) = data["contents"]["twoColumnBrowseResultsRenderer"]["tabs"].as_array() {
        for tab in tabs {
            if let Some(contents) = tab["tabRenderer"]["content"]["richGridRenderer"]["contents"].as_array() {
                for item in contents {
                    if let Some(renderer) = item["richItemRenderer"]["content"]["videoRenderer"].as_object() {
                        // Check if it's live
                        if let Some(badges) = renderer.get("badges") {
                            if badges.as_array().map_or(false, |b| {
                                b.iter().any(|badge| {
                                    badge["metadataBadgeRenderer"]["label"].as_str() == Some("LIVE")
                                })
                            }) {
                                // Extract title
                                if let Some(title) = renderer["title"]["runs"][0]["text"].as_str() {
                                    info.title = Some(title.to_string());
                                }
                                
                                // Extract viewer count
                                if let Some(count) = renderer["viewCountText"]["runs"][0]["text"].as_str() {
                                    info.viewer_count = Some(count.to_string());
                                }
                                
                                // Extract thumbnail
                                if let Some(thumbnails) = renderer["thumbnail"]["thumbnails"].as_array() {
                                    if let Some(url) = thumbnails.last().and_then(|t| t["url"].as_str()) {
                                        info.thumbnail = Some(url.to_string());
                                    }
                                }
                                
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
    
    info
}

/// Get list of VODs from a YouTube channel using yt-dlp
#[tauri::command]
pub async fn get_youtube_vods(channel: String, limit: Option<u32>) -> Result<String, String> {
    let channel_id = normalize_channel_input(&channel);
    let ytdlp_path = resolve_ytdlp_binary()?;
    
    let limit_str = limit.unwrap_or(10).to_string();
    let channel_url = if channel_id.starts_with('@') {
        format!("https://www.youtube.com/{}/videos", channel_id)
    } else {
        format!("https://www.youtube.com/channel/{}/videos", channel_id)
    };
    
    let mut cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut cmd);
    
    cmd.arg("--dump-json")
        .arg("--playlist-end").arg(&limit_str)
        .arg("--skip-download")
        .arg(&channel_url);
    
    let output = cmd.output().await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp failed: {}", stderr));
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut vods = Vec::new();
    
    for line in stdout.lines() {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
            let vod = YouTubeVod {
                video_id: json["id"].as_str().unwrap_or("").to_string(),
                title: json["title"].as_str().map(String::from),
                duration: json["duration"].as_f64(),
                view_count: json["view_count"].as_i64(),
                thumbnail_url: json["thumbnail"].as_str().map(String::from),
                upload_date: json["upload_date"].as_str().map(String::from),
                url: json["webpage_url"].as_str().unwrap_or("").to_string(),
            };
            vods.push(vod);
        }
    }
    
    Ok(serde_json::to_string(&vods).unwrap())
}

/// Download a YouTube VOD using yt-dlp
#[tauri::command]
pub async fn download_youtube_vod(
    app: tauri::AppHandle,
    vod_url: String,
    output_path: String,
    download_id: String,
) -> Result<(), String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    let ffmpeg_path = resolve_ffmpeg_binary()?;
    
    let output_dir = PathBuf::from(&output_path);
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create output directory: {}", e))?;
    
    let output_file = output_dir.join("%(title)s.%(ext)s");
    
    let (cancel_tx, mut cancel_rx) = oneshot::channel::<()>();
    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.insert(download_id.clone(), cancel_tx);
    }
    
    let download_id_clone = download_id.clone();
    let app_clone = app.clone();
    
    tokio::spawn(async move {
        let mut cmd = tokio::process::Command::new(&ytdlp_path);
        no_window(&mut cmd);
        
        cmd.arg("--ffmpeg-location").arg(&ffmpeg_path)
            .arg("-o").arg(output_file.to_string_lossy().to_string())
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
        
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();
        
        // Monitor progress
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
                        let _ = app_clone.emit("download-complete", DownloadResult {
                            download_id: download_id_clone,
                            success: true,
                            file_path: Some(output_path),
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

/// Start recording a YouTube livestream using yt-dlp
#[tauri::command]
pub async fn start_youtube_recording(
    app: tauri::AppHandle,
    channel: String,
    streamer_id: String,
    session_id: String,
    segment_duration_minutes: Option<u32>,
) -> Result<(), String> {
    let channel_id = normalize_channel_input(&channel);
    
    // Check if already recording this channel
    if YOUTUBE_ACTIVE_RECORDINGS.lock().unwrap().contains_key(&channel_id) {
        println!("[YouTube] Recording already active for {}, sharing existing session", channel_id);
        return Ok(());
    }
    
    let output_dir = storage::get_livestream_recordings_dir()?;
    let session_dir = output_dir.join(&session_id);
    std::fs::create_dir_all(&session_dir)
        .map_err(|e| format!("Failed to create session directory: {}", e))?;
    
    let segment_duration = segment_duration_minutes.unwrap_or(5);
    let (stop_tx, stop_rx) = oneshot::channel();
    
    let channel_clone = channel_id.clone();
    let streamer_clone = streamer_id.clone();
    let session_clone = session_id.clone();
    let output_str = session_dir.to_string_lossy().to_string();
    let app_handle = app.clone();
    
    let task = tokio::spawn(async move {
        if let Err(err) = run_youtube_recorder(
            app_handle,
            channel_clone.clone(),
            streamer_clone,
            session_clone,
            output_str,
            segment_duration,
            stop_rx,
        ).await {
            eprintln!("[YouTubeRecorder] {}", err);
        }
        
        // Cleanup
        YOUTUBE_ACTIVE_RECORDINGS.lock().unwrap().remove(&channel_clone);
    });
    
    YOUTUBE_ACTIVE_RECORDINGS.lock().unwrap().insert(
        channel_id,
        YouTubeRecordingEntry {
            stop_tx: Some(stop_tx),
            task,
        },
    );
    
    Ok(())
}

async fn run_youtube_recorder(
    app: tauri::AppHandle,
    channel_id: String,
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
    
    // Construct YouTube live URL
    let stream_url = if channel_id.starts_with('@') {
        format!("https://www.youtube.com/{}/live", channel_id)
    } else {
        format!("https://www.youtube.com/channel/{}/live", channel_id)
    };
    
    // Spawn yt-dlp to output stream to stdout
    let mut ytdlp_cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut ytdlp_cmd);
    
    ytdlp_cmd
        .arg(&stream_url)
        .arg("-o").arg("-")
        .arg("--quiet")
        .arg("--no-part")
        .arg("--live-from-start")
        .arg("--ffmpeg-location").arg(&ffmpeg_path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    
    let mut ytdlp_child = ytdlp_cmd.spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;
    
    let ytdlp_stdout = ytdlp_child.stdout.take()
        .ok_or("Failed to get yt-dlp stdout")?;
    
    // Drain stderr in background
    if let Some(ytdlp_stderr) = ytdlp_child.stderr.take() {
        let channel_log = channel_id.clone();
        let streamer_log = streamer_id.clone();
        let app_log = app.clone();
        
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(ytdlp_stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                println!("[YouTubeRecorder] yt-dlp: {}", line);
                let _ = app_log.emit("youtube-recorder-log", YouTubeRecorderLogPayload {
                    streamer_id: streamer_log.clone(),
                    channel_id: channel_log.clone(),
                    message: line,
                    level: "info".to_string(),
                });
            }
        });
    }
    
    // Convert to std::process::Stdio for FFmpeg
    let ytdlp_stdout_std: std::process::Stdio = ytdlp_stdout.try_into()
        .map_err(|e| format!("Failed to convert stdout: {}", e))?;
    
    // Spawn FFmpeg for HLS output
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
    
    // Drain FFmpeg stderr
    if let Some(ffmpeg_stderr) = ffmpeg_child.stderr.take() {
        let channel_log = channel_id.clone();
        let streamer_log = streamer_id.clone();
        let app_log = app.clone();
        
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(ffmpeg_stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                println!("[YouTubeRecorder] FFmpeg: {}", line);
                let _ = app_log.emit("youtube-recorder-log", YouTubeRecorderLogPayload {
                    streamer_id: streamer_log.clone(),
                    channel_id: channel_log.clone(),
                    message: line,
                    level: "info".to_string(),
                });
            }
        });
    }
    
    // Monitor for segments and stop signal
    let mut last_emitted_segment: u32 = 0;
    
    loop {
        tokio::select! {
            status = ffmpeg_child.wait() => {
                println!("[YouTubeRecorder] FFmpeg exited: {:?}", status);
                let _ = ytdlp_child.kill().await;
                
                let _ = app.emit("youtube-recorder-exit", YouTubeRecorderExitPayload {
                    streamer_id: streamer_id.clone(),
                    session_id: session_id.clone(),
                    channel_id: channel_id.clone(),
                    code: status.ok().and_then(|s| s.code()),
                });
                
                break;
            }
            
            _ = &mut stop_rx => {
                println!("[YouTubeRecorder] Stop signal received");
                let _ = ffmpeg_child.kill().await;
                let _ = ytdlp_child.kill().await;
                break;
            }
            
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(2)) => {
                // Check for new segments
                let next_segment_index = last_emitted_segment;
                let seg_path = PathBuf::from(&output_dir).join(format!("segment_{:04}.ts", next_segment_index));
                
                if seg_path.exists() {
                    // Verify stability
                    let size1 = std::fs::metadata(&seg_path).ok().map(|m| m.len());
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    let size2 = std::fs::metadata(&seg_path).ok().map(|m| m.len());
                    
                    if let (Some(s1), Some(s2)) = (size1, size2) {
                        if s1 == s2 && s1 > 0 {
                            let segment_number = next_segment_index + 1;
                            
                            let _ = app.emit("youtube-segment-ready", YouTubeSegmentReadyPayload {
                                streamer_id: streamer_id.clone(),
                                session_id: session_id.clone(),
                                channel_id: channel_id.clone(),
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

/// Stop recording a YouTube livestream
#[tauri::command]
pub async fn stop_youtube_recording(channel: String) -> Result<(), String> {
    let channel_id = normalize_channel_input(&channel);
    
    let entry_opt = {
        let mut recordings = YOUTUBE_ACTIVE_RECORDINGS.lock().unwrap();
        recordings.remove(&channel_id)
    };
    
    if let Some(mut entry) = entry_opt {
        if let Some(stop_tx) = entry.stop_tx.take() {
            let _ = stop_tx.send(());
        }
        
        let _ = entry.task.await;
        println!("[YouTube] Stopped recording for {}", channel_id);
        Ok(())
    } else {
        Err(format!("No active recording for channel: {}", channel_id))
    }
}

/// Stop all active YouTube recordings
#[tauri::command]
pub async fn stop_all_youtube_recordings() -> Result<(), String> {
    let channels: Vec<String> = {
        let recordings = YOUTUBE_ACTIVE_RECORDINGS.lock().unwrap();
        recordings.keys().cloned().collect()
    };
    
    for channel in channels {
        let _ = stop_youtube_recording(channel).await;
    }
    
    Ok(())
}

/// Get the output directory for a YouTube recording session
#[tauri::command]
pub fn get_youtube_session_output_dir(session_id: String) -> Result<String, String> {
    let output_dir = storage::get_livestream_recordings_dir()?;
    let session_dir = output_dir.join(&session_id);
    Ok(session_dir.to_string_lossy().to_string())
}

/// Get list of active YouTube recordings
#[tauri::command]
pub fn get_active_youtube_recordings() -> Result<Vec<String>, String> {
    let recordings = YOUTUBE_ACTIVE_RECORDINGS.lock().unwrap();
    Ok(recordings.keys().cloned().collect())
}

// Helper functions

fn normalize_channel_input(input: &str) -> String {
    let trimmed = input.trim();
    
    // Handle various URL formats
    if trimmed.contains("youtube.com/") || trimmed.contains("youtu.be/") {
        // Extract channel ID or handle from URL
        if let Some(channel_part) = trimmed.split("/channel/").nth(1) {
            return channel_part.split('/').next().unwrap_or(trimmed).to_string();
        } else if let Some(handle_part) = trimmed.split("/@").nth(1) {
            return format!("@{}", handle_part.split('/').next().unwrap_or(""));
        } else if let Some(user_part) = trimmed.split("/user/").nth(1) {
            return user_part.split('/').next().unwrap_or(trimmed).to_string();
        }
    }
    
    trimmed.to_string()
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
