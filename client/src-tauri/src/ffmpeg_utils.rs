use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct VideoInfo {
    pub width: u32,
    pub height: u32,
    pub codec: String,
    pub duration: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoValidationResult {
    pub is_valid: bool,
    pub error: Option<String>,
    pub duration: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub codec: Option<String>,
    pub file_size: Option<u64>,
}

/// Extract video duration from FFmpeg stderr output
pub fn extract_duration_from_ffmpeg_output(output: &str) -> Option<f64> {
    // Look for duration in format: Duration: 00:01:23.45
    for line in output.lines() {
        if line.contains("Duration:") {
            if let Some(duration_start) = line.find("Duration: ") {
                let duration_part = &line[duration_start + 10..];
                if let Some(comma_pos) = duration_part.find(',') {
                    let duration_str = &duration_part[..comma_pos];
                    return parse_duration_string(duration_str);
                }
            }
        }
    }
    None
}

/// Parse duration string in HH:MM:SS.ms format
pub fn parse_duration_string(duration_str: &str) -> Option<f64> {
    // Parse format HH:MM:SS.ms
    let parts: Vec<&str> = duration_str.split(':').collect();
    if parts.len() != 3 {
        return None;
    }

    let hours: f64 = parts[0].parse().ok()?;
    let minutes: f64 = parts[1].parse().ok()?;
    let seconds: f64 = parts[2].parse().ok()?;

    Some(hours * 3600.0 + minutes * 60.0 + seconds)
}

/// Parse FFmpeg time output in HH:MM:SS.ms format
/// Handles negative times (e.g., "-00:00:00.001234") that FFmpeg outputs at start of HLS downloads
pub fn parse_ffmpeg_time(time_str: &str) -> Option<f64> {
    // Check for negative time (FFmpeg outputs this at start of HLS streams)
    let (is_negative, time_str) = if let Some(stripped) = time_str.strip_prefix('-') {
        (true, stripped)
    } else {
        (false, time_str)
    };
    
    // Parse format HH:MM:SS.ms or HH:MM:SS
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() != 3 {
        return None;
    }

    let hours: f64 = parts[0].parse().ok()?;
    let minutes: f64 = parts[1].parse().ok()?;
    let seconds: f64 = parts[2].parse().ok()?;

    let total = hours * 3600.0 + minutes * 60.0 + seconds;
    
    if is_negative {
        Some(-total)
    } else {
        Some(total)
    }
}

/// Parse video information from FFmpeg output
pub fn parse_video_info_from_ffmpeg_output(output: &str) -> Result<VideoInfo, String> {
    // Parse video stream info from FFmpeg output
    let mut width = None;
    let mut height = None;
    let mut codec = None;

    for line in output.lines() {
        if line.contains("Video:") {
            // Extract resolution
            if let Some(res_start) = line.find('(') {
                if let Some(res_end) = line[res_start..].find(')') {
                    let res_end_absolute = res_start + res_end;
                    let resolution = &line[res_start + 1..res_end_absolute];
                    if let Some(space_pos) = resolution.find(' ') {
                        let res_parts: Vec<&str> = resolution[..space_pos].split('x').collect();
                        if res_parts.len() == 2 {
                            width = res_parts[0].parse().ok();
                            height = res_parts[1].parse().ok();
                        }
                    }
                }
            }

            // Extract codec
            if let Some(codec_start) = line.find("Video: ") {
                let codec_part = &line[codec_start + 7..];
                if let Some(space_pos) = codec_part.find(' ') {
                    codec = Some(codec_part[..space_pos].to_string());
                }
            }
        }
    }

    // Also extract duration from the output
    let duration = extract_duration_from_ffmpeg_output(output);

    match (width, height, codec) {
        (Some(w), Some(h), Some(c)) => Ok(VideoInfo { width: w, height: h, codec: c, duration }),
        _ => Err("Could not parse video info".to_string()),
    }
}

/// Parse duration from FFmpeg output (Result version for better error handling)
pub fn parse_duration_from_ffmpeg_output(stderr: &str) -> Result<f64, String> {
    use regex::Regex;

    // Look for duration line in FFmpeg output: "Duration: 00:12:34.56"
    let re = Regex::new(r"Duration: (\d{2}):(\d{2}):([\d.]+)")
        .map_err(|e| format!("Failed to create regex: {}", e))?;

    if let Some(captures) = re.captures(stderr) {
        let hours: f64 = captures.get(1).unwrap().as_str().parse()
            .map_err(|e| format!("Failed to parse hours: {}", e))?;
        let minutes: f64 = captures.get(2).unwrap().as_str().parse()
            .map_err(|e| format!("Failed to parse minutes: {}", e))?;
        let seconds: f64 = captures.get(3).unwrap().as_str().parse()
            .map_err(|e| format!("Failed to parse seconds: {}", e))?;

        let total_seconds = hours * 3600.0 + minutes * 60.0 + seconds;
        println!("[Rust] Parsed duration: {}h {}m {:.2}s = {:.2} seconds",
                hours, minutes, seconds, total_seconds);

        Ok(total_seconds)
    } else {
        Err("Duration not found in FFmpeg output".to_string())
    }
}

/// Get video duration using FFmpeg
pub async fn get_video_duration_sync(app: &tauri::AppHandle, video_path: &str) -> Result<f64, String> {
    use tauri_plugin_shell::ShellExt;

    let shell = app.shell();
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", video_path,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    match extract_duration_from_ffmpeg_output(&stderr) {
        Some(duration) => Ok(duration),
        None => Err("Failed to parse duration".to_string()),
    }
}

/// Get video information using FFmpeg
pub async fn get_video_info(app: &tauri::AppHandle, video_path: &std::path::Path) -> Result<VideoInfo, String> {
    use tauri_plugin_shell::ShellExt;

    let output = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", video_path.to_str().ok_or("Invalid video path")?,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg info: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    parse_video_info_from_ffmpeg_output(&stderr)
}

/// Detect available hardware encoder
pub async fn detect_hardware_encoder(app: &tauri::AppHandle) -> Option<String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] Detecting hardware encoders...");

    let output = match app.shell().sidecar("ffmpeg") {
        Ok(ffmpeg) => {
            match ffmpeg.args(["-encoders"]).output().await {
                Ok(out) => out,
                Err(e) => {
                    println!("[Rust] Failed to run ffmpeg -encoders: {}", e);
                    return None;
                }
            }
        }
        Err(e) => {
            println!("[Rust] Failed to get ffmpeg sidecar: {}", e);
            return None;
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Order of preference for hardware encoders
    let encoders = [
        ("h264_nvenc", "NVIDIA NVENC"),
        ("h264_amf", "AMD AMF"),
        ("h264_qsv", "Intel QSV"),
        ("h264_videotoolbox", "macOS VideoToolbox"),
        ("h264_vaapi", "VAAPI"),
    ];

    for (encoder, name) in encoders.iter() {
        // Look for the encoder in the output (format is usually " V..... encoder_name ")
        if stdout.contains(encoder) {
            println!("[Rust] Found hardware encoder: {} ({})", name, encoder);
            return Some(encoder.to_string());
        }
    }

    println!("[Rust] No hardware encoder found, falling back to software (libx264)");
    None
}

// ============================================================================
// CROSSFADE TRANSITION TYPES AND UTILITIES
// For the video editor when sources overlap
// ============================================================================

/// Represents a crossfade transition between two video sources
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossfadeTransition {
    /// Duration of the crossfade in seconds
    pub duration: f64,
    /// When the transition starts (global timeline position)
    pub start_time: f64,
    /// When the transition ends (global timeline position)
    pub end_time: f64,
    /// Index of the outgoing source (source A)
    pub source_a_index: usize,
    /// Index of the incoming source (source B)
    pub source_b_index: usize,
}

/// Represents a video source segment for the editor export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoSourceSegment {
    /// Path to the video file
    pub path: String,
    /// Start position in the global timeline
    pub timeline_start: f64,
    /// End position in the global timeline
    pub timeline_end: f64,
    /// Trim start (offset into the source file)
    pub trim_start: f64,
    /// Trim end (how far into source file to use, None = full)
    pub trim_end: Option<f64>,
}

/// Build FFmpeg filter complex string for crossfade transitions between sources
/// 
/// # Arguments
/// * `sources` - Vector of source segments in timeline order
/// * `transitions` - Vector of crossfade transitions between sources
/// * `output_width` - Target output width
/// * `output_height` - Target output height
/// 
/// # Returns
/// Tuple of (filter_complex_string, output_stream_name)
#[allow(dead_code)]
pub fn build_crossfade_filter_complex(
    sources: &[VideoSourceSegment],
    transitions: &[CrossfadeTransition],
    output_width: u32,
    output_height: u32,
) -> (String, String) {
    if sources.is_empty() {
        return (String::new(), String::new());
    }

    if sources.len() == 1 || transitions.is_empty() {
        // Single source or no transitions - just scale to output size
        let filter = format!(
            "[0:v]scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2[outv]",
            output_width, output_height, output_width, output_height
        );
        return (filter, "[outv]".to_string());
    }

    let mut filter_parts: Vec<String> = Vec::new();

    // First, scale all inputs to the same size
    for i in 0..sources.len() {
        filter_parts.push(format!(
            "[{}:v]scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2[v{}]",
            i, output_width, output_height, output_width, output_height, i
        ));
    }

    // Apply crossfades sequentially
    let mut last_stream = "[v0]".to_string();
    
    for (i, transition) in transitions.iter().enumerate() {
        let next_stream = format!("[v{}]", transition.source_b_index);
        let output_stream = if i == transitions.len() - 1 {
            "[outv]".to_string()
        } else {
            format!("[xfade{}]", i)
        };

        // Calculate offset: when in the first stream to start the xfade
        // The offset is relative to the first stream's duration
        let source_a = &sources[transition.source_a_index];
        let source_a_duration = source_a.timeline_end - source_a.timeline_start;
        let offset = source_a_duration - transition.duration;

        filter_parts.push(format!(
            "{}{}xfade=transition=fade:duration={:.3}:offset={:.3}{}",
            last_stream,
            next_stream,
            transition.duration,
            offset.max(0.0),
            output_stream
        ));

        last_stream = output_stream.clone();
    }

    (filter_parts.join(";"), last_stream)
}

/// Build FFmpeg audio crossfade filter for smooth audio transitions
/// 
/// # Arguments
/// * `sources_count` - Number of audio streams
/// * `transitions` - Vector of crossfade transitions
/// 
/// # Returns
/// Tuple of (audio_filter_string, output_stream_name)
#[allow(dead_code)]
pub fn build_audio_crossfade_filter(
    sources: &[VideoSourceSegment],
    transitions: &[CrossfadeTransition],
) -> (String, String) {
    if sources.is_empty() {
        return (String::new(), String::new());
    }

    if sources.len() == 1 || transitions.is_empty() {
        // Single source - just pass through
        return ("[0:a]anull[outa]".to_string(), "[outa]".to_string());
    }

    let mut filter_parts: Vec<String> = Vec::new();
    let mut last_stream = "[0:a]".to_string();

    for (i, transition) in transitions.iter().enumerate() {
        let next_stream = format!("[{}:a]", transition.source_b_index);
        let output_stream = if i == transitions.len() - 1 {
            "[outa]".to_string()
        } else {
            format!("[axfade{}]", i)
        };

        // Calculate offset for audio crossfade
        let source_a = &sources[transition.source_a_index];
        let source_a_duration = source_a.timeline_end - source_a.timeline_start;
        let _offset = source_a_duration - transition.duration;

        filter_parts.push(format!(
            "{}{}acrossfade=d={:.3}:c1=tri:c2=tri{}",
            last_stream,
            next_stream,
            transition.duration,
            output_stream
        ));

        last_stream = output_stream.clone();
    }

    (filter_parts.join(";"), last_stream)
}

/// Detect transitions between overlapping source segments
/// 
/// # Arguments
/// * `sources` - Vector of source segments, should be sorted by timeline_start
/// 
/// # Returns
/// Vector of detected crossfade transitions
#[allow(dead_code)]
pub fn detect_source_transitions(sources: &[VideoSourceSegment]) -> Vec<CrossfadeTransition> {
    let mut transitions = Vec::new();

    for i in 0..sources.len().saturating_sub(1) {
        let source_a = &sources[i];
        let source_b = &sources[i + 1];

        // Check if sources overlap
        if source_a.timeline_end > source_b.timeline_start {
            let overlap_start = source_b.timeline_start;
            let overlap_end = source_a.timeline_end.min(source_b.timeline_end);
            let duration = overlap_end - overlap_start;

            if duration > 0.0 {
                transitions.push(CrossfadeTransition {
                    duration,
                    start_time: overlap_start,
                    end_time: overlap_end,
                    source_a_index: i,
                    source_b_index: i + 1,
                });
            }
        }
    }

    transitions
}
