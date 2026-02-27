use super::frame_cache::{CachedFrame, FrameCache, FrameCacheKey};
use super::frame_decoder::{DecoderError, VideoDecoder};
use parking_lot::{Mutex, RwLock};
use std::collections::HashMap;
use std::sync::Arc;

pub struct DecoderPool {
    decoders: Arc<RwLock<HashMap<String, Arc<VideoDecoder>>>>,
    /// Track which video path each source_id is using
    decoder_paths: Arc<RwLock<HashMap<String, String>>>,
    source_locks: Arc<RwLock<HashMap<String, Arc<Mutex<()>>>>>,
    frame_cache: FrameCache,
}

impl DecoderPool {
    pub fn new(cache_capacity: usize) -> Self {
        Self {
            decoders: Arc::new(RwLock::new(HashMap::new())),
            decoder_paths: Arc::new(RwLock::new(HashMap::new())),
            source_locks: Arc::new(RwLock::new(HashMap::new())),
            frame_cache: FrameCache::new(cache_capacity),
        }
    }

    fn get_source_lock(&self, source_id: &str) -> Arc<Mutex<()>> {
        {
            let locks = self.source_locks.read();
            if let Some(lock) = locks.get(source_id) {
                return Arc::clone(lock);
            }
        }

        let lock = Arc::new(Mutex::new(()));
        let mut locks = self.source_locks.write();
        let entry = locks
            .entry(source_id.to_string())
            .or_insert_with(|| Arc::clone(&lock));
        Arc::clone(entry)
    }

    pub fn get_or_create_decoder(
        &self,
        source_id: &str,
        video_path: &str,
    ) -> Result<Arc<VideoDecoder>, DecoderError> {
        // Check if we have a cached decoder AND if the path matches
        {
            let decoders = self.decoders.read();
            let paths = self.decoder_paths.read();

            if let Some(decoder) = decoders.get(source_id) {
                // Check if the path matches - if not, we need to recreate the decoder
                if let Some(cached_path) = paths.get(source_id) {
                    if cached_path == video_path {
                        return Ok(Arc::clone(decoder));
                    }
                    // Path changed (e.g., original -> proxy), need to recreate
                    eprintln!(
                        "[DecoderPool] Path changed for {}: {} -> {}",
                        source_id, cached_path, video_path
                    );
                } else {
                    // No path recorded but decoder exists - use it
                    return Ok(Arc::clone(decoder));
                }
            }
        }

        // Remove old decoder if path changed
        {
            let mut decoders = self.decoders.write();
            decoders.remove(source_id);
        }

        let decoder = Arc::new(VideoDecoder::new(video_path)?);

        {
            let mut decoders = self.decoders.write();
            let mut paths = self.decoder_paths.write();
            decoders.insert(source_id.to_string(), Arc::clone(&decoder));
            paths.insert(source_id.to_string(), video_path.to_string());
        }

        self.get_source_lock(source_id);

        Ok(decoder)
    }

    pub fn get_frame(
        &self,
        source_id: &str,
        video_path: &str,
        timestamp: f64,
    ) -> Result<CachedFrame, DecoderError> {
        let cache_key = FrameCacheKey::new(source_id.to_string(), timestamp);

        if let Some(cached_frame) = self.frame_cache.get(&cache_key) {
            return Ok(cached_frame);
        }

        let decode_lock = self.get_source_lock(source_id);
        let _guard = decode_lock.lock();

        let decoder = self.get_or_create_decoder(source_id, video_path)?;
        let decoded_frame = decoder.decode_frame_at(timestamp)?;

        let cached_frame = CachedFrame {
            width: decoded_frame.width,
            height: decoded_frame.height,
            rgb_data: Arc::new(decoded_frame.rgb_data),
            timestamp: decoded_frame.timestamp,
        };

        self.frame_cache.put(cache_key, cached_frame.clone());

        Ok(cached_frame)
    }

    pub fn prefetch_frames(
        &self,
        source_id: &str,
        video_path: &str,
        start_time: f64,
        count: usize,
        fps: f64,
    ) -> Result<(), DecoderError> {
        let frame_duration = 1.0 / fps;

        for i in 0..count {
            let timestamp = start_time + (i as f64 * frame_duration);
            let cache_key = FrameCacheKey::new(source_id.to_string(), timestamp);

            if self.frame_cache.get(&cache_key).is_some() {
                continue;
            }

            match self.get_frame(source_id, video_path, timestamp) {
                Ok(_) => {}
                Err(e) => {
                    eprintln!("Failed to prefetch frame at {}: {}", timestamp, e);
                }
            }
        }

        Ok(())
    }

    pub fn clear_decoder(&self, source_id: &str) {
        let mut decoders = self.decoders.write();
        decoders.remove(source_id);
        let mut paths = self.decoder_paths.write();
        paths.remove(source_id);
        let mut locks = self.source_locks.write();
        locks.remove(source_id);
    }

    pub fn clear_all_decoders(&self) {
        let mut decoders = self.decoders.write();
        decoders.clear();
        let mut paths = self.decoder_paths.write();
        paths.clear();
        let mut locks = self.source_locks.write();
        locks.clear();
    }

    pub fn clear_cache(&self) {
        self.frame_cache.clear();
    }

    pub fn get_cache_stats(&self) -> CacheStats {
        CacheStats {
            size: self.frame_cache.len(),
            capacity: self.frame_cache.capacity(),
            memory_usage_mb: self.frame_cache.memory_usage_mb(),
        }
    }

    pub fn get_decoder_info(&self, source_id: &str) -> Option<DecoderInfo> {
        let decoders = self.decoders.read();
        decoders.get(source_id).map(|decoder| DecoderInfo {
            width: decoder.width(),
            height: decoder.height(),
            duration: decoder.duration(),
            fps: decoder.fps(),
        })
    }
}

impl Clone for DecoderPool {
    fn clone(&self) -> Self {
        Self {
            decoders: Arc::clone(&self.decoders),
            decoder_paths: Arc::clone(&self.decoder_paths),
            source_locks: Arc::clone(&self.source_locks),
            frame_cache: self.frame_cache.clone(),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CacheStats {
    pub size: usize,
    pub capacity: usize,
    pub memory_usage_mb: f64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DecoderInfo {
    pub width: u32,
    pub height: u32,
    pub duration: f64,
    pub fps: f64,
}
