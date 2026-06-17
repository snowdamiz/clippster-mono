use super::types::{StudioRecordingConfig, StudioRecordingResult, StudioRecordingStatus};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

pub struct StudioRecorderState {
    pub is_recording: bool,
    pub started_at: Option<Instant>,
    pub output_path: Option<String>,
    pub child_pid: Option<u32>,
}

impl Default for StudioRecorderState {
    fn default() -> Self {
        Self {
            is_recording: false,
            started_at: None,
            output_path: None,
            child_pid: None,
        }
    }
}

pub type SharedRecorderState = Mutex<StudioRecorderState>;

fn studio_output_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("studio_recordings");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create studio dir: {}", e))?;
    Ok(dir)
}

fn build_ffmpeg_args(config: &StudioRecordingConfig, output: &str) -> Vec<String> {
    let fps = config.fps.max(1);
    let w = config.width;
    let h = config.height;

    let mut args = vec![
        "-y".to_string(),
        "-nostdin".to_string(),
    ];

    let mode = config.mode.as_str();
    let mut filter_parts: Vec<String> = Vec::new();
    let mut input_count = 0;

    if mode == "camera" || mode == "screen_camera" {
        if let Some(cam) = &config.camera_device_id {
            args.push("-f".to_string());
            args.push("dshow".to_string());
            args.push("-video_size".to_string());
            args.push("1280x720".to_string());
            args.push("-framerate".to_string());
            args.push(fps.to_string());
            args.push("-i".to_string());
            args.push(cam.clone());
            input_count += 1;
        }
    }

    if mode == "screen" || mode == "screen_camera" {
        args.push("-f".to_string());
        args.push("gdigrab".to_string());
        args.push("-framerate".to_string());
        args.push(fps.to_string());
        args.push("-i".to_string());
        let display = config.display_id.clone().unwrap_or_else(|| "desktop".to_string());
        if display == "desktop" {
            args.push("desktop".to_string());
        } else {
            args.push(display);
        }
        input_count += 1;
    }

  // Microphone audio
    if let Some(mic) = &config.microphone_device_id {
        args.push("-f".to_string());
        args.push("dshow".to_string());
        args.push("-i".to_string());
        args.push(mic.clone());
    }

    let base_label = if mode == "screen_camera" && input_count >= 2 {
        // inputs: [0]=camera, [1]=screen (order above)
        let pip = config.camera_pip.clone().unwrap_or(super::types::StudioRect {
            x: 0.05,
            y: 0.05,
            width: 0.25,
            height: 0.25,
        });
        let pip_w = (w as f64 * pip.width).round() as i32;
        let pip_h = (h as f64 * pip.height).round() as i32;
        let pip_x = (w as f64 * pip.x).round() as i32;
        let pip_y = (h as f64 * pip.y).round() as i32;
        filter_parts.push(format!(
            "[0:v]scale={pip_w}:{pip_h}[pip];[1:v]scale={w}:{h}[bg];[bg][pip]overlay={pip_x}:{pip_y}[v0]"
        ));
        "v0"
    } else if mode == "screen" {
        filter_parts.push(format!("[0:v]scale={w}:{h}[v0]"));
        "v0"
    } else {
        filter_parts.push(format!("[0:v]scale={w}:{h}[v0]"));
        "v0"
    };

    let mut current = base_label.to_string();

    if let Some(wm) = &config.watermark {
        filter_parts.push(format!(
            "movie={}:s={}x{}[wm];[{}][wm]overlay={}:{}:format=auto,format=yuv420p[vwm]",
            wm.path.replace('\\', "/").replace(':', "\\:"),
            (w as f64 * wm.width).round() as i32,
            (h as f64 * wm.height).round() as i32,
            current,
            (w as f64 * wm.x).round() as i32,
            (h as f64 * wm.y).round() as i32,
        ));
        current = "vwm".to_string();
    } else {
        filter_parts.push(format!("[{}]format=yuv420p[vout]", current));
        current = "vout".to_string();
    }

    if !filter_parts.is_empty() {
        args.push("-filter_complex".to_string());
        args.push(filter_parts.join(";"));
        args.push("-map".to_string());
        args.push(format!("[{}]", current));
    }

    if config.microphone_device_id.is_some() {
        let audio_idx = if mode == "screen_camera" { 2 } else { 1 };
        args.push("-map".to_string());
        args.push(format!("{}:a", audio_idx));
    }

    args.push("-c:v".to_string());
    args.push("libx264".to_string());
    args.push("-preset".to_string());
    args.push("veryfast".to_string());
    args.push("-pix_fmt".to_string());
    args.push("yuv420p".to_string());
    args.push("-r".to_string());
    args.push(fps.to_string());
    if config.microphone_device_id.is_some() {
        let mic_volume = config.mic_volume.clamp(0.0, 1.5);
        if (mic_volume - 1.0).abs() > f64::EPSILON {
            args.push("-af".to_string());
            args.push(format!("volume={}", mic_volume));
        }
        args.push("-c:a".to_string());
        args.push("aac".to_string());
        args.push("-b:a".to_string());
        args.push("192k".to_string());
    }
    args.push(output.to_string());

    args
}

pub async fn start_recording(
    app: &AppHandle,
    state: &SharedRecorderState,
    config: StudioRecordingConfig,
) -> Result<String, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    if guard.is_recording {
        return Err("Recording already in progress".to_string());
    }

    let dir = studio_output_dir(app)?;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let output_path = dir.join(format!("studio_{}.mp4", timestamp));
    let output_str = output_path.to_string_lossy().to_string();

    let ffmpeg_args = build_ffmpeg_args(&config, &output_str);
    let shell = app.shell();
    let sidecar = shell
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?;

    let (mut rx, child) = sidecar
        .args(ffmpeg_args)
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

    let pid = child.pid();
    guard.is_recording = true;
    guard.started_at = Some(Instant::now());
    guard.output_path = Some(output_str.clone());
    guard.child_pid = Some(pid);

    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            if let CommandEvent::Terminated(payload) = event {
                let _ = app_clone.emit(
                    "studio-recording-terminated",
                    payload.code,
                );
                break;
            }
        }
    });

    Ok(output_str)
}

pub async fn stop_recording(
    app: &AppHandle,
    state: &SharedRecorderState,
) -> Result<StudioRecordingResult, String> {
    let output_path = {
        let mut guard = state.lock().map_err(|e| e.to_string())?;
        if !guard.is_recording {
            return Err("No recording in progress".to_string());
        }

        let output_path = guard
            .output_path
            .clone()
            .ok_or_else(|| "Missing output path".to_string())?;

        if let Some(pid) = guard.child_pid {
            #[cfg(target_os = "windows")]
            {
                let _ = std::process::Command::new("taskkill")
                    .args(["/PID", &pid.to_string(), "/F"])
                    .output();
            }
            #[cfg(not(target_os = "windows"))]
            {
                let _ = std::process::Command::new("kill")
                    .args(["-2", &pid.to_string()])
                    .output();
            }
        }

        guard.is_recording = false;
        guard.started_at = None;
        guard.child_pid = None;

        output_path
    };

    tokio::time::sleep(Duration::from_millis(800)).await;

    let metadata = crate::storage::get_video_metadata(app.clone(), output_path.clone()).await?;

    let file_size = std::fs::metadata(&output_path)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(StudioRecordingResult {
        file_path: output_path,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        frame_rate: 30.0,
        file_size,
        codec: Some("h264".to_string()),
    })
}

pub fn get_status(state: &SharedRecorderState) -> Result<StudioRecordingStatus, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let elapsed = guard
        .started_at
        .map(|t| t.elapsed().as_secs_f64())
        .unwrap_or(0.0);
    Ok(StudioRecordingStatus {
        is_recording: guard.is_recording,
        elapsed_seconds: elapsed,
        output_path: guard.output_path.clone(),
    })
}

pub async fn save_recording_bytes(
    app: &AppHandle,
    bytes: Vec<u8>,
) -> Result<StudioRecordingResult, String> {
    let dir = studio_output_dir(app)?;
    let filename = format!(
        "studio_{}.webm",
        chrono::Utc::now().format("%Y%m%d_%H%M%S")
    );
    let path = dir.join(filename);
    let output_path = path.to_string_lossy().to_string();

    std::fs::write(&path, &bytes).map_err(|e| format!("Failed to write recording: {}", e))?;

    let metadata = crate::storage::get_video_metadata(app.clone(), output_path.clone()).await?;

    let file_size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(bytes.len() as u64);

    Ok(StudioRecordingResult {
        file_path: output_path,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        frame_rate: 30.0,
        file_size,
        codec: Some("vp9".to_string()),
    })
}
