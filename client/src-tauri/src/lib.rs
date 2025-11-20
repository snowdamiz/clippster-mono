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

// Import items from modules
use downloads::ACTIVE_DOWNLOADS;

// Import all command functions
use commands::*;
use once_cell::sync::Lazy;
use std::sync::{Arc, Mutex};

static CLIP_GENERATION_IN_PROGRESS: Lazy<Arc<Mutex<bool>>> = Lazy::new(|| Arc::new(Mutex::new(false)));

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("[Rust] Starting Tauri application");
    println!("[Rust] Registering SQL plugin...");

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:clippster_v21.db",
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
                    ],
                )
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
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

                    // Show dialog if there are active downloads OR clip generation in progress
                    if active_count > 0 || clip_gen_in_progress {
                        println!(
                            "[Rust] Operations in progress - Downloads: {}, Clip Generation: {}",
                            active_count, clip_gen_in_progress
                        );

                        // Prevent the window from closing immediately
                        api.prevent_close();

                        // Emit event to frontend to show confirmation dialog
                        let _ = app_handle.emit("window-close-requested", active_count);
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

            // PumpFun commands
            pumpfun::get_pumpfun_clips,
            pumpfun::check_pumpfun_livestream,
            pumpfun::start_livestream_recording,
            pumpfun::stop_livestream_recording,

            // Download commands
            downloads::download_pumpfun_vod,
            downloads::download_pumpfun_vod_segment,

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
            storage::delete_asset_file,
            storage::generate_thumbnail,
            storage::save_temp_file,
            storage::read_file_as_data_url,
            storage::delete_video_file,
            storage::get_video_duration,

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
            ui_utils::show_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}