use std::collections::HashMap;
use std::path::PathBuf;
use parking_lot::Mutex;
use super::decoder::{VideoDecoder, DecodedFrame};

pub struct DecoderPool {
    decoders: Mutex<HashMap<PathBuf, VideoDecoder>>,
    max_decoders: usize,
}

impl DecoderPool {
    pub fn new(max_decoders: usize) -> Self {
        Self {
            decoders: Mutex::new(HashMap::new()),
            max_decoders,
        }
    }
    
    pub fn get_frame(&self, path: &PathBuf, timestamp: f64) -> Result<DecodedFrame, String> {
        let mut decoders = self.decoders.lock();
        
        // Enforce max decoders limit
        if decoders.len() >= self.max_decoders && !decoders.contains_key(path) {
            // Remove oldest decoder (simple strategy - could be improved with LRU)
            if let Some(key) = decoders.keys().next().cloned() {
                decoders.remove(&key);
            }
        }
        
        // Get or create decoder
        let decoder = decoders.entry(path.clone()).or_insert_with(|| {
            VideoDecoder::new(path).expect("Failed to create decoder")
        });
        
        // Seek to keyframe before target, then decode forward to target frame
        decoder.seek_to_timestamp(timestamp)?;
        decoder.decode_frame_at(timestamp)
    }
    
    pub fn get_video_dimensions(&self, path: &PathBuf) -> Result<(u32, u32), String> {
        let mut decoders = self.decoders.lock();
        
        let decoder = decoders.entry(path.clone()).or_insert_with(|| {
            VideoDecoder::new(path).expect("Failed to create decoder")
        });
        
        Ok((decoder.width(), decoder.height()))
    }
    
    pub fn get_video_duration(&self, path: &PathBuf) -> Result<f64, String> {
        let mut decoders = self.decoders.lock();
        
        let decoder = decoders.entry(path.clone()).or_insert_with(|| {
            VideoDecoder::new(path).expect("Failed to create decoder")
        });
        
        Ok(decoder.duration())
    }
    
    #[allow(dead_code)]
    pub fn clear(&self) {
        self.decoders.lock().clear();
    }
}
