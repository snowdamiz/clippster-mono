use std::sync::Arc;
use std::thread;
use std::time::Duration;
use crossbeam::channel::{Sender, Receiver, bounded};
use std::path::PathBuf;
use super::decoder_pool::DecoderPool;
use super::frame_cache::FrameCache;

const LOOKAHEAD_SECONDS: f64 = 3.0;  // Decode 3 seconds ahead
const PREROLL_SECONDS: f64 = 0.5;    // Keep 0.5 seconds behind

/// Decode task priority
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Priority {
    #[allow(dead_code)]
    Low = 0,
    Normal = 1,
    #[allow(dead_code)]
    High = 2,
    #[allow(dead_code)]
    Critical = 3,
}

/// Task for decode worker
#[derive(Debug, Clone)]
pub struct DecodeTask {
    pub video_path: PathBuf,
    pub start_time: f64,
    pub end_time: f64,
    #[allow(dead_code)]
    pub priority: Priority,
    #[allow(dead_code)]
    pub generation: u32,  // Timeline generation for cache invalidation
}

/// Decode worker pool that decodes frames ahead of playhead
pub struct DecodeWorkerPool {
    workers: Vec<thread::JoinHandle<()>>,
    task_tx: Sender<DecodeTask>,
    shutdown_tx: Sender<()>,
}

impl DecodeWorkerPool {
    pub fn new(num_workers: usize, frame_cache: Arc<FrameCache>) -> Self {
        let (task_tx, task_rx) = bounded::<DecodeTask>(100);
        let (shutdown_tx, shutdown_rx) = bounded::<()>(1);
        
        let task_rx = Arc::new(task_rx);
        let shutdown_rx = Arc::new(shutdown_rx);
        
        let mut workers = Vec::new();
        
        for worker_id in 0..num_workers {
            let task_rx = Arc::clone(&task_rx);
            let shutdown_rx = Arc::clone(&shutdown_rx);
            let frame_cache = Arc::clone(&frame_cache);
            
            let handle = thread::spawn(move || {
                worker_thread(worker_id, task_rx, shutdown_rx, frame_cache);
            });
            
            workers.push(handle);
        }
        
        Self {
            workers,
            task_tx,
            shutdown_tx,
        }
    }
    
    /// Submit a decode task
    pub fn submit_task(&self, task: DecodeTask) -> Result<(), String> {
        self.task_tx.send(task)
            .map_err(|e| format!("Failed to submit task: {}", e))
    }
    
    /// Submit lookahead decode task (decode ahead of playhead)
    pub fn submit_lookahead(&self, video_path: PathBuf, current_time: f64, generation: u32) -> Result<(), String> {
        let start_time = (current_time - PREROLL_SECONDS).max(0.0);
        let end_time = current_time + LOOKAHEAD_SECONDS;
        
        self.submit_task(DecodeTask {
            video_path,
            start_time,
            end_time,
            priority: Priority::Normal,
            generation,
        })
    }
    
    /// Submit critical decode task (immediate playback need)
    #[allow(dead_code)]
    pub fn submit_critical(&self, video_path: PathBuf, time: f64, generation: u32) -> Result<(), String> {
        self.submit_task(DecodeTask {
            video_path,
            start_time: time,
            end_time: time + 0.1,  // Just this frame
            priority: Priority::Critical,
            generation,
        })
    }
    
    /// Shutdown worker pool
    pub fn shutdown(self) {
        let _ = self.shutdown_tx.send(());
        
        for handle in self.workers {
            let _ = handle.join();
        }
    }
}

/// Worker thread that processes decode tasks
fn worker_thread(
    worker_id: usize,
    task_rx: Arc<Receiver<DecodeTask>>,
    shutdown_rx: Arc<Receiver<()>>,
    frame_cache: Arc<FrameCache>,
) {
    let decoder_pool = DecoderPool::new(1);
    
    loop {
        // Check for shutdown signal
        if shutdown_rx.try_recv().is_ok() {
            break;
        }
        
        // Try to get a task
        match task_rx.recv_timeout(Duration::from_millis(100)) {
            Ok(task) => {
                // Process the task
                decode_range(worker_id, &decoder_pool, &frame_cache, task);
            }
            Err(_) => {
                // No task available, continue
                continue;
            }
        }
    }
}

/// Decode a range of frames
fn decode_range(
    worker_id: usize,
    decoder_pool: &DecoderPool,
    frame_cache: &FrameCache,
    task: DecodeTask,
) {
    let frame_interval = 1.0 / 30.0;  // Decode at 30fps intervals
    let mut current_time = task.start_time;
    
    while current_time <= task.end_time {
        // Check if frame is already cached
        let cache_key = super::frame_cache::FrameKey {
            path: task.video_path.to_string_lossy().to_string(),
            timestamp_ms: (current_time * 1000.0) as u64,
        };
        
        if frame_cache.get(&cache_key).is_none() {
            // Decode frame
            match decoder_pool.get_frame(&task.video_path, current_time) {
                Ok(frame) => {
                    // Cache the decoded frame
                    frame_cache.put(cache_key, frame.data);
                }
                Err(e) => {
                    eprintln!("[Worker {}] Failed to decode frame at {}: {}", worker_id, current_time, e);
                }
            }
        }
        
        current_time += frame_interval;
    }
}
