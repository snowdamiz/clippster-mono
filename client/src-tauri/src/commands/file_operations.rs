use std::{fs::File, io::Read, path::Path};
use md5::{Digest, Md5};
use tauri::AppHandle;

use crate::ffmpeg_utils::{
    extract_duration_from_ffmpeg_output, parse_video_info_from_ffmpeg_output, VideoValidationResult,
};
use crate::storage;

#[derive(serde::Serialize)]
pub struct ProxyGenerationResult {
    pub proxy_path: String,
}

#[derive(serde::Serialize)]
pub struct CreatorSkillExportCheck {
    pub duration: f64,
    pub width: u64,
    pub height: u64,
    pub has_audio: bool,
    pub fully_decoded: bool,
    pub error: Option<String>,
    pub integrated_lufs: Option<f64>,
    pub true_peak_dbtp: Option<f64>,
    pub audio_measurement_error: Option<String>,
    pub contact_sheet_path: Option<String>,
    pub stream_duration_delta_ms: Option<f64>,
    pub stream_start_delta_ms: Option<f64>,
    pub phone_preview_path: Option<String>,
}

/** Hash one local artifact in bounded chunks for the creator delivery manifest. */
#[tauri::command]
pub async fn hash_creator_skill_file(file_path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let mut file = File::open(&file_path).map_err(|error| format!("Could not open artifact for hashing: {error}"))?;
        let mut digest = Md5::new();
        let mut chunk = [0u8; 1024 * 1024];
        loop {
            let read = file.read(&mut chunk).map_err(|error| format!("Could not hash artifact: {error}"))?;
            if read == 0 { break; }
            digest.update(&chunk[..read]);
        }
        Ok::<_, String>(hex::encode(digest.finalize()))
    }).await.map_err(|error| format!("Could not finish artifact hash: {error}"))?
}

/// Measure quiet source spans at a 5 ms detection threshold for removed-audio review.
#[tauri::command]
pub async fn scan_creator_skill_source_silence(app: AppHandle, file_path: String) -> Result<String, String> {
    if !Path::new(&file_path).is_file() { return Err("Source clip does not exist.".into()); }
    let output = crate::ffmpeg_sidecar::run_ffmpeg(
        &app,
        &["-nostdin", "-hide_banner", "-i", &file_path, "-map", "0:a:0", "-af", "silencedetect=noise=-50dB:d=0.005", "-f", "null", "-"],
    ).await?;
    if !output.status.success() { return Err(format!("Source silence scan failed: {}", String::from_utf8_lossy(&output.stderr))); }
    if output.stderr.len() > 1024 * 1024 { return Err("Source silence scan output exceeded its limit.".into()); }
    Ok(String::from_utf8_lossy(&output.stderr).into_owned())
}

/// Raise or lower the rendered voice with static gain and a safety limiter.
/// The original render is never modified; callers must verify the returned file.
#[tauri::command]
pub async fn normalize_creator_skill_audio(app: AppHandle, file_path: String) -> Result<String, String> {
    let input = Path::new(&file_path);
    if !input.is_file() { return Err("Rendered master does not exist.".into()); }
    let measured = crate::ffmpeg_sidecar::run_ffmpeg(&app,
        &["-nostdin", "-hide_banner", "-i", &file_path, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"],
    ).await?;
    if !measured.status.success() { return Err("Could not measure rendered audio.".into()); }
    let (Some(lufs), Some(peak)) = parse_ebur128_summary(&String::from_utf8_lossy(&measured.stderr)) else {
        return Err("Could not read rendered audio loudness and true peak.".into());
    };
    let gain = (-14.0 - lufs).clamp(-12.0, 12.0);
    if gain.abs() <= 0.5 && peak <= -1.0 { return Ok(file_path); }
    let stem = input.file_stem().and_then(|value| value.to_str()).ok_or("Invalid master filename.")?;
    let output = input.with_file_name(format!("{stem}-normalized.mp4"));
    let output_path = output.to_str().ok_or("Invalid normalized master path.")?;
    let filter = format!("volume={gain:.2}dB,alimiter=limit=0.841395:level=false");
    let result = crate::ffmpeg_sidecar::run_ffmpeg(&app,
        &["-nostdin", "-v", "error", "-i", &file_path, "-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy", "-af", &filter, "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-y", output_path],
    ).await?;
    if !result.status.success() { let _ = std::fs::remove_file(&output); return Err("Could not normalize rendered audio.".into()); }
    let verified = crate::ffmpeg_sidecar::run_ffmpeg(&app,
        &["-nostdin", "-hide_banner", "-i", output_path, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"],
    ).await?;
    let (_, verified_peak) = parse_ebur128_summary(&String::from_utf8_lossy(&verified.stderr));
    if !verified.status.success() || !verified_peak.is_some_and(|value| value <= -1.0) {
        let _ = std::fs::remove_file(&output);
        return Err("Normalized audio did not pass the -1 dBTP true-peak check.".into());
    }
    Ok(output_path.to_string())
}

/// Keep the already transcribed and normalized audio byte-for-byte while replacing only captioned video.
#[tauri::command]
pub async fn remux_creator_skill_final_audio(app: AppHandle, video_path: String, audio_path: String) -> Result<String, String> {
    let video = Path::new(&video_path);
    if !video.is_file() || !Path::new(&audio_path).is_file() { return Err("Captioned video or approved audio is missing.".into()); }
    let stem = video.file_stem().and_then(|value| value.to_str()).ok_or("Invalid captioned video filename.")?;
    let output = video.with_file_name(format!("{stem}-final-audio.mp4"));
    let output_path = output.to_str().ok_or("Invalid final-audio path.")?;
    let result = crate::ffmpeg_sidecar::run_ffmpeg(&app,
        &["-nostdin", "-v", "error", "-i", &video_path, "-i", &audio_path, "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-movflags", "+faststart", "-y", output_path],
    ).await?;
    if !result.status.success() { let _ = std::fs::remove_file(&output); return Err("Could not combine the final captions with the verified audio.".into()); }
    Ok(output_path.to_string())
}

fn parse_ebur128_summary(log: &str) -> (Option<f64>, Option<f64>) {
    let Some(summary) = log.rsplit("Summary:").next().filter(|part| *part != log) else {
        return (None, None);
    };
    let mut section = "";
    let mut integrated = None;
    let mut peak = None;
    for line in summary.lines() {
        let line = line.trim();
        if line.starts_with("Integrated loudness:") { section = "integrated"; }
        else if line.starts_with("True peak:") { section = "peak"; }
        else if line.ends_with(':') { section = ""; }
        else if let Some(value) = line.strip_prefix("I:").filter(|_| section == "integrated") {
            integrated = value.trim().split_whitespace().next().and_then(|number| number.parse::<f64>().ok()).filter(|number| number.is_finite());
        } else if let Some(value) = line.strip_prefix("Peak:").filter(|_| section == "peak") {
            peak = value.trim().split_whitespace().next().and_then(|number| number.parse::<f64>().ok()).filter(|number| number.is_finite());
        }
    }
    (integrated, peak)
}

async fn create_creator_skill_phone_preview(app: &AppHandle, source: &str, duration: f64, max_preview_mb: f64, landscape: bool) -> Option<String> {
    let input = Path::new(source);
    let stem = input.file_stem()?.to_str()?;
    let output = input.with_file_name(format!("{stem}-phone-preview.mp4"));
    let passlog = input.with_file_name(format!("{stem}-phone-preview-pass"));
    let output_path = output.to_str()?;
    let passlog_path = passlog.to_str()?;
    let video_budget_mb = max_preview_mb - (max_preview_mb * 0.1).min(2.0);
    let video_kbps = ((video_budget_mb * 8.0 * 1024.0 / duration) - 140.0).floor().clamp(200.0, 7000.0) as u64;
    let bitrate = format!("{video_kbps}k");
    let scale = if landscape { "scale=1280:720" } else { "scale=720:1280" };
    let common = ["-nostdin", "-v", "error", "-i", source, "-vf", scale, "-c:v", "libx264", "-preset", "medium", "-pix_fmt", "yuv420p", "-b:v", bitrate.as_str(), "-passlogfile", passlog_path, "-threads", "2"];
    let mut first_args = common.to_vec();
    first_args.extend(["-pass", "1", "-an", "-f", "null", "-"]);
    let first = crate::ffmpeg_sidecar::run_ffmpeg(app, &first_args).await;
    let result = if first.as_ref().is_ok_and(|run| run.status.success()) {
        let mut second_args = common.to_vec();
        second_args.extend(["-pass", "2", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-y", output_path]);
        crate::ffmpeg_sidecar::run_ffmpeg(app, &second_args).await
    } else { first };
    for suffix in ["-0.log", "-0.log.mbtree"] {
        let _ = std::fs::remove_file(format!("{passlog_path}{suffix}"));
    }
    let ready = result.as_ref().is_ok_and(|run| run.status.success())
        && output.metadata().is_ok_and(|file| (file.len() as f64) < max_preview_mb * 1024.0 * 1024.0);
    if ready {
        Some(output_path.to_string())
    } else {
        let _ = std::fs::remove_file(&output);
        None
    }
}

#[cfg(test)]
mod creator_skill_audio_tests {
    use super::parse_ebur128_summary;

    #[test]
    fn parses_final_ebur128_summary() {
        let log = "[Parsed_ebur128_0] Summary:\n\n  Integrated loudness:\n    I:         -14.2 LUFS\n    Threshold: -24.2 LUFS\n\n  True peak:\n    Peak:      -1.5 dBFS\n";
        assert_eq!(parse_ebur128_summary(log), (Some(-14.2), Some(-1.5)));
    }
}

/// Probe the streams and decode the full rendered export before it is offered for review.
#[tauri::command]
pub async fn check_creator_skill_export(
    app: AppHandle,
    file_path: String,
    max_preview_mb: f64,
) -> Result<CreatorSkillExportCheck, String> {
    if !max_preview_mb.is_finite() || !(1.0..=200.0).contains(&max_preview_mb) {
        return Err("Phone preview size must be between 1 and 200 MB".into());
    }
    if !Path::new(&file_path).is_file() {
        return Err("Rendered export does not exist".into());
    }
    let probe = crate::ffmpeg_sidecar::run_ffprobe(
        &app,
        &["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,duration,start_time", "-of", "json", &file_path],
    ).await?;
    if !probe.status.success() {
        return Err(format!("Could not probe rendered export: {}", String::from_utf8_lossy(&probe.stderr)));
    }
    let data: serde_json::Value = serde_json::from_slice(&probe.stdout)
        .map_err(|e| format!("Could not read export metadata: {}", e))?;
    let streams = data["streams"].as_array().ok_or("Export has no media streams")?;
    let video = streams.iter().find(|stream| stream["codec_type"] == "video")
        .ok_or("Export has no video stream")?;
    let duration = data["format"]["duration"].as_str().and_then(|value| value.parse::<f64>().ok())
        .ok_or("Export has no measurable duration")?;
    let width = video["width"].as_u64().unwrap_or(0);
    let height = video["height"].as_u64().unwrap_or(0);
    if !duration.is_finite() || duration <= 0.0 || width == 0 || height == 0 {
        return Err("Export has invalid duration or dimensions".into());
    }
    let decoded = crate::ffmpeg_sidecar::run_ffmpeg(
        &app,
        &["-nostdin", "-v", "error", "-xerror", "-i", &file_path, "-map", "0:v:0", "-map", "0:a:0?", "-f", "null", "-"],
    ).await?;
    let has_audio = streams.iter().any(|stream| stream["codec_type"] == "audio");
    let audio_stream = streams.iter().find(|stream| stream["codec_type"] == "audio");
    let stream_duration_delta_ms = audio_stream
        .and_then(|audio| audio["duration"].as_str())
        .and_then(|value| value.parse::<f64>().ok())
        .zip(video["duration"].as_str().and_then(|value| value.parse::<f64>().ok()))
        .map(|(audio_duration, video_duration)| (audio_duration - video_duration).abs() * 1000.0)
        .filter(|delta| delta.is_finite());
    let stream_start_delta_ms = audio_stream
        .and_then(|audio| audio["start_time"].as_str())
        .and_then(|value| value.parse::<f64>().ok())
        .zip(video["start_time"].as_str().and_then(|value| value.parse::<f64>().ok()))
        .map(|(audio_start, video_start)| (audio_start - video_start).abs() * 1000.0)
        .filter(|delta| delta.is_finite());
    let (integrated_lufs, true_peak_dbtp, audio_measurement_error) = if has_audio {
        match crate::ffmpeg_sidecar::run_ffmpeg(
            &app,
            &["-nostdin", "-hide_banner", "-i", &file_path, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"],
        ).await {
            Ok(measured) if measured.status.success() => {
                let (lufs, peak) = parse_ebur128_summary(&String::from_utf8_lossy(&measured.stderr));
                let error = if lufs.is_none() || peak.is_none() { Some("FFmpeg did not report integrated loudness and true peak".into()) } else { None };
                (lufs, peak, error)
            }
            Ok(measured) => (None, None, Some(String::from_utf8_lossy(&measured.stderr).trim().to_string())),
            Err(error) => (None, None, Some(error)),
        }
    } else { (None, None, None) };
    let contact_sheet = Path::new(&file_path).with_file_name(format!(
        "{}-contact-sheet.jpg",
        Path::new(&file_path).file_stem().and_then(|name| name.to_str()).unwrap_or("creator-skill"),
    ));
    let contact_sheet_path = if let Some(path) = contact_sheet.to_str() {
        let sheet_rows = ((duration / 12.0).ceil() as u64).clamp(1, 100);
        let sheet_filter = format!("fps=0.5,scale=480:-2,tile=6x{sheet_rows}:padding=4:margin=4");
        match crate::ffmpeg_sidecar::run_ffmpeg(
            &app,
            &["-nostdin", "-v", "error", "-i", &file_path, "-vf", &sheet_filter, "-frames:v", "1", "-y", path],
        ).await {
            Ok(result) if result.status.success() && contact_sheet.is_file() => Some(path.to_string()),
            _ => None,
        }
    } else { None };
    let phone_preview_path = create_creator_skill_phone_preview(&app, &file_path, duration, max_preview_mb, width > height).await;
    Ok(CreatorSkillExportCheck {
        duration,
        width,
        height,
        has_audio,
        fully_decoded: decoded.status.success(),
        error: if decoded.status.success() { None } else { Some(String::from_utf8_lossy(&decoded.stderr).trim().to_string()) },
        integrated_lufs,
        true_peak_dbtp,
        audio_measurement_error,
        contact_sheet_path,
        stream_duration_delta_ms,
        stream_start_delta_ms,
        phone_preview_path,
    })
}

/// Generate a proxy file for a source video.
/// Supports trimmed proxy generation - only encodes the portion needed.
/// Uses intraframe-friendly codecs by default for fast seeking.
#[tauri::command]
pub async fn generate_proxy_file(
    app: AppHandle,
    source_path: String,
    source_id: String,
    width: u32,
    height: u32,
    codec: String,
    quality: String,
    trim_start: Option<f64>,
    trim_duration: Option<f64>,
) -> Result<ProxyGenerationResult, String> {
    let source = Path::new(&source_path);
    if !source.exists() {
        return Err("Source file does not exist".to_string());
    }

    let paths =
        storage::init_storage_dirs().map_err(|e| format!("Failed to get storage paths: {}", e))?;
    let proxy_dir = paths.temp.join("proxies");
    std::fs::create_dir_all(&proxy_dir)
        .map_err(|e| format!("Failed to create proxy dir: {}", e))?;

    // Include trim info in filename to differentiate trimmed proxies
    // Use milliseconds to prevent bucket collisions (match TypeScript format)
    let extension = if codec == "prores_proxy" {
        "mov"
    } else {
        "mp4"
    };
    let trim_suffix = match (trim_start, trim_duration) {
        (Some(start), Some(dur)) => format!(
            "_t{}_{}",
            (start * 1000.0).round() as i64,
            (dur * 1000.0).round() as i64
        ),
        (Some(start), None) => format!("_t{}", (start * 1000.0).round() as i64),
        _ => String::new(),
    };
    let proxy_path = proxy_dir.join(format!(
        "proxy_{}_{}x{}_{}{}.{}",
        source_id, width, height, codec, trim_suffix, extension
    ));

    // Check if valid proxy already exists
    if proxy_path.exists() {
        let proxy_path_str = proxy_path.to_string_lossy().to_string();
        // Validate by checking if FFmpeg can read it (has valid moov atom)
        let validate_output = crate::ffmpeg_sidecar::run_ffmpeg(
            &app,
            &["-i", &proxy_path_str, "-f", "null", "-t", "0.1", "-"],
        )
        .await;

        if let Ok(output) = validate_output {
            if output.status.success() {
                eprintln!(
                    "[generate_proxy_file] Using existing valid proxy: {}",
                    proxy_path_str
                );
                return Ok(ProxyGenerationResult {
                    proxy_path: proxy_path_str,
                });
            }
        }
        // Proxy is invalid, delete and regenerate
        eprintln!("[generate_proxy_file] Existing proxy invalid, regenerating");
        let _ = std::fs::remove_file(&proxy_path);
    }

    let scale_filter = format!(
        "scale=w={}:h={}:force_original_aspect_ratio=decrease",
        width, height
    );

    // Build FFmpeg args with optional trim
    let mut args = vec!["-y".to_string()];

    // Add seek BEFORE input for fast seeking (uses keyframes)
    if let Some(start) = trim_start {
        if start > 0.0 {
            args.extend(["-ss".to_string(), format!("{:.3}", start)]);
        }
    }

    args.extend(["-i".to_string(), source_path.clone()]);

    // Add duration limit AFTER input (web-demuxer has no sample limits)
    if let Some(duration) = trim_duration {
        if duration > 0.0 {
            args.extend(["-t".to_string(), format!("{:.3}", duration)]);
        }
    }

    args.extend(["-vf".to_string(), scale_filter]);

    if codec == "prores_proxy" {
        let qscale = match quality.as_str() {
            "high" => "7",
            "low" => "11",
            _ => "9",
        };
        args.extend([
            "-c:v".to_string(),
            "prores_ks".to_string(),
            "-profile:v".to_string(),
            "0".to_string(),
            "-pix_fmt".to_string(),
            "yuv422p10le".to_string(),
            "-qscale:v".to_string(),
            qscale.to_string(),
        ]);
    } else {
        // Use I-frame only H.264 for instant frame-accurate seeking
        // Every frame is a keyframe, so seeking to any frame requires decoding only 1-2 packets
        // This is how professional editors achieve instant scrubbing
        let (encoder, encoder_args) = if cfg!(target_os = "windows") {
            let crf = match quality.as_str() {
                "high" => "18",
                "low" => "26",
                _ => "22",
            };

            // Use software libx264 for I-frame only mode (NVENC doesn't support GOP=1)
            // I-frame only = instant seeking like ProRes
            (
                "libx264",
                vec![
                    "-preset".to_string(),
                    "ultrafast".to_string(), // Fast encoding
                    "-crf".to_string(),
                    crf.to_string(),
                    "-g".to_string(),
                    "1".to_string(), // Every frame is a keyframe
                    "-bf".to_string(),
                    "0".to_string(), // No B-frames
                    "-pix_fmt".to_string(),
                    "yuv420p".to_string(),
                ],
            )
        } else if cfg!(target_os = "macos") {
            // macOS - use I-frame only for instant seeking
            let crf = match quality.as_str() {
                "high" => "18",
                "low" => "26",
                _ => "22",
            };

            (
                "libx264",
                vec![
                    "-preset".to_string(),
                    "ultrafast".to_string(),
                    "-crf".to_string(),
                    crf.to_string(),
                    "-g".to_string(),
                    "1".to_string(), // Every frame is a keyframe
                    "-bf".to_string(),
                    "0".to_string(), // No B-frames
                    "-pix_fmt".to_string(),
                    "yuv420p".to_string(),
                ],
            )
        } else {
            // Linux - try VAAPI, fallback to software
            let crf = match quality.as_str() {
                "high" => "24",
                "low" => "30",
                _ => "28",
            };

            (
                "libx264",
                vec![
                    "-preset".to_string(),
                    "veryfast".to_string(),
                    "-crf".to_string(),
                    crf.to_string(),
                    "-g".to_string(),
                    "30".to_string(),
                    "-keyint_min".to_string(),
                    "30".to_string(),
                    "-pix_fmt".to_string(),
                    "yuv420p".to_string(),
                ],
            )
        };

        args.extend(["-c:v".to_string(), encoder.to_string()]);
        args.extend(encoder_args);
    }

    args.extend([
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        "128k".to_string(),
        "-movflags".to_string(),
        "+faststart".to_string(),
        proxy_path.to_string_lossy().to_string(),
    ]);

    eprintln!(
        "[generate_proxy_file] Generating proxy with args: {:?}",
        args
    );

    // Convert Vec<String> to Vec<&str> for the function call
    let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let output = crate::ffmpeg_sidecar::run_ffmpeg(&app, &args_refs).await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Proxy generation failed: {}", stderr));
    }

    eprintln!(
        "[generate_proxy_file] Proxy generated successfully: {}",
        proxy_path.display()
    );

    Ok(ProxyGenerationResult {
        proxy_path: proxy_path.to_string_lossy().to_string(),
    })
}

/// Checks if a file exists at the given path
///
/// # Arguments
/// * `path` - The file path to check
///
/// # Returns
/// True if the file exists, false otherwise
#[tauri::command]
pub async fn check_file_exists(path: String) -> Result<bool, String> {
    let path = crate::path_utils::normalize_local_fs_path(path);
    Ok(Path::new(&path).exists())
}

/// Validates a video file using FFmpeg
///
/// This function performs comprehensive validation including:
/// - File existence and size checks
/// - FFmpeg integrity validation
/// - Video metadata extraction
///
/// # Arguments
/// * `app` - The Tauri app handle
/// * `file_path` - Path to the video file to validate
///
/// # Returns
/// A VideoValidationResult containing validation status and metadata
#[tauri::command]
pub async fn validate_video_file(
    app: AppHandle,
    file_path: String,
) -> Result<VideoValidationResult, String> {
    println!(
        "[Rust Validation] validate_video_file called with path: {}",
        file_path
    );

    let video_path = Path::new(&file_path);

    // Check if file exists
    if !video_path.exists() {
        return Ok(VideoValidationResult {
            is_valid: false,
            error: Some("Video file does not exist".to_string()),
            duration: None,
            width: None,
            height: None,
            codec: None,
            file_size: None,
        });
    }

    // Check file size (should be greater than 0)
    let metadata = match std::fs::metadata(video_path) {
        Ok(meta) => meta,
        Err(e) => {
            return Ok(VideoValidationResult {
                is_valid: false,
                error: Some(format!("Failed to read file metadata: {}", e)),
                duration: None,
                width: None,
                height: None,
                codec: None,
                file_size: None,
            });
        }
    };

    let file_size = metadata.len();
    if file_size == 0 {
        return Ok(VideoValidationResult {
            is_valid: false,
            error: Some("Video file is empty".to_string()),
            duration: None,
            width: None,
            height: None,
            codec: None,
            file_size: Some(0),
        });
    }

    // Use FFmpeg to validate video file integrity
    let output = match crate::ffmpeg_sidecar::run_ffmpeg(
        &app,
        &[
            "-i",
            &file_path,
            "-f",
            "null",
            "-t",
            "1", // Only validate first second to be fast
            "-",
        ],
    )
    .await
    {
        Ok(output) => output,
        Err(e) => {
            return Ok(VideoValidationResult {
                is_valid: false,
                error: Some(format!("Failed to run FFmpeg validation: {}", e)),
                duration: None,
                width: None,
                height: None,
                codec: None,
                file_size: Some(file_size),
            });
        }
    };

    // Parse FFmpeg output for analysis
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Check if FFmpeg successfully processed the file
    if !output.status.success() {
        let error_msg = if stderr.contains("Invalid data found") {
            "Video file contains invalid data or corruption"
        } else if stderr.contains("moov atom not found") {
            "Video file is incomplete or corrupted - missing movie atom"
        } else if stderr.contains("Invalid argument") {
            "Video file format is not supported"
        } else if stderr.contains("No such file or directory") {
            "Video file not found"
        } else if stderr.contains("Permission denied") {
            "Permission denied accessing video file"
        } else {
            &format!("FFmpeg validation failed: {}", stderr)
        };

        return Ok(VideoValidationResult {
            is_valid: false,
            error: Some(error_msg.to_string()),
            duration: None,
            width: None,
            height: None,
            codec: None,
            file_size: Some(file_size),
        });
    }

    // Check for critical errors even when exit code is 0
    if stderr.contains("Invalid data found") && stderr.contains("corrupt") {
        return Ok(VideoValidationResult {
            is_valid: false,
            error: Some("Video file contains corruption".to_string()),
            duration: None,
            width: None,
            height: None,
            codec: None,
            file_size: Some(file_size),
        });
    }

    // Try to parse video information (optional - don't fail if we can't parse)
    let duration = extract_duration_from_ffmpeg_output(&stderr);
    let video_info = parse_video_info_from_ffmpeg_output(&stderr);

    match video_info {
        Ok(info) => {
            // Check for reasonable video dimensions
            if info.width == 0 || info.height == 0 {
                return Ok(VideoValidationResult {
                    is_valid: false,
                    error: Some("Invalid video dimensions (0x0)".to_string()),
                    duration,
                    width: Some(info.width),
                    height: Some(info.height),
                    codec: Some(info.codec),
                    file_size: Some(file_size),
                });
            }

            // Video is valid with parsed info
            Ok(VideoValidationResult {
                is_valid: true,
                error: None,
                duration,
                width: Some(info.width),
                height: Some(info.height),
                codec: Some(info.codec),
                file_size: Some(file_size),
            })
        }
        Err(_) => {
            // If we can't parse video info but FFmpeg succeeded, consider it valid
            // This can happen for some video formats or with minimal validation
            println!(
                "[Validation] Could not parse detailed video info, but FFmpeg validation passed"
            );
            Ok(VideoValidationResult {
                is_valid: true,
                error: None,
                duration,
                width: None,
                height: None,
                codec: None,
                file_size: Some(file_size),
            })
        }
    }
}
