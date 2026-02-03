use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

use crate::ffmpeg_utils::{
    extract_duration_from_ffmpeg_output,
    parse_video_info_from_ffmpeg_output,
    VideoValidationResult
};
use crate::storage;

#[derive(serde::Serialize)]
pub struct ProxyGenerationResult {
    pub proxy_path: String,
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

    let paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;
    let proxy_dir = paths.temp.join("proxies");
    std::fs::create_dir_all(&proxy_dir)
        .map_err(|e| format!("Failed to create proxy dir: {}", e))?;

    // Include trim info in filename to differentiate trimmed proxies
    // Use milliseconds to prevent bucket collisions (match TypeScript format)
    let extension = if codec == "prores_proxy" { "mov" } else { "mp4" };
    let trim_suffix = match (trim_start, trim_duration) {
        (Some(start), Some(dur)) => format!("_t{}_{}", (start * 1000.0).round() as i64, (dur * 1000.0).round() as i64),
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
        let validate_output = app.shell()
            .sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args(["-i", &proxy_path_str, "-f", "null", "-t", "0.1", "-"])
            .output()
            .await;
        
        if let Ok(output) = validate_output {
            if output.status.success() {
                eprintln!("[generate_proxy_file] Using existing valid proxy: {}", proxy_path_str);
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
    
    // Add duration limit AFTER input
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
            "-c:v".to_string(), "prores_ks".to_string(),
            "-profile:v".to_string(), "0".to_string(),
            "-pix_fmt".to_string(), "yuv422p10le".to_string(),
            "-qscale:v".to_string(), qscale.to_string(),
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
            ("libx264", vec![
                "-preset".to_string(), "ultrafast".to_string(), // Fast encoding
                "-crf".to_string(), crf.to_string(),
                "-g".to_string(), "1".to_string(), // Every frame is a keyframe
                "-bf".to_string(), "0".to_string(), // No B-frames
                "-pix_fmt".to_string(), "yuv420p".to_string(),
            ])
        } else if cfg!(target_os = "macos") {
            // macOS - use I-frame only for instant seeking
            let crf = match quality.as_str() {
                "high" => "18",
                "low" => "26",
                _ => "22",
            };
            
            ("libx264", vec![
                "-preset".to_string(), "ultrafast".to_string(),
                "-crf".to_string(), crf.to_string(),
                "-g".to_string(), "1".to_string(), // Every frame is a keyframe
                "-bf".to_string(), "0".to_string(), // No B-frames
                "-pix_fmt".to_string(), "yuv420p".to_string(),
            ])
        } else {
            // Linux - try VAAPI, fallback to software
            let crf = match quality.as_str() {
                "high" => "24",
                "low" => "30",
                _ => "28",
            };
            
            ("libx264", vec![
                "-preset".to_string(), "veryfast".to_string(),
                "-crf".to_string(), crf.to_string(),
                "-g".to_string(), "30".to_string(),
                "-keyint_min".to_string(), "30".to_string(),
                "-pix_fmt".to_string(), "yuv420p".to_string(),
            ])
        };
        
        args.extend(["-c:v".to_string(), encoder.to_string()]);
        args.extend(encoder_args);
    }

    args.extend([
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "128k".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        proxy_path.to_string_lossy().to_string(),
    ]);

    eprintln!("[generate_proxy_file] Generating proxy with args: {:?}", args);

    let output = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Proxy generation failed: {}", stderr));
    }

    eprintln!("[generate_proxy_file] Proxy generated successfully: {}", proxy_path.display());

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
pub async fn validate_video_file(app: AppHandle, file_path: String) -> Result<VideoValidationResult, String> {
    println!("[Rust Validation] validate_video_file called with path: {}", file_path);

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
    let shell = app.shell();

    let output = match shell.sidecar("ffmpeg") {
        Ok(ffmpeg) => {
            match ffmpeg.args([
                "-i", &file_path,
                "-f", "null",
                "-t", "1",  // Only validate first second to be fast
                "-"
            ]).output().await {
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
            }
        }
        Err(e) => {
            return Ok(VideoValidationResult {
                is_valid: false,
                error: Some(format!("Failed to access FFmpeg: {}", e)),
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
            println!("[Validation] Could not parse detailed video info, but FFmpeg validation passed");
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