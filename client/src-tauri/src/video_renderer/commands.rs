use std::path::PathBuf;
use std::sync::Mutex;

use super::{decoder_pool::DecoderPool, frame_cache::FrameCache, playback_engine::PlaybackEngine};

pub struct VideoRendererState {
    pub decoder_pool: DecoderPool,
    pub frame_cache: FrameCache,
    pub playback_engine: Option<PlaybackEngine>,
}

impl VideoRendererState {
    pub fn new() -> Self {
        Self {
            decoder_pool: DecoderPool::new(10),  // Max 10 concurrent decoders
            frame_cache: FrameCache::new(500),   // Cache 500 frames (~16 seconds at 30fps)
            playback_engine: None,
        }
    }
}

#[tauri::command]
pub async fn get_video_frame(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
    video_path: String,
    timestamp: f64,
) -> Result<tauri::ipc::Response, String> {
    // Don't decode during playback - return cached frame or error
    if super::is_playback_active() {
        let state = state
            .lock()
            .map_err(|_| "Video renderer state lock poisoned".to_string())?;
        
        // Try to return cached frame
        let cache_key = super::frame_cache::FrameKey {
            path: video_path.clone(),
            timestamp_ms: (timestamp * 1000.0) as u64,
        };
        
        if let Some(cached_data) = state.frame_cache.get(&cache_key) {
            // Return raw binary data directly - bypasses JSON serialization
            return Ok(tauri::ipc::Response::new(cached_data));
        }
        
        // During playback, don't decode - just return empty to avoid contention
        return Err("Playback active - use playback frames".to_string());
    }
    
    let state = state
        .lock()
        .map_err(|_| "Video renderer state lock poisoned".to_string())?;
    
    // Check cache first
    let cache_key = super::frame_cache::FrameKey {
        path: video_path.clone(),
        timestamp_ms: (timestamp * 1000.0) as u64,
    };
    
    if let Some(cached_data) = state.frame_cache.get(&cache_key) {
        // Return raw binary data directly - bypasses JSON serialization
        return Ok(tauri::ipc::Response::new(cached_data));
    }
    
    // Decode from video
    let path = PathBuf::from(&video_path);
    let frame = state.decoder_pool.get_frame(&path, timestamp)?;
    
    // Cache the frame
    state.frame_cache.put(cache_key, frame.data.clone());
    
    // Return raw binary data directly - bypasses JSON serialization
    Ok(tauri::ipc::Response::new(frame.data))
}

#[tauri::command]
pub async fn get_video_dimensions(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
    video_path: String,
) -> Result<(u32, u32), String> {
    let state = state
        .lock()
        .map_err(|_| "Video renderer state lock poisoned".to_string())?;
    let path = PathBuf::from(&video_path);
    state.decoder_pool.get_video_dimensions(&path)
}

#[tauri::command]
pub async fn clear_frame_cache(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
) -> Result<(), String> {
    let state = state
        .lock()
        .map_err(|_| "Video renderer state lock poisoned".to_string())?;
    state.frame_cache.clear();
    Ok(())
}

#[tauri::command]
pub async fn invalidate_cache_range(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
    video_path: String,
    start_time: f64,
    end_time: f64,
) -> Result<(), String> {
    let state = state
        .lock()
        .map_err(|_| "Video renderer state lock poisoned".to_string())?;
    state.frame_cache.invalidate_range(&video_path, start_time, end_time);
    Ok(())
}

#[tauri::command]
pub async fn invalidate_cache_path(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
    video_path: String,
) -> Result<(), String> {
    let state = state
        .lock()
        .map_err(|_| "Video renderer state lock poisoned".to_string())?;
    state.frame_cache.invalidate_path(&video_path);
    Ok(())
}

#[tauri::command]
pub async fn get_frame_cache_stats(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
) -> Result<serde_json::Value, String> {
    let state = state
        .lock()
        .map_err(|_| "Video renderer state lock poisoned".to_string())?;
    Ok(serde_json::json!({
        "cached_frames": state.frame_cache.len(),
        "is_empty": state.frame_cache.is_empty(),
    }))
}

// ===== PROXY GENERATION COMMANDS =====

#[tauri::command]
pub async fn generate_video_proxy(
    video_path: String,
    codec_type: String,
) -> Result<String, String> {
    use super::proxy::{generate_proxy, ProxyCodec};
    use std::path::PathBuf;
    
    let path = PathBuf::from(&video_path);
    let codec = match codec_type.as_str() {
        "prores" => ProxyCodec::ProResProxy,
        "h264" => ProxyCodec::H264AllI,
        _ => ProxyCodec::H264AllI,
    };
    
    let proxy_path = generate_proxy(&path, codec)?;
    Ok(proxy_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_video_proxy_path(
    video_path: String,
) -> Result<Option<String>, String> {
    use super::proxy::get_playback_path;
    use std::path::PathBuf;
    
    let path = PathBuf::from(&video_path);
    let playback_path = get_playback_path(&path);
    
    if playback_path != path {
        Ok(Some(playback_path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

// ===== NEW PLAYBACK ENGINE COMMANDS =====

#[tauri::command]
pub async fn start_playback(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
    app: tauri::AppHandle,
    video_path: String,
    use_proxy: Option<String>,  // "720p", "1080p", or None for original
    enable_audio: Option<bool>,  // Whether to enable audio from the video file
    initial_time: Option<f64>,  // Initial seek position before starting playback
) -> Result<(), String> {
    use super::proxy::{ProxyResolution, get_playback_proxy_path};
    use std::path::Path;
    
    let mut state = state
        .lock()
        .map_err(|_| "Video renderer state lock poisoned".to_string())?;
    
    // Determine which video path to use
    let playback_path = match use_proxy.as_deref() {
        Some("720p") => {
            get_playback_proxy_path(Path::new(&video_path), ProxyResolution::P720)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| {
                    eprintln!("[start_playback] 720p proxy not found, using original");
                    video_path.clone()
                })
        }
        Some("1080p") => {
            get_playback_proxy_path(Path::new(&video_path), ProxyResolution::P1080)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| {
                    eprintln!("[start_playback] 1080p proxy not found, using original");
                    video_path.clone()
                })
        }
        _ => video_path.clone(),
    };
    
    let audio_enabled = enable_audio.unwrap_or(true);
    println!("[start_playback] Using video: {} (proxy: {:?}, audio: {})", playback_path, use_proxy, audio_enabled);
    
    let mut engine = PlaybackEngine::new();
    engine.start(playback_path, app, audio_enabled);
    
    // Seek to initial position BEFORE starting playback to avoid frame 0 glitch
    if let Some(time) = initial_time {
        println!("[start_playback] Seeking to initial position: {:.3}s", time);
        engine.send_command(super::playback_engine::PlaybackCommand::Seek(time))?;
    }
    
    // Now send play command
    engine.send_command(super::playback_engine::PlaybackCommand::Play)?;
    
    state.playback_engine = Some(engine);
    Ok(())
}

#[tauri::command]
pub async fn pause_playback(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
) -> Result<(), String> {
    let state = state
        .lock()
        .map_err(|_| "Video renderer state lock poisoned".to_string())?;
    
    if let Some(engine) = &state.playback_engine {
        engine.send_command(super::playback_engine::PlaybackCommand::Pause)?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn resume_playback(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
) -> Result<(), String> {
    let state = state
        .lock()
        .map_err(|_| "Video renderer state lock poisoned".to_string())?;
    
    if let Some(engine) = &state.playback_engine {
        engine.send_command(super::playback_engine::PlaybackCommand::Play)?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn seek_playback(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
    time: f64,
) -> Result<(), String> {
    let state = state
        .lock()
        .map_err(|_| "Video renderer state lock poisoned".to_string())?;
    
    if let Some(engine) = &state.playback_engine {
        engine.send_command(super::playback_engine::PlaybackCommand::Seek(time))?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn set_playback_volume(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
    volume: f32,
) -> Result<(), String> {
    let state = state
        .lock()
        .map_err(|_| "Video renderer state lock poisoned".to_string())?;
    
    if let Some(engine) = &state.playback_engine {
        engine.send_command(super::playback_engine::PlaybackCommand::SetVolume(volume))?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn stop_playback(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
) -> Result<(), String> {
    let mut state = state
        .lock()
        .map_err(|_| "Video renderer state lock poisoned".to_string())?;
    
    if let Some(engine) = &state.playback_engine {
        engine.send_command(super::playback_engine::PlaybackCommand::Stop)?;
    }
    
    state.playback_engine = None;
    Ok(())
}

#[tauri::command]
pub async fn read_frame_slot(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
    slot_id: u32,
) -> Result<tauri::ipc::Response, String> {
    let state = state
        .lock()
        .map_err(|_| "Video renderer state lock poisoned".to_string())?;
    
    if let Some(engine) = &state.playback_engine {
        if let Some(slot) = engine.read_slot(slot_id) {
            // Return raw binary data directly - bypasses JSON serialization
            // Frontend receives ArrayBuffer instead of number[]
            return Ok(tauri::ipc::Response::new(slot.pixels));
        }
    }
    
    Err("Frame slot not found".to_string())
}

#[tauri::command]
pub async fn get_playback_state(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
) -> Result<String, String> {
    let state = state
        .lock()
        .map_err(|_| "Video renderer state lock poisoned".to_string())?;
    
    if let Some(engine) = &state.playback_engine {
        let playback_state = engine.get_state();
        return Ok(format!("{:?}", playback_state));
    }
    
    Ok("Stopped".to_string())
}

/// Generate playback proxies (720p and 1080p) for a video
#[tauri::command]
pub async fn generate_video_proxies(
    video_path: String,
) -> Result<ProxyPaths, String> {
    use super::proxy::{generate_playback_proxy, ProxyResolution, get_playback_proxy_path};
    use std::path::Path;
    
    let input_path = Path::new(&video_path);
    
    // Check if proxies already exist
    let proxy_720 = get_playback_proxy_path(input_path, ProxyResolution::P720);
    let proxy_1080 = get_playback_proxy_path(input_path, ProxyResolution::P1080);
    
    // Generate missing proxies
    let path_720 = if let Some(p) = proxy_720 {
        p
    } else {
        generate_playback_proxy(input_path, ProxyResolution::P720)?
    };
    
    let path_1080 = if let Some(p) = proxy_1080 {
        p
    } else {
        generate_playback_proxy(input_path, ProxyResolution::P1080)?
    };
    
    Ok(ProxyPaths {
        original: video_path,
        proxy_720p: path_720.to_string_lossy().to_string(),
        proxy_1080p: path_1080.to_string_lossy().to_string(),
    })
}

/// Check if proxies exist for a video
#[tauri::command]
pub async fn get_video_proxy_paths(
    video_path: String,
) -> Result<ProxyPaths, String> {
    use super::proxy::{ProxyResolution, get_playback_proxy_path};
    use std::path::Path;
    
    let input_path = Path::new(&video_path);
    
    let proxy_720 = get_playback_proxy_path(input_path, ProxyResolution::P720)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    
    let proxy_1080 = get_playback_proxy_path(input_path, ProxyResolution::P1080)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    
    Ok(ProxyPaths {
        original: video_path,
        proxy_720p: proxy_720,
        proxy_1080p: proxy_1080,
    })
}

#[derive(serde::Serialize)]
pub struct ProxyPaths {
    pub original: String,
    pub proxy_720p: String,
    pub proxy_1080p: String,
}
