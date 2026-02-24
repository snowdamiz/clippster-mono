use std::path::PathBuf;
use std::sync::Mutex;

// Cache for storage paths to avoid repeated initialization
static STORAGE_PATHS: Mutex<Option<StoragePaths>> = Mutex::new(None);

// Current user ID for per-user storage paths
static CURRENT_USER_ID: Mutex<Option<i64>> = Mutex::new(None);

/// Set the current user ID for per-user storage paths.
/// Call this after successful authentication.
#[tauri::command]
pub fn set_current_user_id(user_id: Option<i64>) -> Result<(), String> {
    let mut current = CURRENT_USER_ID.lock().unwrap();
    let old_user_id = *current;
    *current = user_id;
    
    // Clear the cached storage paths when user changes
    if old_user_id != user_id {
        let mut cache = STORAGE_PATHS.lock().unwrap();
        *cache = None;
        println!("[Storage] User ID changed from {:?} to {:?}, clearing storage cache", old_user_id, user_id);
    }
    
    println!("[Storage] Current user ID set to: {:?}", user_id);
    Ok(())
}

/// Get the current user ID
pub fn get_current_user_id() -> Option<i64> {
    let current = CURRENT_USER_ID.lock().unwrap();
    *current
}

/// Clear the current user ID on logout
#[tauri::command]
pub fn clear_current_user_id() -> Result<(), String> {
    set_current_user_id(None)
}

/// Get the base storage directory for Clippster based on the OS (app-level, not user-specific)
pub fn get_app_storage_dir() -> Result<PathBuf, String> {
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

/// Get the base storage directory for the current user.
/// If a user is logged in, returns user-specific path (e.g., Clippster/users/123/).
/// If no user is logged in, returns app-level path (for backwards compatibility).
pub fn get_storage_base_dir() -> Result<PathBuf, String> {
    let app_dir = get_app_storage_dir()?;
    
    // Check if we have a current user
    if let Some(user_id) = get_current_user_id() {
        // User-specific storage: Clippster/users/{user_id}/
        Ok(app_dir.join("users").join(user_id.to_string()))
    } else {
        // No user logged in - use app-level storage (backwards compatibility)
        Ok(app_dir)
    }
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

/// Comprehensive cleanup of all files associated with a raw video
/// Deletes: video file, thumbnail, audio cache, waveform cache
#[tauri::command]
pub fn delete_raw_video_files(file_path: String, thumbnail_path: Option<String>) -> Result<(), String> {
    use std::fs;
    use std::path::Path;
    
    println!("[Storage] Comprehensive cleanup for video: {}", file_path);
    
    let video_path = Path::new(&file_path);
    
    // 1. Delete the video file if it exists
    if video_path.exists() {
        match fs::remove_file(video_path) {
            Ok(_) => println!("[Storage] Deleted video file: {}", file_path),
            Err(e) => {
                println!("[Storage] Warning: Failed to delete video file: {}", e);
                // Continue with other deletions even if video fails
            }
        }
    }
    
    // 2. Delete the thumbnail file if it exists
    if let Some(thumb_path) = thumbnail_path {
        let thumbnail = Path::new(&thumb_path);
        if thumbnail.exists() {
            match fs::remove_file(thumbnail) {
                Ok(_) => println!("[Storage] Deleted thumbnail: {}", thumb_path),
                Err(e) => println!("[Storage] Warning: Failed to delete thumbnail: {}", e),
            }
        }
    }
    
    // 3. Delete waveform cache file
    // Generate hash for the video path to find cache files
    let video_path_hash = crate::waveform::generate_video_path_hash(&file_path);
    
    if let Ok(waveform_cache_path) = crate::waveform::get_waveform_cache_file_path(&video_path_hash) {
        if waveform_cache_path.exists() {
            match fs::remove_file(&waveform_cache_path) {
                Ok(_) => println!("[Storage] Deleted waveform cache: {:?}", waveform_cache_path),
                Err(e) => println!("[Storage] Warning: Failed to delete waveform cache: {}", e),
            }
        }
    }
    
    // 4. Delete audio cache file
    if let Ok(audio_cache_path) = crate::waveform::get_audio_cache_file_path(&video_path_hash) {
        if audio_cache_path.exists() {
            match fs::remove_file(&audio_cache_path) {
                Ok(_) => println!("[Storage] Deleted audio cache: {:?}", audio_cache_path),
                Err(e) => println!("[Storage] Warning: Failed to delete audio cache: {}", e),
            }
        }
    }
    
    println!("[Storage] Comprehensive cleanup completed for: {}", file_path);
    Ok(())
}

/// Delete all proxy files associated with a source ID
/// Deletes all proxy variants (different resolutions, trim offsets) for the given source
#[tauri::command]
pub fn delete_proxy_files(source_id: String) -> Result<(), String> {
    use std::fs;
    
    println!("[Storage] Deleting proxy files for source: {}", source_id);
    
    let paths = init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;
    let proxy_dir = paths.temp.join("proxies");
    
    if !proxy_dir.exists() {
        println!("[Storage] Proxy directory does not exist, nothing to delete");
        return Ok(());
    }
    
    // Read all files in the proxy directory
    let entries = fs::read_dir(&proxy_dir)
        .map_err(|e| format!("Failed to read proxy directory: {}", e))?;
    
    let mut deleted_count = 0;
    
    // Delete all files that match the pattern proxy_{source_id}_*
    for entry in entries {
        if let Ok(entry) = entry {
            let file_name = entry.file_name();
            let file_name_str = file_name.to_string_lossy();
            
            // Match pattern: proxy_{source_id}_*
            let prefix = format!("proxy_{}_", source_id);
            if file_name_str.starts_with(&prefix) {
                match fs::remove_file(entry.path()) {
                    Ok(_) => {
                        println!("[Storage] Deleted proxy file: {}", file_name_str);
                        deleted_count += 1;
                    }
                    Err(e) => {
                        println!("[Storage] Warning: Failed to delete proxy file {}: {}", file_name_str, e);
                    }
                }
            }
        }
    }
    
    println!("[Storage] Deleted {} proxy file(s) for source: {}", deleted_count, source_id);
    Ok(())
}

/// Initialize storage directories, creating them if they don't exist (cached version)
pub fn init_storage_dirs() -> Result<StoragePaths, String> {
    let mut cache = STORAGE_PATHS.lock().unwrap();

    if let Some(ref paths) = *cache {
        return Ok(paths.clone());
    }

    // Initialize storage paths
    let base_dir = get_storage_base_dir()?;

    let paths = StoragePaths {
        base: base_dir.clone(),
        clips: base_dir.join("clips"),
        videos: base_dir.join("videos"),
        thumbnails: base_dir.join("thumbnails"),
        assets: base_dir.join("assets"),
        intros: base_dir.join("intros"), // Keep for backwards compatibility
        outros: base_dir.join("outros"), // Keep for backwards compatibility
        watermarks: base_dir.join("watermarks"),
        fonts: base_dir.join("fonts"),
        audio: base_dir.join("audio"),
        images: base_dir.join("images"),
        temp: base_dir.join("temp"),
    };

    // Create all directories only once
    std::fs::create_dir_all(&paths.clips)
        .map_err(|e| format!("Failed to create clips directory: {}", e))?;
    std::fs::create_dir_all(&paths.videos)
        .map_err(|e| format!("Failed to create videos directory: {}", e))?;
    std::fs::create_dir_all(&paths.thumbnails)
        .map_err(|e| format!("Failed to create thumbnails directory: {}", e))?;
    std::fs::create_dir_all(&paths.assets)
        .map_err(|e| format!("Failed to create assets directory: {}", e))?;
    std::fs::create_dir_all(&paths.intros)
        .map_err(|e| format!("Failed to create intros directory: {}", e))?;
    std::fs::create_dir_all(&paths.outros)
        .map_err(|e| format!("Failed to create outros directory: {}", e))?;
    std::fs::create_dir_all(&paths.watermarks)
        .map_err(|e| format!("Failed to create watermarks directory: {}", e))?;
    std::fs::create_dir_all(&paths.fonts)
        .map_err(|e| format!("Failed to create fonts directory: {}", e))?;
    std::fs::create_dir_all(&paths.audio)
        .map_err(|e| format!("Failed to create audio directory: {}", e))?;
    std::fs::create_dir_all(&paths.images)
        .map_err(|e| format!("Failed to create images directory: {}", e))?;
    std::fs::create_dir_all(&paths.temp)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // Only log once when actually creating directories
    println!("Clippster storage initialized at: {}", paths.base.display());
    println!("  Clips: {}", paths.clips.display());
    println!("  Videos: {}", paths.videos.display());
    println!("  Thumbnails: {}", paths.thumbnails.display());
    println!("  Assets: {}", paths.assets.display());
    println!("  Intros: {}", paths.intros.display());
    println!("  Outros: {}", paths.outros.display());
    println!("  Watermarks: {}", paths.watermarks.display());
    println!("  Fonts: {}", paths.fonts.display());
    println!("  Audio: {}", paths.audio.display());
    println!("  Temp: {}", paths.temp.display());

    *cache = Some(paths.clone());
    Ok(paths)
}

/// Get the livestream recordings directory
pub fn get_livestream_recordings_dir() -> Result<PathBuf, String> {
    let base_dir = get_storage_base_dir()?;
    let recordings_dir = base_dir.join("livestream_recordings");
    std::fs::create_dir_all(&recordings_dir)
        .map_err(|e| format!("Failed to create livestream recordings directory: {}", e))?;
    Ok(recordings_dir)
}

/// Delete a livestream recording session directory and all its contents
/// This removes all HLS segments, playlists, and other files for the session
#[tauri::command]
pub fn delete_livestream_recording(session_id: String) -> Result<(), String> {
    use std::fs;
    
    println!("[Storage] Deleting livestream recording for session: {}", session_id);
    
    let recordings_dir = get_livestream_recordings_dir()?;
    let session_dir = recordings_dir.join(&session_id);
    
    if !session_dir.exists() {
        println!("[Storage] Session directory does not exist: {:?}", session_dir);
        return Ok(());
    }
    
    // Remove the entire session directory recursively
    match fs::remove_dir_all(&session_dir) {
        Ok(_) => {
            println!("[Storage] Deleted livestream recording directory: {:?}", session_dir);
            Ok(())
        }
        Err(e) => {
            println!("[Storage] Warning: Failed to delete livestream recording directory: {}", e);
            Err(format!("Failed to delete livestream recording directory: {}", e))
        }
    }
}

/// Storage paths structure
#[derive(Debug, Clone)]
pub struct StoragePaths {
    pub base: PathBuf,
    pub clips: PathBuf,
    pub videos: PathBuf,
    pub thumbnails: PathBuf,
    pub assets: PathBuf,
    pub intros: PathBuf,
    pub outros: PathBuf,
    pub watermarks: PathBuf,
    pub fonts: PathBuf,
    pub audio: PathBuf,
    pub images: PathBuf,
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
        assets: paths.assets.to_string_lossy().to_string(),
        intros: paths.intros.to_string_lossy().to_string(),
        outros: paths.outros.to_string_lossy().to_string(),
        watermarks: paths.watermarks.to_string_lossy().to_string(),
        fonts: paths.fonts.to_string_lossy().to_string(),
        audio: paths.audio.to_string_lossy().to_string(),
        images: paths.images.to_string_lossy().to_string(),
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
    pub assets: String,
    pub intros: String,
    pub outros: String,
    pub watermarks: String,
    pub fonts: String,
    pub audio: String,
    pub images: String,
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
    
    // Generate thumbnail filename based on video filename and parent dir (session ID) to avoid collisions
    let video_stem = video
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Failed to get video filename")?;
    
    // Get parent dir name (session ID) for uniqueness
    let parent_dir = video
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|s| s.to_str())
        .unwrap_or("unknown");

    let thumbnail_filename = format!("{}_{}_thumb.jpg", parent_dir, video_stem);
    let thumbnail_path = paths.thumbnails.join(&thumbnail_filename);
    
    // Use ffmpeg sidecar to generate thumbnail at 1 second mark
    let output = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-nostdin",
            "-hwaccel", "auto",
            "-ss", "00:00:01",
            "-i", &video_path,
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

/// Tauri command to generate a thumbnail from a video at a specific timestamp
/// Used during clip detection to create unique thumbnails for each clip
#[tauri::command]
pub async fn generate_thumbnail_at_timestamp(
    app: tauri::AppHandle,
    video_path: String,
    timestamp_seconds: f64,
    output_filename: Option<String>,
) -> Result<String, String> {
    use std::path::Path;
    use tauri_plugin_shell::ShellExt;
    
    let video = Path::new(&video_path);
    
    // Validate video file exists
    if !video.exists() {
        return Err("Video file does not exist".to_string());
    }
    
    // Get storage paths
    let paths = init_storage_dirs()?;
    
    // Generate thumbnail filename
    let thumbnail_filename = if let Some(name) = output_filename {
        format!("{}.jpg", name)
    } else {
        let video_stem = video
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or("Failed to get video filename")?;
            
        // Get parent dir name (session ID) for uniqueness
        let parent_dir = video
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|s| s.to_str())
            .unwrap_or("unknown");
            
        format!("{}_{}_{:.2}_thumb.jpg", parent_dir, video_stem, timestamp_seconds)
    };
    
    let thumbnail_path = paths.thumbnails.join(&thumbnail_filename);
    
    // Format timestamp for ffmpeg (HH:MM:SS.mmm format)
    let hours = (timestamp_seconds / 3600.0).floor() as i32;
    let minutes = ((timestamp_seconds % 3600.0) / 60.0).floor() as i32;
    let seconds = timestamp_seconds % 60.0;
    let timestamp_str = format!("{:02}:{:02}:{:06.3}", hours, minutes, seconds);
    
    // Use ffmpeg sidecar to generate thumbnail at specified timestamp
    let output = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-nostdin",
            "-hwaccel", "auto",
            "-ss", &timestamp_str,
            "-i", &video_path,
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
        Some("mp4") => "video/mp4",
        Some("mov") => "video/quicktime",
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

/// Response structure for copy_asset_to_storage
#[derive(serde::Serialize)]
pub struct CopyAssetResponse {
    pub destination_path: String,
    pub original_filename: String,
    pub thumbnail_path: Option<String>,
}

/// Tauri command to copy an intro/outro asset file to storage
#[tauri::command]
pub async fn copy_asset_to_storage(source_path: String, asset_type: String, _app: tauri::AppHandle) -> Result<CopyAssetResponse, String> {
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
    let filename = format!("{}_{}_{}.{}", asset_type, timestamp, random_suffix, extension);

    // Get storage paths - use unified assets folder
    let paths = init_storage_dirs()?;

    // Create assets directory if it doesn't exist
    let assets_dir = paths.base.join("assets");
    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create assets directory: {}", e))?;

    let destination = assets_dir.join(&filename);

    // Copy the file
    fs::copy(source, &destination)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    // Return the destination path and original filename (thumbnail will be generated asynchronously)
    Ok(CopyAssetResponse {
        destination_path: destination.to_string_lossy().to_string(),
        original_filename: original_filename.to_string(),
        thumbnail_path: None, // Don't generate thumbnail during upload - let frontend handle it
    })
}

/// Tauri command to delete an asset file from the filesystem
#[tauri::command]
pub fn delete_asset_file(file_path: String, _asset_type: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let path = Path::new(&file_path);

    // Validate the file path is in the assets directory
    let paths = init_storage_dirs()?;
    let assets_dir = paths.base.join("assets");

    if !path.starts_with(&assets_dir) {
        return Err("File path is not in the assets directory".to_string());
    }

    // Check if file exists
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    // Delete the file
    fs::remove_file(path)
        .map_err(|e| format!("Failed to delete file: {}", e))?;

    Ok(())
}

/// Tauri command to save a temporary file from web bytes
#[tauri::command]
pub fn save_temp_file(file_name: String, bytes: Vec<u8>) -> Result<String, String> {
    use std::fs;

    let paths = init_storage_dirs()?;
    let temp_path = paths.temp.join(&file_name);

    // Write bytes to temp file
    fs::write(&temp_path, bytes)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    Ok(temp_path.to_string_lossy().to_string())
}

/// Save an uploaded media file to the editor-media directory for a given project.
/// Returns the absolute path where the file was saved.
#[tauri::command]
pub fn save_editor_media_file(
    project_id: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    use std::fs;

    let app_dir = get_app_storage_dir()?;
    let media_dir = app_dir.join("editor-media").join(&project_id);

    fs::create_dir_all(&media_dir)
        .map_err(|e| format!("Failed to create editor-media directory: {}", e))?;

    let file_path = media_dir.join(&file_name);

    fs::write(&file_path, bytes)
        .map_err(|e| format!("Failed to write editor media file: {}", e))?;

    println!(
        "[Storage] Saved editor media file: {}",
        file_path.display()
    );

    Ok(file_path.to_string_lossy().to_string())
}

/// Tauri command to get video duration using FFmpeg
#[tauri::command]
pub async fn get_video_duration(app: tauri::AppHandle, video_path: String) -> Result<f64, String> {
    use tauri_plugin_shell::ShellExt;
    use std::path::Path;

    let path = Path::new(&video_path);

    // Validate file exists
    if !path.exists() {
        return Err("Video file does not exist".to_string());
    }

    // Use FFmpeg to get duration
    let output = app.shell().sidecar("ffmpeg")
        .map_err(|e| format!("Failed to create ffmpeg sidecar: {}", e))?
        .args([
            "-nostdin",
            "-i", &video_path,
            "-f", "null",
            "-",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    // Parse the stderr output to find duration
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Look for duration line in stderr output
    for line in stderr.lines() {
        if line.contains("Duration:") {
            // Extract duration value (format: "Duration: HH:MM:SS.ms")
            if let Some(duration_part) = line.split("Duration:").nth(1) {
                if let Some(duration_str) = duration_part.split(',').next() {
                    let duration_str = duration_str.trim();
                    // Parse HH:MM:SS.ms format
                    let parts: Vec<&str> = duration_str.split(':').collect();
                    if parts.len() >= 3 {
                        if let (Ok(hours), Ok(minutes), Ok(seconds_ms)) = (
                            parts[0].parse::<f64>(),
                            parts[1].parse::<f64>(),
                            parts[2].parse::<f64>(),
                        ) {
                            let total_seconds = hours * 3600.0 + minutes * 60.0 + seconds_ms;
                            return Ok(total_seconds);
                        }
                    }
                }
            }
        }
    }

    Err("Could not determine video duration".to_string())
}

/// Response structure for get_video_metadata
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VideoMetadata {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
}

/// Tauri command to get video metadata (duration, width, height) using FFmpeg
#[tauri::command]
pub async fn get_video_metadata(app: tauri::AppHandle, video_path: String) -> Result<VideoMetadata, String> {
    use tauri_plugin_shell::ShellExt;
    use std::path::Path;

    let path = Path::new(&video_path);
    if !path.exists() {
        return Err("Video file does not exist".to_string());
    }

    // Just read metadata without processing the video - this is instant
    let output = app.shell().sidecar("ffmpeg")
        .map_err(|e| format!("Failed to create ffmpeg sidecar: {}", e))?
        .args(["-nostdin", "-i", &video_path])
        .output()
        .await
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    
    let mut duration: Option<f64> = None;
    let mut width: Option<u32> = None;
    let mut height: Option<u32> = None;

    let resolution_re = regex::Regex::new(r"(\d{2,5})x(\d{2,5})").ok();

    for line in stderr.lines() {
        // Parse duration
        if line.contains("Duration:") {
            if let Some(duration_part) = line.split("Duration:").nth(1) {
                if let Some(duration_str) = duration_part.split(',').next() {
                    let duration_str = duration_str.trim();
                    let parts: Vec<&str> = duration_str.split(':').collect();
                    if parts.len() >= 3 {
                        if let (Ok(hours), Ok(minutes), Ok(seconds_ms)) = (
                            parts[0].parse::<f64>(),
                            parts[1].parse::<f64>(),
                            parts[2].parse::<f64>(),
                        ) {
                            duration = Some(hours * 3600.0 + minutes * 60.0 + seconds_ms);
                        }
                    }
                }
            }
        }

        // Parse video stream for resolution (e.g., "Stream #0:0: Video: h264, 1920x1080")
        if line.contains("Video:") && line.contains("x") {
            // Look for resolution pattern like "1920x1080" or "1280x720"
            if let Some(re) = &resolution_re {
                if let Some(caps) = re.captures(line) {
                    if let (Some(w), Some(h)) = (caps.get(1), caps.get(2)) {
                        width = w.as_str().parse().ok();
                        height = h.as_str().parse().ok();
                    }
                }
            }
        }
    }

    Ok(VideoMetadata {
        duration: duration.unwrap_or(0.0),
        width: width.unwrap_or(0),
        height: height.unwrap_or(0),
    })
}

/// Response structure for get_audio_metadata
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AudioMetadata {
    pub duration: f64,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
}

/// Tauri command to get audio metadata using FFmpeg
#[tauri::command]
pub async fn get_audio_metadata(app: tauri::AppHandle, audio_path: String) -> Result<AudioMetadata, String> {
    use tauri_plugin_shell::ShellExt;
    use std::path::Path;

    let path = Path::new(&audio_path);
    if !path.exists() {
        return Err("Audio file does not exist".to_string());
    }

    let output = app.shell().sidecar("ffmpeg")
        .map_err(|e| format!("Failed to create ffmpeg sidecar: {}", e))?
        .args(["-nostdin", "-i", &audio_path, "-f", "null", "-"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    
    let mut duration: Option<f64> = None;
    let mut sample_rate: Option<u32> = None;
    let mut channels: Option<u32> = None;

    let hz_re = regex::Regex::new(r"(\d+)\s*Hz").ok();

    for line in stderr.lines() {
        // Parse duration
        if line.contains("Duration:") {
            if let Some(duration_part) = line.split("Duration:").nth(1) {
                if let Some(duration_str) = duration_part.split(',').next() {
                    let duration_str = duration_str.trim();
                    let parts: Vec<&str> = duration_str.split(':').collect();
                    if parts.len() >= 3 {
                        if let (Ok(hours), Ok(minutes), Ok(seconds_ms)) = (
                            parts[0].parse::<f64>(),
                            parts[1].parse::<f64>(),
                            parts[2].parse::<f64>(),
                        ) {
                            duration = Some(hours * 3600.0 + minutes * 60.0 + seconds_ms);
                        }
                    }
                }
            }
        }

        // Parse audio stream for sample rate and channels (e.g., "Audio: aac, 44100 Hz, stereo")
        if line.contains("Audio:") {
            // Parse sample rate (e.g., "44100 Hz")
            if let Some(re) = &hz_re {
                if let Some(caps) = re.captures(line) {
                    if let Some(sr) = caps.get(1) {
                        sample_rate = sr.as_str().parse().ok();
                    }
                }
            }
            
            // Parse channels
            if line.contains("stereo") {
                channels = Some(2);
            } else if line.contains("mono") {
                channels = Some(1);
            } else if line.contains("5.1") {
                channels = Some(6);
            }
        }
    }

    Ok(AudioMetadata {
        duration: duration.unwrap_or(0.0),
        sample_rate,
        channels,
    })
}

/// Response structure for get_image_metadata
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImageMetadata {
    pub width: u32,
    pub height: u32,
}

/// Tauri command to get image metadata (width, height) using FFmpeg
#[tauri::command]
pub async fn get_image_metadata(app: tauri::AppHandle, image_path: String) -> Result<ImageMetadata, String> {
    use tauri_plugin_shell::ShellExt;
    use std::path::Path;

    let path = Path::new(&image_path);
    if !path.exists() {
        return Err("Image file does not exist".to_string());
    }

    let output = app.shell().sidecar("ffmpeg")
        .map_err(|e| format!("Failed to create ffmpeg sidecar: {}", e))?
        .args(["-nostdin", "-i", &image_path, "-f", "null", "-"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    
    let mut width: Option<u32> = None;
    let mut height: Option<u32> = None;

    let resolution_re = regex::Regex::new(r"(\d{2,5})x(\d{2,5})").ok();

    for line in stderr.lines() {
        // Parse video/image stream for resolution (e.g., "Stream #0:0: Video: png, rgba, 1920x1080")
        if line.contains("Video:") && line.contains("x") {
            if let Some(re) = &resolution_re {
                if let Some(caps) = re.captures(line) {
                    if let (Some(w), Some(h)) = (caps.get(1), caps.get(2)) {
                        width = w.as_str().parse().ok();
                        height = h.as_str().parse().ok();
                    }
                }
            }
        }
    }

    Ok(ImageMetadata {
        width: width.unwrap_or(0),
        height: height.unwrap_or(0),
    })
}

/// Tauri command to copy a clip file to a user-specified destination
/// This is used when the user wants to "download" (export) a clip to a custom location
#[tauri::command]
pub async fn copy_clip_to_destination(source_path: String, destination_path: String) -> Result<String, String> {
    use std::fs;
    use std::path::Path;

    let source = Path::new(&source_path);
    let destination = Path::new(&destination_path);

    // Validate source file exists
    if !source.exists() {
        return Err("Source clip file does not exist".to_string());
    }

    // Create destination directory if it doesn't exist
    if let Some(parent) = destination.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create destination directory: {}", e))?;
        }
    }

    // Copy the file (don't move, just copy)
    fs::copy(source, destination)
        .map_err(|e| format!("Failed to copy clip: {}", e))?;

    println!("[Rust] Copied clip from {} to {}", source_path, destination_path);
    
    Ok(destination.to_string_lossy().to_string())
}

/// Response structure for copy_watermark_to_storage
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CopyWatermarkResponse {
    pub destination_path: String,
    pub original_filename: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub file_size: Option<u64>,
}

/// Tauri command to copy a watermark image file to storage
#[tauri::command]
pub async fn copy_watermark_to_storage(source_path: String, app: tauri::AppHandle) -> Result<CopyWatermarkResponse, String> {
    use std::fs;
    use std::path::Path;
    use tauri_plugin_shell::ShellExt;

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
        .ok_or("File has no extension")?
        .to_lowercase();

    // Validate it's an image file
    let valid_extensions = ["png", "jpg", "jpeg", "webp", "gif"];
    if !valid_extensions.contains(&extension.as_str()) {
        return Err(format!("Invalid image format. Supported: {}", valid_extensions.join(", ")));
    }

    // Get file size
    let file_size = fs::metadata(source)
        .map(|m| m.len())
        .ok();

    // Generate unique filename using timestamp and random component
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    let random_suffix: u32 = rand::random();
    let filename = format!("watermark_{}_{}.{}", timestamp, random_suffix, extension);

    // Get storage paths
    let paths = init_storage_dirs()?;
    let destination = paths.watermarks.join(&filename);

    // Copy the file
    fs::copy(source, &destination)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    // Try to get image dimensions using FFmpeg
    // This is optional - if it fails, we just won't have dimensions
    let mut width: Option<u32> = None;
    let mut height: Option<u32> = None;

    // Use ffmpeg to get image info (reads from stderr)
    if let Ok(output) = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", destination.to_str().unwrap_or(""),
            "-f", "null",
            "-",
        ])
        .output()
        .await
    {
        // FFmpeg outputs info to stderr
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        // Parse dimensions from output like "Stream #0:0: Video: png, rgba, 1920x1080"
        // or "Stream #0:0(und): Video: mjpeg, yuvj420p, 1920x1080"
        for line in stderr.lines() {
            if line.contains("Stream") && line.contains("Video:") {
                // Look for pattern like "1920x1080" or "1920x1080,"
                let parts: Vec<&str> = line.split(',').collect();
                for part in parts {
                    let trimmed = part.trim();
                    // Check if this looks like dimensions (e.g., "1920x1080")
                    if trimmed.contains('x') && !trimmed.contains("0x") {
                        let dim_parts: Vec<&str> = trimmed.split('x').collect();
                        if dim_parts.len() == 2 {
                            if let (Ok(w), Ok(h)) = (
                                dim_parts[0].trim().parse::<u32>(),
                                dim_parts[1].split(|c: char| !c.is_numeric()).next().unwrap_or("").parse::<u32>()
                            ) {
                                if w > 0 && h > 0 && w < 100000 && h < 100000 {
                                    width = Some(w);
                                    height = Some(h);
                                    break;
                                }
                            }
                        }
                    }
                }
                if width.is_some() {
                    break;
                }
            }
        }
    }

    println!("[Rust] Watermark copied to storage: {}", destination.display());
    if let (Some(w), Some(h)) = (width, height) {
        println!("[Rust] Watermark dimensions: {}x{}", w, h);
    } else {
        println!("[Rust] Could not determine watermark dimensions (this is OK)");
    }

    Ok(CopyWatermarkResponse {
        destination_path: destination.to_string_lossy().to_string(),
        original_filename: original_filename.to_string(),
        width,
        height,
        file_size,
    })
}

/// Tauri command to delete a watermark file from the filesystem
#[tauri::command]
pub fn delete_watermark_file(file_path: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let path = Path::new(&file_path);

    // Validate the file path is in the watermarks directory
    let paths = init_storage_dirs()?;

    if !path.starts_with(&paths.watermarks) {
        return Err("File path is not in the watermarks directory".to_string());
    }

    // Check if file exists
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    // Delete the file
    fs::remove_file(path)
        .map_err(|e| format!("Failed to delete file: {}", e))?;

    println!("[Rust] Watermark deleted: {}", file_path);
    Ok(())
}

/// Response structure for copy_image_to_storage
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CopyImageResponse {
    pub destination_path: String,
    pub original_filename: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub file_size: Option<u64>,
    pub mime_type: Option<String>,
}

/// Tauri command to copy an image file to storage
#[tauri::command]
pub async fn copy_image_to_storage(source_path: String, app: tauri::AppHandle) -> Result<CopyImageResponse, String> {
    use std::fs;
    use std::path::Path;
    use tauri_plugin_shell::ShellExt;

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
        .ok_or("File has no extension")?
        .to_lowercase();

    // Validate it's an image file
    let valid_extensions = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "tif"];
    if !valid_extensions.contains(&extension.as_str()) {
        return Err(format!("Invalid image format. Supported: {}", valid_extensions.join(", ")));
    }

    // Determine MIME type
    let mime_type = match extension.as_str() {
        "png" => Some("image/png".to_string()),
        "jpg" | "jpeg" => Some("image/jpeg".to_string()),
        "webp" => Some("image/webp".to_string()),
        "gif" => Some("image/gif".to_string()),
        "bmp" => Some("image/bmp".to_string()),
        "tiff" | "tif" => Some("image/tiff".to_string()),
        _ => None,
    };

    // Get file size
    let file_size = fs::metadata(source)
        .map(|m| m.len())
        .ok();

    // Generate unique filename using timestamp and random component
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    let random_suffix: u32 = rand::random();
    let filename = format!("image_{}_{}.{}", timestamp, random_suffix, extension);

    // Get storage paths
    let paths = init_storage_dirs()?;
    let destination = paths.images.join(&filename);

    // Copy the file
    fs::copy(source, &destination)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    // Try to get image dimensions using FFmpeg
    let mut width: Option<u32> = None;
    let mut height: Option<u32> = None;

    // Use ffmpeg to get image info (reads from stderr)
    if let Ok(output) = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", destination.to_str().unwrap_or(""),
            "-f", "null",
            "-",
        ])
        .output()
        .await
    {
        // FFmpeg outputs info to stderr
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        // Parse dimensions from output like "Stream #0:0: Video: png, rgba, 1920x1080"
        for line in stderr.lines() {
            if line.contains("Stream") && line.contains("Video:") {
                let parts: Vec<&str> = line.split(',').collect();
                for part in parts {
                    let trimmed = part.trim();
                    // Check if this looks like dimensions (e.g., "1920x1080")
                    if trimmed.contains('x') && !trimmed.contains("0x") {
                        let dim_parts: Vec<&str> = trimmed.split('x').collect();
                        if dim_parts.len() == 2 {
                            if let (Ok(w), Ok(h)) = (
                                dim_parts[0].trim().parse::<u32>(),
                                dim_parts[1].split(|c: char| !c.is_numeric()).next().unwrap_or("").parse::<u32>()
                            ) {
                                if w > 0 && h > 0 && w < 100000 && h < 100000 {
                                    width = Some(w);
                                    height = Some(h);
                                    break;
                                }
                            }
                        }
                    }
                }
                if width.is_some() {
                    break;
                }
            }
        }
    }

    println!("[Rust] Image copied to storage: {}", destination.display());
    if let (Some(w), Some(h)) = (width, height) {
        println!("[Rust] Image dimensions: {}x{}", w, h);
    } else {
        println!("[Rust] Could not determine image dimensions (this is OK)");
    }

    Ok(CopyImageResponse {
        destination_path: destination.to_string_lossy().to_string(),
        original_filename: original_filename.to_string(),
        width,
        height,
        file_size,
        mime_type,
    })
}

/// Tauri command to delete an image file from the filesystem
#[tauri::command]
pub fn delete_image_file(file_path: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let path = Path::new(&file_path);

    // Validate the file path is in the images directory
    let paths = init_storage_dirs()?;

    if !path.starts_with(&paths.images) {
        return Err("File path is not in the images directory".to_string());
    }

    // Check if file exists
    if !path.exists() {
        // File already deleted, that's okay
        println!("[Rust] Image file already deleted: {}", file_path);
        return Ok(());
    }

    // Delete the file
    fs::remove_file(path)
        .map_err(|e| format!("Failed to delete file: {}", e))?;

    println!("[Rust] Image deleted: {}", file_path);
    Ok(())
}

/// Response structure for copy_font_to_storage
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CopyFontResponse {
    pub file_path: String,
    pub file_name: String,
    pub font_name: String,
    pub file_type: String,
}

/// Tauri command to copy a font file to the fonts storage directory
#[tauri::command]
pub async fn copy_font_to_storage(source_path: String) -> Result<CopyFontResponse, String> {
    use std::fs;
    use std::path::Path;
    
    let source = Path::new(&source_path);
    
    // Validate the source file exists
    if !source.exists() {
        return Err(format!("Source file does not exist: {}", source_path));
    }
    
    // Get the file extension and validate it's a font file
    let extension = source
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .ok_or("Could not determine file extension")?;
    
    let valid_extensions = ["ttf", "otf", "woff", "woff2"];
    if !valid_extensions.contains(&extension.as_str()) {
        return Err(format!(
            "Invalid font file type: {}. Supported types: ttf, otf, woff, woff2",
            extension
        ));
    }
    
    // Get the original filename
    let _original_filename = source
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Could not determine filename")?
        .to_string();
    
    // Extract font name from filename (remove extension)
    let font_name = source
        .file_stem()
        .and_then(|n| n.to_str())
        .ok_or("Could not determine font name")?
        .to_string();
    
    // Get storage paths
    let paths = init_storage_dirs()?;
    
    // Generate unique filename to avoid conflicts
    let unique_id = uuid::Uuid::new_v4().to_string()[..8].to_string();
    let dest_filename = format!("{}_{}.{}", font_name, unique_id, extension);
    let dest_path = paths.fonts.join(&dest_filename);
    
    // Copy the file
    fs::copy(source, &dest_path)
        .map_err(|e| format!("Failed to copy font file: {}", e))?;
    
    println!("[Rust] Font copied: {} -> {}", source_path, dest_path.display());
    
    Ok(CopyFontResponse {
        file_path: dest_path.to_string_lossy().to_string(),
        file_name: dest_filename,
        font_name,
        file_type: extension,
    })
}

/// Tauri command to delete a custom font file
#[tauri::command]
pub fn delete_font_file(file_path: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;
    
    let path = Path::new(&file_path);
    
    if path.exists() {
        fs::remove_file(path)
            .map_err(|e| format!("Failed to delete font file: {}", e))?;
        println!("[Rust] Font deleted: {}", file_path);
    }
    
    Ok(())
}

/// Response structure for copy_audio_to_storage
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CopyAudioResponse {
    pub destination_path: String,
    pub original_filename: String,
    pub duration: Option<f64>,
    pub file_size: Option<u64>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
}

/// Tauri command to copy an audio file to storage
#[tauri::command]
pub async fn copy_audio_to_storage(source_path: String, app: tauri::AppHandle) -> Result<CopyAudioResponse, String> {
    use std::fs;
    use std::path::Path;
    use tauri_plugin_shell::ShellExt;

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
        .ok_or("File has no extension")?
        .to_lowercase();

    // Validate it's an audio file
    let valid_extensions = ["mp3", "wav", "flac", "aac", "m4a", "ogg", "wma"];
    if !valid_extensions.contains(&extension.as_str()) {
        return Err(format!("Invalid audio format. Supported: {}", valid_extensions.join(", ")));
    }

    // Get file size
    let file_size = fs::metadata(source)
        .map(|m| m.len())
        .ok();

    // Generate unique filename using timestamp and random component
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    let random_suffix: u32 = rand::random();
    let filename = format!("audio_{}_{}.{}", timestamp, random_suffix, extension);

    // Get storage paths (audio directory is created in init_storage_dirs)
    let paths = init_storage_dirs()?;
    let destination = paths.audio.join(&filename);

    // Copy the file
    fs::copy(source, &destination)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    // Try to get audio metadata using FFmpeg
    let mut duration: Option<f64> = None;
    let mut sample_rate: Option<u32> = None;
    let mut channels: Option<u32> = None;

    // Use ffprobe/ffmpeg to get audio info
    if let Ok(output) = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", destination.to_str().unwrap_or(""),
            "-f", "null",
            "-",
        ])
        .output()
        .await
    {
        // FFmpeg outputs info to stderr
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        // Parse duration from output like "Duration: 00:03:45.12"
        for line in stderr.lines() {
            if line.contains("Duration:") {
                if let Some(duration_part) = line.split("Duration:").nth(1) {
                    if let Some(duration_str) = duration_part.split(',').next() {
                        let duration_str = duration_str.trim();
                        // Parse HH:MM:SS.ms format
                        let parts: Vec<&str> = duration_str.split(':').collect();
                        if parts.len() >= 3 {
                            if let (Ok(hours), Ok(minutes), Ok(seconds_ms)) = (
                                parts[0].parse::<f64>(),
                                parts[1].parse::<f64>(),
                                parts[2].parse::<f64>(),
                            ) {
                                duration = Some(hours * 3600.0 + minutes * 60.0 + seconds_ms);
                            }
                        }
                    }
                }
            }
            
            // Parse sample rate and channels from lines like "Stream #0:0: Audio: mp3, 44100 Hz, stereo"
            if line.contains("Stream") && line.contains("Audio:") {
                // Look for sample rate (e.g., "44100 Hz")
                if let Some(hz_pos) = line.find(" Hz") {
                    let before_hz = &line[..hz_pos];
                    if let Some(last_space) = before_hz.rfind(|c: char| !c.is_numeric()) {
                        let sr_str = &before_hz[last_space + 1..];
                        if let Ok(sr) = sr_str.parse::<u32>() {
                            sample_rate = Some(sr);
                        }
                    }
                }
                
                // Parse channels from "mono", "stereo", or "5.1" etc.
                if line.contains("mono") {
                    channels = Some(1);
                } else if line.contains("stereo") {
                    channels = Some(2);
                } else if line.contains("5.1") {
                    channels = Some(6);
                } else if line.contains("7.1") {
                    channels = Some(8);
                }
            }
        }
    }

    println!("[Rust] Audio copied to storage: {}", destination.display());
    if let Some(dur) = duration {
        println!("[Rust] Audio duration: {:.2}s", dur);
    }
    if let (Some(sr), Some(ch)) = (sample_rate, channels) {
        println!("[Rust] Audio: {} Hz, {} channels", sr, ch);
    }

    Ok(CopyAudioResponse {
        destination_path: destination.to_string_lossy().to_string(),
        original_filename: original_filename.to_string(),
        duration,
        file_size,
        sample_rate,
        channels,
    })
}

/// Tauri command to delete an audio file from the filesystem
#[tauri::command]
pub fn delete_audio_file(file_path: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let path = Path::new(&file_path);

    // Validate the file path is in the audio directory
    let paths = init_storage_dirs()?;

    if !path.starts_with(&paths.audio) {
        return Err("File path is not in the audio directory".to_string());
    }

    // Check if file exists
    if !path.exists() {
        // File already deleted, that's okay
        println!("[Rust] Audio file already deleted: {}", file_path);
        return Ok(());
    }

    // Delete the file
    fs::remove_file(path)
        .map_err(|e| format!("Failed to delete file: {}", e))?;

    println!("[Rust] Audio deleted: {}", file_path);
    Ok(())
}

/// Tauri command to save an organization asset file from binary data.
/// Used when downloading organization assets from the server.
#[tauri::command]
pub fn save_org_asset_file(
    data: Vec<u8>,
    filename: String,
    asset_type: String,
    organization_id: String,
) -> Result<String, String> {
    use std::fs;

    // Get base storage paths
    let paths = init_storage_dirs()?;

    // Determine the target directory based on asset type
    let base_asset_dir = match asset_type.as_str() {
        "intros" => paths.intros.clone(),
        "outros" => paths.outros.clone(),
        "watermarks" => paths.watermarks.clone(),
        "audio" => paths.audio.clone(),
        "images" => paths.images.clone(),
        "thumbnails" => paths.thumbnails.clone(),
        _ => paths.assets.clone(),
    };

    // Create organization-specific subdirectory
    let org_dir = base_asset_dir.join("org").join(&organization_id);
    fs::create_dir_all(&org_dir)
        .map_err(|e| format!("Failed to create organization asset directory: {}", e))?;

    // Sanitize filename
    let safe_filename = sanitize_filename(&filename);
    
    // Generate unique filename with timestamp to avoid collisions
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    
    let final_filename = format!("{}_{}", timestamp, safe_filename);
    let destination_path = org_dir.join(&final_filename);

    // Write the file
    fs::write(&destination_path, &data)
        .map_err(|e| format!("Failed to write organization asset file: {}", e))?;

    let dest_str = destination_path.to_string_lossy().to_string();
    println!(
        "[Rust] Organization asset saved: {} -> {}",
        filename, dest_str
    );

    Ok(dest_str)
}

/// Tauri command to download a file from a URL and save it as an organization asset.
/// This bypasses CORS restrictions by downloading through Rust.
#[tauri::command]
pub async fn download_org_asset_from_url(
    url: String,
    filename: String,
    asset_type: String,
    organization_id: String,
) -> Result<String, String> {
    use std::fs;

    println!("[Rust] Downloading org asset from URL: {}", url);

    // Download the file using reqwest (bypasses CORS)
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let data = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    println!("[Rust] Downloaded {} bytes", data.len());

    // Get base storage paths
    let paths = init_storage_dirs()?;

    // Determine the target directory based on asset type
    let base_asset_dir = match asset_type.as_str() {
        "intros" => paths.intros.clone(),
        "outros" => paths.outros.clone(),
        "watermarks" => paths.watermarks.clone(),
        "audio" => paths.audio.clone(),
        "images" => paths.images.clone(),
        "thumbnails" => paths.thumbnails.clone(),
        _ => paths.assets.clone(),
    };

    // Create organization-specific subdirectory
    let org_dir = base_asset_dir.join("org").join(&organization_id);
    fs::create_dir_all(&org_dir)
        .map_err(|e| format!("Failed to create organization asset directory: {}", e))?;

    // Sanitize filename
    let safe_filename = sanitize_filename(&filename);
    
    // Generate unique filename with timestamp to avoid collisions
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    
    let final_filename = format!("{}_{}", timestamp, safe_filename);
    let destination_path = org_dir.join(&final_filename);

    // Write the file
    fs::write(&destination_path, &data)
        .map_err(|e| format!("Failed to write organization asset file: {}", e))?;

    let dest_str = destination_path.to_string_lossy().to_string();
    println!(
        "[Rust] Organization asset downloaded and saved: {} -> {}",
        filename, dest_str
    );

    Ok(dest_str)
}

/// Helper function to sanitize filenames for safe storage
fn sanitize_filename(filename: &str) -> String {
    filename
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}