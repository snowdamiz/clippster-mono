use super::frame_cache::{CachedFrame, FrameCache, FrameCacheKey};
use super::frame_decoder::{VideoDecoder, DecoderError};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;

pub struct DecoderPool {
    decoders: Arc<RwLock<HashMap<String, Arc<VideoDecoder>>>>,
    frame_cache: FrameCache,
}

impl DecoderPool {
    pub fn new(cache_capacity: usize) -> Self {
        Self {
            decoders: Arc::new(RwLock::new(HashMap::new())),
            frame_cache: FrameCache::new(cache_capacity),
        }
    }

    pub fn get_or_create_decoder(&self, source_id: &str, video_path: &str) -> Result<Arc<VideoDecoder>, DecoderError> {
        {
            let decoders = self.decoders.read();
            if let Some(decoder) = decoders.get(source_id) {
                return Ok(Arc::clone(decoder));
            }
        }

        let decoder = Arc::new(VideoDecoder::new(video_path)?);
        
        {
            let mut decoders = self.decoders.write();
            decoders.insert(source_id.to_string(), Arc::clone(&decoder));
        }

        Ok(decoder)
    }

    pub fn get_frame(&self, source_id: &str, video_path: &str, timestamp: f64) -> Result<CachedFrame, DecoderError> {
        let cache_key = FrameCacheKey::new(source_id.to_string(), timestamp);
        
        if let Some(cached_frame) = self.frame_cache.get(&cache_key) {
            return Ok(cached_frame);
        }

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

    pub fn prefetch_frames(&self, source_id: &str, video_path: &str, start_time: f64, count: usize, fps: f64) -> Result<(), DecoderError> {
        let frame_duration = 1.0 / fps;
        
        for i in 0..count {
            let timestamp = start_time + (i as f64 * frame_duration);
            let cache_key = FrameCacheKey::new(source_id.to_string(), timestamp);
            
            if self.frame_cache.get(&cache_key).is_some() {
                continue;
            }

            match self.get_frame(source_id, video_path, timestamp) {
                Ok(_) => {},
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
    }

    pub fn clear_all_decoders(&self) {
        let mut decoders = self.decoders.write();
        decoders.clear();
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
