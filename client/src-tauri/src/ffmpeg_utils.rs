use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct VideoInfo {
    pub width: u32,
    pub height: u32,
    pub codec: String,
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
pub fn parse_ffmpeg_time(time_str: &str) -> Option<f64> {
    // Parse format HH:MM:SS.ms or HH:MM:SS
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() != 3 {
        return None;
    }

    let hours: f64 = parts[0].parse().ok()?;
    let minutes: f64 = parts[1].parse().ok()?;
    let seconds: f64 = parts[2].parse().ok()?;

    Some(hours * 3600.0 + minutes * 60.0 + seconds)
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

    match (width, height, codec) {
        (Some(w), Some(h), Some(c)) => Ok(VideoInfo { width: w, height: h, codec: c }),
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
            "-f", "null",
            "-",
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
            "-f", "null",
            "-"
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg info: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    parse_video_info_from_ffmpeg_output(&stderr)
}