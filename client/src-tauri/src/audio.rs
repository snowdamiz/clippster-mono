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

    // Check if we have a cached audio file from waveform generation
    let video_path_hash = crate::waveform::generate_video_path_hash(&video_path);
    let cached_path_result = crate::waveform::get_audio_cache_file_path(&video_path_hash);
    
    if let Ok(ref cached_path) = cached_path_result {
        if cached_path.exists() {
            println!("[Rust] Found cached audio file for clip detection: {:?}", cached_path);
            
            // Read the cached file
            let audio_bytes = std::fs::read(cached_path)
                .map_err(|e| {
                    println!("[Rust] Failed to read cached audio file: {}", e);
                    format!("Failed to read audio file: {}", e)
                })?;

            println!("[Rust] Read {} bytes from cached audio file", audio_bytes.len());

            // Encode to base64
            use base64::{Engine as _, engine::general_purpose};
            let base64_data = general_purpose::STANDARD.encode(&audio_bytes);

            // Get filename for return
            let filename = cached_path.file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("audio.mp3");
                
            return Ok((filename.to_string(), base64_data));
        }
    }

    println!("[Rust] No cached audio file found, generating fresh...");

    // Determine output path - prefer cache path, fallback to temp
    let (target_path, is_cache_file) = if let Ok(path) = cached_path_result {
        println!("[Rust] Will save to cache path: {:?}", path);
        (path, true)
    } else {
        let temp_path = paths.videos.join(format!("temp_audio_{}_audio_only.mp3",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| format!("Failed to get timestamp: {}", e))?
            .as_secs()
    ));
        println!("[Rust] Will save to temp path: {:?}", temp_path);
        (temp_path, false)
    };

    println!("[Rust] Target audio path: {}", target_path.display());

    // Use FFmpeg to extract audio as MP3 - optimized for transcription
    let shell = app.shell();
    println!("[Rust] Running FFmpeg to extract audio...");

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", &video_path,
            "-c:a", "libmp3lame", // MP3 codec
            "-q:a", "8",          // Quality level 8 (~85kbps)
            "-vn",               // No video
            "-y",                // Overwrite output file
            target_path.to_str().ok_or("Invalid target audio path")?,
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

    // Read the file and return as base64 encoded data
    println!("[Rust] Reading audio file for base64 encoding...");
    let mut audio_bytes = std::fs::read(&target_path)
        .map_err(|e| {
            println!("[Rust] Failed to read audio file: {}", e);
            format!("Failed to read audio file: {}", e)
        })?;

    println!("[Rust] Read {} bytes from audio file", audio_bytes.len());

    // Guard: if the extracted file is empty, retry with WAV (16k mono) to avoid Whisper 400
    if audio_bytes.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        println!(
            "[Rust] Empty audio after MP3 extraction. stdout: {}; stderr: {}. Retrying as WAV...",
            stdout.trim(),
            stderr.trim()
        );

        let wav_path = paths.videos.join(format!(
            "temp_audio_{}_fallback.wav",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| format!("Failed to get timestamp: {}", e))?
                .as_secs()
        ));

        let shell = app.shell();
        let wav_output = shell
            .sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args([
                "-i",
                &video_path,
                "-ac",
                "2",
                "-ar",
                "48000",
                "-vn",
                "-y",
                wav_path.to_str().ok_or("Invalid wav path")?,
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to run ffmpeg (wav fallback): {}", e))?;

        if !wav_output.status.success() {
            let stderr = String::from_utf8_lossy(&wav_output.stderr);
            let stdout = String::from_utf8_lossy(&wav_output.stdout);
            let msg = format!(
                "FFmpeg WAV fallback failed for {}. stdout: {}; stderr: {}",
                video_path,
                stdout.trim(),
                stderr.trim()
            );
            println!("[Rust] {}", msg);
            let _ = std::fs::remove_file(&target_path);
            return Err(msg);
        }

        audio_bytes = std::fs::read(&wav_path)
            .map_err(|e| format!("Failed to read wav fallback: {}", e))?;

        println!(
            "[Rust] WAV fallback bytes: {} (path: {})",
            audio_bytes.len(),
            wav_path.display()
        );

        // Clean up the wav temp file
        let _ = std::fs::remove_file(&wav_path);

        if audio_bytes.is_empty() {
            let msg = "WAV fallback also produced empty audio; aborting.".to_string();
            println!("[Rust] {}", msg);
            let _ = std::fs::remove_file(&target_path);
            return Err(msg);
        }
    }

    // Encode to base64
    use base64::{Engine as _, engine::general_purpose};
    let base64_data = general_purpose::STANDARD.encode(&audio_bytes);

    println!("[Rust] Encoded {} bytes to {} chars of base64", audio_bytes.len(), base64_data.len());

    // Get filename for return
    let filename = target_path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("audio.mp3");

    // Clean up only if it's a temporary file (not cached)
    if !is_cache_file {
        if let Err(e) = std::fs::remove_file(&target_path) {
            eprintln!("[Rust] Warning: Failed to remove temporary audio file {}: {}", target_path.display(), e);
    } else {
        println!("[Rust] Cleaned up temporary audio file");
        }
    } else {
        println!("[Rust] Kept cached audio file: {:?}", target_path);
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

    // Declare variables before they are used
    let chunk_duration_secs = chunk_duration_minutes as f64 * 60.0;
    let overlap_secs = overlap_seconds as f64;
    let shell = app.shell();

    // Check if we have a cached audio file from waveform generation (shared cache)
    let video_path_hash = crate::waveform::generate_video_path_hash(&video_path);
    let cached_audio_path_result = crate::waveform::get_audio_cache_file_path(&video_path_hash);

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

    // Determine if we should use the cached audio file or the original video
    // First, validate that the cached audio has the correct duration
    
    let use_cached_audio = if let Ok(ref cached_path) = cached_audio_path_result {
        if cached_path.exists() {
            println!("[Rust] Found cached audio file, validating duration: {:?}", cached_path);
            
            // Validate cached audio duration matches video duration
            let cache_duration_output = shell.sidecar("ffmpeg")
                .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
                .args([
                    "-i", cached_path.to_str().ok_or("Invalid cached path")?,
                    "-f", "null",
                    "-"
                ])
                .output()
                .await
                .map_err(|e| format!("Failed to check cached audio duration: {}", e))?;
            
            let cache_stderr = String::from_utf8_lossy(&cache_duration_output.stderr);
            let cached_duration = parse_duration_from_ffmpeg_output(&cache_stderr).unwrap_or(0.0);
            
            println!("[Rust] Cached audio duration: {:.2}s, Video duration: {:.2}s", cached_duration, video_duration);
            
            // Allow 5% tolerance for duration mismatch due to encoding differences
            let duration_diff = (cached_duration - video_duration).abs();
            let tolerance = video_duration * 0.05;
            
            if duration_diff <= tolerance {
                println!("[Rust] Cached audio duration is valid, using cache");
                true
            } else {
                println!("[Rust] WARNING: Cached audio duration mismatch ({:.2}s vs {:.2}s), skipping cache", cached_duration, video_duration);
                // Delete the corrupted cache file
                if let Err(e) = std::fs::remove_file(cached_path) {
                    eprintln!("[Rust] Warning: Failed to remove corrupted cache file: {}", e);
                } else {
                    println!("[Rust] Deleted corrupted cache file");
                }
                false
            }
        } else {
            false
        }
    } else {
        false
    };

    let source_path = if use_cached_audio {
        cached_audio_path_result.as_ref().unwrap().to_str().ok_or("Invalid cached path")?
    } else {
        &video_path
    };

    println!("[Rust] Using source for chunking: {}", source_path);

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
        let chunk_filename = format!("{}_chunk_{:03}.mp3", project_id, chunk_index);
        let chunk_path = paths.videos.join(&chunk_filename);

        // Extract chunk using FFmpeg
        // If using cached MP3, we are just slicing the audio file
        // If using video, we are extracting and slicing
        let mut args = vec![
            "-i".to_string(), source_path.to_string(),
            "-ss".to_string(), format!("{:.3}", current_start),
            "-t".to_string(), format!("{:.3}", actual_duration),
        ];

        if use_cached_audio {
            // Re-encoding is still safer to ensure correct boundaries and format, 
            // but since input is already MP3, it should be fast.
            // We can also try stream copying if codecs match, but slicing with -c copy can be imprecise.
            // Let's stick to re-encoding to quality 8 MP3 for consistency.
            // NOTE: Removed -y flag from here since it should be last
            args.extend_from_slice(&[
                "-c:a".to_string(), "libmp3lame".to_string(),
                "-q:a".to_string(), "8".to_string(),
            ]);
        } else {
            // Extracting from video
            // NOTE: Removed -y flag from here since it should be last
            args.extend_from_slice(&[
                "-vn".to_string(),
                "-c:a".to_string(), "libmp3lame".to_string(),
                "-q:a".to_string(), "8".to_string(),
            ]);
        }

        // Add output path and overwrite flag last
        args.extend_from_slice(&[
            "-y".to_string(),
            chunk_path.to_str().ok_or("Invalid chunk path")?.to_string(),
        ]);

        let chunk_output = shell.sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args(&args)
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

/// Result of extracting audio to a file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedAudioFile {
    pub file_path: String,
    pub filename: String,
    pub duration: f64,
}

/// Extract audio from a video file and save it to a persistent file.
/// Unlike extract_audio_from_video which returns base64, this saves the file
/// and returns the path for use in audio tracks.
/// Supports extracting a specific segment using trim_start and trim_duration.
#[tauri::command]
pub async fn extract_audio_to_file(
    app: tauri::AppHandle,
    video_path: String,
    source_id: String,
    trim_start: Option<f64>,
    trim_duration: Option<f64>,
) -> Result<ExtractedAudioFile, String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] ========================================");
    println!("[Rust] extract_audio_to_file called");
    println!("[Rust] ========================================");
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   source_id: {}", source_id);
    println!("[Rust]   trim_start: {:?}", trim_start);
    println!("[Rust]   trim_duration: {:?}", trim_duration);
    println!("[Rust]   trim_start.is_some(): {}", trim_start.is_some());
    println!("[Rust]   trim_duration.is_some(): {}", trim_duration.is_some());
    
    // Log the actual values if present
    if let Some(start) = trim_start {
        println!("[Rust]   trim_start VALUE: {:.3}", start);
    } else {
        println!("[Rust]   trim_start is NONE - will extract from beginning!");
    }
    if let Some(dur) = trim_duration {
        println!("[Rust]   trim_duration VALUE: {:.3}", dur);
    } else {
        println!("[Rust]   trim_duration is NONE - will extract entire file!");
    }
    println!("[Rust] ========================================");

    // Get storage paths
    let paths = storage::init_storage_dirs()
        .map_err(|e| {
            println!("[Rust] Failed to get storage paths: {}", e);
            format!("Failed to get storage paths: {}", e)
        })?;

    // Create audio directory if it doesn't exist
    let audio_dir = paths.videos.join("extracted_audio");
    std::fs::create_dir_all(&audio_dir)
        .map_err(|e| format!("Failed to create audio directory: {}", e))?;

    // Generate unique output filename based on source_id and timestamp
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let output_filename = format!("{}_{}_audio.mp3", source_id, timestamp);
    let output_path = audio_dir.join(&output_filename);

    println!("[Rust] Output path: {}", output_path.display());

    // Build FFmpeg args - include trim parameters if provided
    let shell = app.shell();
    println!("[Rust] Running FFmpeg to extract audio...");

    let mut args: Vec<String> = Vec::new();
    
    // Add seek position if trim_start is provided (before input for fast seeking)
    if let Some(start) = trim_start {
        args.push("-ss".to_string());
        args.push(format!("{:.3}", start));
    }
    
    args.push("-i".to_string());
    args.push(video_path.clone());
    
    // Add duration if trim_duration is provided
    if let Some(duration) = trim_duration {
        args.push("-t".to_string());
        args.push(format!("{:.3}", duration));
    }
    
    args.push("-c:a".to_string());
    args.push("libmp3lame".to_string());
    args.push("-q:a".to_string());
    args.push("2".to_string());  // High quality (~190kbps VBR)
    args.push("-vn".to_string()); // No video
    args.push("-y".to_string());  // Overwrite output file
    args.push(output_path.to_str().ok_or("Invalid output path")?.to_string());

    println!("[Rust] FFmpeg args: {:?}", args);
    let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(&args_refs)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("[Rust] FFmpeg failed: {}", stderr);
        return Err(format!("FFmpeg extraction failed: {}", stderr));
    }

    println!("[Rust] FFmpeg extraction completed successfully");

    // Get audio duration using FFmpeg
    let duration_output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", output_path.to_str().ok_or("Invalid output path")?,
            "-f", "null",
            "-"
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to get audio duration: {}", e))?;

    let stderr = String::from_utf8_lossy(&duration_output.stderr);
    let duration = parse_duration_from_ffmpeg_output(&stderr).unwrap_or(0.0);

    println!("[Rust] Audio duration: {} seconds", duration);
    println!("[Rust] Audio extraction to file completed successfully");

    Ok(ExtractedAudioFile {
        file_path: output_path.to_string_lossy().to_string(),
        filename: output_filename,
        duration,
    })
}