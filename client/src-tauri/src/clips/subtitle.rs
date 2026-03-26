use super::types::{AspectRatio, SubtitleSettings, TextOverlaySettings, WordInfo};
use std::io::Write;

// Default color palette for multi-color single-word mode
const DEFAULT_COLOR_PALETTE: [&str; 4] = ["#04F827", "#0ea5e9", "#FFFD03", "#FFFFFF"];

// Convert hex color to ASS override tag format (&HBBGGRR& with trailing &)
fn convert_hex_to_ass_color(hex: &str) -> String {
    let hex = hex.trim_start_matches('#');
    if hex.len() >= 6 {
        let r = &hex[0..2];
        let g = &hex[2..4];
        let b = &hex[4..6];
        // ASS override tags use BGR order with optional alpha prefix, and trailing &
        format!("&H{}{}{}&", b, g, r).to_uppercase()
    } else {
        "&HFFFFFF&".to_string()
    }
}

// Helper function to get the color for a word based on multi-color settings
fn get_word_color(word_index: usize, settings: &SubtitleSettings) -> String {
    if !settings.multi_color_enabled {
        // Multi-color is OFF, use the regular text color
        return settings.text_color.clone();
    }
    
    // Multi-color is ON
    if settings.multi_color_mode == "custom" && !settings.color_palette.is_empty() {
        // Use custom palette
        let palette_index = word_index % settings.color_palette.len();
        settings.color_palette[palette_index].clone()
    } else {
        // Use default palette (Neon Green, Cyan, Yellow, White)
        let palette_index = word_index % DEFAULT_COLOR_PALETTE.len();
        DEFAULT_COLOR_PALETTE[palette_index].to_string()
    }
}

// Helper to embed fonts directly in ASS file
pub fn embed_fonts_in_ass(
    file: &mut std::fs::File,
    fonts_dir: &std::path::Path,
    settings: &SubtitleSettings,
) -> Result<(), String> {
    use std::io::Read;

    // Determine which font files we need based on font family and weight
    let font_files_to_embed = get_required_font_files(settings);

    // ASS fonts section uses UUencoded format
    writeln!(file, "[Fonts]").unwrap();

    for font_filename in font_files_to_embed {
        let font_path = fonts_dir.join(&font_filename);

        if !font_path.exists() {
            println!(
                "[Rust] Warning: Font file not found: {} - FFmpeg will use system fallback",
                font_path.display()
            );
            continue;
        }

        println!("[Rust] Embedding font: {}", font_filename);

        // Read font file
        let mut font_file = std::fs::File::open(&font_path)
            .map_err(|e| format!("Failed to open font file {}: {}", font_filename, e))?;

        let mut font_data = Vec::new();
        font_file
            .read_to_end(&mut font_data)
            .map_err(|e| format!("Failed to read font file {}: {}", font_filename, e))?;

        println!("[Rust] Font file size: {} bytes", font_data.len());

        // Encode as UUencoded (ASS standard for embedded fonts)
        let encoded = uuencode_data(&font_data);

        // Write font header - use filename WITHOUT extension (ASS format requirement)
        let font_name_without_ext = font_filename
            .trim_end_matches(".ttf")
            .trim_end_matches(".otf");
        writeln!(file, "fontname: {}", font_name_without_ext).unwrap();

        // Write encoded data
        for line in encoded {
            writeln!(file, "{}", line).unwrap();
        }

        writeln!(file).unwrap();
    }

    Ok(())
}

// Helper to get required font files for embedding
fn get_required_font_files(settings: &SubtitleSettings) -> Vec<String> {
    let mut files = Vec::new();

    // Determine font file based on family and weight
    let weight_suffix = if settings.font_weight >= 700 {
        "Bold"
    } else if settings.font_weight >= 600 {
        "SemiBold"
    } else if settings.font_weight >= 500 {
        "Medium"
    } else if settings.font_weight < 400 && settings.font_weight >= 300 {
        "Light"
    } else if settings.font_weight < 300 {
        "Thin"
    } else {
        "Regular"
    };

    // Build font filename
    let font_file = match settings.font_family.as_str() {
        "Open Sans" => {
            // Handle space in name
            if weight_suffix == "Regular" {
                "OpenSans-Regular.ttf".to_string()
            } else {
                format!("OpenSans-{}.ttf", weight_suffix)
            }
        }
        "Bebas Neue" => {
            // Bebas Neue only has Regular weight
            "BebasNeue-Regular.ttf".to_string()
        }
        _ => {
            // Standard format: FontName-Weight.ttf
            if weight_suffix == "Regular" {
                format!("{}-Regular.ttf", settings.font_family)
            } else {
                format!("{}-{}.ttf", settings.font_family, weight_suffix)
            }
        }
    };

    files.push(font_file);
    files
}

// UUencode data for ASS font embedding (ASS uses UUencoding, not base64)
fn uuencode_data(data: &[u8]) -> Vec<String> {
    let mut lines = Vec::new();

    for chunk in data.chunks(45) {
        // UUencode uses 45 bytes per line (60 chars output)
        let mut line = String::new();

        // Length character: 45 bytes = 'M' in UUencode
        let len_char = (chunk.len() as u8 + 32) as char;
        line.push(len_char);

        // Encode the chunk
        for group in chunk.chunks(3) {
            let mut buf = [0u8; 3];
            for (i, &byte) in group.iter().enumerate() {
                buf[i] = byte;
            }

            // UUencode: split 3 bytes into 4 6-bit values, add 32 to each
            let b1 = ((buf[0] >> 2) & 0x3f) + 32;
            let b2 = ((((buf[0] & 0x03) << 4) | ((buf[1] >> 4) & 0x0f)) & 0x3f) + 32;
            let b3 = ((((buf[1] & 0x0f) << 2) | ((buf[2] >> 6) & 0x03)) & 0x3f) + 32;
            let b4 = (buf[2] & 0x3f) + 32;

            line.push(b1 as char);
            line.push(b2 as char);

            if group.len() > 1 {
                line.push(b3 as char);
            }
            if group.len() > 2 {
                line.push(b4 as char);
            }
        }

        lines.push(line);
    }

    lines
}

// Helper to generate ASS file content
#[allow(clippy::too_many_arguments)]
pub fn generate_ass_file(
    settings: &SubtitleSettings,
    all_words: &[WordInfo],
    clip_segments: &[serde_json::Value],
    output_path: &std::path::Path,
    max_words: usize,
    aspect_ratio: Option<&AspectRatio>,
    video_width: u32,
    video_height: u32,
    fonts_dir: Option<&std::path::Path>,
    time_offset: f64, // Offset to add to all subtitle times (e.g., intro duration)
    per_ratio_override: Option<&serde_json::Value>, // Per-aspect-ratio subtitle override
) -> Result<(), String> {
    let mut file = std::fs::File::create(output_path)
        .map_err(|e| format!("Failed to create subtitle file: {}", e))?;

    // Generate ASS header with normalized 1080p height coordinate system
    // This ensures font sizes match the frontend which uses 1080p as reference
    let play_res_y = 1080;
    let play_res_x = (video_width as f64 * (1080.0 / video_height as f64)).round() as u32;

    writeln!(file, "[Script Info]").unwrap();
    writeln!(file, "ScriptType: v4.00+").unwrap();
    writeln!(file, "PlayResX: {}", play_res_x).unwrap();
    writeln!(file, "PlayResY: {}", play_res_y).unwrap();
    writeln!(file, "WrapStyle: 1").unwrap(); // Word wrapping
    writeln!(file, "ScaledBorderAndShadow: yes").unwrap();
    writeln!(file).unwrap();

    // Embed fonts if available
    if let Some(fonts_path) = fonts_dir {
        println!(
            "[Rust] Attempting to embed fonts from: {}",
            fonts_path.display()
        );
        if fonts_path.exists() {
            println!("[Rust] Fonts directory exists, embedding...");
            embed_fonts_in_ass(&mut file, fonts_path, settings)?;
        } else {
            println!("[Rust] WARNING: Fonts directory does not exist! Fonts will not be embedded.");
        }
    } else {
        println!("[Rust] WARNING: No fonts directory provided, fonts will not be embedded.");
    }

    writeln!(file).unwrap();

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
            // Note: Style definitions do NOT use the trailing '&' that override tags use
            format!("&H00{}{}{}", b, g, r).to_uppercase()
        } else {
            "&H00FFFFFF".to_string()
        }
    };

    // Apply per-ratio visual overrides from JSON (set when user picks a different preset per ratio)
    let (eff_text_color, eff_font_family, eff_font_weight, eff_font_size, eff_border1_color,
         eff_border1_width, eff_shadow_x, eff_shadow_y, eff_shadow_blur, eff_shadow_color,
         eff_animation_style) = if let Some(ov) = per_ratio_override {
        let tc    = ov.get("textColor").and_then(|v| v.as_str()).map(String::from)
                      .unwrap_or_else(|| settings.text_color.clone());
        let ff    = ov.get("fontFamily").and_then(|v| v.as_str()).map(String::from)
                      .unwrap_or_else(|| settings.font_family.clone());
        let fw    = ov.get("fontWeight").and_then(|v| v.as_f64()).map(|v| v as u32)
                      .unwrap_or(settings.font_weight);
        let fs    = ov.get("fontSize").and_then(|v| v.as_f64()).map(|v| v as f32)
                      .unwrap_or(settings.font_size);
        let bc1   = ov.get("border1Color").and_then(|v| v.as_str()).map(String::from)
                      .unwrap_or_else(|| settings.border1_color.clone());
        let bw1   = ov.get("border1Width").and_then(|v| v.as_f64()).map(|v| v as f32)
                      .unwrap_or(settings.border1_width);
        let sx    = ov.get("shadowOffsetX").and_then(|v| v.as_f64()).map(|v| v as f32)
                      .unwrap_or(settings.shadow_offset_x);
        let sy    = ov.get("shadowOffsetY").and_then(|v| v.as_f64()).map(|v| v as f32)
                      .unwrap_or(settings.shadow_offset_y);
        let sb    = ov.get("shadowBlur").and_then(|v| v.as_f64()).map(|v| v as f32)
                      .unwrap_or(settings.shadow_blur);
        let sc    = ov.get("shadowColor").and_then(|v| v.as_str()).map(String::from)
                      .unwrap_or_else(|| settings.shadow_color.clone());
        let anim  = ov.get("animationStyle").and_then(|v| v.as_str()).map(String::from)
                      .unwrap_or_else(|| settings.animation_style.clone());
        (tc, ff, fw, fs, bc1, bw1, sx, sy, sb, sc, anim)
    } else {
        (settings.text_color.clone(), settings.font_family.clone(), settings.font_weight,
         settings.font_size, settings.border1_color.clone(), settings.border1_width,
         settings.shadow_offset_x, settings.shadow_offset_y, settings.shadow_blur,
         settings.shadow_color.clone(), settings.animation_style.clone())
    };

    let primary_color = convert_color(&eff_text_color);
    let border1_color = convert_color(&eff_border1_color);
    let border2_color = convert_color(&settings.border2_color);
    let _back_color = convert_color(&settings.background_color);

    println!(
        "[Rust] Subtitle colors - Text: {}, Border1: {}, Border2: {}, Background: {}",
        settings.text_color,
        settings.border1_color,
        settings.border2_color,
        settings.background_color
    );
    println!(
        "[Rust] ASS colors - Primary: {}, Border1: {}, Border2: {}",
        primary_color, border1_color, border2_color
    );
    println!("[Rust] Using font: {}", eff_font_family);

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

    // NOTE: The frontend uses videoScaleFactor (containerHeight / 1080) for dynamic scaling
    // based on actual viewport size. In export, we work with fixed PlayResY=1080,
    // so we don't need additional scaling - the font size is already relative to 1080p.
    
    let adjusted_font_size = (eff_font_size * font_size_scale).round();
    // CSS WebkitTextStroke is centered on the path, so only half extends outwards.
    // ASS Outline is entirely outwards. To match the visual thickness of the frontend,
    // we need to divide the stroke width by 2.
    let adjusted_border1_width = eff_border1_width * font_size_scale * 0.5;
    let adjusted_border2_width = settings.border2_width * font_size_scale * 0.5;
    // ASS Shadow parameter is an offset depth, calculate from shadow offset X/Y
    // Use the magnitude of the offset vector for proper shadow distance
    let shadow_offset_magnitude =
        ((eff_shadow_x.powi(2) + eff_shadow_y.powi(2)).sqrt())
            * font_size_scale;
    let adjusted_shadow = shadow_offset_magnitude;
    let adjusted_letter_spacing = settings.letter_spacing * font_size_scale;
    // Suppress unused variable warnings for effective fields used downstream
    let _ = eff_shadow_blur; let _ = eff_shadow_color;
    let _ = &eff_animation_style;

    println!(
        "[Rust] Font size: {} -> {} (scale: {})",
        eff_font_size, adjusted_font_size, font_size_scale
    );

    // Calculate margins and positioning to match VideoPlayer.vue
    // Vue uses a container with width=maxWidth% centered on screen
    // And positions it using top=positionPercentage% and translate(-50%, -50%)

    // Extract per-ratio override values if available
    let (override_x, override_y, override_max_width) = if let Some(r#override) = per_ratio_override {
        // Parse the override JSON
        let x = r#override.get("x").and_then(|v| v.as_f64()).unwrap_or(50.0);
        let y = r#override.get("y").and_then(|v| v.as_f64()).unwrap_or(85.0);
        let max_width = r#override.get("width").and_then(|v| v.as_f64()).unwrap_or(settings.max_width as f64);
        (x, y, max_width)
    } else {
        // Use default values from settings
        (50.0, settings.position_percentage as f64, settings.max_width as f64)
    };

    let adjusted_padding = settings.padding * font_size_scale;
    let box_width_px = play_res_x as f64 * (override_max_width / 100.0);

    // Calculate margins to constrain text to box_width - 2*padding
    // The box is centered on screen, so margins are symmetric
    let side_margin = (play_res_x as f64 - box_width_px) / 2.0;
    let margin_l = (side_margin + adjusted_padding as f64).round() as i32;
    let margin_r = (side_margin + adjusted_padding as f64).round() as i32;

    // Calculate target position for \pos(x,y)
    // X: Center of screen + Offset (percentage of box width)
    let shift_x_px = box_width_px * (settings.text_offset_x as f64 / 100.0);
    let _target_x = (play_res_x as f64 / 2.0) + shift_x_px;

    // Y: Position% of screen + Offset (percentage of height)
    // We approximate height as 2 lines + padding for the offset calculation
    let approx_height = (adjusted_font_size as f64 * 2.0) + (adjusted_padding as f64 * 2.0);
    let shift_y_px = approx_height * (settings.text_offset_y as f64 / 100.0);

    // NOTE: Removed vertical_correction - the frontend doesn't apply any correction,
    // so we shouldn't either to match the preview exactly
    let target_y = (play_res_y as f64 * (override_y / 100.0)) + shift_y_px;

    // Map textAlign to ASS alignment values (numpad layout)
    // Bottom row: 1=left, 2=center, 3=right
    // Middle row: 4=left, 5=center, 6=right
    // Top row: 7=left, 8=center, 9=right
    // We use middle row (4/5/6) to match vertical centering
    let (alignment, adjusted_target_x) = match settings.text_align.as_str() {
        "left" => {
            // Alignment 4 = Middle Left
            // Position at left edge of text box (side_margin + padding)
            let x = side_margin + adjusted_padding as f64;
            (4, x)
        }
        "right" => {
            // Alignment 6 = Middle Right
            // Position at right edge of text box (play_res_x - side_margin - padding)
            let x = play_res_x as f64 - side_margin - adjusted_padding as f64;
            (6, x)
        }
        _ => {
            // Default to center (alignment 5) - use override_x if available
            let x = play_res_x as f64 * (override_x / 100.0);
            (5, x)
        }
    };
    let margin_v = 10; // Not used for positioning with \pos, but required by Style

    let pos_tag = format!("{{\\pos({:.0},{:.0})}}", adjusted_target_x, target_y);

    // For embedded fonts, we need to reference the actual font family name
    // and use \fw tags for specific weights, as standard ASS only supports Bold/Italic.
    // This avoids issues where libass fails to match a constructed name like "Montserrat-Bold"
    // if the internal family name is just "Montserrat".

    // We'll use the base family name in the Style
    let font_name_for_style = eff_font_family.clone();

    // But we still need to embed the specific font file corresponding to the weight.
    // (This is handled by get_required_font_files and embed_fonts_in_ass)

    // Standard ASS Bold flag (only for generic bold, specific weights handled via \fw)
    let bold = if eff_font_weight >= 700 { -1 } else { 0 };

    println!("[Rust] Font name for ASS: {}", font_name_for_style);

    // Generate two styles for layered borders
    // Layer ordering: shadow (bottom) > border2 (middle) > border1 (top) > text

    // Style 1: Border2Layer (bottom layer with larger outline = border1 + border2)
    // ASS Style format:
    // Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour,
    // Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle,
    // BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
    let total_border_width = adjusted_border1_width + adjusted_border2_width;

    // Use shadow_color for BackColour (which controls Shadow color in BorderStyle=1)
    let shadow_color_ass = convert_color(&settings.shadow_color);

    // Calculate word spacing separator
    // Frontend uses flex gap which replaces the space character.
    // In ASS, we use a space character, so we need to adjust its spacing to match the desired gap.
    // We assume a standard space width of ~0.25em.
    // Target width = word_spacing * font_size
    // Required spacing = Target width - Estimated space width
    let space_glyph_width = adjusted_font_size * 0.25;
    let target_word_gap = settings.word_spacing * adjusted_font_size;
    let space_char_spacing = (target_word_gap - space_glyph_width).max(0.0);

    // Separator: Set spacing for space char, then space char, then reset spacing for next word
    let word_separator = format!(
        "{{\\fsp{:.1}}} {{\\fsp{:.1}}}",
        space_char_spacing, adjusted_letter_spacing
    );

    writeln!(
        file,
        "Style: Border2Layer,{},{},{},{},{},{},{},0,0,0,100,100,{},0,1,{},{},{},{},{},{},1",
        font_name_for_style,
        adjusted_font_size,
        primary_color,
        primary_color,    // SecondaryColour
        border2_color,    // OutlineColour (border2 color)
        shadow_color_ass, // BackColour (Shadow color)
        bold,
        adjusted_letter_spacing,
        total_border_width, // Outline (total width)
        adjusted_shadow,    // Shadow (drop shadow)
        alignment,
        margin_l,
        margin_r,
        margin_v
    )
    .unwrap();

    // Style 2: Border1Layer (top layer with smaller outline = border1 only)
    writeln!(
        file,
        "Style: Border1Layer,{},{},{},{},{},&H00000000,{},0,0,0,100,100,{},0,1,{},{},{},{},{},{},1",
        font_name_for_style,
        adjusted_font_size,
        primary_color,
        primary_color, // SecondaryColour
        border1_color, // No background for top layer
        bold,
        adjusted_letter_spacing,
        adjusted_border1_width, // Outline (border1 only)
        0.0,                    // No shadow on top layer
        alignment,
        margin_l,
        margin_r,
        margin_v
    )
    .unwrap();

    writeln!(file).unwrap();
    writeln!(file, "[Events]").unwrap();
    writeln!(
        file,
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
    )
    .unwrap();

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
                // Calculate relative timing and add the time offset (e.g., intro duration)
                let start_rel = word.start - clip_seg_start + current_clip_time + time_offset;
                let end_rel = word.end - clip_seg_start + current_clip_time + time_offset;

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
    clip_timeline_words.sort_by(|a, b| {
        a.start
            .partial_cmp(&b.start)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    if clip_timeline_words.is_empty() {
        return Ok(());
    }

    // 2. Group words into chunks (pages)
    let _chunks: Vec<&[ClipWord]> = clip_timeline_words.chunks(max_words).collect();

    // 3. Generate events for each chunk
    let chunk_count = clip_timeline_words.len().div_ceil(max_words);

    for i in 0..chunk_count {
        let start_idx = i * max_words;
        let end_idx = std::cmp::min(start_idx + max_words, clip_timeline_words.len());
        let chunk = &clip_timeline_words[start_idx..end_idx];

        if chunk.is_empty() {
            continue;
        }

        let chunk_visible_start = if i == 0 {
            time_offset // Start at the time offset (after intro)
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
        for j in 0..points.len() - 1 {
            let t_start = points[j];
            let t_end = points[j + 1];

            if t_end - t_start < 0.01 {
                continue;
            } // Skip tiny intervals

            // Determine active word in this interval
            // A word is active if t_mid is inside [word.start, word.end]
            let t_mid = (t_start + t_end) / 2.0;
            let active_word_idx = chunk
                .iter()
                .position(|w| t_mid >= w.start && t_mid <= w.end);

            // Format time to H:MM:SS.cc
            let format_time = |t: f64| -> String {
                let t = t.max(0.0);
                let hours = (t / 3600.0).floor() as u32;
                let mins = ((t % 3600.0) / 60.0).floor() as u32;
                let secs = (t % 60.0).floor() as u32;
                let centis = ((t % 1.0) * 100.0).round() as u32;
                format!("{}:{:02}:{:02}.{:02}", hours, mins, secs, centis)
            };

            // Strategy: Render text in four layers for dual borders + animation
            // Layer 0: Border2Layer base text (shadow + outer border)
            // Layer 1: Border2Layer active word animation (shadow + outer border, scaled)
            // Layer 2: Border1Layer base text (inner border)
            // Layer 3: Border1Layer active word animation (inner border, scaled)

            // Layer 0: Border2Layer base text with all words at normal size
            // Use \fw tag to ensure correct font weight
            let weight_tag = format!("{{\\fw{}}}", eff_font_weight);
            let base_text = chunk
                .iter()
                .map(|w| format!("{}{}", weight_tag, w.word))
                .collect::<Vec<_>>()
                .join(&word_separator);

            writeln!(
                file,
                "Dialogue: 0,{},{},Border2Layer,,0,0,0,,{}{}",
                format_time(t_start),
                format_time(t_end),
                pos_tag,
                base_text
            )
            .unwrap();

            // Layer 2: Border1Layer base text with all words at normal size
            writeln!(
                file,
                "Dialogue: 2,{},{},Border1Layer,,0,0,0,,{}{}",
                format_time(t_start),
                format_time(t_end),
                pos_tag,
                base_text
            )
            .unwrap();

            // Layers 1 & 3: If there's an active word, render it with the selected animation style
            if let Some(active_idx) = active_word_idx {
                let active_word = &chunk[active_idx];
                let word_duration = active_word.end - active_word.start;
                let anim_duration_ms = calculate_animation_duration(word_duration);

                // Calculate when this word starts within the current interval
                let word_start_in_interval = if active_word.start > t_start {
                    ((active_word.start - t_start) * 1000.0) as u32
                } else {
                    0
                };

                // Build overlay text based on animation style
                let overlay_text = match eff_animation_style.as_str() {
                    "none" => {
                        // No animation: render all words normally (no overlay needed)
                        String::new()
                    }
                    "single-word" => {
                        // Only show the active word, hide others
                        // Get the color for this word (supports multi-color mode)
                        let word_color = get_word_color(active_idx, settings);
                        let ass_color = convert_hex_to_ass_color(&word_color);
                        format!("{{\\c{}}}{}{}", ass_color, weight_tag, active_word.word)
                    }
                    "typewriter" => {
                        // Typewriter: reveal words one by one, active word appears
                        let mut parts = Vec::new();
                        for (k, word) in chunk.iter().enumerate() {
                            if k <= active_idx {
                                parts.push(format!("{}{}", weight_tag, word.word));
                            }
                        }
                        parts.join(&word_separator)
                    }
                    "wave" => {
                        // Wave: active word gets a slight vertical offset
                        let mut parts = Vec::new();
                        for (k, word) in chunk.iter().enumerate() {
                            if k == active_idx {
                                parts.push(format!("{}{{\\t(0,0,\\fry10)}}{}", weight_tag, word.word));
                            } else {
                                parts.push(format!("{}{}", weight_tag, word.word));
                            }
                        }
                        parts.join(&word_separator)
                    }
                    "glow" => {
                        // Glow: active word gets a glow effect via shadow
                        let mut parts = Vec::new();
                        for (k, word) in chunk.iter().enumerate() {
                            if k == active_idx {
                                parts.push(format!("{}{{\\shad4\\bord4\\3c&HFF00FF&}}{}{{\\shad{}\\bord{}\\3c&H000000&}}", 
                                    weight_tag, word.word, adjusted_shadow, adjusted_border1_width));
                            } else {
                                parts.push(format!("{}{}", weight_tag, word.word));
                            }
                        }
                        parts.join(&word_separator)
                    }
                    "box-highlight" => {
                        // Box highlight: active word gets a background box
                        let mut parts = Vec::new();
                        for (k, word) in chunk.iter().enumerate() {
                            if k == active_idx {
                                // Create a pseudo-background with border and shadow
                                parts.push(format!("{}{{\\bord6\\shad4\\3c&H000000&\\4a&H80&HFFFFFF&}}{}{{\\bord{}\\shad{}\\3c&H000000&\\4a&H00&}}", 
                                    weight_tag, word.word, adjusted_border1_width, adjusted_shadow));
                            } else {
                                parts.push(format!("{}{}", weight_tag, word.word));
                            }
                        }
                        parts.join(&word_separator)
                    }
                    "pop" => {
                        // Pop: active word scales up more aggressively with highlight color
                        let scale_up_end = word_start_in_interval + anim_duration_ms;
                        let mut positioned_text_parts = Vec::new();
                        let highlight_ass_color = convert_hex_to_ass_color(&settings.highlight_color);
                        
                        for (k, word) in chunk.iter().enumerate() {
                            if k == active_idx {
                                positioned_text_parts.push(format!(
                                    "{}{{\\c{}\\r\\t({},{},\\fscx130\\fscy130)}}{}{{\\fscx100\\fscy100}}",
                                    weight_tag, highlight_ass_color, word_start_in_interval, scale_up_end, word.word
                                ));
                            } else {
                                positioned_text_parts.push(format!("{}{}", weight_tag, word.word));
                            }
                        }
                        positioned_text_parts.join(&word_separator)
                    }
                    "zoom" => {
                        // Zoom: slower scale-up effect with highlight color
                        let scale_up_end = word_start_in_interval + (anim_duration_ms * 2);
                        let mut positioned_text_parts = Vec::new();
                        let highlight_ass_color = convert_hex_to_ass_color(&settings.highlight_color);
                        
                        for (k, word) in chunk.iter().enumerate() {
                            if k == active_idx {
                                positioned_text_parts.push(format!(
                                    "{}{{\\c{}\\r\\t({},{},\\fscx110\\fscy110)}}{}{{\\fscx100\\fscy100}}",
                                    weight_tag, highlight_ass_color, word_start_in_interval, scale_up_end, word.word
                                ));
                            } else {
                                positioned_text_parts.push(format!("{}{}", weight_tag, word.word));
                            }
                        }
                        positioned_text_parts.join(&word_separator)
                    }
                    _ => {
                        // Default karaoke/scale-up animation with highlight color
                        let scale_up_end = word_start_in_interval + anim_duration_ms;
                        let mut positioned_text_parts = Vec::new();
                        
                        // Get highlight color for karaoke effect (from settings.highlight_color)
                        let highlight_ass_color = convert_hex_to_ass_color(&settings.highlight_color);
                        
                        for (k, word) in chunk.iter().enumerate() {
                            if k == active_idx {
                                // Active word: scale up with highlight color
                                positioned_text_parts.push(format!(
                                    "{}{{\\c{}\\r\\t({},{},\\fscx115\\fscy115)}}{}{{\\fscx100\\fscy100}}",
                                    weight_tag, highlight_ass_color, word_start_in_interval, scale_up_end, word.word
                                ));
                            } else {
                                // Other words: transparent (hidden)
                                positioned_text_parts.push(format!("{}{{\\alpha&HFF&}}{}", weight_tag, word.word));
                            }
                        }
                        positioned_text_parts.join(&word_separator)
                    }
                };

                // Only render overlay layers if there's content to render
                if !overlay_text.is_empty() {
                    // Layer 1: Border2Layer active word (shadow + outer border)
                    writeln!(
                        file,
                        "Dialogue: 1,{},{},Border2Layer,,0,0,0,,{}{}",
                        format_time(t_start),
                        format_time(t_end),
                        pos_tag,
                        overlay_text
                    )
                    .unwrap();

                    // Layer 3: Border1Layer active word (inner border)
                    writeln!(
                        file,
                        "Dialogue: 3,{},{},Border1Layer,,0,0,0,,{}{}",
                        format_time(t_start),
                        format_time(t_end),
                        pos_tag,
                        overlay_text
                    )
                    .unwrap();
                }
            }
        }
    }

    Ok(())
}

// Calculate animation duration for a word (matches VideoPlayer.vue logic)
pub fn calculate_animation_duration(word_duration: f64) -> u32 {
    // Returns duration in milliseconds

    // For very short words (under 50ms), use instant transition
    if word_duration < 0.05 {
        return 0;
    }

    // For short words (50-100ms), use 30% of duration for responsive animation
    if word_duration < 0.1 {
        return ((word_duration * 0.3) * 1000.0) as u32;
    }

    // For medium words (100-200ms), use 35% of duration
    if word_duration < 0.2 {
        return ((word_duration * 0.35) * 1000.0) as u32;
    }

    // For normal words (200-400ms), use 40% of duration
    if word_duration < 0.4 {
        return ((word_duration * 0.4) * 1000.0) as u32;
    }

    // For longer words (400ms+), use 45% but cap at 200ms to prevent overly slow animations
    let calculated_duration = word_duration * 0.45;
    let capped_duration = calculated_duration.min(0.2);
    (capped_duration * 1000.0) as u32
}

// ============================================================================
// TEXT OVERLAY ASS GENERATION
// ============================================================================

/// Generate ASS file for text overlays (separate from subtitles)
/// Text overlays have per-overlay positioning and styling, displayed at specific times
/// Uses per-aspect-ratio configurations when available
pub fn generate_text_overlay_ass_file(
    text_overlays: &[TextOverlaySettings],
    output_path: &std::path::Path,
    video_width: u32,
    video_height: u32,
    time_offset: f64, // Offset to add to all times (e.g., intro duration)
    fonts_dir: Option<&std::path::Path>,
    aspect_ratio: &str, // Current aspect ratio for per-ratio config lookup
) -> Result<(), String> {
    if text_overlays.is_empty() {
        return Ok(()); // Nothing to generate
    }

    let mut file = std::fs::File::create(output_path)
        .map_err(|e| format!("Failed to create text overlay ASS file: {}", e))?;

    // Generate ASS header with normalized 1080p height coordinate system
    let play_res_y = 1080;
    let play_res_x = (video_width as f64 * (1080.0 / video_height as f64)).round() as u32;

    writeln!(file, "[Script Info]").unwrap();
    writeln!(file, "ScriptType: v4.00+").unwrap();
    writeln!(file, "PlayResX: {}", play_res_x).unwrap();
    writeln!(file, "PlayResY: {}", play_res_y).unwrap();
    writeln!(file, "WrapStyle: 1").unwrap();
    writeln!(file, "ScaledBorderAndShadow: yes").unwrap();
    writeln!(file).unwrap();

    // Try to embed fonts if we have unique font families
    if let Some(fonts_path) = fonts_dir {
        if fonts_path.exists() {
            // Create a dummy SubtitleSettings for font embedding
            // We'll use the first overlay's font family
            if let Some(first_overlay) = text_overlays.first() {
                let dummy_settings = SubtitleSettings {
                    enabled: true,
                    font_family: first_overlay.style.font_family.clone(),
                    font_size: first_overlay.style.font_size,
                    font_weight: first_overlay.style.font_weight,
                    text_color: first_overlay.style.color.clone(),
                    background_color: first_overlay
                        .style
                        .background_color
                        .clone()
                        .unwrap_or_default(),
                    background_enabled: first_overlay.style.background_enabled,
                    border1_width: first_overlay.style.border1_width,
                    border1_color: first_overlay
                        .style
                        .border1_color
                        .clone()
                        .unwrap_or_default(),
                    border2_width: first_overlay.style.border2_width,
                    border2_color: first_overlay
                        .style
                        .border2_color
                        .clone()
                        .unwrap_or_default(),
                    shadow_offset_x: first_overlay.style.shadow_offset_x,
                    shadow_offset_y: first_overlay.style.shadow_offset_y,
                    shadow_blur: first_overlay.style.shadow_blur,
                    shadow_color: first_overlay.style.shadow_color.clone().unwrap_or_default(),
                    position: "middle".to_string(),
                    position_percentage: 50.0,
                    max_width: first_overlay.style.max_width,
                    animation_style: "none".to_string(),
                    highlight_color: "#FFFD03".to_string(),
                    multi_color_enabled: false,
                    multi_color_mode: "default".to_string(),
                    color_palette: vec![],
                    line_height: first_overlay.style.line_height,
                    letter_spacing: first_overlay.style.letter_spacing,
                    text_align: first_overlay
                        .style
                        .text_align
                        .clone()
                        .unwrap_or_else(|| "center".to_string()),
                    text_offset_x: first_overlay.style.text_offset_x,
                    text_offset_y: first_overlay.style.text_offset_y,
                    padding: first_overlay.style.padding,
                    border_radius: first_overlay.style.border_radius,
                    word_spacing: first_overlay.style.word_spacing,
                };
                let _ = embed_fonts_in_ass(&mut file, fonts_path, &dummy_settings);
            }
        }
    }

    writeln!(file).unwrap();

    // Generate styles for each text overlay (each overlay can have unique styling)
    writeln!(file, "[V4+ Styles]").unwrap();
    writeln!(file, "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding").unwrap();

    // Convert colors (Hex #RRGGBB to &HAABBGGRR with alpha)
    let convert_color = |hex: &str| -> String {
        let hex = hex.trim_start_matches('#');
        if hex.len() >= 6 {
            let r = &hex[0..2];
            let g = &hex[2..4];
            let b = &hex[4..6];
            format!("&H00{}{}{}", b, g, r).to_uppercase()
        } else {
            "&H00FFFFFF".to_string()
        }
    };

    // Font sizes in text overlays are defined relative to a 1080p reference height.
    // The frontend scales: displayedFontSize = configuredFontSize * (containerHeight / 1080)
    //
    // In export, we work with fixed PlayResY=1080, so font sizes don't need additional
    // correction factors - they're already defined at the right scale.
    let font_correction_factor = 1.0;

    println!(
        "[Rust] Text overlay generation for {}: play_res_x={}, play_res_y={}, font_correction={}",
        aspect_ratio, play_res_x, play_res_y, font_correction_factor
    );

    // Generate a unique style for each overlay (using per-ratio config if available)
    for (idx, overlay) in text_overlays.iter().enumerate() {
        // Get style for current aspect ratio (fallback to default)
        let style = if let Some(ref configs) = overlay.per_ratio_configs {
            configs
                .get(aspect_ratio)
                .map(|c| &c.style)
                .unwrap_or(&overlay.style)
        } else {
            &overlay.style
        };
        let style_name = format!("TextOverlay{}", idx);

        let primary_color = convert_color(&style.color);
        let outline_color = convert_color(style.border1_color.as_deref().unwrap_or("#000000"));
        let shadow_color = if style.shadow_enabled {
            convert_color(style.shadow_color.as_deref().unwrap_or("#000000"))
        } else {
            "&H00000000".to_string() // Transparent
        };
        let _back_color = if style.background_enabled {
            convert_color(style.background_color.as_deref().unwrap_or("#000000"))
        } else {
            "&H00000000".to_string()
        };

        let bold = if style.font_weight >= 700 { 1 } else { 0 };

        // Apply the font correction factor to match browser rendering
        // Font sizes are defined at 1080p reference, scaled by 1.5x for ASS rendering
        let font_size = (style.font_size * font_correction_factor).round() as u32;

        // For outline, ASS extends outward only (vs CSS text-stroke which is centered)
        // So we use 0.5 factor to match visual appearance, plus the font correction
        let outline_width = if style.border1_width > 0.0 {
            (style.border1_width * font_correction_factor * 0.5).max(0.5)
        } else {
            0.0
        };

        let shadow_depth = if style.shadow_enabled {
            let shadow_magnitude =
                (style.shadow_offset_x.powi(2) + style.shadow_offset_y.powi(2)).sqrt();
            (shadow_magnitude * font_correction_factor).max(1.0)
        } else {
            0.0
        };

        let letter_spacing = (style.letter_spacing * font_correction_factor).round() as i32;

        // Alignment: ASS uses numpad-style alignment (5 = center middle)
        let alignment = 5; // Center middle (we position with \pos)

        println!(
            "[Rust] Text overlay {}: font_size={} (raw {} * {:.1}), outline={:.1}, shadow={:.1}",
            idx, font_size, style.font_size, font_correction_factor, outline_width, shadow_depth
        );

        writeln!(
            file,
            "Style: {},{},{},{},{},{},{},{},0,0,0,100,100,{},0,1,{},{},{},10,10,10,1",
            style_name,
            style.font_family,
            font_size,
            primary_color,
            primary_color, // Secondary
            outline_color,
            shadow_color,
            bold,
            letter_spacing,
            outline_width,
            shadow_depth as u32,
            alignment,
        )
        .unwrap();
    }

    writeln!(file).unwrap();

    // Generate Events (dialogue lines)
    writeln!(file, "[Events]").unwrap();
    writeln!(
        file,
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
    )
    .unwrap();

    // Format time helper
    let format_time = |secs: f64| -> String {
        let h = (secs / 3600.0) as u32;
        let m = ((secs % 3600.0) / 60.0) as u32;
        let s = secs % 60.0;
        format!("{}:{:02}:{:05.2}", h, m, s)
    };

    // Generate dialogue for each overlay
    for (idx, overlay) in text_overlays.iter().enumerate() {
        let style_name = format!("TextOverlay{}", idx);
        let start_time = overlay.start_time + time_offset;
        let end_time = overlay.end_time + time_offset;

        // Get position for current aspect ratio (fallback to default)
        let (pos_x_pct, pos_y_pct) = if let Some(ref configs) = overlay.per_ratio_configs {
            if let Some(config) = configs.get(aspect_ratio) {
                (config.position.x, config.position.y)
            } else {
                (overlay.position_x, overlay.position_y)
            }
        } else {
            (overlay.position_x, overlay.position_y)
        };

        // Calculate position in ASS coordinates
        // Frontend uses 0-100% positioning, ASS uses pixel coordinates based on PlayRes
        let pos_x = (pos_x_pct / 100.0 * play_res_x as f64) as i32;
        let pos_y = (pos_y_pct / 100.0 * play_res_y as f64) as i32;

        // Build the text with position override
        let pos_tag = format!("{{\\pos({},{})}}", pos_x, pos_y);

        // Add animation effects if specified
        let anim_tag = match overlay.animation.as_str() {
            "fade" => "{\\fad(300,300)}".to_string(),
            "slide-up" => format!(
                "{{\\move({},{},{},{},0,300)}}",
                pos_x,
                pos_y + 50,
                pos_x,
                pos_y
            ),
            "slide-down" => format!(
                "{{\\move({},{},{},{},0,300)}}",
                pos_x,
                pos_y - 50,
                pos_x,
                pos_y
            ),
            "zoom" => "{\\t(0,300,\\fscx120\\fscy120)\\t(300,600,\\fscx100\\fscy100)}".to_string(),
            "pop" => "{\\t(0,150,\\fscx130\\fscy130)\\t(150,300,\\fscx100\\fscy100)}".to_string(),
            _ => String::new(),
        };

        // Escape text for ASS (replace newlines, special chars)
        let text = overlay
            .text
            .replace("\\", "\\\\")
            .replace("{", "\\{")
            .replace("}", "\\}");

        writeln!(
            file,
            "Dialogue: 0,{},{},{},,0,0,0,,{}{}{}",
            format_time(start_time),
            format_time(end_time),
            style_name,
            pos_tag,
            anim_tag,
            text
        )
        .unwrap();
    }

    println!(
        "[Rust] Generated text overlay ASS file with {} overlays: {}",
        text_overlays.len(),
        output_path.display()
    );

    Ok(())
}

/// Merge text overlay ASS content into an existing subtitle ASS file
/// This appends text overlay styles and events to an existing subtitle file
/// Uses per-aspect-ratio configurations when available
pub fn merge_text_overlays_into_ass(
    subtitle_ass_path: &std::path::Path,
    text_overlays: &[TextOverlaySettings],
    video_width: u32,
    video_height: u32,
    time_offset: f64,
    aspect_ratio: &str, // Current aspect ratio for per-ratio config lookup
) -> Result<(), String> {
    use std::io::Read;

    if text_overlays.is_empty() {
        return Ok(());
    }

    // Read existing ASS content
    let mut existing_content = String::new();
    {
        let mut file = std::fs::File::open(subtitle_ass_path)
            .map_err(|e| format!("Failed to open subtitle ASS file: {}", e))?;
        file.read_to_string(&mut existing_content)
            .map_err(|e| format!("Failed to read subtitle ASS file: {}", e))?;
    }

    // Parse the coordinate system from existing file
    let play_res_y = 1080;
    let play_res_x = (video_width as f64 * (1080.0 / video_height as f64)).round() as u32;

    // Convert colors helper
    let convert_color = |hex: &str| -> String {
        let hex = hex.trim_start_matches('#');
        if hex.len() >= 6 {
            let r = &hex[0..2];
            let g = &hex[2..4];
            let b = &hex[4..6];
            format!("&H00{}{}{}", b, g, r).to_uppercase()
        } else {
            "&H00FFFFFF".to_string()
        }
    };

    // Format time helper
    let format_time = |secs: f64| -> String {
        let h = (secs / 3600.0) as u32;
        let m = ((secs % 3600.0) / 60.0) as u32;
        let s = secs % 60.0;
        format!("{}:{:02}:{:05.2}", h, m, s)
    };

    // Build new styles (using per-ratio config if available)
    let mut new_styles = String::new();
    for (idx, overlay) in text_overlays.iter().enumerate() {
        // Get style for current aspect ratio (fallback to default)
        let style = if let Some(ref configs) = overlay.per_ratio_configs {
            configs
                .get(aspect_ratio)
                .map(|c| &c.style)
                .unwrap_or(&overlay.style)
        } else {
            &overlay.style
        };
        let style_name = format!("TextOverlay{}", idx);

        let primary_color = convert_color(&style.color);
        let outline_color = convert_color(style.border1_color.as_deref().unwrap_or("#000000"));
        let shadow_color = if style.shadow_enabled {
            convert_color(style.shadow_color.as_deref().unwrap_or("#000000"))
        } else {
            "&H00000000".to_string()
        };

        let bold = if style.font_weight >= 700 { 1 } else { 0 };

        // NOTE: Removed 1.5x correction factor to match browser rendering exactly
        // Font sizes are defined at 1080p reference and don't need additional scaling
        let font_correction_factor = 1.0_f32;

        let outline_width = if style.border1_width > 0.0 {
            (style.border1_width * font_correction_factor * 0.5).max(0.5)
        } else {
            0.0
        };
        let shadow_depth = if style.shadow_enabled {
            let shadow_magnitude =
                (style.shadow_offset_x.powi(2) + style.shadow_offset_y.powi(2)).sqrt();
            (shadow_magnitude * font_correction_factor).max(1.0)
        } else {
            0.0
        };

        let font_size = (style.font_size * font_correction_factor).round() as u32;
        let letter_spacing = (style.letter_spacing * font_correction_factor).round() as i32;

        new_styles.push_str(&format!(
            "Style: {},{},{},{},{},{},{},{},0,0,0,100,100,{},0,1,{},{},5,10,10,10,1\n",
            style_name,
            style.font_family,
            font_size,
            primary_color,
            primary_color,
            outline_color,
            shadow_color,
            bold,
            letter_spacing,
            outline_width,
            shadow_depth as u32,
        ));
    }

    // Build new events (using per-ratio position if available)
    let mut new_events = String::new();
    for (idx, overlay) in text_overlays.iter().enumerate() {
        let style_name = format!("TextOverlay{}", idx);
        let start_time = overlay.start_time + time_offset;
        let end_time = overlay.end_time + time_offset;

        // Get position for current aspect ratio (fallback to default)
        let (pos_x_pct, pos_y_pct) = if let Some(ref configs) = overlay.per_ratio_configs {
            if let Some(config) = configs.get(aspect_ratio) {
                (config.position.x, config.position.y)
            } else {
                (overlay.position_x, overlay.position_y)
            }
        } else {
            (overlay.position_x, overlay.position_y)
        };

        let pos_x = (pos_x_pct / 100.0 * play_res_x as f64) as i32;
        let pos_y = (pos_y_pct / 100.0 * play_res_y as f64) as i32;

        let pos_tag = format!("{{\\pos({},{})}}", pos_x, pos_y);

        let anim_tag = match overlay.animation.as_str() {
            "fade" => "{\\fad(300,300)}".to_string(),
            "slide-up" => format!(
                "{{\\move({},{},{},{},0,300)}}",
                pos_x,
                pos_y + 50,
                pos_x,
                pos_y
            ),
            "slide-down" => format!(
                "{{\\move({},{},{},{},0,300)}}",
                pos_x,
                pos_y - 50,
                pos_x,
                pos_y
            ),
            "zoom" => "{\\t(0,300,\\fscx120\\fscy120)\\t(300,600,\\fscx100\\fscy100)}".to_string(),
            "pop" => "{\\t(0,150,\\fscx130\\fscy130)\\t(150,300,\\fscx100\\fscy100)}".to_string(),
            _ => String::new(),
        };

        let text = overlay
            .text
            .replace("\\", "\\\\")
            .replace("{", "\\{")
            .replace("}", "\\}");

        new_events.push_str(&format!(
            "Dialogue: 10,{},{},{},,0,0,0,,{}{}{}\n",
            format_time(start_time),
            format_time(end_time),
            style_name,
            pos_tag,
            anim_tag,
            text
        ));
    }

    // Insert new styles before [Events] section and append new events at the end
    let modified_content = if let Some(events_pos) = existing_content.find("[Events]") {
        // Insert styles before [Events]
        let (before_events, events_and_after) = existing_content.split_at(events_pos);
        format!(
            "{}\n{}\n{}{}",
            before_events.trim_end(),
            new_styles,
            events_and_after,
            new_events
        )
    } else {
        // Just append everything at the end
        format!(
            "{}\n[V4+ Styles]\n{}\n[Events]\n{}",
            existing_content, new_styles, new_events
        )
    };

    // Write back
    std::fs::write(subtitle_ass_path, modified_content)
        .map_err(|e| format!("Failed to write merged ASS file: {}", e))?;

    println!(
        "[Rust] Merged {} text overlays into ASS file: {}",
        text_overlays.len(),
        subtitle_ass_path.display()
    );

    Ok(())
}
