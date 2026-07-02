use tauri_plugin_shell::{process::CommandEvent, ShellExt};

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{Emitter, Runtime};

const FFMPEG_EXPORT_CANCELLED: &str = "Export cancelled by user";

static ACTIVE_VIDEO_EDITOR_EXPORTS: Lazy<Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

#[derive(Clone, Serialize)]
struct VideoEditorExportProgressPayload {
    export_id: String,
    progress: f64,
}

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

    pub highlights: Option<f64>,

    pub shadows: Option<f64>,

    pub exposure: Option<f64>,

    pub fade: Option<f64>,

    pub tint: Option<String>,

    pub sharpness: Option<f64>,

    pub effects: Option<Vec<VideoEffect>>,

    pub is_image: Option<bool>,

    pub is_reversed: Option<bool>,

    pub fade_in: Option<f64>,

    pub fade_out: Option<f64>,

    pub animation_in: Option<AnimationData>,

    pub animation_out: Option<AnimationData>,

    /// Deserialized from frontend; loop presets are not mapped to FFmpeg yet.
    #[allow(dead_code)]
    pub animation_loop: Option<AnimationData>,

    pub keyframes: Option<Vec<KeyframeTrack>>,

    // Phase 3: Color grading
    pub color_curves_master: Option<Vec<[f64; 2]>>,
    pub color_curves_red: Option<Vec<[f64; 2]>>,
    pub color_curves_green: Option<Vec<[f64; 2]>>,
    pub color_curves_blue: Option<Vec<[f64; 2]>>,
    pub color_wheels_shadows_hue: Option<f64>,
    pub color_wheels_shadows_saturation: Option<f64>,
    pub color_wheels_shadows_luminance: Option<f64>,
    pub color_wheels_midtones_hue: Option<f64>,
    pub color_wheels_midtones_saturation: Option<f64>,
    pub color_wheels_midtones_luminance: Option<f64>,
    pub color_wheels_highlights_hue: Option<f64>,
    pub color_wheels_highlights_saturation: Option<f64>,
    pub color_wheels_highlights_luminance: Option<f64>,
    pub lut_path: Option<String>,

    // Phase 5: Audio pan
    pub pan: Option<f64>,

    // Phase 8: Blend mode
    pub blend_mode: Option<String>,

    // Shape masks (rectangle / ellipse, normalised 0–1 coords)
    pub masks: Option<Vec<MaskShape>>,

    /// True when this clip is on the scene's main video track (bottom layer). Used for overlap compositing order.
    #[serde(default)]
    pub track_is_main: Option<bool>,

    /// `orderIndex` within the track (CapCut-style stacking). Lower = further back within the same track tier.
    #[serde(default)]
    pub order_index: Option<i32>,

    pub chromakey: Option<ChromaKeySettings>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChromaKeySettings {
    pub enabled: bool,
    pub color: String,
    pub similarity: f64,
    pub smoothness: f64,
    #[serde(default)]
    pub spill_reduction: Option<f64>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MaskPoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MaskShape {
    /// "rectangle" | "ellipse" | "polygon"
    pub mask_type: String,
    /// Normalised center X (0–1) for rectangle / ellipse; ignored for polygon when points are set
    pub x: f64,
    /// Normalised center Y (0–1)
    pub y: f64,
    /// Normalised width (0–1)
    pub width: f64,
    /// Normalised height (0–1)
    pub height: f64,
    /// Feather radius in canvas pixels (0 = hard edge)
    pub feather: f64,
    /// Invert the mask
    pub invert: bool,
    /// Rotation in degrees
    pub rotation: f64,
    /// 0–1 fraction of min(half-width, half-height); rectangle only
    #[serde(default)]
    pub corner_radius: Option<f64>,
    /// Normalised polygon vertices (polygon only)
    #[serde(default)]
    pub points: Option<Vec<MaskPoint>>,
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

    pub trim_start: Option<f64>,

    pub volume: f64,

    pub is_muted: bool,

    pub speed: Option<f64>,

    pub fade_in: Option<f64>,

    pub fade_out: Option<f64>,

    pub audio_effects: Option<Vec<AudioEffect>>,

    pub pan: Option<f64>,
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

    /// When true, `image_path` is an image2 printf pattern (…/frame_%05d.png).
    #[serde(default)]
    pub is_frame_sequence: bool,

    #[serde(default)]
    #[allow(dead_code)]
    pub sequence_frame_count: Option<u32>,
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

    #[serde(default)]
    pub is_frame_sequence: bool,

    #[serde(default)]
    #[allow(dead_code)]
    pub sequence_frame_count: Option<u32>,
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
    /// Timeline cut position from the editor (export uses padded segment lengths for xfade offset).
    #[allow(dead_code)]
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

    pub fps: i32,

    pub width: i32,

    pub height: i32,

    pub cover_timestamp: Option<f64>,

    pub branding_watermark: Option<BrandingWatermark>,

    pub branding_overlays: Option<Vec<BrandingOverlay>>,

    pub intro_path: Option<String>,

    pub intro_duration: Option<f64>,

    pub outro_path: Option<String>,

    pub outro_duration: Option<f64>,

    pub export_id: Option<String>,

    /// When set, FFmpeg uses this `image2` pattern (e.g. `.../frame_%05d.jpg`) as the **video**
    /// stream after all `video_sources` inputs. Visual compositing from `video_sources` is skipped;
    /// those inputs are still used for embedded clip audio and probes.
    #[serde(default)]
    pub scene_frame_pattern: Option<String>,

    #[serde(default)]
    pub scene_frame_count: Option<u32>,

    /// `mp4` (default) or `webm`
    #[serde(default = "default_export_format")]
    pub export_format: String,

    #[serde(default = "default_export_quality")]
    pub export_quality: String,

    #[serde(default = "default_include_audio")]
    pub include_audio: bool,
}

fn default_export_format() -> String {
    "mp4".to_string()
}

fn default_export_quality() -> String {
    "high".to_string()
}

fn default_include_audio() -> bool {
    true
}

/// Full video editor export with audio tracks, text overlays, and effects

fn register_video_editor_export(export_id: &str) -> Arc<AtomicBool> {
    let cancel_flag = Arc::new(AtomicBool::new(false));
    let mut exports = ACTIVE_VIDEO_EDITOR_EXPORTS.lock().unwrap();
    exports.insert(export_id.to_string(), Arc::clone(&cancel_flag));
    cancel_flag
}

fn unregister_video_editor_export(export_id: &str) {
    let mut exports = ACTIVE_VIDEO_EDITOR_EXPORTS.lock().unwrap();
    exports.remove(export_id);
}

#[tauri::command]
pub fn cancel_video_editor_export(export_id: String) -> Result<bool, String> {
    let exports = ACTIVE_VIDEO_EDITOR_EXPORTS.lock().unwrap();
    if let Some(cancel_flag) = exports.get(&export_id) {
        cancel_flag.store(true, Ordering::SeqCst);
        Ok(true)
    } else {
        Ok(false)
    }
}

async fn run_ffmpeg_for_video_editor_export<R: Runtime>(
    app: &tauri::AppHandle<R>,
    args: &[String],
    cancel_flag: Option<Arc<AtomicBool>>,
    progress_export_id: Option<String>,
    progress_total_duration: Option<f64>,
) -> Result<Vec<u8>, String> {
    let shell = app.shell();
    let (mut rx, child) = shell
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
        .args(args)
        .spawn()
        .map_err(|e| format!("Failed to spawn FFmpeg: {}", e))?;

    let mut stderr_buf = Vec::new();
    let mut stderr_text_tail = String::new();
    let mut last_emitted_progress = 0.0_f64;

    loop {
        if cancel_flag
            .as_ref()
            .is_some_and(|flag| flag.load(Ordering::SeqCst))
        {
            let _ = child.kill();
            return Err(FFMPEG_EXPORT_CANCELLED.to_string());
        }

        tokio::select! {
            event = rx.recv() => {
                match event {
                    Some(CommandEvent::Stderr(data)) => {
                        stderr_buf.extend_from_slice(&data);
                        if let (Some(export_id), Some(total_duration)) =
                            (progress_export_id.as_ref(), progress_total_duration)
                        {
                            stderr_text_tail.push_str(&String::from_utf8_lossy(&data));
                            if stderr_text_tail.len() > 8192 {
                                stderr_text_tail = stderr_text_tail
                                    .chars()
                                    .rev()
                                    .take(4096)
                                    .collect::<String>()
                                    .chars()
                                    .rev()
                                    .collect();
                            }
                            if let Some(seconds) = parse_ffmpeg_progress_seconds(&stderr_text_tail) {
                                if total_duration > 0.001 {
                                    let progress = (seconds / total_duration).clamp(0.0, 0.995);
                                    if progress - last_emitted_progress >= 0.005 || progress >= 0.995 {
                                        last_emitted_progress = progress;
                                        let _ = app.emit(
                                            "video-editor-export-progress",
                                            VideoEditorExportProgressPayload {
                                                export_id: export_id.clone(),
                                                progress,
                                            },
                                        );
                                    }
                                }
                            }
                        }
                    }
                    Some(CommandEvent::Terminated(payload)) => {
                        if payload.code == Some(0) {
                            return Ok(stderr_buf);
                        }

                        let stderr = String::from_utf8_lossy(&stderr_buf);
                        return Err(format!("FFmpeg export failed: {}", stderr));
                    }
                    Some(CommandEvent::Error(err)) => {
                        let _ = child.kill();
                        return Err(format!("FFmpeg process error: {}", err));
                    }
                    Some(_) => {}
                    None => return Err("FFmpeg closed without termination".to_string()),
                }
            }
            _ = tokio::time::sleep(Duration::from_millis(120)) => {}
        }
    }
}

fn parse_ffmpeg_progress_seconds(text: &str) -> Option<f64> {
    let mut latest: Option<f64> = None;

    for line in text.lines().rev().take(80) {
        let trimmed = line.trim();
        if let Some(value) = trimmed.strip_prefix("out_time_ms=") {
            if let Ok(us) = value.trim().parse::<f64>() {
                latest = Some(us / 1_000_000.0);
                break;
            }
        }
        if let Some(value) = trimmed.strip_prefix("out_time_us=") {
            if let Ok(us) = value.trim().parse::<f64>() {
                latest = Some(us / 1_000_000.0);
                break;
            }
        }
        if let Some(value) = trimmed.strip_prefix("out_time=") {
            latest = parse_ffmpeg_timecode(value.trim());
            if latest.is_some() {
                break;
            }
        }

        // Fallback for FFmpeg's default stats line: "... time=00:00:12.34 ..."
        if let Some(idx) = trimmed.find("time=") {
            let after = &trimmed[idx + "time=".len()..];
            let value = after.split_whitespace().next().unwrap_or("");
            latest = parse_ffmpeg_timecode(value);
            if latest.is_some() {
                break;
            }
        }
    }

    latest
}

fn parse_ffmpeg_timecode(value: &str) -> Option<f64> {
    let parts: Vec<&str> = value.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let hours = parts[0].parse::<f64>().ok()?;
    let minutes = parts[1].parse::<f64>().ok()?;
    let seconds = parts[2].parse::<f64>().ok()?;
    Some(hours * 3600.0 + minutes * 60.0 + seconds)
}

/// Video/audio codec flags for the final mux (MP4 vs WebM, quality tiers, optional `-an`).
fn append_export_codec_args(args: &mut Vec<String>, format: &str, quality: &str, include_audio: bool) {
    let fmt = format.trim().to_ascii_lowercase();
    let q = quality.trim().to_ascii_lowercase();
    let crf_h264 = match q.as_str() {
        "low" => 28,
        "medium" => 24,
        "high" => 20,
        "very_high" => 18,
        _ => 23,
    };
    match fmt.as_str() {
        "webm" => {
            args.push("-c:v".to_string());
            args.push("libvpx-vp9".to_string());
            args.push("-row-mt".to_string());
            args.push("1".to_string());
            args.push("-b:v".to_string());
            let br = match q.as_str() {
                "low" => "1200k",
                "medium" => "2500k",
                "high" => "5000k",
                "very_high" => "8000k",
                _ => "2500k",
            };
            args.push(br.to_string());
            args.push("-deadline".to_string());
            args.push("good".to_string());
            args.push("-cpu-used".to_string());
            args.push("2".to_string());
            if include_audio {
                args.push("-c:a".to_string());
                args.push("libopus".to_string());
                args.push("-b:a".to_string());
                args.push("160k".to_string());
            } else {
                args.push("-an".to_string());
            }
        }
        _ => {
            args.push("-c:v".to_string());
            args.push("libx264".to_string());
            args.push("-preset".to_string());
            let preset = match q.as_str() {
                "very_high" => "slow",
                "high" => "medium",
                "low" => "veryfast",
                _ => "medium",
            };
            args.push(preset.to_string());
            args.push("-crf".to_string());
            args.push(crf_h264.to_string());
            if include_audio {
                args.push("-c:a".to_string());
                args.push("aac".to_string());
                args.push("-b:a".to_string());
                let ab = match q.as_str() {
                    "low" => "128k",
                    "very_high" => "256k",
                    _ => "192k",
                };
                args.push(ab.to_string());
            } else {
                args.push("-an".to_string());
            }
            args.push("-movflags".to_string());
            args.push("+faststart".to_string());
        }
    }
}

/// Build `[v]` from the pre-rendered scene image sequence input (`scene_input_index`).
fn push_scene_video_filter_chain(
    filters: &mut Vec<String>,
    scene_input_index: usize,
    fps: i32,
    width: i32,
    height: i32,
    total_duration: f64,
    needs_black_padding: bool,
    black_padding_duration: f64,
) {
    let mut chain = format!(
        "[{}:v]fps={},scale={}:{}:flags=lanczos:force_original_aspect_ratio=disable,setsar=1,format=yuv420p,setpts=PTS-STARTPTS,trim=duration={}",
        scene_input_index,
        fps.max(1),
        width,
        height,
        total_duration
    );
    if needs_black_padding {
        chain.push_str(&format!(
            ",tpad=stop_mode=add:stop_duration={}:color=black",
            black_padding_duration
        ));
    }
    chain.push_str("[v]");
    filters.push(chain);
}

/// Map editor blend preset names to FFmpeg `blend` filter `all_mode` values.
fn map_blend_mode_ffmpeg(mode: &str) -> &'static str {
    match mode {
        "multiply" => "multiply",
        "screen" => "screen",
        "overlay" => "overlay",
        "soft-light" => "softlight",
        "hard-light" => "hardlight",
        "darken" => "darken",
        "lighten" => "lighten",
        "color-dodge" => "colordodge",
        "color-burn" => "colorburn",
        "difference" => "difference",
        "exclusion" => "exclusion",
        _ => "normal",
    }
}

/// Parse hex key color to RGB in 0–1 (matches preview chromakey UI).
fn parse_hex_rgb01(hex: &str) -> Option<(f64, f64, f64)> {
    let clean = hex.trim().trim_start_matches('#');
    let full = if clean.len() == 3 {
        let mut out = String::with_capacity(6);
        for c in clean.chars() {
            out.push(c);
            out.push(c);
        }
        out
    } else {
        clean.to_string()
    };
    if full.len() != 6 || !full.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    let r = u8::from_str_radix(&full[0..2], 16).ok()? as f64 / 255.0;
    let g = u8::from_str_radix(&full[2..4], 16).ok()? as f64 / 255.0;
    let b = u8::from_str_radix(&full[4..6], 16).ok()? as f64 / 255.0;
    Some((r, g, b))
}

/// Spill suppression pass before `chromakey`, aligned with preview shader (`webgl-chromakey.ts`):
/// YCbCr chroma distance → chromaProximity → spillMask → mix dominant key channel toward neutral.
/// FFmpeg `geq` commas inside expressions must be escaped as `\,` for filtergraphs.
fn build_chromakey_spill_geq(chromakey: &ChromaKeySettings, kr: f64, kg: f64, kb: f64) -> Option<String> {
    let spill_ui = chromakey.spill_reduction.unwrap_or(0.0);
    if spill_ui <= 0.0 {
        return None;
    }
    let spill_amt = (spill_ui / 100.0).clamp(0.0, 1.0);

    let sim = (chromakey.similarity / 100.0).clamp(0.0, 1.0) * 0.4;
    let smth = (chromakey.smoothness / 100.0).clamp(0.0, 1.0) * 0.2;
    let spill_range = (sim + smth * 2.0 + 0.05).max(0.001);

    let kcb = -0.169 * kr - 0.331 * kg + 0.5 * kb + 0.5;
    let kcr = 0.5 * kr - 0.419 * kg - 0.081 * kb + 0.5;

    let kcb_s = format!("{:.10}", kcb);
    let kcr_s = format!("{:.10}", kcr);
    let sr_s = format!("{:.10}", spill_range);
    let sa_s = format!("{:.10}", spill_amt);

    // Pixel coords: escaped commas for filter_complex
    let rx = "r(X\\,Y)";
    let gx = "g(X\\,Y)";
    let bx = "b(X\\,Y)";

    let cb = format!(
        "(-0.169*{rx}/255-0.331*{gx}/255+0.5*{bx}/255+0.5)",
        rx = rx,
        gx = gx,
        bx = bx
    );
    let cr = format!(
        "(0.5*{rx}/255-0.419*{gx}/255-0.081*{bx}/255+0.5)",
        rx = rx,
        gx = gx,
        bx = bx
    );

    let dist = format!(
        "sqrt(pow({cb}-{kcb}\\,2)+pow({cr}-{kcr}\\,2))",
        cb = cb,
        cr = cr,
        kcb = kcb_s,
        kcr = kcr_s
    );

    let chroma_prox = format!(
        "max(0\\,1-(({dist})/{sr}))",
        dist = dist,
        sr = sr_s
    );

    // Match preview shader: spillMask = min(1, (1-alpha + chromaProximity)*0.5) * spillAmount.
    // Preview alpha = smoothstep(sim, sim+smoothness, dist); use linear ramp between same endpoints (close fit).
    let t_s = format!("{:.10}", sim);
    let w_s = format!("{:.10}", smth.max(0.0001));
    let alpha_lin = format!(
        "max(0\\,min(1\\,(({dist})-{ts})/max({ws}\\,0.0001)))",
        dist = dist,
        ts = t_s,
        ws = w_s
    );
    let spill_mask = format!(
        "min(1\\,((1-({al}))+({cp}))*0.5)*{sa}",
        al = alpha_lin,
        cp = chroma_prox,
        sa = sa_s
    );

    let (r_e, g_e, b_e) = if kg >= kr && kg >= kb {
        let avg = format!("(({rx}/255+{bx}/255)/2)", rx = rx, bx = bx);
        let gn_new = format!(
            "({gx}/255)*(1-({sm}))+({avg})*({sm})",
            gx = gx,
            sm = spill_mask,
            avg = avg
        );
        let g_out = format!("min(255\\,max(0\\,255*({gn})))", gn = gn_new);
        (rx.to_string(), g_out, bx.to_string())
    } else if kb >= kr && kb >= kg {
        let avg = format!("(({rx}/255+{gx}/255)/2)", rx = rx, gx = gx);
        let bn_new = format!(
            "({bx}/255)*(1-({sm}))+({avg})*({sm})",
            bx = bx,
            sm = spill_mask,
            avg = avg
        );
        let b_out = format!("min(255\\,max(0\\,255*({bn})))", bn = bn_new);
        (rx.to_string(), gx.to_string(), b_out)
    } else {
        let avg = format!("(({gx}/255+{bx}/255)/2)", gx = gx, bx = bx);
        let rn_new = format!(
            "({rx}/255)*(1-({sm}))+({avg})*({sm})",
            rx = rx,
            sm = spill_mask,
            avg = avg
        );
        let r_out = format!("min(255\\,max(0\\,255*({rn})))", rn = rn_new);
        (r_out, gx.to_string(), bx.to_string())
    };

    Some(format!("geq=r='{}':g='{}':b='{}'", r_e, g_e, b_e))
}

fn build_highlight_shadow_filter(highlights: f64, shadows: f64) -> Option<String> {
    if highlights.abs() <= 0.5 && shadows.abs() <= 0.5 {
        return None;
    }

    let highlight_shift = (highlights / 100.0) * 60.0;
    let shadow_shift = (shadows / 100.0) * 60.0;
    let lum = "((0.299*r(X\\,Y)+0.587*g(X\\,Y)+0.114*b(X\\,Y))/255)";
    let adjustment = format!(
        "({hs}*if(gt({lum}\\,0.5)\\,(({lum}-0.5)*2)\\,0)+{ss}*if(lt({lum}\\,0.5)\\,((0.5-{lum})*2)\\,0))",
        hs = highlight_shift,
        ss = shadow_shift,
        lum = lum
    );
    let channel = |name: &str| -> String {
        format!(
            "min(255\\,max(0\\,{name}(X\\,Y)+({adjustment})))",
            name = name,
            adjustment = adjustment
        )
    };

    Some(format!(
        "geq=r='{}':g='{}':b='{}'",
        channel("r"),
        channel("g"),
        channel("b")
    ))
}

fn color_wheel_balance(hue: f64, saturation: f64, luminance: f64) -> (f64, f64, f64) {
    const WHEEL_COLOR_STRENGTH: f64 = 0.35;

    let (r, g, b) = hsl_to_rgb_unit((hue % 360.0 + 360.0) % 360.0, 1.0, 0.5);
    let amount = saturation.clamp(-1.0, 1.0) * WHEEL_COLOR_STRENGTH;

    (
        (luminance + (r - 0.5) * 2.0 * amount).clamp(-1.0, 1.0),
        (luminance + (g - 0.5) * 2.0 * amount).clamp(-1.0, 1.0),
        (luminance + (b - 0.5) * 2.0 * amount).clamp(-1.0, 1.0),
    )
}

fn hsl_to_rgb_unit(hue_degrees: f64, saturation: f64, lightness: f64) -> (f64, f64, f64) {
    if saturation.abs() <= f64::EPSILON {
        return (lightness, lightness, lightness);
    }

    let hue = hue_degrees / 360.0;
    let q = if lightness < 0.5 {
        lightness * (1.0 + saturation)
    } else {
        lightness + saturation - lightness * saturation
    };
    let p = 2.0 * lightness - q;

    (
        hue_to_rgb_unit(p, q, hue + 1.0 / 3.0),
        hue_to_rgb_unit(p, q, hue),
        hue_to_rgb_unit(p, q, hue - 1.0 / 3.0),
    )
}

fn hue_to_rgb_unit(p: f64, q: f64, t: f64) -> f64 {
    let mut tt = t;
    if tt < 0.0 {
        tt += 1.0;
    }
    if tt > 1.0 {
        tt -= 1.0;
    }
    if tt < 1.0 / 6.0 {
        return p + (q - p) * 6.0 * tt;
    }
    if tt < 1.0 / 2.0 {
        return q;
    }
    if tt < 2.0 / 3.0 {
        return p + (q - p) * (2.0 / 3.0 - tt) * 6.0;
    }
    p
}

fn parse_hex_color(hex: &str) -> Option<(f64, f64, f64)> {
    let clean = hex.trim().trim_start_matches('#');
    let full = if clean.len() == 3 {
        let mut out = String::with_capacity(6);
        for c in clean.chars() {
            out.push(c);
            out.push(c);
        }
        out
    } else {
        clean.to_string()
    };

    if full.len() != 6 || !full.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }

    let r = u8::from_str_radix(&full[0..2], 16).ok()? as f64 / 255.0;
    let g = u8::from_str_radix(&full[2..4], 16).ok()? as f64 / 255.0;
    let b = u8::from_str_radix(&full[4..6], 16).ok()? as f64 / 255.0;
    Some((r, g, b))
}

async fn ffprobe_path_has_audio<R: Runtime>(
    shell: &tauri_plugin_shell::Shell<R>,
    path: &str,
) -> Result<bool, String> {
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
            path,
        ])
        .output()
        .await
        .map_err(|e| format!("ffprobe failed for {}: {}", path, e))?;
    Ok(!String::from_utf8_lossy(&probe_output.stdout)
        .trim()
        .is_empty())
}

async fn ffprobe_format_duration<R: Runtime>(
    shell: &tauri_plugin_shell::Shell<R>,
    path: &str,
) -> Result<Option<f64>, String> {
    let probe_output = shell
        .sidecar("ffprobe")
        .map_err(|e| format!("Failed to get ffprobe sidecar: {}", e))?
        .args(&[
            "-v",
            "quiet",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
            path,
        ])
        .output()
        .await
        .map_err(|e| format!("ffprobe duration failed for {}: {}", path, e))?;
    let s = String::from_utf8_lossy(&probe_output.stdout).trim().to_string();
    if s.is_empty() {
        return Ok(None);
    }
    Ok(s.parse().ok())
}

/// Video filter for intro/outro clips before concat with the main export.
fn intro_outro_video_filter(
    input_index: usize,
    width: i32,
    height: i32,
    fps: i32,
    duration_sec: f64,
    output_label: &str,
) -> String {
    format!(
        "[{idx}:v]setpts=PTS-STARTPTS,scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={fps},trim=duration={dur},setpts=PTS-STARTPTS[{label}]",
        idx = input_index,
        w = width,
        h = height,
        fps = fps,
        dur = duration_sec,
        label = output_label,
    )
}

/// Audio filter for intro/outro clips before concat.
/// Resets non-zero audio start PTS (common in uploaded outros) so sound aligns with video.
fn intro_outro_audio_filter(input_index: usize, duration_sec: f64, output_label: &str) -> String {
    format!(
        "[{idx}:a]asetpts=PTS-STARTPTS,atrim=duration={dur},asetpts=PTS-STARTPTS,aresample=async=1:first_pts=0:48000[{label}]",
        idx = input_index,
        dur = duration_sec,
        label = output_label,
    )
}

fn intro_outro_silent_audio_filter(duration_sec: f64, output_label: &str) -> String {
    format!(
        "anullsrc=r=48000:cl=stereo,atrim=duration={dur},asetpts=PTS-STARTPTS[{label}]",
        dur = duration_sec,
        label = output_label,
    )
}

// -----------------------------------------------------------------------------
// Keyframe evaluation — aligned with client/src/editor/types/keyframes.ts
// Preview uses full easing; export densifies non-linear / hold curves to samples
// then emits piecewise-linear FFmpeg expressions in `t` (seconds within clip).
// -----------------------------------------------------------------------------

fn apply_easing_rust(t: f64, interpolation: &str) -> f64 {
    let t = t.clamp(0.0, 1.0);
    match interpolation {
        "linear" => t,
        "ease-in" => t * t,
        "ease-out" => t * (2.0 - t),
        "ease-in-out" => {
            if t < 0.5 {
                2.0 * t * t
            } else {
                -1.0 + (4.0 - 2.0 * t) * t
            }
        }
        "hold" => 0.0,
        "ease-in-cubic" => t * t * t,
        "ease-out-cubic" => 1.0 - (1.0 - t).powi(3),
        "ease-in-out-cubic" => {
            if t < 0.5 {
                4.0 * t * t * t
            } else {
                1.0 - (-2.0 * t + 2.0).powi(3) / 2.0
            }
        }
        "ease-in-expo" => {
            if t == 0.0 {
                0.0
            } else {
                2f64.powf(10.0 * t - 10.0)
            }
        }
        "ease-out-expo" => {
            if t >= 1.0 {
                1.0
            } else {
                1.0 - 2f64.powf(-10.0 * t)
            }
        }
        "ease-in-back" => {
            let c1 = 1.70158;
            let c3 = c1 + 1.0;
            c3 * t * t * t - c1 * t * t
        }
        "ease-out-back" => {
            let c1 = 1.70158;
            let c3 = c1 + 1.0;
            1.0 + c3 * (t - 1.0).powi(3) + c1 * (t - 1.0).powi(2)
        }
        "ease-out-bounce" => {
            let n1 = 7.5625;
            let d1 = 2.75;
            let mut x = t;
            if x < 1.0 / d1 {
                n1 * x * x
            } else if x < 2.0 / d1 {
                x -= 1.5 / d1;
                n1 * x * x + 0.75
            } else if x < 2.5 / d1 {
                x -= 2.25 / d1;
                n1 * x * x + 0.9375
            } else {
                x -= 2.625 / d1;
                n1 * x * x + 0.984375
            }
        }
        "spring" => {
            let w = 4.71238;
            let decay = 4.0;
            1.0 - (-decay * t).exp() * (w * t).cos()
        }
        _ => t,
    }
}

fn evaluate_keyframe_track_rust(keyframes: &[KeyframePoint], normalized_t: f64, default_value: f64) -> f64 {
    if keyframes.is_empty() {
        return default_value;
    }
    let mut sorted: Vec<KeyframePoint> = keyframes.to_vec();
    sorted.sort_by(|a, b| a.offset.partial_cmp(&b.offset).unwrap());

    if sorted.len() == 1 {
        return sorted[0].value;
    }
    let nt = normalized_t.clamp(0.0, 1.0);
    if nt < sorted[0].offset {
        return default_value;
    }
    let last = &sorted[sorted.len() - 1];
    if nt > last.offset {
        return default_value;
    }

    let mut left = &sorted[0];
    let mut right = &sorted[sorted.len() - 1];
    for i in 0..sorted.len() - 1 {
        if nt >= sorted[i].offset && nt <= sorted[i + 1].offset {
            left = &sorted[i];
            right = &sorted[i + 1];
            break;
        }
    }

    if left.interpolation == "hold" {
        return left.value;
    }

    let range = right.offset - left.offset;
    if range.abs() < 1e-12 {
        return left.value;
    }

    let seg_t = (nt - left.offset) / range;
    let eased_t = apply_easing_rust(seg_t, left.interpolation.as_str());
    left.value + (right.value - left.value) * eased_t
}

fn densify_keyframes_if_needed(keyframes: &[KeyframePoint], duration: f64, default_value: f64) -> Vec<KeyframePoint> {
    if keyframes.is_empty() {
        return vec![];
    }
    let mut sorted: Vec<KeyframePoint> = keyframes.to_vec();
    sorted.sort_by(|a, b| a.offset.partial_cmp(&b.offset).unwrap());

    let needs_sampling = sorted.iter().any(|k| {
        k.interpolation != "linear" && k.interpolation != "hold"
    }) || sorted.iter().any(|k| k.interpolation == "hold");

    if !needs_sampling {
        return sorted;
    }

    let steps = ((duration * 48.0).round() as usize).clamp(32, 256);
    let mut out: Vec<KeyframePoint> = Vec::with_capacity(steps + 1);
    for i in 0..=steps {
        let nt = i as f64 / steps as f64;
        let v = evaluate_keyframe_track_rust(&sorted, nt, default_value);
        out.push(KeyframePoint {
            offset: nt,
            value: v,
            interpolation: "linear".to_string(),
        });
    }
    out
}

/// Piecewise-linear FFmpeg expression in `t` (seconds from clip start after trim).
fn build_keyframe_expression(
    keyframes: &[KeyframePoint],
    duration: f64,
    default_value: f64,
) -> Option<String> {
    let keyframes = densify_keyframes_if_needed(keyframes, duration, default_value);
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
            let dt = t1 - t0;
            if dt.abs() < 0.0001 {
                parts.push((t1, format!("{}", v0)));
            } else {
                let slope = (v1 - v0) / dt;
                parts.push((t1, format!("{}+{}*(t-{})", v0, slope, t0)));
            }
        }
    }

    let mut expr = format!("{}", default_value);
    for (t_end, segment_expr) in parts.iter().rev() {
        expr = format!("if(lt(t\\,{})\\,{}\\,{})", t_end, segment_expr, expr);
    }

    // Constant extrapolation: clip base value before the first keyframe.
    let first = &keyframes[0];
    let t0 = first.offset * duration;
    expr = format!("if(lt(t\\,{})\\,{}\\,{})", t0, default_value, expr);

    Some(expr)
}

fn keyframe_expr_for_prop(
    tracks: Option<&Vec<KeyframeTrack>>,
    property: &str,
    duration: f64,
    default_value: f64,
) -> Option<String> {
    let track = tracks?.iter().find(|t| t.property == property && !t.keyframes.is_empty())?;
    build_keyframe_expression(&track.keyframes, duration, default_value)
}

fn ffmpeg_expr_or_constant(kf_expr: Option<String>, constant: f64) -> String {
    kf_expr.unwrap_or_else(|| format!("{}", constant))
}

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
        if text.is_frame_sequence {
            let first = text.image_path.replace("%05d", "00001");
            if !Path::new(&first).exists() {
                return Err(format!(
                    "Text overlay sequence first frame not found: {}",
                    first
                ));
            }
        } else if !Path::new(&text.image_path).exists() {
            return Err(format!("Text overlay PNG not found: {}", text.image_path));
        }
    }

    for sticker in &config.sticker_overlays {
        if sticker.is_frame_sequence {
            let first = sticker.image_path.replace("%05d", "00001");
            if !Path::new(&first).exists() {
                return Err(format!(
                    "Sticker overlay sequence first frame not found: {}",
                    first
                ));
            }
        } else if !Path::new(&sticker.image_path).exists() {
            return Err(format!(
                "Sticker overlay PNG not found: {}",
                sticker.image_path
            ));
        }
    }

    if let Some(ref pat) = config.scene_frame_pattern {
        let first = pat.replace("%05d", "00001");
        if !Path::new(&first).exists() {
            return Err(format!("Scene export first frame not found: {}", first));
        }
        if let Some(n) = config.scene_frame_count {
            if n > 0 {
                let last = pat.replace("%05d", &format!("{:05}", n));
                if !Path::new(&last).exists() {
                    return Err(format!("Scene export last frame not found: {}", last));
                }
            }
        }
    }

    let scene_extra: usize = if config.scene_frame_pattern.is_some() {
        1
    } else {
        0
    };
    let use_scene_video = scene_extra > 0;
    let scene_input_index = config.video_sources.len();

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

    if let Some(ref pat) = config.scene_frame_pattern {
        args.push("-framerate".to_string());
        args.push(format!("{}", config.fps.max(1)));
        args.push("-i".to_string());
        args.push(pat.clone());
    }

    // Add audio inputs

    for audio in &config.audio_tracks {
        args.push("-i".to_string());

        args.push(audio.file_path.clone());
    }

    // Add text overlay PNG inputs (pre-rendered by frontend canvas)

    for text in &config.text_overlays {
        if text.is_frame_sequence {
            args.push("-framerate".to_string());
            args.push(format!("{}", config.fps.max(1)));
        }
        args.push("-i".to_string());

        args.push(text.image_path.clone());
    }

    // Add sticker overlay PNG inputs (pre-rendered by frontend canvas)

    for sticker in &config.sticker_overlays {
        if sticker.is_frame_sequence {
            args.push("-framerate".to_string());
            args.push(format!("{}", config.fps.max(1)));
        }
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

    // Optional intro / outro clips (branding) — appended as extra inputs after all compositing inputs
    let mut next_input_index = config.video_sources.len()
        + scene_extra
        + config.audio_tracks.len()
        + config.text_overlays.len()
        + config.sticker_overlays.len();
    if let Some(ref wm) = config.branding_watermark {
        if Path::new(&wm.image_path).exists() {
            next_input_index += 1;
        }
    }
    if let Some(ref overlays) = config.branding_overlays {
        for overlay in overlays {
            if Path::new(&overlay.image_path).exists() {
                next_input_index += 1;
            }
        }
    }

    let mut intro_input_idx: Option<usize> = None;
    let mut outro_input_idx: Option<usize> = None;

    if let Some(ref p) = config.intro_path {
        if !p.is_empty() && Path::new(p).exists() {
            args.push("-i".to_string());
            args.push(p.clone());
            intro_input_idx = Some(next_input_index);
            next_input_index += 1;
            println!("[Rust] Intro clip input index {}", intro_input_idx.unwrap());
        }
    }
    if let Some(ref p) = config.outro_path {
        if !p.is_empty() && Path::new(p).exists() {
            args.push("-i".to_string());
            args.push(p.clone());
            outro_input_idx = Some(next_input_index);
            println!("[Rust] Outro clip input index {}", outro_input_idx.unwrap());
        }
    }

    let mut intro_duration_sec = config.intro_duration.unwrap_or(0.0);
    let mut outro_duration_sec = config.outro_duration.unwrap_or(0.0);
    let mut intro_has_audio = false;
    let mut outro_has_audio = false;

    if let Some(ref p) = config.intro_path {
        if !p.is_empty() && Path::new(p).exists() {
            intro_has_audio = ffprobe_path_has_audio(&shell, p).await.unwrap_or(false);
            if intro_duration_sec < 0.05 {
                if let Ok(Some(d)) = ffprobe_format_duration(&shell, p).await {
                    intro_duration_sec = d;
                }
            }
        }
    }
    if let Some(ref p) = config.outro_path {
        if !p.is_empty() && Path::new(p).exists() {
            outro_has_audio = ffprobe_path_has_audio(&shell, p).await.unwrap_or(false);
            if outro_duration_sec < 0.05 {
                if let Ok(Some(d)) = ffprobe_format_duration(&shell, p).await {
                    outro_duration_sec = d;
                }
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

    // Helper: build per-source video transform filters

    fn build_video_transform_filter(
        source: &VideoSource,
        width: i32,
        height: i32,
        transparent_padding: bool,
    ) -> String {
        let mut transform_filters = Vec::new();

        let clip_duration = source.end_time - source.start_time;

        let opacity = source.opacity.unwrap_or(1.0);

        let scale = source.scale.unwrap_or(1.0);

        let pos_x = source.position_x.unwrap_or(0.0);

        let pos_y = source.position_y.unwrap_or(0.0);

        let rotation = source.rotation.unwrap_or(0.0);

        let tracks_ref = source.keyframes.as_ref();
        let scale_kf = keyframe_expr_for_prop(tracks_ref, "scale", clip_duration, scale);
        let pos_x_kf = keyframe_expr_for_prop(tracks_ref, "positionX", clip_duration, pos_x);
        let pos_y_kf = keyframe_expr_for_prop(tracks_ref, "positionY", clip_duration, pos_y);
        let rot_kf = keyframe_expr_for_prop(tracks_ref, "rotation", clip_duration, rotation);

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

        let highlights = source.highlights.unwrap_or(0.0);

        let shadows = source.shadows.unwrap_or(0.0);

        let exposure = source.exposure.unwrap_or(0.0);

        let fade = source.fade.unwrap_or(0.0);

        let tint = source.tint.as_deref().unwrap_or("");

        let sharpness = source.sharpness.unwrap_or(0.0);

        fn normalize_similarity(similarity: f64) -> f64 {
            (similarity / 100.0).clamp(0.0, 1.0) * 0.4
        }

        fn normalize_smoothness(smoothness: f64) -> f64 {
            (smoothness / 100.0).clamp(0.0, 1.0) * 0.2
        }

        fn to_ffmpeg_color(hex: &str) -> Option<String> {
            let clean = hex.trim().trim_start_matches('#');
            let full = if clean.len() == 3 {
                let mut out = String::with_capacity(6);
                for c in clean.chars() {
                    out.push(c);
                    out.push(c);
                }
                out
            } else {
                clean.to_string()
            };
            if full.len() != 6 || !full.chars().all(|c| c.is_ascii_hexdigit()) {
                return None;
            }
            Some(format!("0x{}", full))
        }

        // Speed via setpts (video only, audio handled separately).
        // If speed keyframes exist, use a piecewise speed expression.
        let speed_kf = source.keyframes.as_ref().and_then(|tracks| {
            tracks
                .iter()
                .find(|t| t.property == "speed" && !t.keyframes.is_empty())
        });

        if let Some(kf_track) = speed_kf {
            if let Some(speed_expr) = build_keyframe_expression(&kf_track.keyframes, clip_duration, speed) {
                // Approximate variable speed by applying reciprocal instantaneous speed.
                // (A full integral mapping can be added later for exact parity.)
                transform_filters.push(format!("setpts='(1/({}))*PTS'", speed_expr));
            } else if (speed - 1.0).abs() > 0.001 {
                transform_filters.push(format!("setpts={}*PTS", 1.0 / speed));
            }
        } else if (speed - 1.0).abs() > 0.001 {
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

        // Chroma key (preview/export parity): optional spill pass (same YCbCr proximity as preview),
        // then FFmpeg chromakey with normalized similarity/smoothness.
        if let Some(chromakey) = &source.chromakey {
            if chromakey.enabled {
                if let Some(key_color) = to_ffmpeg_color(&chromakey.color) {
                    let similarity = normalize_similarity(chromakey.similarity);
                    let smoothness = normalize_smoothness(chromakey.smoothness);

                    if let Some((kr, kg, kb)) = parse_hex_rgb01(&chromakey.color) {
                        if let Some(spill_geq) = build_chromakey_spill_geq(chromakey, kr, kg, kb) {
                            transform_filters.push("format=rgb24".to_string());
                            transform_filters.push(spill_geq);
                        }
                    }

                    transform_filters.push(format!(
                        "chromakey={}:{}:{}",
                        key_color,
                        similarity.max(0.001),
                        smoothness.max(0.001)
                    ));
                }
            }
        }

        // Scale to fit canvas (contain-fit) preserving aspect ratio, then pad to exact canvas size

        // This produces letterboxing/pillarboxing when video AR differs from canvas AR

        // CRITICAL: pad must use canvas dimensions (width x height) to ensure concat gets uniform inputs

        let cw = width as f64;
        let ch = height as f64;
        let needs_zoom = scale_kf.is_some() || (scale - 1.0).abs() > 0.001;
        let pad_color = if transparent_padding { "black@0" } else { "black" };
        let has_position_motion = pos_x_kf.is_some()
            || pos_y_kf.is_some()
            || pos_x.abs() > 0.5
            || pos_y.abs() > 0.5;

        if transparent_padding {
            transform_filters.push("format=rgba".to_string());
        }

        if needs_zoom {
            if let Some(ref s_expr) = scale_kf {
                // Time-varying scale: piecewise/eased curves are densified in build_keyframe_expression.
                let sw_e = format!("2*floor(iround({}*({}))/2)", cw, s_expr);
                let sh_e = format!("2*floor(iround({}*({}))/2)", ch, s_expr);
                transform_filters.push(format!(
                    "scale=w='{}':h='{}':force_original_aspect_ratio=decrease:eval=frame",
                    sw_e, sh_e
                ));
                transform_filters.push(format!(
                    "pad=w='max({}\\,{})':h='max({}\\,{})':x='(ow-iw)/2':y='(oh-ih)/2':color={}:eval=frame",
                    sw_e, cw, sh_e, ch, pad_color
                ));
                if !has_position_motion {
                    transform_filters.push(format!(
                        "crop={}:{}:(iw-{})/2:(ih-{})/2:eval=frame",
                        width, height, width, height
                    ));
                }
            } else {
                // Static scale ≠ 1
                let sw = (((width as f64 * scale) as i32) / 2) * 2; // ensure even
                let sh = (((height as f64 * scale) as i32) / 2) * 2;

                transform_filters.push(format!(
                    "scale={}:{}:force_original_aspect_ratio=decrease",
                    sw, sh
                ));

                let pad_w = sw.max(width);
                let pad_h = sh.max(height);
                transform_filters.push(format!(
                    "pad={}:{}:(ow-iw)/2:(oh-ih)/2:{}",
                    pad_w, pad_h, pad_color
                ));

                if (pad_w != width || pad_h != height) && !has_position_motion {
                    transform_filters.push(format!(
                        "crop={}:{}:(iw-{})/2:(ih-{})/2",
                        width, height, width, height
                    ));
                }
            }
        } else {
            transform_filters.push(format!(
                "scale={}:{}:force_original_aspect_ratio=decrease",
                width, height
            ));

            transform_filters.push(format!(
                "pad={}:{}:(ow-iw)/2:(oh-ih)/2:{}",
                width, height, pad_color
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

        if let Some(ref r_expr) = rot_kf {
            let angle = format!("PI/180*({})", r_expr);
            transform_filters.push(format!(
                "rotate='{}':ow='rotw({})':oh='roth({})':fillcolor=none:eval=frame",
                angle, angle, angle
            ));
        } else if rotation.abs() > 0.01 {
            let radians = rotation * std::f64::consts::PI / 180.0;

            transform_filters.push(format!(
                "rotate={}:ow=rotw({}):oh=roth({}):fillcolor=none",
                radians, radians, radians
            ));
        }

        // Position offset via pad+crop

        if has_position_motion {
            let pad_w = width * 3;

            let pad_h = height * 3;

            if pos_x_kf.is_some() || pos_y_kf.is_some() {
                let px_e = ffmpeg_expr_or_constant(pos_x_kf, pos_x);
                let py_e = ffmpeg_expr_or_constant(pos_y_kf, pos_y);
                transform_filters.push(format!(
                    "pad=w='max(iw\\,{})':h='max(ih\\,{})':x='(ow-iw)/2':y='(oh-ih)/2':color={}:eval=frame",
                    pad_w, pad_h, pad_color
                ));
                transform_filters.push(format!(
                    "crop={}:{}:'(iw-{})/2-({})':'(ih-{})/2-({})':eval=frame",
                    width, height, width, px_e, height, py_e
                ));
            } else {
                transform_filters.push(format!(
                    "pad=w='max(iw\\,{})':h='max(ih\\,{})':x='(ow-iw)/2':y='(oh-ih)/2':color={}:eval=frame",
                    pad_w, pad_h, pad_color
                ));

                transform_filters.push(format!(
                    "crop={}:{}:'(iw-{})/2-({})':'(ih-{})/2-({})'",
                    width, height, width, pos_x, height, pos_y
                ));
            }
        }

        // Match preview's canvas CSS filters: brightness/exposure are multiplicative,
        // while FFmpeg `eq=brightness` is additive.
        let brightness_multiplier = (1.0 + brightness / 100.0 + (exposure / 100.0) * 0.5).max(0.0);
        if (brightness_multiplier - 1.0).abs() > 0.005 {
            transform_filters.push(format!(
                "colorchannelmixer=rr={}:gg={}:bb={}",
                brightness_multiplier, brightness_multiplier, brightness_multiplier
            ));
        }

        if contrast.abs() > 0.5 || saturation.abs() > 0.5 {
            let eq_contrast = 1.0 + contrast / 100.0;
            let eq_saturation = 1.0 + saturation / 100.0;

            transform_filters.push(format!(
                "eq=contrast={}:saturation={}",
                eq_contrast, eq_saturation
            ));
        }

        // Temperature approximated via hue-rotate (colorbalance)

        if temperature.abs() > 0.5 {
            // Warm = more red/yellow, cool = more blue

            // Using colortemperature filter if available, otherwise hue shift

            let hue_shift = temperature * 0.3;

            transform_filters.push(format!("hue=h={}", hue_shift));
        }

        if let Some(highlight_shadow_filter) = build_highlight_shadow_filter(highlights, shadows) {
            transform_filters.push(highlight_shadow_filter);
        }

        if fade > 0.5 {
            transform_filters.push(format!("eq=brightness={}", (fade / 100.0) * 0.15));
        }

        if let Some((r, g, b)) = parse_hex_color(tint) {
            let mix = 0.25;
            transform_filters.push(format!(
                "colorchannelmixer=rr={}:rg={}:rb={}:gr={}:gg={}:gb={}:br={}:bg={}:bb={}",
                1.0 - mix + r * mix,
                g * mix,
                b * mix,
                r * mix,
                1.0 - mix + g * mix,
                b * mix,
                r * mix,
                g * mix,
                1.0 - mix + b * mix
            ));
        }

        if sharpness > 0.5 {
            transform_filters.push(format!("unsharp=5:5:{}", (sharpness / 100.0) * 1.5));
        }

        // Opacity via colorchannelmixer — with keyframe support (single path; no duplicate geq)
        let opacity_kf = source.keyframes.as_ref().and_then(|tracks| {
            tracks
                .iter()
                .find(|t| t.property == "opacity" && !t.keyframes.is_empty())
        });

        if let Some(kf_track) = opacity_kf {
            // Build piecewise-linear opacity expression from keyframes
            let expr = build_keyframe_expression(&kf_track.keyframes, clip_duration, opacity);
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
            let fade_start = (clip_duration - fade_out).max(0.0);
            transform_filters.push(format!("fade=t=out:st={}:d={}", fade_start, fade_out));
        }

        // Color curves via FFmpeg 'curves' filter
        let has_curves = source.color_curves_master.as_ref().map_or(false, |v| v.len() >= 2)
            || source.color_curves_red.as_ref().map_or(false, |v| v.len() >= 2)
            || source.color_curves_green.as_ref().map_or(false, |v| v.len() >= 2)
            || source.color_curves_blue.as_ref().map_or(false, |v| v.len() >= 2);
        if has_curves {
            let mut curve_parts = Vec::new();
            if let Some(pts) = &source.color_curves_master {
                if pts.len() >= 2 {
                    let s = format_curve_points(pts);
                    curve_parts.push(format!("master='{}'", s));
                }
            }
            if let Some(pts) = &source.color_curves_red {
                if pts.len() >= 2 {
                    let s = format_curve_points(pts);
                    curve_parts.push(format!("r='{}'", s));
                }
            }
            if let Some(pts) = &source.color_curves_green {
                if pts.len() >= 2 {
                    let s = format_curve_points(pts);
                    curve_parts.push(format!("g='{}'", s));
                }
            }
            if let Some(pts) = &source.color_curves_blue {
                if pts.len() >= 2 {
                    let s = format_curve_points(pts);
                    curve_parts.push(format!("b='{}'", s));
                }
            }
            if !curve_parts.is_empty() {
                transform_filters.push(format!("curves={}", curve_parts.join(":")));
            }
        }

        // Color wheels via FFmpeg 'colorbalance' filter.
        // Shadows=rs/gs/bs, Midtones=rm/gm/bm, Highlights=rh/gh/bh (each -1..1).
        let has_wheels = source.color_wheels_shadows_saturation.is_some()
            || source.color_wheels_midtones_saturation.is_some()
            || source.color_wheels_highlights_saturation.is_some()
            || source.color_wheels_shadows_luminance.is_some()
            || source.color_wheels_midtones_luminance.is_some()
            || source.color_wheels_highlights_luminance.is_some();
        if has_wheels {
            let (rs, gs, bs) = color_wheel_balance(
                source.color_wheels_shadows_hue.unwrap_or(0.0),
                source.color_wheels_shadows_saturation.unwrap_or(0.0),
                source.color_wheels_shadows_luminance.unwrap_or(0.0),
            );
            let (rm, gm, bm) = color_wheel_balance(
                source.color_wheels_midtones_hue.unwrap_or(0.0),
                source.color_wheels_midtones_saturation.unwrap_or(0.0),
                source.color_wheels_midtones_luminance.unwrap_or(0.0),
            );
            let (rh, gh, bh) = color_wheel_balance(
                source.color_wheels_highlights_hue.unwrap_or(0.0),
                source.color_wheels_highlights_saturation.unwrap_or(0.0),
                source.color_wheels_highlights_luminance.unwrap_or(0.0),
            );

            transform_filters.push(format!(
                "colorbalance=rs={}:gs={}:bs={}:rm={}:gm={}:bm={}:rh={}:gh={}:bh={}",
                rs, gs, bs, rm, gm, bm, rh, gh, bh
            ));
        }

        // LUT via 'lut3d' filter
        if let Some(ref lut) = source.lut_path {
            if !lut.is_empty() {
                // Escape the path for FFmpeg filter syntax
                let escaped = lut.replace('\\', "/").replace(':', "\\:");
                transform_filters.push(format!("lut3d=file='{}'", escaped));
            }
        }

        // Animation in/out fade (matches preview canvas fade behaviour)
        if let Some(ref anim_in) = source.animation_in {
            if anim_in.anim_type == "fade" && anim_in.duration > 0.01 {
                transform_filters.push(format!(
                    "fade=t=in:st=0:d={}:alpha=1",
                    anim_in.duration
                ));
            }
        }
        if let Some(ref anim_out) = source.animation_out {
            if anim_out.anim_type == "fade" && anim_out.duration > 0.01 {
                let fade_start = (clip_duration - anim_out.duration).max(0.0);
                transform_filters.push(format!(
                    "fade=t=out:st={}:d={}:alpha=1",
                    fade_start, anim_out.duration
                ));
            }
        }

        // Shape masks: apply alpha mask using geq filter
        // Each mask modifies the alpha channel to reveal (or punch out) a shape.
        if let Some(ref masks) = source.masks {
            for mask in masks {
                let mask_filter = build_mask_filter(mask, width, height);
                if !mask_filter.is_empty() {
                    transform_filters.push(mask_filter);
                }
            }
        }

        transform_filters.join(",")
    }

    fn build_mask_filter(mask: &MaskShape, canvas_w: i32, canvas_h: i32) -> String {
        let w = canvas_w as f64;
        let h = canvas_h as f64;

        // Polygon masks: even–odd rule in canvas space (points are normalised 0–1).
        if mask.mask_type == "polygon" {
            if let Some(pts) = &mask.points {
                if pts.len() >= 3 && pts.len() <= 32 {
                    let mut terms: Vec<String> = Vec::new();
                    for i in 0..pts.len() {
                        let j = (i + 1) % pts.len();
                        let xi = pts[i].x * w;
                        let yi = pts[i].y * h;
                        let xj = pts[j].x * w;
                        let yj = pts[j].y * h;
                        let dy = yj - yi;
                        if dy.abs() < 1e-4 {
                            continue;
                        }
                        let term = format!(
                            "if(and(lt((Y-{yi})*(Y-{yj})\\,0)\\,lt(X\\,(({xj}-{xi})*(Y-{yi})/({dy})+{xi})))\\,1\\,0)",
                            xi = xi,
                            yi = yi,
                            xj = xj,
                            yj = yj,
                            dy = dy
                        );
                        terms.push(term);
                    }
                    if terms.is_empty() {
                        return String::new();
                    }
                    let sum = terms.join("+");
                    let inside_expr = format!(
                        "255*if(gt(mod({sum}\\,2)\\,0.5)\\,1\\,0)",
                        sum = sum
                    );
                    let alpha_expr = if mask.invert {
                        format!("255-({})", inside_expr)
                    } else {
                        inside_expr
                    };
                    return format!(
                        "geq=r='r(X\\,Y)':g='g(X\\,Y)':b='b(X\\,Y)':a='min(alpha(X\\,Y)\\,{})'",
                        alpha_expr
                    );
                }
            }
            return String::new();
        }

        let cx = mask.x * w;
        let cy = mask.y * h;
        let hw = mask.width * w / 2.0;
        let hh = mask.height * h / 2.0;
        let feather = mask.feather.max(0.0);
        let rot_rad = mask.rotation * std::f64::consts::PI / 180.0;
        let cos_r = rot_rad.cos();
        let sin_r = rot_rad.sin();

        let lx = format!("((X-{cx})*{cos_r}-(Y-{cy})*{sin_r})", cx=cx, cy=cy, cos_r=cos_r, sin_r=sin_r);
        let ly = format!("((X-{cx})*{sin_r}+(Y-{cy})*{cos_r})", cx=cx, cy=cy, sin_r=sin_r, cos_r=cos_r);

        let inside_expr = if mask.mask_type == "ellipse" {
            if feather > 0.0 {
                let avg_r = (hw + hh) / 2.0;
                format!(
                    "max(0\\,min(255\\,(1-sqrt(pow({lx}/{hw}\\,2)+pow({ly}/{hh}\\,2)))*{scale}))",
                    lx = lx,
                    ly = ly,
                    hw = hw,
                    hh = hh,
                    scale = avg_r / feather.max(1.0) * 255.0
                )
            } else {
                format!(
                    "255*lte(pow({lx}/{hw}\\,2)+pow({ly}/{hh}\\,2)\\,1)",
                    lx = lx,
                    ly = ly,
                    hw = hw,
                    hh = hh
                )
            }
        } else if mask.corner_radius.unwrap_or(0.0) > 0.001 {
            // Rounded rectangle (rotated) via SDF
            let cr = mask.corner_radius.unwrap_or(0.0).clamp(0.0, 1.0);
            let r = cr * hw.min(hh);
            let qx = format!("max(abs({lx})-({hw}-{r})\\,0)", lx = lx, hw = hw, r = r);
            let qy = format!("max(abs({ly})-({hh}-{r})\\,0)", ly = ly, hh = hh, r = r);
            let d = format!("sqrt(pow({qx}\\,2)+pow({qy}\\,2))-{r}", qx = qx, qy = qy, r = r);
            if feather > 0.0 {
                let f = feather.max(1.0);
                format!(
                    "255*if(lte({d}\\,0)\\,1\\,max(0\\,min(1\\,1-{d}/{f})))",
                    d = d,
                    f = f
                )
            } else {
                format!("255*lte({d}\\,0)", d = d)
            }
        } else if feather > 0.0 {
            format!(
                "255*min(min(max(0\\,({lx}+{hw})/{feather})\\,max(0\\,({hw}-{lx})/{feather}))\\,min(max(0\\,({ly}+{hh})/{feather})\\,max(0\\,({hh}-{ly})/{feather})))",
                lx = lx,
                ly = ly,
                hw = hw,
                hh = hh,
                feather = feather.max(1.0)
            )
        } else {
            format!(
                "255*between({lx}\\,-{hw}\\,{hw})*between({ly}\\,-{hh}\\,{hh})",
                lx = lx,
                ly = ly,
                hw = hw,
                hh = hh
            )
        };

        let alpha_expr = if mask.invert {
            format!("255-({inside_expr})", inside_expr = inside_expr)
        } else {
            inside_expr
        };

        format!(
            "geq=r='r(X\\,Y)':g='g(X\\,Y)':b='b(X\\,Y)':a='min(alpha(X\\,Y)\\,{})'",
            alpha_expr
        )
    }

    /// Format curve control points as FFmpeg 'curves' point string: "x0/y0 x1/y1 ..."
    fn format_curve_points(pts: &[[f64; 2]]) -> String {
        pts.iter()
            .map(|p| format!("{}/{}", p[0].clamp(0.0, 1.0), p[1].clamp(0.0, 1.0)))
            .collect::<Vec<_>>()
            .join(" ")
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

                "noise" => {
                    let amt = (effect.intensity / 100.0 * 45.0).round().max(1.0) as i32;

                    effect_filters.push(format!("noise=alls={}:allf=t", amt));
                }

                "posterize" => {
                    let levels = get_f64("levels", 6.0).clamp(2.0, 255.0) as i32;

                    effect_filters.push(format!("posterize={}", levels));
                }

                "scanlines" => {
                    let spacing = get_f64("spacing", 4.0).clamp(2.0, 32.0).round() as i32;

                    let dim = (get_f64("opacity", 40.0) / 100.0).clamp(0.1, 0.95);

                    let stripe = 1.0 - dim * 0.85;

                    effect_filters.push(format!(
                        "geq=lum='lum(X\\,Y)*if(eq(mod(Y\\,{sp})\\,0)\\,{stripe}\\,1)'",
                        sp = spacing,
                        stripe = stripe
                    ));
                }

                "letterbox" => {
                    let bar_pct = (get_f64("barSize", 12.0) / 100.0).clamp(0.02, 0.45);
                    let color = effect
                        .params
                        .get("color")
                        .and_then(|v| v.as_str())
                        .unwrap_or("#000000")
                        .replace('#', "0x");

                    effect_filters.push(format!(
                        "drawbox=x=0:y=0:w=iw:h=floor(ih*{bp}):color={color}:t=fill,drawbox=x=0:y=ih-floor(ih*{bp}):w=iw:h=floor(ih*{bp}):color={color}:t=fill",
                        bp = bar_pct,
                        color = color
                    ));
                }

                "rgbSplit" => {
                    let amount = get_f64("amount", 8.0);

                    let angle = get_f64("angle", 0.0) * std::f64::consts::PI / 180.0;

                    let rh = (amount * angle.cos()).round() as i32;

                    let rv = (amount * angle.sin()).round() as i32;

                    effect_filters.push(format!(
                        "rgbashift=rh={}:rv={}:bh={}:bv={}",
                        rh,
                        rv,
                        -rh,
                        -rv
                    ));
                }

                other => {
                    panic!(
                        "[export] Unsupported video effect {:?}; hidden/removed presets must not reach export",
                        other
                    );
                }
            }
        }

        effect_filters.join(",")
    }

    fn map_transition_type(editor_type: &str) -> &'static str {
        match editor_type {
            "crossfade" => "fade",
            "dissolve" => "dissolve",
            "fadeToBlack" => "fadeblack",
            "fadeToWhite" => "fadewhite",
            "fadegrays" => "fadegrays",
            "fadefast" => "fadefast",
            "fadeslow" => "fadeslow",

            "wipeLeft" => "wipeleft",
            "wipeRight" => "wiperight",
            "wipeUp" => "wipeup",
            "wipeDown" => "wipedown",

            "slideLeft" => "slideleft",
            "slideRight" => "slideright",
            "slideUp" => "slideup",
            "slideDown" => "slidedown",

            "pushLeft" => "slideleft",
            "pushRight" => "slideright",
            "pushUp" => "slideup",
            "pushDown" => "slidedown",

            "coverLeft" => "slideright",
            "coverRight" => "slideleft",
            "revealLeft" => "slideleft",
            "revealRight" => "slideright",

            "circleWipe" => "circleopen",
            "clockWipe" => "radial",
            "zoomIn" => "zoomin",

            "diagTl" => "diagtl",
            "diagTr" => "diagtr",
            "diagBl" => "diagbl",
            "diagBr" => "diagbr",

            "wipeTl" => "wipetl",
            "wipeTr" => "wipetr",
            "wipeBl" => "wipebl",
            "wipeBr" => "wipebr",

            "squeezeH" => "squeezeh",
            "squeezeV" => "squeezev",

            "hlSlice" => "hlslice",
            "hrSlice" => "hrslice",
            "vuSlice" => "vuslice",
            "vdSlice" => "vdslice",

            "circleClose" => "circleclose",
            "horzOpen" => "horzopen",
            "horzClose" => "horzclose",
            "vertOpen" => "vertopen",
            "vertClose" => "vertclose",

            "hblurTransition" => "hblur",

            // Legacy project types (no longer in UI) — degrade to a safe crossfade
            "zoomOut" | "blur" | "rotateIn" | "flipHorizontal" | "flipVertical" | "glitch" => {
                eprintln!(
                    "[export] Deprecated transition {:?} mapped to fade",
                    editor_type
                );
                "fade"
            }

            _ => {
                panic!(
                    "[export] Unknown transition {:?}; add it to map_transition_type before exposing it",
                    editor_type
                );
            }
        }
    }

    fn diamond_wipe_expr(duration: f64, fps: i32) -> String {
        let transition_frames = (duration.max(0.0) * (fps.max(1) as f64)).ceil().max(2.0);
        let completion_floor = (2.0 / transition_frames).min(0.5);
        let u = format!("((1-P)/(1-{completion_floor:.12}))");
        let reveal = format!(
            "if(lte({u},0.5),sqrt({u}*2),2-sqrt((1-{u})*2))",
            u = u
        );
        format!(
            "if(gte(P,1),A,if(lte(P,{completion_floor:.12}),B,if(lte(abs((X-W/2)/(W/2))+abs((Y-H/2)/(H/2)),{reveal}),B,A)))",
            completion_floor = completion_floor,
            reveal = reveal
        )
    }

    fn custom_transition_expr(editor_type: &str, duration: f64, fps: i32) -> Option<String> {
        match editor_type {
            "diamondWipe" => Some(diamond_wipe_expr(duration, fps)),
            "prismSweep" => Some(
                "if(eq(PLANE\\,3)\\,A*(1-min(max(((P*1.45-0.18)-(X/W*0.78+Y/H*0.28)+0.04)/0.08\\,0)\\,1))+B*min(max(((P*1.45-0.18)-(X/W*0.78+Y/H*0.28)+0.04)/0.08\\,0)\\,1)\\,min(255\\,A*(1-min(max(((P*1.45-0.18)-(X/W*0.78+Y/H*0.28)+0.04)/0.08\\,0)\\,1))+B*min(max(((P*1.45-0.18)-(X/W*0.78+Y/H*0.28)+0.04)/0.08\\,0)\\,1)+60*max(0\\,1-abs((X/W*0.78+Y/H*0.28)-P)/0.045)*sin(PI*P)))"
                    .to_string(),
            ),
            "glitchBlocks" => Some(
                "A*(1-if(eq(mod(floor(Y/(H/12))\\,2)\\,0)\\,if(lt(X/W\\,min(1\\,max(0\\,P*1.35-(mod(floor(Y/(H/12))*37\\,11)/11)*0.35)))\\,1\\,0)\\,if(gt(X/W\\,1-min(1\\,max(0\\,P*1.35-(mod(floor(Y/(H/12))*37\\,11)/11)*0.35)))\\,1\\,0)))+B*if(eq(mod(floor(Y/(H/12))\\,2)\\,0)\\,if(lt(X/W\\,min(1\\,max(0\\,P*1.35-(mod(floor(Y/(H/12))*37\\,11)/11)*0.35)))\\,1\\,0)\\,if(gt(X/W\\,1-min(1\\,max(0\\,P*1.35-(mod(floor(Y/(H/12))*37\\,11)/11)*0.35)))\\,1\\,0))"
                    .to_string(),
            ),
            "shutterFlash" => Some(
                "if(eq(PLANE\\,3)\\,if(eq(mod(floor(X/(W/10))\\,2)\\,0)\\,if(lt(Y/H\\,min(1\\,max(0\\,P*1.22)))\\,B\\,A)\\,if(gt(Y/H\\,1-min(1\\,max(0\\,P*1.22-0.22)))\\,B\\,A))\\,min(255\\,if(eq(mod(floor(X/(W/10))\\,2)\\,0)\\,if(lt(Y/H\\,min(1\\,max(0\\,P*1.22)))\\,B\\,A)\\,if(gt(Y/H\\,1-min(1\\,max(0\\,P*1.22-0.22)))\\,B\\,A))+90*max(0\\,1-abs(P-0.5)/0.12)))"
                    .to_string(),
            ),
            "inkBloom" => Some(
                "if(lt(sqrt(pow((X/W)-0.5\\,2)+pow((Y/H)-0.5\\,2))\\,max(0\\,P*0.92-0.04)+0.035*sin(24*((X/W)-0.5)+9*P)+0.025*sin(28*((Y/H)-0.5)-7*P))\\,B\\,A)"
                    .to_string(),
            ),
            _ => None,
        }
    }

    // Process video sources - concat if multiple, trim to timeline positions

    const EXPORT_OVERLAP_EPSILON_SEC: f64 = 0.001;
    const TRANSITION_TIME_SLACK: f64 = 1.0 / 30.0;

    let video_sources_overlap = if config.video_sources.len() > 1 {
        let s = &config.video_sources;
        (0..s.len()).any(|i| {
            (i + 1..s.len())
                .any(|j| {
                    s[i].start_time < s[j].end_time - EXPORT_OVERLAP_EPSILON_SEC
                        && s[j].start_time < s[i].end_time - EXPORT_OVERLAP_EPSILON_SEC
                })
        })
    } else {
        false
    };

    if config.video_sources.is_empty() {
        if use_scene_video {
            push_scene_video_filter_chain(
                &mut filters,
                scene_input_index,
                config.fps,
                config.width,
                config.height,
                config.total_duration,
                needs_black_padding,
                black_padding_duration,
            );
            filters.push(format!(
                "anullsrc=r=48000:cl=stereo,atrim=duration={}[va]",
                config.total_duration
            ));
        } else {
            // No video sources — generate black video and silent audio for the full duration

            filters.push(format!(
                "color=c=black:s={}x{}:d={},format=yuv420p[v]",
                config.width, config.height, config.total_duration
            ));

            filters.push(format!(
                "anullsrc=r=48000:cl=stereo,atrim=duration={}[va]",
                config.total_duration
            ));
        }
    } else if config.video_sources.len() == 1 {
        let source = &config.video_sources[0];

        let trim_start = source.trim_start.unwrap_or(0.0);

        let duration = source.end_time - source.start_time;

        if !use_scene_video {
            let transform = build_video_transform_filter(source, config.width, config.height, false);

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
        } else {
            push_scene_video_filter_chain(
                &mut filters,
                scene_input_index,
                config.fps,
                config.width,
                config.height,
                config.total_duration,
                needs_black_padding,
                black_padding_duration,
            );
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

        // Pan/balance filter
        if let Some(pan_val) = source.pan {
            if pan_val.abs() > 0.01 {
                let left = ((1.0 - pan_val) / 2.0).clamp(0.0, 1.0);
                let right = ((1.0 + pan_val) / 2.0).clamp(0.0, 1.0);
                audio_extras.push_str(&format!(",pan=stereo|c0={}*c0|c1={}*c1", left, right));
            }
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
    } else if config.video_sources.len() > 1 && video_sources_overlap {
        // Timeline layers overlap in time: composite bottom → top (main track first, then overlays)
        // using `overlay` for normal blend and `blend` for multiply / screen / etc.
        let w = config.width;
        let h = config.height;
        let td = config.total_duration;
        let source_count = config.video_sources.len();

        let mut perm: Vec<usize> = (0..source_count).collect();
        perm.sort_by(|&ia, &ib| {
            let a = &config.video_sources[ia];
            let b = &config.video_sources[ib];
            let ma = a.track_is_main.unwrap_or(true);
            let mb = b.track_is_main.unwrap_or(true);
            (!ma)
                .cmp(&(!mb))
                .then(
                    a.order_index
                        .unwrap_or(0)
                        .cmp(&b.order_index.unwrap_or(0)),
                )
                .then(
                    a.start_time
                        .partial_cmp(&b.start_time)
                        .unwrap_or(std::cmp::Ordering::Equal),
                )
                .then(ia.cmp(&ib))
        });

        if !use_scene_video {
            filters.push(format!(
                "color=c=black:s={}x{}:d={},format=yuv420p[vlay_base]",
                w, h, td
            ));

            let mut cur_v = "[vlay_base]".to_string();

            for (layer_idx, &orig_i) in perm.iter().enumerate() {
                let source = &config.video_sources[orig_i];
                let trim_start = source.trim_start.unwrap_or(0.0);
                let clip_dur = source.end_time - source.start_time;
                let transparent_layer = !source.track_is_main.unwrap_or(true);
                let transform = build_video_transform_filter(source, w, h, transparent_layer);
                let layer_pad_color = if transparent_layer { "black@0" } else { "black" };
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
                let st = source.start_time;
                let en = source.end_time;
                let pad_end = (td - en).max(0.0);

                let mut vf = format!(
                    "[{}:v]trim=start={}:duration={},setpts=PTS-STARTPTS,{}{}",
                    orig_i, trim_start, clip_dur, transform, effects_suffix
                );
                vf.push_str(&format!(
                    ",tpad=start_mode=add:start_duration={}:stop_mode=add:stop_duration={}:color={}[vlp{}]",
                    st, pad_end, layer_pad_color, orig_i
                ));
                filters.push(vf);

                let mode = source.blend_mode.as_deref().unwrap_or("normal");
                let next_v = if layer_idx + 1 == perm.len() {
                    "[v]".to_string()
                } else {
                    format!("[vlm{}]", layer_idx)
                };

                let comb = if mode == "normal" || mode.is_empty() {
                    format!("{}[vlp{}]overlay=0:0:format=auto{}", cur_v, orig_i, next_v)
                } else {
                    let ffm = map_blend_mode_ffmpeg(mode);
                    format!(
                        "{}[vlp{}]blend=all_mode={}:all_opacity=1{}",
                        cur_v, orig_i, ffm, next_v
                    )
                };
                filters.push(comb);
                cur_v = next_v;
            }
        } else {
            push_scene_video_filter_chain(
                &mut filters,
                scene_input_index,
                config.fps,
                w,
                h,
                config.total_duration,
                needs_black_padding,
                black_padding_duration,
            );
        }

        // Mix embedded audio from each clip on the global timeline
        let mut audio_mix_inputs = String::new();
        for &orig_i in &perm {
            let source = &config.video_sources[orig_i];
            let trim_start = source.trim_start.unwrap_or(0.0);
            let base_duration = source.end_time - source.start_time;
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
                    let expr = build_keyframe_expression(&kf_track.keyframes, base_duration, vol);
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

            if let Some(pan_val) = source.pan {
                if pan_val.abs() > 0.01 {
                    let left = ((1.0 - pan_val) / 2.0).clamp(0.0, 1.0);
                    let right = ((1.0 + pan_val) / 2.0).clamp(0.0, 1.0);
                    audio_extras.push_str(&format!(",pan=stereo|c0={}*c0|c1={}*c1", left, right));
                }
            }

            let delay_ms = (source.start_time * 1000.0).round().max(0.0) as i64;
            let tail_pad = (td - source.end_time).max(0.0);

            let mut chain = if source_has_audio[orig_i] {
                format!(
                    "[{}:a]atrim=start={}:duration={},asetpts=PTS-STARTPTS{}",
                    orig_i, trim_start, base_duration, audio_extras
                )
            } else {
                format!(
                    "anullsrc=r=48000:cl=stereo,atrim=duration={},asetpts=PTS-STARTPTS",
                    base_duration
                )
            };

            if delay_ms > 0 {
                chain.push_str(&format!(",adelay={}|{}:all=1", delay_ms, delay_ms));
            }
            if tail_pad > 0.0001 {
                chain.push_str(&format!(",apad=pad_dur={}", tail_pad));
            }

            chain.push_str(&format!("[vaol{}]", orig_i));
            filters.push(chain);
            audio_mix_inputs.push_str(&format!("[vaol{}]", orig_i));
        }

        filters.push(format!(
            "{}amix=inputs={}:duration=longest:dropout_transition=0[va]",
            audio_mix_inputs, perm.len()
        ));
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
            let gap_after = (
                config.video_sources[incoming_idx].start_time
                    - config.video_sources[outgoing_idx].end_time
            )
            .max(0.0);
            before_ext[incoming_idx] = before_ext[incoming_idx].max(half + TRANSITION_TIME_SLACK);
            after_ext[outgoing_idx] = after_ext[outgoing_idx].max(half + gap_after + TRANSITION_TIME_SLACK);
        }

        let has_transitions = !transitions.is_empty();

        if !use_scene_video {
            for i in 0..source_count {
                let source = &config.video_sources[i];

                let trim_start = source.trim_start.unwrap_or(0.0);
                let duration = source.end_time - source.start_time;
                let transform = build_video_transform_filter(source, config.width, config.height, false);

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

                let before = before_ext[i].min(source.start_time.max(0.0));
                let after = after_ext[i].max(0.0);
                let effective_duration = (duration + before + after).max(0.0);
                let padding_suffix = if after > 0.0001 {
                    format!(
                        ",tpad=stop_mode=clone:stop_duration={:.6},trim=duration={:.6}",
                        after, effective_duration
                    )
                } else {
                    String::new()
                };

                let mut chain = format!(
                    "[{}:v]trim=start={}:duration={},setpts=PTS-STARTPTS{},{}{}",
                    i, trim_start, effective_duration, padding_suffix, transform, effects_suffix
                );

                chain.push_str(&format!(
                    ",fps={},settb=AVTB,setsar=1,format=yuv420p",
                    config.fps
                ));

                chain.push_str(&format!("[v{}]", i));
                filters.push(chain);
            }
        } else {
            push_scene_video_filter_chain(
                &mut filters,
                scene_input_index,
                config.fps,
                config.width,
                config.height,
                config.total_duration,
                needs_black_padding,
                black_padding_duration,
            );
        }

        if !use_scene_video {
            if has_transitions {
            let mut current_stream = "[v0]".to_string();
            // xfade `offset` is measured on the *first* input stream (the accumulated chain).
            // Using global `junction_time` breaks after the first transition and desyncs A/V.
            let segment_video_len = |idx: usize| -> f64 {
                let s = &config.video_sources[idx];
                let d = s.end_time - s.start_time;
                let before = before_ext[idx].min(s.start_time.max(0.0));
                let after = after_ext[idx].max(0.0);
                d + before + after
            };
            let mut cur_v_len = segment_video_len(0);

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
                    let offset = (cur_v_len - t.duration).max(0.0);

                    if let Some(custom_expr) =
                        custom_transition_expr(&t.transition_type, t.duration, config.fps)
                    {
                        filters.push(format!(
                            "{}[v{}]xfade=transition=custom:duration={}:offset={}:expr='{}'{}",
                            current_stream,
                            i,
                            t.duration,
                            offset,
                            custom_expr,
                            output_label
                        ));
                    } else {
                        let ffmpeg_transition = map_transition_type(&t.transition_type);
                        filters.push(format!(
                            "{}[v{}]xfade=transition={}:duration={}:offset={}{}",
                            current_stream, i, ffmpeg_transition, t.duration, offset, output_label
                        ));
                    }
                    cur_v_len = cur_v_len + segment_video_len(i) - t.duration;
                } else {
                    filters.push(format!(
                        "{}[v{}]concat=n=2:v=1:a=0{}",
                        current_stream, i, output_label
                    ));
                    cur_v_len += segment_video_len(i);
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
        }

        // Handle audio from video sources.
        // With transitions: chain per-clip streams with `acrossfade` at each transition (matches
        // sequential `xfade` video). Timeline `adelay` + `amix` summed overlapping program audio
        // (echo) and drifted vs chained video.
        // Without transitions: keep concat behavior.
        if has_transitions {
            let mut audio_mix_inputs = String::new();

            for i in 0..source_count {
                let source = &config.video_sources[i];

                let trim_start = source.trim_start.unwrap_or(0.0);
                let base_duration = source.end_time - source.start_time;
                let is_muted = source.is_muted.unwrap_or(false);
                let vol = source.volume.unwrap_or(1.0);
                let spd = source.speed.unwrap_or(1.0);

                let before = before_ext[i].min(source.start_time.max(0.0));
                let after = after_ext[i].max(0.0);

                let effective_duration = (base_duration + before + after).max(0.0);
                let effective_start = (source.start_time - before).max(0.0);
                let effective_end = source.start_time + base_duration + after;
                let tail_pad = (config.total_duration - effective_end).max(0.0);

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
                        let expr = build_keyframe_expression(&kf_track.keyframes, base_duration, vol);
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

                if let Some(pan_val) = source.pan {
                    if pan_val.abs() > 0.01 {
                        let left = ((1.0 - pan_val) / 2.0).clamp(0.0, 1.0);
                        let right = ((1.0 + pan_val) / 2.0).clamp(0.0, 1.0);
                        audio_extras.push_str(&format!(",pan=stereo|c0={}*c0|c1={}*c1", left, right));
                    }
                }

                let incoming_transition = transitions
                    .iter()
                    .find(|t| t.target_element_index == i && t.duration > 0.0)
                    .map(|t| t.duration)
                    .unwrap_or(0.0);
                let outgoing_transition = transitions
                    .iter()
                    .find(|t| t.target_element_index == i + 1 && t.duration > 0.0)
                    .map(|t| t.duration)
                    .unwrap_or(0.0);

                let delay_ms = (effective_start * 1000.0).round().max(0.0) as i64;
                let mut chain = if source_has_audio[i] {
                    format!(
                        "[{}:a]atrim=start={}:duration={},asetpts=PTS-STARTPTS{}",
                        i, trim_start, effective_duration, audio_extras
                    )
                } else {
                    format!(
                        "anullsrc=r=48000:cl=stereo,atrim=duration={},asetpts=PTS-STARTPTS{}",
                        effective_duration, audio_extras
                    )
                };

                if incoming_transition > 0.0001 {
                    chain.push_str(&format!(",afade=t=in:st=0:d={:.6}", incoming_transition));
                }

                if outgoing_transition > 0.0001 {
                    let fade_start = (effective_duration - outgoing_transition).max(0.0);
                    chain.push_str(&format!(
                        ",afade=t=out:st={:.6}:d={:.6}",
                        fade_start, outgoing_transition
                    ));
                }

                if delay_ms > 0 {
                    chain.push_str(&format!(",adelay={}|{}:all=1", delay_ms, delay_ms));
                }
                if tail_pad > 0.0001 {
                    chain.push_str(&format!(",apad=pad_dur={}", tail_pad));
                }

                chain.push_str(&format!("[va{}]", i));
                filters.push(chain);
                audio_mix_inputs.push_str(&format!("[va{}]", i));
            }

            filters.push(format!(
                "{}amix=inputs={}:duration=longest:dropout_transition=0[va]",
                audio_mix_inputs, source_count
            ));
        } else {
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
    }

    // Process audio tracks - mix with video audio

    if audio_input_count > 0 {
        let mut audio_mix_inputs = vec!["[va]".to_string()];

        for (i, audio) in config.audio_tracks.iter().enumerate() {
            if audio.is_muted {
                continue;
            }

            let audio_index = video_input_count + scene_extra + i;

            let duration = audio.end_time - audio.start_time;

            let speed = audio.speed.unwrap_or(1.0);

            let fade_in = audio.fade_in.unwrap_or(0.0);

            let fade_out = audio.fade_out.unwrap_or(0.0);

            let trim_start = audio.trim_start.unwrap_or(0.0).max(0.0);

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

            // Pan/balance for standalone audio track
            if let Some(pan_val) = audio.pan {
                if pan_val.abs() > 0.01 {
                    let left = ((1.0 - pan_val) / 2.0).clamp(0.0, 1.0);
                    let right = ((1.0 + pan_val) / 2.0).clamp(0.0, 1.0);
                    extras.push_str(&format!(",pan=stereo|c0={}*c0|c1={}*c1", left, right));
                }
            }

            // Trim and reset PTS, then use adelay for timeline positioning

            if audio.start_time > 0.001 {
                let delay_ms = (audio.start_time * 1000.0) as i64;

                filters.push(format!(
                    "[{}:a]atrim=start={}:duration={},asetpts=PTS-STARTPTS{},adelay={}|{}:all=1[a{}]",
                    audio_index, trim_start, duration, extras, delay_ms, delay_ms, i
                ));
            } else {
                filters.push(format!(
                    "[{}:a]atrim=start={}:duration={},asetpts=PTS-STARTPTS{}[a{}]",
                    audio_index, trim_start, duration, extras, i
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

    let existing_input_count = config.video_sources.len() + scene_extra + config.audio_tracks.len();

    let fps_i = config.fps.max(1);
    let fps_tb = format!("N/{}/TB", fps_i);

    for (i, text) in config.text_overlays.iter().enumerate() {
        let input_idx = existing_input_count + i;

        let next_stream = format!("[vt{}]", i);
        let overlay_duration = text.end_time - text.start_time;

        let has_fade_in = text.animation_in.as_ref().map_or(false, |a| {
            a.duration > 0.01 && (a.anim_type == "fadeIn" || a.anim_type == "fade")
        });
        let has_fade_out = text.animation_out.as_ref().map_or(false, |a| {
            a.duration > 0.01 && (a.anim_type == "fadeOut" || a.anim_type == "fade")
        });

        let prep_label = format!("[tp{}]", i);
        if text.is_frame_sequence {
            let mut prep = format!(
                "[{}:v]format=rgba,fps={},setpts=PTS-STARTPTS,trim=duration={}",
                input_idx, fps_i, overlay_duration
            );
            if has_fade_in {
                let d = text.animation_in.as_ref().unwrap().duration;
                prep.push_str(&format!(",fade=t=in:st=0:d={}:alpha=1", d));
            }
            if has_fade_out {
                let d = text.animation_out.as_ref().unwrap().duration;
                let fade_start = (overlay_duration - d).max(0.0);
                prep.push_str(&format!(",fade=t=out:st={}:d={}:alpha=1", fade_start, d));
            }
            prep.push_str(&format!(",setpts=PTS+{}/TB", text.start_time));
            prep.push_str(&prep_label);
            filters.push(prep);
            filters.push(format!(
                "{}{}overlay=0:0:enable='between(t,{},{})'{}",
                video_stream, prep_label, text.start_time, text.end_time, next_stream
            ));
        } else if has_fade_in || has_fade_out {
            let mut fade_filters = format!(
                "[{}:v]format=rgba,loop=loop=-1:size=1,setpts={},trim=duration={}",
                input_idx, fps_tb, overlay_duration
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

        let has_fade_in = sticker.animation_in.as_ref().map_or(false, |a| {
            a.duration > 0.01 && (a.anim_type == "fadeIn" || a.anim_type == "fade")
        });
        let has_fade_out = sticker.animation_out.as_ref().map_or(false, |a| {
            a.duration > 0.01 && (a.anim_type == "fadeOut" || a.anim_type == "fade")
        });

        let prep_label = format!("[sp{}]", i);
        if sticker.is_frame_sequence {
            let mut prep = format!(
                "[{}:v]format=rgba,fps={},setpts=PTS-STARTPTS,trim=duration={}",
                input_idx, fps_i, overlay_duration
            );
            if has_fade_in {
                let d = sticker.animation_in.as_ref().unwrap().duration;
                prep.push_str(&format!(",fade=t=in:st=0:d={}:alpha=1", d));
            }
            if has_fade_out {
                let d = sticker.animation_out.as_ref().unwrap().duration;
                let fade_start = (overlay_duration - d).max(0.0);
                prep.push_str(&format!(",fade=t=out:st={}:d={}:alpha=1", fade_start, d));
            }
            prep.push_str(&format!(",setpts=PTS+{}/TB", sticker.start_time));
            prep.push_str(&prep_label);
            filters.push(prep);
            filters.push(format!(
                "{}{}overlay=0:0:enable='between(t,{},{})'{}",
                video_stream, prep_label, sticker.start_time, sticker.end_time, next_stream
            ));
        } else if has_fade_in || has_fade_out {
            let mut fade_filters = format!(
                "[{}:v]format=rgba,loop=loop=-1:size=1,setpts={},trim=duration={}",
                input_idx, fps_tb, overlay_duration
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

                // Apply rotation if non-zero (requires expand padding to avoid clipping)
                let has_rotation = overlay.rotation.abs() > 0.5;
                let rot_rad = overlay.rotation * std::f64::consts::PI / 180.0;

                if has_rotation {
                    filters.push(format!(
                        "[{}:v]scale={}:-1,format=rgba,colorchannelmixer=aa={},rotate={}:c=0x00000000:ow=rotw({}):oh=roth({})[bol{}]",
                        branding_input_idx, scaled_width, alpha, rot_rad, rot_rad, rot_rad, i
                    ));
                } else {
                    filters.push(format!(
                        "[{}:v]scale={}:-1,format=rgba,colorchannelmixer=aa={}[bol{}]",
                        branding_input_idx, scaled_width, alpha, i
                    ));
                }

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

    // Optional intro + outro: concatenate after the full composite ([vout]/[aout])
    let w = config.width;
    let h = config.height;
    let fps = config.fps.max(1);

    let mut final_video_map = "[vout]".to_string();
    let mut final_audio_map = "[aout]".to_string();
    let mut output_duration_sec = config.total_duration;

    let use_intro = intro_input_idx.is_some() && intro_duration_sec > 0.05;
    let use_outro = outro_input_idx.is_some() && outro_duration_sec > 0.05;

    if intro_input_idx.is_some() && !use_intro {
        println!(
            "[Rust] Intro file present but duration is ~0 — skipping intro concat (set intro_duration or use a valid clip)"
        );
    }
    if outro_input_idx.is_some() && !use_outro {
        println!(
            "[Rust] Outro file present but duration is ~0 — skipping outro concat (set outro_duration or use a valid clip)"
        );
    }

    if use_intro {
        let ii = intro_input_idx.unwrap();
        let d = intro_duration_sec;
        filters.push(intro_outro_video_filter(ii, w, h, fps, d, "ib_v"));
        if intro_has_audio {
            filters.push(intro_outro_audio_filter(ii, d, "ib_a"));
        } else {
            filters.push(intro_outro_silent_audio_filter(d, "ib_a"));
        }
        filters.push(format!(
            "[ib_v][ib_a]{}{}concat=n=2:v=1:a=1[mid_v][mid_a]",
            final_video_map, final_audio_map
        ));
        final_video_map = "[mid_v]".to_string();
        final_audio_map = "[mid_a]".to_string();
        output_duration_sec += d;
        println!(
            "[Rust] Prepended intro ({:.2}s), output duration → {:.2}s",
            d, output_duration_sec
        );
    }

    if use_outro {
        let oi = outro_input_idx.unwrap();
        let d = outro_duration_sec;
        filters.push(intro_outro_video_filter(oi, w, h, fps, d, "ob_v"));
        if outro_has_audio {
            filters.push(intro_outro_audio_filter(oi, d, "ob_a"));
        } else {
            filters.push(intro_outro_silent_audio_filter(d, "ob_a"));
        }
        filters.push(format!(
            "{}{}[ob_v][ob_a]concat=n=2:v=1:a=1[fvout][faout]",
            final_video_map, final_audio_map
        ));
        final_video_map = "[fvout]".to_string();
        final_audio_map = "[faout]".to_string();
        output_duration_sec += d;
        println!(
            "[Rust] Appended outro ({:.2}s), output duration → {:.2}s",
            d, output_duration_sec
        );
    }

    // Add filter_complex argument

    if !filters.is_empty() {
        args.push("-filter_complex".to_string());

        args.push(filters.join(";"));
    }

    // Map output streams

    args.push("-map".to_string());

    args.push(final_video_map);

    if config.include_audio {
        args.push("-map".to_string());

        args.push(final_audio_map);
    }

    append_export_codec_args(
        &mut args,
        &config.export_format,
        &config.export_quality,
        config.include_audio,
    );

    // Audio sync and quality settings

    args.push("-progress".to_string());

    args.push("pipe:2".to_string());

    args.push("-nostats".to_string());

    args.push("-async".to_string());

    args.push("1".to_string());

    args.push("-fps_mode".to_string());

    args.push("cfr".to_string());

    // Set exact duration

    args.push("-t".to_string());

    args.push(output_duration_sec.to_string());

    args.push(config.output_path.clone());

    println!("[Rust] FFmpeg command: ffmpeg {}", args.join(" "));

    // Execute FFmpeg with a cancellation token so the UI can stop long exports.
    let export_cancel_flag = config
        .export_id
        .as_ref()
        .map(|export_id| register_video_editor_export(export_id));

    let export_result = run_ffmpeg_for_video_editor_export(
        &app,
        &args,
        export_cancel_flag.clone(),
        config.export_id.clone(),
        Some(output_duration_sec),
    )
    .await;

    if let Err(err) = export_result {
        if let Some(export_id) = &config.export_id {
            unregister_video_editor_export(export_id);
        }

        if err == FFMPEG_EXPORT_CANCELLED {
            let _ = std::fs::remove_file(&config.output_path);
        }

        println!("[Rust] FFmpeg export failed: {}", err);
        return Err(err);
    }

    // Verify output file was created

    if !Path::new(&config.output_path).exists() {
        if let Some(export_id) = &config.export_id {
            unregister_video_editor_export(export_id);
        }

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

        let cover_args = vec![
            "-y".to_string(),
            "-ss".to_string(),
            cover_ts.to_string(),
            "-i".to_string(),
            config.output_path.clone(),
            "-vframes".to_string(),
            "1".to_string(),
            "-q:v".to_string(),
            "2".to_string(),
            cover_path.clone(),
        ];

        match run_ffmpeg_for_video_editor_export(&app, &cover_args, export_cancel_flag, None, None)
            .await
        {
            Ok(_) => {
                println!("[Rust] Cover image saved: {}", cover_path);
            }
            Err(err) if err == FFMPEG_EXPORT_CANCELLED => {
                if let Some(export_id) = &config.export_id {
                    unregister_video_editor_export(export_id);
                }

                let _ = std::fs::remove_file(&config.output_path);
                let _ = std::fs::remove_file(&cover_path);
                return Err(err);
            }
            Err(err) => {
                println!(
                    "[Rust] Cover image extraction failed (non-fatal): {}",
                    err
                );
            }
        }
    }

    if let Some(export_id) = &config.export_id {
        unregister_video_editor_export(export_id);
    }

    Ok(())
}

fn sanitize_scene_frame_extension(extension: &str) -> &'static str {
    match extension.trim().trim_start_matches('.').to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => "jpg",
        "png" => "png",
        _ => "jpg",
    }
}

/// Write one encoded frame for WYSIWYG scene export (`frame_%05d.{jpg,png}` under a per-session temp dir).
#[tauri::command]
pub async fn write_scene_export_frame(
    session_id: String,
    frame_index_one_based: u32,
    frame_bytes: Vec<u8>,
    extension: Option<String>,
) -> Result<(), String> {
    let safe_id: String = session_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .take(80)
        .collect();

    let dir = std::env::temp_dir()
        .join("clippster_scene_export")
        .join(format!("session_{}", safe_id));

    std::fs::create_dir_all(&dir).map_err(|e| format!("scene export mkdir: {}", e))?;

    let ext = sanitize_scene_frame_extension(extension.as_deref().unwrap_or("jpg"));
    let path = dir.join(format!("frame_{:05}.{}", frame_index_one_based, ext));
    std::fs::write(&path, &frame_bytes).map_err(|e| format!("scene export write: {}", e))?;
    Ok(())
}

/// Returns `(pattern, frame_count)` for FFmpeg `image2` input after all frames were written.
#[tauri::command]
pub fn finalize_scene_export_frames(
    session_id: String,
    extension: Option<String>,
) -> Result<(String, u32), String> {
    let safe_id: String = session_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .take(80)
        .collect();

    let dir = std::env::temp_dir()
        .join("clippster_scene_export")
        .join(format!("session_{}", safe_id));

    if !dir.is_dir() {
        return Err("scene export session dir missing".to_string());
    }

    let ext = sanitize_scene_frame_extension(extension.as_deref().unwrap_or("jpg"));
    let mut count: u32 = 0;
    for entry in std::fs::read_dir(&dir).map_err(|e| format!("read_dir: {}", e))? {
        let e = entry.map_err(|e| e.to_string())?;
        let name = e.file_name().to_string_lossy().to_string();
        if name.starts_with("frame_") && name.ends_with(&format!(".{}", ext)) {
            count += 1;
        }
    }
    if count == 0 {
        return Err("no scene export frames written".to_string());
    }

    let pattern = dir.join(format!("frame_%05d.{}", ext));
    let pattern_str = pattern.to_string_lossy().replace('\\', "/");
    Ok((pattern_str, count))
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

/// Save a numbered PNG sequence for animated overlay export (`image2` + `overlay`).
#[tauri::command]
pub async fn save_overlay_frame_sequence(
    element_id: String,
    frames: Vec<Vec<u8>>,
) -> Result<(String, u32), String> {
    if frames.is_empty() {
        return Err("save_overlay_frame_sequence: empty frames".to_string());
    }

    let safe_id: String = element_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .take(80)
        .collect();

    let dir = std::env::temp_dir()
        .join("clippster_overlay_seq")
        .join(format!("seq_{}", safe_id));

    std::fs::create_dir_all(&dir).map_err(|e| format!("overlay seq mkdir: {}", e))?;

    for (i, bytes) in frames.iter().enumerate() {
        let path = dir.join(format!("frame_{:05}.png", i + 1));
        std::fs::write(&path, bytes).map_err(|e| format!("overlay seq write: {}", e))?;
    }

    let pattern = dir.join("frame_%05d.png");
    let pattern_str = pattern.to_string_lossy().replace('\\', "/");

    println!(
        "[Rust] Saved overlay sequence {} frames → {}",
        frames.len(),
        pattern_str
    );

    Ok((pattern_str, frames.len() as u32))
}

#[cfg(test)]
mod keyframe_tests {
    use super::*;

    fn kf(offset: f64, value: f64) -> KeyframePoint {
        KeyframePoint {
            offset,
            value,
            interpolation: "linear".to_string(),
        }
    }

    #[test]
    fn evaluate_uses_base_outside_keyframe_span() {
        let keyframes = vec![kf(0.25, 1.0), kf(0.75, 1.5)];
        assert!((evaluate_keyframe_track_rust(&keyframes, 0.0, 1.0) - 1.0).abs() < 1e-9);
        assert!((evaluate_keyframe_track_rust(&keyframes, 0.1, 1.0) - 1.0).abs() < 1e-9);
        assert!((evaluate_keyframe_track_rust(&keyframes, 0.5, 1.0) - 1.25).abs() < 1e-9);
        assert!((evaluate_keyframe_track_rust(&keyframes, 0.75, 1.0) - 1.5).abs() < 1e-9);
        assert!((evaluate_keyframe_track_rust(&keyframes, 0.9, 1.0) - 1.0).abs() < 1e-9);
        assert!((evaluate_keyframe_track_rust(&keyframes, 1.0, 1.0) - 1.0).abs() < 1e-9);
    }

    #[test]
    fn evaluate_sorts_unsorted_keyframes() {
        let keyframes = vec![kf(0.75, 1.5), kf(0.25, 1.0)];
        assert!((evaluate_keyframe_track_rust(&keyframes, 0.1, 1.0) - 1.0).abs() < 1e-9);
        assert!((evaluate_keyframe_track_rust(&keyframes, 0.5, 1.0) - 1.25).abs() < 1e-9);
    }

    #[test]
    fn build_expression_uses_base_outside_keyframe_span() {
        let keyframes = vec![kf(0.25, 1.0), kf(0.75, 1.5)];
        let duration = 10.0;
        let expr = build_keyframe_expression(&keyframes, duration, 1.0).expect("expr");
        assert!(expr.contains("if(lt(t\\,2.5)\\,1\\,"), "expected pre-first base in: {}", expr);
        // After last keyframe (t > 7.5) falls through to base value 1
        assert!(expr.ends_with("1") || expr.contains(",1)"), "expected post-last base in: {}", expr);
    }
}
