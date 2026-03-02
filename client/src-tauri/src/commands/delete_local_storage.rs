use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::storage::{
    get_raw_videos_dir, get_projects_dir, 
    get_temp_dvr_dir, get_auto_detect_tmp_dir, get_proxy_dir,
    get_library_audio_dir,
};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StorageSizeInfo {
    pub total_bytes: u64,
    pub total_formatted: String,
    pub breakdown: Vec<DirectorySize>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DirectorySize {
    pub name: String,
    pub bytes: u64,
    pub formatted: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeletionProgress {
    pub operation: String,
    pub percentage: u8,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeletionResult {
    pub success: bool,
    pub bytes_freed: u64,
    pub formatted_size: String,
    pub errors: Vec<String>,
}

fn calculate_directory_size(path: &PathBuf) -> Result<u64, std::io::Error> {
    let mut total_size = 0u64;
    
    if !path.exists() {
        return Ok(0);
    }
    
    if path.is_file() {
        return Ok(fs::metadata(path)?.len());
    }
    
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        
        if metadata.is_file() {
            total_size += metadata.len();
        } else if metadata.is_dir() {
            total_size += calculate_directory_size(&entry.path())?;
        }
    }
    
    Ok(total_size)
}

fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    const TB: u64 = GB * 1024;
    
    if bytes >= TB {
        format!("{:.2} TB", bytes as f64 / TB as f64)
    } else if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} bytes", bytes)
    }
}

#[tauri::command]
pub async fn calculate_local_storage_size(_app: AppHandle) -> Result<StorageSizeInfo, String> {
    let directories = vec![
        ("Raw Videos", get_raw_videos_dir()?),
        // Note: Thumbnails excluded - preserved for built clips
        ("Projects", get_projects_dir()?),
        ("Temp DVR", get_temp_dvr_dir()?),
        ("Auto-Detect Temp", get_auto_detect_tmp_dir()?),
        ("Proxy Files", get_proxy_dir()?),
        ("Library Audio", get_library_audio_dir()?),
    ];
    
    let mut breakdown = Vec::new();
    let mut total_bytes = 0u64;
    
    for (name, dir) in directories {
        let size = calculate_directory_size(&dir)
            .unwrap_or(0);
        
        breakdown.push(DirectorySize {
            name: name.to_string(),
            bytes: size,
            formatted: format_bytes(size),
        });
        
        total_bytes += size;
    }
    
    Ok(StorageSizeInfo {
        total_bytes,
        total_formatted: format_bytes(total_bytes),
        breakdown,
    })
}

#[tauri::command]
pub async fn delete_local_storage(app: AppHandle) -> Result<DeletionResult, String> {
    let directories = vec![
        ("Deleting raw videos", get_raw_videos_dir()?, 16),
        // Note: Thumbnails excluded - preserved for built clips
        ("Deleting projects", get_projects_dir()?, 33),
        ("Deleting temp DVR files", get_temp_dvr_dir()?, 50),
        ("Deleting auto-detect temp files", get_auto_detect_tmp_dir()?, 66),
        ("Deleting proxy files", get_proxy_dir()?, 83),
        ("Deleting library audio", get_library_audio_dir()?, 100),
    ];
    
    let mut total_freed = 0u64;
    let mut errors = Vec::new();
    
    for (operation, dir, percentage) in directories {
        app.emit("deletion-progress", DeletionProgress {
            operation: operation.to_string(),
            percentage,
        }).ok();
        
        if dir.exists() {
            match calculate_directory_size(&dir) {
                Ok(size) => {
                    match fs::remove_dir_all(&dir) {
                        Ok(_) => {
                            total_freed += size;
                            if let Err(e) = fs::create_dir_all(&dir) {
                                errors.push(format!("Failed to recreate {}: {}", operation, e));
                            }
                        }
                        Err(e) => {
                            errors.push(format!("Failed to delete {}: {}", operation, e));
                        }
                    }
                }
                Err(e) => {
                    errors.push(format!("Failed to calculate size for {}: {}", operation, e));
                }
            }
        }
    }
    
    app.emit("deletion-progress", DeletionProgress {
        operation: "Complete".to_string(),
        percentage: 100,
    }).ok();
    
    Ok(DeletionResult {
        success: errors.is_empty(),
        bytes_freed: total_freed,
        formatted_size: format_bytes(total_freed),
        errors,
    })
}
