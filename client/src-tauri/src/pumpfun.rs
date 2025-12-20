use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
};

use once_cell::sync::Lazy;
use serde::Deserialize;
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
    extra: std::collections::HashMap<String, serde_json::Value>,
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

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RecorderLogPayload {
    streamer_id: String,
    mint_id: String,
    message: String,
    level: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct StreamEndedPayload {
    streamer_id: String,
    session_id: String,
    mint_id: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RecorderExitPayload {
    streamer_id: String,
    session_id: String,
    mint_id: String,
    code: Option<i32>,
}

// Temp recording specific payloads (for watch-only DVR)
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TempSegmentReadyPayload {
    mint_id: String,
    temp_session_id: String,
    segment: u32,
    path: String,
    duration: f64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TempRecorderExitPayload {
    mint_id: String,
    temp_session_id: String,
    code: Option<i32>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TempStreamEndedPayload {
    mint_id: String,
    temp_session_id: String,
}

// HLS-specific payload for DVR (includes playlist path for instant seek)
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TempHlsSegmentPayload {
    mint_id: String,
    temp_session_id: String,
    segment: u32,
    path: String,
    duration: f64,
    playlist_path: String,
    total_segments: u32,
    total_duration: f64,
}

#[derive(Debug)]
struct RecordingEntry {
    stop_tx: Option<oneshot::Sender<()>>,
    task: tokio::task::JoinHandle<()>,
}

// Temp recording entry with session info for DVR
struct TempRecordingEntry {
    stop_tx: Option<oneshot::Sender<()>>,
    task: tokio::task::JoinHandle<()>,
    session_id: String,
    output_dir: String,
}

static ACTIVE_RECORDINGS: Lazy<Arc<Mutex<HashMap<String, RecordingEntry>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Separate tracking for temp recordings (used for watch-only DVR)
static ACTIVE_TEMP_RECORDINGS: Lazy<Arc<Mutex<HashMap<String, TempRecordingEntry>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("Clippster/1.0")
        .build()
        .expect("Failed to build reqwest client")
});

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

#[tauri::command]
pub async fn get_pumpfun_clips(app: tauri::AppHandle, mint_id: String, limit: Option<u32>) -> Result<String, String> {
    let limit_str = limit.unwrap_or(20).to_string();
    let script_path = resolve_service_script(&app, "fetch-clips.mjs")?;

    let output = app.shell()
        .sidecar("node")
        .map_err(|e| format!("Failed to create node sidecar: {}. Make sure Node.js is installed or bundled.", e))?
        .args([
            &script_path,
            &mint_id,
            &limit_str
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to execute Node.js script: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("PumpFun API error: {}", stderr))
    }
}

#[tauri::command]
pub async fn check_pumpfun_livestream(mint_id: String) -> Result<String, String> {
    let url = format!(
        "https://livestream-api.pump.fun/livestream?mintId={}",
        mint_id
    );

    let response = HTTP_CLIENT
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    Ok(body)
}

#[tauri::command]
pub async fn join_pumpfun_livestream(mint_id: String) -> Result<String, String> {
    let url = "https://livestream-api.pump.fun/livestream/join";

    let response = HTTP_CLIENT
        .post(url)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "mintId": mint_id,
            "viewer": true
        }))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Join failed with status: {}", response.status()));
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    Ok(body)
}

#[tauri::command]
pub async fn get_livekit_regions(token: String) -> Result<String, String> {
    let url = "https://pump-prod-tg2x8veh.livekit.cloud/settings/regions";

    let response = HTTP_CLIENT
        .get(url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to get regions: {}", response.status()));
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    Ok(body)
}

#[tauri::command]
pub async fn start_livestream_recording(
    app: tauri::AppHandle,
    mint_id: String,
    streamer_id: String,
    session_id: String,
    segment_duration_minutes: Option<u32>,
) -> Result<(), String> {
    {
        let recordings = ACTIVE_RECORDINGS.lock().unwrap();
        if recordings.contains_key(&mint_id) {
            return Err("Recording already active for this mint".to_string());
        }
    }

    let storage_paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to initialize storage: {}", e))?;

    let output_dir = storage_paths
        .videos
        .join("pumpfun_live")
        .join(&mint_id)
        .join(&session_id);
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
    let segment_duration = segment_duration_minutes.unwrap_or(5); // Default to 5 minutes

    let task = tokio::spawn(async move {
        if let Err(err) = run_recorder_process(
            app_handle,
            script_path,
            mint_clone,
            streamer_clone,
            session_clone,
            output_str,
            segment_duration,
            stop_rx,
        )
        .await
        {
            eprintln!("[Recorder] {}", err);
        }
    });

    ACTIVE_RECORDINGS.lock().unwrap().insert(
        mint_id,
        RecordingEntry {
            stop_tx: Some(stop_tx),
            task,
        },
    );

    Ok(())
}

pub fn get_active_recordings_count() -> usize {
    ACTIVE_RECORDINGS.lock().unwrap().len()
}

pub async fn stop_all_recordings() {
    let mut recordings = ACTIVE_RECORDINGS.lock().unwrap();
    for (_, entry) in recordings.drain() {
        if let Some(tx) = entry.stop_tx {
            let _ = tx.send(());
        }
        // We can't easily await the tasks here because they are spawned, 
        // but sending the signal should trigger the cleanup in the task.
    }
}

#[tauri::command]
pub async fn stop_all_livestream_recordings() -> Result<(), String> {
    stop_all_recordings().await;
    Ok(())
}

#[tauri::command]
pub async fn stop_livestream_recording(mint_id: String) -> Result<(), String> {
    let entry = ACTIVE_RECORDINGS.lock().unwrap().remove(&mint_id);
    if let Some(entry) = entry {
        if let Some(tx) = entry.stop_tx {
            let _ = tx.send(());
        }
        if let Err(err) = entry.task.await {
            eprintln!("[Recorder] Join error: {}", err);
        }
    }
    Ok(())
}

// ==========================================
// TEMP RECORDING COMMANDS (for Watch-only DVR)
// ==========================================

/// Response struct for temp recording start/info
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TempRecordingInfo {
    pub session_id: String,
    pub output_dir: String,
    pub already_active: bool,
}

/// Start a temporary livestream recording for watch-only DVR functionality.
/// This saves to the temp directory and will be cleaned up when the stream ends or dialog closes.
/// Uses HLS format with short segments for instant DVR capability.
/// Returns existing session info if already recording (not an error).
#[tauri::command]
pub async fn start_temp_livestream_recording(
    app: tauri::AppHandle,
    mint_id: String,
    segment_duration_seconds: Option<u32>,
) -> Result<TempRecordingInfo, String> {
    // Check if we already have a temp recording for this mint - return existing info
    {
        let recordings = ACTIVE_TEMP_RECORDINGS.lock().unwrap();
        if let Some(entry) = recordings.get(&mint_id) {
            println!("[TempRecorder] Returning existing session for {}: {}", mint_id, entry.session_id);
            return Ok(TempRecordingInfo {
                session_id: entry.session_id.clone(),
                output_dir: entry.output_dir.clone(),
                already_active: true,
            });
        }
    }
    
    // Also check if there's a persistent recording - in that case, don't start temp
    {
        let recordings = ACTIVE_RECORDINGS.lock().unwrap();
        if recordings.contains_key(&mint_id) {
            return Err("Persistent recording already active - use that instead".to_string());
        }
    }

    let storage_paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to initialize storage: {}", e))?;

    // Generate a simple timestamp-based session ID for temp recordings
    let temp_session_id = format!("temp_{}", chrono::Utc::now().timestamp_millis());
    
    // Store in temp directory instead of videos
    let output_dir = storage_paths
        .temp
        .join("pumpfun_live")
        .join(&mint_id);
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create temp output directory: {}", e))?;

    let script_path = resolve_service_script(&app, "record-livestream.mjs")?;
    let output_str = output_dir
        .to_str()
        .ok_or("Invalid output directory path")?
        .to_string();

    let (stop_tx, stop_rx) = oneshot::channel();

    let app_handle = app.clone();
    let mint_clone = mint_id.clone();
    let session_clone = temp_session_id.clone();
    let output_clone = output_str.clone();
    // Default to 4 seconds for HLS DVR (instant rewind capability)
    let segment_duration = segment_duration_seconds.unwrap_or(4);

    let task = tokio::spawn(async move {
        if let Err(err) = run_temp_recorder_process(
            app_handle,
            script_path,
            mint_clone,
            session_clone,
            output_clone,
            segment_duration,
            "hls".to_string(), // Use HLS format for temp recordings
            stop_rx,
        )
        .await
        {
            eprintln!("[TempRecorder] {}", err);
        }
    });

    ACTIVE_TEMP_RECORDINGS.lock().unwrap().insert(
        mint_id.clone(),
        TempRecordingEntry {
            stop_tx: Some(stop_tx),
            task,
            session_id: temp_session_id.clone(),
            output_dir: output_str.clone(),
        },
    );

    println!("[TempRecorder] Started HLS temp recording for {} with session {} ({}s segments)", mint_id, temp_session_id, segment_duration);
    Ok(TempRecordingInfo {
        session_id: temp_session_id,
        output_dir: output_str,
        already_active: false,
    })
}

/// Get info about an existing temp recording
#[tauri::command]
pub fn get_temp_recording_info(mint_id: String) -> Option<TempRecordingInfo> {
    let recordings = ACTIVE_TEMP_RECORDINGS.lock().unwrap();
    recordings.get(&mint_id).map(|entry| TempRecordingInfo {
        session_id: entry.session_id.clone(),
        output_dir: entry.output_dir.clone(),
        already_active: true,
    })
}

/// Stop a temporary livestream recording
#[tauri::command]
pub async fn stop_temp_livestream_recording(mint_id: String) -> Result<(), String> {
    let entry = ACTIVE_TEMP_RECORDINGS.lock().unwrap().remove(&mint_id);
    if let Some(entry) = entry {
        if let Some(tx) = entry.stop_tx {
            let _ = tx.send(());
        }
        if let Err(err) = entry.task.await {
            eprintln!("[TempRecorder] Join error: {}", err);
        }
        println!("[TempRecorder] Stopped temp recording for {}", mint_id);
    }
    Ok(())
}

/// Check if a temp recording is active for a mint
#[tauri::command]
pub fn is_temp_recording_active(mint_id: String) -> bool {
    ACTIVE_TEMP_RECORDINGS.lock().unwrap().contains_key(&mint_id)
}

/// Get the temp recording directory path for a mint
#[tauri::command]
pub fn get_temp_recording_path(mint_id: String) -> Result<String, String> {
    let storage_paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to initialize storage: {}", e))?;
    
    let temp_dir = storage_paths.temp.join("pumpfun_live").join(&mint_id);
    Ok(temp_dir.to_string_lossy().to_string())
}

/// Cleanup (delete) temp recording files for a given mint
#[tauri::command]
pub async fn cleanup_temp_recording(mint_id: String) -> Result<(), String> {
    // First, stop any active temp recording
    stop_temp_livestream_recording(mint_id.clone()).await?;
    
    // Then delete the temp directory
    let storage_paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to initialize storage: {}", e))?;
    
    let temp_dir = storage_paths.temp.join("pumpfun_live").join(&mint_id);
    
    if temp_dir.exists() {
        std::fs::remove_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to delete temp recording directory: {}", e))?;
        println!("[TempRecorder] Cleaned up temp recording directory for {}", mint_id);
    }
    
    Ok(())
}

/// Stop all temp recordings (called on app shutdown)
pub async fn stop_all_temp_recordings() {
    let mut recordings = ACTIVE_TEMP_RECORDINGS.lock().unwrap();
    for (mint_id, entry) in recordings.drain() {
        println!("[TempRecorder] Stopping temp recording for {}", mint_id);
        if let Some(tx) = entry.stop_tx {
            let _ = tx.send(());
        }
    }
}

/// Run the temp recorder process (similar to persistent but emits temp-specific events)
/// Uses HLS format for instant DVR capability
async fn run_temp_recorder_process(
    app: tauri::AppHandle,
    script_path: String,
    mint_id: String,
    temp_session_id: String,
    output_dir: String,
    segment_duration_seconds: u32,
    output_format: String,
    mut stop_rx: oneshot::Receiver<()>,
) -> Result<(), String> {
    use tauri_plugin_shell::process::CommandEvent;

    let segment_duration_str = segment_duration_seconds.to_string();

    // Spawn Node sidecar with HLS format
    // Args: mintId, sessionId, outputDir, segmentSeconds, outputFormat
    let (mut rx, mut child) = app.shell()
        .sidecar("node")
        .map_err(|e| format!("Failed to create node sidecar: {}", e))?
        .args([
            &script_path,
            &mint_id,
            &temp_session_id,
            &output_dir,
            &segment_duration_str,
            &output_format,
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn temp recorder sidecar: {}", e))?;

    println!("[TempRecorder] Started Node sidecar with PID: {:?} (format: {}, segment: {}s)", child.pid(), output_format, segment_duration_seconds);

    let mut stopping = false;
    let mut kill_timer = Box::pin(tokio::time::sleep(tokio::time::Duration::from_secs(3600 * 24)));

    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Some(CommandEvent::Stdout(line_bytes)) => {
                        let line = String::from_utf8_lossy(&line_bytes).to_string();
                        for chunk in line.split('\n') {
                            if !chunk.trim().is_empty() {
                                handle_temp_recorder_line(&app, &mint_id, &temp_session_id, chunk.to_string());
                            }
                        }
                    }
                    Some(CommandEvent::Stderr(line_bytes)) => {
                        let line = String::from_utf8_lossy(&line_bytes);
                        eprintln!("[TempRecorder stderr] {}", line);
                    }
                    Some(CommandEvent::Terminated(payload)) => {
                        println!("[TempRecorder] Process terminated with code: {:?}", payload.code);
                        let exit_payload = TempRecorderExitPayload {
                            mint_id: mint_id.to_string(),
                            temp_session_id: temp_session_id.to_string(),
                            code: payload.code,
                        };
                        let _ = app.emit("temp-recorder-exit", exit_payload);
                        break;
                    }
                    Some(CommandEvent::Error(err)) => {
                        eprintln!("[TempRecorder] Process error: {}", err);
                    }
                    None => {
                        println!("[TempRecorder] Event channel closed");
                        break;
                    }
                    _ => {}
                }
            }
            _ = &mut stop_rx, if !stopping => {
                println!("[TempRecorder] Stop signal received, sending graceful STOP command...");
                
                if let Err(e) = child.write(b"STOP\n") {
                    eprintln!("[TempRecorder] Failed to write to stdin: {}, falling back to kill", e);
                    if let Err(err) = child.kill() {
                        eprintln!("[TempRecorder] Failed to kill child: {}", err);
                    }
                    break;
                }
                
                stopping = true;
                kill_timer = Box::pin(tokio::time::sleep(tokio::time::Duration::from_secs(30)));
            }
            _ = &mut kill_timer, if stopping => {
                println!("[TempRecorder] Graceful stop timed out, forcing kill...");
                if let Err(err) = child.kill() {
                    eprintln!("[TempRecorder] Failed to kill child: {}", err);
                }
                break;
            }
        }
    }

    Ok(())
}

/// Handle output lines from temp recorder (emits temp-specific events)
/// For HLS recordings, emits both segment events and HLS-specific events with playlist info
fn handle_temp_recorder_line(
    app: &tauri::AppHandle,
    mint_id: &str,
    temp_session_id: &str,
    content: String,
) {
    // Track total duration for HLS segments
    static TEMP_TOTAL_DURATION: std::sync::LazyLock<std::sync::Mutex<std::collections::HashMap<String, f64>>> = 
        std::sync::LazyLock::new(|| std::sync::Mutex::new(std::collections::HashMap::new()));
    
    if content.trim().is_empty() {
        return;
    }

    match serde_json::from_str::<RecorderEvent>(&content) {
        Ok(event) => match event.event_type.as_str() {
            "segment_complete" => {
                if let (Some(segment), Some(path)) = (event.segment, event.path) {
                    let duration = event.duration.unwrap_or(4.0); // 4 sec default for HLS
                    let payload = TempSegmentReadyPayload {
                        mint_id: mint_id.to_string(),
                        temp_session_id: temp_session_id.to_string(),
                        segment,
                        path,
                        duration,
                    };
                    let _ = app.emit("temp-segment-ready", payload);
                }
            }
            "hls_segment" => {
                // HLS-specific event with playlist path for DVR
                if let (Some(segment), Some(path)) = (event.segment, event.path.clone()) {
                    let duration = event.duration.unwrap_or(4.0);
                    let total_segments = event.extra.get("totalSegments")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(segment as u64) as u32;
                    let playlist_path = event.extra.get("playlistPath")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    
                    // Update total duration
                    let mut durations = TEMP_TOTAL_DURATION.lock().unwrap();
                    let total_duration = durations.entry(mint_id.to_string()).or_insert(0.0);
                    *total_duration += duration;
                    
                    let payload = TempHlsSegmentPayload {
                        mint_id: mint_id.to_string(),
                        temp_session_id: temp_session_id.to_string(),
                        segment,
                        path,
                        duration,
                        playlist_path,
                        total_segments,
                        total_duration: *total_duration,
                    };
                    let _ = app.emit("temp-hls-segment", payload);
                }
            }
            "stream_ended" => {
                let payload = TempStreamEndedPayload {
                    mint_id: mint_id.to_string(),
                    temp_session_id: temp_session_id.to_string(),
                };
                let _ = app.emit("temp-stream-ended", payload);
                
                // Clean up duration tracking
                let mut durations = TEMP_TOTAL_DURATION.lock().unwrap();
                durations.remove(mint_id);
            }
            "log" => {
                // Just log to console for temp recordings, don't emit to frontend activity log
                if let Some(msg) = &event.message {
                    println!("[TempRecorder][{}] {}", mint_id, msg);
                }
            }
            _ => {}
        },
        Err(_) => {
            println!("[TempRecorder] {}", content);
        }
    }
}

async fn run_recorder_process(
    app: tauri::AppHandle,
    script_path: String,
    mint_id: String,
    streamer_id: String,
    session_id: String,
    output_dir: String,
    segment_duration_minutes: u32,
    mut stop_rx: oneshot::Receiver<()>,
) -> Result<(), String> {
    use tauri_plugin_shell::process::CommandEvent;

    let segment_duration_str = segment_duration_minutes.to_string();

    // Spawn Node sidecar
    let (mut rx, mut child) = app.shell()
        .sidecar("node")
        .map_err(|e| format!("Failed to create node sidecar: {}", e))?
        .args([
            &script_path,
            &mint_id,
            &session_id,
            &output_dir,
            &segment_duration_str,
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn recorder sidecar: {}", e))?;

    println!("[Recorder] Started Node sidecar with PID: {:?}", child.pid());

    let mut stopping = false;
    let mut kill_timer = Box::pin(tokio::time::sleep(tokio::time::Duration::from_secs(3600 * 24)));

    loop {
        tokio::select! {
            // Handle sidecar events (stdout/stderr)
            event = rx.recv() => {
                match event {
                    Some(CommandEvent::Stdout(line_bytes)) => {
                        let line = String::from_utf8_lossy(&line_bytes).to_string();
                        // Handle partial lines if needed, but for now assume line-buffered or JSON chunks
                        // The recorder script uses console.log(JSON.stringify(...)) which is newline delimited
                        for chunk in line.split('\n') {
                            if !chunk.trim().is_empty() {
                                handle_recorder_line(&app, &mint_id, &streamer_id, &session_id, chunk.to_string());
                            }
                        }
                    }
                    Some(CommandEvent::Stderr(line_bytes)) => {
                        let line = String::from_utf8_lossy(&line_bytes);
                        eprintln!("[Recorder stderr] {}", line);
                    }
                    Some(CommandEvent::Terminated(payload)) => {
                        println!("[Recorder] Process terminated with code: {:?}", payload.code);
                        // Emit exit event for frontend cleanup
                        let exit_payload = RecorderExitPayload {
                            streamer_id: streamer_id.to_string(),
                            session_id: session_id.to_string(),
                            mint_id: mint_id.to_string(),
                            code: payload.code,
                        };
                        let _ = app.emit("recorder-exit", exit_payload);
                        break;
                    }
                    Some(CommandEvent::Error(err)) => {
                        eprintln!("[Recorder] Process error: {}", err);
                    }
                    None => {
                        println!("[Recorder] Event channel closed");
                        break;
                    }
                    _ => {}
                }
            }
            // Handle stop signal
            _ = &mut stop_rx, if !stopping => {
                println!("[Recorder] Stop signal received, sending graceful STOP command...");
                
                // Try to write to stdin
                if let Err(e) = child.write(b"STOP\n") {
                    eprintln!("[Recorder] Failed to write to stdin: {}, falling back to kill", e);
                    if let Err(err) = child.kill() {
                        eprintln!("[Recorder] Failed to kill child: {}", err);
                    }
                    break;
                }
                
                stopping = true;
                // Set kill timer to 30 seconds to allow for graceful shutdown (ffmpeg flush + cleanup)
                kill_timer = Box::pin(tokio::time::sleep(tokio::time::Duration::from_secs(30)));
            }
            // Handle kill timeout
            _ = &mut kill_timer, if stopping => {
                println!("[Recorder] Graceful stop timed out, forcing kill...");
                if let Err(err) = child.kill() {
                    eprintln!("[Recorder] Failed to kill child: {}", err);
                }
                break;
            }
        }
    }

    Ok(())
}

fn handle_recorder_line(
    app: &tauri::AppHandle,
    mint_id: &str,
    streamer_id: &str,
    session_id: &str,
    content: String,
) {
    if content.trim().is_empty() {
        return;
    }

    match serde_json::from_str::<RecorderEvent>(&content) {
        Ok(event) => match event.event_type.as_str() {
            "segment_complete" => {
                if let (Some(segment), Some(path)) = (event.segment, event.path) {
                    let payload = SegmentReadyPayload {
                        streamer_id: streamer_id.to_string(),
                        session_id: session_id.to_string(),
                        mint_id: mint_id.to_string(),
                        segment,
                        path,
                        duration: event.duration.unwrap_or(900.0),
                    };
                    let _ = app.emit("segment-ready", payload);
                }
            }
            "stream_ended" => {
                let payload = StreamEndedPayload {
                    streamer_id: streamer_id.to_string(),
                    session_id: session_id.to_string(),
                    mint_id: mint_id.to_string(),
                };
                let _ = app.emit("stream-ended", payload);
            }
            "waiting_for_stream" => {
                // Emit a log event to inform frontend that we're waiting for stream to go live
                let poll_count = event.extra.get("pollCount")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);
                
                let message = if poll_count <= 1 {
                    "Waiting for stream to go live...".to_string()
                } else {
                    format!("Waiting for stream to go live... (check #{})", poll_count)
                };
                
                let payload = RecorderLogPayload {
                    streamer_id: streamer_id.to_string(),
                    mint_id: mint_id.to_string(),
                    message,
                    level: "info".to_string(),
                };
                let _ = app.emit("recorder-log", payload);
            }
            "log" => {
                let context = if event.extra.is_empty() {
                    String::new()
                } else {
                    match serde_json::to_string(&event.extra) {
                        Ok(ctx) => format!(" {}", ctx),
                        Err(_) => String::new(),
                    }
                };
                
                let message = if let Some(msg) = &event.message {
                    format!("{}{}", msg, context)
                } else {
                    context.clone()
                };

                println!("[Recorder][log] {}", message);

                // Emit log to frontend
                let payload = RecorderLogPayload {
                    streamer_id: streamer_id.to_string(),
                    mint_id: mint_id.to_string(),
                    message,
                    level: "info".to_string(),
                };
                let _ = app.emit("recorder-log", payload);
            }
            _ => {}
        },
        Err(_) => {
            println!("[Recorder] {}", content);
        }
    }
}