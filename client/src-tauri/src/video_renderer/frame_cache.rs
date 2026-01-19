use lru::LruCache;
use parking_lot::Mutex;
use std::num::NonZeroUsize;

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct FrameKey {
    pub path: String,
    pub timestamp_ms: u64,
}

pub struct FrameCache {
    cache: Mutex<LruCache<FrameKey, Vec<u8>>>,
}

impl FrameCache {
    pub fn new(capacity: usize) -> Self {
        Self {
            cache: Mutex::new(LruCache::new(NonZeroUsize::new(capacity).unwrap())),
        }
    }
    
    pub fn get(&self, key: &FrameKey) -> Option<Vec<u8>> {
        self.cache.lock().get(key).cloned()
    }
    
    pub fn put(&self, key: FrameKey, value: Vec<u8>) {
        self.cache.lock().put(key, value);
    }
    
    pub fn clear(&self) {
        self.cache.lock().clear();
    }
    
    /// Invalidate cache entries in a specific time range
    /// This allows cache to survive edits outside the affected range
    pub fn invalidate_range(&self, path: &str, start_time: f64, end_time: f64) {
        let start_ms = (start_time * 1000.0) as u64;
        let end_ms = (end_time * 1000.0) as u64;
        
        let mut cache = self.cache.lock();
        
        // Collect keys to remove
        let keys_to_remove: Vec<FrameKey> = cache
            .iter()
            .filter(|(key, _)| {
                key.path == path && key.timestamp_ms >= start_ms && key.timestamp_ms <= end_ms
            })
            .map(|(key, _)| key.clone())
            .collect();
        
        // Remove the keys
        for key in keys_to_remove {
            cache.pop(&key);
        }
    }
    
    /// Invalidate all entries for a specific video path
    pub fn invalidate_path(&self, path: &str) {
        let mut cache = self.cache.lock();
        
        let keys_to_remove: Vec<FrameKey> = cache
            .iter()
            .filter(|(key, _)| key.path == path)
            .map(|(key, _)| key.clone())
            .collect();
        
        for key in keys_to_remove {
            cache.pop(&key);
        }
    }
    
    pub fn len(&self) -> usize {
        self.cache.lock().len()
    }
    
    pub fn is_empty(&self) -> bool {
        self.cache.lock().is_empty()
    }
}
