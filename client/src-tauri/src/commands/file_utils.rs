use serde::Serialize;
use tauri::command;

#[derive(Debug, Serialize)]
pub struct FileInfo {
    pub name: String,
    pub size: u64,
    pub extension: String,
}

#[derive(Debug, Serialize)]
pub struct MediaMetadata {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub codec: String,
    pub bitrate: Option<u64>,
}

#[command]
pub async fn get_file_info(path: String) -> Result<FileInfo, String> {
    use std::path::Path;
    
    let file_path = Path::new(&path);
    
    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }
    
    let metadata = std::fs::metadata(&path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    
    let name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    
    let extension = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_string();
    
    Ok(FileInfo {
        name,
        size: metadata.len(),
        extension,
    })
}

#[command]
pub async fn get_media_metadata(app: tauri::AppHandle, path: String) -> Result<MediaMetadata, String> {
    use tauri_plugin_shell::ShellExt;
    
    let output = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to create ffmpeg sidecar: {}", e))?
        .args([
            "-nostdin",
            "-i", &path,
            "-f", "null",
            "-"
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to execute ffprobe: {}", e))?;
    
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    // Parse duration
    let duration_re = regex::Regex::new(r"Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})")
        .map_err(|e| format!("Regex error: {}", e))?;
    
    let duration = if let Some(caps) = duration_re.captures(&stderr) {
        let hours: f64 = caps[1].parse().unwrap_or(0.0);
        let minutes: f64 = caps[2].parse().unwrap_or(0.0);
        let seconds: f64 = caps[3].parse().unwrap_or(0.0);
        hours * 3600.0 + minutes * 60.0 + seconds
    } else {
        return Err("Could not parse duration".to_string());
    };
    
    // Parse resolution
    let resolution_re = regex::Regex::new(r"(\d{2,5})x(\d{2,5})")
        .map_err(|e| format!("Regex error: {}", e))?;
    
    let (width, height) = if let Some(caps) = resolution_re.captures(&stderr) {
        (
            caps[1].parse().unwrap_or(0),
            caps[2].parse().unwrap_or(0)
        )
    } else {
        return Err("Could not parse resolution".to_string());
    };
    
    // Parse codec
    let codec = if stderr.contains("h264") {
        "h264".to_string()
    } else if stderr.contains("hevc") {
        "hevc".to_string()
    } else if stderr.contains("vp9") {
        "vp9".to_string()
    } else {
        "unknown".to_string()
    };
    
    Ok(MediaMetadata {
        duration,
        width,
        height,
        codec,
        bitrate: None,
    })
}

#[command]
pub async fn generate_video_thumbnail(
    app: tauri::AppHandle,
    video_path: String,
    output_path: String,
    timestamp: f64,
) -> Result<String, String> {
    use tauri_plugin_shell::ShellExt;
    
    let output = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to create ffmpeg sidecar: {}", e))?
        .args([
            "-nostdin",
            "-ss", &timestamp.to_string(),
            "-i", &video_path,
            "-vframes", "1",
            "-q:v", "2",
            "-y",
            &output_path
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to generate thumbnail: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg error: {}", stderr));
    }
    
    Ok(output_path)
}
