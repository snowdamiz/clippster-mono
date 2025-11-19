// Module declarations
mod types;
mod encoder;
mod font_manager;
mod thumbnail;
mod video_info;
mod subtitle;
mod video_processor;
mod orchestrator;

// Re-export public types
pub use types::*;

// Internal imports
use once_cell::sync::Lazy;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::Emitter;
use orchestrator::build_clip_internal_simple;

// Active clip builds tracking
static ACTIVE_CLIP_BUILDS: Lazy<Arc<Mutex<HashMap<String, bool>>>> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Build clip from segments using FFmpeg
#[tauri::command]
pub async fn build_clip_from_segments(
    app: tauri::AppHandle,
    project_id: String,
    clip_id: String,
    clip_name: String,
    video_path: String,
    segments: Vec<serde_json::Value>,
    subtitle_settings: Option<SubtitleSettings>,
    transcript_words: Option<Vec<WordInfo>>,
    transcript_segments: Option<Vec<WhisperSegment>>,
    max_words: Option<usize>,
    aspect_ratios: Vec<String>,
    quality: String,
    frame_rate: u32,
    output_format: String,
    run_number: Option<u32>,
    intro_path: Option<String>,
    intro_duration: Option<f64>,
    outro_path: Option<String>,
    outro_duration: Option<f64>
) -> Result<(), String> {

    println!("[Rust] build_clip_from_segments called with:");
    println!("[Rust]   project_id: {}", project_id);
    println!("[Rust]   clip_id: {}", clip_id);
    println!("[Rust]   clip_name: {}", clip_name);
    println!("[Rust]   video_path: {}", video_path);
    println!("[Rust]   segments count: {}", segments.len());
    println!("[Rust]   subtitles enabled: {}", subtitle_settings.as_ref().map(|s| s.enabled).unwrap_or(false));
    println!("[Rust]   max words: {}", max_words.unwrap_or(0));
    println!("[Rust]   aspect_ratios: {:?}", aspect_ratios);
    println!("[Rust]   quality: {}", quality);
    println!("[Rust]   frame_rate: {}", frame_rate);
    println!("[Rust]   output_format: {}", output_format);
    println!("[Rust]   run_number: {:?}", run_number);
    println!("[Rust]   intro_path: {:?}", intro_path);
    println!("[Rust]   outro_path: {:?}", outro_path);

    // Check if clip is already being built
    {
        let mut active_builds = ACTIVE_CLIP_BUILDS.lock().unwrap();
        if active_builds.contains_key(&clip_id) {
            return Err(format!("Clip {} is already being built", clip_id));
        }
        active_builds.insert(clip_id.clone(), true);
    }

    // Clone app handle for use in async block
    let app_clone = app.clone();
    let clip_id_clone = clip_id.clone();
    let clip_name_clone = clip_name.clone();
    let project_id_clone = project_id.clone();
    let video_path_clone = video_path.clone();
    let segments_clone = segments.clone();
    let subtitle_settings_clone = subtitle_settings.clone();
    let transcript_words_clone = transcript_words.clone();
    let transcript_segments_clone = transcript_segments.clone();
    let aspect_ratios_clone = aspect_ratios.clone();
    let quality_clone = quality.clone();
    let output_format_clone = output_format.clone();
    let intro_path_clone = intro_path.clone();
    let outro_path_clone = outro_path.clone();

    // Send initial progress
    let _ = app.emit("clip-build-progress", ClipBuildProgress {
        clip_id: clip_id.clone(),
        project_id: project_id.clone(),
        progress: 0.0,
        stage: "initializing".to_string(),
        message: "Starting clip build...".to_string(),
        error: None,
    });

    // Use tokio::spawn for background processing (following the download pattern)
    let _ = tokio::spawn(async move {
        println!("[Rust] Async task started for clip build: {}", clip_id_clone);

        let build_result = match build_clip_internal_simple(
            &app_clone,
            &project_id_clone,
            &clip_id_clone,
            &clip_name_clone,
            &video_path_clone,
            &segments_clone,
            subtitle_settings_clone,
            transcript_words_clone,
            transcript_segments_clone,
            max_words,
            &aspect_ratios_clone,
            &quality_clone,
            frame_rate,
            &output_format_clone,
            run_number,
            intro_path_clone.as_deref(),
            intro_duration,
            outro_path_clone.as_deref(),
            outro_duration
        ).await {
            Ok(result) => {
                println!("[Rust] Clip build completed successfully for: {}", clip_id_clone);
                result
            },
            Err(e) => {
                println!("[Rust] Clip build failed with error: {}", e);
                ClipBuildResult {
                    clip_id: clip_id_clone.clone(),
                    project_id: project_id_clone.clone(),
                    success: false,
                    output_path: None,
                    thumbnail_path: None,
                    duration: None,
                    file_size: None,
                    error: Some(e),
                }
            }
        };

        // Clean up active build tracking
        {
            let mut active_builds = ACTIVE_CLIP_BUILDS.lock().unwrap();
            active_builds.remove(&clip_id_clone);
            println!("[Rust] Removed from active builds: {}", clip_id_clone);
        }

        // Emit completion event
        println!("[Rust] About to emit clip-build-complete event...");
        let emit_result = app_clone.emit("clip-build-complete", &build_result);
        match emit_result {
            Ok(_) => println!("[Rust] clip-build-complete event emitted successfully"),
            Err(e) => println!("[Rust] Failed to emit clip-build-complete event: {}", e),
        }
    });

    Ok(())
}

// Cancel clip build
#[tauri::command]
pub async fn cancel_clip_build(clip_id: String) -> Result<bool, String> {
    println!("[Rust] Canceling clip build: {}", clip_id);
    let mut active_builds = ACTIVE_CLIP_BUILDS.lock().unwrap();
    if active_builds.remove(&clip_id).is_some() {
        Ok(true)
    } else {
        Ok(false)
    }
}

// Check if clip build is active
#[tauri::command]
pub async fn is_clip_build_active(clip_id: String) -> Result<bool, String> {
    let active_builds = ACTIVE_CLIP_BUILDS.lock().unwrap();
    Ok(active_builds.contains_key(&clip_id))
}
