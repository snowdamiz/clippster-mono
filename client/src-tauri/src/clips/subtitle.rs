use std::io::Write;
use super::types::{SubtitleSettings, WordInfo, AspectRatio};

// Helper to embed fonts directly in ASS file
pub fn embed_fonts_in_ass(
    file: &mut std::fs::File,
    fonts_dir: &std::path::Path,
    settings: &SubtitleSettings
) -> Result<(), String> {
    use std::io::Read;
    
    // Determine which font files we need based on font family and weight
    let font_files_to_embed = get_required_font_files(settings);
    
    // ASS fonts section uses UUencoded format
    writeln!(file, "[Fonts]").unwrap();
    
    for font_filename in font_files_to_embed {
        let font_path = fonts_dir.join(&font_filename);
        
        if !font_path.exists() {
            println!("[Rust] Warning: Font file not found: {} - FFmpeg will use system fallback", font_path.display());
            continue;
        }
        
        println!("[Rust] Embedding font: {}", font_filename);
        
        // Read font file
        let mut font_file = std::fs::File::open(&font_path)
            .map_err(|e| format!("Failed to open font file {}: {}", font_filename, e))?;
        
        let mut font_data = Vec::new();
        font_file.read_to_end(&mut font_data)
            .map_err(|e| format!("Failed to read font file {}: {}", font_filename, e))?;
        
        println!("[Rust] Font file size: {} bytes", font_data.len());
        
        // Encode as UUencoded (ASS standard for embedded fonts)
        let encoded = uuencode_data(&font_data);
        
        // Write font header - use filename WITHOUT extension (ASS format requirement)
        let font_name_without_ext = font_filename.trim_end_matches(".ttf").trim_end_matches(".otf");
        writeln!(file, "fontname: {}", font_name_without_ext).unwrap();
        
        // Write encoded data
        for line in encoded {
            writeln!(file, "{}", line).unwrap();
        }
        
        writeln!(file, "").unwrap();
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
        },
        "Bebas Neue" => {
            // Bebas Neue only has Regular weight
            "BebasNeue-Regular.ttf".to_string()
        },
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
    
    for chunk in data.chunks(45) { // UUencode uses 45 bytes per line (60 chars output)
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
            let b4 = ((buf[2] & 0x3f)) + 32;
            
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
    time_offset: f64  // Offset to add to all subtitle times (e.g., intro duration)
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
    writeln!(file, "").unwrap();
    
    // Embed fonts if available
    if let Some(fonts_path) = fonts_dir {
        println!("[Rust] Attempting to embed fonts from: {}", fonts_path.display());
        if fonts_path.exists() {
            println!("[Rust] Fonts directory exists, embedding...");
            embed_fonts_in_ass(&mut file, fonts_path, settings)?;
        } else {
            println!("[Rust] WARNING: Fonts directory does not exist! Fonts will not be embedded.");
        }
    } else {
        println!("[Rust] WARNING: No fonts directory provided, fonts will not be embedded.");
    }
    
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
            // Note: Style definitions do NOT use the trailing '&' that override tags use
            format!("&H00{}{}{}", b, g, r).to_uppercase()
        } else {
            "&H00FFFFFF".to_string()
        }
    };

    let primary_color = convert_color(&settings.text_color);
    let border1_color = convert_color(&settings.border1_color);
    let border2_color = convert_color(&settings.border2_color);
    let _back_color = convert_color(&settings.background_color);

    println!("[Rust] Subtitle colors - Text: {}, Border1: {}, Border2: {}, Background: {}", 
        settings.text_color, settings.border1_color, settings.border2_color, settings.background_color);
    println!("[Rust] ASS colors - Primary: {}, Border1: {}, Border2: {}", primary_color, border1_color, border2_color);
    println!("[Rust] Using font: {}", settings.font_family);

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

    // Apply a correction factor to match the frontend visual size for font size
    // The frontend preview renders fonts larger relative to the video frame due to DPI/scaling differences
    let font_size_scale = font_size_scale * 1.5;

    let adjusted_font_size = (settings.font_size * font_size_scale).round();
    // CSS WebkitTextStroke is centered on the path, so only half extends outwards.
    // ASS Outline is entirely outwards. To match the visual thickness of the frontend,
    // we need to divide the stroke width by 2.
    let adjusted_border1_width = settings.border1_width * font_size_scale * 0.8;
    let adjusted_border2_width = settings.border2_width * font_size_scale * 0.8;
    // ASS Shadow parameter is an offset depth, calculate from shadow offset X/Y
    // Use the magnitude of the offset vector for proper shadow distance
    let shadow_offset_magnitude = ((settings.shadow_offset_x.powi(2) + settings.shadow_offset_y.powi(2)).sqrt()) * font_size_scale;
    let adjusted_shadow = shadow_offset_magnitude;
    let adjusted_letter_spacing = settings.letter_spacing * font_size_scale;

    println!("[Rust] Font size: {} -> {} (scale: {})", settings.font_size, adjusted_font_size, font_size_scale);

    // Calculate margins and positioning to match VideoPlayer.vue
    // Vue uses a container with width=maxWidth% centered on screen
    // And positions it using top=positionPercentage% and translate(-50%, -50%)
    
    let adjusted_padding = settings.padding * font_size_scale;
    let box_width_px = play_res_x as f64 * (settings.max_width as f64 / 100.0);
    
    // Calculate margins to constrain text to box_width - 2*padding
    // The box is centered on screen, so margins are symmetric
    let side_margin = (play_res_x as f64 - box_width_px) / 2.0;
    let margin_l = (side_margin + adjusted_padding as f64).round() as i32;
    let margin_r = (side_margin + adjusted_padding as f64).round() as i32;
    
    // Calculate target position for \pos(x,y)
    // X: Center of screen + Offset (percentage of box width)
    let shift_x_px = box_width_px * (settings.text_offset_x as f64 / 100.0);
    let target_x = (play_res_x as f64 / 2.0) + shift_x_px;
    
    // Y: Position% of screen + Offset (percentage of height)
    // We approximate height as 2 lines + padding for the offset calculation
    let approx_height = (adjusted_font_size as f64 * 2.0) + (adjusted_padding as f64 * 2.0);
    let shift_y_px = approx_height * (settings.text_offset_y as f64 / 100.0);
    
    // Apply a vertical correction to raise the subtitles slightly
    // The font scaling (1.5x) pushes the bottom edge down, so we compensate by moving the center up
    // We use a factor of the font size as a heuristic for the correction
    let vertical_correction = (adjusted_font_size as f64) * 0.3;
    
    let target_y = (play_res_y as f64 * (settings.position_percentage as f64 / 100.0)) + shift_y_px - vertical_correction;
    
    // Use Alignment 5 (Middle Center) to match Vue's translate(-50%, -50%)
    let alignment = 5;
    let margin_v = 10; // Not used for positioning with \pos, but required by Style
    
    let pos_tag = format!("{{\\pos({:.0},{:.0})}}", target_x, target_y);

    // For embedded fonts, we need to reference the actual font family name 
    // and use \fw tags for specific weights, as standard ASS only supports Bold/Italic.
    // This avoids issues where libass fails to match a constructed name like "Montserrat-Bold"
    // if the internal family name is just "Montserrat".
    
    // We'll use the base family name in the Style
    let font_name_for_style = settings.font_family.clone();
    
    // But we still need to embed the specific font file corresponding to the weight.
    // (This is handled by get_required_font_files and embed_fonts_in_ass)

    // Standard ASS Bold flag (only for generic bold, specific weights handled via \fw)
    let bold = if settings.font_weight >= 700 { -1 } else { 0 };
    
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
    let word_separator = format!("{{\\fsp{:.1}}} {{\\fsp{:.1}}}", space_char_spacing, adjusted_letter_spacing);

    writeln!(file, "Style: Border2Layer,{},{},{},{},{},{},{},0,0,0,100,100,{},0,1,{},{},{},{},{},{},1",
        font_name_for_style,
        adjusted_font_size,
        primary_color,
        primary_color, // SecondaryColour
        border2_color, // OutlineColour (border2 color)
        shadow_color_ass, // BackColour (Shadow color)
        bold,
        adjusted_letter_spacing,
        total_border_width, // Outline (total width)
        adjusted_shadow, // Shadow (drop shadow)
        alignment,
        margin_l,
        margin_r,
        margin_v
    ).unwrap();

    // Style 2: Border1Layer (top layer with smaller outline = border1 only)
    writeln!(file, "Style: Border1Layer,{},{},{},{},{},{},{},0,0,0,100,100,{},0,1,{},{},{},{},{},{},1",
        font_name_for_style,
        adjusted_font_size,
        primary_color,
        primary_color, // SecondaryColour
        border1_color, // OutlineColour (border1 color)
        "&H00000000".to_string(), // No background for top layer
        bold,
        adjusted_letter_spacing,
        adjusted_border1_width, // Outline (border1 only)
        0.0, // No shadow on top layer
        alignment,
        margin_l,
        margin_r,
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
    clip_timeline_words.sort_by(|a, b| a.start.partial_cmp(&b.start).unwrap_or(std::cmp::Ordering::Equal));

    if clip_timeline_words.is_empty() {
        return Ok(());
    }

    // 2. Group words into chunks (pages)
    let _chunks: Vec<&[ClipWord]> = clip_timeline_words.chunks(max_words).collect();

    // 3. Generate events for each chunk
    let chunk_count = (clip_timeline_words.len() + max_words - 1) / max_words;
    
    for i in 0..chunk_count {
        let start_idx = i * max_words;
        let end_idx = std::cmp::min(start_idx + max_words, clip_timeline_words.len());
        let chunk = &clip_timeline_words[start_idx..end_idx];
        
        if chunk.is_empty() { continue; }

        let chunk_visible_start = if i == 0 {
            time_offset  // Start at the time offset (after intro)
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
            let weight_tag = format!("{{\\fw{}}}", settings.font_weight);
            let base_text = chunk.iter().map(|w| format!("{}{}", weight_tag, w.word)).collect::<Vec<_>>().join(&word_separator);
            
            writeln!(file, "Dialogue: 0,{},{},Border2Layer,,0,0,0,,{}{}",
                format_time(t_start),
                format_time(t_end),
                pos_tag,
                base_text
            ).unwrap();
            
            // Layer 2: Border1Layer base text with all words at normal size
            writeln!(file, "Dialogue: 2,{},{},Border1Layer,,0,0,0,,{}{}",
                format_time(t_start),
                format_time(t_end),
                pos_tag,
                base_text
            ).unwrap();
            
            // Layers 1 & 3: If there's an active word, render it scaled on top (for both border layers)
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
                
                let scale_up_end = word_start_in_interval + anim_duration_ms;
                
                // Build text with spaces to position the active word correctly
                // Use invisible characters (zero-width) for other words to maintain spacing
                let mut positioned_text_parts = Vec::new();
                for (k, word) in chunk.iter().enumerate() {
                    if k == active_idx {
                        // Active word with animation
                        positioned_text_parts.push(format!(
                            "{}{{\\r\\t({},{},\\fscx115\\fscy115)}}{}{{\\fscx100\\fscy100}}",
                            weight_tag,
                            word_start_in_interval,
                            scale_up_end,
                            word.word
                        ));
                    } else {
                        // Use {\alpha&HFF&} to make word invisible (maintains spacing)
                        // Still include weight tag to maintain spacing metrics
                        positioned_text_parts.push(format!("{}{{\\alpha&HFF&}}{}", weight_tag, word.word));
                    }
                }
                
                let overlay_text = positioned_text_parts.join(&word_separator);
                
                // Layer 1: Border2Layer active word (shadow + outer border)
                writeln!(file, "Dialogue: 1,{},{},Border2Layer,,0,0,0,,{}{}",
                    format_time(t_start),
                    format_time(t_end),
                    pos_tag,
                    overlay_text
                ).unwrap();
                
                // Layer 3: Border1Layer active word (inner border)
                writeln!(file, "Dialogue: 3,{},{},Border1Layer,,0,0,0,,{}{}",
                    format_time(t_start),
                    format_time(t_end),
                    pos_tag,
                    overlay_text
                ).unwrap();
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

