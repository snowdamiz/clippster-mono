use reqwest;
use tokio::fs;
use tokio::io::AsyncWriteExt;

/// Download remote B-roll media to durable project storage.
/// Returns the absolute local file path.
#[tauri::command]
pub async fn download_broll_media(
    url: String,
    project_id: String,
    filename: String,
) -> Result<String, String> {
    let storage_dir = crate::storage::get_broll_media_dir(&project_id)?;

    fs::create_dir_all(&storage_dir)
        .await
        .map_err(|e| format!("Failed to create broll media directory: {}", e))?;

    let safe_filename = filename
        .replace("..", "")
        .replace("/", "_")
        .replace("\\", "_");

    let file_path = storage_dir.join(&safe_filename);

    // Reuse existing file if present
    if file_path.exists() {
        return file_path
            .to_str()
            .ok_or_else(|| "Failed to convert path to string".to_string())
            .map(|s| s.to_string());
    }

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download B-roll media: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error downloading B-roll: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read B-roll response: {}", e))?;

    if bytes.is_empty() {
        return Err("Downloaded B-roll file is empty".to_string());
    }

    let mut file = fs::File::create(&file_path)
        .await
        .map_err(|e| format!("Failed to create B-roll file: {}", e))?;

    file.write_all(&bytes)
        .await
        .map_err(|e| format!("Failed to write B-roll file: {}", e))?;

    println!(
        "[Storage] Downloaded B-roll media: {} ({} bytes)",
        file_path.display(),
        bytes.len()
    );

    file_path
        .to_str()
        .ok_or_else(|| "Failed to convert path to string".to_string())
        .map(|s| s.to_string())
}

/// Verify a B-roll media path exists on disk.
#[tauri::command]
pub fn resolve_broll_media_path(path: String) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Empty media path".to_string());
    }
    if std::path::Path::new(trimmed).exists() {
        return Ok(trimmed.to_string());
    }
    Err(format!("B-roll media file not found: {}", trimmed))
}
