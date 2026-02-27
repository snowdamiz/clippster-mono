use lru::LruCache;
use parking_lot::Mutex;
use std::num::NonZeroUsize;
use std::sync::Arc;

#[derive(Clone)]
pub struct CachedFrame {
    pub width: u32,
    pub height: u32,
    pub rgb_data: Arc<Vec<u8>>,
    pub timestamp: f64,
}

#[derive(Clone, Hash, Eq, PartialEq)]
pub struct FrameCacheKey {
    pub source_id: String,
    pub timestamp_millis: i64,
}

impl FrameCacheKey {
    pub fn new(source_id: String, timestamp: f64) -> Self {
        Self {
            source_id,
            timestamp_millis: (timestamp * 1000.0).round() as i64,
        }
    }
}

pub struct FrameCache {
    cache: Arc<Mutex<LruCache<FrameCacheKey, CachedFrame>>>,
    capacity: usize,
}

impl FrameCache {
    pub fn new(capacity: usize) -> Self {
        let cache = LruCache::new(NonZeroUsize::new(capacity).unwrap());
        Self {
            cache: Arc::new(Mutex::new(cache)),
            capacity,
        }
    }

    pub fn get(&self, key: &FrameCacheKey) -> Option<CachedFrame> {
        let mut cache = self.cache.lock();
        cache.get(key).cloned()
    }

    pub fn put(&self, key: FrameCacheKey, frame: CachedFrame) {
        let mut cache = self.cache.lock();
        cache.put(key, frame);
    }

    pub fn clear(&self) {
        let mut cache = self.cache.lock();
        cache.clear();
    }

    pub fn len(&self) -> usize {
        let cache = self.cache.lock();
        cache.len()
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn memory_usage_bytes(&self) -> usize {
        let cache = self.cache.lock();
        let mut total = 0;
        for (_, frame) in cache.iter() {
            total += frame.rgb_data.len();
        }
        total
    }

    pub fn memory_usage_mb(&self) -> f64 {
        self.memory_usage_bytes() as f64 / (1024.0 * 1024.0)
    }
}

impl Clone for FrameCache {
    fn clone(&self) -> Self {
        Self {
            cache: Arc::clone(&self.cache),
            capacity: self.capacity,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_frame_cache_basic() {
        let cache = FrameCache::new(2);

        let key1 = FrameCacheKey::new("video1".to_string(), 1.0);
        let frame1 = CachedFrame {
            width: 1920,
            height: 1080,
            rgb_data: Arc::new(vec![0u8; 1920 * 1080 * 3]),
            timestamp: 1.0,
        };

        cache.put(key1.clone(), frame1.clone());
        assert!(cache.get(&key1).is_some());
        assert_eq!(cache.len(), 1);
    }

    #[test]
    fn test_frame_cache_lru_eviction() {
        let cache = FrameCache::new(2);

        let key1 = FrameCacheKey::new("video1".to_string(), 1.0);
        let key2 = FrameCacheKey::new("video1".to_string(), 2.0);
        let key3 = FrameCacheKey::new("video1".to_string(), 3.0);

        let frame = CachedFrame {
            width: 1920,
            height: 1080,
            rgb_data: Arc::new(vec![0u8; 100]),
            timestamp: 1.0,
        };

        cache.put(key1.clone(), frame.clone());
        cache.put(key2.clone(), frame.clone());
        cache.put(key3.clone(), frame.clone());

        assert!(cache.get(&key1).is_none());
        assert!(cache.get(&key2).is_some());
        assert!(cache.get(&key3).is_some());
        assert_eq!(cache.len(), 2);
    }
}
