use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, AtomicBool, Ordering};
use std::path::PathBuf;
use parking_lot::Mutex;
use super::audio_decoder::AudioDecoder;

/// Audio engine that provides hardware-paced master clock AND plays actual audio
/// 
/// This is the "truth" for playback timing - video syncs to audio, not the other way around.
/// Audio never stutters; video drops frames if it can't keep up.
pub struct AudioEngine {
    stream: Option<cpal::Stream>,
    playback_time_us: Arc<AtomicU64>,  // Microseconds
    sample_rate: u32,
    channels: u16,
    is_playing: Arc<AtomicBool>,
    samples_played: Arc<AtomicU64>,
    samples_offset: Arc<AtomicU64>,  // Offset to add to samples_played for seek support
    audio_decoder: Arc<Mutex<Option<AudioDecoder>>>,
    video_path: Option<PathBuf>,
    volume: Arc<AtomicU64>,  // Volume as u64 (0-100), stored as percentage * 100
}

impl AudioEngine {
    pub fn new() -> Result<Self, String> {
        let host = cpal::default_host();
        let device = host.default_output_device()
            .ok_or("No output device available")?;
        
        let config = device.default_output_config()
            .map_err(|e| format!("Failed to get default output config: {}", e))?;
        
        let sample_rate = config.sample_rate().0;
        let channels = config.channels();
        
        Ok(Self {
            stream: None,
            playback_time_us: Arc::new(AtomicU64::new(0)),
            sample_rate,
            channels,
            is_playing: Arc::new(AtomicBool::new(false)),
            samples_played: Arc::new(AtomicU64::new(0)),
            samples_offset: Arc::new(AtomicU64::new(0)),
            audio_decoder: Arc::new(Mutex::new(None)),
            video_path: None,
            volume: Arc::new(AtomicU64::new(10000)),  // 100.00% volume (stored as percentage * 100)
        })
    }
    
    /// Load audio from a video file
    pub fn load_video(&mut self, path: PathBuf) -> Result<(), String> {
        // Always decode to stereo (2 channels) regardless of device output channels
        // The audio callback will handle channel mapping if needed
        let decode_channels = 2u16;
        let decoder = AudioDecoder::new(&path, self.sample_rate, decode_channels)?;
        *self.audio_decoder.lock() = Some(decoder);
        self.video_path = Some(path);
        println!("[AudioEngine] Loaded audio from video, sample_rate={}, decode_channels={}, device_channels={}", 
            self.sample_rate, decode_channels, self.channels);
        Ok(())
    }
    
    /// Start audio playback with actual audio from the loaded video
    pub fn start(&mut self) -> Result<(), String> {
        // Always set is_playing to true, even if stream already exists
        // This ensures audio resumes after pause->seek->play
        if self.stream.is_some() {
            self.is_playing.store(true, Ordering::Relaxed);
            return Ok(());
        }
        
        let host = cpal::default_host();
        let device = host.default_output_device()
            .ok_or("No output device available")?;
        
        let config = device.default_output_config()
            .map_err(|e| format!("Failed to get default output config: {}", e))?;
        
        let sample_rate = config.sample_rate().0;
        let channels = config.channels() as usize;
        
        let playback_time_us = Arc::clone(&self.playback_time_us);
        let samples_played = Arc::clone(&self.samples_played);
        let samples_offset = Arc::clone(&self.samples_offset);
        let is_playing = Arc::clone(&self.is_playing);
        let audio_decoder = Arc::clone(&self.audio_decoder);
        let volume = Arc::clone(&self.volume);
        
        // We always decode to stereo (2 channels), need to map to device channels
        let decode_channels = 2usize;
        
        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => {
                device.build_output_stream(
                    &config.into(),
                    move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                        if !is_playing.load(Ordering::Relaxed) {
                            // Output silence when paused
                            for sample in data.iter_mut() {
                                *sample = 0.0;
                            }
                            return;
                        }
                        
                        // Calculate how many stereo frames we need
                        let device_frames = data.len() / channels;
                        let stereo_samples_needed = device_frames * decode_channels;
                        
                        // Decode stereo audio
                        let mut stereo_buffer = vec![0.0f32; stereo_samples_needed];
                        let mut decoder_guard = audio_decoder.lock();
                        if let Some(decoder) = decoder_guard.as_mut() {
                            decoder.fill_buffer(&mut stereo_buffer);
                        }
                        drop(decoder_guard);
                        
                        // Get current volume (stored as percentage * 100, e.g., 10000 = 100%)
                        let volume_raw = volume.load(Ordering::Relaxed);
                        let volume_multiplier = (volume_raw as f32) / 10000.0;
                        
                        // Map stereo to device channels (e.g., 8 channels)
                        // Put left on channel 0, right on channel 1, silence on others
                        for frame in 0..device_frames {
                            let left = stereo_buffer[frame * 2] * volume_multiplier;
                            let right = stereo_buffer[frame * 2 + 1] * volume_multiplier;
                            
                            for ch in 0..channels {
                                let sample_idx = frame * channels + ch;
                                data[sample_idx] = match ch {
                                    0 => left,  // Front left
                                    1 => right, // Front right
                                    _ => 0.0,   // Other channels silent
                                };
                            }
                        }
                        
                        // Update samples played counter (count stereo frames, not device frames)
                        let played = samples_played.fetch_add(device_frames as u64, Ordering::Relaxed) + device_frames as u64;
                        let offset = samples_offset.load(Ordering::Relaxed);
                        let total_samples = played + offset;
                        
                        // Calculate playback time from samples
                        let time_us = (total_samples * 1_000_000) / sample_rate as u64;
                        playback_time_us.store(time_us, Ordering::Relaxed);
                    },
                    |err| eprintln!("Audio stream error: {}", err),
                    None,
                )
            }
            cpal::SampleFormat::I16 => {
                device.build_output_stream(
                    &config.into(),
                    move |data: &mut [i16], _: &cpal::OutputCallbackInfo| {
                        if !is_playing.load(Ordering::Relaxed) {
                            for sample in data.iter_mut() {
                                *sample = 0;
                            }
                            return;
                        }
                        
                        // Calculate how many stereo frames we need
                        let device_frames = data.len() / channels;
                        let stereo_samples_needed = device_frames * decode_channels;
                        
                        // Decode stereo audio as f32
                        let mut stereo_buffer = vec![0.0f32; stereo_samples_needed];
                        let mut decoder_guard = audio_decoder.lock();
                        if let Some(decoder) = decoder_guard.as_mut() {
                            decoder.fill_buffer(&mut stereo_buffer);
                        }
                        drop(decoder_guard);
                        
                        // Map stereo to device channels and convert to i16
                        for frame in 0..device_frames {
                            let left = stereo_buffer[frame * 2];
                            let right = stereo_buffer[frame * 2 + 1];
                            
                            for ch in 0..channels {
                                let sample_idx = frame * channels + ch;
                                let f32_val = match ch {
                                    0 => left,
                                    1 => right,
                                    _ => 0.0,
                                };
                                data[sample_idx] = (f32_val * 32767.0).clamp(-32768.0, 32767.0) as i16;
                            }
                        }
                        
                        let played = samples_played.fetch_add(device_frames as u64, Ordering::Relaxed) + device_frames as u64;
                        let offset = samples_offset.load(Ordering::Relaxed);
                        let total_samples = played + offset;
                        let time_us = (total_samples * 1_000_000) / sample_rate as u64;
                        playback_time_us.store(time_us, Ordering::Relaxed);
                    },
                    |err| eprintln!("Audio stream error: {}", err),
                    None,
                )
            }
            cpal::SampleFormat::U16 => {
                device.build_output_stream(
                    &config.into(),
                    move |data: &mut [u16], _: &cpal::OutputCallbackInfo| {
                        if !is_playing.load(Ordering::Relaxed) {
                            for sample in data.iter_mut() {
                                *sample = 32768;
                            }
                            return;
                        }
                        
                        // Calculate how many stereo frames we need
                        let device_frames = data.len() / channels;
                        let stereo_samples_needed = device_frames * decode_channels;
                        
                        // Decode stereo audio as f32
                        let mut stereo_buffer = vec![0.0f32; stereo_samples_needed];
                        let mut decoder_guard = audio_decoder.lock();
                        if let Some(decoder) = decoder_guard.as_mut() {
                            decoder.fill_buffer(&mut stereo_buffer);
                        }
                        drop(decoder_guard);
                        
                        // Map stereo to device channels and convert to u16
                        for frame in 0..device_frames {
                            let left = stereo_buffer[frame * 2];
                            let right = stereo_buffer[frame * 2 + 1];
                            
                            for ch in 0..channels {
                                let sample_idx = frame * channels + ch;
                                let f32_val = match ch {
                                    0 => left,
                                    1 => right,
                                    _ => 0.0,
                                };
                                data[sample_idx] = ((f32_val + 1.0) * 32767.5).clamp(0.0, 65535.0) as u16;
                            }
                        }
                        
                        let played = samples_played.fetch_add(device_frames as u64, Ordering::Relaxed) + device_frames as u64;
                        let offset = samples_offset.load(Ordering::Relaxed);
                        let total_samples = played + offset;
                        let time_us = (total_samples * 1_000_000) / sample_rate as u64;
                        playback_time_us.store(time_us, Ordering::Relaxed);
                    },
                    |err| eprintln!("Audio stream error: {}", err),
                    None,
                )
            }
            _ => return Err("Unsupported sample format".to_string()),
        }.map_err(|e| format!("Failed to build output stream: {}", e))?;
        
        stream.play().map_err(|e| format!("Failed to play stream: {}", e))?;
        
        self.stream = Some(stream);
        self.is_playing.store(true, Ordering::Relaxed);
        
        Ok(())
    }
    
    /// Pause audio (stops updating time)
    pub fn pause(&mut self) {
        self.is_playing.store(false, Ordering::Relaxed);
    }
    
    /// Resume audio
    #[allow(dead_code)]
    pub fn resume(&mut self) {
        self.is_playing.store(true, Ordering::Relaxed);
    }
    
    /// Get current playback time in seconds (hardware-paced)
    pub fn current_time(&self) -> f64 {
        self.playback_time_us.load(Ordering::Relaxed) as f64 / 1_000_000.0
    }
    
    /// Seek to a specific time
    pub fn seek(&mut self, time: f64) {
        let time_us = (time * 1_000_000.0) as u64;
        self.playback_time_us.store(time_us, Ordering::Relaxed);
        
        // Reset samples_played to 0 and set offset to the seek position
        // This way the audio callback adds from 0, and we add offset to get correct time
        let target_samples = (time * self.sample_rate as f64) as u64;
        self.samples_played.store(0, Ordering::Relaxed);
        self.samples_offset.store(target_samples, Ordering::Relaxed);
        
        println!("[AudioEngine] Seek to {:.3}s: samples_offset={}, samples_played=0", time, target_samples);
        
        // Seek the audio decoder
        if let Some(decoder) = self.audio_decoder.lock().as_mut() {
            if let Err(e) = decoder.seek(time) {
                eprintln!("[AudioEngine] Failed to seek audio: {}", e);
            }
        }
    }
    
    /// Stop audio and reset
    pub fn stop(&mut self) {
        self.is_playing.store(false, Ordering::Relaxed);
        self.stream = None;
        self.playback_time_us.store(0, Ordering::Relaxed);
        self.samples_played.store(0, Ordering::Relaxed);
        self.samples_offset.store(0, Ordering::Relaxed);
    }
    
    /// Get sample rate
    #[allow(dead_code)]
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }
    
    /// Set volume (0-100)
    pub fn set_volume(&self, volume_percent: f32) {
        let clamped = volume_percent.clamp(0.0, 100.0);
        let volume_value = (clamped * 100.0) as u64; // Store as percentage * 100
        self.volume.store(volume_value, Ordering::Relaxed);
        println!("[AudioEngine] Volume set to {:.2}%", clamped);
    }
}

impl Drop for AudioEngine {
    fn drop(&mut self) {
        self.stop();
    }
}
