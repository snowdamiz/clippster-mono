# Integrating Vosk-rs with Tauri for Audio Transcription

## Introduction

This guide explains how to integrate [vosk-rs](https://crates.io/crates/vosk-rs), a Rust binding for the Vosk speech recognition API, into a Tauri desktop application for offline audio transcription. Vosk-rs enables local speech-to-text processing with word-level timestamps, supporting multiple languages via downloadable models. Tauri allows building cross-platform apps with a web frontend (e.g., HTML/JS) and Rust backend, where we'll handle the transcription logic.

We'll focus on transcribing .mp3 files (e.g., extracted from videos). Since Vosk requires raw PCM audio (16kHz, mono, 16-bit), we'll use [ffmpeg-next](https://crates.io/crates/ffmpeg-next) to decode MP3 files. This keeps everything local—no server dependencies.

The integration involves:
- Decoding MP3 to PCM in the Rust backend.
- Feeding PCM samples to Vosk-rs for transcription.
- Exposing a Tauri command to invoke this from the frontend.

For full Vosk API details, see the [Vosk documentation](https://alphacephei.com/vosk/).

## Prerequisites

- Install Rust and Cargo (via [rustup.rs](https://rustup.rs/)).
- Set up a Tauri project: Run `cargo install tauri-cli` and `cargo tauri init` in a new directory. See [Tauri Getting Started](https://tauri.app/v1/guides/getting-started/prerequisites).
- Download Vosk models (e.g., `vosk-model-small-en-us`) from [alphacephei.com/vosk/models](https://alphacephei.com/vosk/models). Place them in your app's resources directory.

## Dependencies

Add these to your `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "1", features = ["api-all"] }
vosk-rs = "0.1"  # Check latest on crates.io
ffmpeg-next = "7"  # Check latest on crates.io
serde = { version = "1", features = ["derive"] }
thiserror = "1"  # For error handling
```

Run `cargo build` to install them.

For Vosk-rs compilation: Download Vosk-API libraries from [github.com/alphacep/vosk-api/releases](https://github.com/alphacep/vosk-api/releases) and configure linking (e.g., via build script). See the [vosk-rs GitHub README](https://github.com/Bear-03/vosk-rs) for platform-specific instructions.

## Setting Up Vosk-rs

Vosk-rs requires loading a model and creating a recognizer. It processes 16-bit integer samples at 16kHz.

Basic usage (from vosk-rs examples):

```rust
use vosk_rs::{Model, Recognizer};

let model_path = "path/to/vosk-model-small-en-us";
let model = Model::new(model_path).expect("Failed to load model");
let mut recognizer = Recognizer::new(&model, 16000.0).expect("Failed to create recognizer");

recognizer.set_words(true);  // Enable word-level timestamps
recognizer.set_partial_words(true);  // Enable partial results

// Feed samples (Vec<i16>)
let samples: Vec<i16> = vec![/* PCM data */];
recognizer.accept_waveform(&samples);

// Get results
let partial = recognizer.partial_result();
let final_result = recognizer.final_result().multiple().expect("Final result");
```

The `final_result` includes alternatives with words, each having `start` and `end` timestamps (in seconds). For API details, see [docs.rs/vosk-rs](https://docs.rs/vosk-rs) (if available) or the GitHub repo.

## Handling Audio with FFmpeg-next

Use ffmpeg-next to decode MP3 to PCM samples.

Initialization and decoding example:

```rust
use ffmpeg_next as ffmpeg;
use ffmpeg::format::{self, input};
use ffmpeg::codec::{self, decoder};
use ffmpeg::util::frame::audio::Audio as Frame;

ffmpeg::init().unwrap();

let mut ictx = input(&"path/to/input.mp3").unwrap();
let input_stream = ictx.streams().best(format::media::Type::Audio).unwrap();
let stream_index = input_stream.index();

let context = codec::context::Context::from_parameters(input_stream.parameters()).unwrap();
let mut decoder = context.decoder().audio().unwrap();

let mut samples: Vec<i16> = Vec::new();  // Collect PCM i16 samples

let mut packet = ffmpeg::Packet::empty();
while ictx.read_packet(&mut packet).is_ok() {
    if packet.stream() == stream_index {
        decoder.send_packet(&packet).unwrap();
        let mut frame = Frame::empty();
        while decoder.receive_frame(&mut frame).is_ok() {
            // Assuming i16 planar or interleaved; adjust for format
            if frame.format() == ffmpeg::format::sample::Sample::I16(ffmpeg::format::sample::Type::Packed) {
                let data = frame.data(0);
                let i16_slice = unsafe { std::slice::from_raw_parts(data.as_ptr() as *const i16, data.len() / 2) };
                samples.extend_from_slice(i16_slice);
            }
            // Resample if not 16kHz (use ffmpeg::resampler)
        }
    }
}
decoder.send_eof().unwrap();
// Flush remaining frames similarly

// Now feed `samples` to Vosk recognizer
```

If the sample rate isn't 16kHz, use FFmpeg's resampler (`ffmpeg::software::resampling::Context`). For full details, see [docs.rs/ffmpeg-next](https://docs.rs/ffmpeg-next).

## Defining the Tauri Command

In `src-tauri/src/main.rs`, define a command to transcribe an MP3 file path.

Use async for I/O, handle errors with a custom type, and return JSON-serializable results.

```rust
use tauri::{self, async_runtime::block_on};
use vosk_rs::{Model, Recognizer};
use ffmpeg_next as ffmpeg;
use std::path::Path;
use thiserror::Error;
use serde::Serialize;

#[derive(Debug, Error, Serialize)]
enum TranscriptionError {
    #[error("Failed to load model: {0}")]
    ModelLoad(String),
    #[error("FFmpeg error: {0}")]
    Ffmpeg(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    // Add more as needed
}

#[derive(Serialize)]
struct TranscriptionResult {
    text: String,
    words: Vec<Word>,  // Define Word struct with start/end/confidence
}

#[tauri::command]
async fn transcribe_audio(file_path: String, model_path: String) -> Result<TranscriptionResult, TranscriptionError> {
    // Load model
    let model = Model::new(&model_path).map_err(|e| TranscriptionError::ModelLoad(e.to_string()))?;
    let mut recognizer = Recognizer::new(&model, 16000.0).map_err(|e| TranscriptionError::ModelLoad(e.to_string()))?;
    recognizer.set_words(true);

    // Decode MP3 with FFmpeg (simplified; add resampling if needed)
    ffmpeg::init().map_err(|e| TranscriptionError::Ffmpeg(e.to_string()))?;
    let mut ictx = ffmpeg::format::input(&Path::new(&file_path)).map_err(|e| TranscriptionError::Ffmpeg(e.to_string()))?;
    // ... (decoding logic as above to get Vec<i16> samples)

    recognizer.accept_waveform(&samples);
    let result = recognizer.final_result().single().map_err(|e| TranscriptionError::ModelLoad(e.to_string()))?;

    Ok(TranscriptionResult {
        text: result.text,
        words: result.words,  // Assuming result has words with timestamps
    })
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![transcribe_audio])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

For command setup details, see [Tauri Commands Guide](https://tauri.app/v1/guides/features/command).

## Frontend Invocation

In your frontend (e.g., `src/index.html` or JS framework), use Tauri's API:

```javascript
import { invoke } from '@tauri-apps/api/tauri';

async function transcribe() {
  try {
    const result = await invoke('transcribe_audio', { filePath: '/path/to/audio.mp3', modelPath: '/path/to/model' });
    console.log('Transcription:', result.text);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

Enable global Tauri if needed in `tauri.conf.json`. See Tauri docs for more.

## Troubleshooting and Tips

- **Model Size**: Start with small models for testing; larger ones improve accuracy but increase load time.
- **Resampling**: If audio isn't 16kHz, integrate FFmpeg resampler: `ffmpeg::software::resampling::Context`.
- **Performance**: Process long files in chunks to avoid memory issues.
- **Cross-Platform**: Test linking on Windows/Linux/macOS; static libs for iOS.
- For real-time mic input, use crates like `cpal` for capture and feed live samples.

## Additional Resources

- [Vosk-rs GitHub](https://github.com/Bear-03/vosk-rs): Full README and examples.
- [FFmpeg-next Docs](https://docs.rs/ffmpeg-next): API reference for media handling.
- [Tauri Documentation](https://tauri.app/): Guides on plugins, file handling, and more.
- Example Tauri apps with STT (Whisper-based, adaptable): [Taurscribe GitHub](https://github.com/machowdh/taurscribe).