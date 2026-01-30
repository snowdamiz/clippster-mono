pub mod frame_decoder;
pub mod frame_cache;
pub mod decoder_pool;

use decoder_pool::{DecoderPool, CacheStats, DecoderInfo};
use std::sync::Arc;
use parking_lot::Mutex;

pub struct VideoFrameState {
    decoder_pool: Arc<Mutex<DecoderPool>>,
}

impl VideoFrameState {
    pub fn new() -> Self {
        Self {
            decoder_pool: Arc::new(Mutex::new(DecoderPool::new(200))),
        }
    }

    pub fn decoder_pool(&self) -> Arc<Mutex<DecoderPool>> {
        Arc::clone(&self.decoder_pool)
    }
}

#[tauri::command]
pub async fn get_video_frame(
    source_id: String,
    video_path: String,
    timestamp: f64,
    state: tauri::State<'_, VideoFrameState>,
) -> Result<Vec<u8>, String> {
    let pool = state.decoder_pool.lock();
    
    let frame = pool.get_frame(&source_id, &video_path, timestamp)
        .map_err(|e| format!("Failed to get frame: {}", e))?;
    
    Ok((*frame.rgb_data).clone())
}

#[tauri::command]
pub async fn get_video_frame_with_dimensions(
    source_id: String,
    video_path: String,
    timestamp: f64,
    state: tauri::State<'_, VideoFrameState>,
) -> Result<serde_json::Value, String> {
    let pool = state.decoder_pool.lock();
    
    let frame = pool.get_frame(&source_id, &video_path, timestamp)
        .map_err(|e| format!("Failed to get frame: {}", e))?;
    
    Ok(serde_json::json!({
        "width": frame.width,
        "height": frame.height,
        "rgb_data": (*frame.rgb_data).clone(),
        "timestamp": frame.timestamp,
    }))
}

#[tauri::command]
pub async fn prefetch_video_frames(
    source_id: String,
    video_path: String,
    start_time: f64,
    count: usize,
    fps: f64,
    state: tauri::State<'_, VideoFrameState>,
) -> Result<(), String> {
    let pool = state.decoder_pool.lock();
    
    pool.prefetch_frames(&source_id, &video_path, start_time, count, fps)
        .map_err(|e| format!("Failed to prefetch frames: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn clear_video_decoder(
    source_id: String,
    state: tauri::State<'_, VideoFrameState>,
) -> Result<(), String> {
    let pool = state.decoder_pool.lock();
    
    pool.clear_decoder(&source_id);
    Ok(())
}

#[tauri::command]
pub async fn clear_all_video_decoders(
    state: tauri::State<'_, VideoFrameState>,
) -> Result<(), String> {
    let pool = state.decoder_pool.lock();
    
    pool.clear_all_decoders();
    Ok(())
}

#[tauri::command]
pub async fn clear_frame_cache(
    state: tauri::State<'_, VideoFrameState>,
) -> Result<(), String> {
    let pool = state.decoder_pool.lock();
    
    pool.clear_cache();
    Ok(())
}

#[tauri::command]
pub async fn get_frame_cache_stats(
    state: tauri::State<'_, VideoFrameState>,
) -> Result<CacheStats, String> {
    let pool = state.decoder_pool.lock();
    
    Ok(pool.get_cache_stats())
}

#[tauri::command]
pub async fn get_decoder_info(
    source_id: String,
    state: tauri::State<'_, VideoFrameState>,
) -> Result<Option<DecoderInfo>, String> {
    let pool = state.decoder_pool.lock();
    
    Ok(pool.get_decoder_info(&source_id))
}
