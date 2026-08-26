use std::path::PathBuf;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::oneshot;
use tauri::Emitter;
use once_cell::sync::Lazy;
use std::sync::Mutex;

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

static ACTIVE_AUDIO_DOWNLOADS: Lazy<Mutex<std::collections::HashMap<String, bool>>> = 
    Lazy::new(|| Mutex::new(std::collections::HashMap::new()));
static ACTIVE_AUDIO_DOWNLOAD_CANCELLERS: Lazy<Mutex<std::collections::HashMap<String, oneshot::Sender<()>>>> = 
    Lazy::new(|| Mutex::new(std::collections::HashMap::new()));

#[derive(Clone, serde::Serialize)]
pub struct DownloadProgress {
    pub download_id: String,
    pub progress: f64,
    pub current_time: Option<f64>,
    pub total_time: Option<f64>,
    pub status: String,
}

#[derive(Clone, serde::Serialize)]
pub struct DownloadResult {
    pub download_id: String,
    pub success: bool,
    pub file_path: Option<String>,
    pub title: Option<String>,
    pub platform: Option<String>,
    pub source_url: Option<String>,
    pub duration: Option<f64>,
    pub file_size: Option<u64>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
    pub thumbnail_url: Option<String>,
    pub error: Option<String>,
}

/// Get the downloaded audio directory
pub fn get_downloaded_audio_dir() -> Result<PathBuf, String> {
    let base_dir = crate::storage::get_storage_base_dir()?;
    let audio_dir = base_dir.join("downloaded_audio");
    std::fs::create_dir_all(&audio_dir)
        .map_err(|e| format!("Failed to create downloaded audio directory: {}", e))?;
    Ok(audio_dir)
}

/// Resolve yt-dlp binary path
fn resolve_ytdlp_binary() -> Result<String, String> {
    crate::youtube::resolve_ytdlp_binary()
}

/// Resolve ffmpeg binary path
fn resolve_ffmpeg_binary() -> Result<String, String> {
    crate::youtube::resolve_ffmpeg_binary()
}

/// Download audio from YouTube URL
#[tauri::command]
pub async fn download_youtube_audio(
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
        let mut downloads = ACTIVE_AUDIO_DOWNLOADS.lock().unwrap();
        if downloads.contains_key(&download_id) {
            println!("[AudioDownload] Download already in progress: {}", download_id);
            return Err("Download already in progress".to_string());
        }
        downloads.insert(download_id.clone(), true);
    }

    // Get output directory
    let audio_dir = get_downloaded_audio_dir()?;

    let safe_title = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();
    let safe_channel = channel_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    let filename = format!("youtube_{}_{}_{}.mp3", safe_channel, safe_title, timestamp);
    let output_file = audio_dir.join(&filename);
    
    // Clean up when done
    let cleanup_download = {
        let download_id = download_id.clone();
        move || {
            println!("[AudioDownload] Cleaning up download: {}", download_id);
            let mut downloads = ACTIVE_AUDIO_DOWNLOADS.lock().unwrap();
            downloads.remove(&download_id);
        }
    };
    
    let (cancel_tx, mut cancel_rx) = oneshot::channel::<()>();
    {
        let mut cancellers = ACTIVE_AUDIO_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.insert(download_id.clone(), cancel_tx);
    }
    
    let download_id_clone = download_id.clone();
    let app_clone = app.clone();
    let output_file_str = output_file.to_string_lossy().to_string();
    let title_clone = title.clone();
    let vod_url_clone = vod_url.clone();
    let ytdlp_path_clone = ytdlp_path.clone();
    let ffmpeg_path_clone = ffmpeg_path.clone();
    let _ = channel_name; // retained for Tauri command signature / caller channel label

    // Send initial progress
    let _ = app.emit("download-progress", DownloadProgress {
        download_id: download_id.clone(),
        progress: 0.0,
        current_time: None,
        total_time: None,
        status: "Starting audio download...".to_string(),
    });
    
    tokio::spawn(async move {
        let mut cmd = tokio::process::Command::new(&ytdlp_path);
        no_window(&mut cmd);
        
        let ffmpeg_dir = std::path::Path::new(&ffmpeg_path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ffmpeg_path.clone());

        let media_url = crate::youtube::normalize_youtube_media_url(&vod_url);
        let media_url_for_thumb = media_url.clone();
        cmd.arg(&media_url)
            .arg("-o").arg(&output_file_str)
            .arg("--ffmpeg-location").arg(&ffmpeg_dir)
            .arg("-x") // Extract audio
            .arg("--audio-format").arg("mp3")
            .arg("--audio-quality").arg("0") // Best quality
            .arg("--concurrent-fragments").arg("4")
            .arg("--no-part")
            .arg("--newline")
            .arg("--progress")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        crate::youtube::apply_youtube_media_download_args(&mut cmd);
        
        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                cleanup_download();
                let _ = app_clone.emit("download-complete", DownloadResult {
                    download_id: download_id_clone.clone(),
                    success: false,
                    file_path: None,
                    title: None,
                    platform: None,
                    source_url: None,
                    duration: None,
                    file_size: None,
                    sample_rate: None,
                    channels: None,
                    thumbnail_url: None,
                    error: Some(format!("Failed to spawn yt-dlp: {}", e)),
                });
                return;
            }
        };
        
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();
        
        // Collect stderr in background for error reporting
        let stderr_lines = std::sync::Arc::new(tokio::sync::Mutex::new(Vec::<String>::new()));
        let stderr_lines_writer = stderr_lines.clone();
        let app_progress = app_clone.clone();
        let download_id_progress = download_id_clone.clone();
        let app_progress_stderr = app_progress.clone();
        let download_id_progress_stderr = download_id_progress.clone();

        let stderr_task = tokio::spawn(async move {
            let mut total_duration_seconds: Option<f64> = None;
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                println!("[AudioDownload] yt-dlp stderr: {}", line);
                
                // Parse ffmpeg duration line:
                // "Duration: 01:10:39.68, ..."
                if total_duration_seconds.is_none() && line.contains("Duration:") {
                    if let Some(duration_part) = line.split("Duration:").nth(1) {
                        let raw = duration_part.split(',').next().unwrap_or("").trim();
                        let parts: Vec<&str> = raw.split(':').collect();
                        if parts.len() == 3 {
                            let hours = parts[0].parse::<f64>().ok().unwrap_or(0.0);
                            let minutes = parts[1].parse::<f64>().ok().unwrap_or(0.0);
                            let seconds = parts[2].parse::<f64>().ok().unwrap_or(0.0);
                            let total = (hours * 3600.0) + (minutes * 60.0) + seconds;
                            if total > 0.0 {
                                total_duration_seconds = Some(total);
                            }
                        }
                    }
                }

                // Parse ffmpeg processing time updates:
                // "... time=00:00:12.34 ..."
                if line.contains("time=") {
                    if let Some(time_part) = line.split("time=").nth(1) {
                        let token = time_part.split_whitespace().next().unwrap_or("").trim();
                        let parts: Vec<&str> = token.split(':').collect();
                        if parts.len() == 3 {
                            let hours = parts[0].parse::<f64>().ok().unwrap_or(0.0);
                            let minutes = parts[1].parse::<f64>().ok().unwrap_or(0.0);
                            let seconds = parts[2].parse::<f64>().ok().unwrap_or(0.0);
                            let current = (hours * 3600.0) + (minutes * 60.0) + seconds;

                            let progress = if let Some(total) = total_duration_seconds {
                                if total > 0.0 {
                                    ((current / total) * 100.0).clamp(0.0, 99.9)
                                } else {
                                    0.0
                                }
                            } else {
                                0.0
                            };

                            let _ = app_progress_stderr.emit("download-progress", DownloadProgress {
                                download_id: download_id_progress_stderr.clone(),
                                progress,
                                current_time: Some(current),
                                total_time: total_duration_seconds,
                                status: "Downloading audio stream...".to_string(),
                            });
                        }
                    }
                }

                // Surface meaningful status even when no percent is available.
                if line.contains("[download] Destination:") {
                    let _ = app_progress_stderr.emit("download-progress", DownloadProgress {
                        download_id: download_id_progress_stderr.clone(),
                        progress: 1.0,
                        current_time: None,
                        total_time: total_duration_seconds,
                        status: "Download started...".to_string(),
                    });
                }

                stderr_lines_writer.lock().await.push(line);
            }
        });

        // Monitor stdout for progress
        let stdout_task = tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                println!("[AudioDownload] yt-dlp stdout: {}", line);
                if (line.contains("[download]") || line.contains("% of")) && line.contains("%") {
                    if let Some(percent_str) = line.split_whitespace()
                        .find(|s| s.ends_with('%'))
                        .and_then(|s| s.trim_end_matches('%').parse::<f64>().ok())
                    {
                        let _ = app_progress.emit("download-progress", DownloadProgress {
                            download_id: download_id_progress.clone(),
                            progress: percent_str,
                            current_time: None,
                            total_time: None,
                            status: "Downloading audio...".to_string(),
                        });
                    }
                }
            }
        });
        
        // Wait for completion or cancellation
        tokio::select! {
            status = child.wait() => {
                // Wait for I/O tasks to flush
                let _ = stdout_task.await;
                let _ = stderr_task.await;
                cleanup_download();
                
                match status {
                    Ok(exit_status) if exit_status.success() => {
                        // Extract metadata using ffprobe
                        let metadata = extract_audio_metadata(&output_file_str).await;
                        
                        let file_size = std::fs::metadata(&output_file_str)
                            .ok()
                            .map(|m| m.len());
                        
                        // Generate thumbnail using the same hybrid approach as video downloads
                        let thumbnail_path = std::path::Path::new(&output_file_str)
                            .with_extension("jpg");
                        let thumbnail_url = match generate_thumbnail_hybrid(
                            &ytdlp_path_clone,
                            &ffmpeg_path_clone,
                            &media_url_for_thumb,
                            &thumbnail_path,
                            "00:00:05",
                        ).await {
                            Ok(()) => {
                                println!(
                                    "[AudioDownload] Thumbnail generated: {}",
                                    thumbnail_path.display()
                                );
                                Some(thumbnail_path.to_string_lossy().to_string())
                            }
                            Err(e) => {
                                println!("[AudioDownload] Thumbnail generation failed: {}", e);
                                None
                            }
                        };
                        
                        let _ = app_clone.emit("download-complete", DownloadResult {
                            download_id: download_id_clone,
                            success: true,
                            file_path: Some(output_file_str),
                            title: Some(title_clone.clone()),
                            platform: Some("YouTube".to_string()),
                            source_url: Some(vod_url_clone.clone()),
                            duration: metadata.as_ref().and_then(|m| m.duration),
                            file_size,
                            sample_rate: metadata.as_ref().and_then(|m| m.sample_rate),
                            channels: metadata.as_ref().and_then(|m| m.channels),
                            thumbnail_url,
                            error: None,
                        });
                    }
                    _ => {
                        // Surface the actual yt-dlp error from stderr
                        let error_lines = stderr_lines.lock().await;
                        let error_msg = error_lines
                            .iter()
                            .filter(|l| l.contains("ERROR") || l.contains("error"))
                            .cloned()
                            .collect::<Vec<_>>()
                            .join("; ");
                        let error = if error_msg.is_empty() {
                            "Download failed".to_string()
                        } else {
                            error_msg
                        };
                        let failure_platform = "YouTube".to_string();
                        let _ = app_clone.emit("download-complete", DownloadResult {
                            download_id: download_id_clone,
                            success: false,
                            file_path: None,
                            title: Some(title_clone.clone()),
                            platform: Some(failure_platform),
                            source_url: Some(vod_url_clone.clone()),
                            duration: None,
                            file_size: None,
                            sample_rate: None,
                            channels: None,
                            thumbnail_url: None,
                            error: Some(error),
                        });
                    }
                }
            }
            _ = &mut cancel_rx => {
                let _ = child.kill().await;
                let _ = stdout_task.abort();
                let _ = stderr_task.abort();
                cleanup_download();
                let cancel_platform = "YouTube".to_string();
                let _ = app_clone.emit("download-complete", DownloadResult {
                    download_id: download_id_clone,
                    success: false,
                    file_path: None,
                    title: Some(title_clone),
                    platform: Some(cancel_platform),
                    source_url: Some(vod_url_clone),
                    duration: None,
                    file_size: None,
                    sample_rate: None,
                    channels: None,
                    thumbnail_url: None,
                    error: Some("Download cancelled".to_string()),
                });
            }
        }
    });

    Ok(())
}

struct AudioMetadata {
    duration: Option<f64>,
    sample_rate: Option<u32>,
    channels: Option<u32>,
}

async fn extract_audio_metadata(file_path: &str) -> Option<AudioMetadata> {
    let ffprobe_path = match resolve_ffmpeg_binary() {
        Ok(ffmpeg) => {
            let path = std::path::Path::new(&ffmpeg);
            path.parent()?.join("ffprobe").to_string_lossy().to_string()
        }
        Err(_) => return None,
    };

    let mut cmd = tokio::process::Command::new(&ffprobe_path);
    no_window(&mut cmd);

    let output = cmd
        .args(&[
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            file_path,
        ])
        .output()
        .await
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout).ok()?;
    
    let duration = json["format"]["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok());
    
    let audio_stream = json["streams"]
        .as_array()?
        .iter()
        .find(|s| s["codec_type"] == "audio")?;
    
    let sample_rate = audio_stream["sample_rate"]
        .as_str()
        .and_then(|s| s.parse::<u32>().ok());
    
    let channels = audio_stream["channels"]
        .as_u64()
        .map(|c| c as u32);

    Some(AudioMetadata {
        duration,
        sample_rate,
        channels,
    })
}

/// Upload an audio file from the user's filesystem
#[tauri::command]
pub async fn upload_audio_file(
    file_path: String,
    title: String,
) -> Result<DownloadResult, String> {
    use std::fs;
    use std::path::Path;

    let source_path = Path::new(&file_path);
    
    // Validate file exists
    if !source_path.exists() {
        return Err("File does not exist".to_string());
    }

    // Validate file extension
    let extension = source_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .ok_or("Invalid file extension")?;

    let valid_extensions = ["mp3", "m4a", "wav", "flac", "ogg"];
    if !valid_extensions.contains(&extension.as_str()) {
        return Err(format!("Unsupported audio format: {}", extension));
    }

    // Get destination directory
    let audio_dir = get_downloaded_audio_dir()?;

    // Create safe filename
    let safe_title = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    let filename = format!("upload_{}_{}.{}", safe_title, timestamp, extension);
    let dest_path = audio_dir.join(&filename);

    // Copy file
    fs::copy(source_path, &dest_path)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    // Extract metadata
    let dest_path_str = dest_path.to_string_lossy().to_string();
    let metadata = extract_audio_metadata(&dest_path_str).await;
    
    let file_size = fs::metadata(&dest_path)
        .ok()
        .map(|m| m.len());

    Ok(DownloadResult {
        download_id: format!("upload_{}", timestamp),
        success: true,
        file_path: Some(dest_path_str),
        title: Some(title),
        platform: Some("Upload".to_string()),
        source_url: None,
        duration: metadata.as_ref().and_then(|m| m.duration),
        file_size,
        sample_rate: metadata.as_ref().and_then(|m| m.sample_rate),
        channels: metadata.as_ref().and_then(|m| m.channels),
        thumbnail_url: None,
        error: None,
    })
}

/// Generate a thumbnail for an existing audio file from its source URL
#[tauri::command]
pub async fn generate_audio_thumbnail(
    source_url: String,
    output_path: String,
) -> Result<String, String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    let ffmpeg_path = resolve_ffmpeg_binary()?;
    let thumbnail_path = std::path::Path::new(&output_path);

    generate_thumbnail_hybrid(
        &ytdlp_path,
        &ffmpeg_path,
        &source_url,
        thumbnail_path,
        "00:00:05",
    )
    .await?;

    Ok(output_path)
}

/// Cancel an audio download
#[tauri::command]
pub fn cancel_audio_download(download_id: String) -> Result<(), String> {
    let mut cancellers = ACTIVE_AUDIO_DOWNLOAD_CANCELLERS.lock().unwrap();
    if let Some(cancel_tx) = cancellers.remove(&download_id) {
        let _ = cancel_tx.send(());
        Ok(())
    } else {
        Err("Download not found".to_string())
    }
}
