use once_cell::sync::Lazy;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

// Background state the main window's close handler (lib.rs) checks before quitting.
static CLIP_GENERATION_IN_PROGRESS: Lazy<Arc<Mutex<bool>>> =
    Lazy::new(|| Arc::new(Mutex::new(false)));
static UNSAVED_CHANGES: AtomicBool = AtomicBool::new(false);
static CLOSE_CONFIRMED: AtomicBool = AtomicBool::new(false);

/// Whether clip generation is running (read by the window close handler).
pub(crate) fn clip_generation_in_progress() -> bool {
    *CLIP_GENERATION_IN_PROGRESS.lock().unwrap()
}

/// Whether a screen has unsaved edits (read by the window close handler).
pub(crate) fn has_unsaved_changes() -> bool {
    UNSAVED_CHANGES.load(Ordering::SeqCst)
}

/// Whether the user already confirmed quitting in the close dialog.
pub(crate) fn close_confirmed() -> bool {
    CLOSE_CONFIRMED.load(Ordering::SeqCst)
}

/// Greets the user with a personalized message
///
/// # Arguments
/// * `name` - The name to greet
///
/// # Returns
/// A personalized greeting string
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Returns the port number for the video streaming server
///
/// # Returns
/// The port number as u16
#[tauri::command]
pub fn get_video_server_port() -> u16 {
    crate::video_server::VIDEO_SERVER_PORT
}

/// Test command for debugging download functionality
///
/// # Arguments
/// * `message` - Test message to echo back
///
/// # Returns
/// Success message containing the input
#[tauri::command]
pub async fn test_download_command(message: String) -> Result<String, String> {
    println!("[Rust] Test command called with message: {}", message);
    Ok(format!("Test command received: {}", message))
}

/// Sets the clip generation in progress state
///
/// # Arguments
/// * `in_progress` - Whether clip generation is currently in progress
#[tauri::command]
pub async fn set_clip_generation_in_progress(in_progress: bool) -> Result<(), String> {
    let mut clip_gen = CLIP_GENERATION_IN_PROGRESS.lock().unwrap();
    *clip_gen = in_progress;
    println!("[Rust] Clip generation in progress set to: {}", in_progress);
    Ok(())
}

/// Marks whether a screen has unsaved edits, so closing the window asks first.
#[tauri::command]
pub async fn set_unsaved_changes(unsaved: bool) -> Result<(), String> {
    UNSAVED_CHANGES.store(unsaved, Ordering::SeqCst);
    Ok(())
}

/// The user confirmed quitting in the close dialog: the next close request goes through.
#[tauri::command]
pub async fn confirm_app_close() -> Result<(), String> {
    CLOSE_CONFIRMED.store(true, Ordering::SeqCst);
    Ok(())
}

/// Gets the current clip generation in progress state
///
/// # Returns
/// True if clip generation is currently in progress
#[tauri::command]
pub async fn is_clip_generation_in_progress() -> Result<bool, String> {
    let clip_gen = CLIP_GENERATION_IN_PROGRESS.lock().unwrap();
    Ok(*clip_gen)
}

/// Gets the current count of active downloads
///
/// # Returns
/// The number of active downloads
#[tauri::command]
pub async fn get_active_downloads_count() -> Result<usize, String> {
    let downloads = crate::downloads::ACTIVE_DOWNLOADS.lock().unwrap();
    Ok(downloads.len())
}
