use serde::{Deserialize, Serialize};
use crate::storage;
use crate::ffmpeg_utils::{parse_duration_from_ffmpeg_output};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioChunk {
    pub chunk_id: String,
    pub file_path: String,
    pub filename: String,
    pub start_time: f64,
    pub end_time: f64,
    pub duration: f64,
    pub base64_data: String,
    pub file_size: u64,
}

#[tauri::command]
pub async fn extract_audio_from_video(
    app: tauri::AppHandle,
    video_path: String,
    output_path: String
) -> Result<(String, String), String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] extract_audio_from_video called with:");
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   output_path: {}", output_path);

    // Get storage paths for temporary file
    let paths = storage::init_storage_dirs()
        .map_err(|e| {
            println!("[Rust] Failed to get storage paths: {}", e);
            format!("Failed to get storage paths: {}", e)
        })?;

    // Create a unique temporary audio file path - OGG format for better compression
    let temp_audio_path = paths.videos.join(format!("temp_audio_{}_audio_only.ogg",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| format!("Failed to get timestamp: {}", e))?
            .as_secs()
    ));

    println!("[Rust] Temporary audio path: {}", temp_audio_path.display());

    // Use FFmpeg to extract audio as OGG Vorbis - optimized for transcription
    let shell = app.shell();
    println!("[Rust] Running FFmpeg to extract audio...");

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", &video_path,
            "-c:a", "libvorbis",  // OGG Vorbis codec (better compression)
            "-q:a", "1",          // Quality level 1 (~64-96k MP3 equivalent, optimal for transcription)
            "-vn",               // No video
            "-y",                // Overwrite output file
            temp_audio_path.to_str().ok_or("Invalid temporary audio path")?,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        println!("[Rust] FFmpeg failed:");
        println!("[Rust]   stderr: {}", stderr);
        println!("[Rust]   stdout: {}", stdout);
        return Err(format!("FFmpeg extraction failed: {}", stderr));
    }

    // Check FFmpeg output for any warnings
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !stderr.is_empty() {
        println!("[Rust] FFmpeg stderr (warnings): {}", stderr);
    }

    println!("[Rust] FFmpeg extraction completed successfully");

    // Read the MP3 file and return as base64 encoded data
    println!("[Rust] Reading MP3 file for base64 encoding...");
    let audio_bytes = std::fs::read(&temp_audio_path)
        .map_err(|e| {
            println!("[Rust] Failed to read temporary audio file: {}", e);
            format!("Failed to read audio file: {}", e)
        })?;

    println!("[Rust] Read {} bytes from audio file", audio_bytes.len());

    // Encode to base64
    use base64::{Engine as _, engine::general_purpose};
    let base64_data = general_purpose::STANDARD.encode(&audio_bytes);
    println!("[Rust] Encoded {} bytes to {} chars of base64", audio_bytes.len(), base64_data.len());

    // Get filename for return
    let filename = temp_audio_path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("audio.ogg");

    // Clean up the temporary file
    if let Err(e) = std::fs::remove_file(&temp_audio_path) {
        eprintln!("[Rust] Warning: Failed to remove temporary audio file {}: {}", temp_audio_path.display(), e);
    } else {
        println!("[Rust] Cleaned up temporary audio file");
    }

    println!("[Rust] Audio extraction completed successfully");
    Ok((filename.to_string(), base64_data))
}

#[tauri::command]
pub async fn extract_and_chunk_audio(
    app: tauri::AppHandle,
    video_path: String,
    project_id: String,
    chunk_duration_minutes: u32,
    overlap_seconds: u32
) -> Result<Vec<AudioChunk>, String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] extract_and_chunk_audio called with:");
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   project_id: {}", project_id);
    println!("[Rust]   chunk_duration_minutes: {}", chunk_duration_minutes);
    println!("[Rust]   overlap_seconds: {}", overlap_seconds);

    // Get storage paths for temporary files
    let paths = storage::init_storage_dirs()
        .map_err(|e| {
            println!("[Rust] Failed to get storage paths: {}", e);
            format!("Failed to get storage paths: {}", e)
        })?;

    let chunk_duration_secs = chunk_duration_minutes as f64 * 60.0;
    let overlap_secs = overlap_seconds as f64;
    let shell = app.shell();

    // First, get video duration using FFmpeg
    println!("[Rust] Getting video duration...");
    let duration_output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", &video_path,
            "-f", "null",
            "-"
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg for duration: {}", e))?;

    // Parse duration from FFmpeg output
    let stderr = String::from_utf8_lossy(&duration_output.stderr);
    let video_duration = parse_duration_from_ffmpeg_output(&stderr)
        .map_err(|e| format!("Failed to parse video duration: {}", e))?;

    println!("[Rust] Video duration: {:.2} seconds", video_duration);

    if video_duration <= 0.0 {
        return Err("Invalid video duration".to_string());
    }

    // Calculate number of chunks needed
    let mut chunks = Vec::new();
    let mut current_start = 0.0;
    let mut chunk_index = 1;

    while current_start < video_duration {
        let current_end = (current_start + chunk_duration_secs).min(video_duration);
        let actual_duration = current_end - current_start;

        // Skip very small final chunks
        if actual_duration < 30.0 {
            println!("[Rust] Skipping small final chunk of {:.2} seconds", actual_duration);
            break;
        }

        println!("[Rust] Processing chunk {}: {:.2}s - {:.2}s (duration: {:.2}s)",
                chunk_index, current_start, current_end, actual_duration);

        // Create chunk file path
        let chunk_filename = format!("{}_chunk_{:03}.ogg", project_id, chunk_index);
        let chunk_path = paths.videos.join(&chunk_filename);

        // Extract chunk using FFmpeg
        let chunk_output = shell.sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args([
                "-i", &video_path,
                "-ss", &format!("{:.3}", current_start),
                "-t", &format!("{:.3}", actual_duration),
                "-c:a", "libvorbis",  // OGG Vorbis codec (better compression)
                "-q:a", "1",          // Quality level 1 (~64-96k MP3 equivalent, optimal for transcription)
                "-vn",               // No video
                "-y",                // Overwrite output file
                chunk_path.to_str().ok_or("Invalid chunk path")?,
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to run ffmpeg for chunk {}: {}", chunk_index, e))?;

        if !chunk_output.status.success() {
            let stderr = String::from_utf8_lossy(&chunk_output.stderr);
            println!("[Rust] FFmpeg chunk {} failed: {}", chunk_index, stderr);
            return Err(format!("FFmpeg chunk {} extraction failed: {}", chunk_index, stderr));
        }

        // Read chunk file and encode to base64
        let chunk_bytes = std::fs::read(&chunk_path)
            .map_err(|e| format!("Failed to read chunk file {}: {}", chunk_index, e))?;

        let base64_data = {
            use base64::{Engine as _, engine::general_purpose};
            general_purpose::STANDARD.encode(&chunk_bytes)
        };

        // Create audio chunk struct
        let audio_chunk = AudioChunk {
            chunk_id: format!("{}_{}", project_id, chunk_index),
            file_path: chunk_path.to_string_lossy().to_string(),
            filename: chunk_filename,
            start_time: current_start,
            end_time: current_end,
            duration: actual_duration,
            base64_data,
            file_size: chunk_bytes.len() as u64,
        };

        chunks.push(audio_chunk);
        println!("[Rust] Chunk {} completed: {} bytes", chunk_index, chunk_bytes.len());

        // Clean up temporary chunk file
        if let Err(e) = std::fs::remove_file(&chunk_path) {
            eprintln!("[Rust] Warning: Failed to remove chunk file {}: {}", chunk_path.display(), e);
        }

        // Move to next chunk (with overlap for long videos)
        current_start = current_end - if current_end < video_duration { overlap_secs } else { 0.0 };
        chunk_index += 1;

        // Safety check to prevent infinite loop
        if chunk_index > 100 {
            return Err("Too many chunks - possible infinite loop".to_string());
        }
    }

    println!("[Rust] Audio chunking completed successfully. Created {} chunks.", chunks.len());
    Ok(chunks)
}