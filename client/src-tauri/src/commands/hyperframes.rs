use crate::sidecar::{resolve_resource_dir, resolve_sidecar_binary, NodeSidecar};
use serde_json::Value;
use std::{path::PathBuf, sync::Mutex};
use tauri::{command, AppHandle, Manager, State};

const SIDECAR_NAME: &str = "hyperframes-renderer";
const SIDECAR_EVENT: &str = "hyperframes-message";

#[derive(Default)]
pub struct HyperframesState {
    sidecar: Mutex<Option<NodeSidecar>>,
}

fn spawn_sidecar(app: &AppHandle) -> Result<NodeSidecar, String> {
    let envs = [
        ("HYPERFRAMES_FFMPEG_PATH", resolve_sidecar_binary("ffmpeg")?),
        ("HYPERFRAMES_FFPROBE_PATH", resolve_sidecar_binary("ffprobe")?),
        (
            "CLIPPSTER_FONTS_DIR",
            resolve_resource_dir(app, "fonts")?
                .to_string_lossy()
                .to_string(),
        ),
        ("HYPERFRAMES_NO_TELEMETRY", "1".to_string()),
        ("DO_NOT_TRACK", "1".to_string()),
        ("HYPERFRAMES_SKIP_SKILLS", "1".to_string()),
    ];
    NodeSidecar::spawn(app, SIDECAR_NAME, "index.mjs", SIDECAR_EVENT, &envs)
}

/// Forward one request (`{ id, op, ...params }`) to the Hyperframes sidecar, starting it on demand.
/// Replies arrive asynchronously as `hyperframes-message` events tagged with the same `id`.
#[command]
pub async fn hyperframes_request(
    app: AppHandle,
    state: State<'_, HyperframesState>,
    request: Value,
) -> Result<(), String> {
    let mut guard = state
        .sidecar
        .lock()
        .map_err(|e| format!("Failed to lock Hyperframes sidecar: {}", e))?;

    if !guard.as_mut().is_some_and(NodeSidecar::is_running) {
        *guard = Some(spawn_sidecar(&app)?);
    }

    guard
        .as_ref()
        .ok_or("Hyperframes sidecar not running")?
        .send(&request)
}

/// Root of everything stored locally for one AI video session.
pub fn ai_video_session_dir(app: &AppHandle, session_id: i64) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?
        .join("ai-video")
        .join(session_id.to_string()))
}

/// Directory holding a session's Hyperframes project (`index.html`, compositions, linked media).
#[command]
pub async fn hyperframes_workspace_dir(app: AppHandle, session_id: i64) -> Result<String, String> {
    let dir = ai_video_session_dir(&app, session_id)?.join("composition");
    Ok(dir.to_string_lossy().to_string())
}

#[command]
pub async fn hyperframes_stop(state: State<'_, HyperframesState>) -> Result<(), String> {
    let mut guard = state
        .sidecar
        .lock()
        .map_err(|e| format!("Failed to lock Hyperframes sidecar: {}", e))?;
    if let Some(mut sidecar) = guard.take() {
        sidecar.kill()?;
    }
    Ok(())
}
