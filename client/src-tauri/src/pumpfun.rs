use std::{
    collections::HashMap,
    path::{PathBuf},
    process::Command as StdCommand,
    sync::{Arc, Mutex},
};

use once_cell::sync::Lazy;
use serde::Deserialize;
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Command as TokioCommand,
    sync::oneshot,
};

use crate::storage;
use tauri::Emitter;

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

#[derive(Debug)]
struct RecordingEntry {
    stop_tx: Option<oneshot::Sender<()>>,
    task: tokio::task::JoinHandle<()>,
}

static ACTIVE_RECORDINGS: Lazy<Arc<Mutex<HashMap<String, RecordingEntry>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("Clippster/1.0")
        .build()
        .expect("Failed to build reqwest client")
});

fn resolve_service_script(script_name: &str) -> Result<PathBuf, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;

    let exe_dir = exe_path
        .parent()
        .ok_or("Failed to get parent directory")?;

    let dev_script_path = exe_dir
        .parent()
        .and_then(|p| p.parent())
        .map(|p| p.join("pumpfun-service").join(script_name));

    let current_dir_path = exe_dir.join("pumpfun-service").join(script_name);
    let prod_script_path = exe_dir.join("pumpfun-service").join(script_name);

    if let Some(path) = dev_script_path {
        if path.exists() {
            return Ok(path);
        }
    }

    if current_dir_path.exists() {
        return Ok(current_dir_path);
    }

    Ok(prod_script_path)
}

#[tauri::command]
pub async fn get_pumpfun_clips(mint_id: String, limit: Option<u32>) -> Result<String, String> {
    let limit_str = limit.unwrap_or(20).to_string();
    let script_path = resolve_service_script("fetch-clips.mjs")?;

    let output = StdCommand::new("node")
        .arg(script_path)
        .arg(&mint_id)
        .arg(&limit_str)
        .output()
        .map_err(|e| format!("Failed to execute Node.js script: {}. Make sure Node.js is installed.", e))?;

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
pub async fn start_livestream_recording(
    app: tauri::AppHandle,
    mint_id: String,
    streamer_id: String,
    session_id: String,
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

    let script_path = resolve_service_script("record-livestream.mjs")?;
    let output_str = output_dir
        .to_str()
        .ok_or("Invalid output directory path")?
        .to_string();

    let (stop_tx, stop_rx) = oneshot::channel();

    let app_handle = app.clone();
    let mint_clone = mint_id.clone();
    let streamer_clone = streamer_id.clone();
    let session_clone = session_id.clone();

    let task = tokio::spawn(async move {
        if let Err(err) = run_recorder_process(
            app_handle,
            script_path,
            mint_clone,
            streamer_clone,
            session_clone,
            output_str,
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

async fn run_recorder_process(
    app: tauri::AppHandle,
    script_path: PathBuf,
    mint_id: String,
    streamer_id: String,
    session_id: String,
    output_dir: String,
    mut stop_rx: oneshot::Receiver<()>,
) -> Result<(), String> {
    let mut child = TokioCommand::new("node")
        .arg(&script_path)
        .arg(&mint_id)
        .arg(&session_id)
        .arg(&output_dir)
        .arg("5")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn recorder: {}", e))?;

    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                eprintln!("[Recorder stderr] {}", line);
            }
        });
    }

    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to capture recorder stdout")?;
    let mut reader = BufReader::new(stdout).lines();

    loop {
        tokio::select! {
            line = reader.next_line() => {
                match line {
                    Ok(Some(content)) => handle_recorder_line(&app, &mint_id, &streamer_id, &session_id, content),
                    Ok(None) => break,
                    Err(err) => {
                        eprintln!("[Recorder] Failed to read stdout: {}", err);
                        break;
                    }
                }
            }
            _ = &mut stop_rx => {
                if let Err(err) = child.start_kill() {
                    eprintln!("[Recorder] Failed to stop child: {}", err);
                }
                break;
            }
        }
    }

    let _ = child.wait().await;

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