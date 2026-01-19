use lru::LruCache;
use parking_lot::Mutex;
use std::num::NonZeroUsize;

#[derive(Hash, Eq, PartialEq, Clone)]
pub struct FrameKey {
    pub path: String,
    pub timestamp_ms: u64,  // Millisecond precision
}

pub struct FrameCache {
    cache: Mutex<LruCache<FrameKey, Vec<u8>>>,  // RGB data
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
    
    pub fn put(&self, key: FrameKey, data: Vec<u8>) {
        self.cache.lock().put(key, data);
    }
    
    pub fn clear(&self) {
        self.cache.lock().clear();
    }
    
    pub fn len(&self) -> usize {
        self.cache.lock().len()
    }
    
    pub fn is_empty(&self) -> bool {
        self.cache.lock().is_empty()
    }
}
