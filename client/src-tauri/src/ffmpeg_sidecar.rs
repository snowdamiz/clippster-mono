// Utility module for running ffmpeg/ffprobe sidecars with hidden console windows on Windows
use tauri::{AppHandle, Manager};
use std::path::PathBuf;

/// Get the path to the ffmpeg sidecar binary
fn get_ffmpeg_path(app: &AppHandle) -> Result<PathBuf, String> {
    let resources_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    
    #[cfg(target_os = "windows")]
    let ffmpeg_name = "ffmpeg.exe";
    #[cfg(not(target_os = "windows"))]
    let ffmpeg_name = "ffmpeg";
    
    Ok(resources_dir.join(ffmpeg_name))
}

/// Get the path to the ffprobe sidecar binary
#[allow(dead_code)]
fn get_ffprobe_path(app: &AppHandle) -> Result<PathBuf, String> {
    let resources_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    
    #[cfg(target_os = "windows")]
    let ffprobe_name = "ffprobe.exe";
    #[cfg(not(target_os = "windows"))]
    let ffprobe_name = "ffprobe";
    
    Ok(resources_dir.join(ffprobe_name))
}

/// Run ffmpeg with arguments, hiding the console window on Windows
pub async fn run_ffmpeg(
    app: &AppHandle,
    args: &[&str],
) -> Result<std::process::Output, String> {
    let ffmpeg_path = get_ffmpeg_path(app)?;
    
    let mut cmd = tokio::process::Command::new(&ffmpeg_path);
    cmd.args(args);
    
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    cmd.output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))
}

/// Run ffprobe with arguments, hiding the console window on Windows
#[allow(dead_code)]
pub async fn run_ffprobe(
    app: &AppHandle,
    args: &[&str],
) -> Result<std::process::Output, String> {
    let ffprobe_path = get_ffprobe_path(app)?;
    
    let mut cmd = tokio::process::Command::new(&ffprobe_path);
    cmd.args(args);
    
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    cmd.output()
        .await
        .map_err(|e| format!("Failed to run ffprobe: {}", e))
}
