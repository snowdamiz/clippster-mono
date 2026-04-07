use super::types::{TextOverlaySettings, TextOverlayStyle};
use std::path::Path;

/// Check if a text overlay requires advanced rendering (PNG) vs simple ASS
/// Advanced features: gradients, glows, chat bubbles, multiple shadows, background gradients
pub fn needs_advanced_rendering(overlay: &TextOverlaySettings, aspect_ratio: &str) -> bool {
    // Get the style for this aspect ratio
    let style = get_style_for_ratio(overlay, aspect_ratio);

    // Check for advanced features that can't be rendered via ASS
    if let Some(ref s) = style {
        // Chat bubble - requires rounded corners and tail
        if let Some(ref bubble) = s.chat_bubble {
            if bubble.enabled {
                return true;
            }
        }

        // Text gradient
        if let Some(ref gradient) = s.gradient {
            if gradient.enabled && gradient.colors.len() >= 2 {
                return true;
            }
        }

        // Outer glow
        if let Some(ref glow) = s.glow {
            if glow.enabled {
                return true;
            }
        }

        // Multiple shadows (3D, glitch effects)
        if let Some(ref shadows) = s.shadows {
            if !shadows.is_empty() {
                return true;
            }
        }

        // Background gradient
        if let Some(ref bg_gradient) = s.background_gradient {
            if bg_gradient.enabled && bg_gradient.colors.len() >= 2 {
                return true;
            }
        }

        // Background blur (glass effect)
        if let Some(blur) = s.background_blur {
            if blur > 0.0 {
                return true;
            }
        }

        // Filled rounded box (ASS path does not match pill preview reliably)
        if s.background_enabled {
            return true;
        }
    }

    false
}

/// Get the style for a specific aspect ratio, falling back to default
fn get_style_for_ratio(
    overlay: &TextOverlaySettings,
    aspect_ratio: &str,
) -> Option<TextOverlayStyle> {
    // Check per-ratio configs first
    if let Some(ref configs) = overlay.per_ratio_configs {
        if let Some(config) = configs.get(aspect_ratio) {
            return Some(config.style.clone());
        }
    }

    // Fall back to default style
    Some(overlay.style.clone())
}

/// Partition overlays into simple (ASS) and advanced (PNG) categories
pub fn partition_overlays(
    overlays: &[TextOverlaySettings],
    aspect_ratio: &str,
) -> (Vec<TextOverlaySettings>, Vec<TextOverlaySettings>) {
    let mut simple = Vec::new();
    let mut advanced = Vec::new();

    for overlay in overlays {
        if needs_advanced_rendering(overlay, aspect_ratio) {
            advanced.push(overlay.clone());
        } else {
            simple.push(overlay.clone());
        }
    }

    (simple, advanced)
}

/// Render a text overlay to a PNG image using SVG
pub fn render_text_overlay_to_png(
    overlay: &TextOverlaySettings,
    video_width: u32,
    video_height: u32,
    aspect_ratio: &str,
    output_dir: &Path,
) -> Result<String, String> {
    println!("[Rust] render_text_overlay_to_png: id={}, text='{}', aspect={}, video={}x{}", 
        overlay.id, overlay.text, aspect_ratio, video_width, video_height);
    
    // Get style for this aspect ratio
    let style = get_style_for_ratio(overlay, aspect_ratio).ok_or("No style found for overlay")?;
    println!("[Rust] Got style: font={}, size={}, bg_enabled={}", 
        style.font_family, style.font_size, style.background_enabled);

    // Generate SVG for this text overlay
    let svg_content = generate_text_svg(overlay, &style, video_width, video_height)?;
    println!("[Rust] Generated SVG content ({} bytes)", svg_content.len());

    // Render SVG to PNG using resvg
    let output_path = output_dir.join(format!(
        "text_overlay_{}_{}.png",
        overlay.id,
        aspect_ratio.replace(":", "x")
    ));
    render_svg_to_png(&svg_content, &output_path, video_width, video_height)?;
    
    // Verify file exists
    if output_path.exists() {
        let metadata = std::fs::metadata(&output_path);
        println!("[Rust] PNG file created: {} (size: {} bytes)", 
            output_path.display(), 
            metadata.map(|m| m.len()).unwrap_or(0));
    } else {
        println!("[Rust] WARNING: PNG file not found after render: {}", output_path.display());
    }

    Ok(output_path.to_string_lossy().to_string())
}

/// Generate SVG markup for a text overlay
fn generate_text_svg(
    overlay: &TextOverlaySettings,
    style: &TextOverlayStyle,
    video_width: u32,
    video_height: u32,
) -> Result<String, String> {
    let text = escape_xml(&overlay.text);
    let font_family = &style.font_family;
    let font_size = style.font_size;
    let font_weight = style.font_weight;
    let color = &style.color;

    // Calculate position (center of video for now, actual position handled by FFmpeg overlay)
    let center_x = video_width as f64 / 2.0;
    let center_y = video_height as f64 / 2.0;

    let mut svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}">"#,
        video_width, video_height
    );

    // Add defs for gradients if needed
    svg.push_str("<defs>");

    // Text gradient
    if let Some(ref gradient) = style.gradient {
        if gradient.enabled && gradient.colors.len() >= 2 {
            svg.push_str(&generate_gradient_def("textGradient", gradient)?);
        }
    }

    // Background gradient
    if let Some(ref bg_gradient) = style.background_gradient {
        if bg_gradient.enabled && bg_gradient.colors.len() >= 2 {
            svg.push_str(&generate_gradient_def("bgGradient", bg_gradient)?);
        }
    }

    // Glow filter
    if let Some(ref glow) = style.glow {
        if glow.enabled {
            let blur = glow.blur;
            let glow_color = &glow.color;
            svg.push_str(&format!(
                r#"<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="{}" result="blur"/>
                    <feFlood flood-color="{}" flood-opacity="{}"/>
                    <feComposite in2="blur" operator="in"/>
                    <feMerge>
                        <feMergeNode/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>"#,
                blur / 2.0,
                glow_color,
                glow.opacity
            ));
        }
    }

    svg.push_str("</defs>");

    // Background (chat bubble or simple box)
    if let Some(ref chat_bubble) = style.chat_bubble {
        if chat_bubble.enabled {
            svg.push_str(&generate_chat_bubble_bg(
                center_x,
                center_y,
                &text,
                font_size as f64,
                style,
                chat_bubble,
            )?);
        }
    } else if style.background_enabled {
        // Simple background box
        let bg_color = style.background_color.as_deref().unwrap_or("#000000");
        let padding = style.padding as f64;
        let border_radius = style.border_radius as f64;

        // Estimate text dimensions (rough)
        let text_width = text.len() as f64 * (font_size as f64) * 0.6;
        let text_height = (font_size as f64) * 1.2;

        let box_x = center_x - text_width / 2.0 - padding;
        let box_y = center_y - text_height / 2.0 - padding;
        let box_width = text_width + padding * 2.0;
        let box_height = text_height + padding * 2.0;

        let fill = if style
            .background_gradient
            .as_ref()
            .map(|g| g.enabled)
            .unwrap_or(false)
        {
            "url(#bgGradient)".to_string()
        } else {
            bg_color.to_string()
        };

        svg.push_str(&format!(
            r#"<rect x="{}" y="{}" width="{}" height="{}" rx="{}" ry="{}" fill="{}"/>"#,
            box_x, box_y, box_width, box_height, border_radius, border_radius, fill
        ));
    }

    // Build text style
    let text_style = format!(
        "font-family: '{}'; font-size: {}px; font-weight: {};",
        font_family, font_size, font_weight
    );

    // Text fill (gradient or solid)
    let fill = if style.gradient.as_ref().map(|g| g.enabled).unwrap_or(false) {
        "url(#textGradient)".to_string()
    } else {
        color.to_string()
    };

    // Text stroke/outline
    let mut stroke_attr = String::new();
    if style.border1_width > 0.0 {
        let border_color = style.border1_color.as_deref().unwrap_or("#000000");
        stroke_attr = format!(
            r#" stroke="{}" stroke-width="{}""#,
            border_color, style.border1_width
        );
    }

    // Apply glow filter if enabled
    let filter_attr = if style.glow.as_ref().map(|g| g.enabled).unwrap_or(false) {
        r#" filter="url(#glow)""#
    } else {
        ""
    };

    // Shadow (using multiple text elements for shadow effect)
    if style.shadow_enabled {
        let shadow_color = style.shadow_color.as_deref().unwrap_or("#000000");
        let shadow_offset_x = style.shadow_offset_x as f64;
        let shadow_offset_y = style.shadow_offset_y as f64;

        // Shadow text (rendered first, behind main text)
        svg.push_str(&format!(
            r#"<text x="{}" y="{}" text-anchor="middle" dominant-baseline="middle" style="{}" fill="{}" opacity="0.7">{}</text>"#,
            center_x + shadow_offset_x,
            center_y + shadow_offset_y,
            text_style,
            shadow_color,
            text
        ));
    }

    // Multiple shadows (3D, glitch effects)
    if let Some(ref shadows) = style.shadows {
        for shadow in shadows {
            svg.push_str(&format!(
                r#"<text x="{}" y="{}" text-anchor="middle" dominant-baseline="middle" style="{}" fill="{}">{}</text>"#,
                center_x + shadow.offset_x as f64,
                center_y + shadow.offset_y as f64,
                text_style,
                shadow.color,
                text
            ));
        }
    }

    // Main text
    svg.push_str(&format!(
        r#"<text x="{}" y="{}" text-anchor="middle" dominant-baseline="middle" style="{}" fill="{}"{}{}">{}</text>"#,
        center_x, center_y, text_style, fill, stroke_attr, filter_attr, text
    ));

    svg.push_str("</svg>");

    Ok(svg)
}

/// Generate SVG gradient definition
fn generate_gradient_def(
    id: &str,
    gradient: &super::types::GradientConfig,
) -> Result<String, String> {
    let gradient_type = &gradient.gradient_type;
    let angle = gradient.angle;

    let mut stops = String::new();
    for color_stop in &gradient.colors {
        stops.push_str(&format!(
            r#"<stop offset="{}%" stop-color="{}"/>"#,
            color_stop.position, color_stop.color
        ));
    }

    if gradient_type == "linear" || gradient_type == "Linear" {
        // Convert angle to x1,y1,x2,y2
        let angle_rad = angle.to_radians();
        let x1 = 50.0 - 50.0 * angle_rad.cos();
        let y1 = 50.0 - 50.0 * angle_rad.sin();
        let x2 = 50.0 + 50.0 * angle_rad.cos();
        let y2 = 50.0 + 50.0 * angle_rad.sin();

        Ok(format!(
            r#"<linearGradient id="{}" x1="{}%" y1="{}%" x2="{}%" y2="{}%">{}</linearGradient>"#,
            id, x1, y1, x2, y2, stops
        ))
    } else {
        Ok(format!(
            r#"<radialGradient id="{}">{}</radialGradient>"#,
            id, stops
        ))
    }
}

/// Generate chat bubble background SVG
fn generate_chat_bubble_bg(
    center_x: f64,
    center_y: f64,
    text: &str,
    font_size: f64,
    style: &TextOverlayStyle,
    bubble: &super::types::ChatBubbleConfig,
) -> Result<String, String> {
    let padding = style.padding as f64;
    let bg_color = style.background_color.as_deref().unwrap_or("#007AFF");

    // Estimate text dimensions
    let text_width = text.len() as f64 * font_size * 0.6;
    let text_height = font_size * 1.2;

    let box_width = text_width + padding * 2.0;
    let box_height = text_height + padding * 2.0;
    let box_x = center_x - box_width / 2.0;
    let box_y = center_y - box_height / 2.0;

    // Border radius based on shape
    let border_radius = match bubble.shape.as_str() {
        "rounded" => 18.0,
        "pointed" => 8.0,
        "cloud" => 24.0,
        "square" => 4.0,
        _ => 18.0,
    };

    let fill = if style
        .background_gradient
        .as_ref()
        .map(|g| g.enabled)
        .unwrap_or(false)
    {
        "url(#bgGradient)".to_string()
    } else {
        bg_color.to_string()
    };

    let mut svg = format!(
        r#"<rect x="{}" y="{}" width="{}" height="{}" rx="{}" ry="{}" fill="{}"/>"#,
        box_x, box_y, box_width, box_height, border_radius, border_radius, fill
    );

    // Add tail if specified
    let tail_position = bubble.tail_position.as_str();
    if tail_position != "none" {
        let tail_size = bubble.tail_size as f64;
        let tail_path = match tail_position {
            "left" => format!(
                "M {} {} L {} {} L {} {} Z",
                box_x,
                center_y - tail_size / 2.0,
                box_x - tail_size,
                center_y,
                box_x,
                center_y + tail_size / 2.0
            ),
            "right" => format!(
                "M {} {} L {} {} L {} {} Z",
                box_x + box_width,
                center_y - tail_size / 2.0,
                box_x + box_width + tail_size,
                center_y,
                box_x + box_width,
                center_y + tail_size / 2.0
            ),
            "bottom-left" => format!(
                "M {} {} L {} {} L {} {} Z",
                box_x + 20.0,
                box_y + box_height,
                box_x + 10.0,
                box_y + box_height + tail_size,
                box_x + 30.0,
                box_y + box_height
            ),
            "bottom-right" => format!(
                "M {} {} L {} {} L {} {} Z",
                box_x + box_width - 30.0,
                box_y + box_height,
                box_x + box_width - 10.0,
                box_y + box_height + tail_size,
                box_x + box_width - 20.0,
                box_y + box_height
            ),
            _ => String::new(),
        };

        if !tail_path.is_empty() {
            svg.push_str(&format!(r#"<path d="{}" fill="{}"/>"#, tail_path, fill));
        }
    }

    Ok(svg)
}

/// Render SVG content to PNG file
fn render_svg_to_png(
    svg_content: &str,
    output_path: &Path,
    width: u32,
    height: u32,
) -> Result<(), String> {
    use resvg::tiny_skia::Pixmap;
    use resvg::usvg::{Options, Tree};

    // Parse SVG
    let opt = Options::default();
    let tree =
        Tree::from_str(svg_content, &opt).map_err(|e| format!("Failed to parse SVG: {}", e))?;

    // Create pixmap
    let mut pixmap = Pixmap::new(width, height).ok_or("Failed to create pixmap")?;

    // Render
    resvg::render(
        &tree,
        resvg::tiny_skia::Transform::default(),
        &mut pixmap.as_mut(),
    );

    // Save to PNG
    pixmap
        .save_png(output_path)
        .map_err(|e| format!("Failed to save PNG: {}", e))?;

    Ok(())
}

/// Escape XML special characters
fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
