use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::Emitter;
use once_cell::sync::Lazy;
use tokio::sync::oneshot;

use crate::ffmpeg_utils::{
    parse_ffmpeg_time, get_video_info, extract_duration_from_ffmpeg_output, detect_hardware_encoder
};
use crate::storage;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DownloadProgress {
    pub download_id: String,
    pub progress: f64,
    pub current_time: Option<f64>,
    pub total_time: Option<f64>,
    pub status: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DownloadResult {
    pub download_id: String,
    pub success: bool,
    pub file_path: Option<String>,
    pub thumbnail_path: Option<String>,
    pub duration: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub codec: Option<String>,
    pub file_size: Option<u64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DownloadMetadata {
    pub output_path: Option<String>,
    pub thumbnail_path: Option<String>,
    #[allow(dead_code)]
    pub started_at: std::time::SystemTime,
    #[allow(dead_code)]
    pub process_id: Option<u32>,
}

use tauri_plugin_shell::process::CommandChild;

pub static ACTIVE_DOWNLOADS: Lazy<Arc<Mutex<HashMap<String, bool>>>> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));
pub static ACTIVE_FFMPEG_PROCESSES: Lazy<Arc<Mutex<HashMap<String, CommandChild>>>> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));
pub static DOWNLOAD_METADATA: Lazy<Arc<Mutex<HashMap<String, DownloadMetadata>>>> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));
pub static ACTIVE_DOWNLOAD_CANCELLERS: Lazy<Arc<Mutex<HashMap<String, oneshot::Sender<()>>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Helper function to format time for filename
fn format_time_for_filename(seconds: f64) -> String {
    let h = (seconds / 3600.0) as u32;
    let m = ((seconds % 3600.0) / 60.0) as u32;
    let s = (seconds % 60.0) as u32;
    format!("{:02}{:02}{:02}", h, m, s)
}

/// Remux input_path → output_path adding -movflags +faststart (moves moov atom to front).
/// This is a fast stream-copy operation — no re-encoding, typically 5-15 seconds even for 2hr VODs.
/// Deletes input_path on success.
async fn remux_with_faststart(app: &tauri::AppHandle, input_path: &str, output_path: &str) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] Remuxing for faststart: {} -> {}", input_path, output_path);

    let shell = app.shell();
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", input_path,
            "-c", "copy",
            "-movflags", "+faststart",
            "-y",
            output_path,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run faststart remux: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Faststart remux failed: {}", stderr));
    }

    // Delete the raw temp file now that the faststart version exists
    let _ = std::fs::remove_file(input_path);

    println!("[Rust] Faststart remux completed successfully");
    Ok(())
}

/// Helper function to run FFmpeg segment download with a specific encoder
/// Returns Ok(()) on success, Err(error_message) on failure
async fn run_segment_download_with_encoder(
    app: &tauri::AppHandle,
    download_id: &str,
    video_url: &str,
    output_path: &str,
    start_time: f64,
    segment_duration: f64,
    encoder: &str,
    cancel_rx: &mut oneshot::Receiver<()>,
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    
    println!("[Rust] Running segment download with encoder: {}", encoder);
    
    let shell = app.shell();
    let cmd = shell.sidecar("ffmpeg").map_err(|e| format!("Failed to create ffmpeg sidecar: {}", e))?;
    
    let preset = if encoder == "libx264" { "ultrafast" } else { "fast" };
    let is_hls = video_url.contains(".m3u8") || video_url.contains("/playlist/");
    
    let start_time_str = format!("{:.3}", start_time);
    let segment_duration_str = format!("{:.3}", segment_duration);
    let referer_header = "Referer: https://kick.com\r\nOrigin: https://kick.com\r\n";
    let user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    // Write to a temp file first (no faststart), then do a fast remux pass to add faststart.
    // This avoids the slow in-place moov rewrite that causes the "stuck at 99%" stall.
    let temp_output_path = format!("{}.dl.tmp.mp4", output_path);
    
    let mut args: Vec<&str> = Vec::new();
    // HLS-specific input options must come before -i
    if is_hls {
        args.extend_from_slice(&[
            "-reconnect", "1",
            "-reconnect_streamed", "1",
            "-reconnect_delay_max", "5",
            "-headers", referer_header,
            "-user_agent", user_agent,
        ]);
    }
    args.extend_from_slice(&[
        "-ss", &start_time_str,
        "-i", video_url,
        "-t", &segment_duration_str,
        "-c:v", encoder,
        "-preset", preset,
        "-c:a", "aac",
        "-b:a", "128k",
        "-map", "0:v:0?",
        "-map", "0:a:0?",
        "-avoid_negative_ts", "make_zero",
        "-progress", "pipe:2",
        "-v", "warning",
        "-y",
        &temp_output_path,
    ]);
    
    let (mut rx, mut child) = cmd.args(args).spawn().map_err(|e| format!("Failed to spawn ffmpeg sidecar: {}", e))?;

    let total_duration = segment_duration;
    let app_clone = app.clone();
    let download_id_owned = download_id.to_string();
    
    let mut line_buffer = String::new();
    let mut last_progress_time = std::time::Instant::now();
    let mut lines_processed = 0;
    let mut success = false;
    let mut last_error: Option<String> = None;

    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Some(event) => {
        match event {
            tauri_plugin_shell::process::CommandEvent::Stderr(data) => {
                let chunk = String::from_utf8_lossy(&data);
                line_buffer.push_str(&chunk);

                while let Some(newline_pos) = line_buffer.find('\n') {
                    let line = line_buffer[..newline_pos].trim().to_string();
                    line_buffer.drain(..=newline_pos);

                    if line.is_empty() { continue; }

                    lines_processed += 1;
                    if lines_processed % 50 == 0 {
                        println!("[Rust] Processed {} lines from FFmpeg stderr", lines_processed);
                    }

                    // Look for out_time= lines (current time in HH:MM:SS.ms format)
                    if line.starts_with("out_time=") {
                        if let Some(time_str) = line.strip_prefix("out_time=") {
                            // Log raw time string for debugging
                            if lines_processed <= 5 {
                                println!("[Rust] FFmpeg out_time raw: '{}'", time_str);
                            }
                            if let Some(current_time) = parse_ffmpeg_time(time_str) {
                                // Skip negative times (happens at start of HLS downloads)
                                if current_time < 0.0 {
                                    if lines_processed <= 5 {
                                        println!("[Rust] Skipping negative time: {}", current_time);
                                    }
                                    continue;
                                }
                                let progress = ((current_time / total_duration) * 100.0).clamp(0.0, 95.0);

                                if last_progress_time.elapsed().as_secs() >= 1 {
                                    println!("[Rust] Emitting progress: {}% (time: {}/{})", progress, current_time, total_duration);
                                    let _ = app_clone.emit("download-progress", DownloadProgress {
                                        download_id: download_id_owned.clone(),
                                        progress,
                                        current_time: Some(current_time),
                                        total_time: Some(total_duration),
                                        status: "Downloading segment...".to_string(),
                                    });
                                    last_progress_time = std::time::Instant::now();
                                }
                            } else if lines_processed <= 5 {
                                println!("[Rust] Failed to parse time: '{}'", time_str);
                            }
                        }
                    } else if !line.starts_with("frame=") && !line.starts_with("fps=") 
                        && !line.starts_with("stream_") && !line.starts_with("bitrate=")
                        && !line.starts_with("total_size=") && !line.starts_with("out_time_ms=")
                        && !line.starts_with("out_time_us=") && !line.starts_with("dup_frames=")
                        && !line.starts_with("drop_frames=") && !line.starts_with("speed=")
                        && !line.starts_with("progress=") {
                        // This is likely an error or warning message from FFmpeg
                        println!("[Rust] FFmpeg output: {}", line);
                        // Only capture as error if it looks like an error
                        if line.to_lowercase().contains("error") || line.to_lowercase().contains("failed")
                            || line.to_lowercase().contains("invalid") || line.to_lowercase().contains("cannot")
                            || line.to_lowercase().contains("no such") || line.to_lowercase().contains("not found")
                            || line.to_lowercase().contains("nvenc") || line.to_lowercase().contains("encoder") {
                            last_error = Some(line.clone());
                        }
                    }
                }
            }
            tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                if let Some(code) = payload.code {
                    if code == 0 {
                        println!("[Rust] FFmpeg segment download completed successfully");
                        success = true;
                    } else {
                        println!("[Rust] FFmpeg segment download failed with exit code: {}", code);
                        if last_error.is_none() {
                            last_error = Some(format!("FFmpeg exited with code {}", code));
                        }
                    }
                } else {
                    println!("[Rust] FFmpeg segment download terminated without exit code");
                    if last_error.is_none() {
                        last_error = Some("FFmpeg terminated unexpectedly".to_string());
                    }
                }
                break;
            }
            _ => {}
        }
                    }
                    None => break,
                }
            }
            _ = &mut *cancel_rx => {
                println!("[Rust] Download cancelled, terminating FFmpeg...");
                let _ = child.kill();
                // Clean up temp file
                let _ = std::fs::remove_file(&temp_output_path);
                return Err("Download cancelled".to_string());
            }
        }
    }

    if success {
        // Emit "Optimizing for playback..." before the fast remux pass
        let _ = app.emit("download-progress", DownloadProgress {
            download_id: download_id.to_string(),
            progress: 97.0,
            current_time: None,
            total_time: None,
            status: "Optimizing for playback...".to_string(),
        });

        // Fast remux pass: move moov atom to front for instant seeking.
        // Reads from temp_output_path, writes final file to output_path, deletes temp on success.
        if let Err(e) = remux_with_faststart(app, &temp_output_path, output_path).await {
            // Remux failed — rename temp file to output so we at least have the video
            println!("[Rust] Faststart remux failed ({}), using raw download file", e);
            if let Err(rename_err) = std::fs::rename(&temp_output_path, output_path) {
                let _ = std::fs::remove_file(&temp_output_path);
                return Err(format!("Download succeeded but file move failed: {}", rename_err));
            }
        }
        Ok(())
    } else {
        // Clean up temp file on failure
        let _ = std::fs::remove_file(&temp_output_path);
        Err(format!("FFmpeg segment download failed: {}", 
            last_error.unwrap_or_else(|| "Unknown error".to_string())))
    }
}

/// Helper function to run FFmpeg full VOD download with a specific encoder
/// Returns Ok(()) on success, Err(error_message) on failure
async fn run_full_download_with_encoder(
    app: &tauri::AppHandle,
    download_id: &str,
    video_url: &str,
    output_path: &str,
    estimated_duration: Option<f64>,
    encoder: &str,
    use_copy_codec: bool,
    cancel_rx: &mut oneshot::Receiver<()>,
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    
    println!("[Rust] Running full download with encoder: {} (copy: {})", encoder, use_copy_codec);
    
    let shell = app.shell();
    let cmd = shell.sidecar("ffmpeg").map_err(|e| format!("Failed to create ffmpeg sidecar: {}", e))?;
    
    let preset = if encoder == "libx264" { "ultrafast" } else { "fast" };
    let is_hls = video_url.contains(".m3u8") || video_url.contains("/playlist/");
    let referer_header = "Referer: https://kick.com\r\nOrigin: https://kick.com\r\n";
    let user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    
    // Write to a temp file first (no faststart), then do a fast remux pass to add faststart.
    // This avoids the slow in-place moov rewrite that causes the "stuck at 99%" stall.
    let temp_output_path = format!("{}.dl.tmp.mp4", output_path);

    // Build args based on whether we're copying or encoding
    let mut args: Vec<&str> = Vec::new();
    // HLS-specific input options must come before -i
    if is_hls {
        args.extend_from_slice(&[
            "-reconnect", "1",
            "-reconnect_streamed", "1",
            "-reconnect_delay_max", "5",
            "-headers", referer_header,
            "-user_agent", user_agent,
        ]);
    }
    if use_copy_codec {
        args.extend_from_slice(&[
            "-i", video_url,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "128k",
            "-map", "0:v:0?",
            "-map", "0:a:0?",
            "-progress", "pipe:2",
            "-v", "warning",
            "-y",
            "-bsf:a", "aac_adtstoasc",
            &temp_output_path,
        ]);
    } else {
        args.extend_from_slice(&[
            "-i", video_url,
            "-c:v", encoder,
            "-preset", preset,
            "-c:a", "aac",
            "-b:a", "128k",
            "-map", "0:v:0?",
            "-map", "0:a:0?",
            "-avoid_negative_ts", "make_zero",
            "-progress", "pipe:2",
            "-v", "warning",
            "-y",
            &temp_output_path,
        ]);
    }
    
    let (mut rx, mut child) = cmd.args(args).spawn().map_err(|e| format!("Failed to spawn ffmpeg sidecar: {}", e))?;

    let mut total_duration = estimated_duration.unwrap_or(600.0);
    let app_clone = app.clone();
    let download_id_owned = download_id.to_string();
    
    let mut line_buffer = String::new();
    let mut last_progress_time = std::time::Instant::now();
    let mut lines_processed = 0;
    let mut success = false;
    let mut last_error: Option<String> = None;

    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Some(event) => {
        match event {
            tauri_plugin_shell::process::CommandEvent::Stderr(data) => {
                let chunk = String::from_utf8_lossy(&data);
                line_buffer.push_str(&chunk);

                while let Some(newline_pos) = line_buffer.find('\n') {
                    let line = line_buffer[..newline_pos].trim().to_string();
                    line_buffer.drain(..=newline_pos);

                    if line.is_empty() { continue; }

                    lines_processed += 1;
                    if lines_processed % 50 == 0 {
                        println!("[Rust] Processed {} lines from FFmpeg stderr", lines_processed);
                    }

                    if line.starts_with("out_time=") {
                        if let Some(time_str) = line.strip_prefix("out_time=") {
                            // Log raw time string for debugging
                            if lines_processed <= 5 {
                                println!("[Rust] FFmpeg out_time raw: '{}'", time_str);
                            }
                            if let Some(current_time) = parse_ffmpeg_time(time_str) {
                                // Skip negative times (happens at start of HLS downloads)
                                if current_time < 0.0 {
                                    if lines_processed <= 5 {
                                        println!("[Rust] Skipping negative time: {}", current_time);
                                    }
                                    continue;
                                }
                                // Update duration estimate if needed
                                if current_time > total_duration {
                                    total_duration = current_time * 1.1;
                                }
                                
                                let progress = ((current_time / total_duration) * 100.0).clamp(0.0, 95.0);

                                if last_progress_time.elapsed().as_secs() >= 1 {
                                    println!("[Rust] Emitting progress: {}% (time: {}/{})", progress, current_time, total_duration);
                                    let _ = app_clone.emit("download-progress", DownloadProgress {
                                        download_id: download_id_owned.clone(),
                                        progress,
                                        current_time: Some(current_time),
                                        total_time: Some(total_duration),
                                        status: "Downloading video...".to_string(),
                                    });
                                    last_progress_time = std::time::Instant::now();
                                }
                            } else if lines_processed <= 5 {
                                println!("[Rust] Failed to parse time: '{}'", time_str);
                            }
                        }
                    } else if !line.starts_with("frame=") && !line.starts_with("fps=") 
                        && !line.starts_with("stream_") && !line.starts_with("bitrate=")
                        && !line.starts_with("total_size=") && !line.starts_with("out_time_ms=")
                        && !line.starts_with("out_time_us=") && !line.starts_with("dup_frames=")
                        && !line.starts_with("drop_frames=") && !line.starts_with("speed=")
                        && !line.starts_with("progress=") {
                        // This is likely an error or warning message from FFmpeg
                        println!("[Rust] FFmpeg output: {}", line);
                        if line.to_lowercase().contains("error") || line.to_lowercase().contains("failed")
                            || line.to_lowercase().contains("invalid") || line.to_lowercase().contains("cannot")
                            || line.to_lowercase().contains("no such") || line.to_lowercase().contains("not found")
                            || line.to_lowercase().contains("nvenc") || line.to_lowercase().contains("encoder") {
                            last_error = Some(line.clone());
                        }
                    }
                }
            }
            tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                if let Some(code) = payload.code {
                    if code == 0 {
                        println!("[Rust] FFmpeg download completed successfully");
                        success = true;
                    } else {
                        println!("[Rust] FFmpeg download failed with exit code: {}", code);
                        if last_error.is_none() {
                            last_error = Some(format!("FFmpeg exited with code {}", code));
                        }
                    }
                } else {
                    println!("[Rust] FFmpeg download terminated without exit code");
                    if last_error.is_none() {
                        last_error = Some("FFmpeg terminated unexpectedly".to_string());
                    }
                }
                break;
            }
            _ => {}
        }
                    }
                    None => break,
                }
            }
            _ = &mut *cancel_rx => {
                println!("[Rust] Download cancelled, terminating FFmpeg...");
                let _ = child.kill();
                // Clean up temp file
                let _ = std::fs::remove_file(&temp_output_path);
                return Err("Download cancelled".to_string());
            }
        }
    }

    if success {
        // Emit "Optimizing for playback..." before the fast remux pass
        let _ = app.emit("download-progress", DownloadProgress {
            download_id: download_id.to_string(),
            progress: 97.0,
            current_time: None,
            total_time: None,
            status: "Optimizing for playback...".to_string(),
        });

        // Fast remux pass: move moov atom to front for instant seeking.
        // Reads from temp_output_path, writes final file to output_path, deletes temp on success.
        if let Err(e) = remux_with_faststart(app, &temp_output_path, output_path).await {
            // Remux failed — rename temp file to output so we at least have the video
            println!("[Rust] Faststart remux failed ({}), using raw download file", e);
            if let Err(rename_err) = std::fs::rename(&temp_output_path, output_path) {
                let _ = std::fs::remove_file(&temp_output_path);
                return Err(format!("Download succeeded but file move failed: {}", rename_err));
            }
        }
        Ok(())
    } else {
        // Clean up temp file on failure
        let _ = std::fs::remove_file(&temp_output_path);
        Err(format!("FFmpeg download failed: {}", 
            last_error.unwrap_or_else(|| "Unknown error".to_string())))
    }
}

#[tauri::command]
pub async fn download_pumpfun_vod_segment(
    app: tauri::AppHandle,
    download_id: String,
    title: String,
    video_url: String,
    mint_id: String,
    start_time: f64,
    end_time: f64
) -> Result<(), String> {
    println!("[Rust] download_pumpfun_vod_segment called with:");
    println!("[Rust]   download_id: {}", download_id);
    println!("[Rust]   title: {}", title);
    println!("[Rust]   video_url: {}", video_url);
    println!("[Rust]   mint_id: {}", mint_id);
    println!("[Rust]   start_time: {}", start_time);
    println!("[Rust]   end_time: {}", end_time);

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
            println!("[Rust] Download already in progress: {}", download_id);
            return Err("Download already in progress".to_string());
        }
        downloads.insert(download_id.clone(), true);
        println!("[Rust] Download registered: {}", download_id);
    }

    // Clean up when done
    let cleanup_download = {
        let download_id = download_id.clone();
        let downloads = ACTIVE_DOWNLOADS.clone();
        move || {
            println!("[Rust] Cleaning up download: {}", download_id);
            let mut downloads = downloads.lock().unwrap();
            downloads.remove(&download_id);
        }
    };

    // Create cancellation channel
    let (cancel_tx, mut cancel_rx) = oneshot::channel::<()>();
    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.insert(download_id.clone(), cancel_tx);
    }

    // Get storage paths
    println!("[Rust] Getting storage paths...");
    let paths = storage::init_storage_dirs()
        .map_err(|e| {
            println!("[Rust] Failed to get storage paths: {}", e);
            format!("Failed to get storage paths: {}", e)
        })?;

    println!("[Rust] Storage paths retrieved. Videos dir: {}", paths.videos.display());

    // Generate filename with segment info
    let safe_title = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    let mint_prefix = if mint_id.len() >= 8 { &mint_id[..8] } else { &mint_id };

    // Format times for filename (start-end)
    let start_formatted = format_time_for_filename(start_time);
    let end_formatted = format_time_for_filename(end_time);

    let filename = format!("pumpfun_{}_{}_{}_{}_{}.mp4",
        mint_prefix, safe_title, start_formatted, end_formatted, timestamp);
    let video_path = paths.videos.join(&filename);

    println!("[Rust] Generated filename: {}", filename);
    println!("[Rust] Full video path: {}", video_path.display());

    // Store download metadata for cleanup
    {
        let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
        metadata_map.insert(download_id.clone(), DownloadMetadata {
            output_path: Some(video_path.to_string_lossy().to_string()),
            thumbnail_path: None, // We'll set this when/if it's generated
            started_at: std::time::SystemTime::now(),
            process_id: None,
        });
    }

    // Send initial progress
    println!("[Rust] Sending initial progress event...");
    let progress_result = app.emit("download-progress", DownloadProgress {
        download_id: download_id.clone(),
        progress: 0.0,
        current_time: Some(0.0),
        total_time: Some(segment_duration),
        status: "Starting segment download...".to_string(),
    });

    if let Err(e) = progress_result {
        println!("[Rust] Failed to emit initial progress: {}", e);
    } else {
        println!("[Rust] Initial progress sent successfully");
    }

    // Clone app handle for use in async block
    let app_clone = app.clone();
    let download_id_clone = download_id.clone();
    println!("[Rust] Starting async segment download task...");

    let result = tokio::spawn(async move {
        use tauri_plugin_shell::ShellExt;
        
        println!("[Rust] Async task started for segment download: {}", download_id_clone);

        // Detect hardware encoder
        let encoder = detect_hardware_encoder(&app_clone).await.unwrap_or_else(|| "libx264".to_string());
        println!("[Rust] Detected encoder: {}", encoder);

        let video_path_str = video_path.to_string_lossy().to_string();

        // Try download with detected encoder first
        let download_result = run_segment_download_with_encoder(
            &app_clone,
            &download_id_clone,
            &video_url,
            &video_path_str,
            start_time,
            segment_duration,
            &encoder,
            &mut cancel_rx,
        ).await;

        // If hardware encoder failed and we weren't already using software, retry with software
        let download_result = match download_result {
            Err(ref e) if encoder != "libx264" => {
                println!("[Rust] Hardware encoder ({}) failed: {}. Retrying with software encoder (libx264)...", encoder, e);
                run_segment_download_with_encoder(
                    &app_clone,
                    &download_id_clone,
                    &video_url,
                    &video_path_str,
                    start_time,
                    segment_duration,
                    "libx264",
                    &mut cancel_rx,
                ).await
            }
            other => other,
        };

        // Check result
        download_result?;

        // Check for cancellation before post-processing
        if cancel_rx.try_recv().is_ok() {
            println!("[Rust] Segment download cancelled before post-processing");
            let _ = std::fs::remove_file(&video_path);
            return Err("Download cancelled".to_string());
        }

        println!("[Rust] Segment download completed successfully");

        // Get file metadata
        let metadata = match std::fs::metadata(&video_path) {
            Ok(meta) => {
                println!("[Rust] Segment file metadata obtained, size: {} bytes", meta.len());
                meta
            }
            Err(e) => {
                println!("[Rust] Failed to get segment file metadata: {}", e);
                return Err(format!("Failed to get segment file metadata: {}", e));
            }
        };
        let file_size = metadata.len();

        // Check for cancellation before thumbnail generation
        if cancel_rx.try_recv().is_ok() {
            println!("[Rust] Segment download cancelled before thumbnail generation");
            let _ = std::fs::remove_file(&video_path);
            return Err("Download cancelled".to_string());
        }

        // Generate thumbnail for segment
        println!("[Rust] Generating thumbnail for segment...");
        let shell = app_clone.shell();
        let thumbnail_path = paths.thumbnails.join(format!("{}_thumb.jpg", filename.replace(".mp4", "")));
        let thumbnail_result = match shell.sidecar("ffmpeg") {
            Ok(ffmpeg) => {
                match ffmpeg.args([
                    "-ss", "00:00:05",
                    "-i", video_path.to_str().ok_or("Invalid video path")?,
                    "-vframes", "1",
                    "-vf", "scale=320:-1",
                    "-y",
                    thumbnail_path.to_str().ok_or("Invalid thumbnail path")?,
                ]).output().await {
                    Ok(output) => {
                        println!("[Rust] Segment thumbnail generation completed, success: {}", output.status.success());
                        Some(output)
                    }
                    Err(e) => {
                        println!("[Rust] Failed to generate segment thumbnail: {}", e);
                        None
                    }
                }
            }
            Err(e) => {
                println!("[Rust] Failed to get ffmpeg for segment thumbnail: {}", e);
                None
            }
        };

        let thumbnail_path_str = if let Some(ref result) = thumbnail_result {
            if result.status.success() {
                println!("[Rust] Segment thumbnail saved to: {}", thumbnail_path.display());
                Some(thumbnail_path.to_string_lossy().to_string())
            } else {
                println!("[Rust] Segment thumbnail generation failed");
                None
            }
        } else {
            println!("[Rust] No segment thumbnail result");
            None
        };

        // Check for cancellation before video info extraction
        if cancel_rx.try_recv().is_ok() {
            println!("[Rust] Segment download cancelled before video info extraction");
            let _ = std::fs::remove_file(&video_path);
            if let Some(ref thumb_path) = thumbnail_path_str {
                let _ = std::fs::remove_file(thumb_path);
            }
            return Err("Download cancelled".to_string());
        }

        // Get video dimensions, codec info, and actual duration from file
        println!("[Rust] Getting detailed segment video info...");
        let video_info = get_video_info(&app_clone, &video_path).await.ok();
        let (width, height, codec, actual_duration) = if let Some(ref info) = video_info {
            println!("[Rust] Segment video info - width: {}, height: {}, codec: {}, duration: {:?}", info.width, info.height, info.codec, info.duration);
            (Some(info.width), Some(info.height), Some(info.codec.clone()), info.duration)
        } else {
            println!("[Rust] Could not get detailed segment video info");
            (None, None, None, None)
        };

        // Use actual duration from file if available, otherwise fall back to calculated segment duration
        let final_duration = actual_duration.unwrap_or(segment_duration);
        println!("[Rust] Final segment duration: {} (actual: {:?}, calculated: {})", final_duration, actual_duration, segment_duration);

        println!("[Rust] Segment download task completed successfully");
        Ok(DownloadResult {
            download_id: download_id_clone,
            success: true,
            file_path: Some(video_path.to_string_lossy().to_string()),
            thumbnail_path: thumbnail_path_str,
            duration: Some(final_duration),
            width,
            height,
            codec,
            file_size: Some(file_size),
            error: None,
        })
    }).await;

    println!("[Rust] Async segment download task completed");

    cleanup_download();

    println!("[Rust] Processing segment download result...");
    match result {
        Ok(Ok(download_result)) => {
            println!("[Rust] Segment download successful! File: {:?}", download_result.file_path);

            // Send final progress
            println!("[Rust] Sending segment completion progress (100%)");
            let progress_result = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 100.0,
                current_time: None,
                total_time: None,
                status: "Segment download completed!".to_string(),
            });

            if let Err(e) = progress_result {
                println!("[Rust] Failed to send segment completion progress: {}", e);
            }

            // Send completion event
            println!("[Rust] Sending segment completion event...");
            let completion_result = app.emit("download-complete", download_result);
            if let Err(e) = completion_result {
                println!("[Rust] Failed to send segment completion event: {}", e);
            } else {
                println!("[Rust] Segment completion event sent successfully");
            }

            Ok(())
        }
        Ok(Err(e)) => {
            let error_msg = format!("Segment download failed: {}", e);
            println!("[Rust] Segment download failed: {}", error_msg);

            // Send error progress
            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 0.0,
                current_time: None,
                total_time: None,
                status: error_msg.clone(),
            });

            // Send error event
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
            println!("[Rust] Segment download task failed: {}", error_msg);

            // Send error progress
            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 0.0,
                current_time: None,
                total_time: None,
                status: error_msg.clone(),
            });

            // Send error event
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

            Err(format!("Segment download task failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn download_pumpfun_vod(
    app: tauri::AppHandle,
    download_id: String,
    title: String,
    video_url: String,
    mint_id: String
) -> Result<(), String> {
    println!("[Rust] download_pumpfun_vod called with:");
    println!("[Rust]   download_id: {}", download_id);
    println!("[Rust]   title: {}", title);
    println!("[Rust]   video_url: {}", video_url);
    println!("[Rust]   mint_id: {}", mint_id);

    // Check if download already exists
    {
        let mut downloads = ACTIVE_DOWNLOADS.lock().unwrap();
        if downloads.contains_key(&download_id) {
            println!("[Rust] Download already in progress: {}", download_id);
            return Err("Download already in progress".to_string());
        }
        downloads.insert(download_id.clone(), true);
        println!("[Rust] Download registered: {}", download_id);
    }

    // Clean up when done
    let cleanup_download = {
        let download_id = download_id.clone();
        let downloads = ACTIVE_DOWNLOADS.clone();
        move || {
            println!("[Rust] Cleaning up download: {}", download_id);
            let mut downloads = downloads.lock().unwrap();
            downloads.remove(&download_id);
        }
    };

    // Create cancellation channel
    let (cancel_tx, mut cancel_rx) = oneshot::channel::<()>();
    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.insert(download_id.clone(), cancel_tx);
    }

    // Get storage paths
    println!("[Rust] Getting storage paths...");
    let paths = storage::init_storage_dirs()
        .map_err(|e| {
            println!("[Rust] Failed to get storage paths: {}", e);
            format!("Failed to get storage paths: {}", e)
        })?;

    println!("[Rust] Storage paths retrieved. Videos dir: {}", paths.videos.display());

    // Generate filename
    let safe_title = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    let mint_prefix = if mint_id.len() >= 8 { &mint_id[..8] } else { &mint_id };
    let filename = format!("pumpfun_{}_{}_{}.mp4", mint_prefix, safe_title, timestamp);
    let video_path = paths.videos.join(&filename);

    println!("[Rust] Generated filename: {}", filename);
    println!("[Rust] Full video path: {}", video_path.display());

    // Store download metadata for cleanup
    {
        let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
        metadata_map.insert(download_id.clone(), DownloadMetadata {
            output_path: Some(video_path.to_string_lossy().to_string()),
            thumbnail_path: None, // We'll set this when/if it's generated
            started_at: std::time::SystemTime::now(),
            process_id: None,
        });
    }

    // Send initial progress
    println!("[Rust] Sending initial progress event...");
    let progress_result = app.emit("download-progress", DownloadProgress {
        download_id: download_id.clone(),
        progress: 0.0,
        current_time: None,
        total_time: None,
        status: "Starting download...".to_string(),
    });

    if let Err(e) = progress_result {
        println!("[Rust] Failed to emit initial progress: {}", e);
    } else {
        println!("[Rust] Initial progress sent successfully");
    }

    // Clone app handle for use in async block
    let app_clone = app.clone();
    let download_id_clone = download_id.clone();
    println!("[Rust] Starting async download task...");

    let result = tokio::spawn(async move {
        use tauri_plugin_shell::ShellExt;
        
        println!("[Rust] Async task started for download: {}", download_id_clone);

        let shell = app_clone.shell();

        // First, get video info to get duration
        println!("[Rust] Running ffmpeg to get video info for URL: {}", video_url);
        let is_hls_probe = video_url.contains(".m3u8") || video_url.contains("/playlist/");
        let mut probe_args: Vec<&str> = Vec::new();
        if is_hls_probe {
            probe_args.extend_from_slice(&[
                "-reconnect", "1",
                "-reconnect_streamed", "1",
                "-reconnect_delay_max", "5",
                "-headers", "Referer: https://kick.com\r\nOrigin: https://kick.com\r\n",
                "-user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            ]);
        }
        probe_args.extend_from_slice(&["-i", &video_url, "-f", "null", "-t", "1", "-"]);
        let info_output = match shell.sidecar("ffmpeg") {
            Ok(ffmpeg) => {
                match ffmpeg.args(probe_args).output().await {
                    Ok(output) => output,
                    Err(e) => return Err(format!("Failed to run ffmpeg info: {}", e))
                }
            }
            Err(e) => return Err(format!("Failed to get ffmpeg sidecar: {}", e))
        };

        // Extract duration from stderr
        let stderr = String::from_utf8_lossy(&info_output.stderr);
        let duration = extract_duration_from_ffmpeg_output(&stderr);
        println!("[Rust] Video duration extracted: {:?}", duration);

        // Detect hardware encoder
        let encoder = detect_hardware_encoder(&app_clone).await.unwrap_or_else(|| "libx264".to_string());
        println!("[Rust] Detected encoder: {}", encoder);

        let video_path_str = video_path.to_string_lossy().to_string();

        // Try download with detected encoder first
        let download_result = run_full_download_with_encoder(
            &app_clone,
            &download_id_clone,
            &video_url,
            &video_path_str,
            duration,
            &encoder,
            false,
            &mut cancel_rx,
        ).await;

        // If hardware encoder failed and we weren't already using software, retry with software
        let download_result = match download_result {
            Err(ref e) if encoder != "libx264" => {
                println!("[Rust] Hardware encoder ({}) failed: {}. Retrying with software encoder (libx264)...", encoder, e);
                run_full_download_with_encoder(
                    &app_clone,
                    &download_id_clone,
                    &video_url,
                    &video_path_str,
                    duration,
                    "libx264",
                    false,
                    &mut cancel_rx,
                ).await
            }
            other => other,
        };

        // Check result
        download_result?;

        // Check for cancellation before post-processing
        if cancel_rx.try_recv().is_ok() {
            println!("[Rust] Download cancelled before post-processing");
            let _ = std::fs::remove_file(&video_path);
            return Err("Download cancelled".to_string());
        }

        println!("[Rust] Download completed successfully");

        // Get file metadata
        let metadata = match std::fs::metadata(&video_path) {
            Ok(meta) => {
                println!("[Rust] File metadata obtained, size: {} bytes", meta.len());
                meta
            }
            Err(e) => {
                println!("[Rust] Failed to get file metadata: {}", e);
                return Err(format!("Failed to get file metadata: {}", e));
            }
        };
        let file_size = metadata.len();

        // Check for cancellation before thumbnail generation
        if cancel_rx.try_recv().is_ok() {
            println!("[Rust] Download cancelled before thumbnail generation");
            let _ = std::fs::remove_file(&video_path);
            return Err("Download cancelled".to_string());
        }

        // Generate thumbnail
        println!("[Rust] Generating thumbnail...");
        let thumbnail_path = paths.thumbnails.join(format!("{}_thumb.jpg", filename.replace(".mp4", "")));
        let thumbnail_result = match shell.sidecar("ffmpeg") {
            Ok(ffmpeg) => {
                match ffmpeg.args([
                    "-ss", "00:00:05",
                    "-i", video_path.to_str().ok_or("Invalid video path")?,
                    "-vframes", "1",
                    "-vf", "scale=320:-1",
                    "-y",
                    thumbnail_path.to_str().ok_or("Invalid thumbnail path")?,
                ]).output().await {
                    Ok(output) => {
                        println!("[Rust] Thumbnail generation completed, success: {}", output.status.success());
                        Some(output)
                    }
                    Err(e) => {
                        println!("[Rust] Failed to generate thumbnail: {}", e);
                        None
                    }
                }
            }
            Err(e) => {
                println!("[Rust] Failed to get ffmpeg for thumbnail: {}", e);
                None
            }
        };

        let thumbnail_path_str = if let Some(ref result) = thumbnail_result {
            if result.status.success() {
                println!("[Rust] Thumbnail saved to: {}", thumbnail_path.display());
                Some(thumbnail_path.to_string_lossy().to_string())
            } else {
                println!("[Rust] Thumbnail generation failed");
                None
            }
        } else {
            println!("[Rust] No thumbnail result");
            None
        };

        // Check for cancellation before video info extraction
        if cancel_rx.try_recv().is_ok() {
            println!("[Rust] Download cancelled before video info extraction");
            let _ = std::fs::remove_file(&video_path);
            if let Some(ref thumb_path) = thumbnail_path_str {
                let _ = std::fs::remove_file(thumb_path);
            }
            return Err("Download cancelled".to_string());
        }

        // Get video dimensions, codec info, and actual duration from downloaded file
        println!("[Rust] Getting detailed video info...");
        let video_info = get_video_info(&app_clone, &video_path).await.ok();
        let (width, height, codec, actual_file_duration) = if let Some(ref info) = video_info {
            println!("[Rust] Video info - width: {}, height: {}, codec: {}, duration: {:?}", info.width, info.height, info.codec, info.duration);
            (Some(info.width), Some(info.height), Some(info.codec.clone()), info.duration)
        } else {
            println!("[Rust] Could not get detailed video info");
            (None, None, None, None)
        };

        // Prefer the actual file duration over the estimated duration from stream info
        let final_duration = actual_file_duration.or(duration);

        println!("[Rust] Download task completed successfully");
        Ok(DownloadResult {
            download_id: download_id_clone,
            success: true,
            file_path: Some(video_path.to_string_lossy().to_string()),
            thumbnail_path: thumbnail_path_str,
            duration: final_duration,
            width,
            height,
            codec,
            file_size: Some(file_size),
            error: None,
        })
    }).await;

    println!("[Rust] Async task completed");

    cleanup_download();

    println!("[Rust] Processing download result...");
    match result {
        Ok(Ok(download_result)) => {
            println!("[Rust] Download successful! File: {:?}", download_result.file_path);

            // Send final progress
            println!("[Rust] Sending completion progress (100%)");
            let progress_result = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 100.0,
                current_time: None,
                total_time: None,
                status: "Download completed!".to_string(),
            });

            if let Err(e) = progress_result {
                println!("[Rust] Failed to send completion progress: {}", e);
            }

            // Send completion event
            println!("[Rust] Sending completion event...");
            let completion_result = app.emit("download-complete", download_result);
            if let Err(e) = completion_result {
                println!("[Rust] Failed to send completion event: {}", e);
            } else {
                println!("[Rust] Completion event sent successfully");
            }

            Ok(())
        }
        Ok(Err(e)) => {
            let error_msg = format!("Download failed: {}", e);
            println!("[Rust] Download failed: {}", error_msg);

            // Send error progress
            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 0.0,
                current_time: None,
                total_time: None,
                status: error_msg.clone(),
            });

            // Send error event
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
            println!("[Rust] Download task failed: {}", error_msg);

            // Send error progress
            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 0.0,
                current_time: None,
                total_time: None,
                status: error_msg.clone(),
            });

            // Send error event
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

            Err(format!("Download task failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn download_kick_vod_segment(
    app: tauri::AppHandle,
    download_id: String,
    title: String,
    video_url: String,
    channel_slug: String,
    start_time: f64,
    end_time: f64
) -> Result<(), String> {
    println!("[Rust] download_kick_vod_segment called with:");
    println!("[Rust]   download_id: {}", download_id);
    println!("[Rust]   title: {}", title);
    println!("[Rust]   video_url: {}", video_url);
    println!("[Rust]   channel_slug: {}", channel_slug);
    println!("[Rust]   start_time: {}", start_time);
    println!("[Rust]   end_time: {}", end_time);

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
            println!("[Rust] Download already in progress: {}", download_id);
            return Err("Download already in progress".to_string());
        }
        downloads.insert(download_id.clone(), true);
        println!("[Rust] Download registered: {}", download_id);
    }

    // Clean up when done
    let cleanup_download = {
        let download_id = download_id.clone();
        let downloads = ACTIVE_DOWNLOADS.clone();
        move || {
            println!("[Rust] Cleaning up download: {}", download_id);
            let mut downloads = downloads.lock().unwrap();
            downloads.remove(&download_id);
        }
    };

    // Create cancellation channel
    let (cancel_tx, mut cancel_rx) = oneshot::channel::<()>();
    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.insert(download_id.clone(), cancel_tx);
    }

    // Get storage paths
    println!("[Rust] Getting storage paths...");
    let paths = storage::init_storage_dirs()
        .map_err(|e| {
            println!("[Rust] Failed to get storage paths: {}", e);
            format!("Failed to get storage paths: {}", e)
        })?;

    println!("[Rust] Storage paths retrieved. Videos dir: {}", paths.videos.display());

    // Generate filename with segment info
    let safe_title = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    let channel_prefix = if channel_slug.len() >= 8 { &channel_slug[..8] } else { &channel_slug };

    // Format times for filename (start-end)
    let start_formatted = format_time_for_filename(start_time);
    let end_formatted = format_time_for_filename(end_time);

    let filename = format!("kick_{}_{}_{}_{}_{}.mp4",
        channel_prefix, safe_title, start_formatted, end_formatted, timestamp);
    let video_path = paths.videos.join(&filename);

    println!("[Rust] Generated filename: {}", filename);
    println!("[Rust] Full video path: {}", video_path.display());

    // Store download metadata for cleanup
    {
        let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
        metadata_map.insert(download_id.clone(), DownloadMetadata {
            output_path: Some(video_path.to_string_lossy().to_string()),
            thumbnail_path: None, // We'll set this when/if it's generated
            started_at: std::time::SystemTime::now(),
            process_id: None,
        });
    }

    // Send initial progress
    println!("[Rust] Sending initial progress event...");
    let progress_result = app.emit("download-progress", DownloadProgress {
        download_id: download_id.clone(),
        progress: 0.0,
        current_time: Some(0.0),
        total_time: Some(segment_duration),
        status: "Starting segment download...".to_string(),
    });

    if let Err(e) = progress_result {
        println!("[Rust] Failed to emit initial progress: {}", e);
    } else {
        println!("[Rust] Initial progress sent successfully");
    }

    // Clone app handle for use in async block
    let app_clone = app.clone();
    let download_id_clone = download_id.clone();
    println!("[Rust] Starting async segment download task...");

    let result = tokio::spawn(async move {
        use tauri_plugin_shell::ShellExt;
        
        println!("[Rust] Async task started for segment download: {}", download_id_clone);

        // Detect hardware encoder
        let encoder = detect_hardware_encoder(&app_clone).await.unwrap_or_else(|| "libx264".to_string());
        println!("[Rust] Detected encoder: {}", encoder);

        let video_path_str = video_path.to_string_lossy().to_string();

        // Try download with detected encoder first
        let download_result = run_segment_download_with_encoder(
            &app_clone,
            &download_id_clone,
            &video_url,
            &video_path_str,
            start_time,
            segment_duration,
            &encoder,
            &mut cancel_rx,
        ).await;

        // If hardware encoder failed and we weren't already using software, retry with software
        let download_result = match download_result {
            Err(ref e) if encoder != "libx264" => {
                println!("[Rust] Hardware encoder ({}) failed: {}. Retrying with software encoder (libx264)...", encoder, e);
                run_segment_download_with_encoder(
                    &app_clone,
                    &download_id_clone,
                    &video_url,
                    &video_path_str,
                    start_time,
                    segment_duration,
                    "libx264",
                    &mut cancel_rx,
                ).await
            }
            other => other,
        };

        // Check result
        download_result?;

        // Check for cancellation before post-processing
        if cancel_rx.try_recv().is_ok() {
            println!("[Rust] Segment download cancelled before post-processing");
            let _ = std::fs::remove_file(&video_path);
            return Err("Download cancelled".to_string());
        }

        println!("[Rust] Segment download completed successfully");

        // Get file metadata
        let metadata = match std::fs::metadata(&video_path) {
            Ok(meta) => {
                println!("[Rust] Segment file metadata obtained, size: {} bytes", meta.len());
                meta
            }
            Err(e) => {
                println!("[Rust] Failed to get segment file metadata: {}", e);
                return Err(format!("Failed to get segment file metadata: {}", e));
            }
        };
        let file_size = metadata.len();

        // Check for cancellation before thumbnail generation
        if cancel_rx.try_recv().is_ok() {
            println!("[Rust] Segment download cancelled before thumbnail generation");
            let _ = std::fs::remove_file(&video_path);
            return Err("Download cancelled".to_string());
        }

        // Generate thumbnail for segment
        println!("[Rust] Generating thumbnail for segment...");
        let shell = app_clone.shell();
        let thumbnail_path = paths.thumbnails.join(format!("{}_thumb.jpg", filename.replace(".mp4", "")));
        let thumbnail_result = match shell.sidecar("ffmpeg") {
            Ok(ffmpeg) => {
                match ffmpeg.args([
                    "-ss", "00:00:05",
                    "-i", video_path.to_str().ok_or("Invalid video path")?,
                    "-vframes", "1",
                    "-vf", "scale=320:-1",
                    "-y",
                    thumbnail_path.to_str().ok_or("Invalid thumbnail path")?,
                ]).output().await {
                    Ok(output) => {
                        println!("[Rust] Segment thumbnail generation completed, success: {}", output.status.success());
                        Some(output)
                    }
                    Err(e) => {
                        println!("[Rust] Failed to generate segment thumbnail: {}", e);
                        None
                    }
                }
            }
            Err(e) => {
                println!("[Rust] Failed to get ffmpeg for segment thumbnail: {}", e);
                None
            }
        };

        let thumbnail_path_str = if let Some(ref result) = thumbnail_result {
            if result.status.success() {
                println!("[Rust] Segment thumbnail saved to: {}", thumbnail_path.display());
                Some(thumbnail_path.to_string_lossy().to_string())
            } else {
                println!("[Rust] Segment thumbnail generation failed");
                None
            }
        } else {
            println!("[Rust] No segment thumbnail result");
            None
        };

        // Check for cancellation before video info extraction
        if cancel_rx.try_recv().is_ok() {
            println!("[Rust] Segment download cancelled before video info extraction");
            let _ = std::fs::remove_file(&video_path);
            if let Some(ref thumb_path) = thumbnail_path_str {
                let _ = std::fs::remove_file(thumb_path);
            }
            return Err("Download cancelled".to_string());
        }

        // Get video dimensions, codec info, and actual duration from file
        println!("[Rust] Getting detailed segment video info...");
        let video_info = get_video_info(&app_clone, &video_path).await.ok();
        let (width, height, codec, actual_duration) = if let Some(ref info) = video_info {
            println!("[Rust] Segment video info - width: {}, height: {}, codec: {}, duration: {:?}", info.width, info.height, info.codec, info.duration);
            (Some(info.width), Some(info.height), Some(info.codec.clone()), info.duration)
        } else {
            println!("[Rust] Could not get detailed segment video info");
            (None, None, None, None)
        };

        // Use actual duration from file if available, otherwise fall back to calculated segment duration
        let final_duration = actual_duration.unwrap_or(segment_duration);
        println!("[Rust] Final segment duration: {} (actual: {:?}, calculated: {})", final_duration, actual_duration, segment_duration);

        println!("[Rust] Segment download task completed successfully");
        Ok(DownloadResult {
            download_id: download_id_clone,
            success: true,
            file_path: Some(video_path.to_string_lossy().to_string()),
            thumbnail_path: thumbnail_path_str,
            duration: Some(final_duration),
            width,
            height,
            codec,
            file_size: Some(file_size),
            error: None,
        })
    }).await;

    println!("[Rust] Async segment download task completed");

    cleanup_download();

    println!("[Rust] Processing segment download result...");
    match result {
        Ok(Ok(download_result)) => {
            println!("[Rust] Segment download successful! File: {:?}", download_result.file_path);

            // Send final progress
            println!("[Rust] Sending segment completion progress (100%)");
            let progress_result = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 100.0,
                current_time: None,
                total_time: None,
                status: "Segment download completed!".to_string(),
            });

            if let Err(e) = progress_result {
                println!("[Rust] Failed to send segment completion progress: {}", e);
            }

            // Send completion event
            println!("[Rust] Sending segment completion event...");
            let completion_result = app.emit("download-complete", download_result);
            if let Err(e) = completion_result {
                println!("[Rust] Failed to send segment completion event: {}", e);
            } else {
                println!("[Rust] Segment completion event sent successfully");
            }

            Ok(())
        }
        Ok(Err(e)) => {
            let error_msg = format!("Segment download failed: {}", e);
            println!("[Rust] Segment download failed: {}", error_msg);

            // Send error progress
            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 0.0,
                current_time: None,
                total_time: None,
                status: error_msg.clone(),
            });

            // Send error event
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
            println!("[Rust] Segment download task failed: {}", error_msg);

            // Send error progress
            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 0.0,
                current_time: None,
                total_time: None,
                status: error_msg.clone(),
            });

            // Send error event
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

            Err(format!("Segment download task failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn download_kick_vod(
    app: tauri::AppHandle,
    download_id: String,
    title: String,
    video_url: String,
    channel_slug: String
) -> Result<(), String> {
    println!("[Rust] download_kick_vod called with:");
    println!("[Rust]   download_id: {}", download_id);
    println!("[Rust]   title: {}", title);
    println!("[Rust]   video_url: {}", video_url);
    println!("[Rust]   channel_slug: {}", channel_slug);

    // Check if download already exists
    {
        let mut downloads = ACTIVE_DOWNLOADS.lock().unwrap();
        if downloads.contains_key(&download_id) {
            println!("[Rust] Download already in progress: {}", download_id);
            return Err("Download already in progress".to_string());
        }
        downloads.insert(download_id.clone(), true);
        println!("[Rust] Download registered: {}", download_id);
    }

    // Clean up when done
    let cleanup_download = {
        let download_id = download_id.clone();
        let downloads = ACTIVE_DOWNLOADS.clone();
        move || {
            println!("[Rust] Cleaning up download: {}", download_id);
            let mut downloads = downloads.lock().unwrap();
            downloads.remove(&download_id);
        }
    };

    // Create cancellation channel
    let (cancel_tx, mut cancel_rx) = oneshot::channel::<()>();
    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.insert(download_id.clone(), cancel_tx);
    }

    // Get storage paths
    println!("[Rust] Getting storage paths...");
    let paths = storage::init_storage_dirs()
        .map_err(|e| {
            println!("[Rust] Failed to get storage paths: {}", e);
            format!("Failed to get storage paths: {}", e)
        })?;

    println!("[Rust] Storage paths retrieved. Videos dir: {}", paths.videos.display());

    // Generate filename
    let safe_title = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    let channel_prefix = if channel_slug.len() >= 8 { &channel_slug[..8] } else { &channel_slug };
    let filename = format!("kick_{}_{}_{}.mp4", channel_prefix, safe_title, timestamp);
    let video_path = paths.videos.join(&filename);

    println!("[Rust] Generated filename: {}", filename);
    println!("[Rust] Full video path: {}", video_path.display());

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
        status: "Starting download...".to_string(),
    });

    if let Err(e) = progress_result {
        println!("[Rust] Failed to emit initial progress: {}", e);
    }

    // Clone app handle for use in async block
    let app_clone = app.clone();
    let download_id_clone = download_id.clone();
    println!("[Rust] Starting async download task...");

    let result = tokio::spawn(async move {
        use tauri_plugin_shell::ShellExt;
        
        println!("[Rust] Async task started for download: {}", download_id_clone);

        let shell = app_clone.shell();

        // First, get video info to get duration
        println!("[Rust] Running ffmpeg to get video info for URL: {}", video_url);
        let is_hls_probe = video_url.contains(".m3u8") || video_url.contains("/playlist/");
        let mut probe_args: Vec<&str> = Vec::new();
        if is_hls_probe {
            probe_args.extend_from_slice(&[
                "-reconnect", "1",
                "-reconnect_streamed", "1",
                "-reconnect_delay_max", "5",
                "-headers", "Referer: https://kick.com\r\nOrigin: https://kick.com\r\n",
                "-user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            ]);
        }
        probe_args.extend_from_slice(&["-i", &video_url, "-f", "null", "-t", "1", "-"]);
        let info_output = match shell.sidecar("ffmpeg") {
            Ok(ffmpeg) => {
                match ffmpeg.args(probe_args).output().await {
                    Ok(output) => output,
                    Err(e) => return Err(format!("Failed to run ffmpeg info: {}", e))
                }
            }
            Err(e) => return Err(format!("Failed to get ffmpeg sidecar: {}", e))
        };

        // Extract duration from stderr
        let stderr = String::from_utf8_lossy(&info_output.stderr);
        let duration = extract_duration_from_ffmpeg_output(&stderr);
        println!("[Rust] Video duration extracted: {:?}", duration);

        let video_path_str = video_path.to_string_lossy().to_string();

        // For Kick VODs, try stream copy first (fast), fall back to encoding if it fails
        let download_result = run_full_download_with_encoder(
            &app_clone,
            &download_id_clone,
            &video_url,
            &video_path_str,
            duration,
            "copy", // Try copy first for Kick
            true,   // use_copy_codec = true
            &mut cancel_rx,
        ).await;

        // If copy failed, try with software encoding
        let download_result = match download_result {
            Err(ref e) => {
                println!("[Rust] Stream copy failed: {}. Retrying with software encoding...", e);
                run_full_download_with_encoder(
                    &app_clone,
                    &download_id_clone,
                    &video_url,
                    &video_path_str,
                    duration,
                    "libx264",
                    false,
                    &mut cancel_rx,
                ).await
            }
            other => other,
        };

        // Check result
        download_result?;

        // Check for cancellation before post-processing
        if cancel_rx.try_recv().is_ok() {
            println!("[Rust] Download cancelled before post-processing");
            let _ = std::fs::remove_file(&video_path);
            return Err("Download cancelled".to_string());
        }

        println!("[Rust] Download completed successfully");

        // Get file metadata
        let metadata = match std::fs::metadata(&video_path) {
            Ok(meta) => meta,
            Err(e) => return Err(format!("Failed to get file metadata: {}", e))
        };
        let file_size = metadata.len();

        // Check for cancellation before thumbnail generation
        if cancel_rx.try_recv().is_ok() {
            println!("[Rust] Download cancelled before thumbnail generation");
            let _ = std::fs::remove_file(&video_path);
            return Err("Download cancelled".to_string());
        }

        // Generate thumbnail
        println!("[Rust] Generating thumbnail...");
        let thumbnail_path = paths.thumbnails.join(format!("{}_thumb.jpg", filename.replace(".mp4", "")));
        let thumbnail_result = match shell.sidecar("ffmpeg") {
            Ok(ffmpeg) => {
                (ffmpeg.args([
                    "-ss", "00:00:05",
                    "-i", video_path.to_str().ok_or("Invalid video path")?,
                    "-vframes", "1",
                    "-vf", "scale=320:-1",
                    "-y",
                    thumbnail_path.to_str().ok_or("Invalid thumbnail path")?,
                ]).output().await).ok()
            }
            Err(_) => None
        };

        let thumbnail_path_str = if let Some(ref result) = thumbnail_result {
            if result.status.success() {
                Some(thumbnail_path.to_string_lossy().to_string())
            } else {
                None
            }
        } else {
            None
        };

        // Check for cancellation before video info extraction
        if cancel_rx.try_recv().is_ok() {
            println!("[Rust] Download cancelled before video info extraction");
            let _ = std::fs::remove_file(&video_path);
            if let Some(ref thumb_path) = thumbnail_path_str {
                let _ = std::fs::remove_file(thumb_path);
            }
            return Err("Download cancelled".to_string());
        }

        // Get video dimensions, codec info, and actual duration from downloaded file
        println!("[Rust] Getting detailed video info...");
        let video_info = get_video_info(&app_clone, &video_path).await.ok();
        let (width, height, codec, actual_file_duration) = if let Some(ref info) = video_info {
            println!("[Rust] Video info - width: {}, height: {}, codec: {}, duration: {:?}", info.width, info.height, info.codec, info.duration);
            (Some(info.width), Some(info.height), Some(info.codec.clone()), info.duration)
        } else {
            (None, None, None, None)
        };

        // Prefer the actual file duration over the estimated duration from stream info
        let final_duration = actual_file_duration.or(duration);

        println!("[Rust] Download task completed successfully");
        Ok(DownloadResult {
            download_id: download_id_clone,
            success: true,
            file_path: Some(video_path.to_string_lossy().to_string()),
            thumbnail_path: thumbnail_path_str,
            duration: final_duration,
            width,
            height,
            codec,
            file_size: Some(file_size),
            error: None,
        })
    }).await;

    println!("[Rust] Async task completed");

    cleanup_download();

    println!("[Rust] Processing download result...");
    match result {
        Ok(Ok(download_result)) => {
            println!("[Rust] Download successful!");

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
            println!("[Rust] Download failed: {}", error_msg);

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
            println!("[Rust] Download task failed: {}", error_msg);

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

            Err(format!("Download task failed: {}", e))
        }
    }
}
