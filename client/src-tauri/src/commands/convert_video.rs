use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[tauri::command]
pub async fn convert_video_to_mp4(app: AppHandle, input_path: String) -> Result<String, String> {
    let input = Path::new(&input_path);

    // Validate input file exists
    if !input.exists() {
        return Err(format!("Input file does not exist: {}", input_path));
    }

    // Get file extension
    let extension = input
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // If already MP4, return original path
    if extension == "mp4" {
        return Ok(input_path);
    }

    // Create output path in temp directory to avoid permission issues
    let temp_dir = std::env::temp_dir();
    let input_filename = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("overlay");
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let output_filename = format!("{}_{}.mp4", input_filename, timestamp);
    let output_path = temp_dir.join(output_filename);

    // Get FFmpeg path from app resources
    let ffmpeg_path = get_ffmpeg_path(&app)?;

    // Build FFmpeg command for fast conversion
    // -c:v libx264: H.264 video codec (widely supported)
    // -preset ultrafast: Fast encoding
    // -crf 23: Good quality
    // -c:a aac: AAC audio codec
    // -movflags +faststart: Optimize for web playback
    let mut cmd = Command::new(&ffmpeg_path);
    cmd.args(&[
            "-i",
            input.to_str().unwrap(),
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            "-y", // Overwrite output file
            output_path.to_str().unwrap(),
        ]);

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg conversion failed: {}", stderr));
    }

    // Verify output file was created
    if !output_path.exists() {
        return Err("Conversion completed but output file not found".to_string());
    }

    Ok(output_path.to_str().unwrap().to_string())
}

/// Download a URL and return its contents as a data URL (bypasses CORS)
#[tauri::command]
pub async fn download_url_as_data_url(url: String) -> Result<String, String> {
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download URL: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response bytes: {}", e))?;

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", content_type, b64))
}

fn get_ffmpeg_path(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        // Try bundled FFmpeg first
        if let Ok(resource_path) = app.path().resource_dir() {
            let bundled_ffmpeg = resource_path.join("ffmpeg.exe");
            if bundled_ffmpeg.exists() {
                return Ok(bundled_ffmpeg);
            }
        }

        // Fall back to system FFmpeg
        Ok(PathBuf::from("ffmpeg.exe"))
    }

    #[cfg(target_os = "macos")]
    {
        // Try bundled FFmpeg first
        if let Ok(resource_path) = app.path().resource_dir() {
            let bundled_ffmpeg = resource_path.join("ffmpeg");
            if bundled_ffmpeg.exists() {
                return Ok(bundled_ffmpeg);
            }
        }

        // Fall back to system FFmpeg
        Ok(PathBuf::from("ffmpeg"))
    }

    #[cfg(target_os = "linux")]
    {
        Ok(PathBuf::from("ffmpeg"))
    }
}
