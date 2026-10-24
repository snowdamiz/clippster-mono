//! Media helpers for the AI video editor: inspecting dropped files (kind, size, audio, a stable
//! content fingerprint for the label cache), and downscaled JPEGs for model input.

use super::reference_video::{concise_stderr, run_command};
use base64::{engine::general_purpose::STANDARD, Engine};
use image::{codecs::jpeg::JpegEncoder, imageops::FilterType};
use serde::Serialize;
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::Path,
    sync::{atomic::AtomicBool, Arc},
};

const SAMPLE_BYTES: u64 = 1024 * 1024;
const FNV_OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
const FNV_PRIME: u64 = 0x0000_0100_0000_01b3;
const MAX_IMAGE_DIMENSION: u32 = 2048;
const JPEG_QUALITY: u8 = 82;
const PROBE_TIMEOUT_SECONDS: u64 = 30;
const PHOTO_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "bmp"];
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "wav", "m4a", "aac", "flac", "ogg", "opus"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectedMedia {
    kind: &'static str,
    duration: f64,
    width: u32,
    height: u32,
    has_audio: bool,
    content_hash: String,
}

/// Classify and measure a file the user dropped into the AI video editor.
#[tauri::command]
pub async fn inspect_ai_media(path: String) -> Result<InspectedMedia, String> {
    let file = Path::new(&path).to_path_buf();
    let extension = file
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    let hash_path = file.clone();
    let content_hash = tokio::task::spawn_blocking(move || fingerprint(&hash_path))
        .await
        .map_err(|e| e.to_string())??;

    if PHOTO_EXTENSIONS.contains(&extension.as_str()) {
        let (width, height) =
            image::image_dimensions(&file).map_err(|_| "The photo could not be read.".to_string())?;
        return Ok(InspectedMedia { kind: "photo", duration: 0.0, width, height, has_audio: false, content_hash });
    }

    let probe = probe_streams(&file).await?;
    let kind = if AUDIO_EXTENSIONS.contains(&extension.as_str()) || probe.width == 0 {
        if !probe.has_audio {
            return Err("The file has no video or audio.".into());
        }
        "audio"
    } else {
        "video"
    };
    Ok(InspectedMedia {
        kind,
        duration: probe.duration,
        width: if kind == "video" { probe.width } else { 0 },
        height: if kind == "video" { probe.height } else { 0 },
        has_audio: probe.has_audio,
        content_hash,
    })
}

struct StreamProbe {
    duration: f64,
    width: u32,
    height: u32,
    has_audio: bool,
}

async fn probe_streams(path: &Path) -> Result<StreamProbe, String> {
    let path_string = path.to_string_lossy().to_string();
    let output = run_command(
        &crate::sidecar::resolve_sidecar_binary("ffprobe")?,
        &[
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,width,height,disposition:format=duration",
            "-of",
            "json",
            &path_string,
        ],
        PROBE_TIMEOUT_SECONDS,
        &Arc::new(AtomicBool::new(false)),
    )
    .await?;
    if !output.status.success() {
        return Err(format!("The file could not be read: {}", concise_stderr(&output)));
    }
    let json: serde_json::Value =
        serde_json::from_slice(&output.stdout).map_err(|error| format!("Could not read the file details: {error}"))?;
    let streams = json["streams"].as_array().cloned().unwrap_or_default();
    // Cover art in audio files is a video stream marked as an attached picture.
    let video = streams.iter().find(|stream| {
        stream["codec_type"] == "video" && stream["disposition"]["attached_pic"].as_u64() != Some(1)
    });
    let duration = json["format"]["duration"]
        .as_str()
        .and_then(|value| value.parse::<f64>().ok())
        .filter(|value| value.is_finite() && *value > 0.0)
        .ok_or("The file's length could not be determined.")?;
    Ok(StreamProbe {
        duration,
        width: video.and_then(|stream| stream["width"].as_u64()).unwrap_or(0) as u32,
        height: video.and_then(|stream| stream["height"].as_u64()).unwrap_or(0) as u32,
        has_audio: streams.iter().any(|stream| stream["codec_type"] == "audio"),
    })
}

/// Decode an image, fit it inside `max_dimension` pixels and return it as base64 JPEG.
#[tauri::command]
pub async fn encode_image_for_ai(path: String, max_dimension: u32) -> Result<String, String> {
    tokio::task::spawn_blocking(move || encode_image(Path::new(&path), max_dimension))
        .await
        .map_err(|e| e.to_string())?
}

fn fingerprint(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|_| "The media file could not be opened.".to_string())?;
    let size = file.metadata().map_err(|e| e.to_string())?.len();

    let mut hash = fnv(FNV_OFFSET, &size.to_le_bytes());
    let mut buffer = vec![0u8; SAMPLE_BYTES as usize];
    for offset in sample_offsets(size) {
        file.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
        let read = read_up_to(&mut file, &mut buffer)?;
        hash = fnv(hash, &buffer[..read]);
    }
    Ok(format!("{size:x}-{hash:016x}"))
}

fn sample_offsets(size: u64) -> Vec<u64> {
    if size <= SAMPLE_BYTES * 3 {
        return vec![0];
    }
    vec![0, size / 2 - SAMPLE_BYTES / 2, size - SAMPLE_BYTES]
}

fn read_up_to(file: &mut File, buffer: &mut [u8]) -> Result<usize, String> {
    let mut total = 0;
    while total < buffer.len() {
        match file.read(&mut buffer[total..]).map_err(|e| e.to_string())? {
            0 => break,
            n => total += n,
        }
    }
    Ok(total)
}

fn fnv(mut hash: u64, bytes: &[u8]) -> u64 {
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    hash
}

fn encode_image(path: &Path, max_dimension: u32) -> Result<String, String> {
    let max_dimension = max_dimension.clamp(64, MAX_IMAGE_DIMENSION);
    let image = image::open(path).map_err(|_| "The image could not be read.".to_string())?;
    let image = if image.width() > max_dimension || image.height() > max_dimension {
        image.resize(max_dimension, max_dimension, FilterType::Triangle)
    } else {
        image
    };

    let mut bytes = Vec::new();
    JpegEncoder::new_with_quality(&mut bytes, JPEG_QUALITY)
        .encode_image(&image.to_rgb8())
        .map_err(|e| e.to_string())?;
    Ok(STANDARD.encode(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_file(name: &str, bytes: &[u8]) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!("clippster-ai-media-{}-{name}", std::process::id()));
        File::create(&path).unwrap().write_all(bytes).unwrap();
        path
    }

    #[test]
    fn fingerprint_is_stable_and_content_sensitive() {
        let big: Vec<u8> = (0..(SAMPLE_BYTES * 4)).map(|i| (i % 251) as u8).collect();
        let a = temp_file("a.bin", &big);
        let mut changed = big.clone();
        changed[(SAMPLE_BYTES * 2) as usize] ^= 1;
        let b = temp_file("b.bin", &changed);

        assert_eq!(fingerprint(&a).unwrap(), fingerprint(&a).unwrap());
        assert_ne!(fingerprint(&a).unwrap(), fingerprint(&b).unwrap());
        assert!(fingerprint(&a).unwrap().starts_with(&format!("{:x}-", big.len())));

        let small = temp_file("small.bin", b"tiny");
        assert_eq!(fingerprint(&small).unwrap(), format!("4-{:016x}", fnv(fnv(FNV_OFFSET, &4u64.to_le_bytes()), b"tiny")));
        for path in [a, b, small] {
            let _ = std::fs::remove_file(path);
        }
    }

    #[test]
    fn encodes_images_within_the_size_limit() {
        let path = std::env::temp_dir().join(format!("clippster-ai-media-{}.png", std::process::id()));
        image::RgbImage::from_pixel(1600, 900, image::Rgb([200, 40, 40])).save(&path).unwrap();

        let decoded = image::load_from_memory(&STANDARD.decode(encode_image(&path, 768).unwrap()).unwrap()).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (768, 432));
        let _ = std::fs::remove_file(path);
    }
}
