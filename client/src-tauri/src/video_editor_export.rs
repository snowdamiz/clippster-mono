use tauri_plugin_shell::ShellExt;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct VideoSource {
    pub source_path: String,
    pub start_time: f64,
    pub end_time: f64,
    pub trim_start: Option<f64>,
    pub trim_end: Option<f64>,
    pub opacity: Option<f64>,
    pub scale: Option<f64>,
    pub position_x: Option<f64>,
    pub position_y: Option<f64>,
    pub rotation: Option<f64>,
    pub is_muted: Option<bool>,
    pub volume: Option<f64>,
    pub speed: Option<f64>,
    pub flip_horizontal: Option<bool>,
    pub flip_vertical: Option<bool>,
    pub brightness: Option<f64>,
    pub contrast: Option<f64>,
    pub saturation: Option<f64>,
    pub temperature: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct AudioTrack {
    pub file_path: String,
    pub start_time: f64,
    pub end_time: f64,
    pub volume: f64,
    pub is_muted: bool,
    pub speed: Option<f64>,
    pub fade_in: Option<f64>,
    pub fade_out: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct TextOverlay {
    pub text: String,
    pub start_time: f64,
    pub end_time: f64,
    pub position_x: f64,
    pub position_y: f64,
    pub style_data: String, // JSON string with font, size, color, etc.
}

#[derive(Debug, Deserialize)]
pub struct StickerOverlay {
    pub icon_url: String,
    pub start_time: f64,
    pub end_time: f64,
    pub opacity: Option<f64>,
    pub scale: Option<f64>,
    pub position_x: Option<f64>,
    pub position_y: Option<f64>,
    pub rotation: Option<f64>,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExportConfig {
    pub video_sources: Vec<VideoSource>,
    pub audio_tracks: Vec<AudioTrack>,
    pub text_overlays: Vec<TextOverlay>,
    pub sticker_overlays: Vec<StickerOverlay>,
    pub output_path: String,
    pub total_duration: f64,
    pub width: i32,
    pub height: i32,
}

/// Full video editor export with audio tracks, text overlays, and effects
#[tauri::command]
pub async fn export_video_editor_project(
    app: tauri::AppHandle,
    config: ExportConfig,
) -> Result<(), String> {
    use std::path::Path;

    println!("[Rust] Exporting video editor project (full)");
    println!("  Output: {}", config.output_path);
    println!("  Duration: {}s", config.total_duration);
    println!("  Video sources: {}", config.video_sources.len());
    println!("  Audio tracks: {}", config.audio_tracks.len());
    println!("  Text overlays: {}", config.text_overlays.len());
    println!("  Sticker overlays: {}", config.sticker_overlays.len());

    // Validate all input files exist
    for source in &config.video_sources {
        if !Path::new(&source.source_path).exists() {
            return Err(format!("Video source not found: {}", source.source_path));
        }
    }

    for audio in &config.audio_tracks {
        if !Path::new(&audio.file_path).exists() {
            return Err(format!("Audio file not found: {}", audio.file_path));
        }
    }

    let shell = app.shell();
    let mut args = vec!["-y".to_string()];

    // Add video inputs (no -ss here, do all trimming in filters for better accuracy)
    for source in &config.video_sources {
        args.push("-i".to_string());
        args.push(source.source_path.clone());
    }

    // Add audio inputs
    for audio in &config.audio_tracks {
        args.push("-i".to_string());
        args.push(audio.file_path.clone());
    }

    // Build filter_complex for video and audio processing
    let mut filters = Vec::new();
    let video_input_count = config.video_sources.len();
    let audio_input_count = config.audio_tracks.len();

    // Calculate video content duration (max end time of all video sources)
    let video_content_duration = config.video_sources.iter()
        .map(|s| s.end_time)
        .fold(0.0_f64, |a, b| a.max(b));
    
    // Check if we need to pad video with black frames (audio extends beyond video)
    let needs_black_padding = config.total_duration > video_content_duration;
    let black_padding_duration = if needs_black_padding {
        config.total_duration - video_content_duration
    } else {
        0.0
    };
    
    println!("  Video content duration: {}s", video_content_duration);
    println!("  Total duration: {}s", config.total_duration);
    println!("  Black padding needed: {}s", black_padding_duration);

    // Helper: build per-source video transform filters
    fn build_video_transform_filter(source: &VideoSource, width: i32, height: i32) -> String {
        let mut transform_filters = Vec::new();
        
        let opacity = source.opacity.unwrap_or(1.0);
        let scale = source.scale.unwrap_or(1.0);
        let pos_x = source.position_x.unwrap_or(0.0);
        let pos_y = source.position_y.unwrap_or(0.0);
        let rotation = source.rotation.unwrap_or(0.0);
        let speed = source.speed.unwrap_or(1.0);
        let flip_h = source.flip_horizontal.unwrap_or(false);
        let flip_v = source.flip_vertical.unwrap_or(false);
        let brightness = source.brightness.unwrap_or(0.0);
        let contrast = source.contrast.unwrap_or(0.0);
        let saturation = source.saturation.unwrap_or(0.0);
        let temperature = source.temperature.unwrap_or(0.0);
        
        // Speed via setpts (video only, audio handled separately)
        if (speed - 1.0).abs() > 0.001 {
            transform_filters.push(format!("setpts={}*PTS", 1.0 / speed));
        }
        
        // Scale to canvas size first, then apply user scale
        if (scale - 1.0).abs() > 0.001 {
            let sw = (width as f64 * scale) as i32;
            let sh = (height as f64 * scale) as i32;
            transform_filters.push(format!("scale={}:{}", sw, sh));
        } else {
            transform_filters.push(format!("scale={}:{}", width, height));
        }
        
        // Flip
        if flip_h {
            transform_filters.push("hflip".to_string());
        }
        if flip_v {
            transform_filters.push("vflip".to_string());
        }
        
        // Rotation (FFmpeg rotate filter uses radians)
        if rotation.abs() > 0.01 {
            let radians = rotation * std::f64::consts::PI / 180.0;
            transform_filters.push(format!("rotate={}:ow=rotw({}):oh=roth({}):fillcolor=none", radians, radians, radians));
        }
        
        // Position offset via pad+crop
        if pos_x.abs() > 0.5 || pos_y.abs() > 0.5 {
            let pad_w = width * 3;
            let pad_h = height * 3;
            let crop_x = width + pos_x as i32;
            let crop_y = height + pos_y as i32;
            transform_filters.push(format!("pad={}:{}:{}:{}:black", pad_w, pad_h, width, height));
            transform_filters.push(format!("crop={}:{}:{}:{}", width, height, crop_x, crop_y));
        }
        
        // Color adjustments via eq filter (brightness, contrast, saturation)
        let has_color = brightness.abs() > 0.5 || contrast.abs() > 0.5 || saturation.abs() > 0.5;
        if has_color {
            // FFmpeg eq: brightness -1..1 (we have -100..100), contrast 0..2 (we have -100..100), saturation 0..3 (we have -100..100)
            let eq_brightness = brightness / 100.0;
            let eq_contrast = 1.0 + contrast / 100.0;
            let eq_saturation = 1.0 + saturation / 100.0;
            transform_filters.push(format!("eq=brightness={}:contrast={}:saturation={}", eq_brightness, eq_contrast, eq_saturation));
        }
        
        // Temperature approximated via hue-rotate (colorbalance)
        if temperature.abs() > 0.5 {
            // Warm = more red/yellow, cool = more blue
            // Using colortemperature filter if available, otherwise hue shift
            let hue_shift = temperature * 0.3;
            transform_filters.push(format!("hue=h={}", hue_shift));
        }
        
        // Opacity via colorchannelmixer
        if (opacity - 1.0).abs() > 0.01 {
            transform_filters.push(format!("colorchannelmixer=aa={}", opacity));
        }
        
        transform_filters.join(",")
    }

    // Process video sources - concat if multiple, trim to timeline positions
    if config.video_sources.len() == 1 {
        let source = &config.video_sources[0];
        let trim_start = source.trim_start.unwrap_or(0.0);
        let duration = source.end_time - source.start_time;
        let transform = build_video_transform_filter(source, config.width, config.height);
        
        // Trim video from source trim_start for exact duration, then apply transforms
        if needs_black_padding {
            filters.push(format!(
                "[0:v]trim=start={}:duration={},setpts=PTS-STARTPTS,{},tpad=stop_mode=add:stop_duration={}:color=black[v]",
                trim_start, duration, transform, black_padding_duration
            ));
        } else {
            filters.push(format!("[0:v]trim=start={}:duration={},setpts=PTS-STARTPTS,{}[v]", trim_start, duration, transform));
        }
        
        // Also trim video audio if it exists (mute if flagged)
        let is_muted = source.is_muted.unwrap_or(false);
        let vol = source.volume.unwrap_or(1.0);
        let spd = source.speed.unwrap_or(1.0);
        let mut audio_extras = String::new();
        if is_muted {
            audio_extras.push_str(",volume=0");
        } else if (vol - 1.0).abs() > 0.01 {
            audio_extras.push_str(&format!(",volume={}", vol));
        }
        if (spd - 1.0).abs() > 0.001 {
            audio_extras.push_str(&format!(",atempo={}", spd));
        }
        filters.push(format!("[0:a]atrim=start={}:duration={},asetpts=PTS-STARTPTS{}[va]", trim_start, duration, audio_extras));
    } else if config.video_sources.len() > 1 {
        // Concat multiple video sources
        let mut concat_inputs = String::new();
        for i in 0..config.video_sources.len() {
            let source = &config.video_sources[i];
            let trim_start = source.trim_start.unwrap_or(0.0);
            let duration = source.end_time - source.start_time;
            let transform = build_video_transform_filter(source, config.width, config.height);
            
            // Trim each segment from trim_start, apply transforms
            filters.push(format!("[{}:v]trim=start={}:duration={},setpts=PTS-STARTPTS,{}[v{}]", i, trim_start, duration, transform, i));
            concat_inputs.push_str(&format!("[v{}]", i));
        }
        
        // Concat all video segments, then pad with black if needed
        if needs_black_padding {
            filters.push(format!(
                "{}concat=n={}:v=1:a=0,tpad=stop_mode=add:stop_duration={}:color=black[v]",
                concat_inputs, config.video_sources.len(), black_padding_duration
            ));
        } else {
            filters.push(format!("{}concat=n={}:v=1:a=0[v]", concat_inputs, config.video_sources.len()));
        }
        
        // Handle audio from video sources
        let mut audio_concat_inputs = String::new();
        for i in 0..config.video_sources.len() {
            let source = &config.video_sources[i];
            let trim_start = source.trim_start.unwrap_or(0.0);
            let duration = source.end_time - source.start_time;
            let is_muted = source.is_muted.unwrap_or(false);
            let vol = source.volume.unwrap_or(1.0);
            let spd = source.speed.unwrap_or(1.0);
            let mut audio_extras = String::new();
            if is_muted {
                audio_extras.push_str(",volume=0");
            } else if (vol - 1.0).abs() > 0.01 {
                audio_extras.push_str(&format!(",volume={}", vol));
            }
            if (spd - 1.0).abs() > 0.001 {
                audio_extras.push_str(&format!(",atempo={}", spd));
            }
            filters.push(format!("[{}:a]atrim=start={}:duration={},asetpts=PTS-STARTPTS{}[va{}]", i, trim_start, duration, audio_extras, i));
            audio_concat_inputs.push_str(&format!("[va{}]", i));
        }
        filters.push(format!("{}concat=n={}:v=0:a=1[va]", audio_concat_inputs, config.video_sources.len()));
    }

    // Process audio tracks - mix with video audio
    if audio_input_count > 0 {
        let mut audio_mix_inputs = vec!["[va]".to_string()];
        
        for (i, audio) in config.audio_tracks.iter().enumerate() {
            if audio.is_muted {
                continue;
            }
            
            let audio_index = video_input_count + i;
            let duration = audio.end_time - audio.start_time;
            let speed = audio.speed.unwrap_or(1.0);
            let fade_in = audio.fade_in.unwrap_or(0.0);
            let fade_out = audio.fade_out.unwrap_or(0.0);
            
            // Build audio filter chain
            let mut extras = String::new();
            
            // Volume
            if (audio.volume - 1.0).abs() > 0.01 {
                extras.push_str(&format!(",volume={}", audio.volume));
            }
            
            // Speed via atempo
            if (speed - 1.0).abs() > 0.001 {
                extras.push_str(&format!(",atempo={}", speed));
            }
            
            // Fade in
            if fade_in > 0.01 {
                extras.push_str(&format!(",afade=t=in:st=0:d={}", fade_in));
            }
            
            // Fade out
            if fade_out > 0.01 {
                let fade_start = (duration - fade_out).max(0.0);
                extras.push_str(&format!(",afade=t=out:st={}:d={}", fade_start, fade_out));
            }
            
            // Trim and reset PTS, then use adelay for timeline positioning
            if audio.start_time > 0.001 {
                let delay_ms = (audio.start_time * 1000.0) as i64;
                filters.push(format!(
                    "[{}:a]atrim=duration={},asetpts=PTS-STARTPTS{},adelay={}|{}:all=1[a{}]",
                    audio_index, duration, extras, delay_ms, delay_ms, i
                ));
            } else {
                filters.push(format!(
                    "[{}:a]atrim=duration={},asetpts=PTS-STARTPTS{}[a{}]",
                    audio_index, duration, extras, i
                ));
            }
            audio_mix_inputs.push(format!("[a{}]", i));
        }
        
        // Mix all audio streams
        if audio_mix_inputs.len() > 1 {
            filters.push(format!(
                "{}amix=inputs={}:duration=longest:dropout_transition=0[aout]",
                audio_mix_inputs.join(""),
                audio_mix_inputs.len()
            ));
        } else {
            // Just passthrough video audio
            filters.push("[va]anull[aout]".to_string());
        }
    } else {
        // No additional audio tracks, just use video audio
        filters.push("[va]anull[aout]".to_string());
    }

    // Add text overlays using drawtext filter
    let mut video_stream = "[v]".to_string();
    for (i, text) in config.text_overlays.iter().enumerate() {
        // Parse style_data JSON to get font properties
        let style: serde_json::Value = serde_json::from_str(&text.style_data)
            .unwrap_or(serde_json::json!({}));
        
        let font_size = style.get("fontSize").and_then(|v| v.as_i64()).unwrap_or(24);
        let font_color = style.get("color").and_then(|v| v.as_str()).unwrap_or("white");
        let font_family = style.get("fontFamily").and_then(|v| v.as_str()).unwrap_or("Arial");
        
        // Convert position from percentage to pixels
        let x = (text.position_x * config.width as f64) as i32;
        let y = (text.position_y * config.height as f64) as i32;
        
        // Escape text for FFmpeg
        let escaped_text = text.text.replace("'", "\\'").replace(":", "\\:");
        
        let next_stream = if i == config.text_overlays.len() - 1 {
            "[vout]".to_string()
        } else {
            format!("[vt{}]", i + 1)
        };
        
        // Add drawtext filter with enable expression for timing
        filters.push(format!(
            "{}drawtext=text='{}':fontfile=/path/to/fonts/{}:fontsize={}:fontcolor={}:x={}:y={}:enable='between(t,{},{})'{}",
            video_stream,
            escaped_text,
            font_family,
            font_size,
            font_color,
            x,
            y,
            text.start_time,
            text.end_time,
            next_stream
        ));
        
        video_stream = next_stream;
    }
    
    // If no text overlays, rename video output
    if config.text_overlays.is_empty() {
        filters.push("[v]copy[vout]".to_string());
    }

    // Add filter_complex argument
    if !filters.is_empty() {
        args.push("-filter_complex".to_string());
        args.push(filters.join(";"));
    }

    // Map output streams
    args.push("-map".to_string());
    args.push("[vout]".to_string());
    args.push("-map".to_string());
    args.push("[aout]".to_string());

    // Output encoding settings
    args.push("-c:v".to_string());
    args.push("libx264".to_string());
    args.push("-preset".to_string());
    args.push("medium".to_string());
    args.push("-crf".to_string());
    args.push("23".to_string());
    args.push("-c:a".to_string());
    args.push("aac".to_string());
    args.push("-b:a".to_string());
    args.push("192k".to_string());
    
    // Audio sync and quality settings
    args.push("-async".to_string());
    args.push("1".to_string());
    args.push("-vsync".to_string());
    args.push("cfr".to_string());
    
    args.push("-movflags".to_string());
    args.push("+faststart".to_string());
    
    // Set exact duration
    args.push("-t".to_string());
    args.push(config.total_duration.to_string());
    
    args.push(config.output_path.clone());

    println!("[Rust] FFmpeg command: ffmpeg {}", args.join(" "));

    // Execute FFmpeg
    let output = shell
        .command("ffmpeg")
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("[Rust] FFmpeg stderr: {}", stderr);
        return Err(format!("FFmpeg export failed: {}", stderr));
    }

    // Verify output file was created
    if !Path::new(&config.output_path).exists() {
        return Err("Export completed but output file not found".to_string());
    }

    println!("[Rust] Export completed successfully: {}", config.output_path);
    Ok(())
}

/// Simple video editor export - trim a single video source
/// This is a basic implementation for single-source projects without complex edits
#[tauri::command]
pub async fn export_video_editor_project_simple(
    app: tauri::AppHandle,
    source_path: String,
    output_path: String,
    start_time: f64,
    duration: f64,
) -> Result<(), String> {
    use std::path::Path;

    println!("[Rust] Exporting video editor project (simple)");
    println!("  Source: {}", source_path);
    println!("  Output: {}", output_path);
    println!("  Start: {}s, Duration: {}s", start_time, duration);

    // Validate input file exists
    if !Path::new(&source_path).exists() {
        return Err(format!("Source video not found: {}", source_path));
    }

    let shell = app.shell();

    // Build FFmpeg command for trimming and re-encoding
    let args = vec![
        "-y".to_string(),
        "-ss".to_string(),
        start_time.to_string(),
        "-i".to_string(),
        source_path.clone(),
        "-t".to_string(),
        duration.to_string(),
        "-c:v".to_string(),
        "libx264".to_string(),
        "-preset".to_string(),
        "medium".to_string(),
        "-crf".to_string(),
        "23".to_string(),
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        "192k".to_string(),
        "-movflags".to_string(),
        "+faststart".to_string(),
        output_path.clone(),
    ];

    println!("[Rust] FFmpeg command: ffmpeg {}", args.join(" "));

    // Execute FFmpeg
    let output = shell
        .command("ffmpeg")
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg export failed: {}", stderr));
    }

    // Verify output file was created
    if !Path::new(&output_path).exists() {
        return Err("Export completed but output file not found".to_string());
    }

    println!("[Rust] Export completed successfully: {}", output_path);
    Ok(())
}
