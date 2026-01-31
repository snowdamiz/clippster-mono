use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
};

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tokio::sync::oneshot;

use tauri::{Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use crate::storage;

#[derive(Debug, Deserialize)]
struct RecorderEvent {
    #[serde(rename = "type")]
    event_type: String,
    segment: Option<u32>,
    path: Option<String>,
    duration: Option<f64>,
    message: Option<String>,
    #[serde(flatten)]
    #[allow(dead_code)]
    extra: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HlsRecordingResult {
    pub session_id: String,
    pub output_dir: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HlsSegmentInfo {
    pub segment_number: u32,
    pub file_path: String,
    pub start_time: f64,
    pub duration: f64,
    pub end_time: f64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SegmentReadyPayload {
    streamer_id: String,
    session_id: String,
    mint_id: String,
    segment: u32,
    path: String,
    duration: f64,
}

#[derive(Debug)]
struct HlsRecordingEntry {
    stop_tx: Option<oneshot::Sender<()>>,
    #[allow(dead_code)] // Kept alive to prevent task cancellation
    task: tokio::task::JoinHandle<()>,
    output_dir: PathBuf,
}

static HLS_RECORDINGS: Lazy<Arc<Mutex<HashMap<String, HlsRecordingEntry>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

fn resolve_service_script(app: &tauri::AppHandle, script_name: &str) -> Result<String, String> {
    use tauri::path::BaseDirectory;
    
    // Try resolving via Tauri resource API first (Production & Correct Dev)
    if let Ok(path) = app.path().resolve(format!("pumpfun-service/{}", script_name), BaseDirectory::Resource) {
        if path.exists() {
            return Ok(path.to_string_lossy().to_string());
        }
    }

    // Fallback: Try locating relative to executable (Old Dev Logic)
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;
    
    let exe_dir = exe_path
        .parent()
        .ok_or("Failed to get parent directory")?;

    // Try various dev paths
    let candidate_paths = vec![
        exe_dir.join("pumpfun-service").join(script_name),
        exe_dir.parent().and_then(|p| p.parent()).map(|p| p.join("pumpfun-service").join(script_name)).unwrap_or(PathBuf::from("")),
        PathBuf::from("pumpfun-service").join(script_name),
    ];

    for path in candidate_paths {
        if path.exists() && path.file_name().is_some() {
            return Ok(path.to_string_lossy().to_string());
        }
    }

    Err(format!("Could not find service script: {}", script_name))
}

/// Start HLS recording for a livestream
/// This starts the Node.js recorder which outputs HLS format (.ts segments + .m3u8 playlist)
/// If resume_dir is provided, it will continue recording to that directory instead of creating a new one
#[tauri::command]
pub async fn start_hls_recording(
    app: tauri::AppHandle,
    mint_id: String,
    streamer_id: String,
    _display_name: String,
    resume_dir: Option<String>,
) -> Result<HlsRecordingResult, String> {
    // Check if already recording
    {
        let recordings = HLS_RECORDINGS.lock().unwrap();
        if recordings.contains_key(&mint_id) {
            // Return existing recording info
            if let Some(entry) = recordings.get(&mint_id) {
                return Ok(HlsRecordingResult {
                    session_id: mint_id.clone(),
                    output_dir: entry.output_dir.to_string_lossy().to_string(),
                });
            }
        }
    }

    let storage_paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to initialize storage: {}", e))?;

    // Use resume_dir if provided, otherwise create a new unique session
    let (session_id, output_dir) = if let Some(ref resume_path) = resume_dir {
        // Extract session_id from the resume path (last component)
        let path = std::path::Path::new(resume_path);
        let session = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&format!("hls_{}_{}", mint_id, chrono::Utc::now().timestamp()))
            .to_string();
        println!("[HLS] Resuming recording in existing directory: {}", resume_path);
        (session, std::path::PathBuf::from(resume_path))
    } else {
        // Create unique session ID and new directory
        let session = format!("hls_{}_{}", mint_id, chrono::Utc::now().timestamp());
        let dir = storage_paths
            .videos
            .join("hls_live")
            .join(&mint_id)
            .join(&session);
        (session, dir)
    };
    
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create output directory: {}", e))?;

    let script_path = resolve_service_script(&app, "record-livestream.mjs")?;
    let output_str = output_dir
        .to_str()
        .ok_or("Invalid output directory path")?
        .to_string();

    let (stop_tx, stop_rx) = oneshot::channel();

    let app_handle = app.clone();
    let mint_clone = mint_id.clone();
    let streamer_clone = streamer_id.clone();
    let session_clone = session_id.clone();
    let output_dir_clone = output_dir.clone();

    let task = tokio::spawn(async move {
        if let Err(err) = run_hls_recorder(
            app_handle,
            script_path,
            mint_clone,
            streamer_clone,
            session_clone,
            output_dir_clone.to_string_lossy().to_string(),
            stop_rx,
        )
        .await
        {
            eprintln!("[HLS Recorder] {}", err);
        }
    });

    let result = HlsRecordingResult {
        session_id: session_id.clone(),
        output_dir: output_str.clone(),
    };

    HLS_RECORDINGS.lock().unwrap().insert(
        mint_id,
        HlsRecordingEntry {
            stop_tx: Some(stop_tx),
            task,
            output_dir,
        },
    );

    Ok(result)
}

/// Stop HLS recording for a stream
#[tauri::command]
pub async fn stop_hls_recording(mint_id: String) -> Result<(), String> {
    let entry = {
        let mut recordings = HLS_RECORDINGS.lock().unwrap();
        recordings.remove(&mint_id)
    };

    if let Some(entry) = entry {
        if let Some(tx) = entry.stop_tx {
            let _ = tx.send(());
        }
        // Wait briefly for process to clean up
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }

    Ok(())
}

/// Cleanup all HLS recordings for a streamer (stop recording + delete files)
#[tauri::command]
pub async fn cleanup_hls_recordings(mint_id: String) -> Result<(), String> {
    // First stop any active recording
    let entry = {
        let mut recordings = HLS_RECORDINGS.lock().unwrap();
        recordings.remove(&mint_id)
    };

    if let Some(entry) = entry {
        if let Some(tx) = entry.stop_tx {
            let _ = tx.send(());
        }
        // Wait briefly for process to clean up
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }

    // Delete all HLS files for this mint
    let storage_paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to initialize storage: {}", e))?;
    
    let hls_dir = storage_paths.videos.join("hls_live").join(&mint_id);
    
    if hls_dir.exists() {
        tokio::fs::remove_dir_all(&hls_dir)
            .await
            .map_err(|e| format!("Failed to delete HLS recordings: {}", e))?;
        
        println!("[HLS] Cleaned up recordings for mint: {}", mint_id);
    }

    Ok(())
}

/// Get the output directory for a recording session
#[tauri::command]
pub fn get_recording_output_dir(session_id: String) -> Result<String, String> {
    // Look through active recordings to find matching session
    let recordings = HLS_RECORDINGS.lock().unwrap();
    
    for (_, entry) in recordings.iter() {
        if entry.output_dir.to_string_lossy().contains(&session_id) {
            return Ok(entry.output_dir.to_string_lossy().to_string());
        }
    }
    
    Err(format!("No recording found for session: {}", session_id))
}

/// Get HLS segment info from the playlist
#[tauri::command]
pub async fn get_hls_segments(output_dir: String) -> Result<Vec<HlsSegmentInfo>, String> {
    // Prefer finalized playlist, but fall back to the temp file while ffmpeg is writing
    let playlist_path = PathBuf::from(&output_dir).join("playlist.m3u8");
    let playlist_tmp_path = PathBuf::from(&output_dir).join("playlist.m3u8.tmp");
    
    let playlist_to_use = if playlist_path.exists() {
        playlist_path
    } else if playlist_tmp_path.exists() {
        playlist_tmp_path
    } else {
        return Ok(Vec::new());
    };

    let content = tokio::fs::read_to_string(&playlist_to_use)
        .await
        .map_err(|e| format!("Failed to read playlist: {}", e))?;

    let mut segments = Vec::new();
    let mut current_duration: f64 = 0.0;
    let mut first_duration: f64 = 0.0;
    let mut cumulative_time: f64 = 0.0;
    let mut segment_number: u32 = 0;
    let mut media_sequence: u32 = 0;

    for line in content.lines() {
        let line = line.trim();
        
        // Handle sliding window playlists by tracking media sequence
        if line.starts_with("#EXT-X-MEDIA-SEQUENCE:") {
            if let Some(seq_str) = line.strip_prefix("#EXT-X-MEDIA-SEQUENCE:") {
                media_sequence = seq_str.parse().unwrap_or(0);
            }
            continue;
        }

        // Parse duration from EXTINF tag
        if line.starts_with("#EXTINF:") {
            if let Some(duration_str) = line.strip_prefix("#EXTINF:") {
                // Remove trailing comma and any title
                let duration_str = duration_str.split(',').next().unwrap_or("0");
                current_duration = duration_str.parse().unwrap_or(4.0);
                if first_duration == 0.0 {
                    first_duration = current_duration;
                }
            }
            continue;
        }
        
        // Skip other tags
        if line.starts_with('#') || line.is_empty() {
            continue;
        }
        
        // This is a segment filename
        if line.ends_with(".ts") {
            let segment_path = PathBuf::from(&output_dir).join(line);
            
            // Seed cumulative_time using media_sequence for sliding playlists
            if segment_number == 0 && media_sequence > 0 && cumulative_time == 0.0 {
                let dur = if first_duration > 0.0 { first_duration } else { current_duration.max(0.001) };
                cumulative_time = dur * media_sequence as f64;
            }

            segments.push(HlsSegmentInfo {
                segment_number: media_sequence + segment_number,
                file_path: segment_path.to_string_lossy().to_string(),
                start_time: cumulative_time,
                duration: current_duration,
                end_time: cumulative_time + current_duration,
            });
            
            cumulative_time += current_duration;
            segment_number += 1;
        }
    }

    // Fallback: if the parsed playlist yields <= 1 segment but the directory
    // contains multiple TS files (e.g., tmp playlist not finalized or short sliding window),
    // synthesize a contiguous timeline from the files on disk.
    if segments.len() <= 1 {
        let mut entries: Vec<_> = std::fs::read_dir(&output_dir)
            .map_err(|e| format!("Failed to read HLS output dir: {}", e))?
            .filter_map(|e| e.ok())
            .filter(|e| {
                if let Ok(name) = e.file_name().into_string() {
                    name.starts_with("segment_") && name.ends_with(".ts")
                } else {
                    false
                }
            })
            .collect();

        entries.sort_by_key(|e| e.file_name());

        if entries.len() > 1 {
            let assumed_duration = if first_duration > 0.0 {
                first_duration
            } else if current_duration > 0.0 {
                current_duration
            } else {
                4.0
            };

            let mut fallback_segments = Vec::with_capacity(entries.len());
            let mut start = 0.0;
            for (idx, entry) in entries.iter().enumerate() {
                let path = entry.path();
                fallback_segments.push(HlsSegmentInfo {
                    segment_number: idx as u32,
                    file_path: path.to_string_lossy().to_string(),
                    start_time: start,
                    duration: assumed_duration,
                    end_time: start + assumed_duration,
                });
                start += assumed_duration;
            }

            if fallback_segments.len() > segments.len() {
                segments = fallback_segments;
            }
        }
    }

    Ok(segments)
}

/// Run the HLS recorder process
async fn run_hls_recorder(
    app: tauri::AppHandle,
    script_path: String,
    mint_id: String,
    streamer_id: String,
    session_id: String,
    output_dir: String,
    mut stop_rx: oneshot::Receiver<()>,
) -> Result<(), String> {
    use tauri_plugin_shell::process::CommandEvent;

    println!("[HLS Recorder] Starting for mint: {}", mint_id);
    println!("[HLS Recorder] Script path: {}", script_path);
    println!("[HLS Recorder] Output directory: {}", output_dir);
    println!("[HLS Recorder] Session ID: {}", session_id);

    // Script expects: record-livestream.mjs <mintId> <sessionId> <outputDir> [segmentMinutes]
    // For HLS, we pass "0" as segment minutes to signal HLS mode with short segments
    let args = [
        script_path.as_str(),
        mint_id.as_str(),
        session_id.as_str(),
        output_dir.as_str(),
        "0", // Special value: 0 means HLS mode with short segments (4 seconds)
    ];
    println!("[HLS Recorder] Spawning with args: {:?}", args);
    
    let (mut rx, mut child) = app
        .shell()
        .sidecar("node")
        .map_err(|e| format!("Failed to create node sidecar: {}", e))?
        .args(args)
        .spawn()
        .map_err(|e| format!("Failed to spawn recorder: {}", e))?;
    
    println!("[HLS Recorder] Process spawned successfully, PID: {:?}", child.pid());

    let mint_for_cleanup = mint_id.clone();
    let mut stopping = false;
    let mut kill_timer = Box::pin(tokio::time::sleep(tokio::time::Duration::from_secs(3600 * 24)));

    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Some(CommandEvent::Stdout(line)) => {
                        let line_str = String::from_utf8_lossy(&line);
                        
                        // Log ALL stdout for debugging
                        println!("[HLS Recorder stdout] {}", line_str.trim());
                        
                        // Try to parse as JSON event
                        for chunk in line_str.split('\n') {
                            if chunk.trim().is_empty() {
                                continue;
                            }
                            if let Ok(recorder_event) = serde_json::from_str::<RecorderEvent>(chunk) {
                                match recorder_event.event_type.as_str() {
                                    "segment_complete" => {
                                        println!("[HLS Recorder] Segment complete: {:?}", recorder_event.segment);
                                        if let (Some(segment), Some(path), Some(duration)) = 
                                            (recorder_event.segment, recorder_event.path, recorder_event.duration) 
                                        {
                                            let payload = SegmentReadyPayload {
                                                streamer_id: streamer_id.clone(),
                                                session_id: session_id.clone(),
                                                mint_id: mint_id.clone(),
                                                segment,
                                                path: path.clone(),
                                                duration,
                                            };
                                            
                                            match app.emit("hls-segment-ready", payload) {
                                                Ok(_) => println!("[HLS Recorder] Emitted hls-segment-ready event for segment {}", segment),
                                                Err(e) => eprintln!("[HLS Recorder] Failed to emit hls-segment-ready: {:?}", e),
                                            }
                                        }
                                    }
                                    "started" => {
                                        println!("[HLS Recorder] Recording started for {}", mint_id);
                                    }
                                    "stream_ended" => {
                                        println!("[HLS Recorder] Stream ended for {}", mint_id);
                                    }
                                    "info" | "error" => {
                                        println!("[HLS Recorder] {}: {:?}", recorder_event.event_type, recorder_event.message);
                                    }
                                    _ => {
                                        println!("[HLS Recorder] Event: {}", recorder_event.event_type);
                                    }
                                }
                            }
                        }
                    }
                    Some(CommandEvent::Stderr(line)) => {
                        let line_str = String::from_utf8_lossy(&line);
                        eprintln!("[HLS Recorder stderr] {}", line_str.trim());
                    }
                    Some(CommandEvent::Terminated(payload)) => {
                        println!("[HLS Recorder] Process terminated: {:?}", payload.code);
                        break;
                    }
                    Some(CommandEvent::Error(err)) => {
                        eprintln!("[HLS Recorder] Process error: {}", err);
                    }
                    None => {
                        println!("[HLS Recorder] Event channel closed");
                        break;
                    }
                    _ => {}
                }
            }
            // Handle stop signal
            _ = &mut stop_rx, if !stopping => {
                println!("[HLS Recorder] Stop signal received, sending graceful STOP command...");
                
                // Try to write to stdin for graceful shutdown
                if let Err(e) = child.write(b"STOP\n") {
                    eprintln!("[HLS Recorder] Failed to write to stdin: {}, falling back to kill", e);
                    if let Err(err) = child.kill() {
                        eprintln!("[HLS Recorder] Failed to kill child: {}", err);
                    }
                    break;
                }
                
                stopping = true;
                // Set kill timer to 15 seconds for graceful shutdown
                kill_timer = Box::pin(tokio::time::sleep(tokio::time::Duration::from_secs(15)));
            }
            // Handle kill timeout
            _ = &mut kill_timer, if stopping => {
                println!("[HLS Recorder] Graceful stop timed out, forcing kill...");
                if let Err(err) = child.kill() {
                    eprintln!("[HLS Recorder] Failed to kill child: {}", err);
                }
                break;
            }
        }
    }

    // Cleanup
    {
        let mut recordings = HLS_RECORDINGS.lock().unwrap();
        recordings.remove(&mint_for_cleanup);
    }

    Ok(())
}

