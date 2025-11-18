use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::Emitter;
use crate::storage;
use crate::ffmpeg_utils::{get_video_duration_sync, parse_video_info_from_ffmpeg_output};
use std::io::Write;
use tauri_plugin_shell::ShellExt;

// Subtitle settings structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleSettings {
    pub enabled: bool,
    pub font_family: String,
    pub font_size: f32,
    pub font_weight: u32,
    pub text_color: String,
    pub background_color: String,
    pub background_enabled: bool,
    pub outline_width: f32,
    pub outline_color: String,
    pub shadow_offset_x: f32,
    pub shadow_offset_y: f32,
    pub shadow_blur: f32,
    pub shadow_color: String,
    pub position: String,
    pub position_percentage: f32,
    pub max_width: f32,
    pub animation_style: String,
    pub line_height: f32,
    pub letter_spacing: f32,
    pub text_align: String,
    pub text_offset_x: f32,
    pub text_offset_y: f32,
    pub padding: f32,
    pub border_radius: f32,
    pub word_spacing: f32,
}

// Word info structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordInfo {
    pub word: String,
    pub start: f64,
    pub end: f64,
    pub confidence: Option<f64>,
}

// Whisper segment structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperSegment {
    pub id: i64,
    pub start: f64,
    pub end: f64,
    pub text: String,
    pub words: Option<Vec<WordInfo>>,
}

// Clip building progress tracking structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipBuildProgress {
    pub clip_id: String,
    pub project_id: String,
    pub progress: f64,
    pub stage: String,
    pub message: String,
    pub error: Option<String>,
}

// Clip build result structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipBuildResult {
    pub clip_id: String,
    pub project_id: String,
    pub success: bool,
    pub output_path: Option<String>,
    pub thumbnail_path: Option<String>,
    pub duration: Option<f64>,
    pub file_size: Option<u64>,
    pub error: Option<String>,
}

// Active clip builds tracking
static ACTIVE_CLIP_BUILDS: Lazy<Arc<Mutex<HashMap<String, bool>>>> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Aspect ratio structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AspectRatio {
    pub width: f32,
    pub height: f32,
}

// Build clip from segments using FFmpeg
#[tauri::command]
pub async fn build_clip_from_segments(
    app: tauri::AppHandle,
    project_id: String,
    clip_id: String,
    video_path: String,
    segments: Vec<serde_json::Value>,
    subtitle_settings: Option<SubtitleSettings>,
    transcript_words: Option<Vec<WordInfo>>,
    transcript_segments: Option<Vec<WhisperSegment>>,
    max_words: Option<usize>,
    aspect_ratio: Option<AspectRatio>
) -> Result<(), String> {

    println!("[Rust] build_clip_from_segments called with:");
    println!("[Rust]   project_id: {}", project_id);
    println!("[Rust]   clip_id: {}", clip_id);
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   segments count: {}", segments.len());
    println!("[Rust]   subtitles enabled: {}", subtitle_settings.as_ref().map(|s| s.enabled).unwrap_or(false));
    println!("[Rust]   max words: {}", max_words.unwrap_or(0));

    // Check if clip is already being built
    {
        let mut active_builds = ACTIVE_CLIP_BUILDS.lock().unwrap();
        if active_builds.contains_key(&clip_id) {
            return Err(format!("Clip {} is already being built", clip_id));
        }
        active_builds.insert(clip_id.clone(), true);
    }

    // Clone app handle for use in async block
    let app_clone = app.clone();
    let clip_id_clone = clip_id.clone();
    let project_id_clone = project_id.clone();
    let video_path_clone = video_path.clone();
    let segments_clone = segments.clone();
    let subtitle_settings_clone = subtitle_settings.clone();
    let transcript_words_clone = transcript_words.clone();
    let transcript_segments_clone = transcript_segments.clone();

    // Send initial progress
    let _ = app.emit("clip-build-progress", ClipBuildProgress {
        clip_id: clip_id.clone(),
        project_id: project_id.clone(),
        progress: 0.0,
        stage: "initializing".to_string(),
        message: "Starting clip build...".to_string(),
        error: None,
    });

    // Use tokio::spawn for background processing (following the download pattern)
    let _ = tokio::spawn(async move {
        println!("[Rust] Async task started for clip build: {}", clip_id_clone);

        let build_result = match build_clip_internal_simple(
            &app_clone,
            &project_id_clone,
            &clip_id_clone,
            &video_path_clone,
            &segments_clone,
            subtitle_settings_clone,
            transcript_words_clone,
            transcript_segments_clone,
            max_words,
            aspect_ratio
        ).await {
            Ok(result) => {
                println!("[Rust] Clip build completed successfully for: {}", clip_id_clone);
                result
            },
            Err(e) => {
                println!("[Rust] Clip build failed with error: {}", e);
                ClipBuildResult {
                    clip_id: clip_id_clone.clone(),
                    project_id: project_id_clone.clone(),
                    success: false,
                    output_path: None,
                    thumbnail_path: None,
                    duration: None,
                    file_size: None,
                    error: Some(e),
                }
            }
        };

        // Clean up active build tracking
        {
            let mut active_builds = ACTIVE_CLIP_BUILDS.lock().unwrap();
            active_builds.remove(&clip_id_clone);
            println!("[Rust] Removed from active builds: {}", clip_id_clone);
        }

        // Emit completion event
        println!("[Rust] About to emit clip-build-complete event...");
        let emit_result = app_clone.emit("clip-build-complete", &build_result);
        match emit_result {
            Ok(_) => println!("[Rust] clip-build-complete event emitted successfully"),
            Err(e) => println!("[Rust] Failed to emit clip-build-complete event: {}", e),
        }
    });

    Ok(())
}

// Simplified internal clip building implementation (without progress callbacks)
async fn build_clip_internal_simple(
    app: &tauri::AppHandle,
    project_id: &str,
    clip_id: &str,
    video_path: &str,
    segments: &[serde_json::Value],
    subtitle_settings: Option<SubtitleSettings>,
    transcript_words: Option<Vec<WordInfo>>,
    _transcript_segments: Option<Vec<WhisperSegment>>,
    max_words: Option<usize>,
    aspect_ratio: Option<AspectRatio>
) -> Result<ClipBuildResult, String> {

    // Emit progress
    let _ = app.emit("clip-build-progress", ClipBuildProgress {
        clip_id: clip_id.to_string(),
        project_id: project_id.to_string(),
        progress: 0.0,
        stage: "initializing".to_string(),
        message: "Preparing to build clip...".to_string(),
        error: None,
    });

    // Get storage paths
    let paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    // Create project-specific clips directory in the clips folder
    let clips_dir = paths.clips.join(format!("project_{}", project_id));
    std::fs::create_dir_all(&clips_dir)
        .map_err(|e| format!("Failed to create clips directory: {}", e))?;

    // Output file path
    let output_filename = format!("clip_{}.mp4", clip_id);
    let output_path = clips_dir.join(&output_filename);

    // Get video dimensions for proper subtitle rendering
    let video_info = get_video_info(app, video_path).await?;
    println!("[Rust] Video dimensions: {}x{}", video_info.width, video_info.height);

    // Generate subtitle file if needed
    let subtitle_file = if let (Some(settings), Some(words)) = (&subtitle_settings, &transcript_words) {
        if settings.enabled {
            let sub_path = clips_dir.join(format!("clip_{}.ass", clip_id));
            generate_ass_file(
                settings, 
                words, 
                segments, 
                &sub_path, 
                max_words.unwrap_or(4), 
                aspect_ratio.as_ref(),
                video_info.width,
                video_info.height
            ).map_err(|e| format!("Failed to generate subtitle file: {}", e))?;
            Some(sub_path)
        } else {
            None
        }
    } else {
        None
    };

    // Emit building progress
    let _ = app.emit("clip-build-progress", ClipBuildProgress {
        clip_id: clip_id.to_string(),
        project_id: project_id.to_string(),
        progress: 10.0,
        stage: "building".to_string(),
        message: "Building clip from segments...".to_string(),
        error: None,
    });

    // Build clip based on segments
    if segments.len() == 1 {
        // Single segment
        println!("[Rust] Building single-segment clip");
        build_single_segment_clip_simple(
            app,
            video_path,
            &output_path,
            &segments[0],
            subtitle_file.as_deref()
        ).await?
    } else {
        // Multiple segments
        println!("[Rust] Building multi-segment clip with {} segments", segments.len());
        build_multi_segment_clip_simple(
            app,
            video_path,
            &output_path,
            segments,
            subtitle_file.as_deref()
        ).await?
    }

    // Clean up subtitle file
    if let Some(sub_path) = subtitle_file {
        let _ = std::fs::remove_file(sub_path);
    }

    // Emit finalizing progress
    let _ = app.emit("clip-build-progress", ClipBuildProgress {
        clip_id: clip_id.to_string(),
        project_id: project_id.to_string(),
        progress: 90.0,
        stage: "finalizing".to_string(),
        message: "Finalizing clip...".to_string(),
        error: None,
    });

    // Generate thumbnail
    println!("[Rust] About to generate thumbnail for clip...");
    let thumbnail_path = generate_clip_thumbnail_simple(app, &output_path, clip_id).await?;
    println!("[Rust] Thumbnail generation completed");

    // Get file metadata
    println!("[Rust] Getting file metadata...");
    let metadata = std::fs::metadata(&output_path)
        .map_err(|e| format!("Failed to get output file metadata: {}", e))?;
    let file_size = Some(metadata.len());
    println!("[Rust] File metadata obtained: {} bytes", file_size.unwrap_or(0));

    // Get clip duration
    println!("[Rust] Getting clip duration...");
    let duration = get_video_duration_sync(app, output_path.to_str().ok_or("Invalid output path")?).await.ok();
    println!("[Rust] Clip duration obtained: {:?}", duration);

    // Emit completion progress
    println!("[Rust] Emitting completion progress event...");
    let result = ClipBuildResult {
        clip_id: clip_id.to_string(),
        project_id: project_id.to_string(),
        success: true,
        output_path: Some(output_path.to_string_lossy().to_string()),
        thumbnail_path: thumbnail_path.map(|p| p.to_string_lossy().to_string()),
        duration,
        file_size,
        error: None,
    };

    let _ = app.emit("clip-build-progress", ClipBuildProgress {
        clip_id: clip_id.to_string(),
        project_id: project_id.to_string(),
        progress: 100.0,
        stage: "completed".to_string(),
        message: "Clip built successfully!".to_string(),
        error: None,
    });

    Ok(result)
}

// Cancel clip build
#[tauri::command]
pub async fn cancel_clip_build(clip_id: String) -> Result<bool, String> {
    println!("[Rust] Canceling clip build: {}", clip_id);
    let mut active_builds = ACTIVE_CLIP_BUILDS.lock().unwrap();
    if active_builds.remove(&clip_id).is_some() {
        Ok(true)
    } else {
        Ok(false)
    }
}

// Check if clip build is active
#[tauri::command]
pub async fn is_clip_build_active(clip_id: String) -> Result<bool, String> {
    let active_builds = ACTIVE_CLIP_BUILDS.lock().unwrap();
    Ok(active_builds.contains_key(&clip_id))
}

// Simplified build single-segment clip
async fn build_single_segment_clip_simple(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    subtitle_path: Option<&std::path::Path>
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    let shell = app.shell();
    let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
    let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
    let duration = end_time - start_time;

    println!("[Rust] Extracting single segment: {:.2}s - {:.2}s (duration: {:.2}s)", start_time, end_time, duration);

    // Convert subtitle path to string if present (handling Windows paths)
    let sub_arg = if let Some(path) = subtitle_path {
         let path_str = path.to_string_lossy().replace("\\", "/").replace(":", "\\:");
         format!("ass='{}'", path_str)
    } else {
        String::new()
    };

    let mut args = vec![
        "-ss".to_string(), format!("{:.3}", start_time),
        "-i".to_string(), video_path.to_string(),
        "-t".to_string(), format!("{:.3}", duration),
    ];

    if !sub_arg.is_empty() {
        // Re-encode with subtitles - HIGH QUALITY SETTINGS
        args.push("-vf".to_string());
        args.push(sub_arg);
        args.push("-c:v".to_string());
        args.push("libx264".to_string());
        args.push("-c:a".to_string());
        args.push("aac".to_string()); // Re-encode audio for better compatibility
        args.push("-b:a".to_string());
        args.push("192k".to_string()); // High quality audio bitrate
        // High quality video encoding settings
        args.push("-preset".to_string());
        args.push("slow".to_string()); // Slower but better quality
        args.push("-crf".to_string());
        args.push("18".to_string()); // Lower CRF = higher quality (18 is visually lossless)
        args.push("-pix_fmt".to_string());
        args.push("yuv420p".to_string()); // Ensure compatibility
        args.push("-movflags".to_string());
        args.push("+faststart".to_string()); // Optimize for streaming/web playback
    } else {
        // Copy stream (fast)
        args.push("-c".to_string());
        args.push("copy".to_string());
    }

    args.push("-avoid_negative_ts".to_string());
    args.push("1".to_string());
    args.push("-y".to_string());
    args.push(output_path.to_string_lossy().to_string());

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg extraction failed: {}", stderr));
    }

    Ok(())
}

// Simplified build multi-segment clip
async fn build_multi_segment_clip_simple(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segments: &[serde_json::Value],
    subtitle_path: Option<&std::path::Path>
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    let shell = app.shell();

    // Get storage paths for temporary files
    let paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let temp_dir = paths.temp.join(format!("clip_segments_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    println!("[Rust] Building {} segments using concat demuxer approach", segments.len());

    // Create temporary segment files
    let mut segment_files = Vec::new();
    for (i, segment) in segments.iter().enumerate() {
        let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
        let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
        let duration = end_time - start_time;

        let segment_file = temp_dir.join(format!("segment_{:03}.mp4", i));

        // Extract segment using simple copy mode
        let output = shell.sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args([
                "-ss", &format!("{:.3}", start_time),
                "-i", video_path,
                "-t", &format!("{:.3}", duration),
                "-c", "copy",  // Copy streams without re-encoding
                "-avoid_negative_ts", "1",
                "-y",
                segment_file.to_str().ok_or("Invalid segment path")?,
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to extract segment {}: {}", i, e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to extract segment {}: {}", i, stderr));
        }

        segment_files.push(segment_file.clone());
    }

    // Create concat list file
    let concat_file = temp_dir.join("concat_list.txt");
    let mut concat_content = String::new();
    for segment_file in &segment_files {
        concat_content.push_str(&format!("file '{}'\n", segment_file.display()));
    }

    std::fs::write(&concat_file, concat_content)
        .map_err(|e| format!("Failed to write concat file: {}", e))?;

    // Concatenate using concat demuxer
    let concat_output_path = if subtitle_path.is_some() {
        temp_dir.join("concat_output.mp4")
    } else {
        output_path.to_path_buf()
    };

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file.to_str().ok_or("Invalid concat file path")?,
            "-c", "copy",  // Copy streams without re-encoding
            "-avoid_negative_ts", "1",
            "-y",
            concat_output_path.to_str().ok_or("Invalid output path")?,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to concatenate segments: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg concatenation failed: {}", stderr));
    }

    // If subtitles are present, burn them now
    if let Some(sub_path) = subtitle_path {
        println!("[Rust] Burning subtitles with high quality settings...");
        
        let sub_arg = {
             let path_str = sub_path.to_string_lossy().replace("\\", "/").replace(":", "\\:");
             format!("ass='{}'", path_str)
        };

        let output = shell.sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args([
                "-i", concat_output_path.to_str().ok_or("Invalid concat output path")?,
                "-vf", &sub_arg,
                "-c:v", "libx264",
                "-c:a", "aac",
                "-b:a", "192k",
                "-preset", "slow", // High quality preset
                "-crf", "18", // Visually lossless quality
                "-pix_fmt", "yuv420p", // Ensure compatibility
                "-movflags", "+faststart", // Optimize for streaming
                "-y",
                output_path.to_str().ok_or("Invalid output path")?,
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to burn subtitles: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("FFmpeg subtitle burning failed: {}", stderr));
        }
    }

    // Clean up temporary files
    let _ = std::fs::remove_dir_all(&temp_dir);
    println!("[Rust] Concatenation successful, cleaned up temp files");

    Ok(())
}

async fn generate_clip_thumbnail_simple(
    app: &tauri::AppHandle,
    clip_path: &std::path::Path,
    clip_id: &str
) -> Result<Option<std::path::PathBuf>, String> {
    use tauri_plugin_shell::ShellExt;
    let shell = app.shell();

    let paths = storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let thumbnail_filename = format!("clip_{}_thumb.jpg", clip_id);
    let thumbnail_path = paths.thumbnails.join(thumbnail_filename);

    println!("[Rust] Generating thumbnail for clip: {}", clip_path.display());

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", clip_path.to_str().ok_or("Invalid clip path")?,
            "-ss", "00:00:01",  // Seek to 1 second
            "-vframes", "1",
            "-vf", "scale=320:-1",
            "-y",
            thumbnail_path.to_str().ok_or("Invalid thumbnail path")?,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg for thumbnail: {}", e))?;

    if output.status.success() {
        Ok(Some(thumbnail_path))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("[Rust] Failed to generate thumbnail: {}", stderr);
        Ok(None)
    }
}

// Helper function to get video info with improved parsing
async fn get_video_info(app: &tauri::AppHandle, video_path: &str) -> Result<crate::ffmpeg_utils::VideoInfo, String> {
    let shell = app.shell();
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args([
            "-i", video_path,
            "-f", "null",
            "-",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg info: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    
    // Try the standard parser first
    if let Ok(info) = parse_video_info_from_ffmpeg_output(&stderr) {
        return Ok(info);
    }
    
    // If that fails, try alternative parsing
    println!("[Rust] Standard parsing failed, trying alternative method...");
    parse_video_info_alternative(&stderr)
}

// Alternative video info parser that's more flexible
fn parse_video_info_alternative(output: &str) -> Result<crate::ffmpeg_utils::VideoInfo, String> {
    use regex::Regex;
    
    let mut width = None;
    let mut height = None;
    let mut codec = None;
    
    // Look for resolution pattern: 1920x1080 or 1280x720, etc.
    let res_regex = Regex::new(r"(\d{3,5})x(\d{3,5})").map_err(|e| format!("Regex error: {}", e))?;
    
    for line in output.lines() {
        if line.contains("Video:") {
            println!("[Rust] Video line: {}", line);
            
            // Extract codec (first word after "Video: ")
            if let Some(codec_start) = line.find("Video: ") {
                let codec_part = &line[codec_start + 7..];
                if let Some(space_pos) = codec_part.find(|c: char| c.is_whitespace() || c == ',') {
                    codec = Some(codec_part[..space_pos].trim().to_string());
                }
            }
            
            // Extract resolution using regex
            if let Some(captures) = res_regex.captures(line) {
                width = captures.get(1).and_then(|m| m.as_str().parse().ok());
                height = captures.get(2).and_then(|m| m.as_str().parse().ok());
            }
            
            if width.is_some() && height.is_some() && codec.is_some() {
                break;
            }
        }
    }
    
    match (width, height, &codec) {
        (Some(w), Some(h), Some(c)) => {
            println!("[Rust] Parsed video info: {}x{}, codec: {}", w, h, c);
            Ok(crate::ffmpeg_utils::VideoInfo { width: w, height: h, codec: c.clone() })
        },
        _ => {
            println!("[Rust] Failed to parse - width: {:?}, height: {:?}, codec: {:?}", width, height, codec);
            Err("Could not parse video dimensions or codec from FFmpeg output".to_string())
        }
    }
}

// Helper to generate ASS file content
fn generate_ass_file(
    settings: &SubtitleSettings,
    all_words: &[WordInfo],
    clip_segments: &[serde_json::Value],
    output_path: &std::path::Path,
    max_words: usize,
    aspect_ratio: Option<&AspectRatio>,
    video_width: u32,
    video_height: u32
) -> Result<(), String> {
    let mut file = std::fs::File::create(output_path)
        .map_err(|e| format!("Failed to create subtitle file: {}", e))?;

    // Generate ASS header with actual video dimensions
    writeln!(file, "[Script Info]").unwrap();
    writeln!(file, "ScriptType: v4.00+").unwrap();
    writeln!(file, "PlayResX: {}", video_width).unwrap();
    writeln!(file, "PlayResY: {}", video_height).unwrap();
    writeln!(file, "WrapStyle: 1").unwrap(); // Word wrapping
    writeln!(file, "").unwrap();

    // Generate Style
    writeln!(file, "[V4+ Styles]").unwrap();
    writeln!(file, "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding").unwrap();

    // Convert colors (Hex #RRGGBB to &HAABBGGRR with alpha)
    // ASS format: &HAABBGGRR where AA is alpha (00=opaque, FF=transparent)
    let convert_color = |hex: &str| -> String {
        let hex = hex.trim_start_matches('#');
        if hex.len() >= 6 {
            let r = &hex[0..2];
            let g = &hex[2..4];
            let b = &hex[4..6];
            // ASS uses BGR order with alpha prefix (00 = fully opaque)
            format!("&H00{}{}{}&", b, g, r)
        } else {
            "&H00FFFFFF&".to_string()
        }
    };

    let primary_color = convert_color(&settings.text_color);
    let outline_color = convert_color(&settings.outline_color);
    let back_color = convert_color(&settings.background_color);

    println!("[Rust] Subtitle colors - Text: {}, Outline: {}, Background: {}", 
        settings.text_color, settings.outline_color, settings.background_color);
    println!("[Rust] ASS colors - Primary: {}, Outline: {}", primary_color, outline_color);

    // Calculate aspect ratio scaling (matches VideoPlayer.vue logic)
    let aspect_ratio_value = if let Some(ar) = aspect_ratio {
        ar.width / ar.height
    } else {
        16.0 / 9.0 // Default to 16:9
    };

    let font_size_scale = if aspect_ratio_value <= 0.9 {
        0.65 // Vertical formats (9:16, 4:5)
    } else if aspect_ratio_value > 0.9 && aspect_ratio_value <= 1.1 {
        0.78 // Square format (1:1)
    } else {
        1.0 // Wide formats (16:9, 21:9)
    };

    let adjusted_font_size = (settings.font_size * font_size_scale).round();
    let adjusted_outline_width = settings.outline_width * font_size_scale;
    let adjusted_shadow = settings.shadow_blur * font_size_scale;
    let adjusted_letter_spacing = settings.letter_spacing * font_size_scale;

    println!("[Rust] Font size: {} -> {} (scale: {})", settings.font_size, adjusted_font_size, font_size_scale);

    // Alignment: 1=Left, 2=Center, 3=Right (Subtitles usually bottom, so 1,2,3 for bottom; 4,5,6 for middle; 7,8,9 for top)
    let alignment = match settings.position.as_str() {
        "top" => 8,
        "middle" => 5,
        "bottom" => 2,
        _ => 2,
    };

    // Calculate MarginV based on positionPercentage and actual video height
    let margin_v = if settings.position == "bottom" {
        (video_height as f32 * (1.0 - settings.position_percentage / 100.0)) as i32
    } else if settings.position == "top" {
         (video_height as f32 * (settings.position_percentage / 100.0)) as i32
    } else {
        0
    };

    // Determine bold flag (ASS uses -1 for bold, 0 for normal)
    let bold = if settings.font_weight >= 700 { -1 } else { 0 };

    // ASS Style format:
    // Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, 
    // Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, 
    // BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
    writeln!(file, "Style: Default,{},{},{},{},{},{},{},0,0,0,100,100,{},0,1,{},{},{},10,10,{},1",
        settings.font_family,
        adjusted_font_size,
        primary_color,
        primary_color, // SecondaryColour (for karaoke, use same as primary)
        outline_color,
        if settings.background_enabled { back_color } else { "&H00000000&".to_string() },
        bold,
        adjusted_letter_spacing, // Spacing parameter
        adjusted_outline_width,
        adjusted_shadow,
        alignment,
        margin_v
    ).unwrap();

    writeln!(file, "").unwrap();
    writeln!(file, "[Events]").unwrap();
    writeln!(file, "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text").unwrap();

    // 1. Flatten words relative to clip timeline
    #[derive(Clone, Debug)]
    struct ClipWord {
        word: String,
        start: f64,
        end: f64,
    }

    let mut clip_timeline_words: Vec<ClipWord> = Vec::new();
    let mut current_clip_time = 0.0;

    for clip_segment in clip_segments {
        let clip_seg_start = clip_segment["start_time"].as_f64().unwrap_or(0.0);
        let clip_seg_end = clip_segment["end_time"].as_f64().unwrap_or(0.0);
        let clip_seg_duration = clip_seg_end - clip_seg_start;

        for word in all_words {
            // Filter words within this segment
            // Add buffer to catch boundary words
            if word.start >= clip_seg_start - 0.1 && word.end <= clip_seg_end + 0.1 {
                // Calculate relative timing
                let start_rel = word.start - clip_seg_start + current_clip_time;
                let end_rel = word.end - clip_seg_start + current_clip_time;
                
                clip_timeline_words.push(ClipWord {
                    word: word.word.clone(),
                    start: start_rel,
                    end: end_rel,
                });
            }
        }
        current_clip_time += clip_seg_duration;
    }

    // Sort by start time just in case
    clip_timeline_words.sort_by(|a, b| a.start.partial_cmp(&b.start).unwrap_or(std::cmp::Ordering::Equal));

    if clip_timeline_words.is_empty() {
        return Ok(());
    }

    // 2. Group words into chunks (pages)
    let chunks: Vec<&[ClipWord]> = clip_timeline_words.chunks(max_words).collect();

    // 3. Generate events for each chunk
    for chunk in chunks {
        if chunk.is_empty() { continue; }

        // Determine chunk visibility duration
        // The chunk is visible from the start of its first word
        // until the start of the first word of the NEXT chunk (or end of clip for last chunk)
        let _chunk_start_time = chunk.first().unwrap().start;
        
        // Find the end time: it's the start of the next word AFTER this chunk, or the end of this chunk's last word if no next word
        // Actually, the frontend logic says: "If no word is currently being spoken, find the next upcoming word"
        // So basically, this chunk stays active until the next chunk becomes active.
        // We can look ahead to the next chunk in the loop? 
        // But we are iterating chunks.
        
        // Let's iterate with index to peek ahead
    }

    let chunk_count = (clip_timeline_words.len() + max_words - 1) / max_words;
    
    for i in 0..chunk_count {
        let start_idx = i * max_words;
        let end_idx = std::cmp::min(start_idx + max_words, clip_timeline_words.len());
        let chunk = &clip_timeline_words[start_idx..end_idx];
        
        if chunk.is_empty() { continue; }

        // Visibility start: Start of first word
        // Or should it be the end of the previous chunk's last word?
        // Frontend: "currentWordIndex" logic finds word at current time.
        // If time is between chunks (gap), it finds "next upcoming word".
        // So if we are in gap between Chunk 0 and Chunk 1, Chunk 1 is active?
        // "If currentWordIndex == -1 (gap), find next upcoming word." -> Chunk 1.
        // So Chunk 1 starts becoming visible immediately after Chunk 0's last word ends?
        // Wait, no. If gap is huge, we probably don't want subtitles to switch early.
        // But let's stick to "Next upcoming word" logic.
        // So yes, immediately after Chunk 0 ends, Chunk 1 becomes active (previewing the text).
        
        // However, for the FIRST chunk, it should probably start at 0.0 (or clip start) if it's the first thing.
        // Let's assume: 
        // Chunk Start Time = (Previous Chunk Last Word End) OR (0.0 if first chunk)
        // Chunk End Time = (This Chunk Last Word End)
        
        // Wait, if we use "next upcoming word" logic:
        // Gap between C0_End and C1_Start: C1 is active.
        // So C1 starts at C0_End.
        // C0 ends at C0_End (last word end).
        
        // Let's refine:
        // Chunk 0 Start: 0.0 (Clip start) - To catch intro silence? Or C0.first.start?
        // Frontend: `visibleWords` shows filtering. If time < C0.first.start, next word is C0.first -> C0 active.
        // So C0 is active from 0.0.
        
        // Chunk i Start: If i==0 -> 0.0. Else -> Chunk[i-1].last.end.
        // Chunk i End: Chunk[i].last.end. 
        // (And the gap after C[i] is covered by C[i+1] starting at C[i].end)
        
        let chunk_visible_start = if i == 0 {
            0.0
        } else {
            clip_timeline_words[start_idx - 1].end
        };
        
        let chunk_visible_end = chunk.last().unwrap().end;
        
        // Now we need to generate events for each "state" within this chunk visibility.
        // States are defined by the word boundaries within the chunk.
        // Transitions happen at: word.start, word.end.
        
        // We have a timeline of points: chunk_visible_start, w0.start, w0.end, w1.start, w1.end... chunk_visible_end.
        // Sort and deduplicate these points.
        let mut points = Vec::new();
        points.push(chunk_visible_start);
        for word in chunk {
            points.push(word.start);
            points.push(word.end);
        }
        points.push(chunk_visible_end);
        points.sort_by(|a, b| a.partial_cmp(b).unwrap());
        points.dedup();
        
        // Iterate intervals
        for j in 0..points.len()-1 {
            let t_start = points[j];
            let t_end = points[j+1];
            
            if t_end - t_start < 0.01 { continue; } // Skip tiny intervals
            
            // Determine active word in this interval
            // A word is active if t_mid is inside [word.start, word.end]
            let t_mid = (t_start + t_end) / 2.0;
            let active_word_idx = chunk.iter().position(|w| t_mid >= w.start && t_mid <= w.end);
            
            // Build text line
            // Words joined by spaces (or \\N for newlines if we wanted, but logic assumes single line/wrap)
            let mut text_parts = Vec::new();
            
            for (k, word) in chunk.iter().enumerate() {
                if Some(k) == active_word_idx {
                    // Active word: Scale up
                    text_parts.push(format!("{{\\fscx115\\fscy115}}{}{{\\fscx100\\fscy100}}", word.word));
                } else {
                    // Normal word
                    text_parts.push(word.word.clone());
                }
            }
            
            let line_text = text_parts.join(" "); // Using standard space
            
            // Format time to H:MM:SS.cc
            let format_time = |t: f64| -> String {
                let t = t.max(0.0);
                let hours = (t / 3600.0).floor() as u32;
                let mins = ((t % 3600.0) / 60.0).floor() as u32;
                let secs = (t % 60.0).floor() as u32;
                let centis = ((t % 1.0) * 100.0).round() as u32;
                format!("{}:{:02}:{:02}.{:02}", hours, mins, secs, centis)
            };
            
            writeln!(file, "Dialogue: 0,{},{},Default,,0,0,0,,{}",
                format_time(t_start),
                format_time(t_end),
                line_text
            ).unwrap();
        }
    }

    Ok(())
}
