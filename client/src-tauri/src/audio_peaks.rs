use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioPeak {
    pub time: f64,
    pub amplitude: f64,
}

/// Detect audio peaks (loud moments) in a video for intelligent effect placement
/// Returns timestamps where audio amplitude exceeds the threshold
#[tauri::command]
pub async fn detect_audio_peaks(
    app: AppHandle,
    video_path: String,
    threshold: f64,
    min_interval: f64,
) -> Result<Vec<AudioPeak>, String> {
    use tauri_plugin_shell::ShellExt;
    use std::io::{BufRead, BufReader};

    println!("[Rust] detect_audio_peaks called:");
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   threshold: {}", threshold);
    println!("[Rust]   min_interval: {}s", min_interval);

    // Extract local file path from URL
    let local_path = crate::waveform::extract_local_path_from_url(&video_path)
        .map_err(|e| format!("Failed to extract local path: {}", e))?;

    let shell = app.shell();

    // Use FFmpeg's silencedetect filter in reverse - detect non-silent (loud) parts
    // We'll analyze the audio and find peaks by detecting where volume exceeds threshold
    let output = shell
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-nostdin",
            "-i", &local_path,
            "-af", &format!("volumedetect,silencedetect=noise=-{}dB:d={}",
                // Convert linear threshold to dB: dB = 20 * log10(amplitude)
                // For threshold 0.3: -20 * log10(0.3) ≈ 10.46 dB
                (-20.0 * threshold.log10()).abs(),
                min_interval
            ),
            "-f", "null",
            "-",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run FFmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg failed: {}", stderr));
    }

    // Parse FFmpeg output to extract peaks
    // silencedetect outputs lines like: [silencedetect @ ...] silence_end: 12.345 | silence_duration: 0.678
    // The silence_end marks the end of a silent period, which is the START of a loud section
    let stderr = String::from_utf8_lossy(&output.stderr);
    let mut peaks: Vec<AudioPeak> = Vec::new();
    let mut last_peak_time = -min_interval * 2.0;

    // Also extract mean and max volume from volumedetect for amplitude calculation
    let mut mean_volume_db: Option<f64> = None;
    let mut max_volume_db: Option<f64> = None;

    for line in stderr.lines() {
        // Extract volume statistics
        if line.contains("mean_volume:") {
            if let Some(start) = line.find("mean_volume:") {
                let rest = &line[start + 12..].trim();
                if let Some(end) = rest.find("dB") {
                    if let Ok(vol) = rest[..end].trim().parse::<f64>() {
                        mean_volume_db = Some(vol);
                    }
                }
            }
        }
        if line.contains("max_volume:") {
            if let Some(start) = line.find("max_volume:") {
                let rest = &line[start + 11..].trim();
                if let Some(end) = rest.find("dB") {
                    if let Ok(vol) = rest[..end].trim().parse::<f64>() {
                        max_volume_db = Some(vol);
                    }
                }
            }
        }

        // Extract silence_end times (which mark the start of loud sections)
        if line.contains("silence_end:") {
            if let Some(start) = line.find("silence_end:") {
                let rest = &line[start + 12..].trim();
                if let Some(end) = rest.find("|") {
                    if let Ok(time) = rest[..end].trim().parse::<f64>() {
                        // Check if this peak is far enough from the last one
                        if (time - last_peak_time) >= min_interval {
                            // Use max_volume as amplitude, or default to threshold
                            let amplitude = if let Some(max_db) = max_volume_db {
                                10_f64.powf(max_db / 20.0)
                            } else {
                                threshold * 1.5 // Slightly above threshold
                            };
                            
                            peaks.push(AudioPeak { time, amplitude });
                            last_peak_time = time;
                        }
                    }
                }
            }
        }
    }

    println!("[Rust] Detected {} audio peaks", peaks.len());
    Ok(peaks)
}
