use std::path::PathBuf;
use reqwest;
use tokio::fs;
use tokio::io::AsyncWriteExt;

/// Download a remote audio file (e.g., from Freesound) to local storage
/// Returns the local file path
#[tauri::command]
pub async fn download_library_audio(url: String, filename: String) -> Result<String, String> {
    // Get the library audio storage directory
    let storage_dir = crate::storage::get_library_audio_dir()
        .map_err(|e| format!("Failed to get library audio directory: {}", e))?;

    // Ensure the directory exists
    fs::create_dir_all(&storage_dir)
        .await
        .map_err(|e| format!("Failed to create library audio directory: {}", e))?;

    // Sanitize filename to prevent path traversal
    let safe_filename = filename
        .replace("..", "")
        .replace("/", "_")
        .replace("\\", "_");

    let file_path = storage_dir.join(&safe_filename);

    // Download the file
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download audio: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response bytes: {}", e))?;

    // Write to file
    let mut file = fs::File::create(&file_path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    file.write_all(&bytes)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))?;

    // Return the absolute path as a string
    file_path
        .to_str()
        .ok_or_else(|| "Failed to convert path to string".to_string())
        .map(|s| s.to_string())
}
