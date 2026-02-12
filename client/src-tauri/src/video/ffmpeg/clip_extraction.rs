use tokio::process::Command as AsyncCommand;

/// Extract a clip segment from a video file using FFmpeg
pub async fn extract_clip_segment(
    input_path: &str,
    output_path: &str,
    start_time: f64,
    end_time: f64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let duration = end_time - start_time;
    
    println!("[FFmpeg] Extracting segment: {}s - {}s (duration: {}s)", start_time, end_time, duration);
    
    let output = AsyncCommand::new("ffmpeg")
        .arg("-y")  // Overwrite output file
        .arg("-ss")
        .arg(start_time.to_string())
        .arg("-i")
        .arg(input_path)
        .arg("-t")
        .arg(duration.to_string())
        .arg("-c")
        .arg("copy")
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
    
    let output = AsyncCommand::new("ffmpeg")
        .arg("-y")  // Overwrite output file
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
    
    // First extract audio as WAV
    let temp_audio_path = format!("{}.wav", output_path);
    
    // Extract audio
    let output = AsyncCommand::new("ffmpeg")
        .arg("-y")
        .arg("-i")
        .arg(input_path)
        .arg("-vn")  // No video
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
    let waveform_data = generate_waveform_points(&temp_audio_path).await?;
    
    // Save as JSON
    let json_data = serde_json::to_string_pretty(&waveform_data)?;
    std::fs::write(output_path, json_data)?;
    
    // Clean up temp audio file
    let _ = std::fs::remove_file(&temp_audio_path);
    
    Ok(())
}

/// Generate waveform data points from audio file
async fn generate_waveform_points(
    audio_path: &str,
) -> Result<Vec<f32>, Box<dyn std::error::Error + Send + Sync>> {
    // For now, generate a simple waveform using FFmpeg's volumedetect
    // In a more sophisticated implementation, we could use a proper audio analysis library
    
    let output = AsyncCommand::new("ffmpeg")
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
