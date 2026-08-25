use super::devices::list_studio_devices;
use super::finalize::finalize_recording;
use super::recorder::{get_status, start_recording, stop_recording, SharedRecorderState};
use super::types::{
    StudioFinalizeConfig, StudioRecordingConfig, StudioRecordingResult, StudioRecordingStatus,
};
use tauri::State;

#[tauri::command]
pub async fn studio_list_devices(app: tauri::AppHandle) -> Result<Vec<super::types::StudioDevice>, String> {
    list_studio_devices(&app).await
}

#[tauri::command]
pub async fn studio_start_recording(
    app: tauri::AppHandle,
    state: State<'_, SharedRecorderState>,
    config: StudioRecordingConfig,
) -> Result<String, String> {
    start_recording(&app, state.inner(), config).await
}

#[tauri::command]
pub async fn studio_stop_recording(
    app: tauri::AppHandle,
    state: State<'_, SharedRecorderState>,
) -> Result<StudioRecordingResult, String> {
    stop_recording(&app, state.inner()).await
}

#[tauri::command]
pub async fn studio_get_recording_status(
    state: State<'_, SharedRecorderState>,
) -> Result<StudioRecordingStatus, String> {
    get_status(state.inner())
}

#[tauri::command]
pub async fn studio_finalize_recording(
    app: tauri::AppHandle,
    config: StudioFinalizeConfig,
) -> Result<String, String> {
    finalize_recording(&app, config).await
}

#[tauri::command]
pub async fn studio_save_recording(
    app: tauri::AppHandle,
    bytes: Vec<u8>,
) -> Result<StudioRecordingResult, String> {
    super::recorder::save_recording_bytes(&app, bytes).await
}
