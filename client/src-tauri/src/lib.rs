use tauri::{Emitter, Manager};

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
mod waveform;
mod focal_detection;
mod commands;

// Auto-generated migrations from build.rs
mod migrations {
    include!(concat!(env!("OUT_DIR"), "/migrations_generated.rs"));
}

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("[Rust] Starting Tauri application");
    println!("[Rust] Registering SQL plugin...");

    let mut builder = tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:clippster_v23.db",
                    migrations::get_migrations(),
                )
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init());

    // Initialize updater plugin (desktop only) - must be at builder level for permissions
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|app| {
            println!("[Rust] Application setup complete");
            println!("[Rust] SQL plugin should be registered");

            // Initialize storage directories
            if let Err(e) = storage::init_storage_dirs() {
                eprintln!("[Rust] Warning: Failed to initialize storage directories: {}", e);
            }

            // Start video streaming server in Tauri's async runtime
            let _app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                video_server::start_video_server_impl().await;
            });

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

            // PumpFun commands
            pumpfun::get_pumpfun_clips,
            pumpfun::check_pumpfun_livestream,
            pumpfun::start_livestream_recording,
            pumpfun::stop_livestream_recording,
            pumpfun::stop_all_livestream_recordings,

            // Download commands
            downloads::download_pumpfun_vod,
            downloads::download_pumpfun_vod_segment,
            downloads::download_kick_vod,
            downloads::download_kick_vod_segment,

            // Audio commands
            audio::extract_audio_from_video,
            audio::extract_and_chunk_audio,

            // Waveform commands
            waveform::extract_audio_waveform,
            waveform::get_cached_waveform,
            waveform::save_waveform_to_cache,

            // Storage commands
            storage::get_storage_paths,
            storage::copy_video_to_storage,
            storage::copy_asset_to_storage,
            storage::copy_clip_to_destination,
            storage::delete_asset_file,
            storage::generate_thumbnail,
            storage::generate_thumbnail_at_timestamp,
            storage::save_temp_file,
            storage::read_file_as_data_url,
            storage::delete_video_file,
            storage::get_video_duration,
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

            // Focal detection commands
            detect_focal_points,

            // UI Utils commands
            ui_utils::setup_macos_titlebar,
            ui_utils::get_platform,
            ui_utils::show_main_window,
            
            // File operations
            copy_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}