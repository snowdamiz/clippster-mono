use crate::storage;
use tauri_plugin_shell::ShellExt;

/// Extract a segment of a video file scaled to 480p H.264 for AI analysis.
/// Returns the absolute path to a temporary MP4 file (caller should delete after upload).
#[tauri::command]
pub async fn extract_video_chunk_for_analysis(
    app: tauri::AppHandle,
    video_path: String,
    start_time_secs: f64,
    end_time_secs: f64,
) -> Result<String, String> {
    if end_time_secs <= start_time_secs {
        return Err(format!(
            "extract_video_chunk_for_analysis: invalid range {}s-{}s",
            start_time_secs, end_time_secs
        ));
    }

    let duration = end_time_secs - start_time_secs;

    println!(
        "[Rust] extract_video_chunk_for_analysis: {} -> {:.1}s-{:.1}s ({:.1}s)",
        video_path, start_time_secs, end_time_secs, duration
    );

    let paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_nanos();

    let output_path = paths
        .temp
        .join(format!("vod_enhanced_chunk_{}.mp4", timestamp));

    let output_str = output_path
        .to_str()
        .ok_or("Invalid output path")?
        .to_string();

    let start_str = format!("{:.3}", start_time_secs.max(0.0));
    let duration_str = format!("{:.3}", duration);

    let shell = app.shell();

    // Scale to 480p, H.264 ~400kbps video + AAC audio for multimodal AI input.
    let output = shell
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-ss",
            &start_str,
            "-i",
            &video_path,
            "-t",
            &duration_str,
            "-vf",
            "scale=-2:480",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "28",
            "-maxrate",
            "400k",
            "-bufsize",
            "800k",
            "-c:a",
            "aac",
            "-b:a",
            "64k",
            "-movflags",
            "+faststart",
            "-y",
            &output_str,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let _ = std::fs::remove_file(&output_path);
        return Err(format!("ffmpeg video chunk extraction failed: {}", stderr.trim()));
    }

    let meta = std::fs::metadata(&output_path)
        .map_err(|e| format!("Failed to stat output: {}", e))?;

    if meta.len() == 0 {
        let _ = std::fs::remove_file(&output_path);
        return Err("Video chunk extraction produced empty file".to_string());
    }

    println!(
        "[Rust] extract_video_chunk_for_analysis OK: {} bytes -> {}",
        meta.len(),
        output_str
    );

    Ok(output_str)
}
