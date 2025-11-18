use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use regex::Regex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocalPointData {
    pub time_offset: f64,
    pub focal_x: f64,
    pub focal_y: f64,
    pub confidence: f64,
}

/// Detect focal points in a video at regular intervals using FFmpeg
/// 
/// This function uses FFmpeg's cropdetect filter to analyze content boundaries
/// and determine the focal point (center of interest) at regular time intervals.
/// 
/// # Arguments
/// * `app` - Tauri app handle for shell access
/// * `video_path` - Path to the video file
/// * `interval_seconds` - Time interval between focal point samples (default: 5 seconds)
/// 
/// # Returns
/// Vector of focal point data with time offsets and coordinates (0.0-1.0 range)
pub async fn detect_focal_points(
    app: &AppHandle,
    video_path: &str,
    interval_seconds: u32,
) -> Result<Vec<FocalPointData>, String> {
    println!("[FocalDetection] Starting focal point detection for: {}", video_path);
    println!("[FocalDetection] Interval: {} seconds", interval_seconds);

    // Step 1: Get video information (duration, dimensions, fps)
    let video_info = get_video_info_for_focal_detection(app, video_path).await?;
    println!("[FocalDetection] Video info: {}x{}, duration: {:.2}s, fps: {:.2}",
             video_info.width, video_info.height, video_info.duration, video_info.fps);

    // Step 2: Calculate frame interval based on FPS and desired time interval
    let frame_interval = (video_info.fps * interval_seconds as f64) as u32;
    println!("[FocalDetection] Frame interval: {} frames", frame_interval);

    // Step 3: Run FFmpeg with cropdetect filter to analyze content boundaries
    let focal_points = run_cropdetect_analysis(
        app,
        video_path,
        &video_info,
        frame_interval,
        interval_seconds,
    ).await?;

    println!("[FocalDetection] Detected {} focal points", focal_points.len());
    Ok(focal_points)
}

/// Video information needed for focal point detection
#[derive(Debug)]
struct VideoInfoForDetection {
    width: u32,
    height: u32,
    duration: f64,
    fps: f64,
}

/// Get video information including FPS
async fn get_video_info_for_focal_detection(
    app: &AppHandle,
    video_path: &str,
) -> Result<VideoInfoForDetection, String> {
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
    
    // Parse video dimensions
    let (width, height) = parse_video_dimensions(&stderr)
        .ok_or("Failed to parse video dimensions")?;
    
    // Parse duration
    let duration = parse_duration(&stderr)
        .ok_or("Failed to parse video duration")?;
    
    // Parse FPS
    let fps = parse_fps(&stderr)
        .unwrap_or(30.0); // Default to 30fps if can't parse

    Ok(VideoInfoForDetection {
        width,
        height,
        duration,
        fps,
    })
}

/// Parse video dimensions from FFmpeg output
fn parse_video_dimensions(output: &str) -> Option<(u32, u32)> {
    let re = Regex::new(r"(\d{3,5})x(\d{3,5})").ok()?;
    
    for line in output.lines() {
        if line.contains("Video:") {
            if let Some(captures) = re.captures(line) {
                let width: u32 = captures.get(1)?.as_str().parse().ok()?;
                let height: u32 = captures.get(2)?.as_str().parse().ok()?;
                return Some((width, height));
            }
        }
    }
    None
}

/// Parse video duration from FFmpeg output
fn parse_duration(output: &str) -> Option<f64> {
    let re = Regex::new(r"Duration: (\d{2}):(\d{2}):([\d.]+)").ok()?;
    
    if let Some(captures) = re.captures(output) {
        let hours: f64 = captures.get(1)?.as_str().parse().ok()?;
        let minutes: f64 = captures.get(2)?.as_str().parse().ok()?;
        let seconds: f64 = captures.get(3)?.as_str().parse().ok()?;
        
        Some(hours * 3600.0 + minutes * 60.0 + seconds)
    } else {
        None
    }
}

/// Parse FPS from FFmpeg output
fn parse_fps(output: &str) -> Option<f64> {
    let re = Regex::new(r"(\d+(?:\.\d+)?)\s*fps").ok()?;
    
    for line in output.lines() {
        if line.contains("Video:") {
            if let Some(captures) = re.captures(line) {
                return captures.get(1)?.as_str().parse().ok();
            }
        }
    }
    None
}

/// Run cropdetect analysis to find focal points
async fn run_cropdetect_analysis(
    app: &AppHandle,
    video_path: &str,
    video_info: &VideoInfoForDetection,
    frame_interval: u32,
    interval_seconds: u32,
) -> Result<Vec<FocalPointData>, String> {
    let shell = app.shell();
    
    // NOTE: cropdetect only detects black borders, not speakers or regions of interest
    // For proper speaker detection, we would need face detection or ML-based analysis
    // Current implementation provides center-weighted focal points as fallback
    
    // Build the filter string for cropdetect with frame selection
    // select='not(mod(n,INTERVAL))' selects every Nth frame
    // cropdetect analyzes the content boundaries with some tolerance
    let filter_string = format!("select='not(mod(n\\,{}))',cropdetect=24:16:0", frame_interval);
    
    println!("[FocalDetection] Running FFmpeg cropdetect with filter: {}", filter_string);
    println!("[FocalDetection] WARNING: cropdetect only detects borders, not speakers or faces");
    
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", video_path,
            "-vf", &filter_string,
            "-f", "null",
            "-",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg cropdetect: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    
    // Parse cropdetect output
    let focal_points = parse_cropdetect_output(
        &stderr,
        video_info,
        interval_seconds as f64,
    );

    // If no focal points were detected, return center point for start and end
    if focal_points.is_empty() {
        println!("[FocalDetection] No crop data detected, using center focal point");
        return Ok(vec![
            FocalPointData {
                time_offset: 0.0,
                focal_x: 0.5,
                focal_y: 0.5,
                confidence: 0.5,
            },
            FocalPointData {
                time_offset: video_info.duration,
                focal_x: 0.5,
                focal_y: 0.5,
                confidence: 0.5,
            },
        ]);
    }

    Ok(focal_points)
}

/// Parse cropdetect output to extract focal points
fn parse_cropdetect_output(
    output: &str,
    video_info: &VideoInfoForDetection,
    interval_seconds: f64,
) -> Vec<FocalPointData> {
    // Regex to match cropdetect output lines
    // Example: [Parsed_cropdetect_1 @ 0x...] x1:0 x2:1919 y1:0 y2:1079
    let re = Regex::new(r"cropdetect.*x1:(\d+)\s+x2:(\d+)\s+y1:(\d+)\s+y2:(\d+)").ok();
    
    if re.is_none() {
        return Vec::new();
    }
    let re = re.unwrap();

    let mut focal_points = Vec::new();
    let mut current_time = 0.0;

    for line in output.lines() {
        if let Some(captures) = re.captures(line) {
            let x1: f64 = captures.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(0.0);
            let x2: f64 = captures.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(video_info.width as f64);
            let y1: f64 = captures.get(3).and_then(|m| m.as_str().parse().ok()).unwrap_or(0.0);
            let y2: f64 = captures.get(4).and_then(|m| m.as_str().parse().ok()).unwrap_or(video_info.height as f64);

            // Calculate the center of the detected crop area (this is our focal point)
            let crop_center_x = (x1 + x2) / 2.0;
            let crop_center_y = (y1 + y2) / 2.0;

            // Normalize to 0.0-1.0 range
            let focal_x = crop_center_x / video_info.width as f64;
            let focal_y = crop_center_y / video_info.height as f64;

            // Calculate confidence based on crop area size
            // Larger crop area = higher confidence (more content detected)
            let crop_width = x2 - x1;
            let crop_height = y2 - y1;
            let crop_area = crop_width * crop_height;
            let total_area = (video_info.width * video_info.height) as f64;
            let confidence = (crop_area / total_area).min(1.0).max(0.1);

            focal_points.push(FocalPointData {
                time_offset: current_time,
                focal_x: focal_x.clamp(0.0, 1.0),
                focal_y: focal_y.clamp(0.0, 1.0),
                confidence,
            });

            current_time += interval_seconds;
        }
    }

    focal_points
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_video_dimensions() {
        let output = "Stream #0:0: Video: h264, yuv420p, 1920x1080 [SAR 1:1 DAR 16:9], 30 fps";
        let (width, height) = parse_video_dimensions(output).unwrap();
        assert_eq!(width, 1920);
        assert_eq!(height, 1080);
    }

    #[test]
    fn test_parse_duration() {
        let output = "Duration: 00:12:34.56, start: 0.000000, bitrate: 5000 kb/s";
        let duration = parse_duration(output).unwrap();
        assert!((duration - 754.56).abs() < 0.01);
    }

    #[test]
    fn test_parse_fps() {
        let output = "Stream #0:0: Video: h264, 1920x1080, 30 fps, 30 tbr";
        let fps = parse_fps(output).unwrap();
        assert!((fps - 30.0).abs() < 0.01);
    }
}

