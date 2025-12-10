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

// Per-aspect-ratio subtitle override (only size and position)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleOverride {
    pub font_size: f32,
    pub position_percentage: f32,
}

// Map of aspect ratio string to subtitle override
// Keys are aspect ratios like "16:9", "9:16", "1:1", "4:5"
pub type SubtitleOverrides = std::collections::HashMap<String, SubtitleOverride>;

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
    /// All output paths (one per aspect ratio)
    pub all_output_paths: Vec<String>,
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

// Music track settings for export (from clip editor)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicTrackSettings {
    pub file_path: String,   // Path to audio file
    pub gain_db: f64,        // dB gain (-20 to +20)
    pub fade_in: f64,        // Fade in duration in seconds
    pub fade_out: f64,       // Fade out duration in seconds
    pub start_time: f64,     // When audio starts in clip timeline
    pub end_time: f64,       // When audio ends in clip timeline
    pub is_muted: bool,      // Whether track is muted
}

// Audio settings structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioSettings {
    pub volume: f64,     // dB gain (-20 to +20) - project level
    pub normalize: bool, // enable audio normalization (export only)
    // Clip-level audio mixer settings (optional, from clip editor)
    #[serde(default)]
    pub original_audio_db: Option<f64>, // dB gain for original audio track (-20 to +20)
    #[serde(default)]
    pub music_tracks: Option<Vec<MusicTrackSettings>>, // Music tracks to mix in
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

// ============================================================================
// SPEAKER DETECTION & FRAMING STRATEGY TYPES
// ============================================================================

/// Framing mode determines how the video is cropped/processed for portrait output
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FramingMode {
    /// Split screen with two regions stacked vertically (e.g., content top, speaker bottom)
    SplitScreen,
    /// Dynamic panning that follows speakers across frames
    DynamicPan,
    /// Static crop centered on detected speaker(s)
    Static,
    /// Manual multi-region layout defined by user
    MultiRegion,
}

impl Default for FramingMode {
    fn default() -> Self {
        FramingMode::Static
    }
}

/// Video content type classification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum VideoType {
    /// Single centered speaker with minimal movement (interview, presentation)
    TalkingHead,
    /// Speaker in corner with large content area (gameplay, screen share)
    Gaming,
    /// Active speaker with high movement (mobile recording, vlog)
    Irl,
    /// Multiple speakers in different regions
    MultiSpeaker,
    /// Multiple speakers in similar region (side by side)
    Podcast,
    /// Could not determine video type
    Unknown,
}

impl Default for VideoType {
    fn default() -> Self {
        VideoType::Unknown
    }
}

/// Normalized bounding box (coordinates in 0.0-1.0 range)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedBBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// A detected speaker/point of interest
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeakerRegion {
    pub speaker_index: u32,
    pub bbox: NormalizedBBox,
    pub centroid: Point2D,
    pub confidence: f64,
    pub detection_count: u32,
    pub movement_variance: f64,
    pub position_category: (String, String), // (horizontal, vertical)
}

/// 2D point for positions
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

/// Content region (area without speakers, e.g., gameplay)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentRegion {
    pub region_type: String,
    pub bbox: NormalizedBBox,
    pub quadrant: Option<String>,
    pub priority: String,
}

/// Crop region with output positioning
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CropRegion {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub output_height_ratio: Option<f64>,
}

/// Split screen layout configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitLayout {
    /// Type of split: "vertical_stack" or "horizontal_stack"
    pub layout_type: String,
    /// Top region crop parameters
    pub top_region: CropRegion,
    /// Bottom region crop parameters  
    pub bottom_region: CropRegion,
    /// Split ratio (0.0-1.0, where value is top region's portion)
    pub split_ratio: f64,
}

/// Keyframe for dynamic panning
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PanKeyframe {
    /// Timestamp in seconds
    pub timestamp: f64,
    /// Normalized crop X position (0.0-1.0)
    pub crop_x: f64,
    /// Normalized crop Y position (0.0-1.0)
    pub crop_y: f64,
    /// Whether a face was detected at this keyframe
    pub face_detected: bool,
}

/// Source video dimensions
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VideoDimensions {
    pub width: u32,
    pub height: u32,
}

/// Complete framing strategy for a clip
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FramingStrategy {
    /// The framing mode to use
    pub mode: FramingMode,
    /// Classified video type
    pub video_type: VideoType,
    /// Number of speakers detected
    pub speaker_count: u32,
    /// Detection confidence (0.0-1.0)
    pub confidence: f64,
    /// Target aspect ratio (e.g., "9:16")
    pub target_aspect_ratio: String,
    /// Whether target is portrait orientation
    pub is_portrait: bool,
    /// Source video dimensions
    pub source_dimensions: VideoDimensions,
    /// FFmpeg filter string to apply this strategy
    pub ffmpeg_filter: String,
    /// Split screen layout (only for SplitScreen mode)
    pub layout: Option<SplitLayout>,
    /// Pan keyframes (only for DynamicPan mode)
    pub keyframes: Option<Vec<PanKeyframe>>,
    /// Static crop region (only for Static mode)
    pub crop_region: Option<NormalizedBBox>,
    /// Crop center point
    pub crop_center: Option<Point2D>,
    /// Detected speakers
    pub speakers: Option<Vec<SpeakerRegion>>,
    /// Detected content regions
    pub content_regions: Option<Vec<ContentRegion>>,
    /// Manual multi-region configuration (only for MultiRegion mode)
    pub multi_region: Option<ManualFramingConfig>,
}

impl Default for FramingStrategy {
    fn default() -> Self {
        Self {
            mode: FramingMode::Static,
            video_type: VideoType::Unknown,
            speaker_count: 0,
            confidence: 0.5,
            target_aspect_ratio: "9:16".to_string(),
            is_portrait: true,
            source_dimensions: VideoDimensions::default(),
            ffmpeg_filter: String::new(),
            layout: None,
            keyframes: None,
            crop_region: None,
            crop_center: None,
            speakers: None,
            content_regions: None,
            multi_region: None,
        }
    }
}

// ============================================================================
// MANUAL POI / MULTI-REGION FRAMING TYPES
// ============================================================================

/// A single region for manual multi-region framing
/// Contains both the source crop and output position
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualRegion {
    /// Unique identifier for the region
    pub id: String,
    /// Color for visual distinction (hex string)
    pub color: String,
    /// Optional label for the region
    pub label: Option<String>,
    /// Source crop area (normalized 0-1 coordinates on source video)
    pub source: NormalizedBBox,
    /// Output position (normalized 0-1 coordinates on target canvas)
    pub output: NormalizedBBox,
}

/// Manual framing configuration with multiple regions
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualFramingConfig {
    /// Mode identifier (always "manual")
    pub mode: String,
    /// List of regions to extract and composite
    pub regions: Vec<ManualRegion>,
    /// Target aspect ratio (e.g., "9:16")
    pub target_aspect_ratio: String,
    /// Source aspect ratio (e.g., "16:9")
    pub source_aspect_ratio: Option<String>,
}

impl ManualFramingConfig {
    /// Convert manual config to a FramingStrategy with MultiRegion mode
    #[allow(dead_code)]
    pub fn to_framing_strategy(&self, source_width: u32, source_height: u32) -> FramingStrategy {
        FramingStrategy {
            mode: FramingMode::MultiRegion,
            video_type: VideoType::Unknown,
            speaker_count: 0,
            confidence: 1.0, // Manual config is always 100% confident
            target_aspect_ratio: self.target_aspect_ratio.clone(),
            is_portrait: self.target_aspect_ratio == "9:16" || self.target_aspect_ratio == "4:5",
            source_dimensions: VideoDimensions {
                width: source_width,
                height: source_height,
            },
            ffmpeg_filter: String::new(), // Will be generated during processing
            layout: None,
            keyframes: None,
            crop_region: None,
            crop_center: None,
            speakers: None,
            content_regions: None,
            multi_region: Some(self.clone()),
        }
    }
}

impl FramingStrategy {
    /// Creates a default static centered crop strategy
    #[allow(dead_code)]
    pub fn default_centered(source_width: u32, source_height: u32) -> Self {
        let target_aspect = 9.0 / 16.0;
        let source_aspect = source_width as f64 / source_height as f64;
        
        // Calculate crop dimensions for portrait
        let (crop_w, crop_h) = if target_aspect < source_aspect {
            // Crop width
            let h = 1.0;
            let w = h * target_aspect / source_aspect;
            (w, h)
        } else {
            // Crop height
            let w = 1.0;
            let h = w * source_aspect / target_aspect;
            (w, h)
        };

        let crop_x = (1.0 - crop_w) / 2.0;
        let crop_y = (1.0 - crop_h) / 2.0;

        // Calculate pixel values for FFmpeg
        let pixel_w = (source_width as f64 * crop_w) as u32;
        let pixel_h = (source_height as f64 * crop_h) as u32;
        let pixel_x = (source_width as f64 * crop_x) as u32;
        let pixel_y = (source_height as f64 * crop_y) as u32;

        Self {
            mode: FramingMode::Static,
            video_type: VideoType::Unknown,
            speaker_count: 0,
            confidence: 0.5,
            target_aspect_ratio: "9:16".to_string(),
            is_portrait: true,
            source_dimensions: VideoDimensions {
                width: source_width,
                height: source_height,
            },
            ffmpeg_filter: format!("crop={}:{}:{}:{}", pixel_w, pixel_h, pixel_x, pixel_y),
            layout: None,
            keyframes: None,
            crop_region: Some(NormalizedBBox {
                x: crop_x,
                y: crop_y,
                width: crop_w,
                height: crop_h,
            }),
            crop_center: Some(Point2D { x: 0.5, y: 0.5 }),
            speakers: None,
            content_regions: None,
            multi_region: None,
        }
    }
}

