use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

use crate::storage;

/// Basic file information returned by get_file_info
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub size: u64,
    pub extension: String,
}

/// Media metadata returned by get_media_metadata
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MediaMetadata {
    pub duration: f64,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

/// Get basic file info (name, size, extension) for any file path.
#[tauri::command]
pub async fn get_file_info(path: String) -> Result<FileInfo, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let metadata = std::fs::metadata(p)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;

    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let extension = p
        .extension()
        .map(|e| e.to_string_lossy().to_string().to_lowercase())
        .unwrap_or_default();

    Ok(FileInfo {
        name,
        size: metadata.len(),
        extension,
    })
}

/// Get media metadata (duration, width, height) for video or audio files using FFmpeg.
#[tauri::command]
pub async fn get_media_metadata(app: AppHandle, path: String) -> Result<MediaMetadata, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let output = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to create ffmpeg sidecar: {}", e))?
        .args(["-nostdin", "-i", &path, "-f", "null", "-"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);

    // Parse duration
    let duration = parse_duration_from_stderr(&stderr).unwrap_or(0.0);

    // Parse resolution
    let (width, height) = parse_resolution_from_stderr(&stderr);

    Ok(MediaMetadata {
        duration,
        width,
        height,
    })
}

/// Generate a thumbnail image from a video at a given timestamp.
/// Returns the path to the generated thumbnail PNG.
#[tauri::command]
pub async fn generate_video_thumbnail(
    app: AppHandle,
    video_path: String,
    timestamp: f64,
) -> Result<String, String> {
    let p = Path::new(&video_path);
    if !p.exists() {
        return Err(format!("Video file does not exist: {}", video_path));
    }

    let paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;
    let thumb_dir = paths.temp.join("thumbnails");
    std::fs::create_dir_all(&thumb_dir)
        .map_err(|e| format!("Failed to create thumbnail dir: {}", e))?;

    // Generate a unique filename based on source path hash + timestamp
    let hash = simple_hash(&video_path);
    let thumb_path = thumb_dir.join(format!("thumb_{}_{}.png", hash, (timestamp * 1000.0) as u64));

    // Return existing thumbnail if it exists
    if thumb_path.exists() {
        return Ok(thumb_path.to_string_lossy().to_string());
    }

    let thumb_path_str = thumb_path.to_string_lossy().to_string();

    let output = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to create ffmpeg sidecar: {}", e))?
        .args([
            "-y",
            "-ss",
            &format!("{:.3}", timestamp),
            "-i",
            &video_path,
            "-vframes",
            "1",
            "-q:v",
            "5",
            &thumb_path_str,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    if !output.status.success() && !thumb_path.exists() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Thumbnail generation failed: {}", stderr));
    }

    Ok(thumb_path_str)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn parse_duration_from_stderr(stderr: &str) -> Option<f64> {
    // Match "Duration: HH:MM:SS.ss"
    let re = regex::Regex::new(r"Duration:\s*(\d+):(\d+):(\d+)\.(\d+)").ok()?;
    let caps = re.captures(stderr)?;
    let hours: f64 = caps.get(1)?.as_str().parse().ok()?;
    let minutes: f64 = caps.get(2)?.as_str().parse().ok()?;
    let seconds: f64 = caps.get(3)?.as_str().parse().ok()?;
    let centiseconds: f64 = caps.get(4)?.as_str().parse().ok()?;
    Some(hours * 3600.0 + minutes * 60.0 + seconds + centiseconds / 100.0)
}

fn parse_resolution_from_stderr(stderr: &str) -> (Option<u32>, Option<u32>) {
    let re = match regex::Regex::new(r"(\d{2,5})x(\d{2,5})") {
        Ok(r) => r,
        Err(_) => return (None, None),
    };
    for line in stderr.lines() {
        if line.contains("Video:") {
            if let Some(caps) = re.captures(line) {
                let w: Option<u32> = caps.get(1).and_then(|m| m.as_str().parse().ok());
                let h: Option<u32> = caps.get(2).and_then(|m| m.as_str().parse().ok());
                return (w, h);
            }
        }
    }
    (None, None)
}

fn simple_hash(s: &str) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    hasher.finish()
}
