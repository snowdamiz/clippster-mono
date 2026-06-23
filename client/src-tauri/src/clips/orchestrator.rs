use futures::future::join_all;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tauri_plugin_shell::ShellExt;

use super::audio_effect_renderer::{build_audio_effects_filter_chain, AudioEffectSettings};
use super::effect_renderer::{build_effects_filter_chain, ClipEffectSettings};
use super::font_manager::get_fonts_dir;
use super::subtitle::{
    generate_ass_file, generate_text_overlay_ass_file, merge_text_overlays_into_ass,
};
use super::text_renderer::{partition_overlays, render_text_overlay_to_png};
use super::types::{
    AudioSettings, ClipBuildProgress, ClipBuildResult, ClipWatermarkSettings, FramingStrategy,
    IntroOutroPerRatioConfig, LayoutOverlaySettings, ManualFramingConfig, SegmentFramingConfigs,
    StickerSettings, SubtitleOverlaySettings, SubtitleOverrides, SubtitleSettings,
    TextOverlaySettings, VideoFilterSegment, WatermarkSettings, WhisperSegment, WordInfo,
};
use super::video_info::{get_video_info, parse_aspect_ratio, IntroOutroCache};
use super::video_processor::{
    apply_clip_watermarks_to_video, apply_layout_overlays_to_video,
    apply_rendered_text_overlays_to_video, apply_stickers_to_video,
    apply_subtitle_overlays_to_video, build_clip_with_framing_strategy,
    build_multi_segment_clip_with_framing_strategy, build_multi_segment_clip_with_settings,
    build_single_segment_clip_with_settings, prepare_intro_outro_for_concat,
};
use super::{is_build_cancelled, CancellationToken};

/// Clip text boxes configured per-aspect-ratio in POI only apply to listed ratios.
/// When per_ratio_configs is empty, the overlay applies to every output ratio.
fn text_overlay_applies_for_aspect_ratio(overlay: &TextOverlaySettings, aspect_ratio: &str) -> bool {
    match &overlay.per_ratio_configs {
        Some(configs) if !configs.is_empty() => configs.contains_key(aspect_ratio),
        _ => true,
    }
}

// Helper function to sanitize a clip name for use as a folder name
fn sanitize_clip_name(name: &str) -> String {
    // Replace invalid filesystem characters with underscores
    let invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*', '\''];
    let mut sanitized = name.to_string();

    for ch in invalid_chars {
        sanitized = sanitized.replace(ch, "_");
    }

    // Trim whitespace and dots from start/end (invalid on Windows)
    sanitized = sanitized.trim().trim_matches('.').to_string();

    // Limit length to avoid filesystem issues (keeping it reasonable)
    if sanitized.len() > 100 {
        sanitized.truncate(100);
    }

    // If empty after sanitization, use a default name
    if sanitized.is_empty() {
        sanitized = "clip".to_string();
    }

    sanitized
}

// Helper function to convert clip name to snake_case for filenames
// e.g., "Epic Victory Trash Talk" -> "epic_victory_trash_talk"
fn clip_name_to_snake_case(name: &str) -> String {
    // First, sanitize for filesystem
    let invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*', '.'];
    let mut result = name.to_lowercase();

    for ch in invalid_chars {
        result = result.replace(ch, "");
    }

    // Replace spaces and multiple underscores/hyphens with single underscore
    result = result
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect::<String>();

    // Collapse multiple underscores into one
    while result.contains("__") {
        result = result.replace("__", "_");
    }

    // Trim underscores from start/end
    result = result.trim_matches('_').to_string();

    // Limit length to avoid filesystem issues
    if result.len() > 80 {
        result.truncate(80);
        // Make sure we don't end with an underscore after truncation
        result = result.trim_end_matches('_').to_string();
    }

    // If empty after sanitization, use a default name
    if result.is_empty() {
        result = "clip".to_string();
    }

    result
}

// Helper function to get or create the run folder for a project using database-tracked run numbers
// If run_number is None (manually generated clips), uses a special "manual" folder
fn get_or_create_run_folder(
    project_clips_dir: &std::path::Path,
    run_number: Option<u32>,
) -> Result<std::path::PathBuf, String> {
    let run_folder = if let Some(run_num) = run_number {
        // Use the run number from the detection session
        project_clips_dir.join(format!("run-{}", run_num))
    } else {
        // For manually generated clips without a detection session, use a manual builds folder
        project_clips_dir.join("manual-builds")
    };

    std::fs::create_dir_all(&run_folder)
        .map_err(|e| format!("Failed to create run folder: {}", e))?;

    println!("[Rust] Using run folder: {}", run_folder.display());
    Ok(run_folder)
}

// Helper function to get or create the clip-specific folder within a run
fn get_or_create_clip_folder(
    run_folder: &std::path::Path,
    clip_name: &str,
) -> Result<std::path::PathBuf, String> {
    let sanitized_name = sanitize_clip_name(clip_name);
    let clip_folder = run_folder.join(&sanitized_name);

    std::fs::create_dir_all(&clip_folder)
        .map_err(|e| format!("Failed to create clip folder: {}", e))?;

    println!("[Rust] Using clip folder: {}", clip_folder.display());
    Ok(clip_folder)
}

/// Concatenate multiple video files into one, optionally adding intro/outro
async fn concatenate_videos(
    app: &tauri::AppHandle,
    segment_paths: &[std::path::PathBuf],
    output_path: &std::path::Path,
    intro_path: Option<&str>,
    outro_path: Option<&str>,
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;

    // Create a concat list file
    let concat_list_path = output_path.with_extension("concat.txt");
    let mut concat_content = String::new();

    // Add intro if present
    if let Some(intro) = intro_path {
        concat_content.push_str(&format!("file '{}'\n", intro.replace("\\", "/")));
    }

    // Add all segments
    for segment_path in segment_paths {
        let path_str = segment_path.to_string_lossy().replace("\\", "/");
        concat_content.push_str(&format!("file '{}'\n", path_str));
    }

    // Add outro if present
    if let Some(outro) = outro_path {
        concat_content.push_str(&format!("file '{}'\n", outro.replace("\\", "/")));
    }

    std::fs::write(&concat_list_path, concat_content)
        .map_err(|e| format!("Failed to write concat list: {}", e))?;

    // Run FFmpeg concat
    let output = app
        .shell()
        .sidecar("ffmpeg")
        .unwrap()
        .args([
            "-nostdin",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            &concat_list_path.to_string_lossy(),
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            "-y",
            &output_path.to_string_lossy(),
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg concat failed: {}", stderr));
    }

    // Clean up concat list
    let _ = std::fs::remove_file(&concat_list_path);

    Ok(())
}

/// Apply subtitles to a video file
async fn apply_subtitles_to_video(
    app: &tauri::AppHandle,
    input_path: &std::path::Path,
    output_path: &std::path::Path,
    subtitle_path: &std::path::Path,
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;

    let subtitle_filter = format!(
        "ass={}",
        subtitle_path
            .to_string_lossy()
            .replace("\\", "/")
            .replace(":", "\\\\:")
    );

    let output = app
        .shell()
        .sidecar("ffmpeg")
        .unwrap()
        .args([
            "-nostdin",
            "-i",
            &input_path.to_string_lossy(),
            "-vf",
            &subtitle_filter,
            "-c:a",
            "copy",
            "-y",
            &output_path.to_string_lossy(),
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg subtitle application failed: {}", stderr));
    }

    Ok(())
}

/// Helper function to get framing config for a specific segment
/// Checks segment-specific configs first, then falls back to global config
fn get_framing_for_segment(
    segment: &serde_json::Value,
    aspect_ratio: &str,
    segment_framing_configs: &Option<SegmentFramingConfigs>,
    manual_framing_configs: &Option<std::collections::HashMap<String, ManualFramingConfig>>,
    video_width: u32,
    video_height: u32,
) -> Option<FramingStrategy> {
    // Try to get segment ID from the segment JSON
    let segment_id = segment.get("id").and_then(|v| v.as_str());

    // Check for segment-specific framing config
    if let (Some(seg_id), Some(seg_configs)) = (segment_id, segment_framing_configs) {
        if let Some(configs_for_ratio) = seg_configs.get(aspect_ratio) {
            // Find config that applies to this segment
            for seg_config in configs_for_ratio {
                if seg_config.segment_ids.contains(&seg_id.to_string()) {
                    println!(
                        "[Rust] Using segment-specific framing for segment {} in {}",
                        seg_id, aspect_ratio
                    );
                    return Some(
                        seg_config
                            .config
                            .to_framing_strategy(video_width, video_height),
                    );
                }
            }
        }
    }

    // Fallback to global manual config
    if let Some(configs) = manual_framing_configs {
        if let Some(config) = configs.get(aspect_ratio) {
            println!(
                "[Rust] Using global manual framing config for {}",
                aspect_ratio
            );
            return Some(config.to_framing_strategy(video_width, video_height));
        }
    }

    None
}

// Simplified internal clip building implementation (without progress callbacks)
#[allow(clippy::too_many_arguments)]
pub async fn build_clip_internal_simple(
    app: &tauri::AppHandle,
    project_id: &str,
    clip_id: &str,
    clip_name: &str,
    video_path: &str,
    segments: &[serde_json::Value],
    subtitle_settings: Option<SubtitleSettings>,
    subtitle_overrides: Option<SubtitleOverrides>,
    subtitle_overlays: Option<std::collections::HashMap<String, Vec<SubtitleOverlaySettings>>>,
    transcript_words: Option<Vec<WordInfo>>,
    _transcript_segments: Option<Vec<WhisperSegment>>,
    max_words: Option<usize>,
    aspect_ratios: &[String],
    quality: &str,
    frame_rate: u32,
    output_format: &str,
    run_number: Option<u32>,
    build_number: Option<u32>,
    build_id: Option<String>,
    intro_path: Option<&str>,
    intro_duration: Option<f64>,
    outro_path: Option<&str>,
    outro_duration: Option<f64>,
    intro_outro_per_ratio: Option<&std::collections::HashMap<String, IntroOutroPerRatioConfig>>,
    watermark_settings: Option<WatermarkSettings>,
    audio_settings: Option<AudioSettings>,
    framing_strategy: Option<FramingStrategy>,
    manual_framing_configs: Option<std::collections::HashMap<String, ManualFramingConfig>>,
    segment_framing_configs: Option<SegmentFramingConfigs>,
    video_filter_segments: Option<Vec<VideoFilterSegment>>,
    text_overlays: Option<Vec<TextOverlaySettings>>,
    stickers: Option<Vec<StickerSettings>>,
    clip_watermarks: Option<Vec<ClipWatermarkSettings>>,
    clip_effects: Option<Vec<ClipEffectSettings>>,
    audio_effects: Option<Vec<AudioEffectSettings>>,
    layout_overlays: Option<Vec<LayoutOverlaySettings>>,
    campaign_id: Option<i64>,
    campaign_branding_profile_id: Option<i64>,
    branding_type: Option<String>,
    cancel_rx: CancellationToken,
) -> Result<ClipBuildResult, String> {
    // Helper to check cancellation
    let check_cancelled = || -> Result<(), String> {
        if is_build_cancelled(&cancel_rx) {
            Err("Build cancelled by user".to_string())
        } else {
            Ok(())
        }
    };

    // Check for cancellation at start
    check_cancelled()?;

    // Emit progress
    let _ = app.emit(
        "clip-build-progress",
        ClipBuildProgress {
            clip_id: clip_id.to_string(),
            project_id: project_id.to_string(),
            progress: 0.0,
            stage: "initializing".to_string(),
            message: "Preparing to build clip...".to_string(),
            error: None,
        },
    );

    // Get storage paths
    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    // Create project-specific clips directory in the clips folder
    let project_clips_dir = paths.clips.join(format!("project_{}", project_id));
    std::fs::create_dir_all(&project_clips_dir)
        .map_err(|e| format!("Failed to create project clips directory: {}", e))?;

    // Get or create the run folder for this build using the database-tracked run number
    let run_folder = get_or_create_run_folder(&project_clips_dir, run_number)?;

    // Get or create the clip-specific folder within the run
    let clip_base_dir = get_or_create_clip_folder(&run_folder, clip_name)?;

    // Check for cancellation before getting video info
    check_cancelled()?;

    // Get video dimensions for proper subtitle rendering
    let video_info = get_video_info(app, video_path).await?;
    println!(
        "[Rust] Video dimensions: {}x{}",
        video_info.width, video_info.height
    );

    // Build effects filter chain if effects are provided
    let effects_filter_chain = if let Some(ref effects) = clip_effects {
        if !effects.is_empty() {
            println!(
                "[Rust] Building effects filter chain for {} effects",
                effects.len()
            );
            match build_effects_filter_chain(effects, video_info.width, video_info.height) {
                Ok(filter) => {
                    if let Some(ref f) = filter {
                        println!("[Rust] Effects filter chain: {}", f);
                    }
                    filter
                }
                Err(e) => {
                    println!(
                        "[Rust] Warning: Failed to build effects filter chain: {}",
                        e
                    );
                    None
                }
            }
        } else {
            None
        }
    } else {
        None
    };

    // Build audio effects filter chain if audio effects are provided
    let audio_effects_filter_chain = if let Some(ref effects) = audio_effects {
        if !effects.is_empty() {
            println!(
                "[Rust] Building audio effects filter chain for {} effects",
                effects.len()
            );
            match build_audio_effects_filter_chain(effects) {
                Ok(filter) => {
                    if let Some(ref f) = filter {
                        println!("[Rust] Audio effects filter chain: {}", f);
                    }
                    filter
                }
                Err(e) => {
                    println!(
                        "[Rust] Warning: Failed to build audio effects filter chain: {}",
                        e
                    );
                    None
                }
            }
        } else {
            None
        }
    } else {
        None
    };

    // Check for cancellation before starting builds
    check_cancelled()?;

    // Track all output paths for the result
    let mut all_output_paths = Vec::new();
    let mut first_output_path: Option<String> = None;
    let mut total_file_size: u64 = 0;
    let mut clip_duration: Option<f64> = None;

    // Create intro/outro cache for this build session (thread-safe for parallel builds)
    let intro_outro_cache = Arc::new(Mutex::new(IntroOutroCache::new()));

    // Build clips for all aspect ratios IN PARALLEL for maximum speed
    let total_ratios = aspect_ratios.len();
    println!(
        "[Rust] Building {} aspect ratios in parallel...",
        total_ratios
    );

    // Convert clip name to snake_case for the filename (e.g., "Epic Victory" -> "epic_victory")
    let snake_case_clip_name = clip_name_to_snake_case(clip_name);

    // Get the build number for the filename (default to 1 if not provided)
    let build_num = build_number.unwrap_or(1);

    let build_tasks: Vec<_> = aspect_ratios.iter().enumerate().map(|(ratio_idx, aspect_ratio_str)| {
        let app = app.clone();
        let video_path = video_path.to_string();
        let clip_id = clip_id.to_string();
        let project_id = project_id.to_string();
        let clip_base_dir = clip_base_dir.clone();
        let segments = segments.to_vec();
        let subtitle_settings = subtitle_settings.clone();
        let subtitle_overrides = subtitle_overrides.clone();
        let subtitle_overlays = subtitle_overlays.clone();
        let transcript_words = transcript_words.clone();
        let quality = quality.to_string();
        let output_format = output_format.to_string();
        let intro_path = intro_path.map(|s| s.to_string());
        let outro_path = outro_path.map(|s| s.to_string());
        let video_info = video_info.clone();
        let intro_outro_cache = intro_outro_cache.clone();
        let aspect_ratio_str = aspect_ratio_str.clone();
        let snake_case_name = snake_case_clip_name.clone();
        let watermark_settings = watermark_settings.clone();
        let audio_settings = audio_settings.clone();
        let framing_strategy = framing_strategy.clone();
        let manual_framing_configs = manual_framing_configs.clone();
        let segment_framing_configs = segment_framing_configs.clone();
        let video_filter_segments = video_filter_segments.clone();
        let effects_filter_chain = effects_filter_chain.clone();
        let audio_effects_filter_chain = audio_effects_filter_chain.clone();
        let text_overlays = text_overlays.clone();
        let stickers = stickers.clone();
        let clip_watermarks = clip_watermarks.clone();
        let layout_overlays = layout_overlays.clone();
        let campaign_id = campaign_id;
        let campaign_branding_profile_id = campaign_branding_profile_id;
        let branding_type = branding_type.clone();
        let cancel_rx = cancel_rx.clone();
        async move {
            // Check for cancellation at the start of each task
            if is_build_cancelled(&cancel_rx) {
                return Err::<_, String>("Build cancelled by user".to_string());
            }
            
            println!("[Rust] Building clip for aspect ratio: {}", aspect_ratio_str);
            
            let progress_start = 10.0 + (ratio_idx as f64 / total_ratios as f64) * 75.0;
            let _ = app.emit("clip-build-progress", ClipBuildProgress {
                clip_id: clip_id.clone(),
                project_id: project_id.clone(),
                progress: progress_start,
                stage: "building".to_string(),
                message: format!("Building {} ({}/{})", aspect_ratio_str, ratio_idx + 1, total_ratios),
                error: None,
            });

            // Parse aspect ratio string (e.g., "16:9")
            let aspect_ratio = parse_aspect_ratio(&aspect_ratio_str)?;
            
            // Campaign branding override logic
            // If branding_type is 'campaign', we override org branding completely
            // This means: no org watermark, no org intro/outro
            let is_campaign_build = branding_type.as_ref().map(|t| t == "campaign").unwrap_or(false);
            
            // Campaign branding assets (will override org assets if campaign build)
            let mut campaign_intro_path: Option<String> = None;
            let mut campaign_outro_path: Option<String> = None;
            let mut campaign_watermark_settings: Option<WatermarkSettings> = None;
            
            if is_campaign_build && campaign_branding_profile_id.is_some() {
                println!("[Rust] Campaign build detected - campaign_id: {:?}, branding_profile_id: {:?}", campaign_id, campaign_branding_profile_id);
                println!("[Rust] Fetching campaign branding assets from server...");
                
                // Get API credentials from environment or app state
                // In production, these would come from the authenticated user session
                let api_base_url = std::env::var("API_BASE_URL")
                    .unwrap_or_else(|_| "https://api.clippster.app".to_string());
                let auth_token = std::env::var("AUTH_TOKEN")
                    .unwrap_or_else(|_| "".to_string());
                
                if !auth_token.is_empty() {
                    match crate::api::fetch_campaign_branding_profile(
                        &api_base_url,
                        &auth_token,
                        campaign_branding_profile_id.unwrap(),
                    ).await {
                        Ok(profile) => {
                            println!("[Rust] Campaign branding profile fetched: {}", profile.name);
                            
                            // Get storage paths
                            let paths = match crate::storage::init_storage_dirs() {
                                Ok(p) => p,
                                Err(e) => {
                                    println!("[Rust] Warning: Failed to get storage paths: {}", e);
                                    return Err::<_, String>(format!("Failed to get storage paths: {}", e));
                                }
                            };
                            
                            // Download campaign intro if it exists
                            if let Some(intro_id) = profile.intro_id {
                                println!("[Rust] Downloading campaign intro asset: {}", intro_id);
                                match crate::api::download_org_asset(
                                    &api_base_url,
                                    &auth_token,
                                    intro_id,
                                    "intros",
                                    profile.organization_id,
                                    &paths.intros,
                                ).await {
                                    Ok(path) => {
                                        println!("[Rust] Campaign intro downloaded: {}", path);
                                        campaign_intro_path = Some(path);
                                    }
                                    Err(e) => {
                                        println!("[Rust] Warning: Failed to download campaign intro: {}", e);
                                    }
                                }
                            }
                            
                            // Download campaign outro if it exists
                            if let Some(outro_id) = profile.outro_id {
                                println!("[Rust] Downloading campaign outro asset: {}", outro_id);
                                match crate::api::download_org_asset(
                                    &api_base_url,
                                    &auth_token,
                                    outro_id,
                                    "outros",
                                    profile.organization_id,
                                    &paths.outros,
                                ).await {
                                    Ok(path) => {
                                        println!("[Rust] Campaign outro downloaded: {}", path);
                                        campaign_outro_path = Some(path);
                                    }
                                    Err(e) => {
                                        println!("[Rust] Warning: Failed to download campaign outro: {}", e);
                                    }
                                }
                            }
                            
                            // Download campaign watermark if it exists
                            if let Some(watermark_id) = profile.watermark_id {
                                println!("[Rust] Downloading campaign watermark asset: {}", watermark_id);
                                match crate::api::download_org_asset(
                                    &api_base_url,
                                    &auth_token,
                                    watermark_id,
                                    "watermarks",
                                    profile.organization_id,
                                    &paths.watermarks,
                                ).await {
                                    Ok(watermark_path) => {
                                        println!("[Rust] Campaign watermark downloaded: {}", watermark_path);
                                        
                                        // Create watermark settings from campaign profile
                                        let wm_settings = WatermarkSettings {
                                            enabled: true,
                                            watermark_id: watermark_id.to_string(),
                                            file_path: watermark_path,
                                            width: None,
                                            height: None,
                                            position_x: 90, // 90% from left (bottom-right)
                                            position_y: 90, // 90% from top (bottom-right)
                                            opacity: 100,
                                            scale: 15, // 15% of video width
                                            per_ratio_settings: None,
                                        };
                                        campaign_watermark_settings = Some(wm_settings);
                                    }
                                    Err(e) => {
                                        println!("[Rust] Warning: Failed to download campaign watermark: {}", e);
                                    }
                                }
                            }
                            
                            println!("[Rust] Campaign branding assets ready - intro: {}, outro: {}, watermark: {}",
                                campaign_intro_path.is_some(),
                                campaign_outro_path.is_some(),
                                campaign_watermark_settings.is_some());
                        }
                        Err(e) => {
                            println!("[Rust] Warning: Failed to fetch campaign branding profile: {}", e);
                            println!("[Rust] Continuing with org branding as fallback");
                        }
                    }
                } else {
                    println!("[Rust] Warning: No auth token available, cannot fetch campaign branding");
                    println!("[Rust] Continuing with org branding as fallback");
                }
            }
            
            // Resolve intro/outro for this aspect ratio
            // Priority: campaign assets -> per-ratio settings -> global intro/outro -> none
            let (effective_intro_path, _effective_intro_duration) = if is_campaign_build && campaign_intro_path.is_some() {
                // Campaign branding overrides everything
                (campaign_intro_path.clone(), None)
            } else if let Some(per_ratio) = &intro_outro_per_ratio {
                if let Some(ratio_config) = per_ratio.get(&aspect_ratio_str) {
                    (ratio_config.intro_path.clone(), ratio_config.intro_duration)
                } else {
                    (intro_path.as_ref().map(|s| s.to_string()), intro_duration)
                }
            } else {
                (intro_path.as_ref().map(|s| s.to_string()), intro_duration)
            };

            let (effective_outro_path, _effective_outro_duration) = if is_campaign_build && campaign_outro_path.is_some() {
                // Campaign branding overrides everything
                (campaign_outro_path.clone(), None)
            } else if let Some(per_ratio) = &intro_outro_per_ratio {
                if let Some(ratio_config) = per_ratio.get(&aspect_ratio_str) {
                    (ratio_config.outro_path.clone(), ratio_config.outro_duration)
                } else {
                    (outro_path.as_ref().map(|s| s.to_string()), outro_duration)
                }
            } else {
                (outro_path.as_ref().map(|s| s.to_string()), outro_duration)
            };
            
            if let Some(ref intro) = effective_intro_path {
                let source = if is_campaign_build && campaign_intro_path.is_some() { "campaign" } else { "org" };
                println!("[Rust] Using {} intro for {}: {}", source, aspect_ratio_str, intro);
            }
            if let Some(ref outro) = effective_outro_path {
                let source = if is_campaign_build && campaign_outro_path.is_some() { "campaign" } else { "org" };
                println!("[Rust] Using {} outro for {}: {}", source, aspect_ratio_str, outro);
            }
            
            // Apply campaign watermark override if available
            let effective_watermark_settings = if is_campaign_build && campaign_watermark_settings.is_some() {
                println!("[Rust] Using campaign watermark for {}", aspect_ratio_str);
                campaign_watermark_settings.clone()
            } else {
                watermark_settings.clone()
            };
            
            // Create filename using the AI-generated clip name in snake_case with build number
            // e.g., "Epic Victory Trash Talk" with 16:9, build 2 -> "epic_victory_trash_talk_16-9_2.mp4"
            let ratio_suffix = aspect_ratio_str.replace(":", "-");
            let output_filename = format!("{}_{}_{}.{}", snake_case_name, ratio_suffix, build_num, output_format);
            let output_path = clip_base_dir.join(&output_filename);

            // Check if we have pre-rendered subtitle overlays for this aspect ratio
            // If yes, use PNG-based pixel-perfect rendering; otherwise fall back to ASS
            let has_prerendered_subtitles = subtitle_overlays
                .as_ref()
                .map(|overlays| overlays.get(&aspect_ratio_str).map(|v| !v.is_empty()).unwrap_or(false))
                .unwrap_or(false);
            
            let prerendered_subtitle_frames: Vec<SubtitleOverlaySettings> = if has_prerendered_subtitles {
                subtitle_overlays
                    .as_ref()
                    .and_then(|overlays| overlays.get(&aspect_ratio_str).cloned())
                    .unwrap_or_default()
            } else {
                Vec::new()
            };
            
            if has_prerendered_subtitles {
                println!("[Rust] Using {} pre-rendered subtitle overlays for {} (pixel-perfect mode)", 
                    prerendered_subtitle_frames.len(), aspect_ratio_str);
            }

            // Generate subtitle file if needed for this aspect ratio (fallback when no pre-rendered overlays)
            let subtitle_file = if !has_prerendered_subtitles {
                if let (Some(settings), Some(words)) = (&subtitle_settings, &transcript_words) {
                    if settings.enabled {
                        // Get fonts directory
                        let fonts_dir = get_fonts_dir(&app).ok();
                        
                        let sub_path = clip_base_dir.join(format!("subtitles_{}.ass", ratio_suffix));
                        // Pass intro_duration as time offset for subtitle timings
                        let subtitle_offset = intro_duration.unwrap_or(0.0);
                        // Convert subtitle override to JSON Value if available
                        let per_ratio_override_json = subtitle_overrides
                            .and_then(|overrides| overrides.get(&aspect_ratio_str).cloned())
                            .map(|o| serde_json::to_value(o).unwrap());
                        if let Some(ref override_json) = per_ratio_override_json {
                            println!(
                                "[Rust] Using per-ratio subtitle override for {}: {}",
                                aspect_ratio_str,
                                override_json
                            );
                        } else {
                            println!(
                                "[Rust] No per-ratio subtitle override found for {}, using base settings (ASS fallback)",
                                aspect_ratio_str
                            );
                        }
                        
                        generate_ass_file(
                            settings, 
                            words, 
                            &segments, 
                            &sub_path, 
                            max_words.unwrap_or(4), 
                            Some(&aspect_ratio),
                            video_info.width,
                            video_info.height,
                            fonts_dir.as_deref(),
                            subtitle_offset,
                            per_ratio_override_json.as_ref()
                        ).map_err(|e| format!("Failed to generate subtitle file: {}", e))?;
                        
                        Some(sub_path)
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None // Using pre-rendered overlays, no ASS file needed
            };

            // Handle text overlays - partition into simple (ASS) and advanced (image-based)
            let mut rendered_text_images: Vec<(String, TextOverlaySettings)> = Vec::new();
            let final_subtitle_file = if let Some(overlays) = &text_overlays {
                let overlays_for_ratio: Vec<TextOverlaySettings> = overlays
                    .iter()
                    .filter(|ovl| text_overlay_applies_for_aspect_ratio(ovl, &aspect_ratio_str))
                    .cloned()
                    .collect();
                println!("[Rust] TEXT OVERLAY DEBUG: Received {} text overlays for {} ({} apply to this ratio)", overlays.len(), aspect_ratio_str, overlays_for_ratio.len());
                for (i, ovl) in overlays_for_ratio.iter().enumerate() {
                    println!("[Rust] TEXT OVERLAY [{}]: id={}, text='{}', start={}, end={}, pos=({}, {}), bg_enabled={}", 
                        i, ovl.id, ovl.text, ovl.start_time, ovl.end_time, ovl.position_x, ovl.position_y, ovl.style.background_enabled);
                }
                if !overlays_for_ratio.is_empty() {
                    let subtitle_offset = intro_duration.unwrap_or(0.0);
                    
                    // Partition overlays: simple ones use ASS, advanced ones get rendered to PNG
                    let (simple_overlays, advanced_overlays) = partition_overlays(&overlays_for_ratio, &aspect_ratio_str);
                    
                    println!("[Rust] Text overlays for {}: {} simple (ASS), {} advanced (PNG)", 
                        aspect_ratio_str, simple_overlays.len(), advanced_overlays.len());
                    
                    // Render advanced overlays to PNG images
                    for overlay in &advanced_overlays {
                        match render_text_overlay_to_png(
                            overlay,
                            video_info.width,
                            video_info.height,
                            &aspect_ratio_str,
                            &clip_base_dir,
                        ) {
                            Ok(image_path) => {
                                println!("[Rust] Rendered advanced text overlay {} to: {}", overlay.id, image_path);
                                rendered_text_images.push((image_path, overlay.clone()));
                            }
                            Err(e) => {
                                println!("[Rust] Warning: Failed to render advanced text overlay {}: {}", overlay.id, e);
                                // Fall back to ASS for this overlay (add to simple list)
                            }
                        }
                    }
                    
                    // Process simple overlays with ASS
                    if !simple_overlays.is_empty() {
                        if let Some(ref sub_path) = subtitle_file {
                            // Merge simple text overlays into existing subtitle ASS file
                            println!("[Rust] Merging {} simple text overlays into subtitle file for aspect ratio {}", simple_overlays.len(), aspect_ratio_str);
                            merge_text_overlays_into_ass(
                                sub_path,
                                &simple_overlays,
                                video_info.width,
                                video_info.height,
                                subtitle_offset,
                                &aspect_ratio_str
                            ).map_err(|e| format!("Failed to merge text overlays: {}", e))?;
                            subtitle_file.clone()
                        } else {
                            // Generate standalone text overlay ASS file
                            println!("[Rust] Generating standalone text overlay ASS file with {} overlays for aspect ratio {}", simple_overlays.len(), aspect_ratio_str);
                            let text_overlay_path = clip_base_dir.join(format!("text_overlays_{}.ass", ratio_suffix));
                            let text_overlay_fonts_dir = get_fonts_dir(&app).ok();
                            generate_text_overlay_ass_file(
                                &simple_overlays,
                                &text_overlay_path,
                                video_info.width,
                                video_info.height,
                                subtitle_offset,
                                text_overlay_fonts_dir.as_deref(),
                                &aspect_ratio_str
                            ).map_err(|e| format!("Failed to generate text overlay file: {}", e))?;
                            Some(text_overlay_path)
                        }
                    } else {
                        subtitle_file.clone()
                    }
                } else {
                    subtitle_file.clone()
                }
            } else {
                subtitle_file.clone()
            };

            // Check for cancellation before building
            if is_build_cancelled(&cancel_rx) {
                return Err::<_, String>("Build cancelled by user".to_string());
            }

            // Build clip based on segments with aspect ratio cropping
            // Check if we have segment-specific or global framing configs
            
            // For single-segment clips, check if there's a framing config
            if segments.len() == 1 {
                // Get framing for this single segment (checks segment-specific first, then global)
                let effective_framing_strategy = get_framing_for_segment(
                    &segments[0],
                    &aspect_ratio_str,
                    &segment_framing_configs,
                    &manual_framing_configs,
                    video_info.width,
                    video_info.height,
                ).or_else(|| framing_strategy.clone());
                
                if let Some(strategy) = effective_framing_strategy {
                    println!("[Rust] Building single-segment clip for {} with framing strategy: {:?}", aspect_ratio_str, strategy.mode);
                    build_clip_with_framing_strategy(
                        &app,
                        &video_path,
                        &output_path,
                        &segments[0],
                        &strategy,
                        &aspect_ratio_str,  // Pass the current aspect ratio being built
                        &quality,
                        frame_rate,
                        final_subtitle_file.as_deref(),
                        effective_intro_path.as_deref(),
                        effective_outro_path.as_deref(),
                        intro_outro_cache.clone(),
                        watermark_settings.as_ref(),
                        audio_settings.as_ref(),
                        video_filter_segments.as_ref(),
                        effects_filter_chain.as_deref()
                    ).await?;
                } else {
                    // No framing for single segment
                    println!("[Rust] Building single-segment clip for {}", aspect_ratio_str);
                    build_single_segment_clip_with_settings(
                        &app,
                        &video_path,
                        &output_path,
                        &segments[0],
                        final_subtitle_file.as_deref(),
                        &aspect_ratio,
                        &quality,
                        frame_rate,
                        &output_format,
                        effective_intro_path.as_deref(),
                        effective_outro_path.as_deref(),
                        intro_outro_cache.clone(),
                        effective_watermark_settings.as_ref(),
                        audio_settings.as_ref(),
                        video_filter_segments.as_ref(),
                        effects_filter_chain.as_deref(),
                        audio_effects_filter_chain.as_deref()
                    ).await?;
                }
            } else {
                // Multi-segment clip
                // Check if all segments have the same framing config
                let mut all_same_framing = true;
                let first_segment_framing = get_framing_for_segment(
                    &segments[0],
                    &aspect_ratio_str,
                    &segment_framing_configs,
                    &manual_framing_configs,
                    video_info.width,
                    video_info.height,
                );
                
                // Check if all segments have the same framing
                for segment in &segments[1..] {
                    let segment_framing = get_framing_for_segment(
                        segment,
                        &aspect_ratio_str,
                        &segment_framing_configs,
                        &manual_framing_configs,
                        video_info.width,
                        video_info.height,
                    );
                    
                    // Compare framing strategies (simplified - just check if both are Some or both are None)
                    match (&first_segment_framing, &segment_framing) {
                        (Some(_), None) | (None, Some(_)) => {
                            all_same_framing = false;
                            break;
                        }
                        _ => {}
                    }
                }
                
                if all_same_framing && first_segment_framing.is_some() {
                    // All segments have the same framing - use multi-segment builder with single strategy
                    let strategy = first_segment_framing.or_else(|| framing_strategy.clone());
                    if let Some(strat) = strategy {
                        println!("[Rust] Building multi-segment clip for {} with {} segments and uniform framing: {:?}", 
                                 aspect_ratio_str, segments.len(), strat.mode);
                        build_multi_segment_clip_with_framing_strategy(
                            &app,
                            &video_path,
                            &output_path,
                            &segments,
                            &strat,
                            &aspect_ratio_str,
                            &quality,
                            frame_rate,
                            final_subtitle_file.as_deref(),
                            effective_intro_path.as_deref(),
                            effective_outro_path.as_deref(),
                            intro_outro_cache.clone(),
                            watermark_settings.as_ref(),
                            audio_settings.as_ref(),
                            video_filter_segments.as_ref(),
                            effects_filter_chain.as_deref()
                        ).await?;
                    } else {
                        // No framing
                        println!("[Rust] Building multi-segment clip for {} with {} segments", aspect_ratio_str, segments.len());
                        build_multi_segment_clip_with_settings(
                            &app,
                            &video_path,
                            &output_path,
                            &segments,
                            final_subtitle_file.as_deref(),
                            &aspect_ratio,
                            &quality,
                            frame_rate,
                            &output_format,
                            effective_intro_path.as_deref(),
                            effective_outro_path.as_deref(),
                            intro_outro_cache.clone(),
                            effective_watermark_settings.as_ref(),
                            audio_settings.as_ref(),
                            video_filter_segments.as_ref(),
                            effects_filter_chain.as_deref()
                        ).await?;
                    }
                } else {
                    // Segments have different framing - build each segment separately and concatenate
                    println!("[Rust] Building multi-segment clip for {} with {} segments (per-segment framing)", 
                             aspect_ratio_str, segments.len());
                    
                    // Create temp directory for individual segment outputs
                    let temp_dir = clip_base_dir.join(format!("temp_segments_{}", ratio_suffix));
                    std::fs::create_dir_all(&temp_dir)
                        .map_err(|e| format!("Failed to create temp segments directory: {}", e))?;
                    
                    let mut segment_paths: Vec<std::path::PathBuf> = Vec::new();
                    
                    // Build each segment individually with its specific framing
                    for (seg_idx, segment) in segments.iter().enumerate() {
                        let segment_framing = get_framing_for_segment(
                            segment,
                            &aspect_ratio_str,
                            &segment_framing_configs,
                            &manual_framing_configs,
                            video_info.width,
                            video_info.height,
                        ).or_else(|| framing_strategy.clone());
                        
                        let segment_output = temp_dir.join(format!("segment_{:03}.{}", seg_idx, output_format));
                        
                        if let Some(strategy) = segment_framing {
                            println!("[Rust] Building segment {} with framing: {:?}", seg_idx, strategy.mode);
                            build_clip_with_framing_strategy(
                                &app,
                                &video_path,
                                &segment_output,
                                segment,
                                &strategy,
                                &aspect_ratio_str,
                                &quality,
                                frame_rate,
                                None, // No subtitles for individual segments
                                None, // No intro for individual segments
                                None, // No outro for individual segments
                                intro_outro_cache.clone(),
                                watermark_settings.as_ref(),
                                audio_settings.as_ref(),
                                video_filter_segments.as_ref(),
                                effects_filter_chain.as_deref()
                            ).await?;
                        } else {
                            println!("[Rust] Building segment {} without framing", seg_idx);
                            build_single_segment_clip_with_settings(
                                &app,
                                &video_path,
                                &segment_output,
                                segment,
                                None, // No subtitles for individual segments
                                &aspect_ratio,
                                &quality,
                                frame_rate,
                                &output_format,
                                None, // No intro for individual segments
                                None, // No outro for individual segments
                                intro_outro_cache.clone(),
                                watermark_settings.as_ref(),
                                audio_settings.as_ref(),
                                video_filter_segments.as_ref(),
                                effects_filter_chain.as_deref(),
                                audio_effects_filter_chain.as_deref()
                            ).await?;
                        }
                        
                        segment_paths.push(segment_output);
                    }
                    
                    // Calculate target dimensions for intro/outro reframing
                    use super::video_info::calculate_crop_params;
                    let (crop_w, crop_h, _crop_x, _crop_y) = calculate_crop_params(
                        video_info.width,
                        video_info.height,
                        &aspect_ratio
                    );
                    
                    // Prepare intro/outro for concatenation (reframe to match aspect ratio if needed)
                    let prepared_intro_path = if let Some(ref intro) = effective_intro_path {
                        let prepared = prepare_intro_outro_for_concat(
                            &app,
                            intro,
                            &temp_dir,
                            "intro",
                            &aspect_ratio,
                            &quality,
                            frame_rate,
                            crop_w,
                            crop_h,
                            intro_outro_cache.clone(),
                        ).await?;
                        Some(prepared.to_string_lossy().to_string())
                    } else {
                        None
                    };

                    let prepared_outro_path = if let Some(ref outro) = effective_outro_path {
                        let prepared = prepare_intro_outro_for_concat(
                            &app,
                            outro,
                            &temp_dir,
                            "outro",
                            &aspect_ratio,
                            &quality,
                            frame_rate,
                            crop_w,
                            crop_h,
                            intro_outro_cache.clone(),
                        ).await?;
                        Some(prepared.to_string_lossy().to_string())
                    } else {
                        None
                    };
                    
                    // Concatenate all segments with prepared intro/outro
                    println!("[Rust] Concatenating {} segments for {}", segment_paths.len(), aspect_ratio_str);
                    concatenate_videos(&app, &segment_paths, &output_path, prepared_intro_path.as_deref(), prepared_outro_path.as_deref()).await?;
                    
                    // Apply subtitles to the final concatenated video if needed
                    if let Some(subtitle_path) = final_subtitle_file.as_deref() {
                        println!("[Rust] Applying subtitles to concatenated video");
                        let temp_output = output_path.with_extension("temp.mp4");
                        apply_subtitles_to_video(&app, &output_path, &temp_output, subtitle_path).await?;
                        std::fs::rename(&temp_output, &output_path)
                            .map_err(|e| format!("Failed to replace video with subtitled version: {}", e))?;
                    }
                    
                    // Clean up temp directory
                    let _ = std::fs::remove_dir_all(&temp_dir);
                }
            }

            // Apply stickers if present
            if let Some(sticker_list) = stickers.as_ref() {
                if !sticker_list.is_empty() {
                    println!("[Rust] Applying {} stickers to {} clip", sticker_list.len(), aspect_ratio_str);
                    apply_stickers_to_video(
                        &app,
                        &output_path,
                        sticker_list,
                        &aspect_ratio_str,
                        &quality
                    ).await?;
                }
            }

            // Apply clip watermarks if present (from clip editor)
            if let Some(watermark_list) = clip_watermarks.as_ref() {
                if !watermark_list.is_empty() {
                    println!("[Rust] Applying {} clip watermarks to {} clip", watermark_list.len(), aspect_ratio_str);
                    apply_clip_watermarks_to_video(
                        &app,
                        &output_path,
                        watermark_list,
                        &aspect_ratio_str,
                        &quality
                    ).await?;
                }
            }

            // Apply layout overlays if present (from creator profile or VOD preset)
            if let Some(overlay_list) = layout_overlays.as_ref() {
                if !overlay_list.is_empty() {
                    println!("[Rust] Applying {} layout overlays to {} clip", overlay_list.len(), aspect_ratio_str);
                    apply_layout_overlays_to_video(
                        &app,
                        &output_path,
                        overlay_list,
                        &aspect_ratio_str,
                        &quality
                    ).await?;
                }
            }

            // Apply rendered text overlays (advanced styling: chat bubbles, gradients, glows)
            if !rendered_text_images.is_empty() {
                let text_overlay_offset = intro_duration.unwrap_or(0.0);
                println!("[Rust] Applying {} rendered text overlays to {} clip (time offset: {})", rendered_text_images.len(), aspect_ratio_str, text_overlay_offset);
                apply_rendered_text_overlays_to_video(
                    &app,
                    &output_path,
                    &rendered_text_images,
                    &aspect_ratio_str,
                    &quality,
                    text_overlay_offset
                ).await?;
            }

            // Apply pre-rendered subtitle overlays (pixel-perfect mode)
            if !prerendered_subtitle_frames.is_empty() {
                println!("[Rust] Applying {} pre-rendered subtitle overlays to {} clip", prerendered_subtitle_frames.len(), aspect_ratio_str);
                apply_subtitle_overlays_to_video(
                    &app,
                    &output_path,
                    &prerendered_subtitle_frames,
                    &quality
                ).await?;
            }

            // Clean up subtitle file
            if let Some(sub_path) = subtitle_file {
                let _ = std::fs::remove_file(sub_path);
            }

            // Get file metadata
            let metadata = std::fs::metadata(&output_path)
                .map_err(|e| format!("Failed to get output file metadata: {}", e))?;
            let file_size = metadata.len();

            // Get clip duration (from first clip)
            let duration = if ratio_idx == 0 {
                crate::ffmpeg_utils::get_video_duration_sync(&app, output_path.to_str().ok_or("Invalid output path")?).await.ok()
            } else {
                None
            };

            // Return build result (thumbnail is generated during detection, not build)
            Ok::<_, String>((
                output_path.to_string_lossy().to_string(),
                file_size,
                duration,
                ratio_idx
            ))
        }
    }).collect();

    // Wait for all aspect ratios to complete in parallel
    let build_results = join_all(build_tasks).await;

    // Process results
    for result in build_results {
        match result {
            Ok((output_path_str, file_size, duration, ratio_idx)) => {
                all_output_paths.push(output_path_str.clone());
                total_file_size += file_size;

                if ratio_idx == 0 {
                    first_output_path = Some(output_path_str);
                    clip_duration = duration;
                }
            }
            Err(e) => return Err(format!("Aspect ratio build failed: {}", e)),
        }
    }

    println!(
        "[Rust] All {} aspect ratios built successfully in parallel!",
        total_ratios
    );

    // Final cancellation check - if cancelled after builds completed, clean up and return error
    if is_build_cancelled(&cancel_rx) {
        println!("[Rust] Build was cancelled after completion - cleaning up output files...");

        // Delete all built files
        for output_path in &all_output_paths {
            if let Err(e) = std::fs::remove_file(output_path) {
                println!("[Rust] Warning: Failed to clean up {}: {}", output_path, e);
            } else {
                println!("[Rust] Cleaned up: {}", output_path);
            }
        }

        // Try to clean up the clip folder if empty
        let _ = std::fs::remove_dir(&clip_base_dir);

        return Err("Build cancelled by user".to_string());
    }

    // Generate thumbnail from the first output video (at 1 second mark to avoid black frames)
    let thumbnail_path = if let Some(ref first_output) = first_output_path {
        println!("[Rust] Generating thumbnail from first output video...");
        let paths = crate::storage::init_storage_dirs()
            .map_err(|e| format!("Failed to get storage paths: {}", e))?;
        
        let output_stem = std::path::Path::new(first_output)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("clip");
        let thumbnail_filename = format!("{}_thumb.jpg", output_stem);
        let thumbnail_path = paths.thumbnails.join(&thumbnail_filename);
        
        // Extract frame at 1 second (or halfway through if clip is shorter than 2 seconds)
        let thumbnail_time = if let Some(dur) = clip_duration {
            if dur < 2.0 {
                dur / 2.0
            } else {
                1.0
            }
        } else {
            1.0
        };
        
        let thumbnail_result = app.shell()
            .sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?
            .args(&[
                "-y",
                "-ss", &thumbnail_time.to_string(),
                "-i", first_output,
                "-vframes", "1",
                "-q:v", "2",
                thumbnail_path.to_str().ok_or("Invalid thumbnail path")?,
            ])
            .output()
            .await;
        
        match thumbnail_result {
            Ok(output) if output.status.success() => {
                println!("[Rust] Thumbnail generated: {}", thumbnail_path.display());
                Some(thumbnail_path.to_string_lossy().to_string())
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                println!("[Rust] Thumbnail generation failed (non-fatal): {}", stderr);
                None
            }
            Err(e) => {
                println!("[Rust] Failed to run ffmpeg for thumbnail (non-fatal): {}", e);
                None
            }
        }
    } else {
        None
    };

    // Emit completion progress
    println!("[Rust] Emitting completion progress event...");
    let result = ClipBuildResult {
        clip_id: clip_id.to_string(),
        project_id: project_id.to_string(),
        build_id,
        success: true,
        output_path: first_output_path,
        all_output_paths: all_output_paths.clone(),
        thumbnail_path,
        duration: clip_duration,
        file_size: Some(total_file_size),
        error: None,
    };

    let _ = app.emit(
        "clip-build-progress",
        ClipBuildProgress {
            clip_id: clip_id.to_string(),
            project_id: project_id.to_string(),
            progress: 100.0,
            stage: "completed".to_string(),
            message: format!("Built {} clip(s) successfully!", total_ratios),
            error: None,
        },
    );

    println!(
        "[Rust] Built {} clips at: {:?}",
        total_ratios, all_output_paths
    );
    Ok(result)
}
