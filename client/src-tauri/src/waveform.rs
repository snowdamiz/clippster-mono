// Waveform peak data structure
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct WaveformPeak {
    pub min: f64,
    pub max: f64,
}

// Simplified single-resolution waveform data structure
// Frontend will downsample as needed for different zoom levels
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct WaveformData {
    pub sample_rate: u32,
    pub duration: f64,
    pub peaks: Vec<WaveformPeak>,
    pub peak_count: u32,
}

// Target peak count - high resolution, frontend will downsample as needed
const TARGET_PEAKS: u32 = 16000;
// Sample rate for audio extraction - 16kHz is sufficient for waveform visualization
const WAVEFORM_SAMPLE_RATE: u32 = 16000;

// Generate a hash for the video path for consistent lookup
pub fn generate_video_path_hash(video_path: &str) -> String {
    use std::hash::{Hash, Hasher};
    use std::collections::hash_map::DefaultHasher;

    // Try to normalize to local path if possible
    let path_to_hash = match extract_local_path_from_url(video_path) {
        Ok(local_path) => local_path,
        Err(_) => video_path.to_string(), // Fallback to hashing the original string (e.g. remote URL)
    };

    let mut hasher = DefaultHasher::new();
    path_to_hash.hash(&mut hasher);
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

// Get cache file path for audio data (shared with clip detection)
pub fn get_audio_cache_file_path(video_path_hash: &str) -> Result<std::path::PathBuf, String> {
    let paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    Ok(paths.temp.join(format!("audio_cache_{}.mp3", video_path_hash)))
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
    println!("[Rust]   Peak count: {}", waveform_data.peak_count);

    // Save to file cache
    save_waveform_to_file_cache(&video_path_hash, &waveform_data).await
}

#[tauri::command]
pub async fn extract_audio_waveform(
    app: tauri::AppHandle,
    video_path: String,
    _target_samples: Option<u32>
) -> Result<WaveformData, String> {
    use tauri_plugin_shell::ShellExt;

    println!("[Rust] extract_audio_waveform called with:");
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   target_peaks: {} (fixed)", TARGET_PEAKS);

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

    // Generate a hash for the video path for consistent lookup
    let video_path_hash = generate_video_path_hash(&video_path);

    // Get storage paths for temporary files
    let paths = storage::init_storage_dirs()
        .map_err(|e| {
            println!("[Rust] Failed to get storage paths: {}", e);
            format!("Failed to get storage paths: {}", e)
        })?;

    let shell = app.shell();

    // Create unique temporary WAV file path
    let temp_wav_path = paths.videos.join(format!("temp_waveform_{}.wav",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| format!("Failed to get timestamp: {}", e))?
            .as_secs()
    ));

    println!("[Rust] Extracting audio directly to {}Hz WAV: {}", WAVEFORM_SAMPLE_RATE, temp_wav_path.display());

    // Extract audio directly to low-bitrate WAV (16kHz mono) - single FFmpeg call
    let extract_output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", &video_path,
            "-vn",                    // No video
            "-acodec", "pcm_s16le",   // 16-bit PCM
            "-ar", &WAVEFORM_SAMPLE_RATE.to_string(), // 16kHz sample rate (sufficient for waveform)
            "-ac", "1",               // Mono
            "-y",                     // Overwrite output
            temp_wav_path.to_str().ok_or("Invalid temporary WAV path")?,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to extract audio: {}", e))?;

    if !extract_output.status.success() {
        let stderr = String::from_utf8_lossy(&extract_output.stderr);
        return Err(format!("FFmpeg audio extraction failed: {}", stderr));
    }

    println!("[Rust] Audio extraction completed successfully");

    // Get video duration from FFmpeg output or calculate from WAV
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

    // Process the WAV file to extract waveform peaks
    let waveform_data = process_wav_file(&temp_wav_path, TARGET_PEAKS, video_duration)
        .map_err(|e| format!("Failed to process WAV file: {}", e))?;

    // Clean up temporary WAV file
    if let Err(e) = std::fs::remove_file(&temp_wav_path) {
        eprintln!("[Rust] Warning: Failed to remove temporary WAV file {}: {}", temp_wav_path.display(), e);
    } else {
        println!("[Rust] Cleaned up temporary WAV file");
    }

    println!("[Rust] Waveform extraction completed. Generated {} peaks.", waveform_data.peak_count);

    // Save to cache for future use
    let raw_video_id = format!("waveform_{}", video_path_hash);
    if let Err(e) = save_waveform_to_cache(video_path.clone(), raw_video_id, waveform_data.clone()).await {
        eprintln!("[Rust] Warning: Failed to cache waveform data: {}", e);
    }

    Ok(waveform_data)
}

// Process WAV file to extract waveform peaks (single resolution)
fn process_wav_file(
    wav_path: &std::path::Path,
    target_peaks: u32,
    duration: f64
) -> Result<WaveformData, String> {
    use std::fs::File;
    use std::io::Read;

    println!("[Rust] Processing WAV file: {}", wav_path.display());

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
            // Found data chunk
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

    // Generate peaks
    println!("[Rust] Generating {} peaks", target_peaks);

    let samples_per_peak = (samples.len() as f64 / target_peaks as f64).ceil() as usize;
    let mut peaks = Vec::with_capacity(target_peaks as usize);

    for i in 0..target_peaks {
        let start_idx = (i as usize * samples_per_peak).min(samples.len());
        let end_idx = ((i as usize + 1) * samples_per_peak).min(samples.len());

        if start_idx >= samples.len() {
            break;
        }

        let mut min = 0.0f64;
        let mut max = 0.0f64;

        // Find min and max in this chunk
        for &sample in &samples[start_idx..end_idx] {
            if sample < min { min = sample; }
            if sample > max { max = sample; }
        }

        peaks.push(WaveformPeak { min, max });
    }

    let peak_count = peaks.len() as u32;
    println!("[Rust] Generated {} peaks", peak_count);

    Ok(WaveformData {
        sample_rate,
        duration,
        peaks,
        peak_count,
    })
}
