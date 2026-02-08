use std::path::PathBuf;
use tauri::Manager;

/// Read a font file from an absolute path and return its bytes
#[tauri::command]
pub async fn read_font_file(path: String) -> Result<Vec<u8>, String> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        return Err(format!("Font file not found: {}", path.display()));
    }
    std::fs::read(&path).map_err(|e| format!("Failed to read font file: {}", e))
}

/// Read a bundled font from the app's fonts directory
#[tauri::command]
pub async fn read_bundled_font(
    app: tauri::AppHandle,
    font_name: String,
) -> Result<Vec<u8>, String> {
    // Try resource path first (bundled with app)
    let resource_path = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?
        .join("fonts")
        .join(&font_name);

    if resource_path.exists() {
        return std::fs::read(&resource_path)
            .map_err(|e| format!("Failed to read bundled font: {}", e));
    }

    // Fallback: try the fonts directory relative to the executable
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {}", e))?
        .parent()
        .ok_or("Failed to get exe parent dir")?
        .to_path_buf();

    let fallback_path = exe_dir.join("fonts").join(&font_name);
    if fallback_path.exists() {
        return std::fs::read(&fallback_path)
            .map_err(|e| format!("Failed to read font from exe dir: {}", e));
    }

    // Try src-tauri/fonts for development
    let dev_path = exe_dir
        .ancestors()
        .find(|p| p.join("fonts").exists())
        .map(|p| p.join("fonts").join(&font_name));

    if let Some(dev_path) = dev_path {
        if dev_path.exists() {
            return std::fs::read(&dev_path)
                .map_err(|e| format!("Failed to read dev font: {}", e));
        }
    }

    Err(format!("Bundled font not found: {}", font_name))
}

/// Copy a user's font file to the app data directory for persistence
#[tauri::command]
pub async fn copy_font_to_app_data(
    app: tauri::AppHandle,
    source_path: String,
    file_name: String,
) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("Source font not found: {}", source_path));
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let fonts_dir = app_data_dir.join("custom_fonts");
    std::fs::create_dir_all(&fonts_dir)
        .map_err(|e| format!("Failed to create custom fonts dir: {}", e))?;

    let dest = fonts_dir.join(&file_name);
    std::fs::copy(&source, &dest)
        .map_err(|e| format!("Failed to copy font: {}", e))?;

    Ok(dest.to_string_lossy().to_string())
}

/// List all custom fonts in the app data directory
#[tauri::command]
pub async fn list_custom_fonts(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let fonts_dir = app_data_dir.join("custom_fonts");
    if !fonts_dir.exists() {
        return Ok(vec![]);
    }

    let mut fonts = Vec::new();
    let entries = std::fs::read_dir(&fonts_dir)
        .map_err(|e| format!("Failed to read custom fonts dir: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if let Some(ext) = path.extension() {
                let ext = ext.to_string_lossy().to_lowercase();
                if ext == "ttf" || ext == "otf" || ext == "woff" || ext == "woff2" {
                    fonts.push(path.to_string_lossy().to_string());
                }
            }
        }
    }

    Ok(fonts)
}

/// Resolve a font family name to its absolute file path for FFmpeg export
/// Checks: custom fonts dir → bundled fonts dir → Windows system fonts
#[tauri::command]
pub async fn resolve_font_path(
    app: tauri::AppHandle,
    font_family: String,
    font_file_path: Option<String>,
) -> Result<String, String> {
    // If an explicit file path is provided, use it
    if let Some(path) = font_file_path {
        let p = PathBuf::from(&path);
        if p.exists() {
            return Ok(path);
        }
    }

    // Check custom fonts directory
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let custom_fonts_dir = app_data_dir.join("custom_fonts");
    if custom_fonts_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&custom_fonts_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_lowercase();
                let family_lower = font_family.to_lowercase().replace(' ', "");
                if name.contains(&family_lower) {
                    return Ok(entry.path().to_string_lossy().to_string());
                }
            }
        }
    }

    // Check bundled fonts
    let resource_dir = app
        .path()
        .resource_dir()
        .unwrap_or_default()
        .join("fonts");

    if resource_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&resource_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_lowercase();
                let family_lower = font_family.to_lowercase().replace(' ', "");
                if name.contains(&family_lower) {
                    return Ok(entry.path().to_string_lossy().to_string());
                }
            }
        }
    }

    // Check Windows system fonts
    #[cfg(target_os = "windows")]
    {
        let windows_fonts = PathBuf::from("C:\\Windows\\Fonts");
        if windows_fonts.exists() {
            // Map common font families to their file names
            let font_file_map: Vec<(&str, &str)> = vec![
                ("arial", "arial.ttf"),
                ("helvetica", "arial.ttf"),
                ("times new roman", "times.ttf"),
                ("courier new", "cour.ttf"),
                ("georgia", "georgia.ttf"),
                ("verdana", "verdana.ttf"),
                ("impact", "impact.ttf"),
                ("comic sans ms", "comic.ttf"),
                ("trebuchet ms", "trebuc.ttf"),
                ("tahoma", "tahoma.ttf"),
                ("segoe ui", "segoeui.ttf"),
                ("calibri", "calibri.ttf"),
                ("cambria", "cambria.ttc"),
                ("consolas", "consola.ttf"),
            ];

            let family_lower = font_family.to_lowercase();
            for (family, file) in &font_file_map {
                if family_lower == *family {
                    let path = windows_fonts.join(file);
                    if path.exists() {
                        return Ok(path.to_string_lossy().to_string());
                    }
                }
            }

            // Fuzzy search Windows fonts directory
            if let Ok(entries) = std::fs::read_dir(&windows_fonts) {
                let family_lower = family_lower.replace(' ', "");
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if name.contains(&family_lower) && (name.ends_with(".ttf") || name.ends_with(".otf") || name.ends_with(".ttc")) {
                        return Ok(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    // macOS system fonts
    #[cfg(target_os = "macos")]
    {
        let font_dirs = vec![
            PathBuf::from("/System/Library/Fonts"),
            PathBuf::from("/Library/Fonts"),
            dirs::home_dir().map(|h| h.join("Library/Fonts")).unwrap_or_default(),
        ];

        let family_lower = font_family.to_lowercase().replace(' ', "");
        for dir in font_dirs {
            if !dir.exists() { continue; }
            if let Ok(entries) = std::fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if name.contains(&family_lower) && (name.ends_with(".ttf") || name.ends_with(".otf") || name.ends_with(".ttc")) {
                        return Ok(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    // Fallback: return Arial on Windows
    #[cfg(target_os = "windows")]
    {
        let arial = PathBuf::from("C:\\Windows\\Fonts\\arial.ttf");
        if arial.exists() {
            return Ok(arial.to_string_lossy().to_string());
        }
    }

    Err(format!("Could not resolve font path for: {}", font_family))
}
