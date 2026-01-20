use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::thread;
use std::time::Duration;
use parking_lot::RwLock;
use crossbeam::channel::{Sender, Receiver, bounded};
use tauri::Emitter;
use super::audio_engine::AudioEngine;
use super::decoder::VideoDecoder;
use std::path::PathBuf;

const RING_BUFFER_SIZE: usize = 64; // 64 frame slots (~2 seconds at 30fps)

/// Frame slot in the ring buffer
#[derive(Clone)]
pub struct FrameSlot {
    pub pixels: Vec<u8>,      // RGBA pixel data (tightly packed, stride = width * 4)
    pub width: u32,
    pub height: u32,
    pub timestamp: f64,
    pub sequence: u64,
    pub generation: u32,      // Incremented on timeline changes
}

impl Default for FrameSlot {
    fn default() -> Self {
        Self {
            pixels: Vec::new(),
            width: 0,
            height: 0,
            timestamp: 0.0,
            sequence: 0,
            generation: 0,
        }
    }
}

/// Ring buffer for decoded frames
pub struct FrameRing {
    slots: Vec<RwLock<FrameSlot>>,
    write_index: AtomicU32,
    #[allow(dead_code)]
    read_index: AtomicU32,
}

impl FrameRing {
    pub fn new() -> Self {
        let mut slots = Vec::with_capacity(RING_BUFFER_SIZE);
        for _ in 0..RING_BUFFER_SIZE {
            slots.push(RwLock::new(FrameSlot::default()));
        }
        
        Self {
            slots,
            write_index: AtomicU32::new(0),
            read_index: AtomicU32::new(0),
        }
    }
    
    /// Write a frame to the next available slot
    pub fn write_frame(&self, pixels: Vec<u8>, width: u32, height: u32, timestamp: f64, sequence: u64, generation: u32) -> u32 {
        let slot_id = self.write_index.fetch_add(1, Ordering::Relaxed) % RING_BUFFER_SIZE as u32;
        
        let mut slot = self.slots[slot_id as usize].write();
        slot.pixels = pixels;
        slot.width = width;
        slot.height = height;
        slot.timestamp = timestamp;
        slot.sequence = sequence;
        slot.generation = generation;
        
        slot_id
    }
    
    /// Read a frame from a specific slot
    pub fn read_slot(&self, slot_id: u32) -> Option<FrameSlot> {
        if slot_id >= RING_BUFFER_SIZE as u32 {
            return None;
        }
        
        let slot = self.slots[slot_id as usize].read();
        Some(slot.clone())
    }
    
    /// Clear all slots
    #[allow(dead_code)]
    pub fn clear(&self) {
        for slot in &self.slots {
            let mut s = slot.write();
            s.pixels.clear();
            s.width = 0;
            s.height = 0;
            s.timestamp = 0.0;
            s.sequence = 0;
        }
        self.write_index.store(0, Ordering::Relaxed);
        self.read_index.store(0, Ordering::Relaxed);
    }
}

/// Playback command sent from main thread to playback thread
#[derive(Debug, Clone)]
pub enum PlaybackCommand {
    Play,
    Pause,
    Seek(f64),
    #[allow(dead_code)]
    SetPlaybackRate(f64),
    SetVolume(f32),  // Volume 0-100
    Stop,
}

/// Playback state
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PlaybackState {
    Stopped,
    Playing,
    Paused,
}

/// Playback engine that manages frame decoding and delivery
pub struct PlaybackEngine {
    frame_ring: Arc<FrameRing>,
    is_playing: Arc<AtomicBool>,
    playback_time: Arc<AtomicU64>,  // Stored as microseconds
    playback_rate: Arc<RwLock<f64>>,
    state: Arc<RwLock<PlaybackState>>,
    command_tx: Sender<PlaybackCommand>,
    command_rx: Receiver<PlaybackCommand>,
    thread_handle: Option<thread::JoinHandle<()>>,
    sequence_counter: Arc<AtomicU64>,
    generation: Arc<AtomicU32>,
}

impl PlaybackEngine {
    pub fn new() -> Self {
        let (command_tx, command_rx) = bounded(10);
        
        Self {
            frame_ring: Arc::new(FrameRing::new()),
            is_playing: Arc::new(AtomicBool::new(false)),
            playback_time: Arc::new(AtomicU64::new(0)),
            playback_rate: Arc::new(RwLock::new(1.0)),
            state: Arc::new(RwLock::new(PlaybackState::Stopped)),
            command_tx,
            command_rx,
            thread_handle: None,
            sequence_counter: Arc::new(AtomicU64::new(0)),
            generation: Arc::new(AtomicU32::new(0)),
        }
    }
    
    /// Start the playback thread
    pub fn start(&mut self, video_path: String, app_handle: tauri::AppHandle, enable_audio: bool) {
        let frame_ring = Arc::clone(&self.frame_ring);
        let is_playing = Arc::clone(&self.is_playing);
        let playback_time = Arc::clone(&self.playback_time);
        let playback_rate = Arc::clone(&self.playback_rate);
        let state = Arc::clone(&self.state);
        let command_rx = self.command_rx.clone();
        let sequence_counter = Arc::clone(&self.sequence_counter);
        let generation = Arc::clone(&self.generation);
        
        let handle = thread::spawn(move || {
            playback_thread(
                video_path,
                frame_ring,
                is_playing,
                playback_time,
                playback_rate,
                state,
                command_rx,
                app_handle,
                sequence_counter,
                generation,
                enable_audio,
            );
        });
        
        self.thread_handle = Some(handle);
    }
    
    /// Send a command to the playback thread
    pub fn send_command(&self, command: PlaybackCommand) -> Result<(), String> {
        self.command_tx.send(command)
            .map_err(|e| format!("Failed to send command: {}", e))
    }
    
    /// Get current playback time in seconds
    #[allow(dead_code)]
    pub fn get_time(&self) -> f64 {
        self.playback_time.load(Ordering::Relaxed) as f64 / 1_000_000.0
    }
    
    /// Get current playback state
    pub fn get_state(&self) -> PlaybackState {
        *self.state.read()
    }
    
    /// Read a frame slot
    pub fn read_slot(&self, slot_id: u32) -> Option<FrameSlot> {
        self.frame_ring.read_slot(slot_id)
    }
    
    /// Increment generation (invalidates cache on timeline changes)
    #[allow(dead_code)]
    pub fn increment_generation(&self) {
        self.generation.fetch_add(1, Ordering::Relaxed);
    }
}

/// Playback thread main loop - audio-driven timing with lookahead decode
fn playback_thread(
    video_path: String,
    frame_ring: Arc<FrameRing>,
    is_playing: Arc<AtomicBool>,
    playback_time: Arc<AtomicU64>,
    playback_rate: Arc<RwLock<f64>>,
    state: Arc<RwLock<PlaybackState>>,
    command_rx: Receiver<PlaybackCommand>,
    app_handle: tauri::AppHandle,
    sequence_counter: Arc<AtomicU64>,
    generation: Arc<AtomicU32>,
    enable_audio: bool,
) {
    let path = PathBuf::from(&video_path);
    
    // Create dedicated decoder for playback (NOT shared with preview/scrubbing)
    let mut playback_decoder = match VideoDecoder::new(&path) {
        Ok(decoder) => decoder,
        Err(e) => {
            eprintln!("[PlaybackThread] Failed to create playback decoder: {}", e);
            return;
        }
    };
    
    // Get video dimensions
    let (video_width, video_height) = playback_decoder.dimensions();
    println!("[PlaybackThread] Video dimensions: {}x{}", video_width, video_height);
    
    // Get video duration for end-of-stream detection
    let video_duration = playback_decoder.duration();
    println!("[PlaybackThread] Video duration: {:.2}s", video_duration);
    
    // Audio engine is the master clock AND optionally plays actual audio
    let mut audio_engine = match AudioEngine::new() {
        Ok(mut engine) => {
            // Only load audio if enabled
            if enable_audio {
                if let Err(e) = engine.load_video(path.clone()) {
                    eprintln!("[PlaybackThread] Failed to load audio from video: {} (continuing without audio)", e);
                } else {
                    println!("[PlaybackThread] Audio loaded from video successfully");
                }
            } else {
                println!("[PlaybackThread] Audio playback disabled (separate audio tracks present)");
            }
            println!("[PlaybackThread] Audio engine created successfully");
            engine
        },
        Err(e) => {
            eprintln!("[PlaybackThread] Failed to create audio engine: {}", e);
            return;
        }
    };
    
    let frame_duration = Duration::from_millis(33); // ~30fps target
    let mut frame_count = 0u64;
    let mut last_frame_time = 0.0f64;
    let mut needs_seek = false;
    let mut seek_target = 0.0f64;
    
    println!("[PlaybackThread] Entering playback loop (sequential decode mode)");
    
    loop {
        // Check for commands
        if let Ok(command) = command_rx.try_recv() {
            match command {
                PlaybackCommand::Play => {
                    println!("[PlaybackThread] Received Play command");
                    
                    // IMPORTANT: Complete pending video seek BEFORE starting audio
                    // This ensures audio and video start from the exact same position
                    if needs_seek {
                        println!("[PlaybackThread] Completing pending seek to {:.2}s before starting audio", seek_target);
                        if let Err(e) = playback_decoder.seek_to_timestamp(seek_target) {
                            eprintln!("[PlaybackThread] Seek failed: {}", e);
                        }
                        last_frame_time = seek_target;
                        needs_seek = false;
                    }
                    
                    is_playing.store(true, Ordering::Relaxed);
                    *state.write() = PlaybackState::Playing;
                    
                    // Set global playback flag to prevent get_frame_at from decoding
                    super::set_playback_active(true);
                    
                    // Start audio engine (provides hardware-paced timing)
                    match audio_engine.start() {
                        Ok(_) => println!("[PlaybackThread] Audio engine started successfully"),
                        Err(e) => eprintln!("[PlaybackThread] Failed to start audio: {}", e),
                    }
                }
                PlaybackCommand::Pause => {
                    is_playing.store(false, Ordering::Relaxed);
                    *state.write() = PlaybackState::Paused;
                    
                    // Clear global playback flag to allow get_frame_at for scrubbing
                    super::set_playback_active(false);
                    
                    audio_engine.pause();
                }
                PlaybackCommand::Seek(time) => {
                    audio_engine.seek(time);
                    playback_time.store((time * 1_000_000.0) as u64, Ordering::Relaxed);
                    // Mark that we need to seek the video decoder
                    needs_seek = true;
                    seek_target = time;
                }
                PlaybackCommand::SetPlaybackRate(rate) => {
                    *playback_rate.write() = rate;
                    // Note: playback rate not yet supported in audio engine
                }
                PlaybackCommand::SetVolume(volume) => {
                    audio_engine.set_volume(volume);
                }
                PlaybackCommand::Stop => {
                    *state.write() = PlaybackState::Stopped;
                    
                    // Clear global playback flag
                    super::set_playback_active(false);
                    
                    audio_engine.stop();
                    break;
                }
            }
        }
        
        // If playing, decode and emit frames sequentially
        if is_playing.load(Ordering::Relaxed) {
            // Handle seek if needed
            if needs_seek {
                println!("[PlaybackThread] Seeking to {:.2}s", seek_target);
                if let Err(e) = playback_decoder.seek_to_timestamp(seek_target) {
                    eprintln!("[PlaybackThread] Seek failed: {}", e);
                }
                last_frame_time = seek_target;
                needs_seek = false;
            }
            
            // Get current time from audio engine (hardware-paced)
            let current_time = audio_engine.current_time();
            
            // Check if we've reached the end of the video
            if current_time >= video_duration {
                println!("[PlaybackThread] Reached end of video at {:.2}s (duration: {:.2}s)", current_time, video_duration);
                is_playing.store(false, Ordering::Relaxed);
                *state.write() = PlaybackState::Paused;
                super::set_playback_active(false);
                audio_engine.pause();
                
                // Emit end event
                let _ = app_handle.emit("playback:ended", serde_json::json!({
                    "time": video_duration,
                }));
                continue;
            }
            
            // Update playback time from audio clock
            playback_time.store((current_time * 1_000_000.0) as u64, Ordering::Relaxed);
            
            // Log audio clock state for debugging
            if frame_count < 10 || frame_count % 60 == 0 {
                println!("[PlaybackThread] CLOCK: audio_time={:.3}s, last_frame_time={:.3}s, frame_count={}", 
                    current_time, last_frame_time, frame_count);
            }
            
            // Decode next frame sequentially (no random access!)
            // Only decode if we need a new frame (audio time has advanced past last frame)
            if current_time >= last_frame_time {
                match playback_decoder.decode_next_frame() {
                    Ok(frame) => {
                        let sequence = sequence_counter.fetch_add(1, Ordering::Relaxed);
                        
                        frame_count += 1;
                        let frame_pts = frame.timestamp;
                        
                        // Log the timing for debugging
                        if frame_count <= 10 {
                            println!("[PlaybackThread] DECODE {}: frame_pts={:.3}s, audio_time={:.3}s, waiting={}", 
                                frame_count, frame_pts, current_time, frame_pts > current_time);
                        }
                        
                        // Wait until audio clock reaches this frame's presentation time
                        // This is the key A/V sync mechanism
                        let mut wait_count = 0;
                        while audio_engine.current_time() < frame_pts {
                            wait_count += 1;
                            thread::sleep(Duration::from_millis(1));
                            
                            // Log waiting state
                            if wait_count == 1 || wait_count % 100 == 0 {
                                println!("[PlaybackThread] WAIT {}: frame_pts={:.3}s, audio_time={:.3}s, waited={}ms", 
                                    frame_count, frame_pts, audio_engine.current_time(), wait_count);
                            }
                            
                            // Check if we're still playing (user might have paused)
                            if !is_playing.load(Ordering::Relaxed) {
                                println!("[PlaybackThread] WAIT interrupted - paused");
                                break;
                            }
                            
                            // Safety timeout - don't wait more than 1 second
                            if wait_count > 1000 {
                                println!("[PlaybackThread] WAIT TIMEOUT: frame_pts={:.3}s, audio_time={:.3}s", 
                                    frame_pts, audio_engine.current_time());
                                break;
                            }
                        }
                        
                        // Only emit if still playing
                        if !is_playing.load(Ordering::Relaxed) {
                            continue;
                        }
                        
                        last_frame_time = frame_pts;
                        
                        // Get current generation
                        let gen = generation.load(Ordering::Relaxed);
                        
                        // Write frame to ring buffer (fast - just memory copy)
                        let slot_id = frame_ring.write_frame(
                            frame.data,
                            video_width,
                            video_height,
                            frame_pts,
                            sequence,
                            gen,
                        );
                        
                        if frame_count <= 5 || frame_count % 30 == 0 {
                            println!("[PlaybackThread] EMIT {}: time={:.3}s, slot={}, audio_time={:.3}s", 
                                frame_count, frame_pts, slot_id, audio_engine.current_time());
                        }
                        
                        // Emit only slot ID (tiny payload, fast - no 8MB JSON serialization)
                        if let Err(e) = app_handle.emit("playback:frame", serde_json::json!({
                            "time": frame_pts,
                            "sequence": sequence,
                            "slot": slot_id,
                            "width": video_width,
                            "height": video_height,
                        })) {
                            eprintln!("[PlaybackThread] Failed to emit frame event: {}", e);
                        }
                    }
                    Err(e) => {
                        if e.contains("End of stream") {
                            println!("[PlaybackThread] Reached end of stream");
                            is_playing.store(false, Ordering::Relaxed);
                            *state.write() = PlaybackState::Paused;
                            super::set_playback_active(false);
                            audio_engine.pause();
                            
                            let _ = app_handle.emit("playback:ended", serde_json::json!({
                                "time": video_duration,
                            }));
                        } else if frame_count % 30 == 0 {
                            eprintln!("[PlaybackThread] Decode error: {}", e);
                        }
                    }
                }
            } else {
                // Audio hasn't caught up yet, sleep briefly
                thread::sleep(Duration::from_millis(1));
            }
        } else {
            // Sleep longer when paused
            thread::sleep(Duration::from_millis(10));
        }
    }
    
    // Playback decoder is dropped automatically when function exits
}
