use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

// Modules
mod storage;
mod ffmpeg_utils;
mod auth;
mod downloads;
mod audio;
mod clips;
mod video_server;
mod assets;
mod ui_utils;
mod pumpfun;
mod kick;
mod twitch;
mod waveform;
mod audio_peaks;
mod focal_detection;
mod commands;
mod sidecar;
mod dvr;
mod hls;
mod video_editor_export;
mod video;
mod clip_extractor_commands;
mod utils;
mod font_commands;

// Import items from modules
use downloads::ACTIVE_DOWNLOADS;

// Import all command functions
use commands::*;
use once_cell::sync::Lazy;
use std::sync::{Arc, Mutex};

static CLIP_GENERATION_IN_PROGRESS: Lazy<Arc<Mutex<bool>>> = Lazy::new(|| Arc::new(Mutex::new(false)));

/// Copy a file from source to destination
#[tauri::command]
async fn copy_file(source: String, destination: String) -> Result<(), String> {
    use std::fs;
    
    println!("[Rust] Copying file from {} to {}", source, destination);
    
    fs::copy(&source, &destination)
        .map_err(|e| format!("Failed to copy file: {}", e))?;
    
    println!("[Rust] File copied successfully");
    Ok(())
}

/// Read video file as bytes for WebCodecs playback
#[tauri::command]
async fn read_video_file(file_path: String) -> Result<Vec<u8>, String> {
    use std::fs;
    
    println!("[Rust] Reading video file: {}", file_path);
    
    let bytes = fs::read(&file_path)
        .map_err(|e| format!("Failed to read video file: {}", e))?;
    
    println!("[Rust] Video file read successfully: {} bytes", bytes.len());
    Ok(bytes)
}

/// Create an always-on-top PIP window with video and controls
#[tauri::command]
async fn create_pip_control_window(app: tauri::AppHandle) -> Result<(), String> {
    // Check if window already exists
    if app.get_webview_window("pip-controls").is_some() {
        // Window exists, just show and focus it
        if let Some(window) = app.get_webview_window("pip-controls") {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    // Create new always-on-top window with video player size (16:9 aspect ratio)
    let window = WebviewWindowBuilder::new(
        &app,
        "pip-controls",
        WebviewUrl::App("/pip-controls".into())
    )
    .title("Stream")
    .inner_size(400.0, 265.0)  // 16:9 video + controls bar
    .min_inner_size(320.0, 220.0)
    .max_inner_size(640.0, 400.0)
    .resizable(true)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(true)
    .build()
    .map_err(|e| format!("Failed to create PIP window: {}", e))?;

    // Position in bottom-right corner
    if let Ok(Some(monitor)) = window.current_monitor() {
        let size = monitor.size();
        let x = size.width as i32 - 420;
        let y = size.height as i32 - 300;
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
    }

    Ok(())
}

/// Close the PIP control window
#[tauri::command]
async fn close_pip_control_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("pip-controls") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Disable Private Network Access (PNA) enforcement in WebView2.
    // Without this, Chromium blocks http://tauri.localhost from fetching
    // http://127.0.0.1:48276 (our local video/HLS server).
    // Must be set BEFORE the WebView2 environment is created.
    #[cfg(target_os = "windows")]
    {
        let existing = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
        let pna_flags = "--disable-features=PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults";
        if !existing.contains("PrivateNetworkAccess") {
            let new_val = if existing.is_empty() {
                pna_flags.to_string()
            } else {
                format!("{} {}", existing, pna_flags)
            };
            std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", &new_val);
        }
    }

    println!("[Rust] Starting Tauri application");
    println!("[Rust] Registering SQL plugin...");

    let db_name = if cfg!(debug_assertions) {
        "sqlite:clippster_v25_dev.db"
    } else {
        "sqlite:clippster_v25.db"
    };

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    db_name,
                    vec![
                        tauri_plugin_sql::Migration {
                            version: 1,
                            description: "initial_schema",
                            sql: include_str!("../migrations/001_initial_schema.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 2,
                            description: "add_raw_video_path",
                            sql: include_str!("../migrations/002_add_raw_video_path.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 3,
                            description: "add_raw_videos_table",
                            sql: include_str!("../migrations/003_add_raw_videos_table.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 4,
                            description: "transcripts_reference_raw_videos",
                            sql: include_str!("../migrations/004_transcripts_reference_raw_videos.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 5,
                            description: "make_project_id_nullable",
                            sql: include_str!("../migrations/005_make_project_id_nullable.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 6,
                            description: "add_original_filename",
                            sql: include_str!("../migrations/006_add_original_filename.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 7,
                            description: "add_thumbnail_path",
                            sql: include_str!("../migrations/007_add_thumbnail_path.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 8,
                            description: "remove_raw_video_path_field",
                            sql: include_str!("../migrations/008_remove_raw_video_path_field.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 9,
                            description: "add_audio_files_table",
                            sql: include_str!("../migrations/009_add_audio_files_table.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 10,
                            description: "add_clip_versioning",
                            sql: include_str!("../migrations/010_add_clip_versioning_fixed.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 11,
                            description: "add_project_thumbnail",
                            sql: include_str!("../migrations/013_add_project_thumbnail.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 12,
                            description: "add_original_project_field",
                            sql: include_str!("../migrations/012_add_original_project_field.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 13,
                            description: "add_clip_segments",
                            sql: include_str!("../migrations/014_add_clip_segments.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 15,
                            description: "add_clip_status",
                            sql: include_str!("../migrations/015_add_clip_status.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 16,
                            description: "add_run_color_to_clip_detection_sessions",
                            sql: include_str!("../migrations/016_add_run_color_to_clip_detection_sessions.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 17,
                            description: "add_waveform_data",
                            sql: include_str!("../migrations/017_add_waveform_data.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 18,
                            description: "drop_waveform_data",
                            sql: include_str!("../migrations/018_drop_waveform_data.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 20,
                            description: "simple_cascade_fix",
                            sql: include_str!("../migrations/020_simple_cascade_fix.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 21,
                            description: "add_chunked_transcripts",
                            sql: include_str!("../migrations/021_add_chunked_transcripts.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 22,
                            description: "add_segment_tracking",
                            sql: include_str!("../migrations/022_add_segment_tracking.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 23,
                            description: "add_intro_outro_thumbnails",
                            sql: include_str!("../migrations/023_add_intro_outro_thumbnails.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 24,
                            description: "add_intro_outro_thumbnail_status",
                            sql: include_str!("../migrations/024_add_intro_outro_thumbnail_status.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 25,
                            description: "add_waveform_caching",
                            sql: include_str!("../migrations/025_add_waveform_caching.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 26,
                            description: "add_clip_build_fields",
                            sql: include_str!("../migrations/026_add_clip_build_fields.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 27,
                            description: "add_focal_points",
                            sql: include_str!("../migrations/027_add_focal_points.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 28,
                            description: "add_custom_subtitle_presets",
                            sql: include_str!("../migrations/028_add_custom_subtitle_presets.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },                        
                        tauri_plugin_sql::Migration {
                            version: 29,
                            description: "add_second_border_to_subtitle_presets",
                            sql: include_str!("../migrations/029_add_second_border_to_subtitle_presets.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 30,
                            description: "add_livestream_monitoring",
                            sql: include_str!("../migrations/030_add_livestream_monitoring.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 31,
                            description: "add_project_to_livestream_sessions",
                            sql: include_str!("../migrations/031_add_project_to_livestream_sessions.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 32,
                            description: "add_virality_score_to_clip_versions",
                            sql: include_str!("../migrations/032_add_virality_score_to_clip_versions.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 33,
                            description: "add_monitored_streamer_thumbnails",
                            sql: include_str!("../migrations/033_add_monitored_streamer_thumbnails.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 34,
                            description: "add_project_parent_id",
                            sql: include_str!("../migrations/034_add_project_parent_id.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 35,
                            description: "add_project_platform",
                            sql: include_str!("../migrations/035_add_project_platform.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 36,
                            description: "add_watermark_images",
                            sql: include_str!("../migrations/036_add_watermark_images.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 37,
                            description: "add_watermark_presets",
                            sql: include_str!("../migrations/037_add_watermark_presets.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 41,
                            description: "fix_clips_cascade_deletion",
                            sql: include_str!("../migrations/041_fix_clips_cascade_deletion.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 42,
                            description: "add_project_name_to_clips",
                            sql: include_str!("../migrations/042_add_project_name_to_clips.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 43,
                            description: "add_clip_builds_table",
                            sql: include_str!("../migrations/043_add_clip_builds_table.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 44,
                            description: "add_creator_profiles",
                            sql: include_str!("../migrations/044_add_creator_profiles.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 45,
                            description: "add_audio_settings",
                            sql: include_str!("../migrations/045_add_audio_settings.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 46,
                            description: "add_speaker_detections",
                            sql: include_str!("../migrations/046_add_speaker_detections.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 47,
                            description: "add_output_paths_to_clip_builds",
                            sql: include_str!("../migrations/047_add_output_paths_to_clip_builds.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 48,
                            description: "add_segment_duration_to_monitored_streamers",
                            sql: include_str!("../migrations/048_add_segment_duration_to_monitored_streamers.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 49,
                            description: "add_highlight_color_to_subtitle_presets",
                            sql: include_str!("../migrations/049_add_highlight_color_to_subtitle_presets.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 50,
                            description: "add_custom_fonts",
                            sql: include_str!("../migrations/050_add_custom_fonts.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 51,
                            description: "add_clip_edits",
                            sql: include_str!("../migrations/051_add_clip_edits.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 52,
                            description: "add_audio_assets",
                            sql: include_str!("../migrations/052_add_audio_assets.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 53,
                            description: "add_per_ratio_configs_to_text_overlays",
                            sql: include_str!("../migrations/053_add_per_ratio_configs_to_text_overlays.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 54,
                            description: "add_preview_height_to_text_overlays",
                            sql: include_str!("../migrations/054_add_preview_height_to_text_overlays.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 55,
                            description: "add_per_ratio_configs_to_stickers",
                            sql: include_str!("../migrations/055_add_per_ratio_configs_to_stickers.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 56,
                            description: "add_image_assets",
                            sql: include_str!("../migrations/056_add_image_assets.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 57,
                            description: "add_clip_watermarks",
                            sql: include_str!("../migrations/057_add_clip_watermarks.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 58,
                            description: "add_video_editor_projects",
                            sql: include_str!("../migrations/058_add_video_editor_projects.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 59,
                            description: "add_video_editor_edits",
                            sql: include_str!("../migrations/059_add_video_editor_edits.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 60,
                            description: "add_user_id_to_tables",
                            sql: include_str!("../migrations/060_add_user_id_to_tables.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 61,
                            description: "add_creator_watermark_position",
                            sql: include_str!("../migrations/061_add_creator_watermark_position.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 62,
                            description: "add_user_id_to_clips_and_raw_videos",
                            sql: include_str!("../migrations/062_add_user_id_to_clips_and_raw_videos.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 63,
                            description: "add_project_watermark_settings",
                            sql: include_str!("../migrations/063_add_project_watermark_settings.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 64,
                            description: "add_preview_url_to_clip_watermarks",
                            sql: include_str!("../migrations/064_add_preview_url_to_clip_watermarks.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 65,
                            description: "add_auto_dvr_to_monitored_streamers",
                            sql: include_str!("../migrations/065_add_auto_dvr_to_monitored_streamers.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 67,
                            description: "add_source_id_to_audio_tracks",
                            sql: include_str!("../migrations/067_add_source_id_to_audio_tracks.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 68,
                            description: "add_audio_extracted_to_sources",
                            sql: include_str!("../migrations/068_add_audio_extracted_to_sources.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 70,
                            description: "add_keyframes_to_clip_watermarks",
                            sql: include_str!("../migrations/070_add_keyframes_to_clip_watermarks.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 71,
                            description: "add_effects_transitions",
                            sql: include_str!("../migrations/071_add_effects_transitions.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 72,
                            description: "add_pan_to_audio_tracks",
                            sql: include_str!("../migrations/072_add_pan_to_audio_tracks.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 73,
                            description: "add_keyframes_to_video_editor_sources",
                            sql: include_str!("../migrations/073_add_keyframes_to_video_editor_sources.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 74,
                            description: "add_platform_to_monitored_streamers",
                            sql: include_str!("../migrations/074_add_platform_to_monitored_streamers.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 75,
                            description: "add_audio_effects",
                            sql: include_str!("../migrations/075_add_audio_effects.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 76,
                            description: "add_source_id_keyframes_to_audio_tracks",
                            sql: include_str!("../migrations/076_add_source_id_keyframes_to_audio_tracks.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 77,
                            description: "add_source_id_keyframes_to_clip_audio_tracks",
                            sql: include_str!("../migrations/077_add_source_id_to_clip_audio_tracks.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 78,
                            description: "add_keyframes_to_video_editor_overlays",
                            sql: include_str!("../migrations/078_add_keyframes_to_video_editor_overlays.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 79,
                            description: "add_creator_profile_to_projects",
                            sql: include_str!("../migrations/079_add_creator_profile_to_projects.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 80,
                            description: "fix_monitored_streamers_unique_constraint",
                            sql: include_str!("../migrations/080_fix_monitored_streamers_unique_constraint.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 81,
                            description: "add_audio_peaks_to_segments",
                            sql: include_str!("../migrations/081_add_audio_peaks_to_segments.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 82,
                            description: "add_opencut_editor_projects",
                            sql: include_str!("../migrations/082_add_opencut_editor_projects.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 83,
                            description: "add_vod_presets",
                            sql: include_str!("../migrations/083_add_vod_presets.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 84,
                            description: "add_global_branding_profiles",
                            sql: include_str!("../migrations/084_add_global_branding_profiles.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 85,
                            description: "add_campaign_id_to_clips",
                            sql: include_str!("../migrations/085_add_campaign_id_to_clips.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 86,
                            description: "add_source_start_time_to_audio_tracks",
                            sql: include_str!("../migrations/081_add_source_start_time_to_audio_tracks.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 87,
                            description: "add_transcript_raw_json_to_clip_segments",
                            sql: include_str!("../migrations/083_add_transcript_raw_json_to_clip_segments.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 88,
                            description: "add_layer_to_editor_tables",
                            sql: include_str!("../migrations/088_add_layer_to_editor_tables.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 89,
                            description: "add_project_media",
                            sql: include_str!("../migrations/069_add_project_media.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 90,
                            description: "fix_monitored_streamers_user_unique",
                            sql: include_str!("../migrations/090_fix_monitored_streamers_user_unique.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                    ],
                )
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // OTA Updates - required for automatic app updates
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(video::VideoFrameState::new()) // Re-enabled VideoFrameState manage initialization
        .setup(|app| {
            println!("[Rust] Application setup complete");
            println!("[Rust] SQL plugin should be registered");

            // Start video streaming server in Tauri's async runtime
            let _app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                video_server::start_video_server_impl().await;
            });

            // Enable devtools in production for debugging
            #[cfg(feature = "devtools")]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            // Setup window close handler
            let app_handle = app.handle().clone();
            let window = app.get_webview_window("main").unwrap();

            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    println!("[Rust] Window close requested");

                    // Check if there are active downloads
                    let active_count = {
                        let downloads = ACTIVE_DOWNLOADS.lock().unwrap();
                        downloads.len()
                    };

                    // Check if clip generation is in progress
                    let clip_gen_in_progress = {
                        let clip_gen = CLIP_GENERATION_IN_PROGRESS.lock().unwrap();
                        *clip_gen
                    };

                    // Check if there are active recordings
                    let recording_count = pumpfun::get_active_recordings_count();

                    // Show dialog if there are active downloads OR clip generation in progress OR active recordings
                    if active_count > 0 || clip_gen_in_progress || recording_count > 0 {
                        println!(
                            "[Rust] Operations in progress - Downloads: {}, Recordings: {}, Clip Generation: {}",
                            active_count, recording_count, clip_gen_in_progress
                        );

                        // Prevent the window from closing immediately
                        api.prevent_close();

                        // Emit event to frontend to show confirmation dialog
                        // We send the total count of background operations
                        let _ = app_handle.emit("window-close-requested", active_count + recording_count);
                    } else {
                        println!("[Rust] No active operations, allowing close");
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // System commands
            greet,
            get_video_server_port,
            test_download_command,
            get_active_downloads_count,
            set_clip_generation_in_progress,
            is_clip_generation_in_progress,

// Download management commands
cancel_all_downloads,
cancel_download,
cleanup_completed_download,

// File operations commands
check_file_exists,
validate_video_file,
generate_proxy_file,

// File utility commands
commands::file_utils::get_file_info,
commands::file_utils::get_media_metadata,
commands::file_utils::generate_video_thumbnail,

// Auth commands
            auth::open_wallet_auth_window,
            auth::open_wallet_payment_window,
            auth::close_auth_window,
            auth::poll_auth_result,
            auth::poll_payment_result,
            auth::open_google_auth_window,
            auth::poll_google_auth_result,
            auth::open_stripe_payment_window,
            auth::poll_stripe_payment_result,
            auth::start_email_verification_listener,
            auth::poll_email_verification_result,
            auth::open_instagram_auth_window,
            auth::poll_instagram_auth_result,
            auth::start_user_instagram_oauth,
            auth::open_twitter_auth_window,
            auth::poll_twitter_auth_result,
            auth::start_user_twitter_oauth,

            // PumpFun commands
            pumpfun::get_pumpfun_clips,
            pumpfun::check_pumpfun_livestream,
            pumpfun::join_pumpfun_livestream,
            pumpfun::get_livekit_regions,
            pumpfun::start_livestream_recording,
            pumpfun::stop_livestream_recording,
            pumpfun::stop_all_livestream_recordings,

            // Kick commands
            kick::check_kick_livestream,
            kick::get_kick_stream_url,
            kick::check_ytdlp_available,
            kick::get_ytdlp_version,
            kick::start_kick_recording,
            kick::stop_kick_recording,
            kick::stop_all_kick_recordings,
            kick::get_kick_session_output_dir,
            kick::get_active_kick_recordings,

            // Twitch commands
            twitch::check_twitch_livestream,
            twitch::get_twitch_vods,
            twitch::start_twitch_recording,
            twitch::stop_twitch_recording,
            twitch::stop_all_twitch_recordings,
            twitch::get_twitch_session_output_dir,
            twitch::get_active_twitch_recordings,

            // Download commands
            downloads::download_pumpfun_vod,
            downloads::download_pumpfun_vod_segment,
            downloads::download_kick_vod,
            downloads::download_kick_vod_segment,
            twitch::download_twitch_vod,
            twitch::download_twitch_vod_segment,

            // Audio commands
            audio::extract_audio_from_video,
            audio::extract_and_chunk_audio,
            audio::extract_audio_to_file,
            audio::get_audio_duration,

            // Waveform commands
            waveform::extract_audio_waveform,
            waveform::get_cached_waveform,
            waveform::save_waveform_to_cache,
            waveform::clear_waveform_cache,
            waveform::extract_audio_peaks_for_range,

            // Audio peaks detection commands
            audio_peaks::detect_audio_peaks,

            // Storage commands
            storage::get_storage_paths,
            storage::copy_video_to_storage,
            storage::copy_asset_to_storage,
            storage::copy_clip_to_destination,
            storage::delete_asset_file,
            storage::generate_thumbnail,
            storage::generate_thumbnail_at_timestamp,
            storage::save_temp_file,
            storage::save_editor_media_file,
            storage::read_file_as_data_url,
            storage::delete_video_file,
            storage::delete_raw_video_files,
            storage::get_video_duration,
            storage::get_video_metadata,
            storage::get_audio_metadata,
            storage::get_image_metadata,
            storage::copy_watermark_to_storage,
            storage::delete_watermark_file,
            storage::merge_video_segments,
            storage::copy_font_to_storage,
            storage::delete_font_file,
            storage::copy_audio_to_storage,
            storage::delete_audio_file,
            storage::copy_image_to_storage,
            storage::delete_image_file,
            storage::save_org_asset_file,
            storage::download_org_asset_from_url,
            // User context for per-user storage
            storage::set_current_user_id,
            storage::clear_current_user_id,

            // Assets commands
            assets::upload_asset_async,

            // Clips commands
            clips::build_clip_from_segments,
            clips::cancel_clip_build,
            clips::is_clip_build_active,
            clips::livestream_clip::extract_livestream_clip,
            clips::video_processor::generate_segment_preview,
            clips::video_processor::delete_segment_preview,
            clips::video_processor::generate_preview_chunk,
            clips::video_processor::write_preview_manifest,
            clips::video_processor::delete_preview_cache,
            clips::video_processor::get_preview_cache_path,

            // Focal detection commands
            detect_focal_points,

            // UI Utils commands
            ui_utils::setup_macos_titlebar,
            ui_utils::get_platform,
            ui_utils::show_main_window,
            
            // File operations
            copy_file,
            read_video_file,

    // PIP control window commands
    create_pip_control_window,
    close_pip_control_window,

    // DVR commands
    dvr::save_dvr_chunk,
    dvr::get_dvr_chunk_path,
    dvr::cleanup_dvr_chunks,
    dvr::list_dvr_chunks,
    dvr::get_dvr_directory,
    dvr::has_dvr_chunks,
    dvr::read_all_dvr_chunks,
    dvr::read_dvr_chunk,
    dvr::read_dvr_init_segment,
    dvr::read_dvr_cluster,
    dvr::build_vod_from_dvr,
    dvr::build_segment_from_dvr_chunks,

    // HLS commands
    hls::start_hls_recording,
    hls::stop_hls_recording,
    hls::cleanup_hls_recordings,
    hls::get_recording_output_dir,
    hls::get_hls_segments,

// Video Editor Export commands
video_editor_export::export_video_editor_project_simple,
video_editor_export::export_video_editor_project,
video_editor_export::save_text_overlay_png,

// Video Frame Decoder commands
video::get_video_frame,
video::get_video_frame_with_dimensions,
video::prefetch_video_frames,
video::clear_video_decoder,
video::clear_all_video_decoders,
video::clear_frame_cache,
video::get_frame_cache_stats,
video::get_decoder_info,

// Clip Extractor commands
clip_extractor_commands::extract_clip,
clip_extractor_commands::generate_clip_thumbnail,
clip_extractor_commands::generate_waveform,
clip_extractor_commands::delete_file,
clip_extractor_commands::file_exists,

// Font commands
font_commands::read_font_file,
font_commands::read_bundled_font,
font_commands::copy_font_to_app_data,
font_commands::list_custom_fonts,
font_commands::resolve_font_path,

// Remotion export commands
remotion_export::start_remotion_export,
remotion_export::cancel_remotion_export,
remotion_export::stop_remotion_sidecar,

])
.manage(remotion_export::SidecarState::new())
.run(tauri::generate_context!())
.expect("error while running tauri application");
} 