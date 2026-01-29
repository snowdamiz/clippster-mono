use tauri_plugin_shell::ShellExt;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct VideoSource {
    pub source_path: String,
    pub start_time: f64,
    pub end_time: f64,
    pub trim_start: Option<f64>,
    pub trim_end: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct AudioTrack {
    pub file_path: String,
    pub start_time: f64,
    pub end_time: f64,
    pub volume: f64,
    pub is_muted: bool,
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
pub struct ExportConfig {
    pub video_sources: Vec<VideoSource>,
    pub audio_tracks: Vec<AudioTrack>,
    pub text_overlays: Vec<TextOverlay>,
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

    // Process video sources - concat if multiple, trim to timeline positions
    if config.video_sources.len() == 1 {
        let source = &config.video_sources[0];
        let trim_start = source.trim_start.unwrap_or(0.0);
        let trim_end = source.trim_end;
        let duration = source.end_time - source.start_time;
        
        // Build trim filter with optional end parameter
        let trim_filter = if let Some(end) = trim_end {
            format!("trim=start={}:end={}", trim_start, end)
        } else {
            format!("trim=start={}:duration={}", trim_start, duration)
        };
        
        // Trim video from source trim_start to trim_end (or duration)
        if needs_black_padding {
            // Pad with black frames at the end using tpad filter
            filters.push(format!(
                "[0:v]{},setpts=PTS-STARTPTS,tpad=stop_mode=add:stop_duration={}:color=black[v]",
                trim_filter, black_padding_duration
            ));
        } else {
            filters.push(format!("[0:v]{},setpts=PTS-STARTPTS[v]", trim_filter));
        }
        
        // Also trim video audio if it exists
        let audio_trim_filter = if let Some(end) = trim_end {
            format!("atrim=start={}:end={}", trim_start, end)
        } else {
            format!("atrim=start={}:duration={}", trim_start, duration)
        };
        filters.push(format!("[0:a]{},asetpts=PTS-STARTPTS[va]", audio_trim_filter));
    } else if config.video_sources.len() > 1 {
        // Concat multiple video sources
        let mut concat_inputs = String::new();
        for i in 0..config.video_sources.len() {
            let source = &config.video_sources[i];
            let trim_start = source.trim_start.unwrap_or(0.0);
            let trim_end = source.trim_end;
            let duration = source.end_time - source.start_time;
            
            // Trim each segment from trim_start to trim_end (or duration)
            let trim_filter = if let Some(end) = trim_end {
                format!("trim=start={}:end={}", trim_start, end)
            } else {
                format!("trim=start={}:duration={}", trim_start, duration)
            };
            filters.push(format!("[{}:v]{},setpts=PTS-STARTPTS[v{}]", i, trim_filter, i));
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
            let trim_end = source.trim_end;
            let duration = source.end_time - source.start_time;
            
            let audio_trim_filter = if let Some(end) = trim_end {
                format!("atrim=start={}:end={}", trim_start, end)
            } else {
                format!("atrim=start={}:duration={}", trim_start, duration)
            };
            filters.push(format!("[{}:a]{},asetpts=PTS-STARTPTS[va{}]", i, audio_trim_filter, i));
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
            
            // Trim audio to exact duration and apply volume
            let volume_filter = if (audio.volume - 1.0).abs() > 0.01 {
                format!(",volume={}", audio.volume)
            } else {
                String::new()
            };
            
            // Trim and reset PTS, then use adelay for timeline positioning
            // adelay needs milliseconds for both channels (stereo)
            if audio.start_time > 0.001 {
                let delay_ms = (audio.start_time * 1000.0) as i64;
                filters.push(format!(
                    "[{}:a]atrim=duration={},asetpts=PTS-STARTPTS{},adelay={}|{}:all=1[a{}]",
                    audio_index, duration, volume_filter, delay_ms, delay_ms, i
                ));
            } else {
                filters.push(format!(
                    "[{}:a]atrim=duration={},asetpts=PTS-STARTPTS{}[a{}]",
                    audio_index, duration, volume_filter, i
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
