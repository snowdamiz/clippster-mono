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
    #[serde(default = "default_highlight_color")]
    pub highlight_color: String,
    #[serde(default)]
    pub multi_color_enabled: bool,
    #[serde(default = "default_multi_color_mode")]
    pub multi_color_mode: String,
    #[serde(default)]
    pub color_palette: Vec<String>,
    pub line_height: f32,
    pub letter_spacing: f32,
    pub text_align: String,
    pub text_offset_x: f32,
    pub text_offset_y: f32,
    pub padding: f32,
    pub border_radius: f32,
    pub word_spacing: f32,
}

fn default_highlight_color() -> String {
    "#0ea5e9".to_string()
}

fn default_multi_color_mode() -> String {
    "default".to_string()
}

// Per-aspect-ratio subtitle override (size, position, and width)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleOverride {
    pub font_size: f32,
    pub position_percentage: f32,
    #[serde(default)]
    pub position: Option<SubtitleOverridePosition>,
    #[serde(default)]
    pub max_width: Option<f32>,
    #[serde(default)]
    pub preset_id: Option<String>,
    #[serde(default)]
    pub animation_style: Option<String>,
    #[serde(default)]
    pub text_color: Option<String>,
    #[serde(default)]
    pub font_family: Option<String>,
    #[serde(default)]
    pub font_weight: Option<u32>,
    #[serde(default)]
    pub border1_width: Option<f32>,
    #[serde(default)]
    pub border1_color: Option<String>,
    #[serde(default)]
    pub border2_width: Option<f32>,
    #[serde(default)]
    pub border2_color: Option<String>,
    #[serde(default)]
    pub highlight_color: Option<String>,
    #[serde(default)]
    pub multi_color_enabled: Option<bool>,
    #[serde(default)]
    pub color_palette: Option<Vec<String>>,
    #[serde(default)]
    pub multi_color_mode: Option<String>,
    #[serde(default)]
    pub shadow_offset_x: Option<f32>,
    #[serde(default)]
    pub shadow_offset_y: Option<f32>,
    #[serde(default)]
    pub shadow_blur: Option<f32>,
    #[serde(default)]
    pub shadow_color: Option<String>,
    #[serde(default)]
    pub background_color: Option<String>,
    #[serde(default)]
    pub background_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleOverridePosition {
    pub x: f32,
    pub y: f32,
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
    pub build_id: Option<String>,
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

// Watermark position for a specific aspect ratio
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatermarkPositionSettings {
    pub x: u32,
    pub y: u32,
    pub opacity: u32,
    pub scale: u32,
    #[serde(default)]
    pub is_full_frame_overlay: Option<bool>, // When true, position at 0,0 with 100% scale
}

// Per-aspect-ratio watermark configuration
// Allows using different watermark images for different aspect ratios
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatermarkRatioConfig {
    pub watermark_id: Option<String>,
    pub file_path: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub position: Option<WatermarkPositionSettings>,
}

// Per-aspect-ratio watermark settings from creator profile
// Each ratio can be null/None to indicate watermark is disabled for that ratio
// Each ratio can have a completely different watermark image
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerRatioWatermarkSettings {
    #[serde(rename = "16:9")]
    pub ratio_16_9: Option<WatermarkRatioConfig>,
    #[serde(rename = "9:16")]
    pub ratio_9_16: Option<WatermarkRatioConfig>,
    #[serde(rename = "1:1")]
    pub ratio_1_1: Option<WatermarkRatioConfig>,
    #[serde(rename = "4:5")]
    pub ratio_4_5: Option<WatermarkRatioConfig>,
}

// Watermark settings structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatermarkSettings {
    pub enabled: bool,
    pub watermark_id: String,
    pub file_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
    pub position_x: u32, // 0-100 (percentage from left)
    pub position_y: u32, // 0-100 (percentage from top)
    pub opacity: u32,    // 0-100
    pub scale: u32,      // percentage of video width (5-50)
    // Optional per-aspect-ratio settings from creator profile
    #[serde(skip_serializing_if = "Option::is_none")]
    pub per_ratio_settings: Option<PerRatioWatermarkSettings>,
}

// Music track settings for export (from clip editor)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicTrackSettings {
    pub file_path: String, // Path to audio file
    pub gain_db: f64,      // dB gain (-20 to +20)
    #[serde(default)]
    pub pan: f64, // Pan -1.0 to 1.0 (0.0 is center)
    pub fade_in: f64,      // Fade in duration in seconds
    pub fade_out: f64,     // Fade out duration in seconds
    pub start_time: f64,   // When audio starts in clip timeline
    pub end_time: f64,     // When audio ends in clip timeline
    pub is_muted: bool,    // Whether track is muted
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

// Time-based filter segment for the timeline
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoFilterSegment {
    pub id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub settings: VideoFilterSettings,
}

// Video filter settings from clip editor (color grading, effects)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VideoFilterSettings {
    #[serde(default)]
    pub preset: Option<String>, // Filter preset name (e.g., "warm", "cool", "vintage")
    #[serde(default)]
    pub brightness: f64, // -100 to 100 (0 = no change)
    #[serde(default)]
    pub contrast: f64, // -100 to 100 (0 = no change)
    #[serde(default)]
    pub saturation: f64, // -100 to 100 (0 = no change)
    #[serde(default)]
    pub hue: f64, // -180 to 180 degrees (0 = no change)
    #[serde(default)]
    pub temperature: f64, // -100 to 100 (warm/cool adjustment)
    #[serde(default)]
    pub vignette: f64, // 0 to 100 (vignette intensity)
    #[serde(default)]
    pub sharpen: f64, // 0 to 100 (sharpening amount)
    #[serde(default)]
    pub fade: f64, // 0 to 100 (fade/muted look)
}

impl VideoFilterSettings {
    /// Check if any filter is active (non-default values)
    pub fn is_active(&self) -> bool {
        self.brightness != 0.0
            || self.contrast != 0.0
            || self.saturation != 0.0
            || self.hue != 0.0
            || self.temperature != 0.0
            || self.vignette > 0.0
            || self.sharpen > 0.0
            || self.fade > 0.0
    }

    /// Build FFmpeg video filter string for color grading
    /// Returns None if no filters are active
    #[allow(dead_code)]
    pub fn to_ffmpeg_filter(&self) -> Option<String> {
        if !self.is_active() {
            return None;
        }

        let mut filters = Vec::new();

        // Use the eq (equalizer) filter for brightness, contrast, saturation
        // eq filter uses values around 1.0 as neutral
        // brightness: -1.0 to 1.0 (0.0 = no change)
        // contrast: 0.0 to 2.0 (1.0 = no change)
        // saturation: 0.0 to 3.0 (1.0 = no change)

        let has_eq_params =
            self.brightness != 0.0 || self.contrast != 0.0 || self.saturation != 0.0;
        if has_eq_params {
            let mut eq_parts = Vec::new();

            // Brightness: -100 to 100 → -1.0 to 1.0
            if self.brightness != 0.0 {
                let brightness = self.brightness / 100.0;
                eq_parts.push(format!("brightness={:.3}", brightness));
            }

            // Contrast: -100 to 100 → 0.0 to 2.0 (1.0 = neutral)
            if self.contrast != 0.0 {
                let contrast = 1.0 + (self.contrast / 100.0);
                eq_parts.push(format!("contrast={:.3}", contrast.clamp(0.0, 2.0)));
            }

            // Saturation: -100 to 100 → 0.0 to 2.0 (1.0 = neutral)
            if self.saturation != 0.0 {
                let saturation = 1.0 + (self.saturation / 100.0);
                eq_parts.push(format!("saturation={:.3}", saturation.clamp(0.0, 3.0)));
            }

            if !eq_parts.is_empty() {
                filters.push(format!("eq={}", eq_parts.join(":")));
            }
        }

        // Hue rotation: use hue filter (h=degrees in radians)
        if self.hue != 0.0 {
            // hue filter uses h= in radians, but we can use degrees with PI conversion
            // h=H*PI/180 where H is degrees
            let hue_radians = self.hue * std::f64::consts::PI / 180.0;
            filters.push(format!("hue=h={:.4}", hue_radians));
        }

        // Temperature (warm/cool): use colortemperature filter
        // FFmpeg colortemperature filter: temperature in Kelvin (6500 = neutral)
        // Warm (-100) = lower K (e.g., 4500), Cool (+100) = higher K (e.g., 8500)
        if self.temperature != 0.0 {
            // Map -100..100 to 4500..8500 Kelvin (6500 = neutral)
            let temp_k = 6500.0 - (self.temperature * 20.0);
            filters.push(format!(
                "colortemperature=temperature={:.0}",
                temp_k.clamp(2000.0, 12000.0)
            ));
        }

        // Vignette: use vignette filter
        // angle: controls spread (PI/5 to PI/2), default PI/5
        // a (aspect): 1 for round, higher for elliptical
        if self.vignette > 0.0 {
            // Map 0-100 to vignette intensity
            // Higher angle = less vignette (more open), lower = more vignette
            let angle = std::f64::consts::PI / 5.0 * (1.0 - self.vignette / 200.0);
            filters.push(format!(
                "vignette=angle={:.4}",
                angle.clamp(0.1, std::f64::consts::PI / 2.0)
            ));
        }

        // Sharpen: use unsharp filter
        // unsharp=lx:ly:la:cx:cy:ca (luma size x/y, luma amount, chroma size x/y, chroma amount)
        // Default: 5:5:1.0, higher amount = more sharpening
        if self.sharpen > 0.0 {
            // Map 0-100 to sharpening amount 0-3
            let amount = self.sharpen / 100.0 * 3.0;
            let chroma_amount = amount * 0.5; // Less sharpening on chroma
            filters.push(format!(
                "unsharp=5:5:{:.2}:5:5:{:.2}",
                amount, chroma_amount
            ));
        }

        // Fade look: reduce contrast and add slight "film" look
        // This applies on top of other filters if present
        if self.fade > 0.0 {
            // Reduce contrast and slightly lower saturation
            let fade_factor = self.fade / 100.0;
            let contrast_reduction = 1.0 - (fade_factor * 0.3); // Max 30% reduction
            let saturation_reduction = 1.0 - (fade_factor * 0.2); // Max 20% reduction

            filters.push(format!(
                "eq=contrast={:.3}:saturation={:.3}",
                contrast_reduction.clamp(0.5, 1.0),
                saturation_reduction.clamp(0.5, 1.0)
            ));
        }

        if filters.is_empty() {
            None
        } else {
            Some(filters.join(","))
        }
    }

    /// Build FFmpeg video filter string with enable expression for time-based filtering
    /// The enable expression limits when the filter is applied based on time
    /// Returns None if no filters are active
    pub fn to_ffmpeg_filter_with_enable(&self, start_time: f64, end_time: f64) -> Option<String> {
        if !self.is_active() {
            return None;
        }

        let mut filters = Vec::new();

        // Build the enable expression for this time range
        // FFmpeg uses seconds for time, between(t,start,end) checks if t is in range
        let enable_expr = format!("enable='between(t,{:.3},{:.3})'", start_time, end_time);

        // Use the eq (equalizer) filter for brightness, contrast, saturation
        let has_eq_params =
            self.brightness != 0.0 || self.contrast != 0.0 || self.saturation != 0.0;
        if has_eq_params {
            let mut eq_parts = Vec::new();

            if self.brightness != 0.0 {
                let brightness = self.brightness / 100.0;
                eq_parts.push(format!("brightness={:.3}", brightness));
            }

            if self.contrast != 0.0 {
                let contrast = 1.0 + (self.contrast / 100.0);
                eq_parts.push(format!("contrast={:.3}", contrast.clamp(0.0, 2.0)));
            }

            if self.saturation != 0.0 {
                let saturation = 1.0 + (self.saturation / 100.0);
                eq_parts.push(format!("saturation={:.3}", saturation.clamp(0.0, 3.0)));
            }

            if !eq_parts.is_empty() {
                // Add enable expression to eq filter
                eq_parts.push(enable_expr.clone());
                filters.push(format!("eq={}", eq_parts.join(":")));
            }
        }

        // Hue rotation with enable
        if self.hue != 0.0 {
            let hue_radians = self.hue * std::f64::consts::PI / 180.0;
            filters.push(format!("hue=h={:.4}:{}", hue_radians, enable_expr));
        }

        // Temperature with enable
        if self.temperature != 0.0 {
            let temp_k = 6500.0 - (self.temperature * 20.0);
            filters.push(format!(
                "colortemperature=temperature={:.0}:{}",
                temp_k.clamp(2000.0, 12000.0),
                enable_expr
            ));
        }

        // Vignette with enable
        if self.vignette > 0.0 {
            let angle = std::f64::consts::PI / 5.0 * (1.0 - self.vignette / 200.0);
            filters.push(format!(
                "vignette=angle={:.4}:{}",
                angle.clamp(0.1, std::f64::consts::PI / 2.0),
                enable_expr
            ));
        }

        // Sharpen with enable
        // unsharp uses positional params: lx:ly:la:cx:cy:ca, then enable
        if self.sharpen > 0.0 {
            let amount = self.sharpen / 100.0 * 3.0;
            let chroma_amount = amount * 0.5; // Less sharpening on chroma
            filters.push(format!(
                "unsharp=5:5:{:.2}:5:5:{:.2}:{}",
                amount, chroma_amount, enable_expr
            ));
        }

        // Fade look with enable
        if self.fade > 0.0 {
            let fade_factor = self.fade / 100.0;
            let contrast_reduction = 1.0 - (fade_factor * 0.3);
            let saturation_reduction = 1.0 - (fade_factor * 0.2);

            filters.push(format!(
                "eq=contrast={:.3}:saturation={:.3}:{}",
                contrast_reduction.clamp(0.5, 1.0),
                saturation_reduction.clamp(0.5, 1.0),
                enable_expr
            ));
        }

        if filters.is_empty() {
            None
        } else {
            Some(filters.join(","))
        }
    }
}

impl VideoFilterSegment {
    /// Build FFmpeg filter string for this segment with proper time-based enable expression
    pub fn to_ffmpeg_filter(&self) -> Option<String> {
        self.settings
            .to_ffmpeg_filter_with_enable(self.start_time, self.end_time)
    }
}

/// Build a combined FFmpeg filter string from multiple filter segments
/// Each segment is applied during its specified time range using FFmpeg's enable expression
pub fn build_time_based_filter_string(segments: &[VideoFilterSegment]) -> Option<String> {
    if segments.is_empty() {
        return None;
    }

    let mut all_filters = Vec::new();

    for segment in segments {
        if let Some(filter_str) = segment.to_ffmpeg_filter() {
            all_filters.push(filter_str);
        }
    }

    if all_filters.is_empty() {
        None
    } else {
        Some(all_filters.join(","))
    }
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
#[derive(Default)]
pub enum FramingMode {
    /// Split screen with two regions stacked vertically (e.g., content top, speaker bottom)
    SplitScreen,
    /// Dynamic panning that follows speakers across frames
    DynamicPan,
    /// Static crop centered on detected speaker(s)
    #[default]
    Static,
    /// Manual multi-region layout defined by user
    MultiRegion,
}

/// Video content type classification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
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
    #[default]
    Unknown,
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
    /// Whether to clip this region to rounded corners
    #[serde(skip_serializing_if = "Option::is_none")]
    pub corner_radius_enabled: Option<bool>,
    /// Corner radius slider value (design-space px, scaled by output region width)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub corner_radius_px: Option<f64>,
    /// Media asset reference (file path or asset ID)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_asset_id: Option<String>,
    /// Type of media content in this region
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_type: Option<String>, // "video-crop" | "image" | "video"
    /// Seconds into external video to start (B-roll trim offset)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media_source_offset: Option<f64>,
}

/// Source frame transform for scaling/positioning entire source
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceTransform {
    /// Scale factor (0.5 to 3.0)
    pub scale: f64,
    /// X offset (normalized relative to container width, can be negative)
    pub x: f64,
    /// Y offset (normalized relative to container height, can be negative)
    pub y: f64,
}

/// Time-based segment configuration for POI regions
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SegmentRegionConfig {
    /// Unique segment identifier
    pub segment_id: String,
    /// Start time relative to clip start (seconds)
    pub start_time: f64,
    /// End time relative to clip start (seconds)
    pub end_time: f64,
    /// Region configuration for this time segment
    pub regions: Vec<ManualRegion>,
}

/// Time-based B-roll overlay, independent from framing segments.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrollRegionConfig {
    /// Unique B-roll identifier
    pub broll_id: String,
    /// Start time relative to clip start (seconds)
    pub start_time: f64,
    /// End time relative to clip start (seconds)
    pub end_time: f64,
    /// Full-canvas or user-positioned media region
    pub region: ManualRegion,
    /// Optional source suggestion identifier
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggestion_id: Option<String>,
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
    /// Global source frame transform
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_transform: Option<SourceTransform>,
    /// "none" | "scale" | "use16x9" — blur letterbox vs scaled source
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_frame_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blur_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blur_amount: Option<f64>,
    /// Segment-based region configurations
    #[serde(skip_serializing_if = "Option::is_none")]
    pub segment_configs: Option<Vec<SegmentRegionConfig>>,
    /// Timed B-roll overlays, composited independently from segments
    #[serde(skip_serializing_if = "Option::is_none")]
    pub broll_configs: Option<Vec<BrollRegionConfig>>,
}

/// Segment-specific framing configuration (legacy)
/// Associates a framing config with specific segment IDs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SegmentFramingConfig {
    /// Which segment IDs this framing applies to
    pub segment_ids: Vec<String>,
    /// The framing configuration for these segments
    pub config: ManualFramingConfig,
}

/// Per-aspect-ratio segment-specific framing configurations
/// Maps aspect ratio strings to arrays of segment framing configs
pub type SegmentFramingConfigs = std::collections::HashMap<String, Vec<SegmentFramingConfig>>;

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

// ============================================================================
// TEXT OVERLAY TYPES
// ============================================================================

/// Gradient color stop
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GradientColorStop {
    pub color: String,
    pub position: f32, // 0-100
}

/// Gradient configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GradientConfig {
    pub enabled: bool,
    #[serde(rename = "type")]
    pub gradient_type: String, // "linear" or "radial"
    #[serde(default)]
    pub angle: f32, // degrees for linear gradient
    pub colors: Vec<GradientColorStop>,
}

/// Glow effect configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlowConfig {
    pub enabled: bool,
    pub color: String,
    #[serde(default)]
    pub blur: f32,
    #[serde(default)]
    pub spread: f32,
    #[serde(default)]
    pub opacity: f32, // 0-1
}

/// Shadow configuration for multiple shadows
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShadowConfig {
    pub offset_x: f32,
    pub offset_y: f32,
    pub blur: f32,
    pub color: String,
}

/// Chat bubble configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatBubbleConfig {
    pub enabled: bool,
    pub shape: String,         // "rounded", "pointed", "cloud", "square"
    pub tail_position: String, // "left", "right", "bottom-left", "bottom-right", "none"
    #[serde(default)]
    pub tail_size: f32,
    #[serde(default)]
    pub platform: Option<String>, // "imessage", "discord", "twitch", "whatsapp", "custom"
    #[serde(default)]
    pub show_avatar: Option<bool>,
    #[serde(default)]
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub avatar_position: Option<String>, // "left", "right"
    #[serde(default)]
    pub avatar_size: Option<f32>,
    #[serde(default)]
    pub show_username: Option<bool>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub username_color: Option<String>,
    #[serde(default)]
    pub show_timestamp: Option<bool>,
    #[serde(default)]
    pub timestamp: Option<String>,
}

/// Animation preset configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextAnimationPreset {
    pub entry: String,
    pub exit: String,
    pub emphasis: String,
    #[serde(default)]
    pub entry_duration: f32,
    #[serde(default)]
    pub exit_duration: f32,
    #[serde(default)]
    pub emphasis_duration: f32,
    #[serde(default)]
    pub entry_delay: f32,
    #[serde(default)]
    pub entry_easing: Option<String>,
    #[serde(default)]
    pub exit_easing: Option<String>,
}

/// Text overlay style settings (matches frontend TextOverlayStyle)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextOverlayStyle {
    pub font_family: String,
    pub font_size: f32,
    pub font_weight: u32,
    pub color: String, // Text color
    #[serde(default)]
    pub background_color: Option<String>,
    #[serde(default)]
    pub background_enabled: bool,
    #[serde(default)]
    pub highlight_color: Option<String>,
    // Dual border system
    #[serde(default)]
    pub border1_width: f32,
    #[serde(default)]
    pub border1_color: Option<String>,
    #[serde(default)]
    pub border2_width: f32,
    #[serde(default)]
    pub border2_color: Option<String>,
    // Legacy stroke support
    #[serde(default)]
    pub stroke_enabled: bool,
    #[serde(default)]
    pub stroke_color: Option<String>,
    #[serde(default)]
    pub stroke_width: f32,
    // Shadow
    #[serde(default)]
    pub shadow_enabled: bool,
    #[serde(default)]
    pub shadow_color: Option<String>,
    #[serde(default)]
    pub shadow_blur: f32,
    #[serde(default)]
    pub shadow_offset_x: f32,
    #[serde(default)]
    pub shadow_offset_y: f32,
    // Layout & spacing
    #[serde(default)]
    pub border_radius: f32,
    #[serde(default)]
    pub padding: f32,
    #[serde(default)]
    pub letter_spacing: f32,
    #[serde(default)]
    pub line_height: f32,
    #[serde(default)]
    pub word_spacing: f32,
    #[serde(default)]
    pub text_align: Option<String>,
    #[serde(default)]
    pub max_width: f32,
    /// Explicit width as percentage (0-100), if set overrides auto-sizing
    #[serde(default)]
    pub width: Option<f32>,
    #[serde(default)]
    pub text_offset_x: f32,
    #[serde(default)]
    pub text_offset_y: f32,

    // === EXTENDED PROPERTIES ===

    // Text Transform
    #[serde(default)]
    pub text_transform: Option<String>, // "none", "uppercase", "lowercase", "capitalize"
    #[serde(default)]
    pub text_decoration: Option<String>, // "none", "underline", "line-through"

    // Gradient Text
    #[serde(default)]
    pub gradient: Option<GradientConfig>,

    // Outer Glow
    #[serde(default)]
    pub glow: Option<GlowConfig>,

    // Multiple Shadows
    #[serde(default)]
    pub shadows: Option<Vec<ShadowConfig>>,

    // Background enhancements
    #[serde(default)]
    pub background_gradient: Option<GradientConfig>,
    #[serde(default)]
    pub background_blur: Option<f32>,
    #[serde(default)]
    pub background_opacity: Option<f32>,

    // Border enhancements
    #[serde(default)]
    pub border_style: Option<String>, // "solid", "dashed", "dotted"
    #[serde(default)]
    pub border_width: Option<f32>,
    #[serde(default)]
    pub border_color: Option<String>,

    // Chat bubble
    #[serde(default)]
    pub chat_bubble: Option<ChatBubbleConfig>,

    // Animation preset
    #[serde(default)]
    pub animation_preset: Option<TextAnimationPreset>,
}

impl Default for TextOverlayStyle {
    fn default() -> Self {
        Self {
            font_family: "Montserrat".to_string(),
            font_size: 32.0,
            font_weight: 700,
            color: "#ffffff".to_string(),
            background_color: None,
            background_enabled: false,
            highlight_color: Some("#FFFF00".to_string()),
            border1_width: 2.0,
            border1_color: Some("#000000".to_string()),
            border2_width: 0.0,
            border2_color: Some("#000000".to_string()),
            stroke_enabled: false,
            stroke_color: Some("#000000".to_string()),
            stroke_width: 1.0,
            shadow_enabled: true,
            shadow_color: Some("#000000".to_string()),
            shadow_blur: 4.0,
            shadow_offset_x: 2.0,
            shadow_offset_y: 2.0,
            border_radius: 4.0,
            padding: 8.0,
            letter_spacing: 0.0,
            line_height: 1.2,
            word_spacing: 0.35,
            text_align: Some("center".to_string()),
            max_width: 90.0,
            width: None,
            text_offset_x: 0.0,
            text_offset_y: 0.0,
            // Extended properties
            text_transform: None,
            text_decoration: None,
            gradient: None,
            glow: None,
            shadows: None,
            background_gradient: None,
            background_blur: None,
            background_opacity: None,
            border_style: None,
            border_width: None,
            border_color: None,
            chat_bubble: None,
            animation_preset: None,
        }
    }
}

/// Per-aspect-ratio configuration for text overlays
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextOverlayRatioConfig {
    pub position: TextOverlayPosition,
    pub style: TextOverlayStyle,
}

/// Text overlay position as x/y coordinates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextOverlayPosition {
    pub x: f64, // 0-100 percentage
    pub y: f64, // 0-100 percentage
}

/// Text overlay settings for export
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextOverlaySettings {
    pub id: String,
    pub text: String,
    pub start_time: f64,
    pub end_time: f64,
    pub position_x: f64, // 0-100 percentage (default position)
    pub position_y: f64, // 0-100 percentage (default position)
    pub style: TextOverlayStyle,
    pub animation: String,
    /// Per-aspect-ratio configurations (key is ratio like "16:9", "9:16")
    #[serde(default)]
    pub per_ratio_configs: Option<std::collections::HashMap<String, TextOverlayRatioConfig>>,
    /// The height of the preview container in pixels when the overlay was configured.
    /// This is used to calculate the correct scaling factor for export.
    /// Font sizes are relative to this height, so we scale by (output_height / preview_height).
    #[serde(default)]
    pub preview_height: Option<f64>,
}

// ============================================================================
// STICKER OVERLAY TYPES
// ============================================================================

/// Per-aspect-ratio configuration for stickers
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StickerRatioConfig {
    pub position: StickerPosition,
    pub scale: f64,
    pub rotation: f64,
}

/// Sticker position as x/y coordinates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StickerPosition {
    pub x: f64, // 0-100 percentage
    pub y: f64, // 0-100 percentage
}

/// Sticker overlay settings for export
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StickerSettings {
    pub id: String,
    pub sticker_path: String, // Path to sticker image or emoji character
    pub sticker_type: String, // "emoji" | "image" | "gif"
    pub start_time: f64,
    pub end_time: f64,
    pub position_x: f64, // 0-100 percentage (default position)
    pub position_y: f64, // 0-100 percentage (default position)
    pub scale: f64,      // 0.1-3 (default scale)
    pub rotation: f64,   // Degrees (default rotation)
    pub animation: String,
    /// Per-aspect-ratio configurations (key is ratio like "16:9", "9:16")
    #[serde(default)]
    pub per_ratio_configs: Option<std::collections::HashMap<String, StickerRatioConfig>>,
}

/// Pre-rendered subtitle overlay settings for pixel-perfect export.
/// Each overlay represents a single subtitle frame (rendered from frontend Canvas).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleOverlaySettings {
    /// Path to the pre-rendered PNG file
    pub image_path: String,
    /// Start time in seconds (relative to video timeline)
    pub start_time: f64,
    /// End time in seconds (relative to video timeline)
    pub end_time: f64,
    /// X position (center of text) as percentage of video width (0-100)
    pub position_x: f64,
    /// Y position (center of text) as percentage of video height (0-100)
    pub position_y: f64,
}

/// Per-aspect-ratio position config for a layout overlay
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayRatioConfig {
    #[serde(default = "default_50")]
    pub x: f64,
    #[serde(default = "default_50")]
    pub y: f64,
    #[serde(default)]
    pub width: f64,
    #[serde(default)]
    pub height: f64,
    #[serde(default = "default_100")]
    pub opacity: f64,
    #[serde(default)]
    pub rotation: f64,
    #[serde(default = "default_overlay_scale")]
    pub scale: f64,
    #[serde(default)]
    pub is_full_frame_overlay: Option<bool>,
}

fn default_50() -> f64 {
    50.0
}
fn default_100() -> f64 {
    100.0
}

/// Layout overlay settings for VOD preset overlays (borders, dividers, decorative elements)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayoutOverlaySettings {
    pub id: String,
    pub image_path: String, // Local file path to uploaded PNG
    #[serde(default = "default_50")]
    pub x: f64, // 0-100 percentage position (center-based)
    #[serde(default = "default_50")]
    pub y: f64, // 0-100 percentage position (center-based)
    #[serde(default)]
    pub width: f64, // 0-100 percentage of target frame width (legacy)
    #[serde(default)]
    pub height: f64, // 0-100 percentage of target frame height (legacy)
    #[serde(default = "default_100")]
    pub opacity: f64, // 0-100
    #[serde(default)]
    pub rotation: f64, // degrees
    #[serde(default = "default_overlay_scale")]
    pub scale: f64, // 0-100 percentage scale (like watermark)
    #[serde(default)]
    pub is_full_frame_overlay: Option<bool>, // When true, position at 0,0 with 100% scale
    #[serde(default)]
    pub label: Option<String>,
    /// Per-aspect-ratio configurations (key is ratio like "16:9", "9:16")
    #[serde(default)]
    pub per_ratio_settings: Option<std::collections::HashMap<String, Option<OverlayRatioConfig>>>,
}

fn default_overlay_scale() -> f64 {
    20.0
}

/// Clip watermark ratio config for per-aspect-ratio positioning
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipWatermarkRatioConfig {
    pub position: StickerPosition, // Reuse StickerPosition (x/y percentage)
    pub scale: f64,                // percentage of video width
    pub opacity: f64,              // 0-100
    #[serde(default)]
    pub is_full_frame_overlay: Option<bool>, // When true, position at 0,0 with 100% scale
}

/// Clip watermark overlay settings for export (from clip editor)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipWatermarkSettings {
    pub id: String,
    pub watermark_path: String, // Path to watermark image file
    pub start_time: f64,
    pub end_time: f64,
    pub position_x: f64, // 0-100 percentage (default position)
    pub position_y: f64, // 0-100 percentage (default position)
    pub scale: f64,      // percentage of video width (default scale)
    pub opacity: f64,    // 0-100 (default opacity)
    /// Per-aspect-ratio configurations (key is ratio like "16:9", "9:16")
    #[serde(default)]
    pub per_ratio_configs: Option<std::collections::HashMap<String, ClipWatermarkRatioConfig>>,
}

// ============================================================================
// INTRO/OUTRO PER-RATIO TYPES
// ============================================================================

/// Per-aspect-ratio intro/outro configuration
/// Allows using different intro/outro videos for different aspect ratios
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntroOutroPerRatioConfig {
    #[serde(default)]
    pub intro_path: Option<String>,
    #[serde(default)]
    pub intro_duration: Option<f64>,
    #[serde(default)]
    pub outro_path: Option<String>,
    #[serde(default)]
    pub outro_duration: Option<f64>,
}
