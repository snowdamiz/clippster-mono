use tauri_plugin_shell::ShellExt;
use std::sync::{Arc, Mutex};
use futures::future::join_all;

use super::types::AspectRatio;
use super::encoder::{detect_hardware_encoder, get_quality_settings};
use super::video_info::{get_video_info, calculate_crop_params, calculate_crop_position, IntroOutroCache};
use super::font_manager::get_fonts_dir;

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
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>
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
        }

        // Clean up temporary files
        let _ = std::fs::remove_dir_all(&temp_dir);

        return Ok(());
    }

    // Original single-segment path (no intro/outro)
    // Detect hardware encoder for better performance
    let encoder = detect_hardware_encoder(app, quality).await;
    
    // Get fonts directory for subtitle rendering
    let fonts_dir = get_fonts_dir(app).ok();

    // Build video filter combining crop + subtitles in ONE PASS
    // Force RGB24 for accurate subtitle color rendering before applying ASS
    let mut vf_parts = vec![
        format!("crop={}:{}:{}:{}", crop_w, crop_h, crop_x, crop_y),
        "format=rgb24".to_string()
    ];
    
    if let Some(path) = subtitle_path {
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
    intro_outro_cache: Arc<Mutex<IntroOutroCache>>
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
    }

    // Clean up temporary files
    let _ = std::fs::remove_dir_all(&temp_dir);
    println!("[Rust] Multi-segment build successful, cleaned up temp files");

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

