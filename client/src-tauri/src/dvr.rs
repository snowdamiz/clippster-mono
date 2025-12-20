use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Get the DVR temp directory for a specific mint
fn get_dvr_dir(app: &AppHandle, mint_id: &str) -> Result<PathBuf, String> {
    let temp_dir = app
        .path()
        .temp_dir()
        .map_err(|e| format!("Failed to get temp directory: {}", e))?;
    
    let dvr_dir = temp_dir.join("dvr").join(mint_id);
    Ok(dvr_dir)
}

/// Extract the WebM init segment from a complete WebM file
/// The init segment contains EBML header, Segment header, and track info
/// It ends where the first Cluster element begins
fn extract_init_segment(data: &[u8]) -> Option<Vec<u8>> {
    // WebM Cluster element ID is 0x1F43B675
    // We need to find this in the data and return everything before it
    
    if data.len() < 4 {
        return None;
    }
    
    // Search for Cluster element ID: 0x1F 0x43 0xB6 0x75
    for i in 0..data.len().saturating_sub(3) {
        if data[i] == 0x1F 
            && data[i + 1] == 0x43 
            && data[i + 2] == 0xB6 
            && data[i + 3] == 0x75 
        {
            // Found Cluster, everything before this is the init segment
            println!("[DVR] Found Cluster at offset {}, init segment size: {} bytes", i, i);
            return Some(data[..i].to_vec());
        }
    }
    
    // No Cluster found, this might be just init segment or invalid
    println!("[DVR] No Cluster found in data of {} bytes", data.len());
    None
}

/// Get the path to the init segment file
fn get_init_segment_path(dvr_dir: &PathBuf) -> PathBuf {
    dvr_dir.join("init.webm")
}

/// Information about a DVR chunk
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DvrChunkInfo {
    pub index: u32,
    pub path: String,
    pub size: u64,
}

/// Save a DVR chunk to the temp directory
/// Returns the full path to the saved chunk
/// For chunk 0, also extracts and saves the init segment for later use
#[tauri::command]
pub async fn save_dvr_chunk(
    app: AppHandle,
    mint_id: String,
    chunk_index: u32,
    data: Vec<u8>,
) -> Result<String, String> {
    let dvr_dir = get_dvr_dir(&app, &mint_id)?;
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&dvr_dir)
        .map_err(|e| format!("Failed to create DVR directory: {}", e))?;
    
    // For chunk 0, extract and save the init segment
    if chunk_index == 0 {
        if let Some(init_segment) = extract_init_segment(&data) {
            let init_path = get_init_segment_path(&dvr_dir);
            fs::write(&init_path, &init_segment)
                .map_err(|e| format!("Failed to write init segment: {}", e))?;
            println!("[DVR] Saved init segment ({} bytes) to {:?}", init_segment.len(), init_path);
        } else {
            println!("[DVR] Warning: Could not extract init segment from chunk 0");
        }
    }
    
    // Create chunk file path
    let chunk_filename = format!("chunk_{:05}.webm", chunk_index);
    let chunk_path = dvr_dir.join(&chunk_filename);
    
    // Write chunk data
    fs::write(&chunk_path, &data)
        .map_err(|e| format!("Failed to write DVR chunk: {}", e))?;
    
    let path_str = chunk_path.to_string_lossy().to_string();
    println!("[DVR] Saved chunk {} for {} ({} bytes) to {}", 
             chunk_index, mint_id, data.len(), path_str);
    
    Ok(path_str)
}

/// Get the path to a specific DVR chunk
#[tauri::command]
pub async fn get_dvr_chunk_path(
    app: AppHandle,
    mint_id: String,
    chunk_index: u32,
) -> Result<String, String> {
    let dvr_dir = get_dvr_dir(&app, &mint_id)?;
    let chunk_filename = format!("chunk_{:05}.webm", chunk_index);
    let chunk_path = dvr_dir.join(&chunk_filename);
    
    if !chunk_path.exists() {
        return Err(format!("DVR chunk {} not found for {}", chunk_index, mint_id));
    }
    
    Ok(chunk_path.to_string_lossy().to_string())
}

/// Cleanup all DVR chunks for a mint
#[tauri::command]
pub async fn cleanup_dvr_chunks(
    app: AppHandle,
    mint_id: String,
) -> Result<(), String> {
    let dvr_dir = get_dvr_dir(&app, &mint_id)?;
    
    if dvr_dir.exists() {
        fs::remove_dir_all(&dvr_dir)
            .map_err(|e| format!("Failed to cleanup DVR directory: {}", e))?;
        println!("[DVR] Cleaned up DVR chunks for {}", mint_id);
    }
    
    Ok(())
}

/// List all DVR chunks for a mint
#[tauri::command]
pub async fn list_dvr_chunks(
    app: AppHandle,
    mint_id: String,
) -> Result<Vec<DvrChunkInfo>, String> {
    let dvr_dir = get_dvr_dir(&app, &mint_id)?;
    
    if !dvr_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut chunks: Vec<DvrChunkInfo> = vec![];
    
    let entries = fs::read_dir(&dvr_dir)
        .map_err(|e| format!("Failed to read DVR directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
            if filename.starts_with("chunk_") && filename.ends_with(".webm") {
                // Extract index from filename (chunk_00001.webm -> 1)
                if let Some(index_str) = filename.strip_prefix("chunk_").and_then(|s| s.strip_suffix(".webm")) {
                    if let Ok(index) = index_str.parse::<u32>() {
                        let metadata = fs::metadata(&path)
                            .map_err(|e| format!("Failed to get chunk metadata: {}", e))?;
                        
                        chunks.push(DvrChunkInfo {
                            index,
                            path: path.to_string_lossy().to_string(),
                            size: metadata.len(),
                        });
                    }
                }
            }
        }
    }
    
    // Sort by index
    chunks.sort_by_key(|c| c.index);
    
    Ok(chunks)
}

/// Get the DVR directory path for a mint
#[tauri::command]
pub async fn get_dvr_directory(
    app: AppHandle,
    mint_id: String,
) -> Result<String, String> {
    let dvr_dir = get_dvr_dir(&app, &mint_id)?;
    Ok(dvr_dir.to_string_lossy().to_string())
}

/// Check if DVR chunks exist for a mint
#[tauri::command]
pub async fn has_dvr_chunks(
    app: AppHandle,
    mint_id: String,
) -> Result<bool, String> {
    let dvr_dir = get_dvr_dir(&app, &mint_id)?;
    
    if !dvr_dir.exists() {
        return Ok(false);
    }
    
    let entries = fs::read_dir(&dvr_dir)
        .map_err(|e| format!("Failed to read DVR directory: {}", e))?;
    
    for entry in entries {
        if let Ok(entry) = entry {
            if let Some(filename) = entry.path().file_name().and_then(|n| n.to_str()) {
                if filename.starts_with("chunk_") && filename.ends_with(".webm") {
                    return Ok(true);
                }
            }
        }
    }
    
    Ok(false)
}

/// Read all DVR chunks concatenated into a single playable WebM file
/// This is more reliable for playback as it preserves keyframe continuity
#[tauri::command]
pub async fn read_all_dvr_chunks(
    app: AppHandle,
    mint_id: String,
) -> Result<Vec<u8>, String> {
    let dvr_dir = get_dvr_dir(&app, &mint_id)?;
    
    if !dvr_dir.exists() {
        return Err(format!("DVR directory not found for {}", mint_id));
    }
    
    // List all chunk files
    let mut chunk_files: Vec<(u32, std::path::PathBuf)> = vec![];
    
    let entries = fs::read_dir(&dvr_dir)
        .map_err(|e| format!("Failed to read DVR directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
            if filename.starts_with("chunk_") && filename.ends_with(".webm") {
                if let Some(index_str) = filename.strip_prefix("chunk_").and_then(|s| s.strip_suffix(".webm")) {
                    if let Ok(index) = index_str.parse::<u32>() {
                        chunk_files.push((index, path));
                    }
                }
            }
        }
    }
    
    // Sort by index
    chunk_files.sort_by_key(|(idx, _)| *idx);
    
    if chunk_files.is_empty() {
        return Err(format!("No DVR chunks found for {}", mint_id));
    }
    
    println!("[DVR] Reading {} chunks for concatenation", chunk_files.len());
    
    let mut result: Vec<u8> = Vec::new();
    
    for (index, path) in chunk_files {
        let chunk_data = fs::read(&path)
            .map_err(|e| format!("Failed to read chunk {}: {}", index, e))?;
        
        // First chunk is used as-is (contains init segment + first cluster)
        // Subsequent chunks are raw cluster data - just append them
        result.extend_from_slice(&chunk_data);
        
        println!("[DVR] Added chunk {} ({} bytes), total: {} bytes", index, chunk_data.len(), result.len());
    }
    
    println!("[DVR] Total concatenated size: {} bytes", result.len());
    
    Ok(result)
}

/// Read a DVR chunk file as bytes
/// For chunks > 0, prepends the init segment to make the chunk independently playable
#[tauri::command]
pub async fn read_dvr_chunk(
    app: AppHandle,
    mint_id: String,
    chunk_index: u32,
) -> Result<Vec<u8>, String> {
    let dvr_dir = get_dvr_dir(&app, &mint_id)?;
    let chunk_filename = format!("chunk_{:05}.webm", chunk_index);
    let chunk_path = dvr_dir.join(&chunk_filename);
    
    if !chunk_path.exists() {
        return Err(format!("DVR chunk {} not found for {}", chunk_index, mint_id));
    }
    
    let chunk_data = fs::read(&chunk_path)
        .map_err(|e| format!("Failed to read DVR chunk: {}", e))?;
    
    // For chunk 0, return as-is (it already has the init segment)
    if chunk_index == 0 {
        println!("[DVR] Reading chunk 0, returning as-is ({} bytes)", chunk_data.len());
        return Ok(chunk_data);
    }
    
    // For chunks > 0, we need to prepend the init segment
    let init_path = get_init_segment_path(&dvr_dir);
    
    if !init_path.exists() {
        // No init segment found, try to extract from chunk 0
        let chunk0_path = dvr_dir.join("chunk_00000.webm");
        if chunk0_path.exists() {
            let chunk0_data = fs::read(&chunk0_path)
                .map_err(|e| format!("Failed to read chunk 0 for init segment: {}", e))?;
            
            if let Some(init_segment) = extract_init_segment(&chunk0_data) {
                // Save for future use
                fs::write(&init_path, &init_segment)
                    .map_err(|e| format!("Failed to write init segment: {}", e))?;
                println!("[DVR] Extracted and saved init segment from chunk 0 ({} bytes)", init_segment.len());
                
                // Prepend init segment to chunk data
                let mut result = init_segment;
                result.extend_from_slice(&chunk_data);
                println!("[DVR] Reading chunk {} with prepended init segment ({} bytes total)", 
                         chunk_index, result.len());
                return Ok(result);
            } else {
                println!("[DVR] Warning: Could not extract init segment from chunk 0, returning raw chunk");
                return Ok(chunk_data);
            }
        } else {
            println!("[DVR] Warning: No init segment or chunk 0 found, returning raw chunk");
            return Ok(chunk_data);
        }
    }
    
    // Read init segment and prepend
    let init_segment = fs::read(&init_path)
        .map_err(|e| format!("Failed to read init segment: {}", e))?;
    
    let mut result = init_segment;
    result.extend_from_slice(&chunk_data);
    
    println!("[DVR] Reading chunk {} with prepended init segment ({} bytes total)", 
             chunk_index, result.len());
    
    Ok(result)
}

