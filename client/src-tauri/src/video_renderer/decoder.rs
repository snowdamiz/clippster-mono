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
        
        // Create scaler to convert to RGB for GPU upload
        let scaler = ffmpeg::software::scaling::Context::get(
            decoder.format(),
            width,
            height,
            ffmpeg::format::Pixel::RGB24,
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
    
    pub fn seek_to_timestamp(&mut self, timestamp: f64) -> Result<(), String> {
        let stream = self.input_context
            .stream(self.video_stream_index)
            .ok_or("Stream not found")?;
        
        let time_base = stream.time_base();
        let ts = (timestamp / f64::from(time_base)) as i64;
        
        self.input_context
            .seek(ts, ..ts)
            .map_err(|e| format!("Seek failed: {}", e))?;
        
        self.decoder.flush();
        Ok(())
    }
    
    pub fn decode_frame(&mut self) -> Result<DecodedFrame, String> {
        let mut decoded = ffmpeg::util::frame::Video::empty();
        
        for (stream, packet) in self.input_context.packets() {
            if stream.index() == self.video_stream_index {
                self.decoder.send_packet(&packet)
                    .map_err(|e| e.to_string())?;
                
                if self.decoder.receive_frame(&mut decoded).is_ok() {
                    // Scale to RGB24
                    let mut rgb_frame = ffmpeg::util::frame::Video::empty();
                    self.scaler.run(&decoded, &mut rgb_frame)
                        .map_err(|e| e.to_string())?;
                    
                    let timestamp = decoded.timestamp().unwrap_or(0) as f64 * f64::from(stream.time_base());
                    
                    return Ok(DecodedFrame {
                        data: rgb_frame.data(0).to_vec(),
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
    pub data: Vec<u8>,  // RGB24 data
    pub width: u32,
    pub height: u32,
    pub timestamp: f64,
}
