use crate::ffmpeg_utils::parse_duration_from_ffmpeg_output;
use crate::storage;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Global flag to signal cancellation of audio extraction
static AUDIO_EXTRACTION_CANCELLED: AtomicBool = AtomicBool::new(false);

/// Track PIDs of active FFmpeg child processes spawned during audio extraction
static ACTIVE_FFMPEG_PIDS: Mutex<Vec<u32>> = Mutex::new(Vec::new());

fn register_ffmpeg_pid(pid: u32) {
    if let Ok(mut pids) = ACTIVE_FFMPEG_PIDS.lock() {
        pids.push(pid);
    }
}

fn unregister_ffmpeg_pid(pid: u32) {
    if let Ok(mut pids) = ACTIVE_FFMPEG_PIDS.lock() {
        pids.retain(|&p| p != pid);
    }
}

fn kill_all_active_ffmpeg() {
    if let Ok(mut pids) = ACTIVE_FFMPEG_PIDS.lock() {
        for &pid in pids.iter() {
            println!("[Rust] Killing FFmpeg process PID: {}", pid);
            #[cfg(target_os = "windows")]
            {
                // On Windows, use taskkill to force-kill the process tree
                let mut cmd = std::process::Command::new("taskkill");
                cmd.args(["/F", "/T", "/PID", &pid.to_string()]);
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                let _ = cmd.output();
            }
            #[cfg(not(target_os = "windows"))]
            {
                // On Unix, use kill -9 to force-kill the process
                let _ = std::process::Command::new("kill")
                    .args(["-9", &pid.to_string()])
                    .output();
            }
        }
        pids.clear();
    }
}

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
    output_path: String,
) -> Result<(String, String), String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] extract_audio_from_video called with:");
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   output_path: {}", output_path);

    // Get storage paths for temporary file
    let paths = storage::init_storage_dirs().map_err(|e| {
        println!("[Rust] Failed to get storage paths: {}", e);
        format!("Failed to get storage paths: {}", e)
    })?;

    // Check if we have a cached audio file from waveform generation
    let video_path_hash = crate::waveform::generate_video_path_hash(&video_path);
    let cached_path_result = crate::waveform::get_audio_cache_file_path(&video_path_hash);

    if let Ok(ref cached_path) = cached_path_result {
        if cached_path.exists() {
            println!(
                "[Rust] Found cached audio file for clip detection: {:?}",
                cached_path
            );

            // Read the cached file
            let audio_bytes = std::fs::read(cached_path).map_err(|e| {
                println!("[Rust] Failed to read cached audio file: {}", e);
                format!("Failed to read audio file: {}", e)
            })?;

            println!(
                "[Rust] Read {} bytes from cached audio file",
                audio_bytes.len()
            );

            // Encode to base64
            use base64::{engine::general_purpose, Engine as _};
            let base64_data = general_purpose::STANDARD.encode(&audio_bytes);

            // Get filename for return
            let filename = cached_path
                .file_name()
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
        let temp_path = paths.videos.join(format!(
            "temp_audio_{}_audio_only.mp3",
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

    let output = shell
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i",
            &video_path,
            "-c:a",
            "libmp3lame", // MP3 codec
            "-q:a",
            "8",   // Quality level 8 (~85kbps)
            "-vn", // No video
            "-y",  // Overwrite output file
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
    let mut audio_bytes = std::fs::read(&target_path).map_err(|e| {
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

        audio_bytes =
            std::fs::read(&wav_path).map_err(|e| format!("Failed to read wav fallback: {}", e))?;

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
    use base64::{engine::general_purpose, Engine as _};
    let base64_data = general_purpose::STANDARD.encode(&audio_bytes);

    println!(
        "[Rust] Encoded {} bytes to {} chars of base64",
        audio_bytes.len(),
        base64_data.len()
    );

    // Get filename for return
    let filename = target_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("audio.mp3");

    // Clean up only if it's a temporary file (not cached)
    if !is_cache_file {
        if let Err(e) = std::fs::remove_file(&target_path) {
            eprintln!(
                "[Rust] Warning: Failed to remove temporary audio file {}: {}",
                target_path.display(),
                e
            );
        } else {
            println!("[Rust] Cleaned up temporary audio file");
        }
    } else {
        println!("[Rust] Kept cached audio file: {:?}", target_path);
    }

    println!("[Rust] Audio extraction completed successfully");
    Ok((filename.to_string(), base64_data))
}

/// Concatenate audio across multiple HLS-style segments (e.g. several `.ts` files
/// produced by a livestream recorder) into a single MP3 and return base64.
///
/// Used by realtime auto-clip detection to batch ~30s of stream audio into one
/// Whisper request, regardless of the underlying HLS segment duration. The list
/// of segment paths must be in chronological order. Uses ffmpeg's concat
/// demuxer via a temporary list file so it works for any container the recorder
/// produced (mpegts, fmp4, etc.).
#[tauri::command]
pub async fn extract_audio_from_segments(
    app: tauri::AppHandle,
    segment_paths: Vec<String>,
) -> Result<(String, String), String> {
    use std::io::Write;
    use tauri_plugin_shell::ShellExt;

    if segment_paths.is_empty() {
        return Err("extract_audio_from_segments: empty segment list".to_string());
    }

    println!(
        "[Rust] extract_audio_from_segments called with {} segments",
        segment_paths.len()
    );

    let paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_nanos();

    let listfile_path = paths
        .temp
        .join(format!("realtime_concat_{}.txt", timestamp));
    let output_path = paths
        .temp
        .join(format!("realtime_batch_{}.mp3", timestamp));

    // Build the concat list: one `file '<path>'` per segment, with single-quotes
    // inside paths escaped per ffmpeg concat demuxer rules.
    {
        let mut listfile = std::fs::File::create(&listfile_path)
            .map_err(|e| format!("Failed to create concat list file: {}", e))?;
        for path in &segment_paths {
            let escaped = path.replace('\'', "'\\''");
            writeln!(listfile, "file '{}'", escaped)
                .map_err(|e| format!("Failed to write concat list: {}", e))?;
        }
    }

    let shell = app.shell();
    let listfile_str = listfile_path
        .to_str()
        .ok_or("Invalid concat list path")?
        .to_string();
    let output_str = output_path
        .to_str()
        .ok_or("Invalid output mp3 path")?
        .to_string();

    println!(
        "[Rust] Running ffmpeg concat -> mp3, list: {}, out: {}",
        listfile_str, output_str
    );

    let output = shell
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            &listfile_str,
            "-vn",
            "-c:a",
            "libmp3lame",
            "-q:a",
            "8",
            "-y",
            &output_str,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg concat: {}", e))?;

    let _ = std::fs::remove_file(&listfile_path);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let _ = std::fs::remove_file(&output_path);
        return Err(format!(
            "ffmpeg concat failed. stdout: {}; stderr: {}",
            stdout.trim(),
            stderr.trim()
        ));
    }

    let audio_bytes = std::fs::read(&output_path)
        .map_err(|e| format!("Failed to read concat output: {}", e))?;

    let _ = std::fs::remove_file(&output_path);

    if audio_bytes.is_empty() {
        return Err("Concat produced empty audio".to_string());
    }

    use base64::{engine::general_purpose, Engine as _};
    let base64_data = general_purpose::STANDARD.encode(&audio_bytes);

    println!(
        "[Rust] extract_audio_from_segments OK: {} segments -> {} bytes mp3",
        segment_paths.len(),
        audio_bytes.len()
    );

    Ok(("realtime_batch.mp3".to_string(), base64_data))
}

#[tauri::command]
pub async fn extract_and_chunk_audio(
    app: tauri::AppHandle,
    video_path: String,
    project_id: String,
    chunk_duration_minutes: u32,
    overlap_seconds: u32,
    start_time: Option<f64>,
    end_time: Option<f64>,
) -> Result<Vec<AudioChunk>, String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] extract_and_chunk_audio called with:");
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   project_id: {}", project_id);
    println!(
        "[Rust]   chunk_duration_minutes: {}",
        chunk_duration_minutes
    );
    println!("[Rust]   overlap_seconds: {}", overlap_seconds);
    println!("[Rust]   start_time: {:?}", start_time);
    println!("[Rust]   end_time: {:?}", end_time);

    // Get storage paths for temporary files
    let paths = storage::init_storage_dirs().map_err(|e| {
        println!("[Rust] Failed to get storage paths: {}", e);
        format!("Failed to get storage paths: {}", e)
    })?;

    let chunk_duration_secs = chunk_duration_minutes as f64 * 60.0;
    let overlap_secs = overlap_seconds as f64;
    let shell = app.shell();

    // Check if we have a cached audio file from waveform generation (shared cache)
    let video_path_hash = crate::waveform::generate_video_path_hash(&video_path);
    let cached_audio_path_result = crate::waveform::get_audio_cache_file_path(&video_path_hash);

    let local_video_path = crate::ffmpeg_utils::resolve_local_media_path(&video_path)
        .map_err(|e| format!("Invalid video path: {}", e))?;

    // Get video duration (ffmpeg stderr, ffprobe fallback)
    println!("[Rust] Getting video duration for: {}", local_video_path);
    let video_duration = crate::ffmpeg_utils::probe_media_duration(&app, &local_video_path)
        .await
        .map_err(|e| format!("Failed to parse video duration: {}", e))?;

    println!("[Rust] Video duration: {:.2} seconds", video_duration);

    if video_duration <= 0.0 {
        return Err("Invalid video duration".to_string());
    }

    // Determine the actual range to chunk based on start_time and end_time
    let chunk_start = start_time.unwrap_or(0.0).max(0.0);
    let chunk_end = end_time
        .filter(|&t| t > 0.0)
        .unwrap_or(video_duration)
        .min(video_duration);

    if chunk_start >= chunk_end {
        return Err(format!(
            "Invalid time range: start ({:.2}s) must be less than end ({:.2}s)",
            chunk_start, chunk_end
        ));
    }

    let effective_duration = chunk_end - chunk_start;
    println!(
        "[Rust] Chunking range: {:.2}s - {:.2}s (duration: {:.2}s)",
        chunk_start, chunk_end, effective_duration
    );

    if effective_duration < 1.0 {
        return Err(format!(
            "Video/audio range is too short to transcribe ({:.2}s)",
            effective_duration
        ));
    }

    // Determine if we should use the cached audio file or the original video
    let use_cached_audio = if let Ok(ref cached_path) = cached_audio_path_result {
        if cached_path.exists() {
            println!(
                "[Rust] Found cached audio file, validating duration: {:?}",
                cached_path
            );

            let cache_duration_output = shell
                .sidecar("ffmpeg")
                .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
                .args(["-i", cached_path.to_str().ok_or("Invalid cached path")?])
                .output()
                .await
                .map_err(|e| format!("Failed to check cached audio duration: {}", e))?;

            let cache_stderr = String::from_utf8_lossy(&cache_duration_output.stderr);
            let cached_duration = parse_duration_from_ffmpeg_output(&cache_stderr).unwrap_or(0.0);

            println!(
                "[Rust] Cached audio duration: {:.2}s, Video duration: {:.2}s",
                cached_duration, video_duration
            );

            let duration_diff = (cached_duration - video_duration).abs();
            let tolerance = video_duration * 0.05;

            if duration_diff <= tolerance {
                println!("[Rust] Cached audio duration is valid, using cache");
                true
            } else {
                println!("[Rust] WARNING: Cached audio duration mismatch ({:.2}s vs {:.2}s), skipping cache", cached_duration, video_duration);
                if let Err(e) = std::fs::remove_file(cached_path) {
                    eprintln!(
                        "[Rust] Warning: Failed to remove corrupted cache file: {}",
                        e
                    );
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

    let source_path_str: String = if use_cached_audio {
        cached_audio_path_result
            .as_ref()
            .unwrap()
            .to_str()
            .ok_or("Invalid cached path")?
            .to_string()
    } else {
        local_video_path.clone()
    };

    println!("[Rust] Using source for chunking: {}", source_path_str);

    // Build the list of chunk specs (start, end, duration, index) upfront
    // Only create chunks within the selected time range
    let mut chunk_specs: Vec<(f64, f64, f64, usize)> = Vec::new();
    let mut current_start = chunk_start;
    let mut chunk_index = 1usize;

    while current_start < chunk_end {
        let current_end = (current_start + chunk_duration_secs).min(chunk_end);
        let actual_duration = current_end - current_start;

        if actual_duration < 1.0 {
            println!(
                "[Rust] Skipping small final chunk of {:.2} seconds",
                actual_duration
            );
            break;
        }

        chunk_specs.push((current_start, current_end, actual_duration, chunk_index));
        current_start = current_end
            - if current_end < chunk_end {
                overlap_secs
            } else {
                0.0
            };
        chunk_index += 1;

        if chunk_index > 100 {
            return Err("Too many chunks - possible infinite loop".to_string());
        }
    }

    if chunk_specs.is_empty() {
        return Err(format!(
            "No audio chunk specs were generated for {:.2}s of media",
            effective_duration
        ));
    }

    // Reset cancellation flag at the start of a new extraction
    AUDIO_EXTRACTION_CANCELLED.store(false, Ordering::SeqCst);

    // Limit concurrent FFmpeg processes to avoid saturating CPU on lower-end machines.
    // 3 concurrent processes gives a good speedup (3x) without destroying performance.
    let concurrency: usize = 3;
    println!(
        "[Rust] Extracting {} chunks with concurrency={}",
        chunk_specs.len(),
        concurrency
    );

    let videos_dir = paths.videos.clone();
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(concurrency));
    let mut handles = Vec::new();

    for (start_time, end_time, actual_duration, idx) in chunk_specs {
        let app_clone = app.clone();
        let source = source_path_str.clone();
        let pid = project_id.clone();
        let vdir = videos_dir.clone();
        let use_cached = use_cached_audio;
        let sem = semaphore.clone();

        let handle = tokio::spawn(async move {
            use base64::{engine::general_purpose, Engine as _};
            use tauri_plugin_shell::ShellExt;

            // Check cancellation before acquiring permit
            if AUDIO_EXTRACTION_CANCELLED.load(Ordering::SeqCst) {
                return Err("Audio extraction cancelled".to_string());
            }

            let _permit = sem
                .acquire()
                .await
                .map_err(|e| format!("Semaphore error: {}", e))?;

            // Check cancellation after acquiring permit (may have waited)
            if AUDIO_EXTRACTION_CANCELLED.load(Ordering::SeqCst) {
                return Err("Audio extraction cancelled".to_string());
            }

            let chunk_filename = format!("{}_chunk_{:03}.mp3", pid, idx);
            let chunk_path = vdir.join(&chunk_filename);

            println!(
                "[Rust] Chunk {}: {:.2}s - {:.2}s starting",
                idx, start_time, end_time
            );

            // Combined seeking: input seek gets us close quickly, output seek
            // trims the final few seconds accurately so chunk timestamps line up
            // with the original source media.
            let input_seek = (start_time - 5.0).max(0.0);
            let output_seek = start_time - input_seek;

            println!(
                "[Rust] Chunk {} seek strategy: input_seek={:.3}s output_seek={:.3}s duration={:.3}s",
                idx, input_seek, output_seek, actual_duration
            );

            let mut args = vec![
                "-ss".to_string(),
                format!("{:.3}", input_seek),
                "-i".to_string(),
                source.clone(),
                "-ss".to_string(),
                format!("{:.3}", output_seek),
                "-t".to_string(),
                format!("{:.3}", actual_duration),
            ];

            if use_cached {
                args.extend_from_slice(&[
                    "-c:a".to_string(),
                    "libmp3lame".to_string(),
                    "-q:a".to_string(),
                    "8".to_string(),
                ]);
            } else {
                args.extend_from_slice(&[
                    "-vn".to_string(),
                    "-c:a".to_string(),
                    "libmp3lame".to_string(),
                    "-q:a".to_string(),
                    "8".to_string(),
                ]);
            }

            args.extend_from_slice(&[
                "-y".to_string(),
                chunk_path.to_str().ok_or("Invalid chunk path")?.to_string(),
            ]);

            // Use spawn() instead of output() so we can track and kill the child process
            let shell = app_clone.shell();
            let (mut rx, child) = shell
                .sidecar("ffmpeg")
                .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
                .args(&args)
                .spawn()
                .map_err(|e| format!("Failed to spawn ffmpeg for chunk {}: {}", idx, e))?;

            // Register child PID so it can be killed on cancellation
            let child_pid = child.pid();
            register_ffmpeg_pid(child_pid);

            // Wait for the process to finish by draining events
            let mut stderr_buf = Vec::new();
            let mut exit_code: Option<i32> = None;
            while let Some(event) = rx.recv().await {
                match event {
                    tauri_plugin_shell::process::CommandEvent::Stderr(data) => {
                        stderr_buf.extend_from_slice(&data);
                    }
                    tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                        exit_code = payload.code;
                        break;
                    }
                    tauri_plugin_shell::process::CommandEvent::Error(err) => {
                        unregister_ffmpeg_pid(child_pid);
                        return Err(format!("FFmpeg chunk {} error: {}", idx, err));
                    }
                    _ => {}
                }
            }

            // Unregister PID now that process has exited
            unregister_ffmpeg_pid(child_pid);

            // Check cancellation after FFmpeg finished
            if AUDIO_EXTRACTION_CANCELLED.load(Ordering::SeqCst) {
                // Clean up partial output file
                let _ = std::fs::remove_file(&chunk_path);
                return Err("Audio extraction cancelled".to_string());
            }

            let success = exit_code.map_or(false, |c| c == 0);
            if !success {
                let stderr = String::from_utf8_lossy(&stderr_buf);
                println!("[Rust] FFmpeg chunk {} failed: {}", idx, stderr);
                return Err(format!(
                    "FFmpeg chunk {} extraction failed: {}",
                    idx, stderr
                ));
            }

            let chunk_bytes = std::fs::read(&chunk_path)
                .map_err(|e| format!("Failed to read chunk file {}: {}", idx, e))?;

            let base64_data = general_purpose::STANDARD.encode(&chunk_bytes);

            let audio_chunk = AudioChunk {
                chunk_id: format!("{}_{}", pid, idx),
                file_path: chunk_path.to_string_lossy().to_string(),
                filename: chunk_filename,
                start_time,
                end_time,
                duration: actual_duration,
                base64_data,
                file_size: chunk_bytes.len() as u64,
            };

            println!(
                "[Rust] Chunk {} completed: {} bytes",
                idx,
                chunk_bytes.len()
            );

            if let Err(e) = std::fs::remove_file(&chunk_path) {
                eprintln!(
                    "[Rust] Warning: Failed to remove chunk file {}: {}",
                    chunk_path.display(),
                    e
                );
            }

            Ok::<AudioChunk, String>(audio_chunk)
        });

        handles.push(handle);
    }

    // Collect results - abort remaining tasks on first error or cancellation
    let mut chunks: Vec<AudioChunk> = Vec::with_capacity(handles.len());
    let mut first_error: Option<String> = None;
    for handle in handles {
        if first_error.is_some() || AUDIO_EXTRACTION_CANCELLED.load(Ordering::SeqCst) {
            handle.abort();
            continue;
        }
        match handle.await {
            Ok(Ok(chunk)) => chunks.push(chunk),
            Ok(Err(e)) => {
                first_error = Some(e);
                // Kill any remaining FFmpeg processes
                kill_all_active_ffmpeg();
            }
            Err(e) if e.is_cancelled() => {
                first_error = Some("Audio extraction cancelled".to_string());
            }
            Err(e) => {
                first_error = Some(format!("Chunk task panicked: {}", e));
                kill_all_active_ffmpeg();
            }
        }
    }

    if let Some(err) = first_error {
        return Err(err);
    }

    // Sort by start_time since tasks may complete out of order
    chunks.sort_by(|a, b| {
        a.start_time
            .partial_cmp(&b.start_time)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    println!(
        "[Rust] Audio chunking completed successfully. Created {} chunks.",
        chunks.len()
    );
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
    println!(
        "[Rust]   trim_duration.is_some(): {}",
        trim_duration.is_some()
    );

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
    let paths = storage::init_storage_dirs().map_err(|e| {
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
    args.push("9".to_string()); // Low quality (~45kbps VBR) - sufficient for waveform peaks
    args.push("-vn".to_string()); // No video
    args.push("-y".to_string()); // Overwrite output file
    args.push(
        output_path
            .to_str()
            .ok_or("Invalid output path")?
            .to_string(),
    );

    println!("[Rust] FFmpeg args: {:?}", args);
    let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let output = shell
        .sidecar("ffmpeg")
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

    // Parse duration directly from the first FFmpeg invocation's stderr (avoids a second FFmpeg call)
    let stderr = String::from_utf8_lossy(&output.stderr);
    let duration = parse_duration_from_ffmpeg_output(&stderr).unwrap_or(0.0);

    println!("[Rust] Audio duration: {} seconds", duration);
    println!("[Rust] Audio extraction to file completed successfully");

    Ok(ExtractedAudioFile {
        file_path: output_path.to_string_lossy().to_string(),
        filename: output_filename,
        duration,
    })
}

/// Extract audio from a video file and save it as WAV format.
/// WAV is more reliable for corrupted/livestream sources because it's uncompressed
/// and has simpler headers that are less prone to decoding errors.
#[tauri::command]
pub async fn extract_audio_to_file_wav(
    app: tauri::AppHandle,
    video_path: String,
    source_id: String,
    trim_start: Option<f64>,
    trim_duration: Option<f64>,
) -> Result<ExtractedAudioFile, String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] ========================================");
    println!("[Rust] extract_audio_to_file_wav called");
    println!("[Rust] ========================================");
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   source_id: {}", source_id);
    println!("[Rust]   trim_start: {:?}", trim_start);
    println!("[Rust]   trim_duration: {:?}", trim_duration);

    // Get storage paths
    let paths = storage::init_storage_dirs().map_err(|e| {
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
    let output_filename = format!("{}_{}_audio.wav", source_id, timestamp);
    let output_path = audio_dir.join(&output_filename);

    println!("[Rust] Output WAV path: {}", output_path.display());

    // Build FFmpeg args for WAV extraction
    let shell = app.shell();
    println!("[Rust] Running FFmpeg to extract audio as WAV...");

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

    // WAV format settings - 16-bit PCM, 48kHz, stereo
    args.push("-c:a".to_string());
    args.push("pcm_s16le".to_string()); // 16-bit PCM
    args.push("-ar".to_string());
    args.push("48000".to_string()); // 48kHz sample rate
    args.push("-ac".to_string());
    args.push("2".to_string()); // Stereo
    args.push("-vn".to_string()); // No video
    args.push("-y".to_string()); // Overwrite output file
    args.push(
        output_path
            .to_str()
            .ok_or("Invalid output path")?
            .to_string(),
    );

    println!("[Rust] FFmpeg WAV args: {:?}", args);
    let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let output = shell
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(&args_refs)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("[Rust] FFmpeg WAV extraction failed: {}", stderr);
        return Err(format!("FFmpeg WAV extraction failed: {}", stderr));
    }

    println!("[Rust] FFmpeg WAV extraction completed successfully");

    // Parse duration from FFmpeg output
    let stderr = String::from_utf8_lossy(&output.stderr);
    let duration = parse_duration_from_ffmpeg_output(&stderr).unwrap_or(0.0);

    println!("[Rust] WAV audio duration: {} seconds", duration);
    println!("[Rust] WAV audio extraction to file completed successfully");

    Ok(ExtractedAudioFile {
        file_path: output_path.to_string_lossy().to_string(),
        filename: output_filename,
        duration,
    })
}

/// Get the duration of an audio file
#[tauri::command]
pub async fn get_audio_duration(app: tauri::AppHandle, file_path: String) -> Result<f64, String> {
    use tauri_plugin_shell::ShellExt;

    println!(
        "[Rust] get_audio_duration called with file_path: {}",
        file_path
    );

    let shell = app.shell();
    let duration_output = shell
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(["-i", &file_path])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg for duration: {}", e))?;

    let stderr = String::from_utf8_lossy(&duration_output.stderr);
    let duration = parse_duration_from_ffmpeg_output(&stderr)
        .map_err(|e| format!("Failed to parse audio duration: {}", e))?;

    println!("[Rust] Audio duration: {:.2} seconds", duration);
    Ok(duration)
}

/// Cancel any in-progress audio extraction by setting the cancellation flag
/// and killing all active FFmpeg child processes.
#[tauri::command]
pub async fn cancel_audio_extraction() -> Result<(), String> {
    println!("[Rust] cancel_audio_extraction called - setting cancellation flag and killing FFmpeg processes");
    AUDIO_EXTRACTION_CANCELLED.store(true, Ordering::SeqCst);
    kill_all_active_ffmpeg();
    Ok(())
}
