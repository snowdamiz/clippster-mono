// Waveform peak data structure
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct WaveformPeak {
    min: f64,
    max: f64,
}

// Single resolution level data
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct WaveformResolution {
    peaks: Vec<WaveformPeak>,
    peak_count: u32,
    samples_per_peak: u32,
}

// Multi-resolution waveform data structure
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct WaveformData {
    sample_rate: u32,
    duration: f64,
    resolutions: std::collections::HashMap<String, WaveformResolution>,
}

// Helper function to determine optimal resolution for zoom level
#[allow(dead_code)]
pub fn get_optimal_resolution(effective_width: f64, duration: f64) -> String {
    // Calculate desired samples per pixel at current zoom
    let samples_per_pixel = (duration * 44100.0) / effective_width;

    // Select resolution based on zoom level
    if samples_per_pixel > 5000.0 {
        "low".to_string()      // 500 peaks - very zoomed out
    } else if samples_per_pixel > 2000.0 {
        "medium".to_string()   // 1000 peaks - zoomed out
    } else if samples_per_pixel > 800.0 {
        "high".to_string()     // 2000 peaks - normal
    } else if samples_per_pixel > 300.0 {
        "ultra".to_string()    // 4000 peaks - zoomed in
    } else {
        "extreme".to_string()  // 8000 peaks - very zoomed in
    }
}

// Generate a hash for the video path for consistent lookup
pub fn generate_video_path_hash(video_path: &str) -> String {
    use std::hash::{Hash, Hasher};
    use std::collections::hash_map::DefaultHasher;

    let mut hasher = DefaultHasher::new();
    video_path.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

// Extract local file path from video URL
pub fn extract_local_path_from_url(video_url: &str) -> Result<String, String> {
    // Handle localhost video URLs
    if video_url.starts_with("http://localhost:48276/video/") {
        let encoded_path = video_url.strip_prefix("http://localhost:48276/video/")
            .ok_or("Invalid video URL format")?;

        // The path is base64 encoded, decode it
        use base64::{Engine as _, engine::general_purpose};
        let decoded_bytes = general_purpose::STANDARD.decode(encoded_path)
            .map_err(|e| format!("Failed to decode base64 video path: {}", e))?;

        let decoded_path = String::from_utf8(decoded_bytes)
            .map_err(|e| format!("Failed to convert decoded path to string: {}", e))?;

        Ok(decoded_path)
    } else if video_url.starts_with("http://") {
        // For other HTTP URLs, we can't get file metadata
        Err("Cannot get file metadata for remote URLs".to_string())
    } else {
        // Assume it's already a local path
        Ok(video_url.to_string())
    }
}

// Get file metadata for cache validation
pub fn get_video_file_metadata(video_path: &str) -> Result<(u64, u64), String> {
    // Extract local file path if it's a URL
    let local_path = extract_local_path_from_url(video_path)?;

    let metadata = std::fs::metadata(&local_path)
        .map_err(|e| format!("Failed to get video file metadata for {}: {}", local_path, e))?;

    let file_size = metadata.len();
    let modified_time = metadata.modified()
        .map_err(|e| format!("Failed to get file modification time: {}", e))?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to convert modification time: {}", e))?
        .as_secs();

    Ok((file_size, modified_time))
}

use super::storage;

// Get cache file path for waveform data
pub fn get_waveform_cache_file_path(video_path_hash: &str) -> Result<std::path::PathBuf, String> {
    let paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    Ok(paths.temp.join(format!("waveform_cache_{}.json", video_path_hash)))
}

// Save waveform data to file cache
pub async fn save_waveform_to_file_cache(video_path_hash: &str, waveform_data: &WaveformData) -> Result<(), String> {
    use std::fs::File;
    use std::io::Write;

    let cache_file_path = get_waveform_cache_file_path(video_path_hash)?;

    let json_data = serde_json::to_string(waveform_data)
        .map_err(|e| format!("Failed to serialize waveform data: {}", e))?;

    let mut file = File::create(&cache_file_path)
        .map_err(|e| format!("Failed to create cache file: {}", e))?;

    file.write_all(json_data.as_bytes())
        .map_err(|e| format!("Failed to write cache file: {}", e))?;

    println!("[Rust] Waveform cached to file: {:?}", cache_file_path);
    Ok(())
}

// Load waveform data from file cache
pub async fn load_waveform_from_file_cache(video_path_hash: &str) -> Result<Option<WaveformData>, String> {
    use std::fs::File;
    use std::io::Read;

    let cache_file_path = get_waveform_cache_file_path(video_path_hash)?;

    if !cache_file_path.exists() {
        return Ok(None);
    }

    let mut file = File::open(&cache_file_path)
        .map_err(|e| format!("Failed to open cache file: {}", e))?;

    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read cache file: {}", e))?;

    let waveform_data: WaveformData = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to deserialize waveform data: {}", e))?;

    println!("[Rust] Waveform loaded from cache: {:?}", cache_file_path);
    Ok(Some(waveform_data))
}

#[tauri::command]
pub async fn get_cached_waveform(
    video_path: String,
) -> Result<Option<WaveformData>, String> {
    println!("[Rust] Checking for cached waveform for: {}", video_path);

    // Generate hash for video path
    let video_path_hash = generate_video_path_hash(&video_path);

    // Try to load from file cache
    match load_waveform_from_file_cache(&video_path_hash).await {
        Ok(Some(waveform_data)) => {
            println!("[Rust] Found cached waveform, returning it");
            return Ok(Some(waveform_data));
        }
        Ok(None) => {
            println!("[Rust] No cached waveform found in file cache");
        }
        Err(e) => {
            println!("[Rust] Error checking file cache: {}, proceeding with generation", e);
        }
    }

    Ok(None)
}

#[tauri::command]
pub async fn save_waveform_to_cache(
    video_path: String,
    _raw_video_id: String,
    waveform_data: WaveformData,
) -> Result<(), String> {
    println!("[Rust] Saving waveform data to cache for: {}", video_path);

    // Generate hash
    let video_path_hash = generate_video_path_hash(&video_path);
    let (file_size, _modified_time) = get_video_file_metadata(&video_path)?;

    println!("[Rust] Waveform data being saved:");
    println!("[Rust]   Hash: {}", video_path_hash);
    println!("[Rust]   File size: {}", file_size);
    println!("[Rust]   Resolution count: {}", waveform_data.resolutions.len());

    // Save to file cache
    save_waveform_to_file_cache(&video_path_hash, &waveform_data).await
}

#[tauri::command]
pub async fn extract_audio_waveform(
    app: tauri::AppHandle,
    video_path: String,
    target_samples: Option<u32>
) -> Result<WaveformData, String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] extract_audio_waveform called with:");
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   target_samples: {:?}", target_samples);

    // Check cache first
    match get_cached_waveform(video_path.clone()).await {
        Ok(Some(cached_waveform)) => {
            println!("[Rust] Returning cached waveform data");
            return Ok(cached_waveform);
        }
        Ok(None) => {
            println!("[Rust] No cached waveform found, proceeding with generation");
        }
        Err(e) => {
            println!("[Rust] Error checking cache: {}, proceeding with generation", e);
        }
    }

    // Define multiple resolution levels for adaptive rendering
    let resolution_levels = vec![
        ("low", 500),      // 500 peaks - very zoomed out
        ("medium", 1000),  // 1000 peaks - zoomed out
        ("high", 2000),    // 2000 peaks - normal view
        ("ultra", 4000),   // 4000 peaks - zoomed in
        ("extreme", 8000), // 8000 peaks - very zoomed in
    ];

    // Get storage paths for temporary files
    let paths = storage::init_storage_dirs()
        .map_err(|e| {
            println!("[Rust] Failed to get storage paths: {}", e);
            format!("Failed to get storage paths: {}", e)
        })?;

    // Create unique temporary audio file
    let temp_audio_path = paths.videos.join(format!("temp_waveform_{}.wav",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| format!("Failed to get timestamp: {}", e))?
            .as_secs()
    ));

    println!("[Rust] Temporary audio path: {}", temp_audio_path.display());

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
    let video_duration = super::ffmpeg_utils::parse_duration_from_ffmpeg_output(&stderr)
        .map_err(|e| format!("Failed to parse video duration: {}", e))?;

    println!("[Rust] Video duration: {:.2} seconds", video_duration);

    if video_duration <= 0.0 {
        return Err("Invalid video duration".to_string());
    }

    // Extract audio as WAV for processing (16-bit PCM, mono)
    println!("[Rust] Extracting audio as WAV...");
    let extract_output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", &video_path,
            "-vn",                    // No video
            "-acodec", "pcm_s16le",   // 16-bit PCM
            "-ar", "44100",           // 44.1kHz sample rate
            "-ac", "1",               // Mono
            "-y",                     // Overwrite output
            temp_audio_path.to_str().ok_or("Invalid temporary audio path")?,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to extract audio: {}", e))?;

    if !extract_output.status.success() {
        let stderr = String::from_utf8_lossy(&extract_output.stderr);
        return Err(format!("FFmpeg audio extraction failed: {}", stderr));
    }

    println!("[Rust] Audio extracted successfully");

    // Process the WAV file to extract multi-resolution waveform data
    let waveform_data = process_wav_file_multi_resolution(&temp_audio_path, &resolution_levels, video_duration)
        .map_err(|e| format!("Failed to process WAV file: {}", e))?;

    // Clean up temporary file
    if let Err(e) = std::fs::remove_file(&temp_audio_path) {
        eprintln!("[Rust] Warning: Failed to remove temporary audio file {}: {}", temp_audio_path.display(), e);
    } else {
        println!("[Rust] Cleaned up temporary audio file");
    }

    let total_peaks: u32 = waveform_data.resolutions.values()
        .map(|r| r.peak_count)
        .sum();
    println!("[Rust] Multi-resolution waveform extraction completed. Generated {} peaks across {} resolution levels.",
             total_peaks, waveform_data.resolutions.len());

    // Save to cache for future use
    let raw_video_id = format!("waveform_{}", generate_video_path_hash(&video_path));
    if let Err(e) = save_waveform_to_cache(video_path.clone(), raw_video_id, waveform_data.clone()).await {
        eprintln!("[Rust] Warning: Failed to cache waveform data: {}", e);
    }

    Ok(waveform_data)
}

// Process WAV file to extract multi-resolution waveform peaks
fn process_wav_file_multi_resolution(
    wav_path: &std::path::Path,
    resolution_levels: &[(&str, u32)],
    duration: f64
) -> Result<WaveformData, String> {
    use std::fs::File;
    use std::io::Read;

    println!("[Rust] Processing WAV file for multi-resolution: {}", wav_path.display());

    // Open and read WAV file
    let mut file = File::open(wav_path)
        .map_err(|e| format!("Failed to open WAV file: {}", e))?;

    // Read WAV header (44 bytes for standard WAV)
    let mut header = [0u8; 44];
    file.read_exact(&mut header)
        .map_err(|e| format!("Failed to read WAV header: {}", e))?;

    // Verify WAV format
    if &header[0..4] != b"RIFF" || &header[8..12] != b"WAVE" {
        return Err("Invalid WAV file format".to_string());
    }

    // Get sample rate from header (bytes 24-27)
    let sample_rate = u32::from_le_bytes([header[24], header[25], header[26], header[27]]);
    println!("[Rust] Sample rate: {} Hz", sample_rate);

    // Skip to audio data
    let mut data_pos = 12; // After RIFF header
    while data_pos < header.len() - 8 {
        if &header[data_pos..data_pos + 4] == b"data" {
            // Found data chunk, break without using data_pos since we read from current position
            break;
        }
        data_pos += 8;
    }

    // Read remaining file as audio data
    let mut audio_data = Vec::new();
    file.read_to_end(&mut audio_data)
        .map_err(|e| format!("Failed to read audio data: {}", e))?;

    println!("[Rust] Read {} bytes of audio data", audio_data.len());

    // Convert bytes to 16-bit samples (little-endian)
    let mut samples = Vec::new();
    for chunk in audio_data.chunks_exact(2) {
        if chunk.len() == 2 {
            let sample = i16::from_le_bytes([chunk[0], chunk[1]]) as f64 / i16::MAX as f64;
            samples.push(sample);
        }
    }

    println!("[Rust] Converted to {} audio samples", samples.len());

    if samples.is_empty() {
        return Err("No audio samples found".to_string());
    }

    // Generate multi-resolution peaks
    let mut resolutions = std::collections::HashMap::new();

    for &(level_name, target_peaks) in resolution_levels {
        println!("[Rust] Generating {} resolution with {} peaks", level_name, target_peaks);

        let samples_per_peak = (samples.len() as f64 / target_peaks as f64).ceil() as usize;
        let mut peaks = Vec::new();

        for i in 0..target_peaks {
            let start_idx = (i as usize * samples_per_peak).min(samples.len());
            let end_idx = ((i as usize + 1) * samples_per_peak).min(samples.len());

            if start_idx >= samples.len() {
                break;
            }

            let mut min = 0.0;
            let mut max = 0.0;

            // Find min and max in this chunk
            for &sample in &samples[start_idx..end_idx] {
                if sample < min { min = sample; }
                if sample > max { max = sample; }
            }

            peaks.push(WaveformPeak { min, max });
        }

        let resolution = WaveformResolution {
            peak_count: peaks.len() as u32,
            samples_per_peak: samples_per_peak as u32,
            peaks: peaks.clone(),
        };

        resolutions.insert(level_name.to_string(), resolution);
        println!("[Rust] Generated {} peaks for {} resolution", peaks.len(), level_name);
    }

    println!("[Rust] Multi-resolution waveform generation completed");

    Ok(WaveformData {
        sample_rate,
        duration,
        resolutions,
    })
}