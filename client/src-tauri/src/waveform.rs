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
pub async fn clear_waveform_cache(
    video_path: String,
) -> Result<(), String> {
    println!("[Rust] Clearing waveform cache for: {}", video_path);

    // Generate hash
    let video_path_hash = generate_video_path_hash(&video_path);

    // Delete file cache
    let cache_file_path = get_waveform_cache_file_path(&video_path_hash)?;
    
    if cache_file_path.exists() {
        std::fs::remove_file(&cache_file_path)
            .map_err(|e| format!("Failed to delete cache file: {}", e))?;
        println!("[Rust] Deleted waveform cache file: {:?}", cache_file_path);
    } else {
        println!("[Rust] No cache file found to delete");
    }

    Ok(())
}

#[tauri::command]
pub async fn extract_audio_waveform(
    app: tauri::AppHandle,
    #[allow(non_snake_case)]
    videoPath: String,
    #[allow(non_snake_case)]
    _targetSamples: Option<u32>,
    #[allow(non_snake_case)]
    forceRegenerate: Option<bool>
) -> Result<WaveformData, String> {
    use tauri_plugin_shell::ShellExt;

    let video_path = videoPath;
    let force = forceRegenerate.unwrap_or(false);

    println!("[Rust] extract_audio_waveform called with:");
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   target_peaks: {} (fixed)", TARGET_PEAKS);
    println!("[Rust]   force_regenerate: {}", force);

    // Check cache first (unless force regenerate is requested)
    if !force {
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
    } else {
        println!("[Rust] Force regenerate requested, skipping cache check");
        // Clear existing cache file
        let video_path_hash = generate_video_path_hash(&video_path);
        if let Ok(cache_file_path) = get_waveform_cache_file_path(&video_path_hash) {
            if cache_file_path.exists() {
                let _ = std::fs::remove_file(&cache_file_path);
                println!("[Rust] Deleted existing cache file");
            }
        }
    }

    // Generate a hash for the video path for consistent lookup
    let video_path_hash = generate_video_path_hash(&video_path);

    // CRITICAL: Extract local file path from URL for FFmpeg
    // FFmpeg needs the actual file path, not the HTTP URL
    let local_video_path = extract_local_path_from_url(&video_path)
        .map_err(|e| format!("Failed to extract local path from video URL: {}", e))?;
    
    println!("[Rust] Local video path for FFmpeg: {}", local_video_path);

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
    // Use local_video_path instead of video_path (which is HTTP URL)
    let extract_output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", &local_video_path,
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
            "-i", &local_video_path,
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
    use std::io::{Read, Seek, SeekFrom};

    println!("[Rust] Processing WAV file: {}", wav_path.display());

    // Open and read WAV file
    let mut file = File::open(wav_path)
        .map_err(|e| format!("Failed to open WAV file: {}", e))?;

    // Read RIFF header (12 bytes)
    let mut riff_header = [0u8; 12];
    file.read_exact(&mut riff_header)
        .map_err(|e| format!("Failed to read RIFF header: {}", e))?;

    // Verify WAV format
    if &riff_header[0..4] != b"RIFF" || &riff_header[8..12] != b"WAVE" {
        return Err("Invalid WAV file format".to_string());
    }

    let mut sample_rate: u32 = 0;
    let mut data_size: u32 = 0;

    // Parse chunks to find fmt and data
    loop {
        // Read chunk header (4 bytes ID + 4 bytes size)
        let mut chunk_header = [0u8; 8];
        if file.read_exact(&mut chunk_header).is_err() {
            break; // End of file
        }

        let chunk_id = &chunk_header[0..4];
        let chunk_size = u32::from_le_bytes([chunk_header[4], chunk_header[5], chunk_header[6], chunk_header[7]]);

        println!("[Rust] Found chunk: {:?} size: {}", String::from_utf8_lossy(chunk_id), chunk_size);

        if chunk_id == b"fmt " {
            // Read fmt chunk to get sample rate
            let mut fmt_data = vec![0u8; chunk_size as usize];
            file.read_exact(&mut fmt_data)
                .map_err(|e| format!("Failed to read fmt chunk: {}", e))?;
            
            if fmt_data.len() >= 8 {
                sample_rate = u32::from_le_bytes([fmt_data[4], fmt_data[5], fmt_data[6], fmt_data[7]]);
                println!("[Rust] Sample rate from fmt chunk: {} Hz", sample_rate);
            }
        } else if chunk_id == b"data" {
            // Found data chunk - read audio samples
            data_size = chunk_size;
            println!("[Rust] Found data chunk with {} bytes", data_size);
            break;
        } else {
            // Skip unknown chunk
            file.seek(SeekFrom::Current(chunk_size as i64))
                .map_err(|e| format!("Failed to skip chunk: {}", e))?;
        }
    }

    if sample_rate == 0 {
        return Err("Could not find sample rate in WAV file".to_string());
    }

    if data_size == 0 {
        return Err("Could not find data chunk in WAV file".to_string());
    }

    // Read audio data
    let mut audio_data = vec![0u8; data_size as usize];
    file.read_exact(&mut audio_data)
        .map_err(|e| format!("Failed to read audio data: {}", e))?;

    println!("[Rust] Read {} bytes of audio data", audio_data.len());
    
    // DEBUG: Print first 20 bytes of raw audio data
    println!("[Rust] First 20 bytes of audio data: {:?}", &audio_data[..20.min(audio_data.len())]);

    // Convert bytes to 16-bit samples (little-endian)
    let mut samples = Vec::new();
    for chunk in audio_data.chunks_exact(2) {
        if chunk.len() == 2 {
            let sample = i16::from_le_bytes([chunk[0], chunk[1]]) as f64 / i16::MAX as f64;
            samples.push(sample);
        }
    }

    println!("[Rust] Converted to {} audio samples", samples.len());
    
    // DEBUG: Print first 10 raw i16 samples and their normalized values
    println!("[Rust] First 10 samples (raw i16 -> normalized f64):");
    for i in 0..10.min(audio_data.len() / 2) {
        let raw_i16 = i16::from_le_bytes([audio_data[i*2], audio_data[i*2 + 1]]);
        let normalized = raw_i16 as f64 / i16::MAX as f64;
        println!("[Rust]   Sample {}: raw={}, normalized={:.6}", i, raw_i16, normalized);
    }
    
    // DEBUG: Find the maximum absolute sample value in raw data
    let mut max_raw: i16 = 0;
    let mut min_raw: i16 = 0;
    for chunk in audio_data.chunks_exact(2) {
        let raw = i16::from_le_bytes([chunk[0], chunk[1]]);
        if raw > max_raw { max_raw = raw; }
        if raw < min_raw { min_raw = raw; }
    }
    println!("[Rust] Raw sample range: min={}, max={} (i16 range is -32768 to 32767)", min_raw, max_raw);

    // Calculate actual audio duration from samples
    let audio_duration_from_samples = samples.len() as f64 / sample_rate as f64;
    println!("[Rust] Audio duration from samples: {:.2}s, expected duration: {:.2}s", 
             audio_duration_from_samples, duration);
    
    // Check for significant mismatch
    if (audio_duration_from_samples - duration).abs() > 1.0 {
        println!("[Rust] WARNING: Audio duration mismatch! Samples suggest {:.2}s but video is {:.2}s", 
                 audio_duration_from_samples, duration);
    }

    if samples.is_empty() {
        return Err("No audio samples found".to_string());
    }
    
    // DEBUG: Analyze the raw audio samples to verify they're correct
    let mut max_sample = 0.0f64;
    let mut min_sample = 0.0f64;
    let mut non_zero_count = 0usize;
    for sample in &samples {
        if *sample > max_sample { max_sample = *sample; }
        if *sample < min_sample { min_sample = *sample; }
        if sample.abs() > 0.001 { non_zero_count += 1; }
    }
    println!("[Rust] Raw audio stats: min={:.4}, max={:.4}, non-zero samples: {} ({:.1}%)", 
             min_sample, max_sample, non_zero_count, 
             (non_zero_count as f64 / samples.len() as f64) * 100.0);
    
    // DEBUG: Print samples at specific time points to verify timing
    let samples_per_second = sample_rate as usize;
    println!("[Rust] Checking audio at specific time points (sample_rate={}):", sample_rate);
    for time_sec in [0, 2, 3, 4, 5, 10, 30, 60, 120, 180, 240] {
        if time_sec < audio_duration_from_samples as usize {
            let sample_idx = time_sec * samples_per_second;
            if sample_idx < samples.len() {
                // Get min/max of 1000 samples at this point (like PowerShell test)
                let end_idx = (sample_idx + 1000).min(samples.len());
                let mut min_val = 0.0f64;
                let mut max_val = 0.0f64;
                for i in sample_idx..end_idx {
                    if samples[i] < min_val { min_val = samples[i]; }
                    if samples[i] > max_val { max_val = samples[i]; }
                }
                println!("[Rust]   At {}s (sample_idx={}): min={:.4}, max={:.4}", time_sec, sample_idx, min_val, max_val);
            }
        }
    }

    // Generate peaks using absolute min/max peak detection
    // This is what waveform visualizers actually use - shows the actual amplitude envelope
    let num_samples = samples.len();
    let actual_peaks = (target_peaks as usize).min(num_samples);
    
    println!("[Rust] Generating {} absolute peaks from {} samples", actual_peaks, num_samples);

    let mut peaks = Vec::with_capacity(actual_peaks);

    for i in 0..actual_peaks {
        // Use floating point to ensure we cover all samples evenly
        let start_idx = (i as f64 * num_samples as f64 / actual_peaks as f64) as usize;
        let end_idx = ((i + 1) as f64 * num_samples as f64 / actual_peaks as f64) as usize;

        // Find the actual min and max sample values in this window
        // This gives us the true amplitude envelope of the audio
        let mut min_val = 0.0f64;
        let mut max_val = 0.0f64;

        for j in start_idx..end_idx {
            if j < num_samples {
                let sample = samples[j];
                if sample < min_val { min_val = sample; }
                if sample > max_val { max_val = sample; }
            }
        }

        // Store actual min/max values - this shows the true waveform shape
        peaks.push(WaveformPeak { min: min_val, max: max_val });
    }

    let peak_count = peaks.len() as u32;
    println!("[Rust] Generated {} peaks covering {} samples", peak_count, num_samples);
    
    // Find the actual max peak value across all peaks
    let mut global_max: f64 = 0.0;
    let mut max_peak_idx: usize = 0;
    for (i, peak) in peaks.iter().enumerate() {
        let peak_mag = peak.max.abs().max(peak.min.abs());
        if peak_mag > global_max {
            global_max = peak_mag;
            max_peak_idx = i;
        }
    }
    let max_peak_time = (max_peak_idx as f64 / actual_peaks as f64) * duration;
    println!("[Rust] Global max peak: {:.4} at index {} (time: {:.1}s)", global_max, max_peak_idx, max_peak_time);
    
    // Debug: Print peaks at specific time points where we know there's audio
    let peaks_per_second = actual_peaks as f64 / duration;
    println!("[Rust] Peaks at specific times (peaks_per_second={:.1}):", peaks_per_second);
    for time_sec in [2, 3, 4, 5, 60, 120, 240] {
        let peak_idx = (time_sec as f64 * peaks_per_second) as usize;
        if peak_idx < peaks.len() {
            let p = &peaks[peak_idx];
            println!("[Rust]   At {}s (peak {}): min={:.4}, max={:.4}", time_sec, peak_idx, p.min, p.max);
        }
    }

    Ok(WaveformData {
        sample_rate,
        duration,
        peaks,
        peak_count,
    })
}
