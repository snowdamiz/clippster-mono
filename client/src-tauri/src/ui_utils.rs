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
        use cocoa::appkit::{NSColor, NSWindow};
        use cocoa::foundation::NSAutoreleasePool;
        use objc::msg_send;
        use objc::runtime::Sel;

        // Get the native window handle
        let ns_window = _window.ns_window().map_err(|e| format!("Failed to get NSWindow: {}", e))?;

        // Create an autorelease pool for memory management
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
            let _: () = msg_send![ns_window, setBackgroundColor_: bg_color];

            // Make sure the window is opaque for better performance
            let _: () = msg_send![ns_window, setOpaque_: cocoa::foundation::NO];

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