use std::path::PathBuf;
use tauri::Manager;

/// Get the base storage directory for Clippster based on the OS
pub fn get_storage_base_dir() -> Result<PathBuf, String> {
    let base_dir = if cfg!(target_os = "windows") {
        // Windows: %LOCALAPPDATA%\Clippster
        std::env::var("LOCALAPPDATA")
            .map(PathBuf::from)
            .map_err(|_| "LOCALAPPDATA environment variable not found".to_string())?
            .join("Clippster")
    } else if cfg!(target_os = "macos") {
        // macOS: ~/Library/Application Support/Clippster
        dirs::home_dir()
            .ok_or("Unable to determine home directory".to_string())?
            .join("Library")
            .join("Application Support")
            .join("Clippster")
    } else {
        // Linux: ~/.local/share/clippster
        dirs::home_dir()
            .ok_or("Unable to determine home directory".to_string())?
            .join(".local")
            .join("share")
            .join("clippster")
    };

    Ok(base_dir)
}

/// Tauri command to delete a video file from the filesystem
#[tauri::command]
pub fn delete_video_file(file_path: String, thumbnail_path: Option<String>) -> Result<(), String> {
    use std::fs;
    use std::path::Path;
    
    let video_path = Path::new(&file_path);
    
    // Delete the video file if it exists
    if video_path.exists() {
        fs::remove_file(video_path)
            .map_err(|e| format!("Failed to delete video file: {}", e))?;
    }
    
    // Delete the thumbnail file if it exists
    if let Some(thumb_path) = thumbnail_path {
        let thumbnail = Path::new(&thumb_path);
        if thumbnail.exists() {
            // Ignore thumbnail deletion errors (not critical)
            let _ = fs::remove_file(thumbnail);
        }
    }
    
    Ok(())
}

/// Initialize storage directories, creating them if they don't exist
pub fn init_storage_dirs() -> Result<StoragePaths, String> {
    let base_dir = get_storage_base_dir()?;
    
    let paths = StoragePaths {
        base: base_dir.clone(),
        clips: base_dir.join("clips"),
        videos: base_dir.join("videos"),
        thumbnails: base_dir.join("thumbnails"),
        intros: base_dir.join("intros"),
        outros: base_dir.join("outros"),
        temp: base_dir.join("temp"),
    };

    // Create all directories
    std::fs::create_dir_all(&paths.clips)
        .map_err(|e| format!("Failed to create clips directory: {}", e))?;
    std::fs::create_dir_all(&paths.videos)
        .map_err(|e| format!("Failed to create videos directory: {}", e))?;
    std::fs::create_dir_all(&paths.thumbnails)
        .map_err(|e| format!("Failed to create thumbnails directory: {}", e))?;
    std::fs::create_dir_all(&paths.intros)
        .map_err(|e| format!("Failed to create intros directory: {}", e))?;
    std::fs::create_dir_all(&paths.outros)
        .map_err(|e| format!("Failed to create outros directory: {}", e))?;
    std::fs::create_dir_all(&paths.temp)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    println!("Clippster storage initialized at: {}", paths.base.display());
    println!("  Clips: {}", paths.clips.display());
    println!("  Videos: {}", paths.videos.display());
    println!("  Thumbnails: {}", paths.thumbnails.display());
    println!("  Intros: {}", paths.intros.display());
    println!("  Outros: {}", paths.outros.display());
    println!("  Temp: {}", paths.temp.display());

    Ok(paths)
}

/// Storage paths structure
#[derive(Debug, Clone)]
pub struct StoragePaths {
    pub base: PathBuf,
    pub clips: PathBuf,
    pub videos: PathBuf,
    pub thumbnails: PathBuf,
    pub intros: PathBuf,
    pub outros: PathBuf,
    pub temp: PathBuf,
}

/// Tauri command to get storage paths
#[tauri::command]
pub fn get_storage_paths() -> Result<StoragePathsResponse, String> {
    let paths = init_storage_dirs()?;
    
    Ok(StoragePathsResponse {
        base: paths.base.to_string_lossy().to_string(),
        clips: paths.clips.to_string_lossy().to_string(),
        videos: paths.videos.to_string_lossy().to_string(),
        thumbnails: paths.thumbnails.to_string_lossy().to_string(),
        intros: paths.intros.to_string_lossy().to_string(),
        outros: paths.outros.to_string_lossy().to_string(),
        temp: paths.temp.to_string_lossy().to_string(),
    })
}

/// Response structure for storage paths
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StoragePathsResponse {
    pub base: String,
    pub clips: String,
    pub videos: String,
    pub thumbnails: String,
    pub intros: String,
    pub outros: String,
    pub temp: String,
}

/// Response structure for copy_video_to_storage
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CopyVideoResponse {
    pub destination_path: String,
    pub original_filename: String,
}

/// Tauri command to generate a thumbnail from a video
#[tauri::command]
pub async fn generate_thumbnail(app: tauri::AppHandle, video_path: String) -> Result<String, String> {
    use std::path::Path;
    use tauri_plugin_shell::ShellExt;
    
    let video = Path::new(&video_path);
    
    // Validate video file exists
    if !video.exists() {
        return Err("Video file does not exist".to_string());
    }
    
    // Get storage paths
    let paths = init_storage_dirs()?;
    
    // Generate thumbnail filename based on video filename
    let video_stem = video
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Failed to get video filename")?;
    
    let thumbnail_filename = format!("{}_thumb.jpg", video_stem);
    let thumbnail_path = paths.thumbnails.join(&thumbnail_filename);
    
    // Use ffmpeg sidecar to generate thumbnail at 1 second mark
    let output = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", &video_path,
            "-ss", "00:00:01",
            "-vframes", "1",
            "-vf", "scale=320:-1",
            "-y",
            thumbnail_path.to_str().ok_or("Invalid thumbnail path")?,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffmpeg failed: {}", stderr));
    }
    
    Ok(thumbnail_path.to_string_lossy().to_string())
}

/// Tauri command to read a file as base64 data URL
#[tauri::command]
pub fn read_file_as_data_url(file_path: String) -> Result<String, String> {
    use std::fs;
    use std::path::Path;
    
    let path = Path::new(&file_path);
    
    if !path.exists() {
        return Err("File does not exist".to_string());
    }
    
    let bytes = fs::read(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    // Determine MIME type based on extension
    let mime_type = match path.extension().and_then(|e| e.to_str()) {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        _ => "application/octet-stream",
    };
    
    // Encode as base64
    let base64 = base64_encode(&bytes);
    
    Ok(format!("data:{};base64,{}", mime_type, base64))
}

// Simple base64 encoding
fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();
    
    for chunk in data.chunks(3) {
        let mut buf = [0u8; 3];
        for (i, &byte) in chunk.iter().enumerate() {
            buf[i] = byte;
        }
        
        let b1 = (buf[0] >> 2) as usize;
        let b2 = (((buf[0] & 0x03) << 4) | (buf[1] >> 4)) as usize;
        let b3 = (((buf[1] & 0x0f) << 2) | (buf[2] >> 6)) as usize;
        let b4 = (buf[2] & 0x3f) as usize;
        
        result.push(CHARS[b1] as char);
        result.push(CHARS[b2] as char);
        result.push(if chunk.len() > 1 { CHARS[b3] as char } else { '=' });
        result.push(if chunk.len() > 2 { CHARS[b4] as char } else { '=' });
    }
    
    result
}

/// Tauri command to copy a video file to storage
#[tauri::command]
pub fn copy_video_to_storage(source_path: String) -> Result<CopyVideoResponse, String> {
    use std::fs;
    use std::path::Path;
    
    let source = Path::new(&source_path);
    
    // Validate source file exists
    if !source.exists() {
        return Err("Source file does not exist".to_string());
    }
    
    // Get original filename
    let original_filename = source
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Failed to get filename")?;
    
    // Get file extension
    let extension = source
        .extension()
        .and_then(|e| e.to_str())
        .ok_or("File has no extension")?;
    
    // Generate unique filename using timestamp and random component
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();
    
    let random_suffix: u32 = rand::random();
    let filename = format!("video_{}_{}.{}", timestamp, random_suffix, extension);
    
    // Get storage paths
    let paths = init_storage_dirs()?;
    let destination = paths.videos.join(&filename);
    
    // Copy the file
    fs::copy(source, &destination)
        .map_err(|e| format!("Failed to copy file: {}", e))?;
    
    // Return the destination path and original filename
    Ok(CopyVideoResponse {
        destination_path: destination.to_string_lossy().to_string(),
        original_filename: original_filename.to_string(),
    })
}
