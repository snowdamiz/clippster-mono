use std::path::Path;

/// Delete a file from the filesystem
pub fn delete_file(path: &str) -> Result<(), Box<dyn std::error::Error>> {
    std::fs::remove_file(path)?;
    Ok(())
}

/// Check if a file exists
pub fn file_exists(path: &str) -> bool {
    Path::new(path).exists()
}

/// Ensure a directory exists, creating it if necessary
pub fn ensure_directory_exists(path: &str) -> Result<(), Box<dyn std::error::Error>> {
    if !Path::new(path).exists() {
        std::fs::create_dir_all(path)?;
    }
    Ok(())
}
