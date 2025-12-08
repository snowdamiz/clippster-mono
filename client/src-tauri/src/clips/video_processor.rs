use tauri_plugin_shell::ShellExt;
use std::sync::{Arc, Mutex};
use futures::future::join_all;

use super::types::{AspectRatio, WatermarkSettings, AudioSettings};
use super::encoder::{detect_hardware_encoder, get_quality_settings};
use super::video_info::{get_video_info, calculate_crop_params, calculate_crop_position, IntroOutroCache};
use super::font_manager::get_fonts_dir;

// Helper function to build audio filter string for FFmpeg
// Combines volume adjustment and normalization
fn build_audio_filter(audio_settings: Option<&AudioSettings>) -> Option<String> {
    let settings = audio_settings?;
    
    let mut filters = Vec::new();
    
    // Volume adjustment (in dB)
    if settings.volume != 0.0 {
        filters.push(format!("volume={}dB", settings.volume));
    }
    
    // Normalization (loudnorm filter - industry standard -16 LUFS)
    if settings.normalize {
        filters.push("loudnorm=I=-16:TP=-1.5:LRA=11".to_string());
    }
    
    if filters.is_empty() {
        None
    } else {
        Some(filters.join(","))
    }
}

// Helper function to calculate watermark position for FFmpeg overlay filter
// position_x and position_y are percentages (0-100) from top-left corner
// The position is calculated so the watermark center is at the specified percentage
fn get_watermark_overlay_position(position_x: u32, position_y: u32) -> String {
    // Calculate position based on percentage, centering the watermark on the point
    // This matches the CSS behavior: left: X%, top: Y%, transform: translate(-50%, -50%)
    // 
    // Formula: position = (video_size * percentage / 100) - (overlay_size / 2)
    // This centers the watermark on the percentage point
    let x_expr = format!("main_w*{}/100-overlay_w/2", position_x);
    let y_expr = format!("main_h*{}/100-overlay_h/2", position_y);
    format!("x={}:y={}", x_expr, y_expr)
}

// Helper function to apply watermark to a video file
async fn apply_watermark_to_video(
    app: &tauri::AppHandle,
    input_path: &std::path::Path,
    watermark: &WatermarkSettings,
    quality: &str,
) -> Result<(), String> {
    if !watermark.enabled {
        return Ok(());
    }

    let shell = app.shell();
    
    // Get video info for calculating watermark size
    let video_info = get_video_info(app, input_path.to_str().ok_or("Invalid input path")?).await?;
    
    // Calculate watermark width based on scale percentage of video width
    let wm_width = (video_info.width as f32 * (watermark.scale as f32 / 100.0)) as u32;
    
    // Build the position string using X/Y percentages
    let position = get_watermark_overlay_position(watermark.position_x, watermark.position_y);
    
    // Calculate opacity (FFmpeg uses 0-1 range)
    let opacity = watermark.opacity as f32 / 100.0;
    
    // Create temporary output path
    let temp_output = input_path.with_extension("watermarked.mp4");
    
    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;
    
    // Build the filter_complex for watermark overlay
    // [1:v] is the watermark input
    // scale: resize watermark to percentage of video width
    // colorchannelmixer: apply opacity
    // overlay: position the watermark
    let filter_complex = format!(
        "[1:v]scale={}:-1,format=rgba,colorchannelmixer=aa={}[wm];[0:v][wm]overlay={}",
        wm_width, opacity, position
    );
    
    println!("[Rust] Watermark position: x={}%, y={}%", watermark.position_x, watermark.position_y);
    
    // Build encoder-specific args
    let mut args = vec![
        "-i".to_string(), input_path.to_string_lossy().to_string(),
        "-i".to_string(), watermark.file_path.clone(),
        "-filter_complex".to_string(), filter_complex,
        "-c:v".to_string(), encoder.codec.clone(),
    ];
    
    // Add preset if applicable
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }
    
    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());
    
    // Add common parameters
    args.extend_from_slice(&[
        "-c:a".to_string(), "copy".to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-y".to_string(),
        temp_output.to_string_lossy().to_string(),
    ]);
    
    println!("[Rust] Applying watermark to video...");
    
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to apply watermark: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg watermark failed: {}", stderr));
    }
    
    // Replace original file with watermarked version
    std::fs::remove_file(input_path)
        .map_err(|e| format!("Failed to remove original file: {}", e))?;
    std::fs::rename(&temp_output, input_path)
        .map_err(|e| format!("Failed to rename watermarked file: {}", e))?;
    
    println!("[Rust] Watermark applied successfully");
    
    Ok(())
}

// Build single-segment clip with aspect ratio and quality settings
// Note: output_format is unused here because the path already has the correct extension
pub async fn build_single_segment_clip_with_settings(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    subtitle_path: Option<&std::path::Path>,
    aspect_ratio: &AspectRatio,
    quality: &str,
    frame_rate: u32,
    _output_format: &str,  // Format already applied in output_path extension
    intro_path: Option<&str>,
    outro_path: Option<&str>,
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>,
    watermark_settings: Option<&WatermarkSettings>,
    audio_settings: Option<&AudioSettings>
) -> Result<(), String> {
    let shell = app.shell();
    let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
    let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
    let duration = end_time - start_time;

    println!("[Rust] Building single segment with aspect ratio {}:{}", aspect_ratio.width, aspect_ratio.height);

    // Get video info for cropping
    let video_info = get_video_info(app, video_path).await?;
    let (crop_w, crop_h, crop_x, crop_y) = calculate_crop_params(video_info.width, video_info.height, aspect_ratio);
    
    // Get quality settings (unused in this path, but kept for reference)
    let (_preset, _crf) = get_quality_settings(quality);
    
    // If intro or outro is present, we need to use the concat approach
    if intro_path.is_some() || outro_path.is_some() {
        println!("[Rust] Intro or outro detected, using concat approach for single segment");
        
        // Get storage paths for temporary files
        let paths = crate::storage::init_storage_dirs()
            .map_err(|e| format!("Failed to get storage paths: {}", e))?;

        let temp_dir = paths.temp.join(format!("clip_single_segment_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;

        // Detect hardware encoder for better performance
        let encoder = detect_hardware_encoder(app, quality).await;

        // Extract the main segment without subtitles (we'll add them later if needed)
        let segment_file = temp_dir.join("main_segment.mp4");
        let crop_filter = format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y);

        // Build encoder-specific args
        let mut args = vec![
            "-ss".to_string(), format!("{:.3}", start_time),
            "-i".to_string(), video_path.to_string(),
            "-t".to_string(), format!("{:.3}", duration),
            "-vf".to_string(), crop_filter.clone(),
            "-c:v".to_string(), encoder.codec.clone(),
        ];
        
        // Add preset if applicable
        if let Some(enc_preset) = &encoder.preset {
            args.push("-preset".to_string());
            args.push(enc_preset.clone());
        }
        
        // Add quality parameter
        args.push(encoder.quality_param.clone());
        args.push(encoder.quality_value.clone());
        
        // Add common parameters
        args.extend_from_slice(&[
            "-r".to_string(), frame_rate.to_string(),
            "-c:a".to_string(), "aac".to_string(),
            "-b:a".to_string(), "192k".to_string(),
            "-pix_fmt".to_string(), "yuv420p".to_string(),
            "-avoid_negative_ts".to_string(), "1".to_string(),
            "-y".to_string(),
            segment_file.to_string_lossy().to_string(),
        ]);

        let output = shell.sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args(args)
            .output()
            .await
            .map_err(|e| format!("Failed to extract segment: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to extract segment: {}", stderr));
        }

        // Process intro and outro if provided
        let mut intro_file: Option<std::path::PathBuf> = None;
        let mut outro_file: Option<std::path::PathBuf> = None;

        if let Some(intro) = intro_path {
            println!("[Rust] Processing intro video...");
            intro_file = Some(prepare_intro_outro_for_concat(
                app,
                intro,
                &temp_dir,
                "intro",
                aspect_ratio,
                quality,
                frame_rate,
                crop_w,
                crop_h,
                intro_outro_cache.clone()
            ).await?);
        }

        if let Some(outro) = outro_path {
            println!("[Rust] Processing outro video...");
            outro_file = Some(prepare_intro_outro_for_concat(
                app,
                outro,
                &temp_dir,
                "outro",
                aspect_ratio,
                quality,
                frame_rate,
                crop_w,
                crop_h,
                intro_outro_cache.clone()
            ).await?);
        }

        // Create concat list file
        let concat_file = temp_dir.join("concat_list.txt");
        let mut concat_content = String::new();
        
        // Add intro if present
        if let Some(intro_path) = &intro_file {
            concat_content.push_str(&format!("file '{}'\n", intro_path.display()));
        }
        
        // Add main segment
        concat_content.push_str(&format!("file '{}'\n", segment_file.display()));
        
        // Add outro if present
        if let Some(outro_path) = &outro_file {
            concat_content.push_str(&format!("file '{}'\n", outro_path.display()));
        }

        std::fs::write(&concat_file, concat_content)
            .map_err(|e| format!("Failed to write concat file: {}", e))?;

        // Concatenate files
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
                "-c", "copy",
                "-avoid_negative_ts", "1",
                "-y",
                concat_output_path.to_str().ok_or("Invalid output path")?,
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to concatenate: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("FFmpeg concatenation failed: {}", stderr));
        }

        // If subtitles are present, burn them now
        if let Some(sub_path) = subtitle_path {
            println!("[Rust] Burning subtitles with hardware acceleration...");
            
            // Get fonts directory
            let fonts_dir_for_burn = get_fonts_dir(app).ok();
            
            let sub_arg = sub_path.to_string_lossy().replace("\\", "/").replace(":", "\\:");
            
            // Build ass filter with fontsdir parameter
            let vf_arg = if let Some(fdir) = fonts_dir_for_burn {
                let fonts_dir_str = fdir.to_string_lossy().replace("\\", "/").replace(":", "\\:");
                format!("format=rgb24,ass='{}':fontsdir='{}'", sub_arg, fonts_dir_str)
            } else {
                format!("format=rgb24,ass='{}'", sub_arg)
            };

            // Set fontconfig path for FFmpeg to find our custom fonts
            let fontconfig_path = paths.temp.join("fonts.conf");
            
            // Build encoder-specific args
            let mut subtitle_args = vec![
                "-i".to_string(), concat_output_path.to_string_lossy().to_string(),
                "-vf".to_string(), vf_arg.clone(),
                "-c:v".to_string(), encoder.codec.clone(),
            ];
            
            // Add preset if applicable
            if let Some(enc_preset) = &encoder.preset {
                subtitle_args.push("-preset".to_string());
                subtitle_args.push(enc_preset.clone());
            }
            
            // Add quality parameter
            subtitle_args.push(encoder.quality_param.clone());
            subtitle_args.push(encoder.quality_value.clone());
            
            // Add audio filter if audio settings are provided
            if let Some(af) = build_audio_filter(audio_settings) {
                println!("[Rust] Applying audio filter (with subtitles): {}", af);
                subtitle_args.push("-af".to_string());
                subtitle_args.push(af);
            }
            
            // Add common parameters
            subtitle_args.extend_from_slice(&[
                "-c:a".to_string(), "aac".to_string(),
                "-b:a".to_string(), "192k".to_string(),
                "-pix_fmt".to_string(), "yuv420p".to_string(),
                "-movflags".to_string(), "+faststart".to_string(),
                "-y".to_string(),
                output_path.to_string_lossy().to_string(),
            ]);

            let output = shell.sidecar("ffmpeg")
                .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
                .env("FONTCONFIG_FILE", fontconfig_path.to_string_lossy().to_string())
                .args(subtitle_args)
                .output()
                .await
                .map_err(|e| format!("Failed to burn subtitles: {}", e))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("FFmpeg subtitle burning failed: {}", stderr));
            }
        } else if audio_settings.is_some() {
            // No subtitles but audio settings provided - need to apply audio filter
            // Re-encode with audio filter
            println!("[Rust] Applying audio filter (no subtitles, with intro/outro)...");
            
            if let Some(af) = build_audio_filter(audio_settings) {
                let audio_args = vec![
                    "-i".to_string(), concat_output_path.to_string_lossy().to_string(),
                    "-c:v".to_string(), "copy".to_string(),
                    "-af".to_string(), af,
                    "-c:a".to_string(), "aac".to_string(),
                    "-b:a".to_string(), "192k".to_string(),
                    "-y".to_string(),
                    output_path.to_string_lossy().to_string(),
                ];
                
                let output = shell.sidecar("ffmpeg")
                    .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
                    .args(audio_args)
                    .output()
                    .await
                    .map_err(|e| format!("Failed to apply audio filter: {}", e))?;
                
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("FFmpeg audio filter failed: {}", stderr));
                }
            }
        }

        // Clean up temporary files
        let _ = std::fs::remove_dir_all(&temp_dir);

        // Apply watermark if enabled (after all other processing)
        if let Some(wm) = watermark_settings {
            if wm.enabled {
                apply_watermark_to_video(app, output_path, wm, quality).await?;
            }
        }

        return Ok(());
    }

    // Original single-segment path (no intro/outro)
    // Detect hardware encoder for better performance
    let encoder = detect_hardware_encoder(app, quality).await;
    
    // Get fonts directory for subtitle rendering
    let fonts_dir = get_fonts_dir(app).ok();

    // Build video filter combining crop + subtitles in ONE PASS
    // Only Force RGB24 if using subtitles for accurate color rendering
    let mut vf_parts = vec![
        format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y)
    ];
    
    if let Some(path) = subtitle_path {
        vf_parts.push("format=rgb24".to_string());
        
        let path_str = path.to_string_lossy().replace("\\", "/").replace(":", "\\:");
        // Add fonts directory parameter to ass filter
        if let Some(ref fdir) = fonts_dir {
            let fonts_dir_str = fdir.to_string_lossy().replace("\\", "/").replace(":", "\\:");
            vf_parts.push(format!("ass='{}':fontsdir='{}'", path_str, fonts_dir_str));
        } else {
            vf_parts.push(format!("ass='{}'", path_str));
        }
    }
    
    let vf_arg = vf_parts.join(",");

    // Build encoder-specific args
    let mut args = vec![
        "-ss".to_string(), format!("{:.3}", start_time),
        "-i".to_string(), video_path.to_string(),
        "-t".to_string(), format!("{:.3}", duration),
        "-vf".to_string(), vf_arg,
        "-c:v".to_string(), encoder.codec.clone(),
    ];
    
    // Add preset if applicable
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }
    
    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());
    
    // Add audio filter if audio settings are provided
    if let Some(af) = build_audio_filter(audio_settings) {
        println!("[Rust] Applying audio filter: {}", af);
        args.push("-af".to_string());
        args.push(af);
    }
    
    // Add common parameters
    args.extend_from_slice(&[
        "-r".to_string(), frame_rate.to_string(),
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-avoid_negative_ts".to_string(), "1".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    // Set fontconfig path for FFmpeg to find our custom fonts
    let fontconfig_path = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?
        .temp.join("fonts.conf");

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .env("FONTCONFIG_FILE", fontconfig_path.to_string_lossy().to_string())
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg failed: {}", stderr));
    }

    // Apply watermark if enabled (after all other processing)
    if let Some(wm) = watermark_settings {
        if wm.enabled {
            apply_watermark_to_video(app, output_path, wm, quality).await?;
        }
    }

    Ok(())
}

// Build multi-segment clip with aspect ratio and quality settings
// Note: output_format is unused here because the path already has the correct extension
pub async fn build_multi_segment_clip_with_settings(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segments: &[serde_json::Value],
    subtitle_path: Option<&std::path::Path>,
    aspect_ratio: &AspectRatio,
    quality: &str,
    frame_rate: u32,
    _output_format: &str,  // Format already applied in output_path extension
    intro_path: Option<&str>,
    outro_path: Option<&str>,
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>,
    watermark_settings: Option<&WatermarkSettings>,
    audio_settings: Option<&AudioSettings>
) -> Result<(), String> {
    let shell = app.shell();

    // Get storage paths for temporary files
    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let temp_dir = paths.temp.join(format!("clip_segments_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    println!("[Rust] Building {} segments with aspect ratio {}:{}", segments.len(), aspect_ratio.width, aspect_ratio.height);

    // Get video info for cropping
    let video_info = get_video_info(app, video_path).await?;
    let (crop_w, crop_h, crop_x, crop_y) = calculate_crop_params(video_info.width, video_info.height, aspect_ratio);
    let crop_filter = format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y);

    // Get quality settings (unused in this path, but kept for reference)
    let (_preset, _crf) = get_quality_settings(quality);
    
    // Detect hardware encoder for better performance
    let encoder = detect_hardware_encoder(app, quality).await;

    // Extract segments with cropping IN PARALLEL for speed
    println!("[Rust] Extracting {} segments in parallel...", segments.len());
    let segment_tasks: Vec<_> = segments.iter().enumerate().map(|(i, segment)| {
        let start_time: f64 = segment["start_time"].as_f64().unwrap_or(0.0);
        let end_time: f64 = segment["end_time"].as_f64().unwrap_or(0.0);
        let duration = end_time - start_time;
        let segment_file = temp_dir.join(format!("segment_{:03}.mp4", i));
        let crop_filter = crop_filter.clone();
        let video_path = video_path.to_string();
        let app = app.clone();
        let encoder = encoder.clone();
        let frame_rate_str = frame_rate.to_string();

        async move {
            let shell = app.shell();
            
            // Build encoder-specific args
            let mut args = vec![
                "-ss".to_string(), format!("{:.3}", start_time),
                "-i".to_string(), video_path.clone(),
                "-t".to_string(), format!("{:.3}", duration),
                "-vf".to_string(), crop_filter.clone(),
                "-c:v".to_string(), encoder.codec.clone(),
            ];
            
            // Add preset if applicable
            if let Some(preset) = &encoder.preset {
                args.push("-preset".to_string());
                args.push(preset.clone());
            }
            
            // Add quality parameter
            args.push(encoder.quality_param.clone());
            args.push(encoder.quality_value.clone());
            
            // Add common parameters
            args.extend_from_slice(&[
                "-r".to_string(), frame_rate_str.clone(),
                "-c:a".to_string(), "aac".to_string(),
                "-b:a".to_string(), "192k".to_string(),
                "-pix_fmt".to_string(), "yuv420p".to_string(),
                "-avoid_negative_ts".to_string(), "1".to_string(),
                "-y".to_string(),
                segment_file.to_string_lossy().to_string(),
            ]);
            
            let output = shell.sidecar("ffmpeg")
                .map_err(|e| format!("Failed to get ffmpeg sidecar for segment {}: {}", i, e))?
                .args(args)
                .output()
                .await
                .map_err(|e| format!("Failed to extract segment {}: {}", i, e))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("Failed to extract segment {}: {}", i, stderr));
            }

            Ok::<std::path::PathBuf, String>(segment_file)
        }
    }).collect();

    // Wait for all segments to complete in parallel
    let segment_results = join_all(segment_tasks).await;
    
    // Check for errors and collect successful segment files
    let mut segment_files = Vec::new();
    for (i, result) in segment_results.into_iter().enumerate() {
        match result {
            Ok(path) => segment_files.push(path),
            Err(e) => return Err(format!("Segment {} failed: {}", i, e)),
        }
    }
    
    println!("[Rust] All {} segments extracted successfully", segment_files.len());

    // Process intro and outro if provided
    let mut intro_file: Option<std::path::PathBuf> = None;
    let mut outro_file: Option<std::path::PathBuf> = None;

    if let Some(intro) = intro_path {
        println!("[Rust] Processing intro video...");
        intro_file = Some(prepare_intro_outro_for_concat(
            app,
            intro,
            &temp_dir,
            "intro",
            aspect_ratio,
            quality,
            frame_rate,
            crop_w,
            crop_h,
            intro_outro_cache.clone()
        ).await?);
    }

    if let Some(outro) = outro_path {
        println!("[Rust] Processing outro video...");
        outro_file = Some(prepare_intro_outro_for_concat(
            app,
            outro,
            &temp_dir,
            "outro",
            aspect_ratio,
            quality,
            frame_rate,
            crop_w,
            crop_h,
            intro_outro_cache.clone()
        ).await?);
    }

    // Create concat list file with intro, segments, and outro
    let concat_file = temp_dir.join("concat_list.txt");
    let mut concat_content = String::new();
    
    // Add intro if present
    if let Some(intro_path) = &intro_file {
        concat_content.push_str(&format!("file '{}'\n", intro_path.display()));
    }
    
    // Add main clip segments
    for segment_file in &segment_files {
        concat_content.push_str(&format!("file '{}'\n", segment_file.display()));
    }
    
    // Add outro if present
    if let Some(outro_path) = &outro_file {
        concat_content.push_str(&format!("file '{}'\n", outro_path.display()));
    }

    std::fs::write(&concat_file, concat_content)
        .map_err(|e| format!("Failed to write concat file: {}", e))?;

    // Concatenate segments
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
            "-c", "copy",
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

    // If subtitles are present, burn them now with hardware acceleration
    if let Some(sub_path) = subtitle_path {
        println!("[Rust] Burning subtitles with hardware acceleration...");
        
        // Get fonts directory for multi-segment path
        let fonts_dir_for_burn = get_fonts_dir(app).ok();
        
        let sub_arg = sub_path.to_string_lossy().replace("\\", "/").replace(":", "\\:");
        
        // Build ass filter with fontsdir parameter
        // Force RGB24 for accurate subtitle color rendering
        let vf_arg = if let Some(fdir) = fonts_dir_for_burn {
            let fonts_dir_str = fdir.to_string_lossy().replace("\\", "/").replace(":", "\\:");
            format!("format=rgb24,ass='{}':fontsdir='{}'", sub_arg, fonts_dir_str)
        } else {
            format!("format=rgb24,ass='{}'", sub_arg)
        };

        // Set fontconfig path for FFmpeg to find our custom fonts
        let fontconfig_path = paths.temp.join("fonts.conf");
        
        // Build encoder-specific args
        let mut subtitle_args = vec![
            "-i".to_string(), concat_output_path.to_string_lossy().to_string(),
            "-vf".to_string(), vf_arg.clone(),
            "-c:v".to_string(), encoder.codec.clone(),
        ];
        
        // Add preset if applicable
        if let Some(enc_preset) = &encoder.preset {
            subtitle_args.push("-preset".to_string());
            subtitle_args.push(enc_preset.clone());
        }
        
        // Add quality parameter
        subtitle_args.push(encoder.quality_param.clone());
        subtitle_args.push(encoder.quality_value.clone());
        
        // Add audio filter if audio settings are provided
        if let Some(af) = build_audio_filter(audio_settings) {
            println!("[Rust] Applying audio filter (multi-segment with subtitles): {}", af);
            subtitle_args.push("-af".to_string());
            subtitle_args.push(af);
        }
        
        // Add common parameters
        subtitle_args.extend_from_slice(&[
            "-c:a".to_string(), "aac".to_string(),
            "-b:a".to_string(), "192k".to_string(),
            "-pix_fmt".to_string(), "yuv420p".to_string(),
            "-movflags".to_string(), "+faststart".to_string(),
            "-y".to_string(),
            output_path.to_string_lossy().to_string(),
        ]);

        let output = shell.sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .env("FONTCONFIG_FILE", fontconfig_path.to_string_lossy().to_string())
            .args(subtitle_args)
            .output()
            .await
            .map_err(|e| format!("Failed to burn subtitles: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("FFmpeg subtitle burning failed: {}", stderr));
        }
    } else if audio_settings.is_some() {
        // No subtitles but audio settings provided - need to apply audio filter
        println!("[Rust] Applying audio filter (multi-segment, no subtitles)...");
        
        if let Some(af) = build_audio_filter(audio_settings) {
            let audio_args = vec![
                "-i".to_string(), concat_output_path.to_string_lossy().to_string(),
                "-c:v".to_string(), "copy".to_string(),
                "-af".to_string(), af,
                "-c:a".to_string(), "aac".to_string(),
                "-b:a".to_string(), "192k".to_string(),
                "-y".to_string(),
                output_path.to_string_lossy().to_string(),
            ];
            
            let output = shell.sidecar("ffmpeg")
                .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
                .args(audio_args)
                .output()
                .await
                .map_err(|e| format!("Failed to apply audio filter: {}", e))?;
            
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("FFmpeg audio filter failed: {}", stderr));
            }
        }
    }

    // Clean up temporary files
    let _ = std::fs::remove_dir_all(&temp_dir);
    println!("[Rust] Multi-segment build successful, cleaned up temp files");

    // Apply watermark if enabled (after all other processing)
    if let Some(wm) = watermark_settings {
        if wm.enabled {
            apply_watermark_to_video(app, output_path, wm, quality).await?;
        }
    }

    Ok(())
}

// Helper function to prepare intro/outro for concatenation with the main clip
// This processes the intro/outro to match the aspect ratio, frame rate, and resolution
// Includes caching to avoid re-processing the same intro/outro multiple times
pub async fn prepare_intro_outro_for_concat(
    app: &tauri::AppHandle,
    intro_outro_path: &str,
    temp_dir: &std::path::Path,
    file_prefix: &str,
    aspect_ratio: &AspectRatio,
    quality: &str,
    frame_rate: u32,
    crop_w: u32,
    crop_h: u32,
    cache: Arc<Mutex<IntroOutroCache>>
) -> Result<std::path::PathBuf, String> {
    // Create cache key based on all relevant parameters
    let cache_key = (
        intro_outro_path.to_string(),
        format!("{}:{}", aspect_ratio.width, aspect_ratio.height),
        frame_rate,
        crop_w,
        crop_h
    );
    
    // Check if already processed in this build session
    {
        let cache_lock = cache.lock().unwrap();
        if let Some(cached_path) = cache_lock.get(&cache_key) {
            if cached_path.exists() {
                println!("[Rust] Using cached {} from: {}", file_prefix, cached_path.display());
                return Ok(cached_path.clone());
            }
        }
    } // Lock is dropped here before any await points
    
    let shell = app.shell();
    println!("[Rust] Preparing {} for concat with aspect ratio {}:{}", file_prefix, aspect_ratio.width, aspect_ratio.height);

    // Get video info for the intro/outro
    let video_info = get_video_info(app, intro_outro_path).await?;
    let (crop_x, crop_y) = calculate_crop_position(video_info.width, video_info.height, crop_w, crop_h);

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Create output path in temp directory
    let output_path = temp_dir.join(format!("{}_processed.mp4", file_prefix));

    // Build crop filter
    let crop_filter = format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y);

    // Build encoder-specific args
    let mut args = vec![
        "-i".to_string(), intro_outro_path.to_string(),
        "-vf".to_string(), crop_filter.clone(),
        "-c:v".to_string(), encoder.codec.clone(),
    ];
    
    // Add preset if applicable
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }
    
    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());
    
    // Add common parameters
    args.extend_from_slice(&[
        "-r".to_string(), frame_rate.to_string(),
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-avoid_negative_ts".to_string(), "1".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    // Process the intro/outro
    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to process {}: {}", file_prefix, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg failed to process {}: {}", file_prefix, stderr));
    }

    println!("[Rust] Successfully processed {} to: {}", file_prefix, output_path.display());
    
    // Cache the result (lock only for the insertion)
    {
        let mut cache_lock = cache.lock().unwrap();
        cache_lock.insert(cache_key, output_path.clone());
    }
    
    Ok(output_path)
}

// ============================================================================
// SPEAKER-AWARE FRAMING BUILDERS
// ============================================================================
// These functions are used when the client passes a FramingStrategy
// from the server's speaker detection API. They enable:
// - Split screen exports (gaming/screen share content)
// - Dynamic panning (IRL/mobile content)
// - Static centered crop (talking head content)
//
// Integration: The orchestrator calls `build_clip_with_framing_strategy` 
// when a FramingStrategy is available for portrait (9:16) exports.
// ============================================================================

use super::types::{FramingStrategy, FramingMode, PanKeyframe, ManualFramingConfig};

/// Builds a split screen clip with two video regions stacked vertically.
/// 
/// This is used for gaming/screen share content where the speaker is in one corner
/// and the main content (gameplay, presentation) occupies the rest of the frame.
/// 
/// The resulting video has:
/// - Top region: Content area (e.g., gameplay)
/// - Bottom region: Speaker area
pub async fn build_split_screen_clip(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    strategy: &FramingStrategy,
    target_aspect_ratio: &str,  // Target aspect ratio (e.g., "9:16", "4:5", "1:1")
    quality: &str,
    frame_rate: u32,
    audio_settings: Option<&AudioSettings>,
) -> Result<(), String> {
    let shell = app.shell();
    let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
    let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
    let duration = end_time - start_time;

    let layout = strategy.layout.as_ref()
        .ok_or("Split screen strategy missing layout configuration")?;

    // Parse target aspect ratio from parameter
    let aspect = parse_aspect_ratio_string(target_aspect_ratio)
        .unwrap_or(super::types::AspectRatio { width: 9.0, height: 16.0 });
    
    println!("[Rust] Building split screen clip with ratio: {}, aspect: {}:{}", 
        layout.split_ratio, aspect.width, aspect.height);

    // Get video info for pixel calculations
    let video_info = get_video_info(app, video_path).await?;
    let source_w = video_info.width as f64;
    let source_h = video_info.height as f64;

    // Calculate output dimensions based on target aspect ratio
    // Use 1080 as base width, calculate height from aspect ratio
    let output_w: u32 = 1080;
    let output_h: u32 = ((output_w as f32) * aspect.height / aspect.width) as u32;

    // Calculate heights for each split region in the output
    let top_output_height = (output_h as f64 * layout.split_ratio) as u32;
    let bottom_output_height = output_h - top_output_height;

    // Calculate the CORRECT aspect ratio for each split region
    // This is crucial - each split has its own aspect ratio, not the overall 9:16
    let top_split_aspect = output_w as f64 / top_output_height as f64;
    let bottom_split_aspect = output_w as f64 / bottom_output_height as f64;
    
    println!("[Rust] Top split aspect: {:.4} ({}x{})", top_split_aspect, output_w, top_output_height);
    println!("[Rust] Bottom split aspect: {:.4} ({}x{})", bottom_split_aspect, output_w, bottom_output_height);

    // Get normalized crop regions from the layout
    let top_crop = &layout.top_region;
    let bottom_crop = &layout.bottom_region;
    
    // Calculate top region center point (from normalized coords)
    // Use the center point from the crop region (calculated intelligently by Elixir)
    let top_center_x = top_crop.x + top_crop.width / 2.0;
    let top_center_y = top_crop.y + top_crop.height / 2.0;
    
    // Calculate bottom region center point (speaker position)
    let bottom_center_x = bottom_crop.x + bottom_crop.width / 2.0;
    let bottom_center_y = bottom_crop.y + bottom_crop.height / 2.0;
    
    // Calculate crop dimensions that maintain the correct aspect ratio for each split
    // Top region: crop from source with aspect ratio matching top_split_aspect
    // Use full available area (no zoom constraint)
    let (top_crop_w, top_crop_h, top_x, top_y) = calculate_aspect_preserving_crop(
        source_w as u32, source_h as u32,
        top_split_aspect,
        top_center_x, top_center_y
    );
    
    // Bottom region: crop from source with aspect ratio matching bottom_split_aspect
    // Use the width/height from layout as maximum bounds to zoom into facecam
    // CRITICAL: Always maintain exact aspect ratio - never stretch!
    // For facecam, we want aggressive zooming - apply constraint if crop size is smaller than full frame
    let (bottom_crop_w, bottom_crop_h, bottom_x, bottom_y) = 
        if bottom_crop.width > 0.0 && bottom_crop.height > 0.0 && 
           (bottom_crop.width < 0.8 || bottom_crop.height < 0.8) {
            // Layout specifies a zoomed crop size - use it as constraint
            // The Elixir server has calculated the estimated facecam window size and sent it as
            // normalized width/height values that should fit the entire facecam window
            let max_w_norm = bottom_crop.width;
            let max_h_norm = bottom_crop.height;
            
            // Elixir now calculates a tight, face-centered crop with proper aspect ratio
            // We should use those dimensions directly - they already have adequate padding
            // and the correct aspect ratio for the bottom split
            
            // Convert normalized constraint dimensions to pixels
            let constraint_w = (source_w * max_w_norm) as u32;
            let constraint_h = (source_h * max_h_norm) as u32;
            
            // The Elixir-provided dimensions should already have the correct aspect ratio
            // But verify and adjust if needed to match bottom_split_aspect exactly
            let current_aspect = constraint_w as f64 / constraint_h as f64;
            
            let (final_w, final_h) = if (current_aspect - bottom_split_aspect).abs() < 0.01 {
                // Aspect ratio is already correct, use as-is
                (constraint_w, constraint_h)
            } else if current_aspect > bottom_split_aspect {
                // Crop is too wide - use width, calculate tighter height
                let h = (constraint_w as f64 / bottom_split_aspect) as u32;
                (constraint_w, h)
            } else {
                // Crop is too tall - use height, calculate tighter width
                let w = (constraint_h as f64 * bottom_split_aspect) as u32;
                (w, constraint_h)
            };
            
            // Ensure we don't exceed source dimensions
            let final_w = final_w.min(source_w as u32);
            let final_h = final_h.min(source_h as u32);
            
            println!("[Rust] Using constraint-based crop for facecam zoom: {}x{} (from norm: {}x{})", 
                final_w, final_h, max_w_norm, max_h_norm);
            
            // Recalculate position to center on speaker with new dimensions
            let center_x_px = (source_w * bottom_center_x) as i32;
            let center_y_px = (source_h * bottom_center_y) as i32;
            
            let mut final_x = center_x_px - (final_w as i32 / 2);
            let mut final_y = center_y_px - (final_h as i32 / 2);
            
            // Clamp to valid range
            let source_w_u32 = source_w as u32;
            let source_h_u32 = source_h as u32;
            final_x = final_x.max(0).min((source_w_u32.saturating_sub(final_w)) as i32);
            final_y = final_y.max(0).min((source_h_u32.saturating_sub(final_h)) as i32);
            
            (final_w, final_h, final_x as u32, final_y as u32)
        } else {
            // No zoom constraint - use normal aspect-preserving crop
            calculate_aspect_preserving_crop(
                source_w as u32, source_h as u32,
                bottom_split_aspect,
                bottom_center_x, bottom_center_y
            )
        };
    
    println!("[Rust] Top crop: {}x{} at ({},{})", top_crop_w, top_crop_h, top_x, top_y);
    println!("[Rust] Bottom crop: {}x{} at ({},{})", bottom_crop_w, bottom_crop_h, bottom_x, bottom_y);

    // Build complex filter for split screen
    // Each crop maintains the correct aspect ratio for its output region
    // Use force_original_aspect_ratio=decrease to prevent stretching - crop to fit instead
    let filter_complex = format!(
        "[0:v]split=2[top_src][bottom_src];\
        [top_src]crop={}:{}:{}:{},scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black[top];\
        [bottom_src]crop={}:{}:{}:{},scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black[bottom];\
        [top][bottom]vstack=inputs=2[outv]",
        top_crop_w, top_crop_h, top_x, top_y, output_w, top_output_height, output_w, top_output_height,
        bottom_crop_w, bottom_crop_h, bottom_x, bottom_y, output_w, bottom_output_height, output_w, bottom_output_height
    );

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Build FFmpeg args
    let mut args = vec![
        "-ss".to_string(), format!("{:.3}", start_time),
        "-i".to_string(), video_path.to_string(),
        "-t".to_string(), format!("{:.3}", duration),
        "-filter_complex".to_string(), filter_complex,
        "-map".to_string(), "[outv]".to_string(),
        "-map".to_string(), "0:a?".to_string(),
        "-c:v".to_string(), encoder.codec.clone(),
    ];

    // Add encoder preset
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    // Add audio filter if settings provided
    if let Some(af) = build_audio_filter(audio_settings) {
        args.push("-af".to_string());
        args.push(af);
    }

    // Common output parameters
    args.extend_from_slice(&[
        "-r".to_string(), frame_rate.to_string(),
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    println!("[Rust] Running split screen FFmpeg command...");

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg split screen failed: {}", stderr));
    }

    println!("[Rust] Split screen clip built successfully");
    Ok(())
}

/// Parses an aspect ratio string (e.g., "9:16", "1:1", "4:5") into an AspectRatio struct.
fn parse_aspect_ratio_string(ratio_str: &str) -> Option<super::types::AspectRatio> {
    let parts: Vec<&str> = ratio_str.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    
    let width: f32 = parts[0].parse().ok()?;
    let height: f32 = parts[1].parse().ok()?;
    
    Some(super::types::AspectRatio { width, height })
}

/// Calculates crop dimensions that preserve a target aspect ratio, centered on a point.
/// 
/// Given source dimensions, target aspect ratio, and a center point (normalized 0-1),
/// returns (crop_width, crop_height, crop_x, crop_y) in pixels.
fn calculate_aspect_preserving_crop(
    source_w: u32,
    source_h: u32,
    target_aspect: f64,  // width / height
    center_x: f64,       // normalized 0-1
    center_y: f64,       // normalized 0-1
) -> (u32, u32, u32, u32) {
    let source_aspect = source_w as f64 / source_h as f64;
    
    let (crop_w, crop_h) = if target_aspect > source_aspect {
        // Target is wider - use full width, crop height
        let w = source_w;
        let h = (source_w as f64 / target_aspect) as u32;
        (w, h)
    } else {
        // Target is taller - use full height, crop width
        let h = source_h;
        let w = (source_h as f64 * target_aspect) as u32;
        (w, h)
    };
    
    // Calculate crop position centered on the given point
    let center_x_px = (source_w as f64 * center_x) as i32;
    let center_y_px = (source_h as f64 * center_y) as i32;
    
    let mut crop_x = center_x_px - (crop_w as i32 / 2);
    let mut crop_y = center_y_px - (crop_h as i32 / 2);
    
    // Clamp to valid range
    crop_x = crop_x.max(0).min((source_w - crop_w) as i32);
    crop_y = crop_y.max(0).min((source_h - crop_h) as i32);
    
    (crop_w, crop_h, crop_x as u32, crop_y as u32)
}

/// Builds a dynamic pan clip that smoothly follows speakers across frames.
/// 
/// Uses keyframes to interpolate crop position over time, creating a smooth
/// panning effect that keeps the subject in frame.
pub async fn build_dynamic_pan_clip(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    strategy: &FramingStrategy,
    target_aspect_ratio: &str,  // Target aspect ratio (e.g., "9:16", "4:5", "1:1")
    quality: &str,
    frame_rate: u32,
    audio_settings: Option<&AudioSettings>,
) -> Result<(), String> {
    let shell = app.shell();
    let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
    let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
    let duration = end_time - start_time;

    let keyframes = strategy.keyframes.as_ref()
        .ok_or("Dynamic pan strategy missing keyframes")?;

    // Parse target aspect ratio from parameter
    let aspect = parse_aspect_ratio_string(target_aspect_ratio)
        .unwrap_or(super::types::AspectRatio { width: 9.0, height: 16.0 });
    
    println!("[Rust] Building dynamic pan clip with {} keyframes, aspect: {}:{}", 
        keyframes.len(), aspect.width, aspect.height);

    // Get video info
    let video_info = get_video_info(app, video_path).await?;
    let source_w = video_info.width;
    let source_h = video_info.height;

    // Calculate crop dimensions for target aspect ratio
    let target_aspect = aspect.width as f64 / aspect.height as f64;
    let source_aspect = source_w as f64 / source_h as f64;
    
    let (crop_w, crop_h) = if target_aspect < source_aspect {
        // Crop width (most common case: 16:9 to 9:16)
        let h = source_h;
        let w = (h as f64 * target_aspect) as u32;
        (w, h)
    } else {
        // Crop height
        let w = source_w;
        let h = (w as f64 / target_aspect) as u32;
        (w, h)
    };

    // Build pan expression from keyframes
    let pan_expr = build_pan_expression(keyframes, source_w, crop_w, start_time, duration);

    // Build video filter
    let vf = format!("crop={}:{}:{}:0", crop_w, crop_h, pan_expr);

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Build FFmpeg args
    let mut args = vec![
        "-ss".to_string(), format!("{:.3}", start_time),
        "-i".to_string(), video_path.to_string(),
        "-t".to_string(), format!("{:.3}", duration),
        "-vf".to_string(), vf,
        "-c:v".to_string(), encoder.codec.clone(),
    ];

    // Add encoder preset
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    // Add audio filter if settings provided
    if let Some(af) = build_audio_filter(audio_settings) {
        args.push("-af".to_string());
        args.push(af);
    }

    // Common output parameters
    args.extend_from_slice(&[
        "-r".to_string(), frame_rate.to_string(),
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    println!("[Rust] Running dynamic pan FFmpeg command...");

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg dynamic pan failed: {}", stderr));
    }

    println!("[Rust] Dynamic pan clip built successfully");
    Ok(())
}

/// Builds FFmpeg expression for panning based on keyframes.
/// 
/// Creates a linear interpolation expression that smoothly transitions
/// between keyframe positions.
fn build_pan_expression(
    keyframes: &[PanKeyframe],
    source_width: u32,
    crop_width: u32,
    segment_start: f64,
    segment_duration: f64
) -> String {
    if keyframes.is_empty() {
        // Default to center
        let center = (source_width - crop_width) / 2;
        return center.to_string();
    }

    if keyframes.len() == 1 {
        // Single keyframe - static position
        let x = (keyframes[0].crop_x * source_width as f64) as u32;
        let clamped = x.min(source_width - crop_width);
        return clamped.to_string();
    }

    // Filter keyframes to those within segment time range
    let relevant_keyframes: Vec<&PanKeyframe> = keyframes.iter()
        .filter(|kf| kf.timestamp >= segment_start && kf.timestamp <= segment_start + segment_duration)
        .collect();

    if relevant_keyframes.is_empty() {
        // No keyframes in range, use first keyframe position
        let x = (keyframes[0].crop_x * source_width as f64) as u32;
        let clamped = x.min(source_width - crop_width);
        return clamped.to_string();
    }

    // For simplicity, use linear interpolation between first and last relevant keyframe
    let first = relevant_keyframes.first().unwrap();
    let last = relevant_keyframes.last().unwrap();

    let start_x = ((first.crop_x * source_width as f64) as u32).min(source_width - crop_width);
    let end_x = ((last.crop_x * source_width as f64) as u32).min(source_width - crop_width);

    let kf_duration = last.timestamp - first.timestamp;
    
    if kf_duration < 0.5 || (start_x as i32 - end_x as i32).abs() < 10 {
        // Minimal change - use average position
        let avg_x = (start_x + end_x) / 2;
        return avg_x.to_string();
    }

    // Linear interpolation: start + (end - start) * (t - start_t) / duration
    // Note: 't' in FFmpeg is time in seconds from start of output
    let relative_start = first.timestamp - segment_start;
    
    format!(
        "{}+({})*(t-{})/{}", 
        start_x, 
        end_x as i32 - start_x as i32,
        relative_start,
        kf_duration
    )
}

/// Builds a multi-region clip with user-defined crop regions composited together.
/// 
/// This is used for manual POI (Point of Interest) framing where the user defines
/// multiple regions from the source video and their positions in the output canvas.
/// 
/// Each region is:
/// 1. Cropped from the source video
/// 2. Scaled to fit its output rect
/// 3. Placed on the output canvas
pub async fn build_multi_region_clip(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    config: &ManualFramingConfig,
    target_aspect_ratio: &str,
    quality: &str,
    frame_rate: u32,
    audio_settings: Option<&AudioSettings>,
) -> Result<(), String> {
    let shell = app.shell();
    let start_time: f64 = segment["start_time"].as_f64().ok_or("Invalid start_time")?;
    let end_time: f64 = segment["end_time"].as_f64().ok_or("Invalid end_time")?;
    let duration = end_time - start_time;

    if config.regions.is_empty() {
        return Err("MultiRegion config has no regions defined".to_string());
    }

    // Parse target aspect ratio
    let aspect = parse_aspect_ratio_string(target_aspect_ratio)
        .unwrap_or(super::types::AspectRatio { width: 9.0, height: 16.0 });
    
    println!("[Rust] Building multi-region clip with {} regions, aspect: {}:{}", 
        config.regions.len(), aspect.width, aspect.height);

    // Get video info for pixel calculations
    let video_info = get_video_info(app, video_path).await?;
    let source_w = video_info.width as f64;
    let source_h = video_info.height as f64;

    // Calculate output dimensions (1080p base width)
    let output_w: u32 = 1080;
    let output_h: u32 = ((output_w as f32) * aspect.height / aspect.width) as u32;

    println!("[Rust] Output dimensions: {}x{}", output_w, output_h);

    // Build FFmpeg complex filter for multi-region compositing
    // Strategy:
    // 1. Input video gets labeled as [v]
    // 2. For each region, crop from [v] and scale to output size
    // 3. Create black canvas and overlay each region at its output position
    
    let mut filter_parts: Vec<String> = Vec::new();
    let mut region_labels: Vec<(String, u32, u32)> = Vec::new();

    // For each region, create crop and scale filters
    for (i, region) in config.regions.iter().enumerate() {
        // Calculate source crop in pixels
        let crop_x = (region.source.x * source_w) as u32;
        let crop_y = (region.source.y * source_h) as u32;
        let crop_w = (region.source.width * source_w) as u32;
        let crop_h = (region.source.height * source_h) as u32;

        // Calculate output position and size in pixels
        let out_x = (region.output.x * output_w as f64) as u32;
        let out_y = (region.output.y * output_h as f64) as u32;
        let out_w = (region.output.width * output_w as f64) as u32;
        let out_h = (region.output.height * output_h as f64) as u32;

        println!("[Rust] Region {}: crop={}:{}:{}:{} -> scale={}:{} @ ({},{})", 
            i, crop_w, crop_h, crop_x, crop_y, out_w, out_h, out_x, out_y);

        let label = format!("r{}", i);
        
        // Crop from input and scale to output size
        // Using lanczos scaling for better quality
        filter_parts.push(format!(
            "[0:v]crop={}:{}:{}:{},scale={}:{}:flags=lanczos[{}]",
            crop_w, crop_h, crop_x, crop_y, out_w, out_h, label
        ));
        
        region_labels.push((label, out_x, out_y));
    }

    // Create base canvas (black background)
    filter_parts.push(format!(
        "color=c=black:s={}x{}:d={}[base]",
        output_w, output_h, duration
    ));

    // Build overlay chain
    // Start with base canvas, overlay each region
    let mut current_label = "base".to_string();
    for (i, (region_label, out_x, out_y)) in region_labels.iter().enumerate() {
        let next_label = if i == region_labels.len() - 1 {
            "vout".to_string() // Final output
        } else {
            format!("tmp{}", i)
        };

        filter_parts.push(format!(
            "[{}][{}]overlay={}:{}[{}]",
            current_label, region_label, out_x, out_y, next_label
        ));

        current_label = next_label;
    }

    let filter_complex = filter_parts.join(";");

    // Detect hardware encoder
    let encoder = detect_hardware_encoder(app, quality).await;

    // Build FFmpeg args
    let mut args = vec![
        "-ss".to_string(), format!("{:.3}", start_time),
        "-i".to_string(), video_path.to_string(),
        "-t".to_string(), format!("{:.3}", duration),
        "-filter_complex".to_string(), filter_complex,
        "-map".to_string(), "[vout]".to_string(),
        "-map".to_string(), "0:a?".to_string(), // Map audio if present
        "-c:v".to_string(), encoder.codec.clone(),
        "-r".to_string(), frame_rate.to_string(),
    ];

    // Add encoder preset
    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    // Add quality parameter
    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    // Add audio settings
    args.push("-c:a".to_string());
    args.push("aac".to_string());
    args.push("-b:a".to_string());
    args.push("192k".to_string());

    // Add audio gain if specified
    if let Some(audio) = audio_settings {
        if audio.volume != 0.0 {
            let af = format!("volume={}dB", audio.volume);
            args.push("-af".to_string());
            args.push(af);
        }
    }

    // Output
    args.push("-y".to_string());
    args.push(output_path.to_string_lossy().to_string());

    println!("[Rust] Running FFmpeg multi-region build...");
    
    let output = shell.command("ffmpeg")
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Failed to run FFmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg multi-region build failed: {}", stderr));
    }

    println!("[Rust] Multi-region clip built successfully");
    Ok(())
}

/// Builds a clip with framing strategy applied.
/// 
/// This is the main entry point that routes to the appropriate builder
/// based on the framing mode.
/// 
/// The `target_aspect_ratio` parameter allows overriding the strategy's aspect ratio
/// to support building multiple aspect ratios (9:16, 4:5, 1:1) from the same strategy.
pub async fn build_clip_with_framing_strategy(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    strategy: &FramingStrategy,
    target_aspect_ratio: &str,  // Override aspect ratio (e.g., "9:16", "4:5", "1:1")
    quality: &str,
    frame_rate: u32,
    subtitle_path: Option<&std::path::Path>,
    intro_path: Option<&str>,
    outro_path: Option<&str>,
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>,
    watermark_settings: Option<&WatermarkSettings>,
    audio_settings: Option<&AudioSettings>,
) -> Result<(), String> {
    println!("[Rust] Building clip with framing strategy: {:?}, target: {}", strategy.mode, target_aspect_ratio);

    match strategy.mode {
        FramingMode::SplitScreen => {
            // For split screen, we build without subtitles first, then add them
            let temp_output = if subtitle_path.is_some() {
                let paths = crate::storage::init_storage_dirs()
                    .map_err(|e| format!("Failed to get storage paths: {}", e))?;
                Some(paths.temp.join(format!("split_temp_{}.mp4", uuid::Uuid::new_v4())))
            } else {
                None
            };

            let output_path_buf = output_path.to_path_buf();
            let build_path = temp_output.as_ref().unwrap_or(&output_path_buf);
            
            build_split_screen_clip(
                app, video_path, build_path, segment, strategy, target_aspect_ratio, quality, frame_rate, audio_settings
            ).await?;

            // Add subtitles if needed
            if let (Some(temp), Some(sub_path)) = (&temp_output, subtitle_path) {
                burn_subtitles_to_video(app, temp, output_path, sub_path, quality).await?;
                let _ = std::fs::remove_file(temp);
            }
        },
        FramingMode::DynamicPan => {
            let temp_output = if subtitle_path.is_some() {
                let paths = crate::storage::init_storage_dirs()
                    .map_err(|e| format!("Failed to get storage paths: {}", e))?;
                Some(paths.temp.join(format!("pan_temp_{}.mp4", uuid::Uuid::new_v4())))
            } else {
                None
            };

            let output_path_buf = output_path.to_path_buf();
            let build_path = temp_output.as_ref().unwrap_or(&output_path_buf);

            build_dynamic_pan_clip(
                app, video_path, build_path, segment, strategy, target_aspect_ratio, quality, frame_rate, audio_settings
            ).await?;

            // Add subtitles if needed
            if let (Some(temp), Some(sub_path)) = (&temp_output, subtitle_path) {
                burn_subtitles_to_video(app, temp, output_path, sub_path, quality).await?;
                let _ = std::fs::remove_file(temp);
            }
        },
        FramingMode::Static => {
            // Parse target aspect ratio from parameter (e.g., "9:16", "1:1", "4:5")
            let aspect_ratio = parse_aspect_ratio_string(target_aspect_ratio)
                .unwrap_or(super::types::AspectRatio { width: 9.0, height: 16.0 });
            
            println!("[Rust] Static mode with aspect ratio: {}:{}", aspect_ratio.width, aspect_ratio.height);
            
            build_single_segment_clip_with_settings(
                app,
                video_path,
                output_path,
                segment,
                subtitle_path,
                &aspect_ratio,
                quality,
                frame_rate,
                "mp4",
                intro_path,
                outro_path,
                intro_outro_cache,
                watermark_settings,
                audio_settings,
            ).await?;
        },
        FramingMode::MultiRegion => {
            // Manual multi-region mode with user-defined regions
            let multi_region_config = strategy.multi_region.as_ref()
                .ok_or("MultiRegion mode requires multi_region configuration")?;

            let temp_output = if subtitle_path.is_some() {
                let paths = crate::storage::init_storage_dirs()
                    .map_err(|e| format!("Failed to get storage paths: {}", e))?;
                Some(paths.temp.join(format!("multi_region_temp_{}.mp4", uuid::Uuid::new_v4())))
            } else {
                None
            };

            let output_path_buf = output_path.to_path_buf();
            let build_path = temp_output.as_ref().unwrap_or(&output_path_buf);

            build_multi_region_clip(
                app, video_path, build_path, segment, multi_region_config, target_aspect_ratio, quality, frame_rate, audio_settings
            ).await?;

            // Add subtitles if needed
            if let (Some(temp), Some(sub_path)) = (&temp_output, subtitle_path) {
                burn_subtitles_to_video(app, temp, output_path, sub_path, quality).await?;
                let _ = std::fs::remove_file(temp);
            }
        },
    }

    // Apply watermark if enabled (after all other processing)
    if let Some(wm) = watermark_settings {
        if wm.enabled {
            apply_watermark_to_video(app, output_path, wm, quality).await?;
        }
    }

    Ok(())
}

/// Builds a multi-segment clip with framing strategy applied.
/// 
/// This extracts each segment, applies the framing strategy, then concatenates them.
pub async fn build_multi_segment_clip_with_framing_strategy(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segments: &[serde_json::Value],
    strategy: &FramingStrategy,
    target_aspect_ratio: &str,  // Target aspect ratio (e.g., "9:16", "4:5", "1:1")
    quality: &str,
    frame_rate: u32,
    subtitle_path: Option<&std::path::Path>,
    intro_path: Option<&str>,
    outro_path: Option<&str>,
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>,
    watermark_settings: Option<&WatermarkSettings>,
    audio_settings: Option<&AudioSettings>,
) -> Result<(), String> {
    use futures::future::join_all;
    
    println!("[Rust] Building multi-segment clip with framing strategy: {:?}, target: {}", strategy.mode, target_aspect_ratio);
    println!("[Rust] Processing {} segments", segments.len());

    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    // Extract each segment with framing applied in parallel
    let temp_files: Vec<std::path::PathBuf> = segments.iter()
        .enumerate()
        .map(|(i, _)| paths.temp.join(format!("segment_framed_{}_{}.mp4", uuid::Uuid::new_v4(), i)))
        .collect();

    // Build each segment with framing strategy
    let target_aspect_ratio_owned = target_aspect_ratio.to_string();
    let segment_tasks: Vec<_> = segments.iter().enumerate().map(|(i, segment)| {
        let app = app.clone();
        let video_path = video_path.to_string();
        let temp_path = temp_files[i].clone();
        let strategy = strategy.clone();
        let quality = quality.to_string();
        let audio_settings = audio_settings.cloned();
        let target_ar = target_aspect_ratio_owned.clone();

        async move {
            println!("[Rust] Building framed segment {}/{}", i + 1, segments.len());
            
            match strategy.mode {
                FramingMode::SplitScreen => {
                    build_split_screen_clip(
                        &app, &video_path, &temp_path, segment, &strategy, &target_ar, &quality, frame_rate, audio_settings.as_ref()
                    ).await?;
                },
                FramingMode::DynamicPan => {
                    build_dynamic_pan_clip(
                        &app, &video_path, &temp_path, segment, &strategy, &target_ar, &quality, frame_rate, audio_settings.as_ref()
                    ).await?;
                },
                FramingMode::Static => {
                    // For static mode, use the target aspect ratio
                    let aspect_ratio = parse_aspect_ratio_string(&target_ar)
                        .unwrap_or(super::types::AspectRatio { width: 9.0, height: 16.0 });
                    extract_segment_with_crop(&app, &video_path, &temp_path, segment, &aspect_ratio, &quality, frame_rate, audio_settings.as_ref()).await?;
                },
                FramingMode::MultiRegion => {
                    // For multi-region mode, use the manual config
                    if let Some(multi_region) = &strategy.multi_region {
                        build_multi_region_clip(
                            &app, &video_path, &temp_path, segment, multi_region, &target_ar, &quality, frame_rate, audio_settings.as_ref()
                        ).await?;
                    } else {
                        // Fallback to static if no multi-region config
                        let aspect_ratio = parse_aspect_ratio_string(&target_ar)
                            .unwrap_or(super::types::AspectRatio { width: 9.0, height: 16.0 });
                        extract_segment_with_crop(&app, &video_path, &temp_path, segment, &aspect_ratio, &quality, frame_rate, audio_settings.as_ref()).await?;
                    }
                },
            }
            
            Ok::<(), String>(())
        }
    }).collect();

    // Wait for all segments to be processed
    let results = join_all(segment_tasks).await;
    for (i, result) in results.into_iter().enumerate() {
        if let Err(e) = result {
            // Clean up temp files
            for temp_file in &temp_files {
                let _ = std::fs::remove_file(temp_file);
            }
            return Err(format!("Failed to build segment {}: {}", i + 1, e));
        }
    }

    println!("[Rust] All {} segments processed, concatenating...", segments.len());

    // Create concat file
    let concat_file = paths.temp.join(format!("concat_{}.txt", uuid::Uuid::new_v4()));
    let concat_content: String = temp_files.iter()
        .map(|f| format!("file '{}'", f.to_string_lossy().replace("\\", "/")))
        .collect::<Vec<_>>()
        .join("\n");
    
    std::fs::write(&concat_file, &concat_content)
        .map_err(|e| format!("Failed to write concat file: {}", e))?;

    // Determine if we need a temp output for post-processing
    let needs_post_processing = subtitle_path.is_some() || intro_path.is_some() || outro_path.is_some();
    let concat_output = if needs_post_processing {
        paths.temp.join(format!("concat_out_{}.mp4", uuid::Uuid::new_v4()))
    } else {
        output_path.to_path_buf()
    };

    // Concatenate segments
    let shell = app.shell();
    let encoder = detect_hardware_encoder(app, quality).await;
    
    let mut args = vec![
        "-f".to_string(), "concat".to_string(),
        "-safe".to_string(), "0".to_string(),
        "-i".to_string(), concat_file.to_string_lossy().to_string(),
        "-c:v".to_string(), encoder.codec.clone(),
    ];

    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());
    
    args.extend_from_slice(&[
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-r".to_string(), frame_rate.to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-y".to_string(),
        concat_output.to_string_lossy().to_string(),
    ]);

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    // Clean up segment temp files
    for temp_file in &temp_files {
        let _ = std::fs::remove_file(temp_file);
    }
    let _ = std::fs::remove_file(&concat_file);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg concat failed: {}", stderr));
    }

    // Add subtitles if needed
    if let Some(sub_path) = subtitle_path {
        burn_subtitles_to_video(app, &concat_output, output_path, sub_path, quality).await?;
        if needs_post_processing {
            let _ = std::fs::remove_file(&concat_output);
        }
    } else if concat_output != output_path.to_path_buf() {
        // Move to final output
        std::fs::rename(&concat_output, output_path)
            .map_err(|e| format!("Failed to move output: {}", e))?;
    }
    
    // Note: Intro/outro not yet supported for framing strategy multi-segment builds
    // The intro/outro cache is available but would need additional implementation
    let _ = intro_path;
    let _ = outro_path;
    let _ = intro_outro_cache;

    // Apply watermark if enabled
    if let Some(wm) = watermark_settings {
        if wm.enabled {
            apply_watermark_to_video(app, output_path, wm, quality).await?;
        }
    }

    println!("[Rust] Multi-segment framed clip built successfully");
    Ok(())
}

/// Helper to extract a segment with simple center crop (for Static framing mode)
async fn extract_segment_with_crop(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    aspect_ratio: &super::types::AspectRatio,
    quality: &str,
    frame_rate: u32,
    audio_settings: Option<&AudioSettings>,
) -> Result<(), String> {
    let shell = app.shell();
    let encoder = detect_hardware_encoder(app, quality).await;
    
    let start = segment.get("start_time")
        .and_then(|v| v.as_f64())
        .ok_or("Missing start_time")?;
    let end = segment.get("end_time")
        .and_then(|v| v.as_f64())
        .ok_or("Missing end_time")?;
    let duration = end - start;

    // Get video dimensions for crop calculation
    let video_info = get_video_info(app, video_path).await?;
    let (crop_w, crop_h, crop_x, crop_y) = calculate_crop_params(
        video_info.width, video_info.height, aspect_ratio
    );

    let crop_filter = format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y);
    let scale_filter = "scale=1080:1920:flags=lanczos";
    let vf = format!("{},{}", crop_filter, scale_filter);

    let mut args = vec![
        "-ss".to_string(), start.to_string(),
        "-i".to_string(), video_path.to_string(),
        "-t".to_string(), duration.to_string(),
        "-vf".to_string(), vf,
        "-c:v".to_string(), encoder.codec.clone(),
    ];

    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    // Audio filter
    let mut af_parts = Vec::new();
    if let Some(settings) = audio_settings {
        if settings.volume != 0.0 {
            af_parts.push(format!("volume={}dB", settings.volume));
        }
    }
    
    if !af_parts.is_empty() {
        args.push("-af".to_string());
        args.push(af_parts.join(","));
    }

    args.extend_from_slice(&[
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-r".to_string(), frame_rate.to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg crop failed: {}", stderr));
    }

    Ok(())
}

/// Burns subtitles onto a video file.
async fn burn_subtitles_to_video(
    app: &tauri::AppHandle,
    input_path: &std::path::Path,
    output_path: &std::path::Path,
    subtitle_path: &std::path::Path,
    quality: &str,
) -> Result<(), String> {
    let shell = app.shell();
    let encoder = detect_hardware_encoder(app, quality).await;

    let sub_arg = subtitle_path.to_string_lossy().replace("\\", "/").replace(":", "\\:");
    let vf_arg = format!("format=rgb24,ass='{}'", sub_arg);

    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;
    let fontconfig_path = paths.temp.join("fonts.conf");

    let mut args = vec![
        "-i".to_string(), input_path.to_string_lossy().to_string(),
        "-vf".to_string(), vf_arg,
        "-c:v".to_string(), encoder.codec.clone(),
    ];

    if let Some(preset) = &encoder.preset {
        args.push("-preset".to_string());
        args.push(preset.clone());
    }

    args.push(encoder.quality_param.clone());
    args.push(encoder.quality_value.clone());

    args.extend_from_slice(&[
        "-c:a".to_string(), "copy".to_string(),
        "-pix_fmt".to_string(), "yuv420p".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    let output = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .env("FONTCONFIG_FILE", fontconfig_path.to_string_lossy().to_string())
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to burn subtitles: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg subtitle burning failed: {}", stderr));
    }

    Ok(())
}

