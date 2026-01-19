use std::path::{Path, PathBuf};
use std::process::Command;

/// Get the target triple for the current platform
fn get_target_triple() -> &'static str {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    { "x86_64-pc-windows-msvc" }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    { "x86_64-apple-darwin" }
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    { "aarch64-apple-darwin" }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    { "x86_64-unknown-linux-gnu" }
}

/// Resolve FFmpeg binary path
fn resolve_ffmpeg_binary() -> Result<String, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;
    
    let exe_dir = exe_path
        .parent()
        .ok_or("Failed to get parent directory")?;

    let target_triple = get_target_triple();
    
    #[cfg(target_os = "windows")]
    let binary_name = format!("ffmpeg-{}.exe", target_triple);
    
    #[cfg(not(target_os = "windows"))]
    let binary_name = format!("ffmpeg-{}", target_triple);

    // Production: sidecar is next to the executable
    let prod_path = exe_dir.join(&binary_name);
    if prod_path.exists() {
        return Ok(prod_path.to_string_lossy().to_string());
    }

    // Development mode: check src-tauri/binaries/
    if let Some(target_dir) = exe_dir.parent() {
        if let Some(target_parent) = target_dir.parent() {
            let dev_path = target_parent.join("binaries").join(&binary_name);
            if dev_path.exists() {
                return Ok(dev_path.to_string_lossy().to_string());
            }
        }
    }

    // Fallback to system PATH
    #[cfg(target_os = "windows")]
    let fallback = "ffmpeg.exe".to_string();
    
    #[cfg(not(target_os = "windows"))]
    let fallback = "ffmpeg".to_string();
    
    Ok(fallback)
}

/// Proxy resolution for playback
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ProxyResolution {
    P720,   // 720p - for normal preview (smaller, faster)
    P1080,  // 1080p - for fullscreen preview (higher quality)
}

/// Legacy proxy codec type (kept for backwards compatibility)
#[derive(Debug, Clone, Copy)]
pub enum ProxyCodec {
    ProResProxy,  // Best quality, larger files
    H264AllI,     // Good quality, smaller files
}

/// Generate a proxy video optimized for smooth playback
/// 
/// Uses frequent keyframes (every 30 frames) for instant seeking
/// and reduced resolution for faster decoding
pub fn generate_playback_proxy(
    input_path: &Path,
    resolution: ProxyResolution,
) -> Result<PathBuf, String> {
    let proxy_dir = input_path.parent()
        .ok_or("Invalid input path")?
        .join(".proxies");
    
    // Create proxy directory if it doesn't exist
    std::fs::create_dir_all(&proxy_dir)
        .map_err(|e| format!("Failed to create proxy directory: {}", e))?;
    
    let filename = input_path.file_stem()
        .ok_or("Invalid filename")?
        .to_string_lossy();
    
    let suffix = match resolution {
        ProxyResolution::P720 => "720p",
        ProxyResolution::P1080 => "1080p",
    };
    
    let proxy_path = proxy_dir.join(format!("{}_proxy_{}.mp4", filename, suffix));
    
    // Skip if proxy already exists
    if proxy_path.exists() {
        return Ok(proxy_path);
    }
    
    let scale = match resolution {
        ProxyResolution::P720 => "scale=-2:720",
        ProxyResolution::P1080 => "scale=-2:1080",
    };
    
    let ffmpeg_path = resolve_ffmpeg_binary()?;
    
    // Generate proxy with frequent keyframes for instant seeking
    // Based on Video_Editor_Playback_Optimization_Plan.md
    let result = Command::new(&ffmpeg_path)
        .args(&[
            "-i", input_path.to_str().unwrap(),
            "-vf", scale,
            "-c:v", "libx264",
            "-preset", "ultrafast",     // Prioritize encode speed
            "-crf", "28",               // Acceptable quality for preview
            "-g", "30",                 // Keyframe every 30 frames (~1 sec at 30fps)
            "-keyint_min", "30",        // Minimum keyframe interval
            "-sc_threshold", "0",       // No scene-change keyframes (consistent spacing)
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",  // Metadata at file start for instant playback
            "-y",
            proxy_path.to_str().unwrap()
        ])
        .output();
    
    match result {
        Ok(output) => {
            if output.status.success() {
                Ok(proxy_path)
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("FFmpeg failed: {}", stderr))
            }
        }
        Err(e) => Err(format!("Failed to run FFmpeg: {}", e))
    }
}

/// Generate both 720p and 1080p proxies for a video
pub fn generate_dual_proxies(
    input_path: &Path,
) -> Result<(PathBuf, PathBuf), String> {
    let proxy_720 = generate_playback_proxy(input_path, ProxyResolution::P720)?;
    let proxy_1080 = generate_playback_proxy(input_path, ProxyResolution::P1080)?;
    Ok((proxy_720, proxy_1080))
}

/// Get proxy path if it exists
pub fn get_playback_proxy_path(input_path: &Path, resolution: ProxyResolution) -> Option<PathBuf> {
    let proxy_dir = input_path.parent()?.join(".proxies");
    let filename = input_path.file_stem()?.to_string_lossy();
    
    let suffix = match resolution {
        ProxyResolution::P720 => "720p",
        ProxyResolution::P1080 => "1080p",
    };
    
    let proxy_path = proxy_dir.join(format!("{}_proxy_{}.mp4", filename, suffix));
    
    if proxy_path.exists() {
        Some(proxy_path)
    } else {
        None
    }
}

/// Generate proxy in background (non-blocking)
pub fn generate_playback_proxy_async(
    input_path: PathBuf,
    resolution: ProxyResolution,
) -> std::thread::JoinHandle<Result<PathBuf, String>> {
    std::thread::spawn(move || {
        generate_playback_proxy(&input_path, resolution)
    })
}

/// Generate both proxies in background
pub fn generate_dual_proxies_async(
    input_path: PathBuf,
) -> std::thread::JoinHandle<Result<(PathBuf, PathBuf), String>> {
    std::thread::spawn(move || {
        generate_dual_proxies(&input_path)
    })
}

/// Legacy: Generate a proxy video for smooth scrubbing
/// 
/// Proxies use edit-friendly codecs (all-I or short GOP) for instant seeking
pub fn generate_proxy(
    input_path: &Path,
    codec: ProxyCodec,
) -> Result<PathBuf, String> {
    let proxy_dir = input_path.parent()
        .ok_or("Invalid input path")?
        .join(".proxies");
    
    // Create proxy directory if it doesn't exist
    std::fs::create_dir_all(&proxy_dir)
        .map_err(|e| format!("Failed to create proxy directory: {}", e))?;
    
    let filename = input_path.file_stem()
        .ok_or("Invalid filename")?
        .to_string_lossy();
    
    let proxy_path = match codec {
        ProxyCodec::ProResProxy => {
            proxy_dir.join(format!("{}_proxy.mov", filename))
        }
        ProxyCodec::H264AllI => {
            proxy_dir.join(format!("{}_proxy.mp4", filename))
        }
    };
    
    // Skip if proxy already exists
    if proxy_path.exists() {
        return Ok(proxy_path);
    }
    
    let ffmpeg_path = resolve_ffmpeg_binary()?;
    
    // Generate proxy using FFmpeg
    let result = match codec {
        ProxyCodec::ProResProxy => {
            // ProRes Proxy: Best quality for editing
            Command::new(&ffmpeg_path)
                .args(&[
                    "-i", input_path.to_str().unwrap(),
                    "-c:v", "prores_ks",
                    "-profile:v", "0",  // Proxy quality
                    "-qscale:v", "9",
                    "-c:a", "pcm_s16le",  // Uncompressed audio
                    "-y",
                    proxy_path.to_str().unwrap()
                ])
                .output()
        }
        ProxyCodec::H264AllI => {
            // H.264 All-I: Smaller files, still edit-friendly
            Command::new(&ffmpeg_path)
                .args(&[
                    "-i", input_path.to_str().unwrap(),
                    "-c:v", "libx264",
                    "-g", "1",  // Keyframe every frame
                    "-x264-params", "keyint=1",
                    "-preset", "ultrafast",
                    "-crf", "18",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-y",
                    proxy_path.to_str().unwrap()
                ])
                .output()
        }
    };
    
    match result {
        Ok(output) => {
            if output.status.success() {
                Ok(proxy_path)
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("FFmpeg failed: {}", stderr))
            }
        }
        Err(e) => Err(format!("Failed to run FFmpeg: {}", e))
    }
}

/// Check if a proxy exists for a video
pub fn get_proxy_path(input_path: &Path, codec: ProxyCodec) -> Option<PathBuf> {
    let proxy_dir = input_path.parent()?.join(".proxies");
    let filename = input_path.file_stem()?.to_string_lossy();
    
    let proxy_path = match codec {
        ProxyCodec::ProResProxy => {
            proxy_dir.join(format!("{}_proxy.mov", filename))
        }
        ProxyCodec::H264AllI => {
            proxy_dir.join(format!("{}_proxy.mp4", filename))
        }
    };
    
    if proxy_path.exists() {
        Some(proxy_path)
    } else {
        None
    }
}

/// Get the best available video path (proxy if exists, otherwise original)
pub fn get_playback_path(original_path: &Path) -> PathBuf {
    // Try H.264 All-I proxy first (smaller, faster to generate)
    if let Some(proxy) = get_proxy_path(original_path, ProxyCodec::H264AllI) {
        return proxy;
    }
    
    // Try ProRes proxy
    if let Some(proxy) = get_proxy_path(original_path, ProxyCodec::ProResProxy) {
        return proxy;
    }
    
    // Fall back to original
    original_path.to_path_buf()
}

/// Generate proxy in background (non-blocking)
#[allow(dead_code)]
pub fn generate_proxy_async(
    input_path: PathBuf,
    codec: ProxyCodec,
) -> std::thread::JoinHandle<Result<PathBuf, String>> {
    std::thread::spawn(move || {
        generate_proxy(&input_path, codec)
    })
}
