#![allow(unexpected_cfgs)]
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowSize {
    pub width: f64,
    pub height: f64,
}

// Get platform information
#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

// Show the main window (used to hide window during loading)
#[tauri::command]
pub async fn show_main_window(window: tauri::Window) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())
}

// Setup macOS titlebar with transparent background
#[tauri::command]
pub async fn setup_macos_titlebar(_window: tauri::Window) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // On macOS, we use the window parameter to access the native NSWindow
        #[allow(unused_imports, deprecated)]
        use cocoa::appkit::{NSColor, NSWindow};
        use cocoa::base::NO;
        #[allow(deprecated)]
        use cocoa::foundation::NSAutoreleasePool;
        use objc::{msg_send, sel, sel_impl};

        // Get the native window handle
        let ns_window = _window.ns_window().map_err(|e| format!("Failed to get NSWindow: {}", e))?;

        // Create an autorelease pool for memory management
        #[allow(deprecated)]
        unsafe {
            let pool = NSAutoreleasePool::new(std::ptr::null_mut());

            // Set the background color to match the app's dark theme
            let bg_color = NSColor::colorWithRed_green_blue_alpha_(
                std::ptr::null_mut(),
                15.0 / 255.0,    // R - dark background
                15.0 / 255.0,    // G - dark background
                15.0 / 255.0,    // B - dark background
                1.0,             // Alpha - fully opaque
            );

            // Apply the background color to the window
            let _: () = msg_send![ns_window as *mut objc::runtime::Object, setBackgroundColor: bg_color];

            // Make sure the window is opaque for better performance
            let _: () = msg_send![ns_window as *mut objc::runtime::Object, setOpaque: NO];

            // Clean up the autorelease pool
            let _: () = msg_send![pool, release];
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // On non-macOS platforms, this function does nothing
    }

    Ok(())
}

// Get the path to the window state file
fn get_window_state_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    
    Ok(app_data_dir.join("window_state.json"))
}

// Save window size to app data directory
#[tauri::command]
pub fn save_window_size(app_handle: tauri::AppHandle, width: f64, height: f64) -> Result<(), String> {
    let window_size = WindowSize { width, height };
    let state_path = get_window_state_path(&app_handle)?;
    
    let json = serde_json::to_string(&window_size)
        .map_err(|e| format!("Failed to serialize window size: {}", e))?;
    
    fs::write(&state_path, json)
        .map_err(|e| format!("Failed to write window state: {}", e))?;
    
    Ok(())
}

// Load window size from app data directory
#[tauri::command]
pub fn load_window_size(app_handle: tauri::AppHandle) -> Result<Option<WindowSize>, String> {
    let state_path = get_window_state_path(&app_handle)?;
    
    if !state_path.exists() {
        return Ok(None);
    }
    
    let json = fs::read_to_string(&state_path)
        .map_err(|e| format!("Failed to read window state: {}", e))?;
    
    let window_size: WindowSize = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to deserialize window size: {}", e))?;
    
    Ok(Some(window_size))
}
