use tauri_plugin_shell::ShellExt;

pub async fn generate_clip_thumbnail_simple(
    app: &tauri::AppHandle,
    clip_path: &std::path::Path,
    clip_id: &str
) -> Result<Option<std::path::PathBuf>, String> {
    let shell = app.shell();

    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let thumbnail_filename = format!("clip_{}_thumb.jpg", clip_id);
    let thumbnail_path = paths.thumbnails.join(thumbnail_filename);

    println!("[Rust] Generating thumbnail for clip: {}", clip_path.display());

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", clip_path.to_str().ok_or("Invalid clip path")?,
            "-ss", "00:00:01",  // Seek to 1 second
            "-vframes", "1",
            "-vf", "scale=320:-1",
            "-y",
            thumbnail_path.to_str().ok_or("Invalid thumbnail path")?,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg for thumbnail: {}", e))?;

    if output.status.success() {
        Ok(Some(thumbnail_path))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("[Rust] Failed to generate thumbnail: {}", stderr);
        Ok(None)
    }
}

