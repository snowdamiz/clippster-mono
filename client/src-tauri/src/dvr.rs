use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;

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

/// Read only the init segment for MSE playback
/// The init segment contains EBML header, Segment, and Track info - needed once at start
#[tauri::command]
pub async fn read_dvr_init_segment(
    app: AppHandle,
    mint_id: String,
) -> Result<Vec<u8>, String> {
    let dvr_dir = get_dvr_dir(&app, &mint_id)?;
    let init_path = get_init_segment_path(&dvr_dir);
    
    // Try to read existing init segment
    if init_path.exists() {
        let init_segment = fs::read(&init_path)
            .map_err(|e| format!("Failed to read init segment: {}", e))?;
        println!("[DVR] Read init segment ({} bytes)", init_segment.len());
        return Ok(init_segment);
    }
    
    // No init segment file, try to extract from chunk 0
    let chunk0_path = dvr_dir.join("chunk_00000.webm");
    if !chunk0_path.exists() {
        return Err(format!("No init segment or chunk 0 found for {}", mint_id));
    }
    
    let chunk0_data = fs::read(&chunk0_path)
        .map_err(|e| format!("Failed to read chunk 0: {}", e))?;
    
    if let Some(init_segment) = extract_init_segment(&chunk0_data) {
        // Save for future use
        fs::write(&init_path, &init_segment)
            .map_err(|e| format!("Failed to write init segment: {}", e))?;
        println!("[DVR] Extracted and saved init segment from chunk 0 ({} bytes)", init_segment.len());
        Ok(init_segment)
    } else {
        Err("Could not extract init segment from chunk 0".to_string())
    }
}

/// Read only the cluster data from a DVR chunk (no init segment)
/// For MSE playback, init segment is appended once, then only cluster data is needed
#[tauri::command]
pub async fn read_dvr_cluster(
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
    
    // For chunk 0, we need to strip the init segment and return only the cluster data
    if chunk_index == 0 {
        // Find where the first Cluster starts
        for i in 0..chunk_data.len().saturating_sub(3) {
            if chunk_data[i] == 0x1F 
                && chunk_data[i + 1] == 0x43 
                && chunk_data[i + 2] == 0xB6 
                && chunk_data[i + 3] == 0x75 
            {
                // Return only the cluster data (from Cluster element onwards)
                let cluster_data = chunk_data[i..].to_vec();
                println!("[DVR] Reading chunk 0 cluster data only ({} bytes, stripped {} bytes init)", 
                         cluster_data.len(), i);
                return Ok(cluster_data);
            }
        }
        // No Cluster found, return as-is (shouldn't happen for valid WebM)
        println!("[DVR] Warning: No Cluster found in chunk 0, returning full data");
        return Ok(chunk_data);
    }
    
    // For chunks > 0, the file already contains only cluster data
    println!("[DVR] Reading chunk {} cluster data ({} bytes)", chunk_index, chunk_data.len());
    Ok(chunk_data)
}

/// Build a VOD (MP4) from DVR chunks and save to project directory
/// This is called when the user stops watching a stream after creating clips
#[tauri::command]
pub async fn build_vod_from_dvr(
    app: AppHandle,
    mint_id: String,
    project_id: String,
    display_name: String,
) -> Result<String, String> {
    let dvr_dir = get_dvr_dir(&app, &mint_id)?;
    
    if !dvr_dir.exists() {
        return Err(format!("DVR directory not found for {}", mint_id));
    }
    
    // List all chunk files
    let mut chunk_files: Vec<(u32, PathBuf)> = vec![];
    
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
    
    println!("[DVR] Building VOD from {} chunks", chunk_files.len());
    
    // Get storage paths
    let storage_paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;
    
    // Create output directory for this project (in videos folder)
    let output_dir = storage_paths.videos.join(&project_id);
    fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create output directory: {}", e))?;
    
    // Create temp directory for prepared chunks
    let temp_dir = storage_paths.temp.join("dvr_vod");
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    
    // Read the init segment (needed for chunks > 0 to be valid WebM files)
    let init_segment_path = get_init_segment_path(&dvr_dir);
    let init_segment = if init_segment_path.exists() {
        Some(fs::read(&init_segment_path)
            .map_err(|e| format!("Failed to read init segment: {}", e))?)
    } else {
        // Try to extract from chunk 0
        let chunk0_path = dvr_dir.join("chunk_00000.webm");
        if chunk0_path.exists() {
            let chunk0_data = fs::read(&chunk0_path)
                .map_err(|e| format!("Failed to read chunk 0: {}", e))?;
            extract_init_segment(&chunk0_data)
        } else {
            None
        }
    };
    
    // Prepare chunk files - chunks > 0 need init segment prepended to be valid WebM
    let mut prepared_files: Vec<PathBuf> = vec![];
    let mut temp_files_to_cleanup: Vec<PathBuf> = vec![];
    
    for (idx, path) in &chunk_files {
        if *idx == 0 {
            // Chunk 0 is already a valid WebM file
            prepared_files.push(path.clone());
        } else {
            // Chunks > 0 need init segment prepended
            if let Some(ref init_data) = init_segment {
                let chunk_data = fs::read(path)
                    .map_err(|e| format!("Failed to read chunk {}: {}", idx, e))?;
                
                // Create a temp file with init segment + chunk data
                let temp_filename = format!("prepared_vod_chunk_{:05}.webm", idx);
                let temp_path = temp_dir.join(&temp_filename);
                
                let mut prepared_data = init_data.clone();
                prepared_data.extend_from_slice(&chunk_data);
                
                fs::write(&temp_path, &prepared_data)
                    .map_err(|e| format!("Failed to write prepared chunk {}: {}", idx, e))?;
                
                prepared_files.push(temp_path.clone());
                temp_files_to_cleanup.push(temp_path);
            } else {
                // No init segment available, try using the raw chunk (may fail)
                println!("[DVR] Warning: No init segment available for chunk {}, using raw file", idx);
                prepared_files.push(path.clone());
            }
        }
    }
    
    // Create concat list file for FFmpeg using prepared files
    let concat_list_path = temp_dir.join(format!("concat_{}.txt", uuid::Uuid::new_v4()));
    let mut concat_content = String::new();
    
    for path in &prepared_files {
        let escaped_path = path.to_string_lossy().replace('\\', "/").replace("'", "'\\''");
        concat_content.push_str(&format!("file '{}'\n", escaped_path));
    }
    
    fs::write(&concat_list_path, &concat_content)
        .map_err(|e| format!("Failed to write concat list: {}", e))?;
    
    // Generate output filename
    let safe_name = sanitize_filename(&display_name);
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let output_filename = format!("{}_VOD_{}.mp4", safe_name, timestamp);
    let output_path = output_dir.join(&output_filename);
    
    // Detect hardware encoder
    let encoder = crate::clips::encoder::detect_hardware_encoder(&app, "medium").await;
    
    // Build FFmpeg args for concatenation and conversion
    // WebM from MediaRecorder has variable/broken timestamps - regenerate them
    let mut args = vec![
        "-fflags".to_string(), "+genpts+igndts".to_string(), // Regenerate PTS, ignore DTS
        "-f".to_string(), "concat".to_string(),
        "-safe".to_string(), "0".to_string(),
        "-i".to_string(), concat_list_path.to_string_lossy().to_string(),
        // Normalize frame rate to fix laggy playback from variable frame timing
        "-vf".to_string(), "fps=30,setpts=PTS-STARTPTS".to_string(),
        "-c:v".to_string(), encoder.codec.clone(),
    ];
    
    // Add preset if applicable
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }
    
    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());
    
    // Add common parameters
    args.extend_from_slice(&[
        "-r".to_string(), "30".to_string(), // Force constant 30fps output
        "-vsync".to_string(), "cfr".to_string(), // Constant frame rate
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-async".to_string(), "1".to_string(), // Sync audio to video
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);
    
    println!("[DVR] Running FFmpeg to build VOD...");
    
    let shell = app.shell();
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;
    
    // Cleanup concat list and temp prepared files
    let _ = fs::remove_file(&concat_list_path);
    for temp_file in temp_files_to_cleanup {
        let _ = fs::remove_file(&temp_file);
    }
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg VOD build failed: {}", stderr));
    }
    
    println!("[DVR] VOD built successfully: {}", output_path.display());
    
    Ok(output_path.to_string_lossy().to_string())
}

/// Sanitize filename to remove invalid characters
fn sanitize_filename(name: &str) -> String {
    let invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    let mut result = name.to_string();
    for c in invalid_chars {
        result = result.replace(c, "_");
    }
    // Trim whitespace and limit length
    result.trim().chars().take(100).collect()
}

/// Build a segment file from a range of DVR chunks
/// Used by auto-detect to create longer segments from 4-second DVR chunks
#[tauri::command]
pub async fn build_segment_from_dvr_chunks(
    app: AppHandle,
    mint_id: String,
    start_chunk: u32,
    end_chunk: u32,
    segment_number: u32,
) -> Result<String, String> {
    let dvr_dir = get_dvr_dir(&app, &mint_id)?;
    
    if !dvr_dir.exists() {
        return Err(format!("DVR directory not found for {}", mint_id));
    }
    
    // Collect chunk files in range
    let mut chunk_files: Vec<(u32, std::path::PathBuf)> = vec![];
    
    for idx in start_chunk..=end_chunk {
        let chunk_filename = format!("chunk_{:05}.webm", idx);
        let chunk_path = dvr_dir.join(&chunk_filename);
        
        if chunk_path.exists() {
            chunk_files.push((idx, chunk_path));
        }
    }
    
    if chunk_files.is_empty() {
        return Err(format!("No DVR chunks found in range {}-{} for {}", start_chunk, end_chunk, mint_id));
    }
    
    // Sort by index
    chunk_files.sort_by_key(|(idx, _)| *idx);
    
    println!("[DVR] Building segment {} from {} chunks ({}->{})", 
             segment_number, chunk_files.len(), start_chunk, end_chunk);
    
    // Get storage paths
    let storage_paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;
    
    // Create temp directory for segment output and prepared chunks
    let temp_dir = storage_paths.temp.join("dvr_segments");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    
    // Read init segment (from chunk 0) for cases where we start mid-stream
    let init_path = get_init_segment_path(&dvr_dir);
    let init_segment: Option<Vec<u8>> = if init_path.exists() {
        Some(fs::read(&init_path).map_err(|e| format!("Failed to read init segment: {}", e))?)
    } else {
        // Try to extract from chunk 0 if present
        let chunk0_path = dvr_dir.join("chunk_00000.webm");
        if chunk0_path.exists() {
            let chunk0_data = fs::read(&chunk0_path)
                .map_err(|e| format!("Failed to read chunk 0 for init extraction: {}", e))?;
            extract_init_segment(&chunk0_data)
        } else {
            None
        }
    };
    
    // Build a single combined WebM: init (if needed) + chunk data
    let combined_webm_path = temp_dir.join(format!("combined_{}_{}.webm", mint_id, segment_number));
    let mut combined_data: Vec<u8> = vec![];
    
    let first_chunk_idx = chunk_files.first().map(|(idx, _)| *idx).unwrap_or(0);
    if first_chunk_idx != 0 {
        // prepend init segment when starting mid-stream
        if let Some(ref init) = init_segment {
            combined_data.extend_from_slice(init);
            println!("[DVR] Prepended init segment ({} bytes) for segment starting at chunk {}", init.len(), first_chunk_idx);
        } else {
            return Err(format!("No init segment available for segment starting at chunk {}", first_chunk_idx));
        }
    }
    
    for (idx, path) in &chunk_files {
        let chunk_bytes = fs::read(path)
            .map_err(|e| format!("Failed to read chunk {}: {}", idx, e))?;
        combined_data.extend_from_slice(&chunk_bytes);
    }
    
    fs::write(&combined_webm_path, &combined_data)
        .map_err(|e| format!("Failed to write combined WebM: {}", e))?;
    
    println!("[DVR] Combined {} chunks into single WebM ({} bytes)", chunk_files.len(), combined_data.len());
    
    // Generate output filename - use .ts format for compatibility with existing pipeline
    let output_filename = format!("segment_{}_{}.ts", mint_id, segment_number);
    let output_path = temp_dir.join(&output_filename);
    
    // Process combined WebM with FFmpeg
    let args = vec![
        "-fflags".to_string(), "+genpts+igndts".to_string(), // regenerate timestamps
        "-i".to_string(), combined_webm_path.to_string_lossy().to_string(),
        "-vf".to_string(), "fps=30,setpts=PTS-STARTPTS".to_string(),
        // Re-encode video to H.264 for TS compatibility
        "-c:v".to_string(), "libx264".to_string(),
        "-preset".to_string(), "ultrafast".to_string(),
        "-crf".to_string(), "18".to_string(),
        "-r".to_string(), "30".to_string(), // Force constant 30fps output
        "-g".to_string(), "30".to_string(), // Keyframe every 1 second
        "-keyint_min".to_string(), "30".to_string(),
        "-sc_threshold".to_string(), "0".to_string(),
        // Re-encode audio to AAC for TS compatibility  
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        // Output format
        "-f".to_string(), "mpegts".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ];
    
    println!("[DVR] Running FFmpeg on combined WebM to build segment from {} chunks...", chunk_files.len());
    
    let shell = app.shell();
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;
    
    // Cleanup combined file
    let _ = fs::remove_file(&combined_webm_path);
    
    // Log FFmpeg output for debugging
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !stderr.is_empty() {
        // Log last few lines of FFmpeg output for debugging
        let last_lines: Vec<&str> = stderr.lines().rev().take(5).collect();
        for line in last_lines.iter().rev() {
            if !line.trim().is_empty() {
                println!("[DVR] FFmpeg: {}", line.trim());
            }
        }
    }
    
    if !output.status.success() {
        // Log full error for debugging
        println!("[DVR] FFmpeg failed with full output:\n{}", stderr);
        return Err(format!("FFmpeg segment build failed: {}", stderr));
    }
    
    // Log output file size for verification
    if let Ok(metadata) = std::fs::metadata(&output_path) {
        println!("[DVR] Segment {} built successfully: {} ({} MB)", 
                 segment_number, output_path.display(), metadata.len() / 1024 / 1024);
    } else {
        println!("[DVR] Segment {} built successfully: {}", segment_number, output_path.display());
    }
    
    Ok(output_path.to_string_lossy().to_string())
}
