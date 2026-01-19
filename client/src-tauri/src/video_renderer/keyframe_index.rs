use std::path::{Path, PathBuf};
use std::collections::HashMap;
use parking_lot::RwLock;
use std::sync::Arc;

/// Keyframe index entry
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct KeyframeEntry {
    pub timestamp: f64,
    pub byte_offset: i64,
    pub pts: i64,
}

/// Keyframe index for a video file
#[allow(dead_code)]
pub struct KeyframeIndex {
    entries: Vec<KeyframeEntry>,
}

#[allow(dead_code)]
impl KeyframeIndex {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }
    
    /// Build keyframe index from video file
    pub fn build(video_path: &Path) -> Result<Self, String> {
        use ffmpeg_next as ffmpeg;
        
        ffmpeg::init().map_err(|e| e.to_string())?;
        
        let mut input = ffmpeg::format::input(video_path)
            .map_err(|e| format!("Failed to open video: {}", e))?;
        
        let video_stream = input
            .streams()
            .best(ffmpeg::media::Type::Video)
            .ok_or("No video stream found")?;
        
        let stream_index = video_stream.index();
        let time_base = video_stream.time_base();
        
        let mut entries = Vec::new();
        
        // Scan for keyframes
        for (stream, packet) in input.packets() {
            if stream.index() == stream_index && packet.is_key() {
                let pts = packet.pts().unwrap_or(0);
                let timestamp = pts as f64 * f64::from(time_base);
                let byte_offset = packet.position() as i64;
                
                entries.push(KeyframeEntry {
                    timestamp,
                    byte_offset,
                    pts,
                });
            }
        }
        
        Ok(Self { entries })
    }
    
    /// Find the nearest keyframe before or at the given timestamp
    pub fn find_keyframe(&self, timestamp: f64) -> Option<&KeyframeEntry> {
        // Binary search for the keyframe at or before timestamp
        let idx = self.entries.binary_search_by(|entry| {
            entry.timestamp.partial_cmp(&timestamp).unwrap()
        });
        
        match idx {
            Ok(i) => Some(&self.entries[i]),
            Err(i) => {
                if i > 0 {
                    Some(&self.entries[i - 1])
                } else {
                    None
                }
            }
        }
    }
    
    /// Get all keyframe timestamps
    pub fn get_timestamps(&self) -> Vec<f64> {
        self.entries.iter().map(|e| e.timestamp).collect()
    }
    
    /// Get number of keyframes
    pub fn len(&self) -> usize {
        self.entries.len()
    }
}

/// Keyframe index cache for multiple videos
#[allow(dead_code)]
pub struct KeyframeIndexCache {
    cache: Arc<RwLock<HashMap<PathBuf, Arc<KeyframeIndex>>>>,
}

#[allow(dead_code)]
impl KeyframeIndexCache {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Get or build keyframe index for a video
    pub fn get_or_build(&self, video_path: &Path) -> Result<Arc<KeyframeIndex>, String> {
        // Check cache first
        {
            let cache = self.cache.read();
            if let Some(index) = cache.get(video_path) {
                return Ok(Arc::clone(index));
            }
        }
        
        // Build index
        let index = KeyframeIndex::build(video_path)?;
        let index = Arc::new(index);
        
        // Store in cache
        {
            let mut cache = self.cache.write();
            cache.insert(video_path.to_path_buf(), Arc::clone(&index));
        }
        
        Ok(index)
    }
    
    /// Clear cache
    pub fn clear(&self) {
        let mut cache = self.cache.write();
        cache.clear();
    }
}
