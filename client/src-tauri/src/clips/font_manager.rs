use tauri::Manager;

// Helper to get fonts directory and create fontconfig
pub fn get_fonts_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    // In dev mode, fonts are in src-tauri/fonts
    // In production, fonts are in the resource directory
    let fonts_dir = if cfg!(debug_assertions) {
        // Navigate up to find the project root
        let current_exe = std::env::current_exe()
            .map_err(|e| format!("Failed to get current exe: {}", e))?;
        
        // In dev mode, exe is in target/debug/, so go up to src-tauri then to fonts
        let src_tauri_dir = current_exe
            .parent().unwrap() // debug
            .parent().unwrap() // target
            .parent().unwrap(); // src-tauri
        
        src_tauri_dir.join("fonts")
    } else {
        // Production mode: use bundled fonts from resource directory
        let resource_dir = app.path()
            .resource_dir()
            .map_err(|e| format!("Failed to get resource directory: {}", e))?;
        resource_dir.join("fonts")
    };
    
    println!("[Rust] Fonts directory: {}", fonts_dir.display());
    println!("[Rust] Fonts directory exists: {}", fonts_dir.exists());
    
    // Create fontconfig file to tell FFmpeg where to find fonts
    create_fontconfig_file(&fonts_dir)?;
    
    Ok(fonts_dir)
}

// Helper to create fontconfig file for FFmpeg
pub fn create_fontconfig_file(fonts_dir: &std::path::Path) -> Result<(), String> {
    let storage_paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;
    
    let fontconfig_path = storage_paths.temp.join("fonts.conf");
    
    // Convert Windows path to Unix-style path for fontconfig
    let fonts_dir_str = fonts_dir.to_string_lossy().replace("\\", "/");
    
    let fontconfig_content = format!(
        r#"<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
    <dir>{}</dir>
    <cachedir>{}/font-cache</cachedir>
</fontconfig>
"#,
        fonts_dir_str,
        storage_paths.temp.to_string_lossy().replace("\\", "/")
    );
    
    std::fs::write(&fontconfig_path, fontconfig_content)
        .map_err(|e| format!("Failed to write fontconfig file: {}", e))?;
    
    println!("[Rust] Created fontconfig at: {}", fontconfig_path.display());
    
    Ok(())
}

