use tokio::process::Command as AsyncCommand;

use crate::youtube::resolve_ffmpeg_binary;

/// On Windows, set CREATE_NO_WINDOW flag to prevent a visible console window.
#[cfg(target_os = "windows")]
fn no_window(cmd: &mut AsyncCommand) -> &mut AsyncCommand {
    cmd.creation_flags(0x08000000) // CREATE_NO_WINDOW
}

#[cfg(not(target_os = "windows"))]
fn no_window(cmd: &mut AsyncCommand) -> &mut AsyncCommand {
    cmd
}

/// Extract a clip segment from a video file using FFmpeg
pub async fn extract_clip_segment(
    input_path: &str,
    output_path: &str,
    start_time: f64,
    end_time: f64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let ffmpeg_path = resolve_ffmpeg_binary()?;

    let duration = end_time - start_time;

    if duration <= 0.0 {
        return Err(format!(
            "Invalid clip duration: start_time={} end_time={}",
            start_time, end_time
        )
        .into());
    }

    println!(
        "[FFmpeg] Extracting segment: {}s - {}s (duration: {}s)",
        start_time, end_time, duration
    );

    const MIN_OK_BYTES: u64 = 512;

    // 1) `-ss` *before* `-i` seeks in the demuxer (fast on long VODs). `-ss` *after* `-i` decodes
    // from t=0 to start_time (very slow for 30+ min offsets) — only use as fallback when fast seek
    // fails or yields a near-empty file (moov-at-end / fragmented MP4 edge cases).
    match run_extract_ffmpeg(
        &ffmpeg_path,
        input_path,
        output_path,
        start_time,
        duration,
        true,
    )
    .await
    {
        Ok(()) => {
            if let Ok(meta) = std::fs::metadata(output_path) {
                if meta.len() >= MIN_OK_BYTES {
                    println!("[FFmpeg] Used input-side seek (fast path)");
                    return Ok(());
                }
            }
            let _ = std::fs::remove_file(output_path);
        }
        Err(e) => {
            println!(
                "[FFmpeg] Fast input-side seek failed ({}); trying accurate seek",
                e
            );
            let _ = std::fs::remove_file(output_path);
        }
    }

    println!("[FFmpeg] Retrying with accurate output-side seek (slow path)");
    run_extract_ffmpeg(
        &ffmpeg_path,
        input_path,
        output_path,
        start_time,
        duration,
        false,
    )
    .await?;

    if let Ok(meta) = std::fs::metadata(output_path) {
        if meta.len() < MIN_OK_BYTES {
            let _ = std::fs::remove_file(output_path);
            return Err(
                "FFmpeg produced a near-empty file with both seek strategies; source may be wrong or unsupported."
                    .into(),
            );
        }
    }

    Ok(())
}

/// `input_seek_first`: true → `-ss` before `-i` (fast). false → `-ss` after `-i` (accurate, slow on long files).
async fn run_extract_ffmpeg(
    ffmpeg_path: &str,
    input_path: &str,
    output_path: &str,
    start_time: f64,
    duration: f64,
    input_seek_first: bool,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut cmd = AsyncCommand::new(ffmpeg_path);
    no_window(&mut cmd);
    cmd.arg("-y");

    if input_seek_first {
        cmd.arg("-ss").arg(start_time.to_string());
        cmd.arg("-i").arg(input_path);
        cmd.arg("-t").arg(duration.to_string());
    } else {
        cmd.arg("-i").arg(input_path);
        cmd.arg("-ss").arg(start_time.to_string());
        cmd.arg("-t").arg(duration.to_string());
    }

    let output = cmd
        .arg("-map")
        .arg("0:v:0")
        .arg("-map")
        .arg("0:a:0?")
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg("veryfast")
        .arg("-crf")
        .arg("18")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-c:a")
        .arg("aac")
        .arg("-b:a")
        .arg("192k")
        .arg("-avoid_negative_ts")
        .arg("make_zero")
        .arg("-movflags")
        .arg("+faststart")
        .arg(output_path)
        .output()
        .await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg failed: {}", stderr).into());
    }

    Ok(())
}

/// Generate a thumbnail at a specific time using FFmpeg
pub async fn generate_thumbnail_at_time(
    input_path: &str,
    output_path: &str,
    time: f64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    println!("[FFmpeg] Generating thumbnail at {}s", time);

    let ffmpeg_path = resolve_ffmpeg_binary()?;

    let mut cmd = AsyncCommand::new(&ffmpeg_path);
    no_window(&mut cmd);
    
    let output = cmd
        .arg("-y") // Overwrite output file
        .arg("-ss")
        .arg(time.to_string())
        .arg("-i")
        .arg(input_path)
        .arg("-vframes")
        .arg("1")
        .arg("-q:v")
        .arg("2")
        .arg("-update")
        .arg("1")
        .arg(output_path)
        .output()
        .await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg thumbnail failed: {}", stderr).into());
    }

    Ok(())
}

/// Extract waveform data from video using FFmpeg
pub async fn extract_waveform_data(
    input_path: &str,
    output_path: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    println!("[FFmpeg] Extracting waveform data");

    let ffmpeg_path = resolve_ffmpeg_binary()?;

    // First extract audio as WAV
    let temp_audio_path = format!("{}.wav", output_path);

    // Extract audio
    let mut cmd = AsyncCommand::new(&ffmpeg_path);
    no_window(&mut cmd);
    
    let output = cmd
        .arg("-y")
        .arg("-i")
        .arg(input_path)
        .arg("-vn") // No video
        .arg("-acodec")
        .arg("pcm_s16le")
        .arg("-ar")
        .arg("44100")
        .arg("-ac")
        .arg("1")
        .arg(&temp_audio_path)
        .output()
        .await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg audio extraction failed: {}", stderr).into());
    }

    // Generate waveform data points
    let waveform_data = generate_waveform_points(&ffmpeg_path, &temp_audio_path).await?;

    // Save as JSON
    let json_data = serde_json::to_string_pretty(&waveform_data)?;
    std::fs::write(output_path, json_data)?;

    // Clean up temp audio file
    let _ = std::fs::remove_file(&temp_audio_path);

    Ok(())
}

/// Generate waveform data points from audio file
async fn generate_waveform_points(
    ffmpeg_path: &str,
    audio_path: &str,
) -> Result<Vec<f32>, Box<dyn std::error::Error + Send + Sync>> {
    // For now, generate a simple waveform using FFmpeg's volumedetect
    // In a more sophisticated implementation, we could use a proper audio analysis library

    let mut cmd = AsyncCommand::new(ffmpeg_path);
    no_window(&mut cmd);
    
    let output = cmd
        .arg("-i")
        .arg(audio_path)
        .arg("-filter:a")
        .arg("volumedetect")
        .arg("-f")
        .arg("null")
        .arg("-")
        .output()
        .await?;

    let stderr = String::from_utf8_lossy(&output.stderr);

    // Parse mean_volume from FFmpeg output
    let mean_volume = stderr
        .lines()
        .find(|line| line.contains("mean_volume"))
        .and_then(|line| line.split(':').nth(1))
        .and_then(|vol| vol.trim().split_whitespace().next())
        .and_then(|vol| vol.parse::<f64>().ok())
        .unwrap_or(-20.0) as f32;

    // Generate simple waveform data (100 points)
    let num_points = 100;
    let mut waveform = Vec::with_capacity(num_points);

    for i in 0..num_points {
        // Create a simple waveform pattern based on the mean volume
        let t = i as f32 / num_points as f32;
        let amplitude = (mean_volume + 20.0) / 40.0; // Normalize to 0-1 range
        let value = amplitude * (t * std::f32::consts::PI * 2.0).sin().abs();
        waveform.push(value.clamp(0.0, 1.0));
    }

    Ok(waveform)
}
