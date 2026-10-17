//! Source-wide 10ms peaks, shared by every viewport and persisted across sessions.
use super::{generate_video_path_hash, storage, WaveformPeak};
use std::{collections::{HashMap, VecDeque}, sync::{Arc, OnceLock, Weak}};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};
use tokio::sync::Mutex;

type Peaks = Arc<Vec<f32>>;
type MemoryCache = VecDeque<(String, Peaks)>;
const MAX_BYTES: usize = 64 * 1024 * 1024;
static MEMORY: OnceLock<Mutex<MemoryCache>> = OnceLock::new();
static LOCKS: OnceLock<Mutex<HashMap<String, Weak<Mutex<()>>>>> = OnceLock::new();

fn cache_path(key: &str) -> Result<std::path::PathBuf, String> {
    Ok(storage::init_storage_dirs()?.temp.join(format!("waveform-v2-{key}.f32")))
}

pub async fn invalidate(path: &str) -> Result<(), String> {
    let key = generate_video_path_hash(path);
    MEMORY.get_or_init(Default::default).lock().await.retain(|(id, _)| id != &key);
    let file = cache_path(&key)?;
    if file.exists() { tokio::fs::remove_file(file).await.map_err(|e| e.to_string())?; }
    Ok(())
}

async fn source_peaks(app: &tauri::AppHandle, path: &str) -> Result<Peaks, String> {
    let key = generate_video_path_hash(path);
    let lock = {
        let mut locks = LOCKS.get_or_init(Default::default).lock().await;
        locks.retain(|_, lock| lock.strong_count() > 0);
        match locks.get(&key).and_then(Weak::upgrade) {
            Some(lock) => lock,
            None => { let lock = Arc::new(Mutex::new(())); locks.insert(key.clone(), Arc::downgrade(&lock)); lock }
        }
    };
    let _guard = lock.lock().await;
    {
        let mut memory = MEMORY.get_or_init(Default::default).lock().await;
        if let Some(index) = memory.iter().position(|(id, _)| id == &key) {
            let entry = memory.remove(index).unwrap();
            let peaks = entry.1.clone();
            memory.push_back(entry);
            return Ok(peaks);
        }
    }
    let file = cache_path(&key)?;
    let cached = tokio::fs::read(&file).await.ok().filter(|bytes| bytes.len() % 4 == 0);
    let peaks = if let Some(bytes) = cached {
        bytes.chunks_exact(4).map(|b| f32::from_le_bytes(b.try_into().unwrap())).collect()
    } else {
        let peaks = extract(app, path).await?;
        let bytes: Vec<u8> = peaks.iter().flat_map(|p| p.to_le_bytes()).collect();
        let temporary = file.with_extension("tmp");
        if tokio::fs::write(&temporary, bytes).await.is_ok() {
            let _ = tokio::fs::rename(&temporary, &file).await;
        }
        let _ = tokio::fs::remove_file(temporary).await;
        peaks
    };
    let peaks = Arc::new(peaks);
    let mut memory = MEMORY.get_or_init(Default::default).lock().await;
    memory.push_back((key, peaks.clone()));
    while memory.iter().map(|(_, p)| p.len() * 4).sum::<usize>() > MAX_BYTES { memory.pop_front(); }
    Ok(peaks)
}

#[derive(Default)]
struct PeakAccumulator { peaks: Vec<f32>, byte: Option<u8>, count: usize, peak: f32 }
impl PeakAccumulator {
    fn push(&mut self, bytes: &[u8]) {
        for &byte in bytes {
            if let Some(first) = self.byte.take() {
                self.peak = self.peak.max((i16::from_le_bytes([first, byte]) as f32 / 32768.0).abs());
                self.count += 1;
                if self.count == 80 { self.peaks.push(self.peak); self.count = 0; self.peak = 0.0; }
            } else { self.byte = Some(byte); }
        }
    }
    fn finish(mut self) -> Vec<f32> { if self.count > 0 { self.peaks.push(self.peak); } self.peaks }
}

async fn extract(app: &tauri::AppHandle, path: &str) -> Result<Vec<f32>, String> {
    let (mut events, child) = app.shell().sidecar("ffmpeg").map_err(|e| e.to_string())?
        .args(["-nostdin", "-v", "error", "-i", path, "-map", "0:a:0?", "-vn", "-ac", "1", "-ar", "8000", "-c:a", "pcm_s16le", "-f", "s16le", "pipe:1"])
        .set_raw_out(true).spawn().map_err(|e| e.to_string())?;
    let result = tokio::time::timeout(std::time::Duration::from_secs(600), async {
        let mut accumulator = PeakAccumulator::default();
        let mut error = String::new();
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => accumulator.push(&bytes),
                CommandEvent::Stderr(bytes) => { if error.len() < 8192 { error.push_str(&String::from_utf8_lossy(&bytes)); } }
                CommandEvent::Terminated(status) => {
                    if status.code == Some(0) { return Ok(accumulator.finish()); }
                    if error.contains("does not contain any stream") { return Ok(Vec::new()); }
                    return Err(format!("Waveform extraction failed: {error}"));
                }
                CommandEvent::Error(error) => return Err(error),
                _ => {}
            }
        }
        Err("Waveform extraction ended without an exit status".into())
    }).await;
    match result { Ok(result) => result, Err(_) => { let _ = child.kill(); Err("Waveform extraction timed out".into()) } }
}

pub async fn range(app: &tauri::AppHandle, path: &str, start: f64, duration: f64, width: u32) -> Result<Vec<WaveformPeak>, String> {
    if !start.is_finite() || !duration.is_finite() || start < 0.0 || duration <= 0.0 || width == 0 || width > 10000 {
        return Err("Invalid waveform range".into());
    }
    let peaks = source_peaks(app, path).await?;
    Ok(resample(&peaks, start, duration, width))
}

fn resample(peaks: &[f32], start: f64, duration: f64, width: u32) -> Vec<WaveformPeak> {
    if peaks.is_empty() { return Vec::new(); }
    (0..width).map(|i| {
        let left = ((start + duration * i as f64 / width as f64) * 100.0).floor() as usize;
        let right = ((start + duration * (i + 1) as f64 / width as f64) * 100.0).ceil() as usize;
        let value = peaks[left.min(peaks.len())..right.max(left + 1).min(peaks.len())].iter().copied().fold(0.0f32, f32::max) as f64;
        WaveformPeak { min: -value, max: value }
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_peaks_across_odd_byte_chunks_and_partial_bins() {
        let samples: Vec<u8> = (0..85).flat_map(|i| (if i == 79 { i16::MIN } else { 16384i16 }).to_le_bytes()).collect();
        let mut accumulator = PeakAccumulator::default();
        for chunk in samples.chunks(7) { accumulator.push(chunk); }
        assert_eq!(accumulator.finish(), vec![1.0, 0.5]);
    }
    #[test]
    fn viewport_uses_source_time_and_preserves_short_peaks() {
        let peaks = vec![0.1, 0.9, 0.2, 0.3];
        let full = resample(&peaks, 0.0, 0.04, 2);
        assert!((full[0].max - 0.9).abs() < 0.0001);
        let tail = resample(&peaks, 0.02, 0.02, 2);
        assert!((tail[0].max - 0.2).abs() < 0.0001);
        assert_eq!(resample(&peaks, 1.0, 1.0, 1)[0].max, 0.0);
    }
}
