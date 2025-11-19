use once_cell::sync::Lazy;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri_plugin_shell::ShellExt;
use regex::Regex;
use super::types::AspectRatio;

// Video info cache for eliminating redundant ffmpeg probes
static VIDEO_INFO_CACHE: Lazy<Arc<Mutex<HashMap<String, crate::ffmpeg_utils::VideoInfo>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Intro/outro processing cache per build session
pub type IntroOutroCache = HashMap<(String, String, u32, u32, u32), std::path::PathBuf>;

// Helper function to parse aspect ratio string (e.g., "16:9") into AspectRatio struct
pub fn parse_aspect_ratio(ratio_str: &str) -> Result<AspectRatio, String> {
    let parts: Vec<&str> = ratio_str.split(':').collect();
    if parts.len() != 2 {
        return Err(format!("Invalid aspect ratio format: {}", ratio_str));
    }
    
    let width: f32 = parts[0].parse().map_err(|_| format!("Invalid width in aspect ratio: {}", parts[0]))?;
    let height: f32 = parts[1].parse().map_err(|_| format!("Invalid height in aspect ratio: {}", parts[1]))?;
    
    Ok(AspectRatio { width, height })
}

// Helper function to calculate cropping parameters for aspect ratio
pub fn calculate_crop_params(source_width: u32, source_height: u32, target_aspect: &AspectRatio) -> (u32, u32, u32, u32) {
    let source_aspect = source_width as f32 / source_height as f32;
    let target_aspect_value = target_aspect.width / target_aspect.height;
    
    let (crop_width, crop_height, crop_x, crop_y) = if source_aspect > target_aspect_value {
        // Source is wider - crop width
        let crop_width = (source_height as f32 * target_aspect_value) as u32;
        let crop_x = (source_width - crop_width) / 2;
        (crop_width, source_height, crop_x, 0)
    } else {
        // Source is taller - crop height
        let crop_height = (source_width as f32 / target_aspect_value) as u32;
        let crop_y = (source_height - crop_height) / 2;
        (source_width, crop_height, 0, crop_y)
    };
    
    (crop_width, crop_height, crop_x, crop_y)
}

// Helper function to calculate crop position (center crop)
pub fn calculate_crop_position(video_width: u32, video_height: u32, crop_w: u32, crop_h: u32) -> (u32, u32) {
    let crop_x = if video_width > crop_w {
        (video_width - crop_w) / 2
    } else {
        0
    };
    let crop_y = if video_height > crop_h {
        (video_height - crop_h) / 2
    } else {
        0
    };
    (crop_x, crop_y)
}

// Helper function to get video info with caching to eliminate redundant probes
pub async fn get_video_info(app: &tauri::AppHandle, video_path: &str) -> Result<crate::ffmpeg_utils::VideoInfo, String> {
    // Check cache first
    {
        let cache = VIDEO_INFO_CACHE.lock().unwrap();
        if let Some(info) = cache.get(video_path) {
            println!("[Rust] Using cached video info for: {}", video_path);
            return Ok(info.clone());
        }
    }
    
    // Not in cache, fetch from ffmpeg
    println!("[Rust] Fetching video info from ffmpeg for: {}", video_path);
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
        .map_err(|e| format!("Failed to run ffmpeg info: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    
    // Try the standard parser first
    let info = if let Ok(info) = crate::ffmpeg_utils::parse_video_info_from_ffmpeg_output(&stderr) {
        info
    } else {
        // If that fails, try alternative parsing
        println!("[Rust] Standard parsing failed, trying alternative method...");
        parse_video_info_alternative(&stderr)?
    };
    
    // Cache the result
    {
        let mut cache = VIDEO_INFO_CACHE.lock().unwrap();
        cache.insert(video_path.to_string(), info.clone());
    }
    
    Ok(info)
}

// Alternative video info parser that's more flexible
fn parse_video_info_alternative(output: &str) -> Result<crate::ffmpeg_utils::VideoInfo, String> {
    let mut width = None;
    let mut height = None;
    let mut codec = None;
    
    // Look for resolution pattern: 1920x1080 or 1280x720, etc.
    let res_regex = Regex::new(r"(\d{3,5})x(\d{3,5})").map_err(|e| format!("Regex error: {}", e))?;
    
    for line in output.lines() {
        if line.contains("Video:") {
            println!("[Rust] Video line: {}", line);
            
            // Extract codec (first word after "Video: ")
            if let Some(codec_start) = line.find("Video: ") {
                let codec_part = &line[codec_start + 7..];
                if let Some(space_pos) = codec_part.find(|c: char| c.is_whitespace() || c == ',') {
                    codec = Some(codec_part[..space_pos].trim().to_string());
                }
            }
            
            // Extract resolution using regex
            if let Some(captures) = res_regex.captures(line) {
                width = captures.get(1).and_then(|m| m.as_str().parse().ok());
                height = captures.get(2).and_then(|m| m.as_str().parse().ok());
            }
            
            if width.is_some() && height.is_some() && codec.is_some() {
                break;
            }
        }
    }
    
    match (width, height, &codec) {
        (Some(w), Some(h), Some(c)) => {
            println!("[Rust] Parsed video info: {}x{}, codec: {}", w, h, c);
            Ok(crate::ffmpeg_utils::VideoInfo { width: w, height: h, codec: c.clone() })
        },
        _ => {
            println!("[Rust] Failed to parse - width: {:?}, height: {:?}, codec: {:?}", width, height, codec);
            Err("Could not parse video dimensions or codec from FFmpeg output".to_string())
        }
    }
}

