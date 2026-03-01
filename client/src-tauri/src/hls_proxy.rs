use base64::{engine::general_purpose, Engine as _};
use std::fs;
use std::path::PathBuf;

/// Read HLS playlist file (.m3u8)
#[tauri::command]
pub async fn read_hls_playlist(encoded_dir: String, filename: String) -> Result<String, String> {
    // Decode the base64-encoded directory path
    let decoded = general_purpose::STANDARD
        .decode(&encoded_dir)
        .or_else(|_| general_purpose::STANDARD_NO_PAD.decode(&encoded_dir))
        .or_else(|_| general_purpose::URL_SAFE_NO_PAD.decode(&encoded_dir))
        .map_err(|e| format!("Failed to decode directory: {}", e))?;

    let dir_str = String::from_utf8(decoded)
        .map_err(|e| format!("Invalid UTF-8 in directory path: {}", e))?;

    let mut path = PathBuf::from(&dir_str);
    path.push(&filename);

    // Security: Ensure the path is within the decoded directory
    let canonical_path = path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;
    let canonical_dir = PathBuf::from(&dir_str)
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize directory: {}", e))?;

    if !canonical_path.starts_with(&canonical_dir) {
        return Err("Path traversal attempt detected".to_string());
    }

    // Read the playlist file
    let content =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read playlist: {}", e))?;

    Ok(content)
}

/// Read HLS segment file (.ts)
#[tauri::command]
pub async fn read_hls_segment(encoded_dir: String, filename: String) -> Result<Vec<u8>, String> {
    // Only allow .ts files
    if !filename.ends_with(".ts") {
        return Err("Invalid segment file type".to_string());
    }

    // Decode the base64-encoded directory path
    let decoded = general_purpose::STANDARD
        .decode(&encoded_dir)
        .or_else(|_| general_purpose::STANDARD_NO_PAD.decode(&encoded_dir))
        .or_else(|_| general_purpose::URL_SAFE_NO_PAD.decode(&encoded_dir))
        .map_err(|e| format!("Failed to decode directory: {}", e))?;

    let dir_str = String::from_utf8(decoded)
        .map_err(|e| format!("Invalid UTF-8 in directory path: {}", e))?;

    let mut path = PathBuf::from(&dir_str);
    path.push(&filename);

    // Security: Ensure the path is within the decoded directory
    let canonical_path = path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;
    let canonical_dir = PathBuf::from(&dir_str)
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize directory: {}", e))?;

    if !canonical_path.starts_with(&canonical_dir) {
        return Err("Path traversal attempt detected".to_string());
    }

    // Read the segment file
    let content = fs::read(&path).map_err(|e| format!("Failed to read segment: {}", e))?;

    Ok(content)
}

/// Check if HLS playlist exists
#[tauri::command]
pub async fn check_hls_playlist_exists(
    encoded_dir: String,
    filename: String,
) -> Result<bool, String> {
    // Decode the base64-encoded directory path
    let decoded = general_purpose::STANDARD
        .decode(&encoded_dir)
        .or_else(|_| general_purpose::STANDARD_NO_PAD.decode(&encoded_dir))
        .or_else(|_| general_purpose::URL_SAFE_NO_PAD.decode(&encoded_dir))
        .map_err(|e| format!("Failed to decode directory: {}", e))?;

    let dir_str = String::from_utf8(decoded)
        .map_err(|e| format!("Invalid UTF-8 in directory path: {}", e))?;

    let mut path = PathBuf::from(&dir_str);
    path.push(&filename);

    Ok(path.exists())
}
