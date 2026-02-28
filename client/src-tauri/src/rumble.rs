use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
};

use once_cell::sync::Lazy;
use regex::Regex;
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

/// HTTP client for scraping Rumble channel pages.
/// Rumble does not have a public API, so we scrape the channel HTML
/// and look for the `videostream__status--live` CSS class (same approach as the Kodi Rumble plugin).
static RUMBLE_HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .expect("Failed to build Rumble HTTP client")
});

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
    pub profile_image_url: Option<String>,
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
    pub is_live: bool,
}

/// Check if a Rumble channel is live by scraping the channel page HTML.
/// 
/// This approach is modelled after Kick's API-based check but uses HTML scraping
/// since Rumble has no public API. We look for the `videostream__status--live`
/// CSS class in the channel page, which is the same technique used by the
/// Kodi Rumble plugin (azzy9/plugin.video.rumble).
/// 
/// # Arguments
/// * `channel` - Rumble channel name or URL
#[tauri::command]
pub async fn check_rumble_livestream(channel: String) -> Result<String, String> {
    let channel_name = normalize_channel_name(&channel);
    let channel_url = channel_to_url(&channel_name);
    println!("[Rumble] Checking livestream status for {} via HTML scrape: {}", channel_name, channel_url);

    let response = RUMBLE_HTTP_CLIENT
        .get(&channel_url)
        .header("Accept", "text/html,application/xhtml+xml")
        .send()
        .await;

    match response {
        Ok(resp) if resp.status().is_success() => {
            let body = resp.text().await
                .map_err(|e| format!("Failed to read Rumble response: {}", e))?;

            // Extract profile image from channel page
            // Look for profile image in various possible locations
            let profile_image = extract_html_attr(&body, r#"class="listing-header--thumb"[^>]*src="([^"]+)""#)
                .or_else(|| extract_html_attr(&body, r#"<img[^>]+class="listing-header--thumb"[^>]+src="([^"]+)""#))
                .or_else(|| extract_html_attr(&body, r#"<img[^>]+src="(https://[^"]*rumble\.com[^"]*profile[^"]*\.(jpg|png|webp)[^"]*)""#))
                .or_else(|| extract_html_attr(&body, r#"<meta\s+property="og:image"\s+content="([^"]+)""#))
                .or_else(|| {
                    // Try to find any image in the listing-header section
                    if let Some(header_section) = body.split("listing-header").nth(1) {
                        if let Some(img_section) = header_section.split("</header>").next() {
                            extract_html_attr(img_section, r#"<img[^>]+src="([^"]+)""#)
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                });
            
            if let Some(ref img_url) = profile_image {
                println!("[Rumble] Found profile image: {}", img_url);
            } else {
                println!("[Rumble] No profile image found for channel {}", channel_name);
            }

            // Split the HTML into individual video stream blocks.
            // Each video on the channel page is wrapped in a div with class "videostream".
            // The Kodi plugin splits on '"videostream thumbnail__grid-' or '"videostream videostream__list-item'.
            let blocks: Vec<&str> = body.split("videostream thumbnail__grid-").collect();

            // Check each block for the live indicator class
            for block in blocks.iter().skip(1) {
                if block.contains("videostream__status--live") {
                    // Found a live stream! Extract metadata from this block.
                    let title = extract_html_text(block, r#"<h3[^>]*>(.*?)</h3>"#);
                    let thumbnail = extract_html_attr(block, r#"<img\s*class="thumbnail__image\s*"\s*draggable="false"\s*src="([^"]+)""#);
                    let link = extract_html_attr(block, r#"<a\s*class="videostream__link\s+link"\s*draggable="false"\s*href="([^"]+)""#);
                    let watching = extract_html_text(block, r#"<span class="video-item--watching">([^<]+)</span>"#);

                    // Parse viewer count from "X watching" text
                    let viewer_count = watching.as_ref().and_then(|w| {
                        w.replace(',', "").split_whitespace().next()
                            .and_then(|n| n.parse::<i64>().ok())
                    });

                    let stream_title = title.map(|t| clean_html_text(&t));

                    println!("[Rumble] Channel {} is LIVE: {:?} ({:?} viewers)", 
                        channel_name, stream_title, viewer_count);

                    let status = RumbleLiveStatus {
                        is_live: true,
                        channel_name: Some(channel_name),
                        stream_title,
                        viewer_count,
                        thumbnail_url: thumbnail,
                        started_at: link.map(|l| format!("https://rumble.com{}", l)),
                        profile_image_url: profile_image,
                    };
                    return Ok(serde_json::to_string(&status).unwrap());
                }
            }

            // No live stream block found
            println!("[Rumble] Channel {} is not live", channel_name);
            let status = RumbleLiveStatus {
                is_live: false,
                channel_name: Some(channel_name),
                stream_title: None,
                viewer_count: None,
                thumbnail_url: None,
                started_at: None,
                profile_image_url: profile_image,
            };
            Ok(serde_json::to_string(&status).unwrap())
        }
        Ok(resp) => {
            println!("[Rumble] Channel page returned {} for {}", resp.status(), channel_name);
            let status = RumbleLiveStatus {
                is_live: false,
                channel_name: Some(channel_name),
                stream_title: None,
                viewer_count: None,
                thumbnail_url: None,
                started_at: None,
                profile_image_url: None,
            };
            Ok(serde_json::to_string(&status).unwrap())
        }
        Err(e) => {
            println!("[Rumble] HTTP request failed for {}: {}", channel_name, e);
            let status = RumbleLiveStatus {
                is_live: false,
                channel_name: Some(channel_name),
                stream_title: None,
                viewer_count: None,
                thumbnail_url: None,
                started_at: None,
                profile_image_url: None,
            };
            Ok(serde_json::to_string(&status).unwrap())
        }
    }
}

/// Extract text content from an HTML element using a regex pattern.
/// The first capture group is returned as the match.
fn extract_html_text(html: &str, pattern: &str) -> Option<String> {
    Regex::new(pattern).ok()
        .and_then(|re| re.captures(html))
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().to_string())
}

/// Extract an attribute value from an HTML element using a regex pattern.
/// The first capture group is returned as the match.
fn extract_html_attr(html: &str, pattern: &str) -> Option<String> {
    Regex::new(pattern).ok()
        .and_then(|re| re.captures(html))
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().to_string())
}

/// Strip HTML tags and decode basic HTML entities from text.
fn clean_html_text(text: &str) -> String {
    // Remove HTML tags
    let tag_re = Regex::new(r"<[^>]+>").unwrap();
    let cleaned = tag_re.replace_all(text, "");
    // Decode common HTML entities
    cleaned
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .trim()
        .to_string()
}

/// Get list of VODs from a Rumble channel using yt-dlp
#[tauri::command]
pub async fn get_rumble_vods(channel: String, limit: Option<u32>) -> Result<String, String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    
    let limit_str = limit.unwrap_or(10).to_string();
    
    // If input is a full URL (contains /livestreams or /videos), use it directly
    // Otherwise, normalize and construct a channel URL
    let channel_url = if channel.contains("rumble.com/") {
        // Use the URL as-is to preserve /livestreams or /videos paths
        channel.trim().to_string()
    } else {
        let channel_name = normalize_channel_name(&channel);
        channel_to_url(&channel_name)
    };
    
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

    println!("[Rumble VODs] Processing yt-dlp output...");
    for (index, line) in stdout.lines().enumerate() {
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

        // Check if this is a live stream
        // yt-dlp sets is_live to true for ongoing live streams
        let is_live = json["is_live"].as_bool().unwrap_or(false);
        let was_live = json["was_live"].as_bool().unwrap_or(false);
        
        // Skip currently live streams - they can't be downloaded as VODs yet
        if is_live {
            if index < 3 {
                println!("[Rumble VODs] Skipping currently live stream: {:?}", json["title"].as_str());
            }
            continue;
        }
        
        let title = json["title"].as_str().map(String::from);
        
        // Log first few entries for debugging
        if index < 3 {
            println!("[Rumble VODs] Entry {}: title={:?}, is_live={}, was_live={}, url={}", 
                index, title, is_live, was_live, url);
        }

        let vod = RumbleVod {
            video_id,
            title,
            duration: json["duration"].as_f64(),
            view_count: json["view_count"].as_i64(),
            thumbnail_url: json["thumbnail"].as_str().map(String::from),
            upload_date: json["upload_date"].as_str().map(String::from),
            url,
            is_live: was_live, // Only mark as live if it was a past livestream (not currently live)
        };
        vods.push(vod);
    }
    
    println!("[Rumble VODs] Total VODs fetched: {}", vods.len());

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
    
    // Resolve the live video URL by scraping the channel page HTML.
    // yt-dlp hangs on Rumble channel pages, so we use direct HTTP scraping
    // to find the live stream's video page URL, then pass that to yt-dlp.
    let channel_url = channel_to_url(&channel_name);
    println!("[RumbleRecorder] Resolving live stream URL via HTML scrape: {}", channel_url);

    let stream_url = resolve_rumble_live_stream_url(&channel_name).await
        .unwrap_or_else(|| {
            println!("[RumbleRecorder] Could not find live stream URL, falling back to channel URL");
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

/// Scrape the Rumble channel page to find the live stream's video page URL.
/// Returns `Some("https://rumble.com/v1abc-title.html")` if a live stream is found.
/// This is used by the recorder to get a specific video URL that yt-dlp can handle
/// (yt-dlp works fine on individual Rumble video pages but hangs on channel pages).
async fn resolve_rumble_live_stream_url(channel_name: &str) -> Option<String> {
    let channel_url = channel_to_url(channel_name);

    let response = RUMBLE_HTTP_CLIENT
        .get(&channel_url)
        .header("Accept", "text/html,application/xhtml+xml")
        .send()
        .await
        .ok()?;

    if !response.status().is_success() {
        println!("[RumbleRecorder] Channel page returned {}", response.status());
        return None;
    }

    let body = response.text().await.ok()?;

    // Split into video stream blocks and find the live one
    let blocks: Vec<&str> = body.split("videostream thumbnail__grid-").collect();
    for block in blocks.iter().skip(1) {
        if block.contains("videostream__status--live") {
            // Extract the video page link from this live block
            if let Some(link) = extract_html_attr(block, r#"<a\s*class="videostream__link\s+link"\s*draggable="false"\s*href="([^"]+)""#) {
                let full_url = format!("https://rumble.com{}", link);
                println!("[RumbleRecorder] Found live stream URL: {}", full_url);
                return Some(full_url);
            }
        }
    }

    println!("[RumbleRecorder] No live stream found on channel page");
    None
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
