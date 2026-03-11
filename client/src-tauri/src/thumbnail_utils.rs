use std::path::Path;
use tokio::process::Command;

#[cfg(target_os = "windows")]
fn no_window(cmd: &mut Command) -> &mut Command {
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    cmd.creation_flags(CREATE_NO_WINDOW)
}

#[cfg(not(target_os = "windows"))]
fn no_window(cmd: &mut Command) -> &mut Command {
    cmd
}

/// Hybrid thumbnail generation: Try yt-dlp first (fast for remote URLs), fallback to FFmpeg
/// 
/// # Arguments
/// * `ytdlp_path` - Path to yt-dlp binary
/// * `ffmpeg_path` - Path to FFmpeg binary
/// * `source_url` - Remote URL (YouTube, Twitch, Kick, etc.)
/// * `output_path` - Desired output path for thumbnail
/// * `seek_time` - Timestamp for FFmpeg fallback (e.g., "00:00:05")
/// 
/// # Returns
/// * `Ok(())` if thumbnail generated successfully
/// * `Err(String)` if both yt-dlp and FFmpeg failed
pub async fn generate_thumbnail_hybrid(
    ytdlp_path: &str,
    ffmpeg_path: &str,
    source_url: &str,
    output_path: &Path,
    seek_time: &str,
) -> Result<(), String> {
    println!("[Thumbnail] Attempting hybrid generation for: {}", source_url);
    
    // Try yt-dlp first (fast path for remote URLs with platform thumbnails)
    match try_ytdlp_thumbnail(ytdlp_path, source_url, output_path).await {
        Ok(()) => {
            println!("[Thumbnail] ✓ yt-dlp succeeded (fast path)");
            return Ok(());
        }
        Err(e) => {
            println!("[Thumbnail] yt-dlp failed: {}, falling back to FFmpeg", e);
        }
    }
    
    // Fallback to FFmpeg (reliable but slower)
    generate_ffmpeg_thumbnail(ffmpeg_path, source_url, output_path, seek_time).await
}

/// Try to extract thumbnail using yt-dlp (works for remote URLs with embedded/platform thumbnails)
async fn try_ytdlp_thumbnail(
    ytdlp_path: &str,
    source_url: &str,
    output_path: &Path,
) -> Result<(), String> {
    let output_dir = output_path
        .parent()
        .ok_or("Invalid output path")?;
    
    let filename_stem = output_path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Invalid filename")?;
    
    // yt-dlp output template to control thumbnail filename
    let output_template = output_dir
        .join(filename_stem)
        .to_string_lossy()
        .to_string();
    
    let mut cmd = Command::new(ytdlp_path);
    no_window(&mut cmd);
    
    let output = cmd
        .args([
            "--write-thumbnail",
            "--skip-download",
            "--convert-thumbnails", "jpg",
            "--output", &output_template,
            source_url,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp failed: {}", stderr));
    }
    
    // Check if thumbnail file was created (yt-dlp adds extension)
    // Look for common extensions: .jpg, .jpeg, .webp, .png
    let extensions = ["jpg", "jpeg", "webp", "png"];
    let mut found = false;
    
    for ext in &extensions {
        let potential_path = output_dir.join(format!("{}.{}", filename_stem, ext));
        if potential_path.exists() {
            // Rename to desired output path if needed
            if potential_path != output_path {
                std::fs::rename(&potential_path, output_path)
                    .map_err(|e| format!("Failed to rename thumbnail: {}", e))?;
            }
            found = true;
            break;
        }
    }
    
    if !found {
        return Err("yt-dlp completed but no thumbnail file found".to_string());
    }
    
    Ok(())
}

/// Generate thumbnail using FFmpeg (reliable fallback, works for all video files)
async fn generate_ffmpeg_thumbnail(
    ffmpeg_path: &str,
    source_path: &str,
    output_path: &Path,
    seek_time: &str,
) -> Result<(), String> {
    let mut cmd = Command::new(ffmpeg_path);
    no_window(&mut cmd);
    
    let output = cmd
        .args([
            "-hwaccel", "auto",
            "-ss", seek_time,
            "-i", source_path,
            "-vframes", "1",
            "-vf", "scale=320:-1",
            "-y",
            output_path.to_str().ok_or("Invalid output path")?,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to spawn FFmpeg: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg failed: {}", stderr));
    }
    
    if !output_path.exists() {
        return Err("FFmpeg completed but thumbnail file not found".to_string());
    }
    
    println!("[Thumbnail] ✓ FFmpeg succeeded (fallback path)");
    Ok(())
}

/// Generate thumbnail using FFmpeg only (for local files, livestream segments)
/// This is a convenience wrapper for cases where yt-dlp should not be attempted
pub async fn generate_ffmpeg_thumbnail_only(
    ffmpeg_path: &str,
    source_path: &str,
    output_path: &Path,
    seek_time: &str,
) -> Result<(), String> {
    generate_ffmpeg_thumbnail(ffmpeg_path, source_path, output_path, seek_time).await
}
