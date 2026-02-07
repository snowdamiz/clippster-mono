use tauri_plugin_shell::ShellExt;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct VideoEffect {
    pub effect_type: String,
    pub enabled: bool,
    pub intensity: f64,
    pub params: std::collections::HashMap<String, serde_json::Value>,
}

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
    pub effects: Option<Vec<VideoEffect>>,
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
    pub image_path: String,
    pub start_time: f64,
    pub end_time: f64,
}

#[derive(Debug, Deserialize)]
pub struct StickerOverlay {
    pub image_path: String,
    pub start_time: f64,
    pub end_time: f64,
}

#[derive(Debug, Deserialize)]
pub struct EffectOverlay {
    pub effect_type: String,
    pub enabled: bool,
    pub intensity: f64,
    pub params: std::collections::HashMap<String, serde_json::Value>,
    pub start_time: f64,
    pub end_time: f64,
}

#[derive(Debug, Deserialize)]
pub struct ExportConfig {
    pub video_sources: Vec<VideoSource>,
    pub audio_tracks: Vec<AudioTrack>,
    pub text_overlays: Vec<TextOverlay>,
    pub sticker_overlays: Vec<StickerOverlay>,
    pub effect_overlays: Option<Vec<EffectOverlay>>,
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
    println!("  Effect overlays: {}", config.effect_overlays.as_ref().map_or(0, |v| v.len()));

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

    for text in &config.text_overlays {
        if !Path::new(&text.image_path).exists() {
            return Err(format!("Text overlay PNG not found: {}", text.image_path));
        }
    }

    for sticker in &config.sticker_overlays {
        if !Path::new(&sticker.image_path).exists() {
            return Err(format!("Sticker overlay PNG not found: {}", sticker.image_path));
        }
    }

    let shell = app.shell();

    // Probe each video source for audio streams using ffprobe
    let mut source_has_audio = Vec::new();
    for source in &config.video_sources {
        let probe_output = shell
            .command("ffprobe")
            .args(&[
                "-v", "quiet",
                "-select_streams", "a",
                "-show_entries", "stream=index",
                "-of", "csv=p=0",
                &source.source_path,
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to probe {}: {}", source.source_path, e))?;
        let has_audio = !String::from_utf8_lossy(&probe_output.stdout).trim().is_empty();
        println!("  Source '{}' has_audio: {}", source.source_path, has_audio);
        source_has_audio.push(has_audio);
    }

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

    // Add text overlay PNG inputs (pre-rendered by frontend canvas)
    for text in &config.text_overlays {
        args.push("-i".to_string());
        args.push(text.image_path.clone());
    }

    // Add sticker overlay PNG inputs (pre-rendered by frontend canvas)
    for sticker in &config.sticker_overlays {
        args.push("-i".to_string());
        args.push(sticker.image_path.clone());
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
        
        // Scale to cover canvas (cover-fit) preserving aspect ratio, then crop to exact canvas size
        // This fills the canvas and crops overflow, centered — matching the preview renderer
        if (scale - 1.0).abs() > 0.001 {
            let sw = (width as f64 * scale) as i32;
            let sh = (height as f64 * scale) as i32;
            transform_filters.push(format!("scale={}:{}:force_original_aspect_ratio=increase", sw, sh));
            transform_filters.push(format!("crop={}:{}:(iw-{})/2:(ih-{})/2", sw, sh, sw, sh));
        } else {
            transform_filters.push(format!("scale={}:{}:force_original_aspect_ratio=increase", width, height));
            transform_filters.push(format!("crop={}:{}:(iw-{})/2:(ih-{})/2", width, height, width, height));
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

    fn build_effects_filter(effects: &[VideoEffect]) -> String {
        let mut effect_filters = Vec::new();
        
        for effect in effects {
            if !effect.enabled {
                continue;
            }
            
            let get_f64 = |key: &str, default: f64| -> f64 {
                effect.params.get(key)
                    .and_then(|v| v.as_f64())
                    .unwrap_or(default)
            };
            
            match effect.effect_type.as_str() {
                "blur" => {
                    let radius = get_f64("radius", 8.0).max(1.0);
                    let luma = radius.round() as i32;
                    let chroma = (radius * 0.5).round().max(1.0) as i32;
                    effect_filters.push(format!("boxblur={}:{}:1", luma, chroma));
                }
                "pixelate" => {
                    let block_size = get_f64("blockSize", 12.0).max(2.0) as i32;
                    // Scale down then back up with nearest-neighbor
                    effect_filters.push(format!(
                        "scale=iw/{}:ih/{}:flags=fast_bilinear,scale=iw*{}:ih*{}:flags=neighbor",
                        block_size, block_size, block_size, block_size
                    ));
                }
                "sharpen" => {
                    let amount = get_f64("amount", 3.0).max(0.1);
                    // unsharp mask: luma_msize_x:luma_msize_y:luma_amount
                    effect_filters.push(format!("unsharp=5:5:{}", amount));
                }
                "vignette" => {
                    // FFmpeg vignette filter: angle in radians (PI/4 = standard)
                    let radius = get_f64("radius", 50.0);
                    let angle = (1.0 - radius / 100.0) * std::f64::consts::FRAC_PI_2;
                    effect_filters.push(format!("vignette=a={}", angle));
                }
                "sepia" => {
                    let i = effect.intensity / 100.0;
                    // Sepia color matrix blended with identity by intensity
                    let r0 = 1.0 * (1.0 - i) + 0.393 * i;
                    let r1 = 0.0 * (1.0 - i) + 0.769 * i;
                    let r2 = 0.0 * (1.0 - i) + 0.189 * i;
                    let g0 = 0.0 * (1.0 - i) + 0.349 * i;
                    let g1 = 1.0 * (1.0 - i) + 0.686 * i;
                    let g2 = 0.0 * (1.0 - i) + 0.168 * i;
                    let b0 = 0.0 * (1.0 - i) + 0.272 * i;
                    let b1 = 0.0 * (1.0 - i) + 0.534 * i;
                    let b2 = 0.0 * (1.0 - i) + 0.131 * i;
                    effect_filters.push(format!(
                        "colorchannelmixer={:.3}:{:.3}:{:.3}:0:{:.3}:{:.3}:{:.3}:0:{:.3}:{:.3}:{:.3}:0",
                        r0, r1, r2, g0, g1, g2, b0, b1, b2
                    ));
                }
                "grayscale" => {
                    let i = effect.intensity / 100.0;
                    let r0 = 1.0 * (1.0 - i) + 0.3 * i;
                    let r1 = 0.0 * (1.0 - i) + 0.59 * i;
                    let r2 = 0.0 * (1.0 - i) + 0.11 * i;
                    let g0 = 0.0 * (1.0 - i) + 0.3 * i;
                    let g1 = 1.0 * (1.0 - i) + 0.59 * i;
                    let g2 = 0.0 * (1.0 - i) + 0.11 * i;
                    let b0 = 0.0 * (1.0 - i) + 0.3 * i;
                    let b1 = 0.0 * (1.0 - i) + 0.59 * i;
                    let b2 = 0.0 * (1.0 - i) + 0.11 * i;
                    effect_filters.push(format!(
                        "colorchannelmixer={:.3}:{:.3}:{:.3}:0:{:.3}:{:.3}:{:.3}:0:{:.3}:{:.3}:{:.3}:0",
                        r0, r1, r2, g0, g1, g2, b0, b1, b2
                    ));
                }
                "negative" => {
                    let i = effect.intensity / 100.0;
                    if i > 0.99 {
                        effect_filters.push("negate".to_string());
                    } else {
                        // Partial invert via curves
                        let high = 1.0 - i;
                        let low = i;
                        effect_filters.push(format!(
                            "curves=r='0/{}:1/{}':g='0/{}:1/{}':b='0/{}:1/{}'",
                            low, high, low, high, low, high
                        ));
                    }
                }
                "colorShift" => {
                    let rx = get_f64("redOffsetX", 5.0) as i32;
                    let ry = get_f64("redOffsetY", 0.0) as i32;
                    let bx = get_f64("blueOffsetX", -5.0) as i32;
                    let by = get_f64("blueOffsetY", 0.0) as i32;
                    effect_filters.push(format!(
                        "rgbashift=rh={}:rv={}:bh={}:bv={}",
                        rx, ry, bx, by
                    ));
                }
                "glitch" => {
                    let color_bleed = get_f64("colorBleed", 40.0);
                    let shift = (color_bleed / 100.0 * 10.0).round() as i32;
                    // RGB shift + noise for glitch look
                    effect_filters.push(format!("rgbashift=rh={}:bh={}", shift, -shift));
                    let noise_amount = (effect.intensity / 100.0 * 30.0).round() as i32;
                    if noise_amount > 0 {
                        effect_filters.push(format!("noise=alls={}:allf=t", noise_amount));
                    }
                }
                "wave" => {
                    let amplitude = get_f64("amplitude", 10.0);
                    let frequency = get_f64("frequency", 3.0);
                    let speed = get_f64("speed", 2.0);
                    // geq-based sine wave displacement
                    effect_filters.push(format!(
                        "geq=lum='lum(X+{}*sin({}*PI*Y/H+{}*T)\\,Y)':cb='cb(X+{}*sin({}*PI*Y/H+{}*T)\\,Y)':cr='cr(X+{}*sin({}*PI*Y/H+{}*T)\\,Y)'",
                        amplitude, frequency * 2.0, speed * 2.0 * std::f64::consts::PI,
                        amplitude, frequency * 2.0, speed * 2.0 * std::f64::consts::PI,
                        amplitude, frequency * 2.0, speed * 2.0 * std::f64::consts::PI
                    ));
                }
                "zoomPulse" => {
                    let amount = get_f64("amount", 15.0) / 100.0;
                    let speed = get_f64("speed", 2.0);
                    // zoompan with sinusoidal zoom expression
                    effect_filters.push(format!(
                        "zoompan=z='1+{}*sin({}*PI*on/25)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={}x{}",
                        amount, speed, "iw", "ih"
                    ));
                }
                "flash" => {
                    let speed = get_f64("speed", 2.0);
                    let i = effect.intensity / 100.0 * 0.8;
                    // Flash via periodic brightness boost using eq filter
                    effect_filters.push(format!(
                        "eq=brightness='{}*max(0,sin({}*PI*t))'",
                        i, speed
                    ));
                }
                _ => {}
            }
        }
        
        effect_filters.join(",")
    }

    // Process video sources - concat if multiple, trim to timeline positions
    if config.video_sources.is_empty() {
        // No video sources — generate black video and silent audio for the full duration
        filters.push(format!(
            "color=c=black:s={}x{}:d={},format=yuv420p[v]",
            config.width, config.height, config.total_duration
        ));
        filters.push(format!(
            "anullsrc=r=48000:cl=stereo,atrim=duration={}[va]",
            config.total_duration
        ));
    } else if config.video_sources.len() == 1 {
        let source = &config.video_sources[0];
        let trim_start = source.trim_start.unwrap_or(0.0);
        let duration = source.end_time - source.start_time;
        let transform = build_video_transform_filter(source, config.width, config.height);
        let effects_str = source.effects.as_ref()
            .map(|fx| build_effects_filter(fx))
            .unwrap_or_default();
        let effects_suffix = if effects_str.is_empty() { String::new() } else { format!(",{}", effects_str) };
        
        // Trim video from source trim_start for exact duration, then apply transforms + effects
        if needs_black_padding {
            filters.push(format!(
                "[0:v]trim=start={}:duration={},setpts=PTS-STARTPTS,{}{},tpad=stop_mode=add:stop_duration={}:color=black[v]",
                trim_start, duration, transform, effects_suffix, black_padding_duration
            ));
        } else {
            filters.push(format!("[0:v]trim=start={}:duration={},setpts=PTS-STARTPTS,{}{}[v]", trim_start, duration, transform, effects_suffix));
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
        if source_has_audio[0] {
            filters.push(format!("[0:a]atrim=start={}:duration={},asetpts=PTS-STARTPTS{}[va]", trim_start, duration, audio_extras));
        } else {
            // No audio stream in video source — generate silent audio
            filters.push(format!("anullsrc=r=48000:cl=stereo,atrim=duration={}[va]", duration));
        }
    } else if config.video_sources.len() > 1 {
        // Concat multiple video sources
        let mut concat_inputs = String::new();
        for i in 0..config.video_sources.len() {
            let source = &config.video_sources[i];
            let trim_start = source.trim_start.unwrap_or(0.0);
            let duration = source.end_time - source.start_time;
            let transform = build_video_transform_filter(source, config.width, config.height);
            
            let effects_str = source.effects.as_ref()
                .map(|fx| build_effects_filter(fx))
                .unwrap_or_default();
            let effects_suffix = if effects_str.is_empty() { String::new() } else { format!(",{}", effects_str) };
            
            // Trim each segment from trim_start, apply transforms + effects
            filters.push(format!("[{}:v]trim=start={}:duration={},setpts=PTS-STARTPTS,{}{}[v{}]", i, trim_start, duration, transform, effects_suffix, i));
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
            if source_has_audio[i] {
                filters.push(format!("[{}:a]atrim=start={}:duration={},asetpts=PTS-STARTPTS{}[va{}]", i, trim_start, duration, audio_extras, i));
            } else {
                // No audio stream in this video source — generate silent audio
                filters.push(format!("anullsrc=r=48000:cl=stereo,atrim=duration={}[va{}]", duration, i));
            }
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

    // Add text overlays as image composites (pre-rendered PNGs from canvas)
    // Each text element was rendered to a transparent PNG by the frontend,
    // giving pixel-perfect preview-export parity for all effects (bubbles,
    // gradients, glow, stroke, etc.) that FFmpeg's drawtext cannot handle.
    let mut video_stream = "[v]".to_string();
    let existing_input_count = config.video_sources.len() + config.audio_tracks.len();
    
    for (i, text) in config.text_overlays.iter().enumerate() {
        let input_idx = existing_input_count + i;
        
        let next_stream = format!("[vt{}]", i);
        
        // Use overlay filter with enable expression for timing
        // The PNG is full canvas size with transparency, so overlay at 0:0
        filters.push(format!(
            "{}[{}:v]overlay=0:0:enable='between(t,{},{})'{}",
            video_stream,
            input_idx,
            text.start_time,
            text.end_time,
            next_stream
        ));
        
        video_stream = next_stream;
    }

    // Add sticker overlays as image composites (pre-rendered PNGs from canvas)
    // Stickers are rendered with position, scale, rotation, and opacity baked in.
    let sticker_input_offset = existing_input_count + config.text_overlays.len();

    for (i, sticker) in config.sticker_overlays.iter().enumerate() {
        let input_idx = sticker_input_offset + i;

        let next_stream = format!("[vs{}]", i);

        filters.push(format!(
            "{}[{}:v]overlay=0:0:enable='between(t,{},{})'{}",
            video_stream,
            input_idx,
            sticker.start_time,
            sticker.end_time,
            next_stream
        ));

        video_stream = next_stream;
    }

    // Apply effect overlays with enable expressions for time-based activation
    let effect_overlays = config.effect_overlays.unwrap_or_default();
    if !effect_overlays.is_empty() {
        for (i, effect_overlay) in effect_overlays.iter().enumerate() {
            if !effect_overlay.enabled { continue; }

            // Convert EffectOverlay to VideoEffect for reuse of build_effects_filter
            let ve = VideoEffect {
                effect_type: effect_overlay.effect_type.clone(),
                enabled: effect_overlay.enabled,
                intensity: effect_overlay.intensity,
                params: effect_overlay.params.clone(),
            };
            let effect_filter_str = build_effects_filter(&[ve]);
            if effect_filter_str.is_empty() { continue; }

            let is_last = i == effect_overlays.len() - 1
                && effect_overlays.iter().skip(i + 1).all(|e| !e.enabled || {
                    let ve2 = VideoEffect {
                        effect_type: e.effect_type.clone(),
                        enabled: e.enabled,
                        intensity: e.intensity,
                        params: e.params.clone(),
                    };
                    build_effects_filter(&[ve2]).is_empty()
                });

            let next_stream = if is_last {
                "[vout]".to_string()
            } else {
                format!("[vfx{}]", i)
            };

            // Use enable expression to only apply during the effect's time range
            // Wrap each filter with enable='between(t,start,end)'
            let enabled_filters: Vec<String> = effect_filter_str
                .split(',')
                .map(|f| format!("{}:enable='between(t,{},{})'", f.trim(), effect_overlay.start_time, effect_overlay.end_time))
                .collect();

            filters.push(format!(
                "{}{}{}",
                video_stream,
                enabled_filters.join(","),
                next_stream
            ));

            video_stream = next_stream;
        }
    }

    // If nothing produced [vout] yet, rename current stream
    if video_stream != "[vout]" {
        filters.push(format!("{}copy[vout]", video_stream));
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

/// Save a pre-rendered text overlay PNG to a temp file for FFmpeg compositing.
/// The frontend renders text with all effects (bubbles, glow, gradients, etc.)
/// to a transparent PNG on canvas, then passes the bytes here to save to disk.
/// Returns the absolute path to the saved PNG file.
#[tauri::command]
pub async fn save_text_overlay_png(
    png_bytes: Vec<u8>,
    element_id: String,
) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("clippster_text_overlays");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let file_name = format!("text_overlay_{}.png", element_id);
    let file_path = temp_dir.join(&file_name);

    std::fs::write(&file_path, &png_bytes)
        .map_err(|e| format!("Failed to write text overlay PNG: {}", e))?;

    println!("[Rust] Saved text overlay PNG: {} ({} bytes)", file_path.display(), png_bytes.len());
    Ok(file_path.to_string_lossy().to_string())
}
