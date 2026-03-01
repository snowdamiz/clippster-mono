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
    mint_id: String,
    segment: u32,
    path: String,
    duration: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RumbleRecorderLogPayload {
    streamer_id: String,
    channel_name: String,
    mint_id: String,
    message: String,
    level: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RumbleStreamEndedPayload {
    streamer_id: String,
    session_id: String,
    channel_name: String,
    mint_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RumbleRecorderExitPayload {
    streamer_id: String,
    session_id: String,
    channel_name: String,
    mint_id: String,
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

            // Extract profile image from channel page using multiple fallback patterns
            let profile_image = extract_html_attr(&body, r#"class="listing-header--thumb"[^>]*src="([^"]+)""#)
                .or_else(|| extract_html_attr(&body, r#"<img[^>]+class="listing-header--thumb"[^>]+src="([^"]+)""#))
                // Try to find any img with "thumb" in class within listing-header
                .or_else(|| {
                    if let Some(header_section) = body.split("listing-header").nth(1) {
                        if let Some(img_section) = header_section.split("</header>").next() {
                            extract_html_attr(img_section, r#"class="[^"]*thumb[^"]*"[^>]*src="([^"]+)""#)
                                .or_else(|| extract_html_attr(img_section, r#"<img[^>]+src="([^"]+)""#))
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                // Profile images in URL
                .or_else(|| extract_html_attr(&body, r#"src="(https://[^"]*rumble\.com[^"]*profile[^"]*\.(jpg|png|webp)[^"]*)""#))
                .or_else(|| extract_html_attr(&body, r#"src="(https://[^"]*\.rumble\.com[^"]*\.(jpg|png|webp)[^"]*)""#))
                // OpenGraph and meta tags
                .or_else(|| extract_html_attr(&body, r#"<meta\s+property="og:image"\s+content="([^"]+)""#))
                .or_else(|| extract_html_attr(&body, r#"<meta[^>]+property="og:image"[^>]+content="([^"]+)""#))
                .or_else(|| extract_html_attr(&body, r#"<link[^>]+rel="image_src"[^>]+href="([^"]+)""#))
                // Rumble CDN images
                .or_else(|| extract_html_attr(&body, r#"src="(https://sp\.rmbl\.ws/[^"]+)""#));
            
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
        
        // yt-dlp --ffmpeg-location expects a DIRECTORY so it can find both ffmpeg and ffprobe
        let ffmpeg_dir = std::path::Path::new(&ffmpeg_path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ffmpeg_path.to_string_lossy().to_string());
        
        cmd.arg(&vod_url)
            .arg("-o").arg(&output_file_str)
            .arg("--ffmpeg-location").arg(&ffmpeg_dir)
            .arg("--external-downloader").arg("ffmpeg")
            .arg("--external-downloader-args").arg("ffmpeg:-progress pipe:2 -nostats")
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
                                println!("[Rumble] yt-dlp: {}", line);
                                
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
                            println!("[Rumble] yt-dlp stderr: {}", line);
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
                        
                        // Generate thumbnail
                        println!("[Rumble] Generating thumbnail...");
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
                                println!("[Rumble] Thumbnail generated: {}", thumbnail_path.display());
                                Some(thumbnail_path.to_string_lossy().to_string())
                            }
                            _ => {
                                println!("[Rumble] Thumbnail generation failed");
                                None
                            }
                        };
                        
                        // Get video info
                        println!("[Rumble] Getting video info...");
                        let video_info = crate::ffmpeg_utils::get_video_info(&app_clone, &std::path::Path::new(&output_file_str)).await.ok();
                        let (width, height, codec, duration) = if let Some(ref info) = video_info {
                            println!("[Rumble] Video info - width: {}, height: {}, codec: {}, duration: {:?}", 
                                info.width, info.height, info.codec, info.duration);
                            (Some(info.width), Some(info.height), Some(info.codec.clone()), info.duration)
                        } else {
                            println!("[Rumble] Could not get video info");
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
    let channel_url = channel_to_url(&channel_name);
    println!("[RumbleRecorder] Resolving live stream URL via HTML scrape: {}", channel_url);

    let stream_url = resolve_rumble_live_stream_url(&channel_name).await
        .unwrap_or_else(|| {
            println!("[RumbleRecorder] Could not find live stream URL, falling back to channel URL");
            channel_url.clone()
        });

    println!("[RumbleRecorder] Streaming from: {}", stream_url);

    // Use yt-dlp to extract the actual playback URL (same approach as Kick/Twitch)
    println!("[RumbleRecorder] Extracting playback URL via yt-dlp...");
    let mut ytdlp_cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut ytdlp_cmd);
    
    ytdlp_cmd
        .arg(&stream_url)
        .arg("--get-url")
        .arg("--no-warnings")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    
    let ytdlp_output = ytdlp_cmd.output().await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;
    
    let playback_url = String::from_utf8_lossy(&ytdlp_output.stdout).trim().to_string();
    
    if playback_url.is_empty() {
        let stderr = String::from_utf8_lossy(&ytdlp_output.stderr);
        println!("[RumbleRecorder] yt-dlp failed to extract playback URL. stderr: {}", stderr);
        
        // Emit error log to frontend
        let _ = app.emit("recorder-log", RumbleRecorderLogPayload {
            streamer_id: streamer_id.clone(),
            channel_name: channel_name.clone(),
            mint_id: channel_name.clone(),
            message: format!("yt-dlp failed to extract playback URL: {}", stderr),
            level: "error".to_string(),
        });
        
        return Err(format!("Failed to extract playback URL from Rumble stream. yt-dlp stderr: {}", stderr));
    }
    
    println!("[RumbleRecorder] Playback URL: {}", playback_url);
    
    // Emit success log to frontend
    let _ = app.emit("recorder-log", RumbleRecorderLogPayload {
        streamer_id: streamer_id.clone(),
        channel_name: channel_name.clone(),
        mint_id: channel_name.clone(),
        message: format!("Successfully extracted playback URL from Rumble stream"),
        level: "info".to_string(),
    });
    
    // Now use FFmpeg to record directly from the playback URL
    let mut ffmpeg_cmd = tokio::process::Command::new(&ffmpeg_path);
    no_window(&mut ffmpeg_cmd);
    
    ffmpeg_cmd
        .arg("-i").arg(&playback_url)
        .arg("-c:v").arg("copy")
        .arg("-c:a").arg("copy")
        .arg("-f").arg("hls")
        .arg("-hls_time").arg(hls_segment_seconds.to_string())
        .arg("-hls_list_size").arg("0")
        .arg("-hls_flags").arg("append_list+omit_endlist+temp_file")
        .arg("-hls_segment_filename").arg(segment_pattern.to_string_lossy().to_string())
        .arg(playlist_path.to_string_lossy().to_string())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped());
    
    let mut ffmpeg_child = ffmpeg_cmd.spawn()
        .map_err(|e| format!("Failed to spawn FFmpeg: {}", e))?;
    
    // Emit log that FFmpeg started successfully
    let _ = app.emit("recorder-log", RumbleRecorderLogPayload {
        streamer_id: streamer_id.clone(),
        channel_name: channel_name.clone(),
        mint_id: channel_name.clone(),
        message: format!("FFmpeg recorder started for Rumble stream ({}s segments)", hls_segment_seconds),
        level: "info".to_string(),
    });
    
    // Forward FFmpeg stderr to frontend via recorder-log events
    if let Some(ffmpeg_stderr) = ffmpeg_child.stderr.take() {
        let app_log = app.clone();
        let streamer_log = streamer_id.clone();
        let channel_log = channel_name.clone();
        
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(ffmpeg_stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                // Only log important FFmpeg lines to avoid flooding
                let is_noise = line.contains("Opening") || line.contains("Skip");
                if !is_noise {
                    println!("[RumbleRecorder] FFmpeg: {}", line);
                    
                    // Determine log level based on content
                    let level = if line.contains("error") || line.contains("Error") || line.contains("ERROR") {
                        "error"
                    } else if line.contains("warning") || line.contains("Warning") || line.contains("WARN") {
                        "warn"
                    } else {
                        "info"
                    };
                    
                    let _ = app_log.emit("recorder-log", RumbleRecorderLogPayload {
                        streamer_id: streamer_log.clone(),
                        channel_name: channel_log.clone(),
                        mint_id: channel_log.clone(),
                        message: line,
                        level: level.to_string(),
                    });
                }
            }
        });
    }
    
    let mut last_emitted_segment: u32 = 0;
    
    loop {
        tokio::select! {
            status = ffmpeg_child.wait() => {
                println!("[RumbleRecorder] FFmpeg exited: {:?}", status);
                
                let exit_status = status.ok();
                let exit_code = exit_status.as_ref().and_then(|s| s.code());
                
                // Emit log about FFmpeg exit
                let exit_message = if let Some(code) = exit_code {
                    if code == 0 {
                        format!("FFmpeg recorder stopped normally (exit code: {})", code)
                    } else {
                        format!("FFmpeg recorder exited with error code: {}", code)
                    }
                } else {
                    "FFmpeg recorder terminated".to_string()
                };
                
                let _ = app.emit("recorder-log", RumbleRecorderLogPayload {
                    streamer_id: streamer_id.clone(),
                    channel_name: channel_name.clone(),
                    mint_id: channel_name.clone(),
                    message: exit_message,
                    level: if exit_code == Some(0) { "info" } else { "error" }.to_string(),
                });
                
                let _ = app.emit("recorder-exit", RumbleRecorderExitPayload {
                    streamer_id: streamer_id.clone(),
                    session_id: session_id.clone(),
                    channel_name: channel_name.clone(),
                    mint_id: channel_name.clone(),
                    code: exit_code,
                });
                
                // If FFmpeg exited unsuccessfully, stream likely ended
                if let Some(exit_status) = exit_status {
                    if !exit_status.success() {
                        let _ = app.emit("stream-ended", RumbleStreamEndedPayload {
                            streamer_id: streamer_id.clone(),
                            session_id: session_id.clone(),
                            channel_name: channel_name.clone(),
                            mint_id: channel_name.clone(),
                        });
                    }
                }
                
                break;
            }
            
            _ = &mut stop_rx => {
                println!("[RumbleRecorder] Stop signal received");
                let _ = ffmpeg_child.kill().await;
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
                            println!("[RumbleRecorder] Segment {} ready (size: {} bytes)", next_segment_index, s1);
                            
                            let segment_number = next_segment_index + 1;
                            
                            let _ = app.emit("segment-ready", RumbleSegmentReadyPayload {
                                streamer_id: streamer_id.clone(),
                                session_id: session_id.clone(),
                                channel_name: channel_name.clone(),
                                mint_id: channel_name.clone(),
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

/// Get Rumble channel information including profile image
/// This fetches channel metadata regardless of live status
#[tauri::command]
pub async fn get_rumble_channel_info(channel: String) -> Result<String, String> {
    let channel_name = normalize_channel_name(&channel);
    let channel_url = channel_to_url(&channel_name);
    
    println!("[Rumble] Fetching channel info for: {}", channel_url);

    let response = RUMBLE_HTTP_CLIENT
        .get(&channel_url)
        .header("Accept", "text/html,application/xhtml+xml")
        .send()
        .await;

    match response {
        Ok(resp) if resp.status().is_success() => {
            let body = resp.text().await
                .map_err(|e| format!("Failed to read Rumble response: {}", e))?;

            // Extract profile image using multiple fallback patterns
            // Pattern 1: listing-header--thumb class (most common)
            let profile_image_url = extract_html_attr(&body, r#"class="listing-header--thumb"[^>]*src="([^"]+)""#)
                .or_else(|| extract_html_attr(&body, r#"<img[^>]+class="listing-header--thumb"[^>]+src="([^"]+)""#))
                // Pattern 2: Any img with "thumb" in class within listing-header
                .or_else(|| {
                    if let Some(header_section) = body.split("listing-header").nth(1) {
                        if let Some(img_section) = header_section.split("</header>").next() {
                            extract_html_attr(img_section, r#"class="[^"]*thumb[^"]*"[^>]*src="([^"]+)""#)
                                .or_else(|| extract_html_attr(img_section, r#"<img[^>]+src="([^"]+)""#))
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                // Pattern 3: Profile images in URL
                .or_else(|| extract_html_attr(&body, r#"src="(https://[^"]*rumble\.com[^"]*profile[^"]*\.(jpg|png|webp)[^"]*)""#))
                .or_else(|| extract_html_attr(&body, r#"src="(https://[^"]*\.rumble\.com[^"]*\.(jpg|png|webp)[^"]*)""#))
                // Pattern 4: OpenGraph and meta tags
                .or_else(|| extract_html_attr(&body, r#"<meta\s+property="og:image"\s+content="([^"]+)""#))
                .or_else(|| extract_html_attr(&body, r#"<meta[^>]+property="og:image"[^>]+content="([^"]+)""#))
                .or_else(|| extract_html_attr(&body, r#"<link[^>]+rel="image_src"[^>]+href="([^"]+)""#))
                // Pattern 5: Look for any rumble CDN image
                .or_else(|| extract_html_attr(&body, r#"src="(https://sp\.rmbl\.ws/[^"]+)""#));

            // Extract channel display name from page title or header
            let display_name = extract_html_text(&body, r#"<title>([^<]+)</title>"#)
                .map(|t| t.replace(" - Rumble", "").trim().to_string())
                .or_else(|| extract_html_text(&body, r#"<h1[^>]*class="[^"]*listing-header--title[^"]*"[^>]*>([^<]+)</h1>"#))
                .or_else(|| Some(channel_name.clone()));

            #[derive(Serialize)]
            #[serde(rename_all = "camelCase")]
            struct ChannelInfo {
                channel_name: String,
                display_name: Option<String>,
                profile_image_url: Option<String>,
            }

            let info = ChannelInfo {
                channel_name: channel_name.clone(),
                display_name,
                profile_image_url: profile_image_url.clone(),
            };

            println!("[Rumble] Channel info: profile_image={:?}, display_name={:?}", 
                info.profile_image_url, info.display_name);
            
            Ok(serde_json::to_string(&info).unwrap())
        }
        Ok(resp) => {
            println!("[Rumble] Channel page returned {} for {}", resp.status(), channel_name);
            Err(format!("Channel page returned status: {}", resp.status()))
        }
        Err(e) => {
            println!("[Rumble] HTTP request failed for {}: {}", channel_name, e);
            Err(format!("Failed to fetch channel info: {}", e))
        }
    }
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

fn format_time_for_filename(seconds: f64) -> String {
    let h = (seconds / 3600.0) as u32;
    let m = ((seconds % 3600.0) / 60.0) as u32;
    let s = (seconds % 60.0) as u32;
    format!("{:02}{:02}{:02}", h, m, s)
}

/// Download a segment of a Rumble VOD using yt-dlp with time range
#[tauri::command]
pub async fn download_rumble_vod_segment(
    app: tauri::AppHandle,
    download_id: String,
    title: String,
    vod_url: String,
    channel_name: String,
    start_time: f64,
    end_time: f64,
) -> Result<(), String> {
    println!("[Rumble] download_rumble_vod_segment called with:");
    println!("[Rumble]   download_id: {}", download_id);
    println!("[Rumble]   title: {}", title);
    println!("[Rumble]   vod_url: {}", vod_url);
    println!("[Rumble]   channel_name: {}", channel_name);
    println!("[Rumble]   start_time: {}", start_time);
    println!("[Rumble]   end_time: {}", end_time);

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
            println!("[Rumble] Download already in progress: {}", download_id);
            return Err("Download already in progress".to_string());
        }
        downloads.insert(download_id.clone(), true);
        println!("[Rumble] Download registered: {}", download_id);
    }

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

    // Get storage paths
    println!("[Rumble] Getting storage paths...");
    let paths = storage::init_storage_dirs().map_err(|e| {
        println!("[Rumble] Failed to get storage paths: {}", e);
        format!("Failed to get storage paths: {}", e)
    })?;

    println!(
        "[Rumble] Storage paths retrieved. Videos dir: {}",
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
        "rumble_{}_{}_{}_{}_{}.mp4",
        channel_name, safe_title, start_formatted, end_formatted, timestamp
    );
    let video_path = paths.videos.join(&filename);

    println!("[Rumble] Generated filename: {}", filename);
    println!("[Rumble] Full video path: {}", video_path.display());

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
            status: "Starting Rumble segment download...".to_string(),
        },
    );

    if let Err(e) = progress_result {
        println!("[Rumble] Failed to emit initial progress: {}", e);
    }

    // Clone for async block
    let app_clone = app.clone();
    let download_id_clone = download_id.clone();
    println!("[Rumble] Starting async segment download task...");

    let (cancel_tx, mut cancel_rx) = oneshot::channel();
    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.insert(download_id.clone(), cancel_tx);
    }

    let result = tokio::spawn(async move {
        println!("[Rumble] Async task started for segment download: {}", download_id_clone);

        let ytdlp_path = resolve_ytdlp_binary()?;
        let ffmpeg_path = resolve_ffmpeg_binary()?;
        let video_path_str = video_path.to_string_lossy().to_string();

        println!("[Rumble] Using yt-dlp: {}", ytdlp_path.display());
        println!("[Rumble] Using ffmpeg: {}", ffmpeg_path.display());

        // yt-dlp supports --download-sections for time-based downloads
        let section_arg = format!("*{:.0}-{:.0}", start_time, end_time);

        // Run yt-dlp to download the segment
        let mut cmd = tokio::process::Command::new(&ytdlp_path);
        no_window(&mut cmd);
        let ffmpeg_dir = std::path::Path::new(&ffmpeg_path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ffmpeg_path.to_string_lossy().to_string());
        cmd.arg(&vod_url)
            .arg("-o").arg(&video_path_str)
            .arg("--ffmpeg-location").arg(&ffmpeg_dir)
            .arg("--external-downloader").arg("ffmpeg")
            .arg("--external-downloader-args").arg("ffmpeg:-progress pipe:2 -nostats")
            .arg("--download-sections").arg(&section_arg)
            .arg("--force-keyframes-at-cuts")
            .arg("--no-part")
            .arg("--newline")
            .arg("--progress")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        println!("[Rumble] Running yt-dlp command with section: {}", section_arg);

        let mut child = cmd.spawn()
            .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

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
                    if line.contains("% of") || line.contains("100% of") {
                        if let Some(pct_str) = line.split('%').next() {
                            let pct_str = pct_str.trim_start_matches(|c: char| !c.is_ascii_digit() && c != '.');
                            if let Ok(pct) = pct_str.trim().parse::<f64>() {
                                if last_progress_time.elapsed().as_millis() >= 500 {
                                    let current_time = (pct / 100.0) * segment_dur;
                                    let _ = app_for_progress.emit("download-progress", DownloadProgress {
                                        download_id: download_id_for_progress.clone(),
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
                        println!("[Rumble] yt-dlp: {}", line);
                    }
                }
            }));

        let stderr_task = if let Some(stderr) = stderr {
            Some(tokio::spawn(async move {
                use tokio::io::{AsyncBufReadExt, BufReader};
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    if !line.is_empty() {
                        println!("[Rumble] yt-dlp stderr: {}", line);
                    }
                }
            }))
        } else {
            None
        };

        let mut stdout_task = stdout_task;
        let mut stderr_task = stderr_task;

        let status = tokio::select! {
            result = child.wait() => result
                .map_err(|e| format!("Failed to wait for yt-dlp: {}", e))?,
            _ = &mut cancel_rx => {
                println!("[Rumble] Segment download cancelled");
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

        if let Some(task) = stderr_task {
            let _ = task.await;
        }
        if let Some(task) = stdout_task {
            let _ = task.await;
        }

        if !status.success() {
            return Err(format!("yt-dlp failed with exit code: {:?}", status.code()));
        }

        println!("[Rumble] yt-dlp segment download completed successfully");

        if !video_path.exists() {
            return Err("Download completed but file not found".to_string());
        }

        let metadata = std::fs::metadata(&video_path)
            .map_err(|e| format!("Failed to get file metadata: {}", e))?;
        let file_size = metadata.len();

        println!("[Rumble] Generating thumbnail for segment...");
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
                println!("[Rumble] Thumbnail generated: {}", thumbnail_path.display());
                Some(thumbnail_path.to_string_lossy().to_string())
            }
            _ => {
                println!("[Rumble] Thumbnail generation failed");
                None
            }
        };

        println!("[Rumble] Getting segment video info...");
        let video_info = tokio::time::timeout(
            std::time::Duration::from_secs(30),
            crate::ffmpeg_utils::get_video_info(&app_clone, &video_path)
        ).await;
        
        let (width, height, codec, actual_duration) = match video_info {
            Ok(Ok(info)) => {
                println!("[Rumble] Segment video info - width: {}, height: {}, codec: {}, duration: {:?}", 
                    info.width, info.height, info.codec, info.duration);
                (Some(info.width), Some(info.height), Some(info.codec.clone()), info.duration)
            }
            Ok(Err(e)) => {
                println!("[Rumble] Failed to get segment video info: {}", e);
                (None, None, None, None)
            }
            Err(_) => {
                println!("[Rumble] Segment video info timed out");
                (None, None, None, None)
            }
        };

        let final_duration = actual_duration.unwrap_or(segment_duration);

        println!("[Rumble] Segment download task completed successfully");
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

    println!("[Rumble] Async segment download task completed");

    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.remove(&download_id);
    }

    cleanup_download();

    println!("[Rumble] Processing segment download result...");
    match result {
        Ok(Ok(download_result)) => {
            println!("[Rumble] Segment download successful!");

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
            println!("[Rumble] {}", error_msg);

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
            Err(e)
        }
        Err(e) => {
            let error_msg = format!("Segment download task failed: {}", e);
            println!("[Rumble] {}", error_msg);

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
