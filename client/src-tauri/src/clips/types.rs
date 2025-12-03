use serde::{Deserialize, Serialize};

// Subtitle settings structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleSettings {
    pub enabled: bool,
    pub font_family: String,
    pub font_size: f32,
    pub font_weight: u32,
    pub text_color: String,
    pub background_color: String,
    pub background_enabled: bool,
    pub border1_width: f32,
    pub border1_color: String,
    pub border2_width: f32,
    pub border2_color: String,
    pub shadow_offset_x: f32,
    pub shadow_offset_y: f32,
    pub shadow_blur: f32,
    pub shadow_color: String,
    pub position: String,
    pub position_percentage: f32,
    pub max_width: f32,
    pub animation_style: String,
    pub line_height: f32,
    pub letter_spacing: f32,
    pub text_align: String,
    pub text_offset_x: f32,
    pub text_offset_y: f32,
    pub padding: f32,
    pub border_radius: f32,
    pub word_spacing: f32,
}

// Word info structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordInfo {
    pub word: String,
    pub start: f64,
    pub end: f64,
    pub confidence: Option<f64>,
}

// Whisper segment structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperSegment {
    pub id: i64,
    pub start: f64,
    pub end: f64,
    pub text: String,
    pub words: Option<Vec<WordInfo>>,
}

// Clip building progress tracking structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipBuildProgress {
    pub clip_id: String,
    pub project_id: String,
    pub progress: f64,
    pub stage: String,
    pub message: String,
    pub error: Option<String>,
}

// Clip build result structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipBuildResult {
    pub clip_id: String,
    pub project_id: String,
    pub success: bool,
    pub output_path: Option<String>,
    pub thumbnail_path: Option<String>,
    pub duration: Option<f64>,
    pub file_size: Option<u64>,
    pub error: Option<String>,
}

// Aspect ratio structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AspectRatio {
    pub width: f32,
    pub height: f32,
}

// Watermark settings structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatermarkSettings {
    pub enabled: bool,
    pub watermark_id: String,
    pub file_path: String,
    pub position_x: u32, // 0-100 (percentage from left)
    pub position_y: u32, // 0-100 (percentage from top)
    pub opacity: u32, // 0-100
    pub scale: u32, // percentage of video width (5-50)
}

// Audio settings structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioSettings {
    pub volume: f64,     // dB gain (-20 to +20)
    pub normalize: bool, // enable audio normalization (export only)
}

// Build settings structure (reserved for future use)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct BuildSettings {
    pub aspect_ratios: Vec<String>,
    pub quality: String,
    pub frame_rate: u32,
    pub output_format: String,
}

