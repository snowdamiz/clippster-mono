use tauri::{command, AppHandle, Emitter, State, Window};
use crate::sidecar::{RemotionSidecar, RenderCommand, RenderOptions};
use std::sync::Mutex;
use uuid::Uuid;

pub struct SidecarState(pub Mutex<Option<RemotionSidecar>>);

#[command]
pub async fn start_remotion_export(
    app: AppHandle,
    window: Window,
    state: State<'_, SidecarState>,
    composition: serde_json::Value,
    output_path: String,
    codec: Option<String>,
    crf: Option<u32>,
) -> Result<String, String> {
    let render_id = Uuid::new_v4().to_string();
    
    let mut sidecar_guard = state.0.lock().map_err(|e| e.to_string())?;
    if sidecar_guard.is_none() {
        let mut sidecar = RemotionSidecar::spawn(&app)?;
        let window_clone = window.clone();
        sidecar.read_messages(move |msg| {
            let _ = window_clone.emit("remotion-export-progress", &msg);
        })?;
        *sidecar_guard = Some(sidecar);
    }
    
    if let Some(sidecar) = sidecar_guard.as_ref() {
        sidecar.send_command(RenderCommand::Render {
            id: render_id.clone(),
            composition,
            output_path,
            options: Some(RenderOptions { codec, crf }),
        })?;
    }
    
    Ok(render_id)
}

#[command]
pub async fn cancel_remotion_export(
    state: State<'_, SidecarState>,
    render_id: String,
) -> Result<(), String> {
    let sidecar_guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(sidecar) = sidecar_guard.as_ref() {
        sidecar.send_command(RenderCommand::Cancel { id: render_id })?;
    }
    Ok(())
}
