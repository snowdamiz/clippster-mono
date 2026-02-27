use ffmpeg_the_third as ffmpeg;
use std::path::Path;

#[derive(Debug)]
pub enum DecoderError {
    FfmpegError(ffmpeg::Error),
    IoError(std::io::Error),
    InvalidTimestamp,
    NoVideoStream,
    DecodingFailed(String),
}

impl std::fmt::Display for DecoderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DecoderError::FfmpegError(e) => write!(f, "FFmpeg error: {}", e),
            DecoderError::IoError(e) => write!(f, "IO error: {}", e),
            DecoderError::InvalidTimestamp => write!(f, "Invalid timestamp"),
            DecoderError::NoVideoStream => write!(f, "No video stream found"),
            DecoderError::DecodingFailed(msg) => write!(f, "Decoding failed: {}", msg),
        }
    }
}

impl std::error::Error for DecoderError {}

impl From<ffmpeg::Error> for DecoderError {
    fn from(err: ffmpeg::Error) -> Self {
        DecoderError::FfmpegError(err)
    }
}

impl From<std::io::Error> for DecoderError {
    fn from(err: std::io::Error) -> Self {
        DecoderError::IoError(err)
    }
}

pub struct DecodedFrame {
    pub width: u32,
    pub height: u32,
    pub rgb_data: Vec<u8>,
    pub timestamp: f64,
}

pub struct VideoDecoder {
    video_path: String,
    width: u32,
    height: u32,
    duration: f64,
    fps: f64,
    video_stream_index: usize,
}

impl VideoDecoder {
    pub fn new<P: AsRef<Path>>(video_path: P) -> Result<Self, DecoderError> {
        ffmpeg::init()?;

        let path_str = video_path.as_ref().to_string_lossy().to_string();
        let input = ffmpeg::format::input(&path_str)?;

        let video_stream = input
            .streams()
            .best(ffmpeg::media::Type::Video)
            .ok_or(DecoderError::NoVideoStream)?;

        let video_stream_index = video_stream.index();

        let decoder = ffmpeg::codec::context::Context::from_parameters(video_stream.parameters())?
            .decoder()
            .video()?;

        let width = decoder.width();
        let height = decoder.height();

        let time_base = video_stream.time_base();
        let duration_ts = video_stream.duration();
        let duration = if duration_ts > 0 {
            duration_ts as f64 * f64::from(time_base)
        } else {
            input.duration() as f64 / f64::from(ffmpeg::ffi::AV_TIME_BASE)
        };

        let fps = f64::from(video_stream.avg_frame_rate());

        let _scaler = ffmpeg::software::scaling::Context::get(
            decoder.format(),
            decoder.width(),
            decoder.height(),
            ffmpeg::format::Pixel::RGB24,
            decoder.width(),
            decoder.height(),
            ffmpeg::software::scaling::Flags::BILINEAR,
        )?;

        Ok(Self {
            video_path: path_str,
            width,
            height,
            duration,
            fps,
            video_stream_index,
        })
    }

    pub fn decode_frame_at(&self, timestamp: f64) -> Result<DecodedFrame, DecoderError> {
        if timestamp < 0.0 || timestamp > self.duration {
            return Err(DecoderError::InvalidTimestamp);
        }

        // Try seeking with retry logic for sparse keyframes
        // Reduced to 2 retries for faster failure - frontend will hold last frame
        let mut last_error = None;
        for retry in 0..2 {
            let adjusted_timestamp = (timestamp - (retry as f64 * 2.0)).max(0.0);

            match self.try_decode_frame_at(adjusted_timestamp, timestamp) {
                Ok(frame) => return Ok(frame),
                Err(e) => {
                    last_error = Some(e);
                    // Continue to next retry
                }
            }
        }

        // All retries failed
        Err(last_error.unwrap_or(DecoderError::DecodingFailed(format!(
            "Failed to decode frame at {} after retries",
            timestamp
        ))))
    }

    fn try_decode_frame_at(
        &self,
        seek_timestamp: f64,
        target_timestamp: f64,
    ) -> Result<DecodedFrame, DecoderError> {
        let mut input = ffmpeg::format::input(&self.video_path)?;

        let video_stream = input
            .stream(self.video_stream_index)
            .ok_or(DecoderError::NoVideoStream)?;
        let time_base = video_stream.time_base();

        let seek_ts = (seek_timestamp / f64::from(time_base)) as i64;
        input.seek(seek_ts, ..)?;

        let video_stream = input
            .stream(self.video_stream_index)
            .ok_or(DecoderError::NoVideoStream)?;
        let time_base = video_stream.time_base();

        let mut decoder =
            ffmpeg::codec::context::Context::from_parameters(video_stream.parameters())?
                .decoder()
                .video()?;

        let mut scaler = ffmpeg::software::scaling::Context::get(
            decoder.format(),
            decoder.width(),
            decoder.height(),
            ffmpeg::format::Pixel::RGB24,
            decoder.width(),
            decoder.height(),
            ffmpeg::software::scaling::Flags::BILINEAR,
        )?;

        let mut target_frame_found = false;
        let mut decoded_frame: Option<DecodedFrame> = None;
        let mut packets_processed = 0;
        let mut frames_decoded = 0;
        let mut first_frame_ts = None;
        let mut last_frame_ts = None;

        eprintln!(
            "[FrameDecoder] Seeking to {:.3}s, looking for frame at {:.3}s",
            seek_timestamp, target_timestamp
        );

        for result in input.packets() {
            let (stream, packet) = result?;
            packets_processed += 1;
            if stream.index() != self.video_stream_index {
                continue;
            }

            decoder.send_packet(&packet)?;

            let mut frame = ffmpeg::frame::Video::empty();
            while decoder.receive_frame(&mut frame).is_ok() {
                let frame_pts = frame.pts().unwrap_or(0);
                let frame_timestamp = frame_pts as f64 * f64::from(time_base);
                frames_decoded += 1;

                if first_frame_ts.is_none() {
                    first_frame_ts = Some(frame_timestamp);
                }
                last_frame_ts = Some(frame_timestamp);

                if frame_timestamp >= target_timestamp {
                    eprintln!("[FrameDecoder] FOUND frame at {:.3}s (target: {:.3}s, packets: {}, frames: {})", 
                        frame_timestamp, target_timestamp, packets_processed, frames_decoded);

                    let mut rgb_frame = ffmpeg::frame::Video::empty();
                    scaler.run(&frame, &mut rgb_frame)?;

                    let rgb_data = rgb_frame.data(0).to_vec();

                    decoded_frame = Some(DecodedFrame {
                        width: self.width,
                        height: self.height,
                        rgb_data,
                        timestamp: frame_timestamp,
                    });

                    target_frame_found = true;
                    break;
                }
            }

            if target_frame_found {
                break;
            }
        }

        decoder.send_eof()?;

        let mut frame = ffmpeg::frame::Video::empty();
        while decoder.receive_frame(&mut frame).is_ok() {
            if decoded_frame.is_none() {
                let frame_pts = frame.pts().unwrap_or(0);
                let frame_timestamp = frame_pts as f64 * f64::from(time_base);
                frames_decoded += 1;

                if first_frame_ts.is_none() {
                    first_frame_ts = Some(frame_timestamp);
                }
                last_frame_ts = Some(frame_timestamp);

                if frame_timestamp >= target_timestamp {
                    eprintln!(
                        "[FrameDecoder] FOUND frame in flush at {:.3}s (target: {:.3}s)",
                        frame_timestamp, target_timestamp
                    );

                    let mut rgb_frame = ffmpeg::frame::Video::empty();
                    scaler.run(&frame, &mut rgb_frame)?;

                    let rgb_data = rgb_frame.data(0).to_vec();

                    decoded_frame = Some(DecodedFrame {
                        width: self.width,
                        height: self.height,
                        rgb_data,
                        timestamp: frame_timestamp,
                    });
                    break;
                }
            }
        }

        if decoded_frame.is_none() {
            eprintln!("[FrameDecoder] FAILED to find frame at {:.3}s. Processed {} packets, decoded {} frames. First frame: {:?}, Last frame: {:?}", 
                target_timestamp, packets_processed, frames_decoded, first_frame_ts, last_frame_ts);
        }

        decoded_frame.ok_or_else(|| {
            DecoderError::DecodingFailed(format!(
                "No frame found at timestamp {}",
                target_timestamp
            ))
        })
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn duration(&self) -> f64 {
        self.duration
    }

    pub fn fps(&self) -> f64 {
        self.fps
    }
}
