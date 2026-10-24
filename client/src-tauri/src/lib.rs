#[macro_use]
mod native_commands;

macro_rules! register_native_commands {
    ($($command:path),* $(,)?) => { tauri::generate_handler![$($command),*] };
}

use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

// Modules
mod api;
mod assets;
mod audio;
mod audio_download;
mod audio_peaks;
mod auth;
mod avatar_proxy;
mod clip_extractor_commands;
mod clips;
mod commands;
mod downloads;
mod dvr;
mod ffmpeg_sidecar;
mod ffmpeg_utils;
mod focal_detection;
mod font_commands;
mod path_utils;
mod hls;
mod hls_proxy;
mod kick;
#[cfg(not(dev))]
mod native_acl;
mod pumpfun;
mod rumble;
mod sidecar;
mod storage;
mod stripe_callback;
mod studio;
mod thumbnail_utils;
mod twitch;
mod twitter;
mod ui_utils;
mod utils;
mod video;
mod video_chunk_extraction;
mod video_editor_export;
mod video_server;
mod waveform;
mod youtube;

// Import items from modules
use downloads::ACTIVE_DOWNLOADS;

// Import all command functions
use commands::*;
use once_cell::sync::Lazy;
use std::sync::Mutex;

/// Stores the localhost plugin port for production builds so child windows (PIP) can use the same origin
#[allow(dead_code)]
static LOCALHOST_PORT: Lazy<Mutex<Option<u16>>> = Lazy::new(|| Mutex::new(None));

/// Copy a file from source to destination
#[tauri::command]
async fn copy_file(source: String, destination: String) -> Result<(), String> {
    use std::fs;

    println!("[Rust] Copying file from {} to {}", source, destination);

    fs::copy(&source, &destination).map_err(|e| format!("Failed to copy file: {}", e))?;

    println!("[Rust] File copied successfully");
    Ok(())
}

/// Read video file as bytes for WebCodecs playback
#[tauri::command]
async fn read_video_file(file_path: String) -> Result<Vec<u8>, String> {
    use std::fs;

    println!("[Rust] Reading video file: {}", file_path);

    let bytes = fs::read(&file_path).map_err(|e| format!("Failed to read video file: {}", e))?;

    println!("[Rust] Video file read successfully: {} bytes", bytes.len());
    Ok(bytes)
}

/// Save uploaded POI region media to a temp file (real path for FFmpeg export).
#[tauri::command]
async fn save_temp_media_file(file_name: String, data: Vec<u8>) -> Result<String, String> {
    use std::fs;

    let temp_dir = std::env::temp_dir().join("clippster_media");
    fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();

    let safe_name = std::path::Path::new(&file_name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("upload.bin");

    let unique_name = format!("{}_{}", timestamp, safe_name);
    let file_path = temp_dir.join(&unique_name);

    fs::write(&file_path, &data).map_err(|e| format!("Failed to write temp media: {}", e))?;

    let path_str = file_path.to_string_lossy().to_string();
    println!("[Rust] Saved temp media file: {}", path_str);
    Ok(path_str)
}

/// Create an always-on-top PIP window with video and controls
#[tauri::command]
async fn create_pip_control_window(app: tauri::AppHandle) -> Result<(), String> {
    // Check if window already exists
    if app.get_webview_window("pip-controls").is_some() {
        // Window exists, just show and focus it
        if let Some(window) = app.get_webview_window("pip-controls") {
            window.show().map_err(|e| e.to_string())?;
            // Do NOT call set_focus() — stealing focus from a fullscreen game
            // causes it to minimize. The window is already TOPMOST so it's visible.
        }
        return Ok(());
    }

    // In production, the PIP window MUST use the same WebviewUrl::External origin as the main window.
    // WebviewUrl::App resolves to https://tauri.localhost in production, which uses a custom protocol
    // that causes WebView2's compositor to not properly maintain HWND_TOPMOST z-order over fullscreen games.
    // In dev mode, WebviewUrl::App resolves to the Vite dev server (http://localhost:1420) which works fine.
    #[cfg(dev)]
    let pip_url = WebviewUrl::App("/pip-controls".into());

    #[cfg(not(dev))]
    let pip_url = {
        let port = LOCALHOST_PORT.lock().unwrap();
        match *port {
            Some(p) => {
                let url_str = format!("http://localhost:{}/pip-controls", p);
                println!("[Rust] PIP window using localhost URL: {}", url_str);
                WebviewUrl::External(url_str.parse().unwrap())
            }
            None => {
                println!(
                    "[Rust] WARNING: No localhost port stored, falling back to WebviewUrl::App"
                );
                WebviewUrl::App("/pip-controls".into())
            }
        }
    };

    // Create new always-on-top window - initial size is a reasonable default;
    // the frontend will detect the video's actual aspect ratio and resize accordingly.
    let window = WebviewWindowBuilder::new(&app, "pip-controls", pip_url)
        .title("Stream")
        .inner_size(480.0, 270.0)
        .min_inner_size(240.0, 135.0)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
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

    // Windows-specific: Force window to stay on top even over fullscreen games
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{
            GetWindowLongPtrW, IsWindow, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE,
            HWND_TOPMOST, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW,
            WINDOW_EX_STYLE, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
        };

        if let Ok(hwnd) = window.hwnd() {
            let hwnd = HWND(hwnd.0 as *mut core::ffi::c_void);

            unsafe {
                // Step 1: Get current extended window styles
                let current_ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);

                // Step 2: Add WS_EX_TOPMOST, WS_EX_LAYERED, WS_EX_TOOLWINDOW, and WS_EX_NOACTIVATE flags
                // WS_EX_TOOLWINDOW prevents the window from appearing in the taskbar
                // WS_EX_NOACTIVATE prevents the window from stealing focus when clicked,
                // which is critical — stealing focus from an exclusive fullscreen game
                // causes Windows to minimize the game
                let new_ex_style = WINDOW_EX_STYLE(current_ex_style as u32)
                    | WS_EX_TOPMOST
                    | WS_EX_LAYERED
                    | WS_EX_TOOLWINDOW
                    | WS_EX_NOACTIVATE;
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_ex_style.0 as isize);

                // Step 3: Apply HWND_TOPMOST with SWP_FRAMECHANGED to force style update
                let _ = SetWindowPos(
                    hwnd,
                    HWND_TOPMOST,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW | SWP_NOACTIVATE | SWP_FRAMECHANGED,
                );

                // Note: Do NOT call BringWindowToTop — it steals focus from the
                // foreground window (the game), causing exclusive fullscreen games to minimize.
                // HWND_TOPMOST via SetWindowPos with SWP_NOACTIVATE is sufficient.

                // Step 4: Subclass the window to intercept WM_WINDOWPOSCHANGING for aspect ratio lock.
                // WM_WINDOWPOSCHANGING is more reliable than WM_SIZING because it fires for ALL
                // size changes (user drag, SetWindowPos calls, aero snap, etc.) and is processed
                // before the window is actually resized. tao's own borderless resize handling
                // uses WM_NCHITTEST which may interfere with WM_SIZING subclass ordering.
                use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
                use windows::Win32::UI::Shell::{DefSubclassProc, SetWindowSubclass};

                const WM_WINDOWPOSCHANGING: u32 = 0x0046;
                const SWP_NOSIZE_RAW: u32 = 0x0001;

                #[repr(C)]
                struct WINDOWPOS_RAW {
                    hwnd: HWND,
                    hwnd_insert_after: HWND,
                    x: i32,
                    y: i32,
                    cx: i32,
                    cy: i32,
                    flags: u32,
                }

                // dwRefData stores the aspect ratio as ratio_w << 16 | ratio_h
                // 16:9 → ratio_w=16, ratio_h=9
                let aspect_data: usize = (16 << 16) | 9;

                unsafe extern "system" fn pip_aspect_subclass(
                    hwnd: HWND,
                    umsg: u32,
                    wparam: WPARAM,
                    lparam: LPARAM,
                    _uidsubclass: usize,
                    dwrefdata: usize,
                ) -> LRESULT {
                    if umsg == WM_WINDOWPOSCHANGING && lparam.0 != 0 {
                        let pos = &mut *(lparam.0 as *mut WINDOWPOS_RAW);

                        // Skip if size isn't changing
                        if (pos.flags & SWP_NOSIZE_RAW) != 0 {
                            return DefSubclassProc(hwnd, umsg, wparam, lparam);
                        }

                        let ratio_w = (dwrefdata >> 16) as i32; // 16
                        let ratio_h = (dwrefdata & 0xFFFF) as i32; // 9

                        // Minimum size
                        let min_w = 240;
                        let min_h = (min_w * ratio_h) / ratio_w; // 135

                        if pos.cx < min_w {
                            pos.cx = min_w;
                        }
                        if pos.cy < min_h {
                            pos.cy = min_h;
                        }

                        // Enforce 16:9: width is authoritative, adjust height to match.
                        // This means the window can ONLY be uniformly scaled — exactly
                        // like taking a 16:9 video and making it bigger or smaller.
                        let correct_height = (pos.cx * ratio_h) / ratio_w;
                        pos.cy = correct_height;

                        // Re-enforce minimum after correction
                        if pos.cy < min_h {
                            pos.cy = min_h;
                            pos.cx = (pos.cy * ratio_w) / ratio_h;
                        }
                    }

                    DefSubclassProc(hwnd, umsg, wparam, lparam)
                }

                let _ = SetWindowSubclass(hwnd, Some(pip_aspect_subclass), 1, aspect_data);
            }

            // Step 5: Spawn a background timer that periodically re-asserts HWND_TOPMOST.
            // Fullscreen games (both exclusive and borderless) can cause the DWM to demote
            // our topmost z-order when the game window gains focus. Professional overlay tools
            // (Discord, Medal, OBS) use periodic re-assertion to survive this.
            // The timer runs every 500ms and stops automatically when the PIP window is closed.
            let hwnd_raw = hwnd.0 as isize;
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(500));

                    unsafe {
                        let hwnd = HWND(hwnd_raw as *mut core::ffi::c_void);

                        // Stop the timer if the window has been destroyed
                        if !IsWindow(hwnd).as_bool() {
                            println!("[Rust] PIP topmost timer: window destroyed, stopping");
                            break;
                        }

                        // Re-assert HWND_TOPMOST without activating or moving the window
                        let _ = SetWindowPos(
                            hwnd,
                            HWND_TOPMOST,
                            0,
                            0,
                            0,
                            0,
                            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                        );
                    }
                }
            });
        }
    }

    // macOS-specific: Set window collection behavior to appear over fullscreen apps
    #[cfg(target_os = "macos")]
    {
        use objc::runtime::Object;
        use objc::{msg_send, sel, sel_impl};

        if let Ok(ns_window) = window.ns_window() {
            unsafe {
                let ns_window = ns_window as *mut Object;
                // NSWindowCollectionBehaviorCanJoinAllSpaces (1 << 0) = 1
                // NSWindowCollectionBehaviorFullScreenAuxiliary (1 << 8) = 256
                // Combined: allows window to appear in all Spaces and over fullscreen apps
                let behavior: usize = 1 | 256;
                let _: () = msg_send![ns_window, setCollectionBehavior: behavior];
            }
        }
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
                            sql: include_str!("../migrations/091_add_source_start_time_to_audio_tracks.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 87,
                            description: "add_transcript_raw_json_to_clip_segments",
                            sql: include_str!("../migrations/092_add_transcript_raw_json_to_clip_segments.sql"),
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
                            sql: include_str!("../migrations/089_add_project_media.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 90,
                            description: "fix_monitored_streamers_user_unique",
                            sql: include_str!("../migrations/090_fix_monitored_streamers_user_unique.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 91,
                            description: "add_source_start_time_to_audio_tracks",
                            sql: include_str!("../migrations/091_add_source_start_time_to_audio_tracks.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 94,
                            description: "remove_users_fk_from_project_media",
                            sql: include_str!("../migrations/094_remove_users_fk_from_project_media.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 95,
                            description: "add_clip_text_overlay_to_clips",
                            sql: include_str!("../migrations/099_add_clip_text_overlay_to_clips.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 100,
                            description: "add_persistent_live_monitoring",
                            sql: include_str!("../migrations/100_add_persistent_live_monitoring.sql"),
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
        // Localhost plugin - serves frontend from http://localhost in production to bypass LNA
        .manage(video::VideoFrameState::new()) // Re-enabled VideoFrameState manage initialization
        .manage(std::sync::Mutex::new(studio::recorder::StudioRecorderState::default()))
        .setup(|app| {
            // Release builds have no console, so a panic would otherwise close the app silently.
            if let Ok(dir) = app.path().app_data_dir() {
                let crash_log = dir.join("crash.log");
                let app_version = app.package_info().version.to_string();
                let default_hook = std::panic::take_hook();
                std::panic::set_hook(Box::new(move |info| {
                    use std::io::Write;
                    let ts = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_secs())
                        .unwrap_or(0);
                    let thread = std::thread::current();
                    let backtrace = std::backtrace::Backtrace::force_capture();
                    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&crash_log) {
                        let _ = writeln!(
                            f,
                            "[{ts}] v{app_version} panic on thread '{}': {info}\n{backtrace}\n",
                            thread.name().unwrap_or("<unnamed>"),
                        );
                    }
                    default_hook(info);
                }));
            }

            println!("[Rust] Application setup complete");
            println!("[Rust] SQL plugin should be registered");

            // Start video streaming server in Tauri's async runtime
            let _app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                video_server::start_video_server_impl().await;
            });

            // Create main window programmatically (required for localhost plugin)
            // In dev mode, use the default devUrl from tauri.conf.json
            // In production, serve from localhost to bypass LNA restrictions
            #[cfg(dev)]
            let url = WebviewUrl::App("/".into());
            
            #[cfg(not(dev))]
            let url = {
                // Persist the localhost port across restarts so localStorage (auth tokens, etc.)
                // survives. On first launch we pick a random port and save it. On subsequent
                // launches we reuse that port. If it's occupied we pick a new one and save it.
                let port_file = app.handle()
                    .path()
                    .app_data_dir()
                    .expect("failed to resolve app data dir")
                    .join("localhost_port");
                
                // Try to read previously saved port
                let saved_port: Option<u16> = std::fs::read_to_string(&port_file)
                    .ok()
                    .and_then(|s| s.trim().parse().ok());
                
                // Check if a port is available by trying to bind to it
                fn is_port_available(port: u16) -> bool {
                    std::net::TcpListener::bind(("127.0.0.1", port)).is_ok()
                }
                
                let port = if let Some(p) = saved_port {
                    if is_port_available(p) {
                        println!("[Rust] Reusing saved localhost port: {}", p);
                        p
                    } else {
                        println!("[Rust] Saved port {} is occupied, picking new one", p);
                        let new_port = portpicker::pick_unused_port().expect("failed to find unused port");
                        println!("[Rust] New port selected: {}", new_port);
                        new_port
                    }
                } else {
                    let new_port = portpicker::pick_unused_port().expect("failed to find unused port");
                    println!("[Rust] First launch, selected port: {}", new_port);
                    new_port
                };
                
                // Save port for next launch
                if let Some(parent) = port_file.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let _ = std::fs::write(&port_file, port.to_string());
                
                app.handle().plugin(tauri_plugin_localhost::Builder::new(port).build())
                    .expect("failed to initialize localhost plugin");

                native_acl::register_production_capabilities(app.handle(), port)?;
                
                // Store the port so child windows (PIP) can use the same origin
                {
                    let mut stored_port = LOCALHOST_PORT.lock().unwrap();
                    *stored_port = Some(port);
                }
                
                let url_str = format!("http://localhost:{}", port);
                println!("[Rust] Production mode: serving frontend from {}", url_str);
                WebviewUrl::External(url_str.parse().unwrap())
            };

            // 13-inch MacBook friendly startup size when no prior state exists.
            const DEFAULT_MAIN_WINDOW_WIDTH: f64 = 1120.0;
            const DEFAULT_MAIN_WINDOW_HEIGHT: f64 = 680.0;

            let saved_state = ui_utils::load_window_state(app.handle())
                .map_err(|e| println!("[Rust] Failed to load window state: {}", e))
                .ok()
                .flatten();

            let (width, height) = match &saved_state {
                Some(s) if s.width >= 800.0 && s.height >= 600.0 => {
                    println!("[Rust] Restoring window size: {}x{}", s.width, s.height);
                    (s.width, s.height)
                }
                _ => (DEFAULT_MAIN_WINDOW_WIDTH, DEFAULT_MAIN_WINDOW_HEIGHT),
            };

            let saved_position = saved_state.as_ref().and_then(|s| match (s.x, s.y) {
                (Some(x), Some(y)) if ui_utils::is_position_on_screen(app.handle(), x, y) => {
                    Some(tauri::PhysicalPosition { x, y })
                }
                _ => None,
            });

            // Built hidden so a restored position/maximize is applied before the first frame;
            // shown unconditionally below, independent of frontend initialization.
            let mut builder = WebviewWindowBuilder::new(app, "main", url)
                .title("Clippster")
                .inner_size(width, height)
                .min_inner_size(800.0, 600.0)
                .decorations(false)
                .transparent(true)
                .visible(false);
            if saved_position.is_none() {
                builder = builder.center().prevent_overflow();
            }
            let window = builder.build().expect("failed to create main window");

            if let Some(position) = saved_position {
                println!("[Rust] Restoring window position: {},{}", position.x, position.y);
                let _ = window.set_position(tauri::Position::Physical(position));
            }
            if saved_state.as_ref().is_some_and(|s| s.maximized) {
                let _ = window.maximize();
            }
            window.show().expect("failed to show main window");

            // Enable devtools in production for debugging
            #[cfg(feature = "devtools")]
            {
                window.open_devtools();
            }

            // Setup window close handler
            let app_handle = app.handle().clone();

            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    println!("[Rust] Window close requested");

                    // Check if there are active downloads
                    let active_count = {
                        let downloads = ACTIVE_DOWNLOADS.lock().unwrap();
                        downloads.len()
                    };

                    // Check if clip generation is in progress (set from the frontend)
                    let clip_gen_in_progress = commands::system::clip_generation_in_progress();

                    // Check if there are active recordings
                    let recording_count = pumpfun::get_active_recordings_count();

                    // Check if a screen has unsaved edits (set from the frontend)
                    let unsaved_changes = commands::system::has_unsaved_changes();

                    // Show dialog if anything would be lost, unless the user already confirmed quitting
                    if !commands::system::close_confirmed()
                        && (active_count > 0 || clip_gen_in_progress || recording_count > 0 || unsaved_changes)
                    {
                        println!(
                            "[Rust] Operations in progress - Downloads: {}, Recordings: {}, Clip Generation: {}, Unsaved changes: {}",
                            active_count, recording_count, clip_gen_in_progress, unsaved_changes
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
        .invoke_handler(with_native_commands!(register_native_commands))
.manage(commands::hyperframes::HyperframesState::default())
.manage(commands::reference_video::ReferenceAnalysisState::default())
.run(tauri::generate_context!())
.expect("error while running tauri application");
}
