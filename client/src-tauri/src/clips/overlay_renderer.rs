use super::types::{TextOverlaySettings, StickerSettings, ClipWatermarkSettings, SubtitleSettings, WhisperSegment};

/// Helper to convert hex color to RGB values for FFmpeg
fn hex_to_rgb(hex: &str) -> Result<(u8, u8, u8), String> {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        return Err(format!("Invalid hex color: {}", hex));
    }
    
    let r = u8::from_str_radix(&hex[0..2], 16).map_err(|e| e.to_string())?;
    let g = u8::from_str_radix(&hex[2..4], 16).map_err(|e| e.to_string())?;
    let b = u8::from_str_radix(&hex[4..6], 16).map_err(|e| e.to_string())?;
    
    Ok((r, g, b))
}

/// Convert hex color with alpha to FFmpeg color format
fn hex_to_ffmpeg_color(hex: &str, alpha: f32) -> Result<String, String> {
    let (r, g, b) = hex_to_rgb(hex)?;
    let a = (alpha * 255.0) as u8;
    Ok(format!("0x{:02X}{:02X}{:02X}{:02X}", r, g, b, a))
}

/// Escape text for FFmpeg drawtext filter
fn escape_drawtext(text: &str) -> String {
    text.replace('\\', "\\\\")
        .replace('\'', "\\'")
        .replace(':', "\\:")
        .replace('%', "\\%")
        .replace('\n', "\\n")
}

/// Get text overlay configuration for a specific aspect ratio
fn get_text_overlay_config_for_ratio<'a>(
    overlay: &'a TextOverlaySettings,
    aspect_ratio: &str,
) -> (f64, f64, &'a super::types::TextOverlayStyle) {
    if let Some(per_ratio) = &overlay.per_ratio_configs {
        if let Some(config) = per_ratio.get(aspect_ratio) {
            return (config.position.x, config.position.y, &config.style);
        }
    }
    // Fallback to default position and style
    (overlay.position_x, overlay.position_y, &overlay.style)
}

/// Get sticker configuration for a specific aspect ratio
fn get_sticker_config_for_ratio(
    sticker: &StickerSettings,
    aspect_ratio: &str,
) -> (f64, f64, f64, f64) {
    if let Some(per_ratio) = &sticker.per_ratio_configs {
        if let Some(config) = per_ratio.get(aspect_ratio) {
            return (config.position.x, config.position.y, config.scale, config.rotation);
        }
    }
    // Fallback to default values
    (sticker.position_x, sticker.position_y, sticker.scale, sticker.rotation)
}

/// Get clip watermark configuration for a specific aspect ratio
fn get_clip_watermark_config_for_ratio(
    watermark: &ClipWatermarkSettings,
    aspect_ratio: &str,
) -> (f64, f64, f64, f64) {
    if let Some(per_ratio) = &watermark.per_ratio_configs {
        if let Some(config) = per_ratio.get(aspect_ratio) {
            return (config.position.x, config.position.y, config.scale, config.opacity);
        }
    }
    // Fallback to default values
    (watermark.position_x, watermark.position_y, watermark.scale, watermark.opacity)
}

/// Build FFmpeg drawtext filter for a single text overlay
/// Returns the filter string with enable expression for time-based display
pub fn build_text_overlay_filter(
    overlay: &TextOverlaySettings,
    video_width: u32,
    video_height: u32,
    aspect_ratio: &str,
) -> Result<String, String> {
    let (pos_x, pos_y, style) = get_text_overlay_config_for_ratio(overlay, aspect_ratio);
    
    // Calculate font size scaling
    // Font sizes are relative to a 1080p preview (preview_height)
    // Scale to actual output height
    let preview_height = overlay.preview_height.unwrap_or(1080.0);
    let scale_factor = video_height as f64 / preview_height;
    let scaled_font_size = (style.font_size as f64 * scale_factor) as u32;
    
    // Convert position percentages to pixel coordinates
    // Position is center of text, so we need to adjust
    let x_pixels = (video_width as f64 * pos_x / 100.0) as i32;
    let y_pixels = (video_height as f64 * pos_y / 100.0) as i32;
    
    // Escape text for FFmpeg
    let escaped_text = escape_drawtext(&overlay.text);
    
    // Build text color
    let (r, g, b) = hex_to_rgb(&style.color)?;
    let text_color = format!("0x{:02X}{:02X}{:02X}", r, g, b);
    
    // Build border color (use border1 as primary border)
    let border_color = if style.border1_width > 0.0 {
        if let Some(ref border_hex) = style.border1_color {
            let (br, bg, bb) = hex_to_rgb(border_hex)?;
            format!("0x{:02X}{:02X}{:02X}", br, bg, bb)
        } else {
            "0x000000".to_string()
        }
    } else {
        "0x000000".to_string()
    };
    
    let border_width = (style.border1_width * scale_factor as f32) as u32;
    
    // Build shadow (if enabled)
    let shadow_x = (style.shadow_offset_x * scale_factor as f32) as i32;
    let shadow_y = (style.shadow_offset_y * scale_factor as f32) as i32;
    let shadow_color = if style.shadow_enabled {
        if let Some(ref shadow_hex) = style.shadow_color {
            hex_to_ffmpeg_color(shadow_hex, 0.5)?
        } else {
            "0x00000080".to_string()
        }
    } else {
        "0x00000000".to_string()
    };
    
    // Build the drawtext filter
    // Note: FFmpeg drawtext doesn't support all CSS features, so we approximate
    let mut filter_parts = vec![
        format!("text='{}'", escaped_text),
        format!("fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"), // Fallback font
        format!("fontsize={}", scaled_font_size),
        format!("fontcolor={}", text_color),
        format!("x={}", x_pixels),
        format!("y={}", y_pixels),
    ];
    
    // Add border (stroke)
    if border_width > 0 {
        filter_parts.push(format!("borderw={}", border_width));
        filter_parts.push(format!("bordercolor={}", border_color));
    }
    
    // Add shadow
    if style.shadow_enabled && (shadow_x != 0 || shadow_y != 0) {
        filter_parts.push(format!("shadowx={}", shadow_x));
        filter_parts.push(format!("shadowy={}", shadow_y));
        filter_parts.push(format!("shadowcolor={}", shadow_color));
    }
    
    // Add time-based enable expression
    let enable_expr = format!("enable='between(t,{},{})'", overlay.start_time, overlay.end_time);
    filter_parts.push(enable_expr);
    
    Ok(format!("drawtext={}", filter_parts.join(":")))
}

/// Build FFmpeg overlay filter for a sticker (image overlay with position, scale, rotation)
/// Returns the filter complex string for this sticker
pub fn build_sticker_overlay_filter(
    sticker: &StickerSettings,
    video_width: u32,
    video_height: u32,
    aspect_ratio: &str,
    input_index: usize,
) -> Result<String, String> {
    let (pos_x, pos_y, scale, rotation) = get_sticker_config_for_ratio(sticker, aspect_ratio);
    
    // Calculate sticker dimensions
    // Base width is 10% of video height (matches preview calculation)
    let base_width = (video_height as f64 * 0.1 * scale) as u32;
    
    // Convert position percentages to pixel coordinates (center of sticker)
    let x_pixels = (video_width as f64 * pos_x / 100.0) as i32;
    let y_pixels = (video_height as f64 * pos_y / 100.0) as i32;
    
    // Build filter chain for this sticker:
    // 1. Scale the sticker image
    // 2. Rotate if needed
    // 3. Overlay at position with time-based enable
    
    let mut filter_parts = Vec::new();
    
    // Scale sticker to target width (maintain aspect ratio)
    filter_parts.push(format!("[{}:v]scale={}:-1", input_index, base_width));
    
    // Apply rotation if needed
    if rotation.abs() > 0.1 {
        let rotation_rad = rotation * std::f64::consts::PI / 180.0;
        filter_parts.push(format!("rotate={}:c=none", rotation_rad));
    }
    
    // Add format for transparency
    filter_parts.push("format=rgba".to_string());
    
    let sticker_label = format!("sticker{}", input_index);
    let filter_chain = format!("{}[{}]", filter_parts.join(","), sticker_label);
    
    // Build overlay with time-based enable
    // Position is center, so we need to offset by half the sticker size
    let overlay_filter = format!(
        "[v][{}]overlay=x={}:y={}:enable='between(t,{},{})'",
        sticker_label,
        x_pixels,
        y_pixels,
        sticker.start_time,
        sticker.end_time
    );
    
    Ok(format!("{};{}", filter_chain, overlay_filter))
}

/// Build FFmpeg overlay filter for clip watermarks (similar to stickers but with opacity)
pub fn build_clip_watermark_overlay_filter(
    watermark: &ClipWatermarkSettings,
    video_width: u32,
    video_height: u32,
    aspect_ratio: &str,
    input_index: usize,
) -> Result<String, String> {
    let (pos_x, pos_y, scale_pct, opacity_pct) = get_clip_watermark_config_for_ratio(watermark, aspect_ratio);
    
    // Calculate watermark width (scale is percentage of video width)
    let watermark_width = (video_width as f64 * scale_pct / 100.0) as u32;
    
    // Convert position percentages to pixel coordinates
    let x_pixels = (video_width as f64 * pos_x / 100.0) as i32;
    let y_pixels = (video_height as f64 * pos_y / 100.0) as i32;
    
    // Convert opacity percentage to 0-1 range
    let opacity = opacity_pct / 100.0;
    
    let watermark_label = format!("wm{}", input_index);
    
    // Build filter chain: scale, apply opacity, format for transparency
    let filter_chain = format!(
        "[{}:v]scale={}:-1,format=rgba,colorchannelmixer=aa={}[{}]",
        input_index, watermark_width, opacity, watermark_label
    );
    
    // Build overlay with time-based enable
    let overlay_filter = format!(
        "[v][{}]overlay=x={}:y={}:enable='between(t,{},{})'",
        watermark_label,
        x_pixels,
        y_pixels,
        watermark.start_time,
        watermark.end_time
    );
    
    Ok(format!("{};{}", filter_chain, overlay_filter))
}

/// Build complete overlay filter complex for all overlays (text, stickers, watermarks)
/// This combines all overlay filters into a single filter_complex string
pub fn build_complete_overlay_filter(
    text_overlays: &[TextOverlaySettings],
    stickers: &[StickerSettings],
    clip_watermarks: &[ClipWatermarkSettings],
    video_width: u32,
    video_height: u32,
    aspect_ratio: &str,
) -> Result<Option<String>, String> {
    let mut filter_parts = Vec::new();
    let mut input_index = 1; // Start at 1, input 0 is the main video
    
    // Label the main video input
    filter_parts.push("[0:v]null[v]".to_string());
    
    // Add text overlays (these don't need additional inputs, just drawtext filters)
    for overlay in text_overlays {
        let filter = build_text_overlay_filter(overlay, video_width, video_height, aspect_ratio)?;
        filter_parts.push(filter);
    }
    
    // Add stickers (these need additional input files)
    for sticker in stickers {
        let filter = build_sticker_overlay_filter(sticker, video_width, video_height, aspect_ratio, input_index)?;
        filter_parts.push(filter);
        input_index += 1;
    }
    
    // Add clip watermarks (these need additional input files)
    for watermark in clip_watermarks {
        let filter = build_clip_watermark_overlay_filter(watermark, video_width, video_height, aspect_ratio, input_index)?;
        filter_parts.push(filter);
        input_index += 1;
    }
    
    if filter_parts.len() <= 1 {
        // Only the null filter, no overlays
        return Ok(None);
    }
    
    Ok(Some(filter_parts.join(";")))
}

/// Get list of additional input files needed for overlays (stickers and watermarks)
pub fn get_overlay_input_files(
    stickers: &[StickerSettings],
    clip_watermarks: &[ClipWatermarkSettings],
) -> Vec<String> {
    let mut input_files = Vec::new();
    
    // Add sticker image files
    for sticker in stickers {
        if sticker.sticker_type == "image" || sticker.sticker_type == "gif" {
            input_files.push(sticker.sticker_path.clone());
        }
    }
    
    // Add watermark image files
    for watermark in clip_watermarks {
        input_files.push(watermark.watermark_path.clone());
    }
    
    input_files
}

/// Build subtitle rendering filter using drawtext with word-level timing
/// This creates animated subtitles with word-by-word appearance
pub fn build_subtitle_filter(
    subtitle_settings: &SubtitleSettings,
    whisper_segments: &[WhisperSegment],
    video_width: u32,
    video_height: u32,
    aspect_ratio: &str,
) -> Result<Option<String>, String> {
    if !subtitle_settings.enabled {
        return Ok(None);
    }
    
    // Get subtitle override for this aspect ratio if available
    // (This would need to be passed in if we support per-ratio subtitle configs)
    
    let mut filter_parts = Vec::new();
    
    // Calculate font size scaling (similar to text overlays)
    let scale_factor = video_height as f64 / 1080.0;
    let scaled_font_size = (subtitle_settings.font_size * scale_factor as f32) as u32;
    
    // Calculate position
    let position_pct = subtitle_settings.position_percentage as f64;
    let y_pixels = (video_height as f64 * position_pct / 100.0) as i32;
    
    // Build text color
    let (r, g, b) = hex_to_rgb(&subtitle_settings.text_color)?;
    let text_color = format!("0x{:02X}{:02X}{:02X}", r, g, b);
    
    // Build border color
    let (br, bg, bb) = hex_to_rgb(&subtitle_settings.border1_color)?;
    let border_color = format!("0x{:02X}{:02X}{:02X}", br, bg, bb);
    let border_width = (subtitle_settings.border1_width * scale_factor as f32) as u32;
    
    // Process each segment with word-level timing
    for segment in whisper_segments {
        if let Some(ref words) = segment.words {
            for word in words {
                let escaped_word = escape_drawtext(&word.word);
                
                // Build drawtext filter for this word
                let word_filter = format!(
                    "drawtext=text='{}':fontsize={}:fontcolor={}:x=(w-text_w)/2:y={}:borderw={}:bordercolor={}:enable='between(t,{},{})'",
                    escaped_word,
                    scaled_font_size,
                    text_color,
                    y_pixels,
                    border_width,
                    border_color,
                    word.start,
                    word.end
                );
                
                filter_parts.push(word_filter);
            }
        }
    }
    
    if filter_parts.is_empty() {
        return Ok(None);
    }
    
    Ok(Some(filter_parts.join(",")))
}
