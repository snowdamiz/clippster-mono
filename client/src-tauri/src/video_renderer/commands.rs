use parking_lot::Mutex;
use std::path::PathBuf;
use super::{decoder_pool::DecoderPool, frame_cache::FrameCache};

pub struct VideoRendererState {
    pub decoder_pool: DecoderPool,
    pub frame_cache: FrameCache,
}

impl VideoRendererState {
    pub fn new() -> Self {
        Self {
            decoder_pool: DecoderPool::new(10),  // Max 10 concurrent decoders
            frame_cache: FrameCache::new(500),   // Cache 500 frames (~16 seconds at 30fps)
        }
    }
}

#[tauri::command]
pub async fn get_video_frame(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
    video_path: String,
    timestamp: f64,
) -> Result<Vec<u8>, String> {
    let state = state.lock();
    
    // Check cache first
    let cache_key = super::frame_cache::FrameKey {
        path: video_path.clone(),
        timestamp_ms: (timestamp * 1000.0) as u64,
    };
    
    if let Some(cached_data) = state.frame_cache.get(&cache_key) {
        return Ok(cached_data);
    }
    
    // Decode from video
    let path = PathBuf::from(&video_path);
    let frame = state.decoder_pool.get_frame(&path, timestamp)?;
    
    // Cache the frame
    state.frame_cache.put(cache_key, frame.data.clone());
    
    Ok(frame.data)
}

#[tauri::command]
pub async fn get_video_dimensions(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
    video_path: String,
) -> Result<(u32, u32), String> {
    let state = state.lock();
    let path = PathBuf::from(&video_path);
    state.decoder_pool.get_video_dimensions(&path)
}

#[tauri::command]
pub async fn clear_frame_cache(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
) -> Result<(), String> {
    let state = state.lock();
    state.frame_cache.clear();
    Ok(())
}

#[tauri::command]
pub async fn get_frame_cache_stats(
    state: tauri::State<'_, Mutex<VideoRendererState>>,
) -> Result<serde_json::Value, String> {
    let state = state.lock();
    Ok(serde_json::json!({
        "cached_frames": state.frame_cache.len(),
        "is_empty": state.frame_cache.is_empty(),
    }))
}
