use std::sync::{Arc, Mutex};
use futures::future::join_all;
use tauri::Emitter;

use super::types::{SubtitleSettings, SubtitleOverrides, WordInfo, WhisperSegment, ClipBuildProgress, ClipBuildResult, WatermarkSettings, AudioSettings, FramingStrategy, VideoFilterSegment, TextOverlaySettings, StickerSettings, ClipWatermarkSettings, ManualFramingConfig, SegmentFramingConfigs, LayoutOverlaySettings};
use super::effect_renderer::{ClipEffectSettings, build_effects_filter_chain};
use super::audio_effect_renderer::{AudioEffectSettings, build_audio_effects_filter_chain};
use super::video_info::{get_video_info, parse_aspect_ratio, IntroOutroCache};
use super::subtitle::{generate_ass_file, generate_text_overlay_ass_file, merge_text_overlays_into_ass};
use super::video_processor::{build_single_segment_clip_with_settings, build_multi_segment_clip_with_settings, build_clip_with_framing_strategy, build_multi_segment_clip_with_framing_strategy, apply_stickers_to_video, apply_clip_watermarks_to_video, apply_rendered_text_overlays_to_video};
use super::font_manager::get_fonts_dir;
use super::text_renderer::{render_text_overlay_to_png, partition_overlays};
use super::{CancellationToken, is_build_cancelled};

// Helper function to sanitize a clip name for use as a folder name
fn sanitize_clip_name(name: &str) -> String {
    // Replace invalid filesystem characters with underscores
    let invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
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
    run_number: Option<u32>
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
    clip_name: &str
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
    let output = app.shell()
        .sidecar("ffmpeg")
        .unwrap()
        .args(["-nostdin", "-f", "concat", "-safe", "0", "-i", &concat_list_path.to_string_lossy(), "-c", "copy", "-y", &output_path.to_string_lossy()])
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
    
    let subtitle_filter = format!("ass={}", subtitle_path.to_string_lossy().replace("\\", "/").replace(":", "\\\\:"));
    
    let output = app.shell()
        .sidecar("ffmpeg")
        .unwrap()
        .args(["-nostdin", "-i", &input_path.to_string_lossy(), "-vf", &subtitle_filter, "-c:a", "copy", "-y", &output_path.to_string_lossy()])
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
                    println!("[Rust] Using segment-specific framing for segment {} in {}", seg_id, aspect_ratio);
                    return Some(seg_config.config.to_framing_strategy(video_width, video_height));
                }
            }
        }
    }
    
    // Fallback to global manual config
    if let Some(configs) = manual_framing_configs {
        if let Some(config) = configs.get(aspect_ratio) {
            println!("[Rust] Using global manual framing config for {}", aspect_ratio);
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
    transcript_words: Option<Vec<WordInfo>>,
    _transcript_segments: Option<Vec<WhisperSegment>>,
    max_words: Option<usize>,
    aspect_ratios: &[String],
    quality: &str,
    frame_rate: u32,
    output_format: &str,
    run_number: Option<u32>,
    build_number: Option<u32>,
    _build_id: Option<String>,
    intro_path: Option<&str>,
    intro_duration: Option<f64>,
    outro_path: Option<&str>,
    outro_duration: Option<f64>,
    intro_outro_per_ratio: Option<&std::collections::HashMap<String, (Option<String>, Option<f64>)>>,
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
    _layout_overlays: Option<Vec<LayoutOverlaySettings>>,
    cancel_rx: CancellationToken
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
    let _ = app.emit("clip-build-progress", ClipBuildProgress {
        clip_id: clip_id.to_string(),
        project_id: project_id.to_string(),
        progress: 0.0,
        stage: "initializing".to_string(),
        message: "Preparing to build clip...".to_string(),
        error: None,
    });

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
    println!("[Rust] Video dimensions: {}x{}", video_info.width, video_info.height);

    // Build effects filter chain if effects are provided
    let effects_filter_chain = if let Some(ref effects) = clip_effects {
        if !effects.is_empty() {
            println!("[Rust] Building effects filter chain for {} effects", effects.len());
            match build_effects_filter_chain(effects, video_info.width, video_info.height) {
                Ok(filter) => {
                    if let Some(ref f) = filter {
                        println!("[Rust] Effects filter chain: {}", f);
                    }
                    filter
                }
                Err(e) => {
                    println!("[Rust] Warning: Failed to build effects filter chain: {}", e);
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
            println!("[Rust] Building audio effects filter chain for {} effects", effects.len());
            match build_audio_effects_filter_chain(effects) {
                Ok(filter) => {
                    if let Some(ref f) = filter {
                        println!("[Rust] Audio effects filter chain: {}", f);
                    }
                    filter
                }
                Err(e) => {
                    println!("[Rust] Warning: Failed to build audio effects filter chain: {}", e);
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
    println!("[Rust] Building {} aspect ratios in parallel...", total_ratios);
    
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
            
            // Resolve intro/outro for this aspect ratio
            // Priority: per-ratio settings -> global intro/outro -> none
            let (effective_intro_path, _effective_intro_duration) = if let Some(per_ratio) = &intro_outro_per_ratio {
                if let Some((ratio_intro_path, ratio_intro_duration)) = per_ratio.get(&aspect_ratio_str) {
                    (ratio_intro_path.clone(), *ratio_intro_duration)
                } else {
                    (intro_path.as_ref().map(|s| s.to_string()), intro_duration)
                }
            } else {
                (intro_path.as_ref().map(|s| s.to_string()), intro_duration)
            };
            
            let (effective_outro_path, _effective_outro_duration) = if let Some(per_ratio) = &intro_outro_per_ratio {
                if let Some((ratio_outro_path, ratio_outro_duration)) = per_ratio.get(&aspect_ratio_str) {
                    (ratio_outro_path.clone(), *ratio_outro_duration)
                } else {
                    (outro_path.as_ref().map(|s| s.to_string()), outro_duration)
                }
            } else {
                (outro_path.as_ref().map(|s| s.to_string()), outro_duration)
            };
            
            if let Some(ref intro) = effective_intro_path {
                println!("[Rust] Using intro for {}: {}", aspect_ratio_str, intro);
            }
            if let Some(ref outro) = effective_outro_path {
                println!("[Rust] Using outro for {}: {}", aspect_ratio_str, outro);
            }
            
            // Create filename using the AI-generated clip name in snake_case with build number
            // e.g., "Epic Victory Trash Talk" with 16:9, build 2 -> "epic_victory_trash_talk_16-9_2.mp4"
            let ratio_suffix = aspect_ratio_str.replace(":", "-");
            let output_filename = format!("{}_{}_{}.{}", snake_case_name, ratio_suffix, build_num, output_format);
            let output_path = clip_base_dir.join(&output_filename);

            // Generate subtitle file if needed for this aspect ratio
            let subtitle_file = if let (Some(settings), Some(words)) = (&subtitle_settings, &transcript_words) {
                if settings.enabled {
                    // Get fonts directory
                    let fonts_dir = get_fonts_dir(&app).ok();
                    
                    // Apply per-aspect-ratio overrides if they exist
                    let effective_settings = if let Some(ref overrides) = subtitle_overrides {
                        if let Some(override_for_ratio) = overrides.get(&aspect_ratio_str) {
                            println!("[Rust] Applying subtitle overrides for {}: fontSize={}, positionPercentage={}, maxWidth={:?}", 
                                     aspect_ratio_str, override_for_ratio.font_size, override_for_ratio.position_percentage, override_for_ratio.max_width);
                            let mut overridden = settings.clone();
                            overridden.font_size = override_for_ratio.font_size;
                            overridden.position_percentage = override_for_ratio.position_percentage;
                            // Apply max_width override if specified
                            if let Some(max_width) = override_for_ratio.max_width {
                                overridden.max_width = max_width;
                            }
                            overridden
                        } else {
                            settings.clone()
                        }
                    } else {
                        settings.clone()
                    };
                    
                    let sub_path = clip_base_dir.join(format!("subtitles_{}.ass", ratio_suffix));
                    // Pass intro_duration as time offset for subtitle timings
                    let subtitle_offset = intro_duration.unwrap_or(0.0);
                    generate_ass_file(
                        &effective_settings, 
                        words, 
                        &segments, 
                        &sub_path, 
                        max_words.unwrap_or(4), 
                        Some(&aspect_ratio),
                        video_info.width,
                        video_info.height,
                        fonts_dir.as_deref(),
                        subtitle_offset
                    ).map_err(|e| format!("Failed to generate subtitle file: {}", e))?;
                    
                    Some(sub_path)
                } else {
                    None
                }
            } else {
                None
            };

            // Handle text overlays - partition into simple (ASS) and advanced (image-based)
            let mut rendered_text_images: Vec<(String, TextOverlaySettings)> = Vec::new();
            let final_subtitle_file = if let Some(overlays) = &text_overlays {
                if !overlays.is_empty() {
                    let subtitle_offset = intro_duration.unwrap_or(0.0);
                    
                    // Partition overlays: simple ones use ASS, advanced ones get rendered to PNG
                    let (simple_overlays, advanced_overlays) = partition_overlays(overlays, &aspect_ratio_str);
                    
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
                        watermark_settings.as_ref(),
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
                            intro_path.as_deref(),
                            outro_path.as_deref(),
                            intro_outro_cache.clone(),
                            watermark_settings.as_ref(),
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
                    
                    // Concatenate all segments
                    println!("[Rust] Concatenating {} segments for {}", segment_paths.len(), aspect_ratio_str);
                    concatenate_videos(&app, &segment_paths, &output_path, effective_intro_path.as_deref(), effective_outro_path.as_deref()).await?;
                    
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

            // Apply rendered text overlays (advanced styling: chat bubbles, gradients, glows)
            if !rendered_text_images.is_empty() {
                println!("[Rust] Applying {} rendered text overlays to {} clip", rendered_text_images.len(), aspect_ratio_str);
                apply_rendered_text_overlays_to_video(
                    &app,
                    &output_path,
                    &rendered_text_images,
                    &aspect_ratio_str,
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
            },
            Err(e) => return Err(format!("Aspect ratio build failed: {}", e)),
        }
    }
    
    println!("[Rust] All {} aspect ratios built successfully in parallel!", total_ratios);

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

    // Emit completion progress
    println!("[Rust] Emitting completion progress event...");
    let result = ClipBuildResult {
        clip_id: clip_id.to_string(),
        project_id: project_id.to_string(),
        success: true,
        output_path: first_output_path,
        all_output_paths: all_output_paths.clone(),
        thumbnail_path: None, // Thumbnail is generated during detection, not build
        duration: clip_duration,
        file_size: Some(total_file_size),
        error: None,
    };

    let _ = app.emit("clip-build-progress", ClipBuildProgress {
        clip_id: clip_id.to_string(),
        project_id: project_id.to_string(),
        progress: 100.0,
        stage: "completed".to_string(),
        message: format!("Built {} clip(s) successfully!", total_ratios),
        error: None,
    });

    println!("[Rust] Built {} clips at: {:?}", total_ratios, all_output_paths);
    Ok(result)
}

