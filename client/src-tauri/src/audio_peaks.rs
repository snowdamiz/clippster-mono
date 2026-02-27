use serde::{Deserialize, Serialize};
use std::io::{BufReader, Read};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioPeak {
    pub time: f64,
    pub amplitude: f64,
}

const SAMPLE_RATE: u32 = 8000; // Low sample rate is fine for peak detection
const WINDOW_SIZE: usize = 4000; // 0.5 seconds at 8kHz

/// Detect audio peaks (loud moments) in a video for intelligent effect placement
/// Returns timestamps where audio amplitude exceeds the threshold
/// Extracts audio to raw PCM and analyzes amplitude directly
#[tauri::command]
pub async fn detect_audio_peaks(
    app: AppHandle,
    video_path: String,
    threshold: f64,
    min_interval: f64,
) -> Result<Vec<AudioPeak>, String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] detect_audio_peaks called:");
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   threshold: {}", threshold);
    println!("[Rust]   min_interval: {}s", min_interval);

    // Extract local file path from URL
    let local_path = crate::waveform::extract_local_path_from_url(&video_path)
        .map_err(|e| format!("Failed to extract local path: {}", e))?;

    // Get storage paths for temporary files
    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let shell = app.shell();

    // Create unique temporary raw audio file path
    let temp_raw_path = paths.videos.join(format!(
        "temp_peaks_{}.raw",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| format!("Failed to get timestamp: {}", e))?
            .as_secs()
    ));

    println!(
        "[Rust] Extracting audio to raw PCM: {}",
        temp_raw_path.display()
    );

    // Extract audio to raw 16-bit PCM mono at low sample rate
    let extract_output = shell
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-nostdin",
            "-i",
            &local_path,
            "-vn", // No video
            "-acodec",
            "pcm_s16le", // 16-bit PCM little-endian
            "-ar",
            &SAMPLE_RATE.to_string(),
            "-ac",
            "1", // Mono
            "-f",
            "s16le", // Raw format
            "-y",    // Overwrite output
            temp_raw_path.to_str().ok_or("Invalid temporary path")?,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to extract audio: {}", e))?;

    if !extract_output.status.success() {
        let stderr = String::from_utf8_lossy(&extract_output.stderr);
        return Err(format!("FFmpeg audio extraction failed: {}", stderr));
    }

    println!("[Rust] Audio extraction completed, reading samples...");

    // Read the raw audio file
    let file = std::fs::File::open(&temp_raw_path)
        .map_err(|e| format!("Failed to open temp audio file: {}", e))?;
    let file_size = file
        .metadata()
        .map_err(|e| format!("Failed to get file metadata: {}", e))?
        .len() as usize;

    let mut reader = BufReader::new(file);
    let mut buffer = vec![0u8; file_size];
    reader
        .read_exact(&mut buffer)
        .map_err(|e| format!("Failed to read audio data: {}", e))?;

    // Clean up temp file
    let _ = std::fs::remove_file(&temp_raw_path);

    // Convert bytes to i16 samples
    let samples: Vec<i16> = buffer
        .chunks_exact(2)
        .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
        .collect();

    println!(
        "[Rust] Read {} audio samples ({:.2}s of audio)",
        samples.len(),
        samples.len() as f64 / SAMPLE_RATE as f64
    );

    if samples.is_empty() {
        println!("[Rust] WARNING: No audio samples found in video.");
        return Ok(vec![]);
    }

    // Calculate RMS for each window
    let mut volume_samples: Vec<(f64, f64)> = Vec::new(); // (time, normalized_rms)
    let num_windows = samples.len() / WINDOW_SIZE;

    for i in 0..num_windows {
        let start = i * WINDOW_SIZE;
        let end = start + WINDOW_SIZE;
        let window = &samples[start..end];

        // Calculate RMS
        let sum_squares: f64 = window.iter().map(|&s| (s as f64).powi(2)).sum();
        let rms = (sum_squares / WINDOW_SIZE as f64).sqrt();

        // Normalize to 0-1 range (i16 max is 32767)
        let normalized_rms = rms / 32767.0;

        let time = (start as f64) / SAMPLE_RATE as f64;
        volume_samples.push((time, normalized_rms));
    }

    println!("[Rust] Calculated {} volume windows", volume_samples.len());

    if volume_samples.is_empty() {
        println!("[Rust] WARNING: No volume samples calculated.");
        return Ok(vec![]);
    }

    // Calculate statistics
    let rms_values: Vec<f64> = volume_samples.iter().map(|(_, rms)| *rms).collect();
    let mean_rms = rms_values.iter().sum::<f64>() / rms_values.len() as f64;
    let max_rms = rms_values.iter().cloned().fold(0.0_f64, f64::max);

    println!(
        "[Rust] Volume stats - Mean RMS: {:.4}, Max RMS: {:.4}",
        mean_rms, max_rms
    );

    // Find peaks: segments where RMS is significantly above mean
    let mut peaks: Vec<AudioPeak> = Vec::new();
    let mut last_peak_time = -min_interval * 2.0;

    // Dynamic threshold: peaks must be significantly above mean
    // Use the provided threshold as a multiplier (e.g., 0.3 means 30% above mean)
    let peak_threshold = mean_rms + (max_rms - mean_rms) * threshold;

    println!(
        "[Rust] Peak threshold: {:.4} (mean + {}% of range)",
        peak_threshold,
        (threshold * 100.0) as i32
    );

    for (time, rms) in &volume_samples {
        if *rms > peak_threshold && (*time - last_peak_time) >= min_interval {
            // Calculate amplitude based on how loud this is relative to the range
            let normalized_loudness = (*rms - mean_rms) / (max_rms - mean_rms).max(0.001);
            let amplitude = normalized_loudness.min(1.0).max(0.5);

            peaks.push(AudioPeak {
                time: *time,
                amplitude,
            });
            last_peak_time = *time;
            println!(
                "[Rust] Peak at {:.2}s: RMS={:.4}, amplitude={:.2}",
                time, rms, amplitude
            );
        }
    }

    // If we found very few peaks, lower the threshold and try again
    if peaks.len() < 3 && volume_samples.len() > 10 {
        println!("[Rust] Few peaks found, trying with lower threshold...");
        peaks.clear();
        last_peak_time = -min_interval * 2.0;
        let lower_threshold = mean_rms + (max_rms - mean_rms) * 0.15; // 15% above mean

        for (time, rms) in &volume_samples {
            if *rms > lower_threshold && (*time - last_peak_time) >= min_interval {
                let normalized_loudness = (*rms - mean_rms) / (max_rms - mean_rms).max(0.001);
                let amplitude = normalized_loudness.min(1.0).max(0.5);

                peaks.push(AudioPeak {
                    time: *time,
                    amplitude,
                });
                last_peak_time = *time;
            }
        }
    }

    println!("[Rust] Detected {} audio peaks", peaks.len());
    Ok(peaks)
}
