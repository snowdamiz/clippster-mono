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

/// Tauri command to copy a video file to storage
#[tauri::command]
pub fn copy_video_to_storage(source_path: String) -> Result<String, String> {
    use std::fs;
    use std::path::Path;
    
    let source = Path::new(&source_path);
    
    // Validate source file exists
    if !source.exists() {
        return Err("Source file does not exist".to_string());
    }
    
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
    
    // Return the destination path as a string
    Ok(destination.to_string_lossy().to_string())
}
