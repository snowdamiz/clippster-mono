use serde::{Deserialize, Serialize};

fn default_volume() -> f64 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioDevice {
    pub id: String,
    pub label: String,
    pub kind: String, // "camera" | "microphone" | "display"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioWatermarkConfig {
    pub path: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub opacity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioRecordingConfig {
    pub mode: String, // "camera" | "screen" | "screen_camera"
    pub aspect_ratio: String,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub camera_device_id: Option<String>,
    pub microphone_device_id: Option<String>,
    pub display_id: Option<String>,
    pub include_system_audio: bool,
    #[serde(default = "default_volume")]
    pub mic_volume: f64,
    #[serde(default = "default_volume")]
    pub share_audio_volume: f64,
    pub camera_pip: Option<StudioRect>,
    pub watermark: Option<StudioWatermarkConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioRecordingResult {
    pub file_path: String,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub frame_rate: f64,
    pub file_size: u64,
    pub codec: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioFinalizeConfig {
    pub recording_path: String,
    pub intro_path: Option<String>,
    pub outro_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioRecordingStatus {
    pub is_recording: bool,
    pub elapsed_seconds: f64,
    pub output_path: Option<String>,
}
