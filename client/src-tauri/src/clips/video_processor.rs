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

use super::types::{FramingStrategy, FramingMode, PanKeyframe};

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

    println!("[Rust] Building split screen clip with ratio: {}", layout.split_ratio);

    // Get video info for pixel calculations
    let video_info = get_video_info(app, video_path).await?;
    let source_w = video_info.width as f64;
    let source_h = video_info.height as f64;

    // Calculate output dimensions for 9:16
    let output_w: u32 = 1080;
    let output_h: u32 = 1920;

    // Calculate heights for each split
    let top_height = (output_h as f64 * layout.split_ratio) as u32;
    let bottom_height = output_h - top_height;

    // Calculate crop regions in pixels
    let top_crop = &layout.top_region;
    let bottom_crop = &layout.bottom_region;

    let top_x = (source_w * top_crop.x) as u32;
    let top_y = (source_h * top_crop.y) as u32;
    let top_w = (source_w * top_crop.width) as u32;
    let top_crop_h = (source_h * top_crop.height) as u32;

    let bottom_x = (source_w * bottom_crop.x) as u32;
    let bottom_y = (source_h * bottom_crop.y) as u32;
    let bottom_w = (source_w * bottom_crop.width) as u32;
    let bottom_crop_h = (source_h * bottom_crop.height) as u32;

    // Build complex filter for split screen
    let filter_complex = format!(
        "[0:v]split=2[top_src][bottom_src];\
        [top_src]crop={}:{}:{}:{},scale={}:{}[top];\
        [bottom_src]crop={}:{}:{}:{},scale={}:{}[bottom];\
        [top][bottom]vstack=inputs=2[outv]",
        top_w, top_crop_h, top_x, top_y, output_w, top_height,
        bottom_w, bottom_crop_h, bottom_x, bottom_y, output_w, bottom_height
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

    println!("[Rust] Building dynamic pan clip with {} keyframes", keyframes.len());

    // Get video info
    let video_info = get_video_info(app, video_path).await?;
    let source_w = video_info.width;
    let source_h = video_info.height;

    // Calculate crop dimensions for 9:16 output from 16:9 source
    let target_aspect = 9.0 / 16.0;
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

/// Builds a clip with framing strategy applied.
/// 
/// This is the main entry point that routes to the appropriate builder
/// based on the framing mode.
pub async fn build_clip_with_framing_strategy(
    app: &tauri::AppHandle,
    video_path: &str,
    output_path: &std::path::Path,
    segment: &serde_json::Value,
    strategy: &FramingStrategy,
    quality: &str,
    frame_rate: u32,
    subtitle_path: Option<&std::path::Path>,
    intro_path: Option<&str>,
    outro_path: Option<&str>,
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>,
    watermark_settings: Option<&WatermarkSettings>,
    audio_settings: Option<&AudioSettings>,
) -> Result<(), String> {
    println!("[Rust] Building clip with framing strategy: {:?}", strategy.mode);

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
                app, video_path, build_path, segment, strategy, quality, frame_rate, audio_settings
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
                app, video_path, build_path, segment, strategy, quality, frame_rate, audio_settings
            ).await?;

            // Add subtitles if needed
            if let (Some(temp), Some(sub_path)) = (&temp_output, subtitle_path) {
                burn_subtitles_to_video(app, temp, output_path, sub_path, quality).await?;
                let _ = std::fs::remove_file(temp);
            }
        },
        FramingMode::Static => {
            // Use existing static crop builder with strategy's crop region
            let aspect_ratio = super::types::AspectRatio {
                width: 9.0,
                height: 16.0,
            };
            
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
    
    println!("[Rust] Building multi-segment clip with framing strategy: {:?}", strategy.mode);
    println!("[Rust] Processing {} segments", segments.len());

    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    // Extract each segment with framing applied in parallel
    let temp_files: Vec<std::path::PathBuf> = segments.iter()
        .enumerate()
        .map(|(i, _)| paths.temp.join(format!("segment_framed_{}_{}.mp4", uuid::Uuid::new_v4(), i)))
        .collect();

    // Build each segment with framing strategy
    let segment_tasks: Vec<_> = segments.iter().enumerate().map(|(i, segment)| {
        let app = app.clone();
        let video_path = video_path.to_string();
        let temp_path = temp_files[i].clone();
        let strategy = strategy.clone();
        let quality = quality.to_string();
        let audio_settings = audio_settings.cloned();

        async move {
            println!("[Rust] Building framed segment {}/{}", i + 1, segments.len());
            
            match strategy.mode {
                FramingMode::SplitScreen => {
                    build_split_screen_clip(
                        &app, &video_path, &temp_path, segment, &strategy, &quality, frame_rate, audio_settings.as_ref()
                    ).await?;
                },
                FramingMode::DynamicPan => {
                    build_dynamic_pan_clip(
                        &app, &video_path, &temp_path, segment, &strategy, &quality, frame_rate, audio_settings.as_ref()
                    ).await?;
                },
                FramingMode::Static => {
                    // For static mode, use simple crop
                    let aspect_ratio = super::types::AspectRatio { width: 9.0, height: 16.0 };
                    extract_segment_with_crop(&app, &video_path, &temp_path, segment, &aspect_ratio, &quality, frame_rate, audio_settings.as_ref()).await?;
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

