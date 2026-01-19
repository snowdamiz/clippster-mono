use ffmpeg_next as ffmpeg;
use std::path::Path;
use std::collections::VecDeque;
use parking_lot::Mutex;
use std::sync::Arc;

/// Audio decoder that extracts and resamples audio from video files
pub struct AudioDecoder {
    input_context: ffmpeg::format::context::Input,
    audio_stream_index: usize,
    decoder: ffmpeg::decoder::Audio,
    resampler: ffmpeg::software::resampling::Context,
    sample_rate: u32,
    channels: u16,
    // Decoded audio buffer (interleaved f32 samples)
    buffer: VecDeque<f32>,
    // Current position in samples
    position_samples: u64,
}

// SAFETY: AudioDecoder is only accessed behind a mutex,
// so it is never used concurrently across threads.
unsafe impl Send for AudioDecoder {}

impl AudioDecoder {
    pub fn new(path: &Path, target_sample_rate: u32, target_channels: u16) -> Result<Self, String> {
        ffmpeg::init().map_err(|e| e.to_string())?;
        
        let input = ffmpeg::format::input(path)
            .map_err(|e| format!("Failed to open video for audio: {}", e))?;
        
        let audio_stream = input
            .streams()
            .best(ffmpeg::media::Type::Audio)
            .ok_or("No audio stream found")?;
        
        let audio_stream_index = audio_stream.index();
        
        let context = ffmpeg::codec::context::Context::from_parameters(audio_stream.parameters())
            .map_err(|e| e.to_string())?;
        
        let decoder = context
            .decoder()
            .audio()
            .map_err(|e| e.to_string())?;
        
        // Create resampler to convert to target format (f32, target sample rate, target channels)
        let resampler = ffmpeg::software::resampling::Context::get(
            decoder.format(),
            decoder.channel_layout(),
            decoder.rate(),
            ffmpeg::format::Sample::F32(ffmpeg::format::sample::Type::Packed),
            if target_channels == 1 {
                ffmpeg::channel_layout::ChannelLayout::MONO
            } else {
                ffmpeg::channel_layout::ChannelLayout::STEREO
            },
            target_sample_rate,
        ).map_err(|e| format!("Failed to create resampler: {}", e))?;
        
        Ok(Self {
            input_context: input,
            audio_stream_index,
            decoder,
            resampler,
            sample_rate: target_sample_rate,
            channels: target_channels,
            buffer: VecDeque::with_capacity(target_sample_rate as usize * target_channels as usize), // 1 second buffer
            position_samples: 0,
        })
    }
    
    /// Seek to a specific time in seconds
    pub fn seek(&mut self, time: f64) -> Result<(), String> {
        let stream = self.input_context
            .stream(self.audio_stream_index)
            .ok_or("Audio stream not found")?;
        
        let time_base = stream.time_base();
        let ts = (time / f64::from(time_base)) as i64;
        
        self.input_context
            .seek(ts, ..ts)
            .map_err(|e| format!("Audio seek failed: {}", e))?;
        
        self.decoder.flush();
        self.buffer.clear();
        self.position_samples = (time * self.sample_rate as f64) as u64;
        
        Ok(())
    }
    
    /// Decode more audio samples into the internal buffer
    fn decode_more(&mut self) -> Result<bool, String> {
        let mut decoded = ffmpeg::util::frame::Audio::empty();
        
        for (stream, packet) in self.input_context.packets() {
            if stream.index() == self.audio_stream_index {
                self.decoder.send_packet(&packet)
                    .map_err(|e| e.to_string())?;
                
                while self.decoder.receive_frame(&mut decoded).is_ok() {
                    // Resample to target format
                    let mut resampled = ffmpeg::util::frame::Audio::empty();
                    self.resampler.run(&decoded, &mut resampled)
                        .map_err(|e| e.to_string())?;
                    
                    // Get the f32 samples from the resampled frame
                    let data = resampled.data(0);
                    let samples: &[f32] = unsafe {
                        std::slice::from_raw_parts(
                            data.as_ptr() as *const f32,
                            data.len() / std::mem::size_of::<f32>()
                        )
                    };
                    
                    // Add to buffer
                    self.buffer.extend(samples.iter().copied());
                    
                    return Ok(true);
                }
            }
        }
        
        Ok(false) // No more packets
    }
    
    /// Fill the provided buffer with audio samples
    /// Returns the number of samples actually written
    pub fn fill_buffer(&mut self, output: &mut [f32]) -> usize {
        let mut written = 0;
        
        while written < output.len() {
            // Try to get samples from internal buffer
            if let Some(sample) = self.buffer.pop_front() {
                output[written] = sample;
                written += 1;
            } else {
                // Need to decode more
                match self.decode_more() {
                    Ok(true) => continue,
                    Ok(false) => break, // End of stream
                    Err(e) => {
                        eprintln!("[AudioDecoder] Decode error: {}", e);
                        break;
                    }
                }
            }
        }
        
        self.position_samples += (written / self.channels as usize) as u64;
        written
    }
    
    /// Get current playback position in seconds
    pub fn position(&self) -> f64 {
        self.position_samples as f64 / self.sample_rate as f64
    }
    
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }
    
    pub fn channels(&self) -> u16 {
        self.channels
    }
}

/// Thread-safe wrapper for AudioDecoder
pub struct SharedAudioDecoder {
    decoder: Arc<Mutex<Option<AudioDecoder>>>,
}

impl SharedAudioDecoder {
    pub fn new() -> Self {
        Self {
            decoder: Arc::new(Mutex::new(None)),
        }
    }
    
    pub fn load(&self, path: &Path, sample_rate: u32, channels: u16) -> Result<(), String> {
        let decoder = AudioDecoder::new(path, sample_rate, channels)?;
        *self.decoder.lock() = Some(decoder);
        Ok(())
    }
    
    pub fn seek(&self, time: f64) -> Result<(), String> {
        if let Some(decoder) = self.decoder.lock().as_mut() {
            decoder.seek(time)
        } else {
            Err("No audio loaded".to_string())
        }
    }
    
    pub fn fill_buffer(&self, output: &mut [f32]) -> usize {
        if let Some(decoder) = self.decoder.lock().as_mut() {
            decoder.fill_buffer(output)
        } else {
            // Fill with silence if no audio loaded
            for sample in output.iter_mut() {
                *sample = 0.0;
            }
            output.len()
        }
    }
    
    pub fn position(&self) -> f64 {
        if let Some(decoder) = self.decoder.lock().as_ref() {
            decoder.position()
        } else {
            0.0
        }
    }
    
    pub fn clone_arc(&self) -> Arc<Mutex<Option<AudioDecoder>>> {
        Arc::clone(&self.decoder)
    }
}
