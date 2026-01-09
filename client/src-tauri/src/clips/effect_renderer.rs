#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// Effect settings for FFmpeg filter generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipEffectSettings {
    pub id: String,
    pub effect_type: String,
    pub start_time: f64,
    pub end_time: f64,
    pub intensity: f64,
    #[serde(default)]
    pub parameters: Option<serde_json::Value>,
}

/// Transition settings for FFmpeg xfade filter generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipTransitionSettings {
    pub id: String,
    pub transition_type: String,
    pub position_index: i32,
    pub duration: f64,
    #[serde(default)]
    pub parameters: Option<serde_json::Value>,
}

/// Build FFmpeg filter string for a single effect
pub fn build_effect_filter(
    effect: &ClipEffectSettings,
    _video_width: u32,
    _video_height: u32,
) -> Result<String, String> {
    let intensity = effect.intensity.clamp(0.0, 1.0);
    let enable_expr = format!("enable='between(t,{},{})'", effect.start_time, effect.end_time);
    
    let filter = match effect.effect_type.as_str() {
        // Basic Effects
        "blur" => {
            let radius = get_param_f64(&effect.parameters, "radius", 5.0) * intensity;
            format!("boxblur={}:{}:{}", radius as i32, radius as i32, enable_expr)
        }
        "motion-blur" => {
            let radius = get_param_f64(&effect.parameters, "radius", 10.0) * intensity;
            format!("avgblur=sizeX={}:sizeY=0:{}", radius as i32, enable_expr)
        }
        "sharpen" => {
            let amount = get_param_f64(&effect.parameters, "amount", 1.5) * intensity;
            format!("unsharp=5:5:{}:5:5:0:{}", amount, enable_expr)
        }
        "vignette" => {
            let vignette_intensity = 2.0 + (1.0 - intensity) * 2.0; // Higher = less vignette
            format!("vignette=PI/{}:{}", vignette_intensity, enable_expr)
        }
        "grain" | "noise" => {
            let amount = (get_param_f64(&effect.parameters, "amount", 10.0) * intensity) as i32;
            format!("noise=alls={}:allf=t:{}", amount, enable_expr)
        }
        
        // Color Effects
        "grayscale" => {
            format!("hue=s=0:{}", enable_expr)
        }
        "sepia" => {
            format!("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131:{}", enable_expr)
        }
        "negative" => {
            format!("negate={}", enable_expr)
        }
        "hue-shift" => {
            let degrees = get_param_f64(&effect.parameters, "degrees", 180.0) * intensity;
            format!("hue=h={}:{}", degrees, enable_expr)
        }
        "vibrance" => {
            let amount = get_param_f64(&effect.parameters, "amount", 1.5);
            let adjusted = 1.0 + (amount - 1.0) * intensity;
            format!("vibrance=intensity={}:{}", adjusted, enable_expr)
        }
        "temperature" => {
            let kelvin = get_param_f64(&effect.parameters, "kelvin", 6500.0);
            format!("colortemperature=temperature={}:{}", kelvin as i32, enable_expr)
        }
        "posterize" => {
            let levels = get_param_f64(&effect.parameters, "levels", 4.0) as i32;
            format!("posterize={}:{}", levels, enable_expr)
        }
        "threshold" => {
            format!("threshold:{}", enable_expr)
        }
        "colorize" | "color-balance" => {
            let r = get_param_f64(&effect.parameters, "r", 0.0) * intensity;
            let g = get_param_f64(&effect.parameters, "g", 0.0) * intensity;
            let b = get_param_f64(&effect.parameters, "b", 0.0) * intensity;
            format!("colorbalance=rs={}:gs={}:bs={}:{}", r, g, b, enable_expr)
        }
        "duotone" => {
            format!("hue=s=0,colorbalance=rs=0.3:gs=0.1:bs=-0.2:{}", enable_expr)
        }
        "tint" => {
            let amount = get_param_f64(&effect.parameters, "amount", 0.0) * intensity;
            format!("colorbalance=gm={}:{}", amount, enable_expr)
        }
        
        // Stylized Effects
        "glitch" | "rgb-split" => {
            let offset = (get_param_f64(&effect.parameters, "offset", 5.0) * intensity) as i32;
            format!("rgbashift=rh=-{}:bh={}:{}", offset, offset, enable_expr)
        }
        "vhs" => {
            let noise_amount = (20.0 * intensity) as i32;
            format!("noise=alls={}:allf=t,rgbashift=rh=2:bh=-2:{}", noise_amount, enable_expr)
        }
        "crt" => {
            format!("drawgrid=w=0:h=2:t=1:c=black@0.3:{}", enable_expr)
        }
        "film" => {
            let grain = (5.0 * intensity) as i32;
            format!("noise=alls={}:allf=t,vignette=PI/4:{}", grain, enable_expr)
        }
        "vintage" => {
            format!("curves=vintage,vignette:{}", enable_expr)
        }
        "sketch" => {
            format!("edgedetect=mode=wires:high=0.1:{}", enable_expr)
        }
        "comic" => {
            format!("edgedetect=mode=colormix:high=0:{}", enable_expr)
        }
        "pixelate" => {
            let block_size = get_param_f64(&effect.parameters, "blockSize", 8.0) as i32;
            // Pixelate by scaling down then up with nearest neighbor
            format!("scale=iw/{}:ih/{}:flags=neighbor,scale=iw*{}:ih*{}:flags=neighbor:{}", 
                block_size, block_size, block_size, block_size, enable_expr)
        }
        "oil-paint" => {
            // Simulate oil paint with averaging blur
            format!("avgblur=sizeX=3:sizeY=3:{}", enable_expr)
        }
        "halftone" => {
            // Simulate halftone with grayscale + posterize
            format!("hue=s=0,posterize=4:{}", enable_expr)
        }
        "prism" => {
            // Rainbow chromatic aberration
            format!("rgbashift=rh=-3:gh=0:bh=3:{}", enable_expr)
        }
        "bokeh" => {
            // Depth blur effect using lens correction + blur
            let radius = get_param_f64(&effect.parameters, "radius", 10.0) * intensity;
            format!("gblur=sigma={}:{}", radius, enable_expr)
        }
        "radial-blur" => {
            // Approximate radial blur with regular blur
            let radius = get_param_f64(&effect.parameters, "radius", 5.0) * intensity;
            format!("boxblur={}:{}:{}", radius as i32, radius as i32, enable_expr)
        }
        "lens-flare" => {
            // Create a bright spot with gaussian blur to simulate lens flare
            let pos_x = get_param_f64(&effect.parameters, "positionX", 50.0);
            let pos_y = get_param_f64(&effect.parameters, "positionY", 30.0);
            let flare_intensity = intensity * 0.8;
            // Use geq (generic equation) filter to add a radial gradient light source
            format!(
                "geq=lum='lum(X,Y)+{}*255*exp(-((X-W*{}/100)^2+(Y-H*{}/100)^2)/(W*0.1)^2)':cb='cb(X,Y)':cr='cr(X,Y)':{}",
                flare_intensity, pos_x, pos_y, enable_expr
            )
        }
        "light-leak" => {
            // Warm color overlay simulating film light leak
            let leak_intensity = get_param_f64(&effect.parameters, "intensity", 0.5) * intensity;
            // Add warm tones (red/orange) with colorbalance
            format!(
                "colorbalance=rs={}:gs={}:bs={}:{}",
                leak_intensity * 0.6,
                leak_intensity * 0.2,
                -leak_intensity * 0.1,
                enable_expr
            )
        }
        "kaleidoscope" => {
            // 4-way mirror kaleidoscope effect
            // Crop top-left quadrant, mirror it 4 ways, then stack back together
            format!(
                "split[original][copy];[copy]crop=iw/2:ih/2:0:0,split=4[a][b][c][d];[b]hflip[b];[c]vflip[c];[d]hflip,vflip[d];[a][b]hstack[top];[c][d]hstack[bottom];[top][bottom]vstack[kaleido];[original][kaleido]overlay=enable='between(t,{},{})'",
                effect.start_time, effect.end_time
            )
        }
        
        // Distortion Effects
        "fisheye" | "barrel" => {
            let amount = get_param_f64(&effect.parameters, "amount", 0.5) * intensity;
            format!("lenscorrection=k1={}:k2={}:{}", amount, amount, enable_expr)
        }
        "pincushion" => {
            let amount = get_param_f64(&effect.parameters, "amount", 0.3) * intensity;
            format!("lenscorrection=k1=-{}:{}", amount, enable_expr)
        }
        "wave" => {
            let amplitude = get_param_f64(&effect.parameters, "amplitude", 10.0) * intensity;
            let frequency = get_param_f64(&effect.parameters, "frequency", 5.0);
            format!(
                "geq=lum='lum(X,Y+{}*sin(2*PI*X/{}/50))':cb='cb(X,Y+{}*sin(2*PI*X/{}/50))':cr='cr(X,Y+{}*sin(2*PI*X/{}/50))':{}", 
                amplitude, frequency, amplitude, frequency, amplitude, frequency, enable_expr
            )
        }
        "ripple" => {
            let amplitude = get_param_f64(&effect.parameters, "amplitude", 10.0) * intensity;
            format!(
                "geq=lum='lum(X+{}*sin(hypot(X-W/2,Y-H/2)/10),Y+{}*sin(hypot(X-W/2,Y-H/2)/10))':cb='cb(X,Y)':cr='cr(X,Y)':{}", 
                amplitude, amplitude, enable_expr
            )
        }
        "twirl" => {
            let angle = get_param_f64(&effect.parameters, "angle", 45.0) * intensity;
            let radius = get_param_f64(&effect.parameters, "radius", 50.0);
            format!(
                "rotate=a={}*PI/180*(1-min(hypot(X-W/2,Y-H/2)/(W*{}/100),1)):c=none:{}", 
                angle, radius, enable_expr
            )
        }
        "bulge" => {
            let amount = get_param_f64(&effect.parameters, "amount", 0.5) * intensity;
            format!("lenscorrection=k1={}:{}", amount, enable_expr)
        }
        "stretch" => {
            let x = get_param_f64(&effect.parameters, "x", 1.2);
            let y = get_param_f64(&effect.parameters, "y", 1.0);
            format!("scale=iw*{}:ih*{}:{}", x, y, enable_expr)
        }
        "mirror-h" => {
            format!("crop=iw/2:ih:0:0,split[left][right];[right]hflip[right];[left][right]hstack:{}", enable_expr)
        }
        "mirror-v" => {
            format!("crop=iw:ih/2:0:0,split[top][bottom];[bottom]vflip[bottom];[top][bottom]vstack:{}", enable_expr)
        }
        
        // Motion Effects
        "rotate" => {
            let speed = get_param_f64(&effect.parameters, "speed", 0.5) * intensity;
            format!("rotate=a=t*{}:{}", speed, enable_expr)
        }
        "ken-burns" => {
            format!("zoompan=z='min(zoom+0.0015,1.5)':d=125:{}", enable_expr)
        }
        "shake" => {
            let shake_intensity = get_param_f64(&effect.parameters, "intensity", 5.0) * intensity;
            let speed = get_param_f64(&effect.parameters, "speed", 10.0);
            format!(
                "crop=in_w-{}*2:in_h-{}*2:{}+{}*sin(t*{}):{}+{}*cos(t*{}*1.1),scale=in_w:in_h:{}", 
                shake_intensity, shake_intensity, shake_intensity, shake_intensity, speed, 
                shake_intensity, shake_intensity, speed, enable_expr
            )
        }
        "zoom-pulse" => {
            let amount = get_param_f64(&effect.parameters, "amount", 0.1) * intensity;
            let speed = get_param_f64(&effect.parameters, "speed", 2.0);
            format!(
                "zoompan=z='1+{}*abs(sin(on*{}*PI/25))':d=1:s=hd720:{}", 
                amount, speed, enable_expr
            )
        }
        "pan" => {
            let speed = get_param_f64(&effect.parameters, "speed", 0.5) * intensity;
            format!(
                "zoompan=z=1.1:x='iw*{}*on/100':y='ih/2-(ih/zoom/2)':d=1:s=hd720:{}", 
                speed, enable_expr
            )
        }
        "bounce" => {
            let height = get_param_f64(&effect.parameters, "height", 10.0) * intensity;
            let speed = get_param_f64(&effect.parameters, "speed", 2.0);
            format!(
                "crop=in_w:in_h-{}*2:0:{}*abs(sin(t*{}*PI)),scale=in_w:in_h:{}", 
                height, height, speed, enable_expr
            )
        }
        "float" => {
            let amount = get_param_f64(&effect.parameters, "amount", 5.0) * intensity;
            let speed = get_param_f64(&effect.parameters, "speed", 1.0);
            format!(
                "crop=in_w-{}*2:in_h-{}*2:{}+{}*sin(t*{}):{}+{}*sin(t*{}*0.7),scale=in_w:in_h:{}", 
                amount, amount, amount, amount, speed, amount, amount, speed, enable_expr
            )
        }
        "jitter" => {
            let amount = get_param_f64(&effect.parameters, "amount", 3.0) * intensity;
            format!(
                "crop=in_w-{}*2:in_h-{}*2:{}+{}*random(1):{}+{}*random(2),scale=in_w:in_h:{}", 
                amount, amount, amount, amount, amount, amount, enable_expr
            )
        }
        
        // Overlay Effects
        "letterbox" => {
            let ratio = get_param_f64(&effect.parameters, "ratio", 2.35);
            let bar_height = format!("(ih-(iw/{}))/2", ratio);
            format!("drawbox=y=0:h={}:c=black:t=fill,drawbox=y=ih-{}:h={}:c=black:t=fill:{}", 
                bar_height, bar_height, bar_height, enable_expr)
        }
        "border" => {
            let width = get_param_f64(&effect.parameters, "width", 10.0) as i32;
            let color = get_param_str(&effect.parameters, "color", "white");
            format!("drawbox=x=0:y=0:w={}:h=ih:c={}:t=fill,drawbox=x=iw-{}:y=0:w={}:h=ih:c={}:t=fill:{}", 
                width, color, width, width, color, enable_expr)
        }
        "frame" => {
            let color = get_param_str(&effect.parameters, "color", "white");
            format!(
                "drawbox=x=0:y=0:w=iw:h=20:c={}:t=fill,drawbox=x=0:y=ih-20:w=iw:h=20:c={}:t=fill,drawbox=x=0:y=0:w=20:h=ih:c={}:t=fill,drawbox=x=iw-20:y=0:w=20:h=ih:c={}:t=fill:{}", 
                color, color, color, color, enable_expr
            )
        }
        "shadow" => {
            let blur = get_param_f64(&effect.parameters, "blur", 10.0) as i32;
            let offset_x = get_param_f64(&effect.parameters, "offsetX", 5.0) as i32;
            let offset_y = get_param_f64(&effect.parameters, "offsetY", 5.0) as i32;
            format!(
                "split[a][b];[b]colorchannelmixer=aa=0.5,boxblur={}:{}[shadow];[shadow][a]overlay={}:{}:{}", 
                blur, blur, offset_x, offset_y, enable_expr
            )
        }
        "glow" => {
            let radius = get_param_f64(&effect.parameters, "radius", 10.0) * intensity;
            format!(
                "split[a][b];[b]gblur=sigma={},colorchannelmixer=rr=2:gg=2:bb=2[glow];[a][glow]blend=all_mode=screen:{}", 
                radius, enable_expr
            )
        }
        "outline" => {
            format!("edgedetect=mode=colormix:high=0.1:{}", enable_expr)
        }
        
        // Default: no-op filter
        _ => {
            log::warn!("Unknown effect type: {}, using null filter", effect.effect_type);
            "null".to_string()
        }
    };
    
    Ok(filter)
}

/// Build FFmpeg xfade filter string for a transition between two segments
pub fn build_transition_filter(
    transition: &ClipTransitionSettings,
    input1_label: &str,
    input2_label: &str,
    output_label: &str,
    offset: f64,
) -> Result<String, String> {
    let xfade_type = match transition.transition_type.as_str() {
        // Basic
        "fade" | "crossfade" => "fade",
        "dissolve" => "dissolve",
        "dip-black" | "fade-black" => "fadeblack",
        "dip-white" | "fade-white" => "fadewhite",
        
        // Wipe
        "wipe-left" => "wipeleft",
        "wipe-right" => "wiperight",
        "wipe-up" => "wipeup",
        "wipe-down" => "wipedown",
        "wipe-diagonal-tl" => "wipetl",
        "wipe-diagonal-tr" => "wipetr",
        "wipe-diagonal-bl" => "wipebl",
        "wipe-diagonal-br" => "wipebr",
        "clock-wipe" | "radial-wipe" => "radial",
        
        // Slide
        "slide-left" | "push-left" => "slideleft",
        "slide-right" | "push-right" => "slideright",
        "slide-up" | "push-up" => "slideup",
        "slide-down" | "push-down" => "slidedown",
        
        // Zoom
        "zoom-in" | "zoom-blur" | "zoom-rotate" => "zoomin",
        
        // Stylized
        "glitch" | "pixelate" => "pixelize",
        "flash" => "fadewhite",
        "blur-transition" => "smoothleft",
        
        // Shape
        "circle-open" => "circleopen",
        "circle-close" => "circleclose",
        "diamond" => "diagtl",
        "blinds-h" => "horzopen",
        "blinds-v" => "vertopen",
        "grid" | "mosaic" => "pixelize",
        
        // Directional
        "swipe-left" => "smoothleft",
        "swipe-right" => "smoothright",
        "swipe-up" => "smoothup",
        "swipe-down" => "smoothdown",
        "luma-fade" => "hlslice",
        
        // Stylized 3D
        "flip-h" | "cube" => "horzopen",
        "flip-v" => "vertopen",
        "spin" | "page-curl" => "circleopen",
        
        // Default
        _ => {
            log::warn!("Unknown transition type: {}, using fade", transition.transition_type);
            "fade"
        }
    };
    
    let filter = format!(
        "[{}][{}]xfade=transition={}:duration={}:offset={}[{}]",
        input1_label,
        input2_label,
        xfade_type,
        transition.duration,
        offset,
        output_label
    );
    
    Ok(filter)
}

/// Build a complete filter chain for all effects applied to a video
pub fn build_effects_filter_chain(
    effects: &[ClipEffectSettings],
    video_width: u32,
    video_height: u32,
) -> Result<Option<String>, String> {
    if effects.is_empty() {
        return Ok(None);
    }
    
    // Sort effects by start time
    let mut sorted_effects = effects.to_vec();
    sorted_effects.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
    
    let mut filters = Vec::new();
    
    for effect in &sorted_effects {
        match build_effect_filter(effect, video_width, video_height) {
            Ok(filter) => {
                if filter != "null" {
                    filters.push(filter);
                }
            }
            Err(e) => {
                log::warn!("Failed to build filter for effect {}: {}", effect.id, e);
            }
        }
    }
    
    if filters.is_empty() {
        return Ok(None);
    }
    
    Ok(Some(filters.join(",")))
}

/// Build xfade filter chain for multiple transitions
pub fn build_transitions_filter_chain(
    transitions: &[ClipTransitionSettings],
    segment_durations: &[f64],
) -> Result<Option<String>, String> {
    if transitions.is_empty() || segment_durations.len() < 2 {
        return Ok(None);
    }
    
    // Sort transitions by position index
    let mut sorted_transitions = transitions.to_vec();
    sorted_transitions.sort_by_key(|t| t.position_index);
    
    let mut filters = Vec::new();
    let mut cumulative_offset = 0.0;
    
    for (i, transition) in sorted_transitions.iter().enumerate() {
        let pos = transition.position_index as usize;
        
        // Calculate offset: sum of all segment durations before this transition minus transition duration
        if pos < segment_durations.len() {
            cumulative_offset = segment_durations[..=pos].iter().sum::<f64>() - transition.duration;
        }
        
        let input1 = if i == 0 { "0:v".to_string() } else { format!("xfade{}", i - 1) };
        let input2 = format!("{}:v", pos + 1);
        let output = format!("xfade{}", i);
        
        match build_transition_filter(transition, &input1, &input2, &output, cumulative_offset) {
            Ok(filter) => filters.push(filter),
            Err(e) => {
                log::warn!("Failed to build transition filter: {}", e);
            }
        }
    }
    
    if filters.is_empty() {
        return Ok(None);
    }
    
    Ok(Some(filters.join(";")))
}

// Helper functions
fn get_param_f64(params: &Option<serde_json::Value>, key: &str, default: f64) -> f64 {
    params
        .as_ref()
        .and_then(|p| p.get(key))
        .and_then(|v| v.as_f64())
        .unwrap_or(default)
}

fn get_param_str<'a>(params: &'a Option<serde_json::Value>, key: &str, default: &'a str) -> &'a str {
    params
        .as_ref()
        .and_then(|p| p.get(key))
        .and_then(|v| v.as_str())
        .unwrap_or(default)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_blur_effect() {
        let effect = ClipEffectSettings {
            id: "test".to_string(),
            effect_type: "blur".to_string(),
            start_time: 0.0,
            end_time: 5.0,
            intensity: 1.0,
            parameters: Some(serde_json::json!({"radius": 10})),
        };
        
        let filter = build_effect_filter(&effect, 1920, 1080).unwrap();
        assert!(filter.contains("boxblur"));
        assert!(filter.contains("enable='between(t,0,5)'"));
    }
    
    #[test]
    fn test_fade_transition() {
        let transition = ClipTransitionSettings {
            id: "test".to_string(),
            transition_type: "fade".to_string(),
            position_index: 0,
            duration: 0.5,
            parameters: None,
        };
        
        let filter = build_transition_filter(&transition, "0:v", "1:v", "xfade0", 4.5).unwrap();
        assert!(filter.contains("xfade=transition=fade"));
        assert!(filter.contains("duration=0.5"));
        assert!(filter.contains("offset=4.5"));
    }
}
