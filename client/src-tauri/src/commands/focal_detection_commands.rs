use tauri::AppHandle;
use crate::focal_detection::{detect_focal_points as detect_focal_points_impl, FocalPointData};

/// Tauri command to detect focal points in a video
/// 
/// This command analyzes a video file to detect focal points (centers of interest)
/// at regular intervals using FFmpeg's cropdetect filter.
/// 
/// # Arguments
/// * `app` - Tauri app handle
/// * `video_path` - Path to the video file to analyze
/// * `interval_seconds` - Time interval between focal point samples (default: 5 seconds)
/// 
/// # Returns
/// Result containing vector of focal point data or error message
#[tauri::command]
pub async fn detect_focal_points(
    app: AppHandle,
    video_path: String,
    interval_seconds: Option<u32>,
) -> Result<Vec<FocalPointData>, String> {
    println!("[Command] detect_focal_points called for: {}", video_path);
    
    let interval = interval_seconds.unwrap_or(5);
    
    // Call the implementation
    let result = detect_focal_points_impl(&app, &video_path, interval).await;
    
    match &result {
        Ok(focal_points) => {
            println!("[Command] Successfully detected {} focal points", focal_points.len());
        }
        Err(e) => {
            println!("[Command] Focal point detection failed: {}", e);
        }
    }
    
    result
}

