use crate::sidecar::{RemotionSidecar, RenderCommand};
use serde_json::Value;
use std::sync::{Arc, Mutex};
use tauri::{command, AppHandle, State};

pub struct SidecarState {
    pub sidecar: Arc<Mutex<Option<RemotionSidecar>>>,
}

impl SidecarState {
    pub fn new() -> Self {
        Self {
            sidecar: Arc::new(Mutex::new(None)),
        }
    }
}

#[command]
pub async fn start_remotion_export(
    app: AppHandle,
    state: State<'_, SidecarState>,
    composition: Value,
    output_path: String,
    codec: Option<String>,
    crf: Option<u32>,
) -> Result<String, String> {
    let render_id = uuid::Uuid::new_v4().to_string();

    // Ensure sidecar is running
    let mut sidecar_lock = state
        .sidecar
        .lock()
        .map_err(|e| format!("Failed to lock sidecar: {}", e))?;

    if sidecar_lock.is_none() {
        let sidecar = RemotionSidecar::spawn(&app)?;
        *sidecar_lock = Some(sidecar);
    }

    let sidecar = sidecar_lock
        .as_ref()
        .ok_or("Sidecar not initialized")?;

    // Send render command
    let command = RenderCommand::Render {
        render_id: render_id.clone(),
        composition,
        output_path,
        codec,
        crf,
    };

    sidecar.send_command(command)?;

    Ok(render_id)
}

#[command]
pub async fn cancel_remotion_export(
    state: State<'_, SidecarState>,
    render_id: String,
) -> Result<(), String> {
    let sidecar_lock = state
        .sidecar
        .lock()
        .map_err(|e| format!("Failed to lock sidecar: {}", e))?;

    if let Some(sidecar) = sidecar_lock.as_ref() {
        let command = RenderCommand::Cancel { render_id };
        sidecar.send_command(command)?;
    }

    Ok(())
}

#[command]
pub async fn stop_remotion_sidecar(state: State<'_, SidecarState>) -> Result<(), String> {
    let mut sidecar_lock = state
        .sidecar
        .lock()
        .map_err(|e| format!("Failed to lock sidecar: {}", e))?;

    if let Some(mut sidecar) = sidecar_lock.take() {
        sidecar.kill()?;
    }

    Ok(())
}
