use tauri_plugin_shell::ShellExt;

use serde::Deserialize;

#[derive(Debug, Deserialize)]

pub struct VideoEffect {
    pub effect_type: String,

    pub enabled: bool,

    pub intensity: f64,

    pub params: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
pub struct AnimationData {
    pub anim_type: String,
    pub duration: f64,
    pub easing: String,
}

#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
pub struct KeyframePoint {
    pub offset: f64,
    pub value: f64,
    pub interpolation: String,
}

#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
pub struct KeyframeTrack {
    pub property: String,
    pub keyframes: Vec<KeyframePoint>,
}

#[derive(Debug, Deserialize)]

pub struct VideoSource {
    pub source_path: String,

    pub start_time: f64,

    pub end_time: f64,

    pub trim_start: Option<f64>,

    #[allow(dead_code)]
    // Deserialized from frontend but not used in export filters (duration is computed from end_time - start_time)
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

    pub crop_top: Option<f64>,

    pub crop_right: Option<f64>,

    pub crop_bottom: Option<f64>,

    pub crop_left: Option<f64>,

    pub brightness: Option<f64>,

    pub contrast: Option<f64>,

    pub saturation: Option<f64>,

    pub temperature: Option<f64>,

    pub effects: Option<Vec<VideoEffect>>,

    pub is_image: Option<bool>,

    pub is_reversed: Option<bool>,

    pub fade_in: Option<f64>,

    pub fade_out: Option<f64>,

    #[allow(dead_code)]
    pub animation_in: Option<AnimationData>,

    #[allow(dead_code)]
    pub animation_out: Option<AnimationData>,

    #[allow(dead_code)]
    pub animation_loop: Option<AnimationData>,

    #[allow(dead_code)]
    pub keyframes: Option<Vec<KeyframeTrack>>,
}

#[derive(Debug, Deserialize)]
pub struct AudioEffect {
    pub effect_type: String,
    pub params: std::collections::HashMap<String, serde_json::Value>,
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

    pub audio_effects: Option<Vec<AudioEffect>>,
}

#[derive(Debug, Deserialize)]

pub struct TextOverlay {
    pub image_path: String,

    pub start_time: f64,

    pub end_time: f64,

    pub animation_in: Option<AnimationData>,

    pub animation_out: Option<AnimationData>,

    #[allow(dead_code)]
    pub animation_loop: Option<AnimationData>,
}

#[derive(Debug, Deserialize)]

pub struct StickerOverlay {
    pub image_path: String,

    pub start_time: f64,

    pub end_time: f64,

    pub animation_in: Option<AnimationData>,

    pub animation_out: Option<AnimationData>,

    #[allow(dead_code)]
    pub animation_loop: Option<AnimationData>,
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

pub struct BrandingWatermark {
    pub image_path: String,

    pub x: f64,

    pub y: f64,

    pub scale: f64,

    pub opacity: f64,

    pub is_full_frame: bool,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct BrandingOverlay {
    pub image_path: String,

    pub x: f64,

    pub y: f64,

    pub scale: f64,

    pub opacity: f64,

    pub rotation: f64,

    pub is_full_frame: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TransitionData {
    pub transition_type: String,
    pub duration: f64,
    pub target_element_index: usize,
    pub junction_time: f64,
}

#[derive(Debug, Deserialize)]

pub struct ExportConfig {
    pub video_sources: Vec<VideoSource>,

    pub audio_tracks: Vec<AudioTrack>,

    pub text_overlays: Vec<TextOverlay>,

    pub sticker_overlays: Vec<StickerOverlay>,

    pub effect_overlays: Option<Vec<EffectOverlay>>,

    pub transitions: Option<Vec<TransitionData>>,

    pub output_path: String,

    pub total_duration: f64,

    pub width: i32,

    pub height: i32,

    pub cover_timestamp: Option<f64>,

    pub branding_watermark: Option<BrandingWatermark>,

    pub branding_overlays: Option<Vec<BrandingOverlay>>,

    #[allow(dead_code)]
    pub intro_path: Option<String>,

    #[allow(dead_code)]
    pub intro_duration: Option<f64>,

    #[allow(dead_code)]
    pub outro_path: Option<String>,

    #[allow(dead_code)]
    pub outro_duration: Option<f64>,
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

    println!(
        "  Effect overlays: {}",
        config.effect_overlays.as_ref().map_or(0, |v| v.len())
    );

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
            return Err(format!(
                "Sticker overlay PNG not found: {}",
                sticker.image_path
            ));
        }
    }

    let shell = app.shell();

    // Probe each video source for audio streams using ffprobe

    let mut source_has_audio = Vec::new();

    for source in &config.video_sources {
        if source.is_image.unwrap_or(false) {
            // Image sources never have audio
            println!(
                "  Source '{}' is_image: true, has_audio: false",
                source.source_path
            );
            source_has_audio.push(false);
            continue;
        }

        let probe_output = shell
            .sidecar("ffprobe")
            .map_err(|e| format!("Failed to get ffprobe sidecar: {}", e))?
            .args(&[
                "-v",
                "quiet",
                "-select_streams",
                "a",
                "-show_entries",
                "stream=index",
                "-of",
                "csv=p=0",
                &source.source_path,
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to probe {}: {}", source.source_path, e))?;

        let has_audio = !String::from_utf8_lossy(&probe_output.stdout)
            .trim()
            .is_empty();

        println!("  Source '{}' has_audio: {}", source.source_path, has_audio);

        source_has_audio.push(has_audio);
    }

    let mut args = vec!["-y".to_string()];

    // Add video inputs (no -ss here, do all trimming in filters for better accuracy)

    for source in &config.video_sources {
        if source.is_image.unwrap_or(false) {
            // Image sources need -loop 1 to generate a continuous video stream
            args.push("-loop".to_string());
            args.push("1".to_string());
        }
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

    // Add branding watermark input

    if let Some(ref wm) = config.branding_watermark {
        if std::path::Path::new(&wm.image_path).exists() {
            args.push("-i".to_string());

            args.push(wm.image_path.clone());
        }
    }

    // Add branding overlay inputs

    if let Some(ref overlays) = config.branding_overlays {
        for overlay in overlays {
            if std::path::Path::new(&overlay.image_path).exists() {
                args.push("-i".to_string());

                args.push(overlay.image_path.clone());
            }
        }
    }

    // Build filter_complex for video and audio processing

    let mut filters = Vec::new();

    let video_input_count = config.video_sources.len();

    let audio_input_count = config.audio_tracks.len();

    // Calculate video content duration (max end time of all video sources)

    let video_content_duration = config
        .video_sources
        .iter()
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

    // Helper: build a piecewise-linear FFmpeg expression from keyframe points.
    // `duration` is the element duration in seconds, used to convert normalized offsets (0..1) to absolute time.
    // Returns an FFmpeg expression string using `t` as the time variable, e.g. "0.5+0.5*(t/2)" segments.
    fn build_keyframe_expression(
        keyframes: &[KeyframePoint],
        duration: f64,
        default_value: f64,
    ) -> Option<String> {
        if keyframes.is_empty() {
            return None;
        }
        if keyframes.len() == 1 {
            let v = keyframes[0].value;
            if (v - default_value).abs() < 0.001 {
                return None;
            }
            return Some(format!("{}", v));
        }

        // Build piecewise expression: if(lt(t,t1),lerp0, if(lt(t,t2),lerp1, ...))
        let mut parts = Vec::new();
        for i in 0..keyframes.len() - 1 {
            let kf0 = &keyframes[i];
            let kf1 = &keyframes[i + 1];
            let t0 = kf0.offset * duration;
            let t1 = kf1.offset * duration;
            let v0 = kf0.value;
            let v1 = kf1.value;

            if kf0.interpolation == "hold" {
                parts.push((t1, format!("{}", v0)));
            } else {
                // Linear interpolation: v0 + (v1-v0) * (t-t0)/(t1-t0)
                let dt = t1 - t0;
                if dt.abs() < 0.0001 {
                    parts.push((t1, format!("{}", v0)));
                } else {
                    let slope = (v1 - v0) / dt;
                    parts.push((t1, format!("{}+{}*(t-{})", v0, slope, t0)));
                }
            }
        }

        // Build nested if expression
        let last_val = keyframes.last().unwrap().value;
        let mut expr = format!("{}", last_val);
        for (t_end, segment_expr) in parts.iter().rev() {
            expr = format!("if(lt(t\\,{})\\,{}\\,{})", t_end, segment_expr, expr);
        }

        Some(expr)
    }

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

        let crop_top = source.crop_top.unwrap_or(0.0);

        let crop_right = source.crop_right.unwrap_or(0.0);

        let crop_bottom = source.crop_bottom.unwrap_or(0.0);

        let crop_left = source.crop_left.unwrap_or(0.0);

        let brightness = source.brightness.unwrap_or(0.0);

        let contrast = source.contrast.unwrap_or(0.0);

        let saturation = source.saturation.unwrap_or(0.0);

        let temperature = source.temperature.unwrap_or(0.0);

        // Speed via setpts (video only, audio handled separately)

        if (speed - 1.0).abs() > 0.001 {
            transform_filters.push(format!("setpts={}*PTS", 1.0 / speed));
        }

        // Reverse video playback
        if source.is_reversed.unwrap_or(false) {
            transform_filters.push("reverse".to_string());
        }

        // Crop (applied before scale so we crop the source, then fit to canvas)

        // Values are 0-1 fractions of source dimensions

        let has_crop =
            crop_top > 0.001 || crop_right > 0.001 || crop_bottom > 0.001 || crop_left > 0.001;

        if has_crop {
            // crop=w:h:x:y using FFmpeg expressions with iw/ih

            let mut crop_w = 1.0 - crop_left - crop_right;

            let mut crop_h = 1.0 - crop_top - crop_bottom;

            // Validate crop dimensions to prevent FFmpeg errors
            // Ensure crop_w and crop_h are positive and result in valid dimensions
            const MIN_CROP_FRACTION: f64 = 0.01; // Minimum 1% of source dimension

            if crop_w <= 0.0 {
                eprintln!(
                    "[WARN] Invalid crop width: crop_left={}, crop_right={}, crop_w={}. Clamping to minimum.",
                    crop_left, crop_right, crop_w
                );
                crop_w = MIN_CROP_FRACTION;
            } else if crop_w < MIN_CROP_FRACTION {
                eprintln!(
                    "[WARN] Crop width too small: {}. Clamping to minimum {}.",
                    crop_w, MIN_CROP_FRACTION
                );
                crop_w = MIN_CROP_FRACTION;
            }

            if crop_h <= 0.0 {
                eprintln!(
                    "[WARN] Invalid crop height: crop_top={}, crop_bottom={}, crop_h={}. Clamping to minimum.",
                    crop_top, crop_bottom, crop_h
                );
                crop_h = MIN_CROP_FRACTION;
            } else if crop_h < MIN_CROP_FRACTION {
                eprintln!(
                    "[WARN] Crop height too small: {}. Clamping to minimum {}.",
                    crop_h, MIN_CROP_FRACTION
                );
                crop_h = MIN_CROP_FRACTION;
            }

            // Ensure crop_w and crop_h don't exceed 1.0
            crop_w = crop_w.min(1.0);
            crop_h = crop_h.min(1.0);

            transform_filters.push(format!(
                "crop=iw*{}:ih*{}:iw*{}:ih*{}",
                crop_w, crop_h, crop_left, crop_top
            ));
        }

        // Scale to fit canvas (contain-fit) preserving aspect ratio, then pad to exact canvas size

        // This produces letterboxing/pillarboxing when video AR differs from canvas AR

        // CRITICAL: pad must use canvas dimensions (width x height) to ensure concat gets uniform inputs

        if (scale - 1.0).abs() > 0.001 {
            // Scale to the zoomed box size, then ensure output is always canvas-sized.
            // Zoom in (scale>1): content is larger than canvas → pad then crop to canvas.
            // Zoom out (scale<1): content is smaller than canvas → pad up to canvas.
            let sw = (((width as f64 * scale) as i32) / 2) * 2; // ensure even
            let sh = (((height as f64 * scale) as i32) / 2) * 2;

            transform_filters.push(format!(
                "scale={}:{}:force_original_aspect_ratio=decrease",
                sw, sh
            ));

            // Pad to at least canvas dimensions (handles zoom-out where sw < width)
            let pad_w = sw.max(width);
            let pad_h = sh.max(height);
            transform_filters.push(format!(
                "pad={}:{}:(ow-iw)/2:(oh-ih)/2:black",
                pad_w, pad_h
            ));

            // Crop back to exact canvas size (handles zoom-in where sw > width)
            if pad_w != width || pad_h != height {
                transform_filters.push(format!(
                    "crop={}:{}:(iw-{})/2:(ih-{})/2",
                    width, height, width, height
                ));
            }
        } else {
            transform_filters.push(format!(
                "scale={}:{}:force_original_aspect_ratio=decrease",
                width, height
            ));

            transform_filters.push(format!(
                "pad={}:{}:(ow-iw)/2:(oh-ih)/2:black",
                width, height
            ));
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

            transform_filters.push(format!(
                "rotate={}:ow=rotw({}):oh=roth({}):fillcolor=none",
                radians, radians, radians
            ));
        }

        // Position offset via pad+crop

        if pos_x.abs() > 0.5 || pos_y.abs() > 0.5 {
            let pad_w = width * 3;

            let pad_h = height * 3;

            let crop_x = width + pos_x as i32;

            let crop_y = height + pos_y as i32;

            transform_filters.push(format!(
                "pad={}:{}:{}:{}:black",
                pad_w, pad_h, width, height
            ));

            transform_filters.push(format!("crop={}:{}:{}:{}", width, height, crop_x, crop_y));
        }

        // Color adjustments via eq filter (brightness, contrast, saturation)

        let has_color = brightness.abs() > 0.5 || contrast.abs() > 0.5 || saturation.abs() > 0.5;

        if has_color {
            // FFmpeg eq: brightness -1..1 (we have -100..100), contrast 0..2 (we have -100..100), saturation 0..3 (we have -100..100)

            let eq_brightness = brightness / 100.0;

            let eq_contrast = 1.0 + contrast / 100.0;

            let eq_saturation = 1.0 + saturation / 100.0;

            transform_filters.push(format!(
                "eq=brightness={}:contrast={}:saturation={}",
                eq_brightness, eq_contrast, eq_saturation
            ));
        }

        // Temperature approximated via hue-rotate (colorbalance)

        if temperature.abs() > 0.5 {
            // Warm = more red/yellow, cool = more blue

            // Using colortemperature filter if available, otherwise hue shift

            let hue_shift = temperature * 0.3;

            transform_filters.push(format!("hue=h={}", hue_shift));
        }

        // Opacity via colorchannelmixer — with keyframe support
        let duration = source.end_time - source.start_time;
        let opacity_kf = source.keyframes.as_ref().and_then(|tracks| {
            tracks
                .iter()
                .find(|t| t.property == "opacity" && !t.keyframes.is_empty())
        });

        if let Some(kf_track) = opacity_kf {
            // Build piecewise-linear opacity expression from keyframes
            let expr = build_keyframe_expression(&kf_track.keyframes, duration, opacity);
            if let Some(expr_str) = expr {
                transform_filters.push(format!("colorchannelmixer=aa='{}'", expr_str));
            } else if (opacity - 1.0).abs() > 0.01 {
                transform_filters.push(format!("colorchannelmixer=aa={}", opacity));
            }
        } else if (opacity - 1.0).abs() > 0.01 {
            transform_filters.push(format!("colorchannelmixer=aa={}", opacity));
        }

        // Video fade in/out
        let fade_in = source.fade_in.unwrap_or(0.0);
        let fade_out = source.fade_out.unwrap_or(0.0);

        if fade_in > 0.01 {
            transform_filters.push(format!("fade=t=in:st=0:d={}", fade_in));
        }

        if fade_out > 0.01 {
            let fade_start = (duration - fade_out).max(0.0);
            transform_filters.push(format!("fade=t=out:st={}:d={}", fade_start, fade_out));
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
                effect
                    .params
                    .get(key)
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

                    effect_filters
                        .push(format!("rgbashift=rh={}:rv={}:bh={}:bv={}", rx, ry, bx, by));
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

                    effect_filters
                        .push(format!("eq=brightness='{}*max(0,sin({}*PI*t))'", i, speed));
                }

                _ => {}
            }
        }

        effect_filters.join(",")
    }

    fn map_transition_type(editor_type: &str) -> &str {
        match editor_type {
            "crossfade" | "dissolve" => "fade",
            "fadeToBlack" => "fadeblack",
            "fadeToWhite" => "fadewhite",
            "wipeLeft" => "wipeleft",
            "wipeRight" => "wiperight",
            "wipeUp" => "wipeup",
            "wipeDown" => "wipedown",
            "slideLeft" => "slideleft",
            "slideRight" => "slideright",
            "slideUp" => "slideup",
            "slideDown" => "slidedown",
            "circleWipe" => "circleopen",
            "diamondWipe" => "diagtl",
            "clockWipe" => "radial",
            _ => "fade",
        }
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

        let effects_str = source
            .effects
            .as_ref()
            .map(|fx| build_effects_filter(fx))
            .unwrap_or_default();

        let effects_suffix = if effects_str.is_empty() {
            String::new()
        } else {
            format!(",{}", effects_str)
        };

        // Trim video from source trim_start for exact duration, then apply transforms + effects

        if needs_black_padding {
            filters.push(format!(

                "[0:v]trim=start={}:duration={},setpts=PTS-STARTPTS,{}{},tpad=stop_mode=add:stop_duration={}:color=black[v]",

                trim_start, duration, transform, effects_suffix, black_padding_duration

            ));
        } else {
            filters.push(format!(
                "[0:v]trim=start={}:duration={},setpts=PTS-STARTPTS,{}{}[v]",
                trim_start, duration, transform, effects_suffix
            ));
        }

        // Also trim video audio if it exists (mute if flagged)

        let is_muted = source.is_muted.unwrap_or(false);

        let vol = source.volume.unwrap_or(1.0);

        let spd = source.speed.unwrap_or(1.0);

        let mut audio_extras = String::new();

        if is_muted {
            audio_extras.push_str(",volume=0");
        } else {
            // Check for volume keyframes
            let vol_kf = source.keyframes.as_ref().and_then(|tracks| {
                tracks
                    .iter()
                    .find(|t| t.property == "volume" && !t.keyframes.is_empty())
            });
            if let Some(kf_track) = vol_kf {
                let expr = build_keyframe_expression(&kf_track.keyframes, duration, vol);
                if let Some(expr_str) = expr {
                    audio_extras.push_str(&format!(",volume='{}'", expr_str));
                } else if (vol - 1.0).abs() > 0.01 {
                    audio_extras.push_str(&format!(",volume={}", vol));
                }
            } else if (vol - 1.0).abs() > 0.01 {
                audio_extras.push_str(&format!(",volume={}", vol));
            }
        }

        if (spd - 1.0).abs() > 0.001 {
            audio_extras.push_str(&format!(",atempo={}", spd));
        }

        if source.is_reversed.unwrap_or(false) {
            audio_extras.push_str(",areverse");
        }

        if source_has_audio[0] {
            filters.push(format!(
                "[0:a]atrim=start={}:duration={},asetpts=PTS-STARTPTS{}[va]",
                trim_start, duration, audio_extras
            ));
        } else {
            // No audio stream in video source — generate silent audio

            filters.push(format!(
                "anullsrc=r=48000:cl=stereo,atrim=duration={}[va]",
                duration
            ));
        }
    } else if config.video_sources.len() > 1 {
        // Multi-source timeline: support per-junction transitions with centered overlap.
        // We extend clip drawable ranges by half-duration on each side (clone edge frames)
        // so centered transitions don't cut to black when handles are missing.

        let source_count = config.video_sources.len();
        let mut before_ext = vec![0.0_f64; source_count];
        let mut after_ext = vec![0.0_f64; source_count];

        let mut transitions = config.transitions.clone().unwrap_or_default();
        transitions.sort_by_key(|t| t.target_element_index);

        for t in &transitions {
            if t.target_element_index == 0 || t.target_element_index >= source_count {
                continue;
            }
            let half = (t.duration / 2.0).max(0.0);
            let incoming_idx = t.target_element_index;
            let outgoing_idx = incoming_idx - 1;
            before_ext[incoming_idx] = before_ext[incoming_idx].max(half);
            after_ext[outgoing_idx] = after_ext[outgoing_idx].max(half);
        }

        for i in 0..source_count {
            let source = &config.video_sources[i];

            let trim_start = source.trim_start.unwrap_or(0.0);
            let duration = source.end_time - source.start_time;
            let transform = build_video_transform_filter(source, config.width, config.height);

            let effects_str = source
                .effects
                .as_ref()
                .map(|fx| build_effects_filter(fx))
                .unwrap_or_default();

            let effects_suffix = if effects_str.is_empty() {
                String::new()
            } else {
                format!(",{}", effects_str)
            };

            let mut chain = format!(
                "[{}:v]trim=start={}:duration={},setpts=PTS-STARTPTS,{}{}",
                i, trim_start, duration, transform, effects_suffix
            );

            let before = before_ext[i];
            let after = after_ext[i];
            if before > 0.0001 || after > 0.0001 {
                chain.push_str(&format!(
                    ",tpad=start_mode=clone:start_duration={}:stop_mode=clone:stop_duration={}",
                    before, after
                ));
            }

            chain.push_str(&format!("[v{}]", i));
            filters.push(chain);
        }

        let has_transitions = !transitions.is_empty();
        if has_transitions {
            let mut current_stream = "[v0]".to_string();

            for i in 1..source_count {
                let transition = transitions
                    .iter()
                    .find(|t| t.target_element_index == i && t.duration > 0.0);

                let output_label = if i == source_count - 1 {
                    "[v_chain]".to_string()
                } else {
                    format!("[v_chain{}]", i)
                };

                if let Some(t) = transition {
                    let ffmpeg_transition = map_transition_type(&t.transition_type);
                    let offset = (t.junction_time - t.duration / 2.0).max(0.0);

                    filters.push(format!(
                        "{}[v{}]xfade=transition={}:duration={}:offset={}{}",
                        current_stream, i, ffmpeg_transition, t.duration, offset, output_label
                    ));
                } else {
                    filters.push(format!(
                        "{}[v{}]concat=n=2:v=1:a=0{}",
                        current_stream, i, output_label
                    ));
                }

                current_stream = output_label;
            }

            if needs_black_padding {
                filters.push(format!(
                    "{}tpad=stop_mode=add:stop_duration={}:color=black[v]",
                    current_stream, black_padding_duration
                ));
            } else {
                filters.push(format!("{}copy[v]", current_stream));
            }
        } else {
            let concat_inputs: String = (0..source_count).map(|i| format!("[v{}]", i)).collect();
            if needs_black_padding {
                filters.push(format!(
                    "{}concat=n={}:v=1:a=0,tpad=stop_mode=add:stop_duration={}:color=black[v]",
                    concat_inputs, source_count, black_padding_duration
                ));
            } else {
                filters.push(format!("{}concat=n={}:v=1:a=0[v]", concat_inputs, source_count));
            }
        }

        // Handle audio from video sources (still concatenated; transition audio crossfade is TODO)
        let mut audio_concat_inputs = String::new();

        for i in 0..source_count {
            let source = &config.video_sources[i];

            let trim_start = source.trim_start.unwrap_or(0.0);
            let duration = source.end_time - source.start_time;
            let is_muted = source.is_muted.unwrap_or(false);
            let vol = source.volume.unwrap_or(1.0);
            let spd = source.speed.unwrap_or(1.0);

            let mut audio_extras = String::new();

            if is_muted {
                audio_extras.push_str(",volume=0");
            } else {
                let vol_kf = source.keyframes.as_ref().and_then(|tracks| {
                    tracks
                        .iter()
                        .find(|t| t.property == "volume" && !t.keyframes.is_empty())
                });
                if let Some(kf_track) = vol_kf {
                    let expr = build_keyframe_expression(&kf_track.keyframes, duration, vol);
                    if let Some(expr_str) = expr {
                        audio_extras.push_str(&format!(",volume='{}'", expr_str));
                    } else if (vol - 1.0).abs() > 0.01 {
                        audio_extras.push_str(&format!(",volume={}", vol));
                    }
                } else if (vol - 1.0).abs() > 0.01 {
                    audio_extras.push_str(&format!(",volume={}", vol));
                }
            }

            if (spd - 1.0).abs() > 0.001 {
                audio_extras.push_str(&format!(",atempo={}", spd));
            }

            if source.is_reversed.unwrap_or(false) {
                audio_extras.push_str(",areverse");
            }

            if source_has_audio[i] {
                filters.push(format!(
                    "[{}:a]atrim=start={}:duration={},asetpts=PTS-STARTPTS{}[va{}]",
                    i, trim_start, duration, audio_extras, i
                ));
            } else {
                filters.push(format!(
                    "anullsrc=r=48000:cl=stereo,atrim=duration={}[va{}]",
                    duration, i
                ));
            }

            audio_concat_inputs.push_str(&format!("[va{}]", i));
        }

        filters.push(format!(
            "{}concat=n={}:v=0:a=1[va]",
            audio_concat_inputs, source_count
        ));
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

            // Audio effects (EQ, compressor, reverb, noise reduction, filters, etc.)
            if let Some(ref effects) = audio.audio_effects {
                for fx in effects {
                    let get_f64 = |key: &str, default: f64| -> f64 {
                        fx.params
                            .get(key)
                            .and_then(|v| v.as_f64())
                            .unwrap_or(default)
                    };
                    match fx.effect_type.as_str() {
                        "eq" => {
                            let low = get_f64("lowGain", 0.0);
                            let mid = get_f64("midGain", 0.0);
                            let high = get_f64("highGain", 0.0);
                            let mid_freq = get_f64("midFreq", 1000.0);
                            if low.abs() > 0.1 {
                                extras.push_str(&format!(",equalizer=f=100:t=h:w=200:g={}", low));
                            }
                            if mid.abs() > 0.1 {
                                extras.push_str(&format!(
                                    ",equalizer=f={}:t=h:w=500:g={}",
                                    mid_freq, mid
                                ));
                            }
                            if high.abs() > 0.1 {
                                extras
                                    .push_str(&format!(",equalizer=f=8000:t=h:w=2000:g={}", high));
                            }
                        }
                        "compressor" => {
                            let threshold = get_f64("threshold", -20.0);
                            let ratio = get_f64("ratio", 4.0);
                            let attack = get_f64("attack", 20.0) / 1000.0; // ms to seconds
                            let release = get_f64("release", 250.0) / 1000.0;
                            extras.push_str(&format!(
                                ",acompressor=threshold={}dB:ratio={}:attack={}:release={}",
                                threshold, ratio, attack, release
                            ));
                        }
                        "lowpass" => {
                            let freq = get_f64("frequency", 4000.0);
                            extras.push_str(&format!(",lowpass=f={}", freq));
                        }
                        "highpass" => {
                            let freq = get_f64("frequency", 200.0);
                            extras.push_str(&format!(",highpass=f={}", freq));
                        }
                        "bandpass" => {
                            let freq = get_f64("frequency", 1000.0);
                            let bw = get_f64("bandwidth", 2.0);
                            extras.push_str(&format!(",bandpass=f={}:w={}", freq, bw));
                        }
                        "noiseReduction" => {
                            let strength = get_f64("strength", 50.0);
                            // afftdn noise floor in dB: strength 0-100 maps to -20..-80 dB
                            let nf = -20.0 - (strength / 100.0) * 60.0;
                            extras.push_str(&format!(",afftdn=nf={}", nf));
                        }
                        "noisegate" => {
                            let threshold = get_f64("threshold", -40.0);
                            let attack = get_f64("attack", 10.0) / 1000.0;
                            let release = get_f64("release", 100.0) / 1000.0;
                            extras.push_str(&format!(
                                ",agate=threshold={}dB:attack={}:release={}",
                                threshold, attack, release
                            ));
                        }
                        "limiter" => {
                            let ceiling = get_f64("ceiling", -1.0);
                            let limit_linear = 10.0_f64.powf(ceiling / 20.0);
                            extras.push_str(&format!(",alimiter=limit={}", limit_linear));
                        }
                        "bassBoost" => {
                            let gain = get_f64("gain", 6.0);
                            let freq = get_f64("frequency", 100.0);
                            extras.push_str(&format!(",equalizer=f={}:t=h:w=80:g={}", freq, gain));
                        }
                        "echo" => {
                            let delay_ms = get_f64("delayMs", 500.0);
                            let decay = get_f64("decay", 0.5);
                            extras.push_str(&format!(",aecho=0.8:0.88:{}:{}", delay_ms, decay));
                        }
                        "tremolo" => {
                            let rate = get_f64("rate", 5.0);
                            let depth = get_f64("depth", 50.0) / 100.0;
                            extras.push_str(&format!(",tremolo=f={}:d={}", rate, depth));
                        }
                        "chorus" => {
                            let depth = get_f64("depth", 50.0) / 100.0 * 4.0; // 0-4ms
                            let rate = get_f64("rate", 1.5);
                            extras.push_str(&format!(
                                ",chorus=0.5:0.9:50|60:{}|{}:0.25|0.4:{}|{}",
                                depth,
                                depth + 1.0,
                                rate,
                                rate * 1.3
                            ));
                        }
                        "deesser" => {
                            let freq = get_f64("frequency", 6000.0);
                            // De-ess via bandreject on sibilant frequencies
                            extras.push_str(&format!(",bandreject=f={}:w=2000", freq));
                        }
                        "telephone" => {
                            // Bandpass 300-3400 Hz to simulate telephone
                            extras.push_str(",highpass=f=300,lowpass=f=3400");
                        }
                        "radio" => {
                            // Bandpass 500-5000 Hz + slight distortion
                            extras.push_str(",highpass=f=500,lowpass=f=5000");
                        }
                        "vocalEnhance" => {
                            let presence = get_f64("presence", 50.0);
                            let clarity = get_f64("clarity", 50.0);
                            // Boost presence range (2-5kHz) and clarity range (5-10kHz)
                            if presence > 5.0 {
                                let gain = presence / 100.0 * 6.0;
                                extras
                                    .push_str(&format!(",equalizer=f=3500:t=h:w=2000:g={}", gain));
                            }
                            if clarity > 5.0 {
                                let gain = clarity / 100.0 * 4.0;
                                extras
                                    .push_str(&format!(",equalizer=f=7000:t=h:w=3000:g={}", gain));
                            }
                        }
                        "distortion" => {
                            let drive = get_f64("drive", 50.0);
                            // Overdrive via volume boost + hard clip
                            let gain = 1.0 + drive / 100.0 * 10.0;
                            extras.push_str(&format!(",volume={}:precision=fixed", gain));
                        }
                        "reverb" | "delay" | "pitchShift" => {
                            // These require complex filter graphs or external tools
                            // Silently skip for now — they work in preview via Web Audio
                            println!(
                                "[Rust] Audio effect '{}' not yet supported in export, skipping",
                                fx.effect_type
                            );
                        }
                        _ => {
                            println!(
                                "[Rust] Unknown audio effect type '{}', skipping",
                                fx.effect_type
                            );
                        }
                    }
                }
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
        let overlay_duration = text.end_time - text.start_time;

        // Check if we need to apply fade animations on the overlay input
        let has_fade_in = text
            .animation_in
            .as_ref()
            .map_or(false, |a| a.duration > 0.01);
        let has_fade_out = text
            .animation_out
            .as_ref()
            .map_or(false, |a| a.duration > 0.01);

        if has_fade_in || has_fade_out {
            // Pre-process the PNG overlay: loop it into a video stream, apply fade, then overlay
            let prep_label = format!("[tp{}]", i);
            let mut fade_filters = format!(
                "[{}:v]format=rgba,loop=loop=-1:size=1,setpts=N/25/TB,trim=duration={}",
                input_idx, overlay_duration
            );
            if has_fade_in {
                let d = text.animation_in.as_ref().unwrap().duration;
                fade_filters.push_str(&format!(",fade=t=in:st=0:d={}:alpha=1", d));
            }
            if has_fade_out {
                let d = text.animation_out.as_ref().unwrap().duration;
                let fade_start = (overlay_duration - d).max(0.0);
                fade_filters.push_str(&format!(",fade=t=out:st={}:d={}:alpha=1", fade_start, d));
            }
            fade_filters.push_str(&prep_label);
            filters.push(fade_filters);

            filters.push(format!(
                "{}{}overlay=0:0:enable='between(t,{},{})'{}",
                video_stream, prep_label, text.start_time, text.end_time, next_stream
            ));
        } else {
            filters.push(format!(
                "{}[{}:v]overlay=0:0:enable='between(t,{},{})'{}",
                video_stream, input_idx, text.start_time, text.end_time, next_stream
            ));
        }

        video_stream = next_stream;
    }

    // Add sticker overlays as image composites (pre-rendered PNGs from canvas)

    // Stickers are rendered with position, scale, rotation, and opacity baked in.

    let sticker_input_offset = existing_input_count + config.text_overlays.len();

    for (i, sticker) in config.sticker_overlays.iter().enumerate() {
        let input_idx = sticker_input_offset + i;
        let next_stream = format!("[vs{}]", i);
        let overlay_duration = sticker.end_time - sticker.start_time;

        // Check if we need to apply fade animations on the overlay input
        let has_fade_in = sticker
            .animation_in
            .as_ref()
            .map_or(false, |a| a.duration > 0.01);
        let has_fade_out = sticker
            .animation_out
            .as_ref()
            .map_or(false, |a| a.duration > 0.01);

        if has_fade_in || has_fade_out {
            let prep_label = format!("[sp{}]", i);
            let mut fade_filters = format!(
                "[{}:v]format=rgba,loop=loop=-1:size=1,setpts=N/25/TB,trim=duration={}",
                input_idx, overlay_duration
            );
            if has_fade_in {
                let d = sticker.animation_in.as_ref().unwrap().duration;
                fade_filters.push_str(&format!(",fade=t=in:st=0:d={}:alpha=1", d));
            }
            if has_fade_out {
                let d = sticker.animation_out.as_ref().unwrap().duration;
                let fade_start = (overlay_duration - d).max(0.0);
                fade_filters.push_str(&format!(",fade=t=out:st={}:d={}:alpha=1", fade_start, d));
            }
            fade_filters.push_str(&prep_label);
            filters.push(fade_filters);

            filters.push(format!(
                "{}{}overlay=0:0:enable='between(t,{},{})'{}",
                video_stream, prep_label, sticker.start_time, sticker.end_time, next_stream
            ));
        } else {
            filters.push(format!(
                "{}[{}:v]overlay=0:0:enable='between(t,{},{})'{}",
                video_stream, input_idx, sticker.start_time, sticker.end_time, next_stream
            ));
        }

        video_stream = next_stream;
    }

    // Apply effect overlays with enable expressions for time-based activation

    let effect_overlays = config.effect_overlays.unwrap_or_default();

    if !effect_overlays.is_empty() {
        for (i, effect_overlay) in effect_overlays.iter().enumerate() {
            if !effect_overlay.enabled {
                continue;
            }

            // Convert EffectOverlay to VideoEffect for reuse of build_effects_filter

            let ve = VideoEffect {
                effect_type: effect_overlay.effect_type.clone(),

                enabled: effect_overlay.enabled,

                intensity: effect_overlay.intensity,

                params: effect_overlay.params.clone(),
            };

            let effect_filter_str = build_effects_filter(&[ve]);

            if effect_filter_str.is_empty() {
                continue;
            }

            let is_last = i == effect_overlays.len() - 1
                && effect_overlays.iter().skip(i + 1).all(|e| {
                    !e.enabled || {
                        let ve2 = VideoEffect {
                            effect_type: e.effect_type.clone(),

                            enabled: e.enabled,

                            intensity: e.intensity,

                            params: e.params.clone(),
                        };

                        build_effects_filter(&[ve2]).is_empty()
                    }
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
                .map(|f| {
                    format!(
                        "{}:enable='between(t,{},{})'",
                        f.trim(),
                        effect_overlay.start_time,
                        effect_overlay.end_time
                    )
                })
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

    // Apply branding watermark overlay

    let branding_input_offset =
        existing_input_count + config.text_overlays.len() + config.sticker_overlays.len();

    let mut branding_input_idx = branding_input_offset;

    if let Some(ref wm) = config.branding_watermark {
        if std::path::Path::new(&wm.image_path).exists() {
            let alpha = wm.opacity / 100.0;

            let next_stream = format!("[vbw]");

            if wm.is_full_frame {
                filters.push(format!(
                    "[{}:v]scale={}:{},format=rgba,colorchannelmixer=aa={}[bwm]",
                    branding_input_idx, config.width, config.height, alpha
                ));

                filters.push(format!("{}[bwm]overlay=0:0{}", video_stream, next_stream));
            } else {
                let pos_x = (wm.x / 100.0 * config.width as f64) as i32;

                let pos_y = (wm.y / 100.0 * config.height as f64) as i32;

                let scaled_width = (config.width as f64 * wm.scale / 100.0).round() as i32;

                filters.push(format!(
                    "[{}:v]scale={}:-1,format=rgba,colorchannelmixer=aa={}[bwm]",
                    branding_input_idx, scaled_width, alpha
                ));

                filters.push(format!(
                    "{}[bwm]overlay=x={}-(overlay_w/2):y={}-(overlay_h/2){}",
                    video_stream, pos_x, pos_y, next_stream
                ));
            }

            video_stream = next_stream;

            branding_input_idx += 1;

            println!("[Rust] Applied branding watermark overlay");
        }
    }

    // Apply branding layout overlays

    if let Some(ref overlays) = config.branding_overlays {
        for (i, overlay) in overlays.iter().enumerate() {
            if !std::path::Path::new(&overlay.image_path).exists() {
                continue;
            }

            let alpha = overlay.opacity / 100.0;

            let next_stream = format!("[vbo{}]", i);

            if overlay.is_full_frame {
                filters.push(format!(
                    "[{}:v]scale={}:{},format=rgba,colorchannelmixer=aa={}[bol{}]",
                    branding_input_idx, config.width, config.height, alpha, i
                ));

                filters.push(format!(
                    "{}[bol{}]overlay=0:0{}",
                    video_stream, i, next_stream
                ));
            } else {
                let pos_x = (overlay.x / 100.0 * config.width as f64) as i32;

                let pos_y = (overlay.y / 100.0 * config.height as f64) as i32;

                let scaled_width = (config.width as f64 * overlay.scale / 100.0).round() as i32;

                filters.push(format!(
                    "[{}:v]scale={}:-1,format=rgba,colorchannelmixer=aa={}[bol{}]",
                    branding_input_idx, scaled_width, alpha, i
                ));

                filters.push(format!(
                    "{}[bol{}]overlay=x={}-(overlay_w/2):y={}-(overlay_h/2){}",
                    video_stream, i, pos_x, pos_y, next_stream
                ));
            }

            video_stream = next_stream;

            branding_input_idx += 1;

            println!("[Rust] Applied branding layout overlay {}", i);
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
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
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

    println!(
        "[Rust] Export completed successfully: {}",
        config.output_path
    );

    // Extract cover image if a cover timestamp was specified

    if let Some(cover_ts) = config.cover_timestamp {
        let cover_path = {
            let p = Path::new(&config.output_path);

            let stem = p.file_stem().unwrap_or_default().to_string_lossy();

            let parent = p.parent().unwrap_or(Path::new("."));

            parent
                .join(format!("{}_cover.jpg", stem))
                .to_string_lossy()
                .to_string()
        };

        println!(
            "[Rust] Extracting cover image at {}s -> {}",
            cover_ts, cover_path
        );

        let cover_output = shell
            .sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args(&[
                "-y",
                "-ss",
                &cover_ts.to_string(),
                "-i",
                &config.output_path,
                "-vframes",
                "1",
                "-q:v",
                "2",
                &cover_path,
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to extract cover image: {}", e))?;

        if cover_output.status.success() {
            println!("[Rust] Cover image saved: {}", cover_path);
        } else {
            let stderr = String::from_utf8_lossy(&cover_output.stderr);

            println!(
                "[Rust] Cover image extraction failed (non-fatal): {}",
                stderr
            );
        }
    }

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
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
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

    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let file_name = format!("text_overlay_{}.png", element_id);

    let file_path = temp_dir.join(&file_name);

    std::fs::write(&file_path, &png_bytes)
        .map_err(|e| format!("Failed to write text overlay PNG: {}", e))?;

    println!(
        "[Rust] Saved text overlay PNG: {} ({} bytes)",
        file_path.display(),
        png_bytes.len()
    );

    Ok(file_path.to_string_lossy().to_string())
}
