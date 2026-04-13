use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
};

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tokio::sync::oneshot;
use tauri::Emitter;
use tokio::io::AsyncBufReadExt;
use crate::downloads::{
    DownloadProgress, DownloadResult, ACTIVE_DOWNLOADS, ACTIVE_DOWNLOAD_CANCELLERS, DOWNLOAD_METADATA,
    DownloadMetadata,
};
use crate::storage;
use crate::thumbnail_utils::generate_thumbnail_hybrid;

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
    channel_id: String, // Store channel_id to allow lookup by channel
}

// Track recordings by session_id instead of channel_id to allow multiple sessions per channel
// This enables both temp viewer sessions (4-sec segments) and persistent auto-detect sessions
// to record the same channel simultaneously in different directories
static YOUTUBE_ACTIVE_RECORDINGS: Lazy<Arc<Mutex<HashMap<String, YouTubeRecordingEntry>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Event payloads for frontend communication
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct YouTubeSegmentReadyPayload {
    streamer_id: String,
    session_id: String,
    channel_id: String,
    mint_id: String,
    segment: u32,
    path: String,
    duration: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct YouTubeRecorderLogPayload {
    streamer_id: String,
    channel_id: String,
    mint_id: String,
    message: String,
    level: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct YouTubeStreamEndedPayload {
    streamer_id: String,
    session_id: String,
    channel_id: String,
    mint_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct YouTubeRecorderExitPayload {
    streamer_id: String,
    session_id: String,
    channel_id: String,
    mint_id: String,
    code: Option<i32>,
}


/// Simplified live status response for frontend
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YouTubeLiveStatus {
    pub is_live: bool,
    pub channel_id: Option<String>,
    pub channel_name: Option<String>,
    pub display_name: Option<String>,
    pub profile_image_url: Option<String>,
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

/// Check if a YouTube channel is live using yt-dlp
/// 
/// # Arguments
/// * `channel` - YouTube channel ID (UC...), handle (@username), or channel URL
#[tauri::command]
pub async fn check_youtube_livestream(channel: String) -> Result<String, String> {
    let channel_id = normalize_channel_input(&channel);
    let ytdlp_path = resolve_ytdlp_binary()?;

    // Build the live URL for the channel
    let live_url = if channel_id.starts_with('@') {
        format!("https://www.youtube.com/{}/live", channel_id)
    } else if channel_id.starts_with("UC") {
        format!("https://www.youtube.com/channel/{}/live", channel_id)
    } else {
        format!("https://www.youtube.com/@{}/live", channel_id)
    };

    let mut cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut cmd);

    cmd.arg("--dump-json")
        .arg("--skip-download")
        .arg("--no-playlist")
        .arg("--impersonate").arg("chrome")
        .arg(&live_url)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let output = cmd.output().await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    if let Ok(json) = serde_json::from_str::<serde_json::Value>(stdout.trim()) {
        let is_live = json["is_live"].as_bool().unwrap_or(false)
            || json["live_status"].as_str() == Some("is_live");

        let channel_name = json["uploader"].as_str().map(String::from)
            .or_else(|| json["channel"].as_str().map(String::from));
        let display_name = json["uploader"].as_str().map(String::from)
            .or_else(|| json["channel"].as_str().map(String::from));

        let status = YouTubeLiveStatus {
            is_live,
            channel_id: Some(channel_id.clone()),
            channel_name,
            display_name,
            profile_image_url: None,
            stream_title: json["title"].as_str().map(String::from),
            viewer_count: json["concurrent_view_count"].as_i64()
                .map(|v| v.to_string())
                .or_else(|| json["view_count"].as_i64().map(|v| v.to_string())),
            thumbnail_url: json["thumbnail"].as_str().map(String::from),
            started_at: json["timestamp"].as_i64().map(|t| t.to_string()),
        };

        return Ok(serde_json::to_string(&status).unwrap());
    }

    // yt-dlp returned no JSON — channel is not live
    let status = YouTubeLiveStatus {
        is_live: false,
        channel_id: Some(channel_id),
        channel_name: None,
        display_name: None,
        profile_image_url: None,
        stream_title: None,
        viewer_count: None,
        thumbnail_url: None,
        started_at: None,
    };

    Ok(serde_json::to_string(&status).unwrap())
}

/// Get a single YouTube video's metadata using yt-dlp
#[tauri::command]
pub async fn get_single_youtube_video(video_url: String) -> Result<String, String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    
    println!("[YouTube] Fetching single video: {}", video_url);

    let mut cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut cmd);

    cmd.arg("--dump-json")
        .arg("--skip-download")
        .arg("--no-warnings")
        .arg("--impersonate").arg("chrome")
        .arg(&video_url);

    let output = cmd.output().await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if stdout.trim().is_empty() {
        return Err(format!("yt-dlp returned no output. stderr: {}", &stderr[..stderr.len().min(500)]));
    }

    let json: serde_json::Value = serde_json::from_str(stdout.trim())
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let video_id = match json["id"].as_str() {
        Some(id) if !id.is_empty() => id.to_string(),
        _ => return Err("No video ID in response".to_string()),
    };

    let upload_date = if let Some(release_ts) = json["release_timestamp"].as_i64() {
        Some(release_ts.to_string())
    } else if let Some(ts) = json["timestamp"].as_i64() {
        Some(ts.to_string())
    } else {
        json["upload_date"].as_str().map(String::from)
    };

    let thumbnail_url = json["thumbnail"].as_str().map(String::from)
        .or_else(|| Some(format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", video_id)));

    let url = json["webpage_url"].as_str()
        .map(String::from)
        .unwrap_or_else(|| format!("https://www.youtube.com/watch?v={}", video_id));

    let vod = YouTubeVod {
        video_id,
        title: json["title"].as_str().map(String::from),
        duration: json["duration"].as_f64(),
        view_count: json["view_count"].as_i64(),
        thumbnail_url,
        upload_date,
        url,
    };

    Ok(serde_json::to_string(&vec![vod]).unwrap())
}

/// Get list of live stream VODs from a YouTube channel using yt-dlp
#[tauri::command]
pub async fn get_youtube_vods(channel: String, limit: Option<u32>) -> Result<String, String> {
    // Check if input is a direct video URL
    if let Some(video_id) = extract_video_id(&channel) {
        println!("[YouTube VODs] Detected video URL, fetching single video: {}", video_id);
        return get_single_youtube_video(format!("https://www.youtube.com/watch?v={}", video_id)).await;
    }
    
    let channel_id = normalize_channel_input(&channel);
    let ytdlp_path = resolve_ytdlp_binary()?;
    
    let limit_str = limit.unwrap_or(10).to_string();
    let channel_url = if channel_id.starts_with('@') {
        format!("https://www.youtube.com/{}/streams", channel_id)
    } else {
        format!("https://www.youtube.com/channel/{}/streams", channel_id)
    };
    
    println!("[YouTube VODs] Fetching from: {}", channel_url);

    let mut cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut cmd);

    // --dump-json outputs one JSON per video line; --skip-download avoids downloading
    // youtubetab:skip=webpage skips JS for the tab/playlist page itself
    // youtube:player_skip=webpage,configs skips JS for each individual video (avoids SABR errors)
    // Together these provide full metadata (upload_date, title, duration, etc.) without JS runtime
    cmd.arg("--dump-json")
        .arg("--skip-download")
        .arg("--no-warnings")
        .arg("--ignore-errors")
        .arg("--impersonate").arg("chrome")
        .arg("--extractor-args").arg("youtubetab:skip=webpage;youtube:player_skip=webpage,configs")
        .arg("--playlist-end").arg(&limit_str)
        .arg(&channel_url);

    let output = cmd.output().await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    println!("[YouTube VODs] stdout lines: {}", stdout.lines().count());
    if !stderr.is_empty() {
        println!("[YouTube VODs] stderr (first 300): {}", &stderr[..stderr.len().min(300)]);
    }

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

        // For live streams, prefer release_timestamp or timestamp over upload_date
        // release_timestamp/timestamp = actual stream time, upload_date = when VOD was uploaded
        let upload_date = if let Some(release_ts) = json["release_timestamp"].as_i64() {
            // Unix timestamp in seconds
            Some(release_ts.to_string())
        } else if let Some(ts) = json["timestamp"].as_i64() {
            // Unix timestamp in seconds
            Some(ts.to_string())
        } else {
            // Fallback to upload_date (YYYYMMDD format)
            json["upload_date"].as_str().map(String::from)
        };

        let thumbnail_url = json["thumbnail"].as_str().map(String::from)
            .or_else(|| Some(format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", video_id)));

        let url = json["webpage_url"].as_str()
            .map(String::from)
            .unwrap_or_else(|| format!("https://www.youtube.com/watch?v={}", video_id));

        println!("[YouTube VODs] entry: id={} upload_date={:?} release_timestamp={:?} timestamp={:?} live_status={:?}",
            video_id, json["upload_date"].as_str(), json["release_timestamp"].as_i64(), json["timestamp"].as_i64(), json["live_status"].as_str());

        let vod = YouTubeVod {
            video_id,
            title: json["title"].as_str().map(String::from),
            duration: json["duration"].as_f64(),
            view_count: json["view_count"].as_i64(),
            thumbnail_url,
            upload_date,
            url,
        };
        vods.push(vod);
    }

    Ok(serde_json::to_string(&vods).unwrap())
}

/// Get list of regular videos (not live streams) from a YouTube channel using yt-dlp
#[tauri::command]
pub async fn get_youtube_videos(channel: String, limit: Option<u32>) -> Result<String, String> {
    // Check if input is a direct video URL
    if let Some(video_id) = extract_video_id(&channel) {
        println!("[YouTube Videos] Detected video URL, fetching single video: {}", video_id);
        return get_single_youtube_video(format!("https://www.youtube.com/watch?v={}", video_id)).await;
    }
    
    let channel_id = normalize_channel_input(&channel);
    let ytdlp_path = resolve_ytdlp_binary()?;
    
    let limit_str = limit.unwrap_or(10).to_string();
    let channel_url = if channel_id.starts_with('@') {
        format!("https://www.youtube.com/{}/videos", channel_id)
    } else {
        format!("https://www.youtube.com/channel/{}/videos", channel_id)
    };
    
    println!("[YouTube Videos] Fetching from: {}", channel_url);

    let mut cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut cmd);

    cmd.arg("--dump-json")
        .arg("--skip-download")
        .arg("--no-warnings")
        .arg("--ignore-errors")
        .arg("--impersonate").arg("chrome")
        .arg("--extractor-args").arg("youtubetab:skip=webpage;youtube:player_skip=webpage,configs")
        .arg("--playlist-end").arg(&limit_str)
        .arg(&channel_url);

    let output = cmd.output().await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    println!("[YouTube Videos] stdout lines: {}", stdout.lines().count());
    if !stderr.is_empty() {
        println!("[YouTube Videos] stderr (first 300): {}", &stderr[..stderr.len().min(300)]);
    }

    if stdout.trim().is_empty() {
        return Err(format!("yt-dlp returned no output. stderr: {}", &stderr[..stderr.len().min(500)]));
    }

    let mut videos = Vec::new();

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

        // For videos, prefer release_timestamp or timestamp over upload_date
        let upload_date = if let Some(release_ts) = json["release_timestamp"].as_i64() {
            Some(release_ts.to_string())
        } else if let Some(ts) = json["timestamp"].as_i64() {
            Some(ts.to_string())
        } else {
            json["upload_date"].as_str().map(String::from)
        };

        let thumbnail_url = json["thumbnail"].as_str().map(String::from)
            .or_else(|| Some(format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", video_id)));

        let url = json["webpage_url"].as_str()
            .map(String::from)
            .unwrap_or_else(|| format!("https://www.youtube.com/watch?v={}", video_id));

        println!("[YouTube Videos] entry: id={} upload_date={:?} release_timestamp={:?} timestamp={:?} live_status={:?}",
            video_id, json["upload_date"].as_str(), json["release_timestamp"].as_i64(), json["timestamp"].as_i64(), json["live_status"].as_str());

        let video = YouTubeVod {
            video_id,
            title: json["title"].as_str().map(String::from),
            duration: json["duration"].as_f64(),
            view_count: json["view_count"].as_i64(),
            thumbnail_url,
            upload_date,
            url,
        };
        videos.push(video);
    }

    Ok(serde_json::to_string(&videos).unwrap())
}

/// Download a YouTube VOD using yt-dlp
#[tauri::command]
pub async fn download_youtube_vod(
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
            println!("[YouTube] Download already in progress: {}", download_id);
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

    let filename = format!("youtube_{}_{}_{}.mp4", channel_name, safe_title, timestamp);
    let output_file = paths.videos.join(&filename);
    
    // Clean up when done
    let cleanup_download = {
        let download_id = download_id.clone();
        let downloads = ACTIVE_DOWNLOADS.clone();
        move || {
            println!("[YouTube] Cleaning up download: {}", download_id);
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
    println!("[YouTube] Fetching video duration for {}", vod_url);
    let total_duration = match get_youtube_vod_duration(app.clone(), vod_url.clone()).await {
        Ok(dur) => {
            println!("[YouTube] Video duration: {:.2}s", dur);
            Some(dur)
        }
        Err(e) => {
            println!("[YouTube] Failed to fetch duration: {}", e);
            None
        }
    };
    
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
            use tokio::io::{AsyncBufReadExt, BufReader};
            let mut stdout_reader = BufReader::new(stdout).lines();
            let mut stderr_reader = BufReader::new(stderr).lines();
            
            loop {
                tokio::select! {
                    line = stdout_reader.next_line() => {
                        match line {
                            Ok(Some(line)) => {
                                println!("[YouTube] yt-dlp: {}", line);
                                
                                if line.contains("[download]") && line.contains("%") {
                                    if let Some(percent_str) = line.split_whitespace()
                                        .find(|s| s.ends_with('%'))
                                        .and_then(|s| s.trim_end_matches('%').parse::<f64>().ok())
                                    {
                                        // Calculate current_time from percentage and total_duration
                                        let current_time = total_duration.map(|dur| (percent_str / 100.0) * dur);
                                        
                                        let _ = app_progress.emit("download-progress", DownloadProgress {
                                            download_id: download_id_progress.clone(),
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
                            println!("[YouTube] yt-dlp stderr: {}", line);
                            
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
                                                
                                                let _ = app_progress.emit("download-progress", DownloadProgress {
                                                    download_id: download_id_progress.clone(),
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
                        
                        // Get file metadata
                        let file_size = std::fs::metadata(&output_file_str)
                            .ok()
                            .map(|m| m.len());
                        
                        // Generate thumbnail using hybrid approach (yt-dlp first, FFmpeg fallback)
                        println!("[YouTube] Generating thumbnail...");
                        let thumbnail_path = paths.thumbnails.join(format!("{}_thumb.jpg", filename.replace(".mp4", "")));
                        
                        let thumbnail_path_str = match generate_thumbnail_hybrid(
                            &ytdlp_path,
                            &ffmpeg_path,
                            &vod_url,
                            &thumbnail_path,
                            "00:00:05",
                        ).await {
                            Ok(()) => {
                                println!("[YouTube] Thumbnail generated: {}", thumbnail_path.display());
                                Some(thumbnail_path.to_string_lossy().to_string())
                            }
                            Err(e) => {
                                println!("[YouTube] Thumbnail generation failed: {}", e);
                                None
                            }
                        };
                        
                        // Get video info
                        println!("[YouTube] Getting video info...");
                        let video_info = crate::ffmpeg_utils::get_video_info(&app_clone, &std::path::Path::new(&output_file_str)).await.ok();
                        let (width, height, codec, duration) = if let Some(ref info) = video_info {
                            println!("[YouTube] Video info - width: {}, height: {}, codec: {}, duration: {:?}", 
                                info.width, info.height, info.codec, info.duration);
                            (Some(info.width), Some(info.height), Some(info.codec.clone()), info.duration)
                        } else {
                            println!("[YouTube] Could not get video info");
                            (None, None, None, None)
                        };
                        
                        let _ = app_clone.emit("download-complete", DownloadResult {
                            download_id: download_id_clone,
                            success: true,
                            file_path: Some(output_file_str),
                            thumbnail_path: thumbnail_path_str,
                            duration,
                            width,
                            height,
                            codec,
                            file_size,
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
    
    // Check if this specific session is already recording
    // Allow multiple sessions per channel (e.g., temp viewer + persistent auto-detect)
    if YOUTUBE_ACTIVE_RECORDINGS.lock().unwrap().contains_key(&session_id) {
        println!("[YouTube] Session {} already recording, skipping duplicate start", session_id);
        return Ok(());
    }
    
    let output_dir = storage::get_livestream_recordings_dir()?;
    let session_dir = output_dir.join(&session_id);
    std::fs::create_dir_all(&session_dir)
        .map_err(|e| format!("Failed to create session directory: {}", e))?;
    
    let segment_duration_minutes = segment_duration_minutes.unwrap_or(1);
    
    // HLS segment duration in seconds
    // For Auto-Detect/Record: use user-configured segment duration (e.g., 5 minutes = 300 seconds)
    // For Watch mode (segment_duration_minutes <= 1): use 4-second segments for low-latency playback
    let segment_duration_secs = if segment_duration_minutes <= 1 {
        4 // Low-latency mode for live watching
    } else {
        segment_duration_minutes * 60 // Convert minutes to seconds for recording
    };
    let (stop_tx, stop_rx) = oneshot::channel();
    
    let channel_clone = channel_id.clone();
    let streamer_clone = streamer_id.clone();
    let session_clone = session_id.clone();
    let output_str = session_dir.to_string_lossy().to_string();
    let app_handle = app.clone();
    
    let session_for_cleanup = session_id.clone();
    let task = tokio::spawn(async move {
        if let Err(err) = run_youtube_recorder(
            app_handle,
            channel_clone.clone(),
            streamer_clone,
            session_clone,
            output_str,
            segment_duration_secs,
            stop_rx,
        ).await {
            eprintln!("[YouTubeRecorder] {}", err);
        }
        
        // Cleanup by session_id (not channel_id) since we track by session now
        YOUTUBE_ACTIVE_RECORDINGS.lock().unwrap().remove(&session_for_cleanup);
    });
    
    // Insert by session_id (not channel_id) to allow multiple sessions per channel
    YOUTUBE_ACTIVE_RECORDINGS.lock().unwrap().insert(
        session_id.clone(),
        YouTubeRecordingEntry {
            stop_tx: Some(stop_tx),
            task,
            channel_id,
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
    segment_duration_secs: u32,
    mut stop_rx: oneshot::Receiver<()>,
) -> Result<(), String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    let ffmpeg_path = resolve_ffmpeg_binary()?;
    
    let hls_segment_seconds = segment_duration_secs;
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
        .arg("--impersonate").arg("chrome")
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
                let _ = app_log.emit("recorder-log", YouTubeRecorderLogPayload {
                    streamer_id: streamer_log.clone(),
                    channel_id: channel_log.clone(),
                    mint_id: channel_log.clone(),
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
    
    // Drain FFmpeg stderr in background - only log important lines to avoid flooding
    if let Some(ffmpeg_stderr) = ffmpeg_child.stderr.take() {
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(ffmpeg_stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                // Only log important FFmpeg lines to avoid flooding server logs
                let dominated = line.contains("Opening") || line.contains("Skip");
                if !dominated {
                    println!("[YouTubeRecorder] FFmpeg: {}", line);
                }
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
                
                let exit_status = status.ok();
                let _ = app.emit("recorder-exit", YouTubeRecorderExitPayload {
                    streamer_id: streamer_id.clone(),
                    session_id: session_id.clone(),
                    channel_id: channel_id.clone(),
                    mint_id: channel_id.clone(),
                    code: exit_status.as_ref().and_then(|s| s.code()),
                });
                
                // If FFmpeg exited unsuccessfully, stream likely ended
                if let Some(exit_status) = exit_status {
                    if !exit_status.success() {
                        let _ = app.emit("stream-ended", YouTubeStreamEndedPayload {
                            streamer_id: streamer_id.clone(),
                            session_id: session_id.clone(),
                            channel_id: channel_id.clone(),
                            mint_id: channel_id.clone(),
                        });
                    }
                }
                
                break;
            }
            
            _ = &mut stop_rx => {
                println!("[YouTubeRecorder] Stop signal received");
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
                            println!("[YouTubeRecorder] Segment {} ready (size: {} bytes)", next_segment_index, s1);
                            
                            let segment_number = next_segment_index + 1;
                            
                            let _ = app.emit("segment-ready", YouTubeSegmentReadyPayload {
                                streamer_id: streamer_id.clone(),
                                session_id: session_id.clone(),
                                channel_id: channel_id.clone(),
                                mint_id: channel_id.clone(),
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
/// Stops ALL sessions recording this channel (both temp viewer and persistent auto-detect)
#[tauri::command]
pub async fn stop_youtube_recording(channel: String) -> Result<(), String> {
    let channel_id = normalize_channel_input(&channel);
    
    // Find all sessions recording this channel and collect their entries
    let entries: Vec<(String, YouTubeRecordingEntry)> = {
        let mut recordings = YOUTUBE_ACTIVE_RECORDINGS.lock().unwrap();
        let session_ids: Vec<String> = recordings
            .iter()
            .filter(|(_, entry)| entry.channel_id == channel_id)
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
            eprintln!("[YouTubeRecorder] Join error for session {}: {}", session_id, err);
        }
    }
    
    Ok(())
}

/// Stop a specific YouTube recording session by session_id
/// Unlike stop_youtube_recording which stops ALL sessions for a channel,
/// this only stops the one specific session, leaving others untouched.
#[tauri::command]
pub async fn stop_youtube_recording_session(session_id: String) -> Result<(), String> {
    let entry_opt = {
        let mut recordings = YOUTUBE_ACTIVE_RECORDINGS.lock().unwrap();
        recordings.remove(&session_id)
    };

    if let Some(mut entry) = entry_opt {
        if let Some(stop_tx) = entry.stop_tx.take() {
            let _ = stop_tx.send(());
        }
        if let Err(err) = entry.task.await {
            eprintln!("[YouTubeRecorder] Join error for session {}: {}", session_id, err);
        }
        println!("[YouTubeRecorder] Stopped session: {}", session_id);
    } else {
        println!("[YouTubeRecorder] No active session found for: {}", session_id);
    }

    Ok(())
}

/// Stop all active YouTube recordings
#[tauri::command]
pub async fn stop_all_youtube_recordings() -> Result<(), String> {
    let entries: Vec<(String, YouTubeRecordingEntry)> = {
        let mut recordings = YOUTUBE_ACTIVE_RECORDINGS.lock().unwrap();
        recordings.drain().collect()
    };
    
    for (session_id, mut entry) in entries {
        if let Some(stop_tx) = entry.stop_tx.take() {
            let _ = stop_tx.send(());
        }
        if let Err(err) = entry.task.await {
            eprintln!("[YouTubeRecorder] Join error for session {}: {}", session_id, err);
        }
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

/// Get list of active YouTube recording session IDs
#[tauri::command]
pub fn get_active_youtube_recordings() -> Result<Vec<String>, String> {
    let recordings = YOUTUBE_ACTIVE_RECORDINGS.lock().unwrap();
    Ok(recordings.keys().cloned().collect())
}

/// Check if a YouTube recording is currently active for a channel
#[tauri::command]
pub fn is_youtube_recording_active(channel: String) -> bool {
    let channel_id = normalize_channel_input(&channel);
    YOUTUBE_ACTIVE_RECORDINGS
        .lock()
        .unwrap()
        .values()
        .any(|entry| entry.channel_id == channel_id)
}

/// Get duration for a YouTube VOD using yt-dlp + ffprobe
/// First extracts the direct stream URL using yt-dlp, then uses ffprobe to get duration
#[tauri::command]
pub async fn get_youtube_vod_duration(_app: tauri::AppHandle, vod_url: String) -> Result<f64, String> {
    println!("[YouTube] Getting duration for URL: {}", vod_url);
    
    // Step 1: Use yt-dlp to extract the direct stream URL
    let ytdlp_path = resolve_ytdlp_binary()?;
    
    println!("[YouTube] Extracting stream URL via yt-dlp...");
    let ytdlp_output = no_window(
        tokio::process::Command::new(&ytdlp_path)
            .arg("--get-url")
            .arg("--no-download")
            .arg("--no-warnings")
            .arg("--impersonate").arg("chrome")
            .arg(&vod_url)
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
    
    println!("[YouTube] Got stream URL, probing duration with ffprobe...");
    
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
    
    println!("[YouTube] ffprobe duration output: {}", duration_str);
    
    if duration_str.is_empty() || duration_str == "N/A" {
        return Err("Duration not available".to_string());
    }
    
    duration_str.parse::<f64>()
        .map_err(|e| format!("Failed to parse duration: {}", e))
}

/// Get YouTube channel information including profile image
/// This fetches channel metadata regardless of live status
#[tauri::command]
pub async fn get_youtube_channel_info(channel: String) -> Result<String, String> {
    let channel_id = normalize_channel_input(&channel);
    let ytdlp_path = resolve_ytdlp_binary()?;

    // Build channel URL
    let channel_url = if channel_id.starts_with('@') {
        format!("https://www.youtube.com/{}", channel_id)
    } else if channel_id.starts_with("UC") {
        format!("https://www.youtube.com/channel/{}", channel_id)
    } else {
        format!("https://www.youtube.com/@{}", channel_id)
    };

    println!("[YouTube] Fetching channel info for: {}", channel_url);

    let mut cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut cmd);

    // Use --dump-json with --playlist-items 0 to get channel metadata only
    cmd.arg("--dump-json")
        .arg("--skip-download")
        .arg("--playlist-items").arg("0")
        .arg("--no-warnings")
        .arg("--impersonate").arg("chrome")
        .arg(&channel_url)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let output = cmd.output().await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if let Ok(json) = serde_json::from_str::<serde_json::Value>(stdout.trim()) {
        // Extract profile image from various possible fields
        let profile_image_url = json["thumbnail"].as_str()
            .or_else(|| json["avatar"].as_str())
            .or_else(|| json["thumbnails"].as_array().and_then(|arr| {
                arr.iter()
                    .filter_map(|t| t["url"].as_str())
                    .last()
            }))
            .or_else(|| json["channel"]["avatar"].as_str())
            .or_else(|| json["uploader_thumbnails"].as_array().and_then(|arr| {
                arr.iter()
                    .filter_map(|t| t["url"].as_str())
                    .last()
            }))
            .map(String::from);

        let channel_name = json["uploader"].as_str()
            .or_else(|| json["channel"].as_str())
            .or_else(|| json["title"].as_str())
            .map(String::from);

        let display_name = channel_name.clone();

        #[derive(Serialize)]
        #[serde(rename_all = "camelCase")]
        struct ChannelInfo {
            channel_id: String,
            channel_name: Option<String>,
            display_name: Option<String>,
            profile_image_url: Option<String>,
        }

        let info = ChannelInfo {
            channel_id: channel_id.clone(),
            channel_name,
            display_name,
            profile_image_url,
        };

        println!("[YouTube] Channel info: profile_image={:?}", info.profile_image_url);
        return Ok(serde_json::to_string(&info).unwrap());
    }

    // If JSON parsing failed, try stderr for errors
    if !stderr.is_empty() {
        println!("[YouTube] yt-dlp stderr: {}", &stderr[..stderr.len().min(300)]);
    }

    Err(format!("Failed to fetch channel info. stderr: {}", &stderr[..stderr.len().min(200)]))
}

// Helper functions

/// Extract YouTube video ID from various URL formats
/// Returns Some(video_id) if input is a video URL, None if it's a channel URL or other
fn extract_video_id(input: &str) -> Option<String> {
    let trimmed = input.trim();
    
    // youtube.com/watch?v=VIDEO_ID
    if let Some(v_param) = trimmed.split("watch?v=").nth(1) {
        let video_id = v_param.split('&').next().unwrap_or(v_param);
        if !video_id.is_empty() && video_id.len() == 11 {
            return Some(video_id.to_string());
        }
    }
    
    // youtu.be/VIDEO_ID
    if trimmed.contains("youtu.be/") {
        if let Some(id_part) = trimmed.split("youtu.be/").nth(1) {
            let video_id = id_part.split('?').next().unwrap_or(id_part).split('/').next().unwrap_or("");
            if !video_id.is_empty() && video_id.len() == 11 {
                return Some(video_id.to_string());
            }
        }
    }
    
    // youtube.com/embed/VIDEO_ID
    if let Some(embed_part) = trimmed.split("/embed/").nth(1) {
        let video_id = embed_part.split('?').next().unwrap_or(embed_part).split('/').next().unwrap_or("");
        if !video_id.is_empty() && video_id.len() == 11 {
            return Some(video_id.to_string());
        }
    }
    
    // youtube.com/v/VIDEO_ID
    if let Some(v_part) = trimmed.split("/v/").nth(1) {
        let video_id = v_part.split('?').next().unwrap_or(v_part).split('/').next().unwrap_or("");
        if !video_id.is_empty() && video_id.len() == 11 {
            return Some(video_id.to_string());
        }
    }
    
    // Direct 11-character video ID
    if trimmed.len() == 11 && !trimmed.contains('/') && !trimmed.contains('@') {
        return Some(trimmed.to_string());
    }
    
    None
}

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

/// Resolve a sidecar binary path using Tauri's naming convention.
/// Tauri places sidecars next to the executable with -{target_triple} suffix.
/// In dev mode, they're in src-tauri/binaries/ with the same naming.
/// Resolve a bundled sidecar (e.g. `yt-dlp`, `ffmpeg`, `diarize`) by target triple.
pub fn resolve_sidecar_binary(base_name: &str) -> Result<String, String> {
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
            "[YouTube] Found {} at (prod): {}",
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
            "[YouTube] Found {} at (bundle): {}",
            base_name,
            bare_path.display()
        );
        return Ok(bare_path.to_string_lossy().to_string());
    }

    // Development mode: check src-tauri/binaries/
    // In dev, exe is in target/debug/, binaries are in src-tauri/binaries/
    if let Some(target_dir) = exe_dir.parent() {
        if let Some(target_parent) = target_dir.parent() {
            let dev_path = target_parent.join("binaries").join(&binary_name);
            if dev_path.exists() {
                println!(
                    "[YouTube] Found {} at (dev): {}",
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
        "[YouTube] {} not found in bundle, falling back to PATH: {}",
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

pub fn resolve_ytdlp_binary() -> Result<String, String> {
    resolve_sidecar_binary("yt-dlp")
}

pub fn resolve_ffmpeg_binary() -> Result<String, String> {
    resolve_sidecar_binary("ffmpeg")
}

fn format_time_for_filename(seconds: f64) -> String {
    let h = (seconds / 3600.0) as u32;
    let m = ((seconds % 3600.0) / 60.0) as u32;
    let s = (seconds % 60.0) as u32;
    format!("{:02}{:02}{:02}", h, m, s)
}

/// Download a segment of a YouTube VOD using yt-dlp with time range
#[tauri::command]
pub async fn download_youtube_vod_segment(
    app: tauri::AppHandle,
    download_id: String,
    title: String,
    vod_url: String,
    channel_name: String,
    start_time: f64,
    end_time: f64,
) -> Result<(), String> {
    println!("[YouTube] download_youtube_vod_segment called with:");
    println!("[YouTube]   download_id: {}", download_id);
    println!("[YouTube]   title: {}", title);
    println!("[YouTube]   vod_url: {}", vod_url);
    println!("[YouTube]   channel_name: {}", channel_name);
    println!("[YouTube]   start_time: {}", start_time);
    println!("[YouTube]   end_time: {}", end_time);

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
            println!("[YouTube] Download already in progress: {}", download_id);
            return Err("Download already in progress".to_string());
        }
        downloads.insert(download_id.clone(), true);
        println!("[YouTube] Download registered: {}", download_id);
    }

    // Clean up when done
    let cleanup_download = {
        let download_id = download_id.clone();
        let downloads = ACTIVE_DOWNLOADS.clone();
        move || {
            println!("[YouTube] Cleaning up download: {}", download_id);
            let mut downloads = downloads.lock().unwrap();
            downloads.remove(&download_id);
        }
    };

    // Get storage paths
    println!("[YouTube] Getting storage paths...");
    let paths = storage::init_storage_dirs().map_err(|e| {
        println!("[YouTube] Failed to get storage paths: {}", e);
        format!("Failed to get storage paths: {}", e)
    })?;

    println!(
        "[YouTube] Storage paths retrieved. Videos dir: {}",
        paths.videos.display()
    );

    // Generate filename with segment info
    let safe_title = title
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    // Format times for filename
    let start_formatted = format_time_for_filename(start_time);
    let end_formatted = format_time_for_filename(end_time);

    let filename = format!(
        "youtube_{}_{}_{}_{}_{}.mp4",
        channel_name, safe_title, start_formatted, end_formatted, timestamp
    );
    let video_path = paths.videos.join(&filename);

    println!("[YouTube] Generated filename: {}", filename);
    println!("[YouTube] Full video path: {}", video_path.display());

    // Store download metadata
    {
        let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
        metadata_map.insert(
            download_id.clone(),
            DownloadMetadata {
                output_path: Some(video_path.to_string_lossy().to_string()),
                thumbnail_path: None,
                started_at: std::time::SystemTime::now(),
                process_id: None,
            },
        );
    }

    // Send initial progress
    let progress_result = app.emit(
        "download-progress",
        DownloadProgress {
            download_id: download_id.clone(),
            progress: 0.0,
            current_time: Some(0.0),
            total_time: Some(segment_duration),
            status: "Starting YouTube segment download...".to_string(),
        },
    );

    if let Err(e) = progress_result {
        println!("[YouTube] Failed to emit initial progress: {}", e);
    }

    // Clone for async block
    let app_clone = app.clone();
    let download_id_clone = download_id.clone();
    println!("[YouTube] Starting async segment download task...");

    let (cancel_tx, mut cancel_rx) = oneshot::channel();
    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.insert(download_id.clone(), cancel_tx);
    }

    let result = tokio::spawn(async move {
        println!("[YouTube] Async task started for segment download: {}", download_id_clone);

        let ytdlp_path = resolve_ytdlp_binary()?;
        let ffmpeg_path = resolve_ffmpeg_binary()?;
        let video_path_str = video_path.to_string_lossy().to_string();

        println!("[YouTube] Using yt-dlp: {}", ytdlp_path);
        println!("[YouTube] Using ffmpeg: {}", ffmpeg_path);

        // yt-dlp supports --download-sections for time-based downloads
        // Format: "*start_time-end_time" where times are in seconds
        let section_arg = format!("*{:.0}-{:.0}", start_time, end_time);

        // Run yt-dlp to download the segment
        let mut cmd = tokio::process::Command::new(&ytdlp_path);
        no_window(&mut cmd);
        // yt-dlp --ffmpeg-location expects a DIRECTORY so it can find both ffmpeg and ffprobe
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
            .arg("--force-keyframes-at-cuts")  // Ensure clean cuts
            .arg("--no-part")  // Don't use .part files
            .arg("--newline")  // Output progress on new lines
            .arg("--progress")  // Show progress
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        println!("[YouTube] Running yt-dlp command with section: {}", section_arg);

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
                        println!("[YouTube] yt-dlp: {}", line);
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
                        if let Some(current_time) = crate::ffmpeg_utils::parse_ffmpeg_time(time_str) {
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
                        println!("[YouTube] yt-dlp stderr: {}", line);
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
                println!("[YouTube] Segment download cancelled, terminating yt-dlp...");
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

        println!("[YouTube] yt-dlp segment download completed successfully");

        // Verify the file exists
        if !video_path.exists() {
            return Err("Download completed but file not found".to_string());
        }

        // Get file metadata
        let metadata = std::fs::metadata(&video_path)
            .map_err(|e| format!("Failed to get file metadata: {}", e))?;
        let file_size = metadata.len();

        // Generate thumbnail
        println!("[YouTube] Generating thumbnail for segment...");
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
                println!("[YouTube] Thumbnail generated: {}", thumbnail_path.display());
                Some(thumbnail_path.to_string_lossy().to_string())
            }
            _ => {
                println!("[YouTube] Thumbnail generation failed");
                None
            }
        };

        // Get video info with timeout to prevent hanging
        println!("[YouTube] Getting segment video info...");
        let video_info = tokio::time::timeout(
            std::time::Duration::from_secs(30),
            crate::ffmpeg_utils::get_video_info(&app_clone, &video_path)
        ).await;
        
        let (width, height, codec, actual_duration) = match video_info {
            Ok(Ok(info)) => {
                println!("[YouTube] Segment video info - width: {}, height: {}, codec: {}, duration: {:?}", 
                    info.width, info.height, info.codec, info.duration);
                (Some(info.width), Some(info.height), Some(info.codec.clone()), info.duration)
            }
            Ok(Err(e)) => {
                println!("[YouTube] Failed to get segment video info: {}", e);
                (None, None, None, None)
            }
            Err(_) => {
                println!("[YouTube] Segment video info timed out after 30 seconds");
                (None, None, None, None)
            }
        };

        // Use actual duration from file if available
        let final_duration = actual_duration.unwrap_or(segment_duration);

        println!("[YouTube] Segment download task completed successfully");
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

    println!("[YouTube] Async segment download task completed");

    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.remove(&download_id);
    }

    cleanup_download();

    println!("[YouTube] Processing segment download result...");
    match result {
        Ok(Ok(download_result)) => {
            println!("[YouTube] Segment download successful!");

            let _ = app.emit(
                "download-progress",
                DownloadProgress {
                    download_id: download_id.clone(),
                    progress: 100.0,
                    current_time: None,
                    total_time: None,
                    status: "Segment download completed!".to_string(),
                },
            );

            let _ = app.emit("download-complete", download_result);

            Ok(())
        }
        Ok(Err(e)) => {
            let error_msg = format!("Segment download failed: {}", e);
            println!("[YouTube] Segment download failed: {}", error_msg);

            let _ = app.emit(
                "download-progress",
                DownloadProgress {
                    download_id: download_id.clone(),
                    progress: 0.0,
                    current_time: None,
                    total_time: None,
                    status: error_msg.clone(),
                },
            );

            let _ = app.emit(
                "download-complete",
                DownloadResult {
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
                },
            );

            Err(e)
        }
        Err(e) => {
            let error_msg = format!("Segment download task failed: {}", e);
            println!("[YouTube] Segment download task failed: {}", error_msg);

            let _ = app.emit(
                "download-progress",
                DownloadProgress {
                    download_id: download_id.clone(),
                    progress: 0.0,
                    current_time: None,
                    total_time: None,
                    status: error_msg.clone(),
                },
            );

            let _ = app.emit(
                "download-complete",
                DownloadResult {
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
                },
            );

            Err(error_msg)
        }
    }
}
