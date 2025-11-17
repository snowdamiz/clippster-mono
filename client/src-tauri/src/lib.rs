use once_cell::sync::Lazy;
use std::sync::{Arc, Mutex};
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

// Import items from modules
use ffmpeg_utils::{
    extract_duration_from_ffmpeg_output,
    parse_video_info_from_ffmpeg_output,
    VideoValidationResult
};

use downloads::{ACTIVE_DOWNLOADS, DOWNLOAD_METADATA};
use video_server::VIDEO_SERVER_PORT;

// Static variables
static CLIP_GENERATION_IN_PROGRESS: Lazy<Arc<Mutex<bool>>> = Lazy::new(|| Arc::new(Mutex::new(false)));

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_video_server_port() -> u16 {
    VIDEO_SERVER_PORT
}

#[tauri::command]
async fn test_download_command(message: String) -> Result<String, String> {
    println!("[Rust] Test command called with message: {}", message);
    Ok(format!("Test command received: {}", message))
}

#[tauri::command]
async fn get_active_downloads_count() -> Result<usize, String> {
    let downloads = ACTIVE_DOWNLOADS.lock().unwrap();
    Ok(downloads.len())
}

#[tauri::command]
async fn cancel_all_downloads() -> Result<Vec<String>, String> {
    use std::fs;

    let mut downloads = ACTIVE_DOWNLOADS.lock().unwrap();
    let download_ids: Vec<String> = downloads.keys().cloned().collect();

    // Get storage paths to clean up partial files
    let paths = match storage::init_storage_dirs() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[Rust] Failed to get storage paths for cleanup: {}", e);
            return Err(format!("Failed to get storage paths: {}", e));
        }
    };

    // Remove partial download files
    let mut cleaned_files = Vec::new();
    for download_id in &download_ids {
        // Look for partial files matching the download ID pattern
        if let Ok(entries) = fs::read_dir(&paths.videos) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                    if filename.contains(download_id) || filename.starts_with("pumpfun_") {
                        if let Err(e) = fs::remove_file(&path) {
                            eprintln!("[Rust] Failed to remove partial file {}: {}", path.display(), e);
                        } else {
                            cleaned_files.push(path.to_string_lossy().to_string());
                            println!("[Rust] Removed partial file: {}", path.display());
                        }
                    }
                }
            }
        }

        // Also clean up partial thumbnails
        if let Ok(entries) = fs::read_dir(&paths.thumbnails) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                    if filename.contains(download_id) {
                        if let Err(e) = fs::remove_file(&path) {
                            eprintln!("[Rust] Failed to remove partial thumbnail {}: {}", path.display(), e);
                        } else {
                            cleaned_files.push(path.to_string_lossy().to_string());
                            println!("[Rust] Removed partial thumbnail: {}", path.display());
                        }
                    }
                }
            }
        }
    }

    // Clear all active downloads
    downloads.clear();
    println!("[Rust] Cancelled {} downloads and cleaned up {} files", download_ids.len(), cleaned_files.len());

    Ok(download_ids)
}

#[tauri::command]
async fn cancel_download(download_id: String) -> Result<bool, String> {
    println!("[Rust] Canceling download: {}", download_id);

    // Since we only allow 1 concurrent download, we can safely kill all FFmpeg processes
    // This is much more reliable than trying to track individual processes
    #[allow(unused_assignments)]
    let mut ffmpeg_killed = false;
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        println!("[Rust] Terminating FFmpeg processes (1 concurrent download limit)");

        match Command::new("taskkill")
            .args(["/F", "/IM", "ffmpeg.exe"])
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    println!("[Rust] Successfully terminated FFmpeg processes");
                    ffmpeg_killed = true;
                } else {
                    println!("[Rust] No FFmpeg processes were running");
                    ffmpeg_killed = false;
                }
            }
            Err(e) => {
                println!("[Rust] Failed to terminate FFmpeg processes: {}", e);
                ffmpeg_killed = false;
            },
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;

        match Command::new("pkill")
            .args(["-f", "ffmpeg"])
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    println!("[Rust] Successfully terminated FFmpeg processes");
                    ffmpeg_killed = true;
                } else {
                    println!("[Rust] No FFmpeg processes were running");
                    ffmpeg_killed = false;
                }
            }
            Err(e) => {
                println!("[Rust] Failed to terminate FFmpeg processes: {}", e);
                ffmpeg_killed = false;
            },
        }
    }

    // Give processes a moment to terminate and release file handles
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Get metadata for cleanup
    let metadata = {
        let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
        metadata_map.remove(&download_id)
    };

    // Clean up files if we have metadata
    if let Some(meta) = metadata {
        println!("[Rust] Cleaning up files for cancelled download: {}", download_id);

        // Remove video file if it exists
        if let Some(video_path) = meta.output_path {
            match std::fs::remove_file(&video_path) {
                Ok(()) => println!("[Rust] Removed partial video file: {}", video_path),
                Err(e) => println!("[Rust] Failed to remove partial video file {}: {}", video_path, e),
            }
        }

        // Remove thumbnail file if it exists
        if let Some(thumbnail_path) = meta.thumbnail_path {
            match std::fs::remove_file(&thumbnail_path) {
                Ok(()) => println!("[Rust] Removed partial thumbnail file: {}", thumbnail_path),
                Err(e) => println!("[Rust] Failed to remove partial thumbnail file {}: {}", thumbnail_path, e),
            }
        }
    }

    // Remove from active downloads
    let mut downloads = ACTIVE_DOWNLOADS.lock().unwrap();
    let was_active = downloads.remove(&download_id).is_some();
    drop(downloads);

    // Consider cancellation successful if:
    // 1. The download was active in our tracking, OR
    // 2. We successfully killed FFmpeg processes (indicates cancellation worked)
    let cancellation_successful = was_active || ffmpeg_killed;

    if was_active {
        println!("[Rust] Successfully cancelled download: {}", download_id);
    } else if ffmpeg_killed {
        println!("[Rust] Download was not active in tracking, but FFmpeg was killed - cancellation successful: {}", download_id);
    } else {
        println!("[Rust] Cancellation attempt failed - download not active and no FFmpeg processes killed: {}", download_id);
    }

    Ok(cancellation_successful)
}

#[tauri::command]
async fn cleanup_completed_download(download_id: String) -> Result<(), String> {
    println!("[Rust] Cleaning up metadata for completed download: {}", download_id);

    // Remove metadata for completed downloads (keep the files)
    let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
    metadata_map.remove(&download_id);

    Ok(())
}

#[tauri::command]
async fn check_file_exists(path: String) -> Result<bool, String> {
    use std::path::Path;
    Ok(Path::new(&path).exists())
}

#[tauri::command]
async fn validate_video_file(app: tauri::AppHandle, file_path: String) -> Result<VideoValidationResult, String> {
    use std::path::Path;
    use tauri_plugin_shell::ShellExt;

    println!("[Rust Validation] validate_video_file called with path: {}", file_path);

    let video_path = Path::new(&file_path);

    // Check if file exists
    if !video_path.exists() {
        return Ok(VideoValidationResult {
            is_valid: false,
            error: Some("Video file does not exist".to_string()),
            duration: None,
            width: None,
            height: None,
            codec: None,
            file_size: None,
        });
    }

    // Check file size (should be greater than 0)
    let metadata = match std::fs::metadata(video_path) {
        Ok(meta) => meta,
        Err(e) => {
            return Ok(VideoValidationResult {
                is_valid: false,
                error: Some(format!("Failed to read file metadata: {}", e)),
                duration: None,
                width: None,
                height: None,
                codec: None,
                file_size: None,
            });
        }
    };

    let file_size = metadata.len();
    if file_size == 0 {
        return Ok(VideoValidationResult {
            is_valid: false,
            error: Some("Video file is empty".to_string()),
            duration: None,
            width: None,
            height: None,
            codec: None,
            file_size: Some(0),
        });
    }

    // Use FFmpeg to validate video file integrity
    let shell = app.shell();

    let output = match shell.sidecar("ffmpeg") {
        Ok(ffmpeg) => {
            match ffmpeg.args([
                "-i", &file_path,
                "-f", "null",
                "-t", "1",  // Only validate first second to be fast
                "-"
            ]).output().await {
                Ok(output) => output,
                Err(e) => {
                    return Ok(VideoValidationResult {
                        is_valid: false,
                        error: Some(format!("Failed to run FFmpeg validation: {}", e)),
                        duration: None,
                        width: None,
                        height: None,
                        codec: None,
                        file_size: Some(file_size),
                    });
                }
            }
        }
        Err(e) => {
            return Ok(VideoValidationResult {
                is_valid: false,
                error: Some(format!("Failed to access FFmpeg: {}", e)),
                duration: None,
                width: None,
                height: None,
                codec: None,
                file_size: Some(file_size),
            });
        }
    };

    // Parse FFmpeg output for analysis
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Check if FFmpeg successfully processed the file
    if !output.status.success() {
        let error_msg = if stderr.contains("Invalid data found") {
            "Video file contains invalid data or corruption"
        } else if stderr.contains("moov atom not found") {
            "Video file is incomplete or corrupted - missing movie atom"
        } else if stderr.contains("Invalid argument") {
            "Video file format is not supported"
        } else if stderr.contains("No such file or directory") {
            "Video file not found"
        } else if stderr.contains("Permission denied") {
            "Permission denied accessing video file"
        } else {
            &format!("FFmpeg validation failed: {}", stderr)
        };

        return Ok(VideoValidationResult {
            is_valid: false,
            error: Some(error_msg.to_string()),
            duration: None,
            width: None,
            height: None,
            codec: None,
            file_size: Some(file_size),
        });
    }

    // Check for critical errors even when exit code is 0
    if stderr.contains("Invalid data found") && stderr.contains("corrupt") {
        return Ok(VideoValidationResult {
            is_valid: false,
            error: Some("Video file contains corruption".to_string()),
            duration: None,
            width: None,
            height: None,
            codec: None,
            file_size: Some(file_size),
        });
    }

    // Try to parse video information (optional - don't fail if we can't parse)
    let duration = extract_duration_from_ffmpeg_output(&stderr);
    let video_info = parse_video_info_from_ffmpeg_output(&stderr);

    match video_info {
        Ok(info) => {
            // Check for reasonable video dimensions
            if info.width == 0 || info.height == 0 {
                return Ok(VideoValidationResult {
                    is_valid: false,
                    error: Some("Invalid video dimensions (0x0)".to_string()),
                    duration,
                    width: Some(info.width),
                    height: Some(info.height),
                    codec: Some(info.codec),
                    file_size: Some(file_size),
                });
            }

            // Video is valid with parsed info
            Ok(VideoValidationResult {
                is_valid: true,
                error: None,
                duration,
                width: Some(info.width),
                height: Some(info.height),
                codec: Some(info.codec),
                file_size: Some(file_size),
            })
        }
        Err(_) => {
            // If we can't parse video info but FFmpeg succeeded, consider it valid
            // This can happen for some video formats or with minimal validation
            println!("[Validation] Could not parse detailed video info, but FFmpeg validation passed");
            Ok(VideoValidationResult {
                is_valid: true,
                error: None,
                duration,
                width: None,
                height: None,
                codec: None,
                file_size: Some(file_size),
            })
        }
    }
}

#[tauri::command]
async fn set_clip_generation_in_progress(in_progress: bool) -> Result<(), String> {
    let mut clip_gen = CLIP_GENERATION_IN_PROGRESS.lock().unwrap();
    *clip_gen = in_progress;
    println!("[Rust] Clip generation in progress set to: {}", in_progress);
    Ok(())
}

#[tauri::command]
async fn is_clip_generation_in_progress() -> Result<bool, String> {
    let clip_gen = CLIP_GENERATION_IN_PROGRESS.lock().unwrap();
    Ok(*clip_gen)
}

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
            greet,
            auth::open_wallet_auth_window,
            auth::open_wallet_payment_window,
            auth::close_auth_window,
            auth::poll_auth_result,
            auth::poll_payment_result,
            get_video_server_port,
            pumpfun::get_pumpfun_clips,
            test_download_command,
            downloads::download_pumpfun_vod,
            downloads::download_pumpfun_vod_segment,
            get_active_downloads_count,
            cancel_all_downloads,
            cancel_download,
            cleanup_completed_download,
            check_file_exists,
            validate_video_file,
            set_clip_generation_in_progress,
            is_clip_generation_in_progress,
            audio::extract_audio_from_video,
            audio::extract_and_chunk_audio,
            waveform::extract_audio_waveform,
            waveform::get_cached_waveform,
            waveform::save_waveform_to_cache,
            storage::get_storage_paths,
            storage::copy_video_to_storage,
            storage::copy_asset_to_storage,
            storage::delete_asset_file,
            assets::upload_asset_async,
            storage::generate_thumbnail,
            storage::save_temp_file,
            storage::read_file_as_data_url,
            storage::delete_video_file,
            storage::get_video_duration,
            clips::build_clip_from_segments,
            clips::cancel_clip_build,
            clips::is_clip_build_active,
            ui_utils::setup_macos_titlebar,
            ui_utils::get_platform,
            ui_utils::show_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
