use ffmpeg_next as ffmpeg;
use std::path::Path;

pub struct VideoDecoder {
    input_context: ffmpeg::format::context::Input,
    video_stream_index: usize,
    decoder: ffmpeg::decoder::Video,
    scaler: ffmpeg::software::scaling::Context,
    width: u32,
    height: u32,
}

// SAFETY: VideoDecoder is only accessed behind a mutex in DecoderPool,
// so it is never used concurrently across threads.
unsafe impl Send for VideoDecoder {}

impl VideoDecoder {
    pub fn new(path: &Path) -> Result<Self, String> {
        ffmpeg::init().map_err(|e| e.to_string())?;
        
        let input = ffmpeg::format::input(path)
            .map_err(|e| format!("Failed to open video: {}", e))?;
        
        let video_stream = input
            .streams()
            .best(ffmpeg::media::Type::Video)
            .ok_or("No video stream found")?;
        
        let video_stream_index = video_stream.index();
        
        let context = ffmpeg::codec::context::Context::from_parameters(video_stream.parameters())
            .map_err(|e| e.to_string())?;
        
        let decoder = context
            .decoder()
            .video()
            .map_err(|e| e.to_string())?;
        
        let width = decoder.width();
        let height = decoder.height();
        
        // Create scaler to convert to RGBA for WebGL texture upload
        // WebGL doesn't have native BGRA support, so we use RGBA
        let scaler = ffmpeg::software::scaling::Context::get(
            decoder.format(),
            width,
            height,
            ffmpeg::format::Pixel::RGBA,
            width,
            height,
            ffmpeg::software::scaling::Flags::BILINEAR,
        ).map_err(|e| e.to_string())?;
        
        Ok(Self {
            input_context: input,
            video_stream_index,
            decoder,
            scaler,
            width,
            height,
        })
    }
    
    pub fn width(&self) -> u32 {
        self.width
    }
    
    pub fn height(&self) -> u32 {
        self.height
    }
    
    pub fn dimensions(&self) -> (u32, u32) {
        (self.width, self.height)
    }
    
    pub fn duration(&self) -> f64 {
        let stream = self.input_context.stream(self.video_stream_index);
        if let Some(stream) = stream {
            let duration = stream.duration();
            let time_base = stream.time_base();
            if duration > 0 {
                return duration as f64 * f64::from(time_base);
            }
        }
        // Fallback: try container duration
        let duration = self.input_context.duration();
        if duration > 0 {
            return duration as f64 / 1_000_000.0; // AV_TIME_BASE is 1000000
        }
        0.0
    }
    
    pub fn seek_to_timestamp(&mut self, timestamp: f64) -> Result<(), String> {
        let stream = self.input_context
            .stream(self.video_stream_index)
            .ok_or("Stream not found")?;
        
        let time_base = stream.time_base();
        let ts = (timestamp / f64::from(time_base)) as i64;
        
        // Seek backward to nearest keyframe before the target timestamp
        self.input_context
            .seek(ts, ..ts)
            .map_err(|e| format!("Seek failed: {}", e))?;
        
        self.decoder.flush();
        Ok(())
    }
    
    /// Decode frame at or after the target timestamp
    /// This properly handles seeking to keyframe and then decoding forward to target
    pub fn decode_frame_at(&mut self, target_timestamp: f64) -> Result<DecodedFrame, String> {
        let mut decoded = ffmpeg::util::frame::Video::empty();
        let mut best_frame: Option<DecodedFrame> = None;
        let mut frames_decoded = 0;
        let mut packets_read = 0;
        
        // Get stream info for timestamp calculation
        let stream = self.input_context
            .stream(self.video_stream_index)
            .ok_or("Stream not found")?;
        let time_base = f64::from(stream.time_base());
        
        // Use packets() iterator but process ALL packets until we reach target
        // The issue was the iterator was being consumed elsewhere - we need fresh iteration each time
        for (stream, packet) in self.input_context.packets() {
            packets_read += 1;
            
            if stream.index() == self.video_stream_index {
                self.decoder.send_packet(&packet)
                    .map_err(|e| e.to_string())?;
                
                // Drain all available frames from decoder
                while self.decoder.receive_frame(&mut decoded).is_ok() {
                    frames_decoded += 1;
                    let frame_ts = decoded.timestamp().unwrap_or(0) as f64 * time_base;
                    
                    // Scale to RGBA
                    let mut rgba_frame = ffmpeg::util::frame::Video::empty();
                    self.scaler.run(&decoded, &mut rgba_frame)
                        .map_err(|e| e.to_string())?;
                    
                    let frame = DecodedFrame {
                        data: rgba_frame.data(0).to_vec(),
                        width: self.width,
                        height: self.height,
                        timestamp: frame_ts,
                    };
                    
                    // Debug: log what we're decoding (first few only)
                    if frames_decoded <= 3 {
                        eprintln!("[Decoder] decode_frame_at: target={:.3}, decoded frame {} at ts={:.3}", 
                            target_timestamp, frames_decoded, frame_ts);
                    }
                    
                    // If we've reached or passed the target, return this frame
                    if frame_ts >= target_timestamp - 0.001 {
                        return Ok(frame);
                    }
                    
                    // Keep track of the best frame so far (closest to target)
                    best_frame = Some(frame);
                }
            }
            
            // Safety limit
            if packets_read > 2000 {
                eprintln!("[Decoder] decode_frame_at: safety limit reached, {} packets read", packets_read);
                break;
            }
        }
        
        if frames_decoded == 0 {
            eprintln!("[Decoder] decode_frame_at: target={:.3}, NO frames decoded after {} packets", 
                target_timestamp, packets_read);
        }
        
        // Return the best frame we found, or error
        best_frame.ok_or_else(|| format!("No frame decoded for target {:.3}", target_timestamp))
    }
    
    /// Decode the next frame sequentially (no seeking, just advance)
    /// This is the efficient path for playback - decode forward one frame at a time
    pub fn decode_next_frame(&mut self) -> Result<DecodedFrame, String> {
        let mut decoded = ffmpeg::util::frame::Video::empty();
        
        // Get time_base for timestamp calculation
        let time_base = {
            let stream = self.input_context
                .stream(self.video_stream_index)
                .ok_or("Stream not found")?;
            f64::from(stream.time_base())
        };
        
        // First, try to receive any buffered frames from previous packets
        // (B-frames may have multiple frames buffered)
        if self.decoder.receive_frame(&mut decoded).is_ok() {
            let frame_ts = decoded.timestamp().unwrap_or(0) as f64 * time_base;
            let pts = decoded.pts().unwrap_or(-1);
            
            let mut rgba_frame = ffmpeg::util::frame::Video::empty();
            self.scaler.run(&decoded, &mut rgba_frame)
                .map_err(|e| e.to_string())?;
            
            let data = rgba_frame.data(0).to_vec();
            
            // Debug: compute checksum from different parts of frame
            let checksum_start: u32 = data.iter().take(100).map(|&b| b as u32).sum();
            let checksum_mid: u32 = data.iter().skip(data.len()/2).take(100).map(|&b| b as u32).sum();
            println!("[Decoder] decode_next_frame (buffered): pts={}, ts={:.3}s, checksum_start={}, checksum_mid={}", 
                pts, frame_ts, checksum_start, checksum_mid);
            
            return Ok(DecodedFrame {
                data,
                width: self.width,
                height: self.height,
                timestamp: frame_ts,
            });
        }
        
        // Read packets one at a time until we get a frame
        let mut packets_read = 0u32;
        let mut video_packets = 0u32;
        
        for (stream, packet) in self.input_context.packets() {
            packets_read += 1;
            
            // Skip non-video packets
            if stream.index() != self.video_stream_index {
                continue;
            }
            
            video_packets += 1;
            let pkt_pts = packet.pts().unwrap_or(-1);
            let pkt_dts = packet.dts().unwrap_or(-1);
            
            // Send packet to decoder
            self.decoder.send_packet(&packet)
                .map_err(|e| format!("send_packet error: {}", e))?;
            
            // Try to receive a frame (may need multiple packets for B-frames)
            if self.decoder.receive_frame(&mut decoded).is_ok() {
                let frame_ts = decoded.timestamp().unwrap_or(0) as f64 * time_base;
                let pts = decoded.pts().unwrap_or(-1);
                
                let mut rgba_frame = ffmpeg::util::frame::Video::empty();
                self.scaler.run(&decoded, &mut rgba_frame)
                    .map_err(|e| e.to_string())?;
                
                let data = rgba_frame.data(0).to_vec();
                
                // Debug: compute checksum from different parts of frame
                let checksum_start: u32 = data.iter().take(100).map(|&b| b as u32).sum();
                let checksum_mid: u32 = data.iter().skip(data.len()/2).take(100).map(|&b| b as u32).sum();
                println!("[Decoder] decode_next_frame: pkts_read={}, video_pkts={}, pkt_pts={}, frame_pts={}, ts={:.3}s, checksum_start={}, checksum_mid={}", 
                    packets_read, video_packets, pkt_pts, pts, frame_ts, checksum_start, checksum_mid);
                
                return Ok(DecodedFrame {
                    data,
                    width: self.width,
                    height: self.height,
                    timestamp: frame_ts,
                });
            }
            // No frame yet - continue reading packets
        }
        
        // End of file - flush decoder
        println!("[Decoder] decode_next_frame: EOF after {} packets ({} video), flushing decoder", packets_read, video_packets);
        self.decoder.send_eof().ok();
        
        // Try to get any remaining buffered frames
        if self.decoder.receive_frame(&mut decoded).is_ok() {
            let frame_ts = decoded.timestamp().unwrap_or(0) as f64 * time_base;
            
            let mut rgba_frame = ffmpeg::util::frame::Video::empty();
            self.scaler.run(&decoded, &mut rgba_frame)
                .map_err(|e| e.to_string())?;
            
            return Ok(DecodedFrame {
                data: rgba_frame.data(0).to_vec(),
                width: self.width,
                height: self.height,
                timestamp: frame_ts,
            });
        }
        
        return Err("End of stream".to_string());
    }
    
    #[allow(dead_code)]
    pub fn decode_frame(&mut self) -> Result<DecodedFrame, String> {
        let mut decoded = ffmpeg::util::frame::Video::empty();
        
        for (stream, packet) in self.input_context.packets() {
            if stream.index() == self.video_stream_index {
                self.decoder.send_packet(&packet)
                    .map_err(|e| e.to_string())?;
                
                if self.decoder.receive_frame(&mut decoded).is_ok() {
                    // Scale to RGBA
                    let mut rgba_frame = ffmpeg::util::frame::Video::empty();
                    self.scaler.run(&decoded, &mut rgba_frame)
                        .map_err(|e| e.to_string())?;
                    
                    let timestamp = decoded.timestamp().unwrap_or(0) as f64 * f64::from(stream.time_base());
                    
                    return Ok(DecodedFrame {
                        data: rgba_frame.data(0).to_vec(),
                        width: self.width,
                        height: self.height,
                        timestamp,
                    });
                }
            }
        }
        
        Err("No frame decoded".to_string())
    }
}

#[derive(Clone)]
pub struct DecodedFrame {
    pub data: Vec<u8>,  // RGBA data (4 bytes per pixel)
    #[allow(dead_code)]
    pub width: u32,
    #[allow(dead_code)]
    pub height: u32,
    #[allow(dead_code)]
    pub timestamp: f64,
}
