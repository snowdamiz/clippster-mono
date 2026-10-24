//! Frame-accurate shot measurement for the AI video editor.
//!
//! One ffmpeg pass yields per-frame luma, chroma, saturation, frame difference and scene score.
//! Shot boundaries (hard cuts, flash cuts, dissolves) and per-shot metrics are derived from those
//! numbers in code, so the AI only has to label what each shot shows.

use super::hyperframes::ai_video_session_dir;
use super::reference_video::{
    acquire_reference, concise_stderr, create_job_dir, emit, ensure_not_cancelled, hide_console,
    probe_video, round, run_command, validate_job_id, validate_local_video, wait_for_cancellation,
    Limits, ReferenceAnalysisState, ReferenceProgress, ReferenceVideoInput,
    ReferenceVideoMetadata, TempJobDir,
};
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    process::Stdio,
    sync::{atomic::AtomicBool, Arc},
    time::Duration,
};
use tauri::{ipc::Channel, AppHandle, State};
use tokio::{
    io::{AsyncBufReadExt, AsyncReadExt, BufReader},
    process::Command,
    time::timeout,
};

const STATS_WIDTH: u32 = 160;
const KEYFRAME_WIDTH: u32 = 480;
const MIN_SHOT_SECONDS: f64 = 0.15;
const CUT_THRESHOLD_MIN: f64 = 8.0;
const CUT_THRESHOLD_MAX: f64 = 25.0;
const FLASH_RISE: f64 = 45.0;
const FLASH_FALL: f64 = 35.0;
const FLASH_MAX_FRAMES: usize = 6;
const FLASH_CUT_COLOR_DISTANCE: f64 = 8.0;
const BLEND_BASELINE_FRAMES: usize = 6;
const BLEND_MIN_DIFF: f64 = 2.0;
const BLEND_STEP_RATIO: f64 = 1.6;
const BLEND_COLOR_DISTANCE: f64 = 10.0;
const BLEND_MONOTONIC: f64 = 0.7;
const BLACK_LUMA: f64 = 24.0;
const DIP_MAX_BLACK_SECONDS: f64 = 1.5;
const FREEZE_FRAME_DIFF: f64 = 0.1;
const MOTION_FULL_SCALE: f64 = 25.0;
const SATURATION_FULL_SCALE: f64 = 181.0;

#[derive(Clone, Copy, Debug, Default)]
struct FrameStat {
    index: u64,
    time: f64,
    y: f64,
    u: f64,
    v: f64,
    sat: f64,
    ydif: f64,
    score: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Transition {
    Start,
    Cut,
    Flash,
    Dissolve,
    Dip,
    Continuous,
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct Boundary {
    frame: usize,
    transition: Transition,
    strength: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeasuredShot {
    index: usize,
    start: f64,
    end: f64,
    duration: f64,
    transition_in: Transition,
    /// 0..1, mean frame-to-frame luma change.
    motion: f64,
    motion_peak: f64,
    brightness: f64,
    saturation: f64,
    average_color: String,
    speed_ramp_hint: bool,
    freeze_hint: bool,
    /// Flash frames inside the shot, in seconds from the start of the video.
    flashes: Vec<f64>,
    keyframe_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoMeasurement {
    duration: f64,
    width: u32,
    height: u32,
    fps: f64,
    frame_count: usize,
    cut_threshold: f64,
    shots: Vec<MeasuredShot>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeasureVideoInput {
    job_id: String,
    path: String,
    /// Split shots longer than this into equal segments (source footage); `None` keeps true shots.
    max_shot_seconds: Option<f64>,
    /// Write each shot's middle frame to a `keyframes` folder next to the video.
    #[serde(default)]
    keyframes: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedReference {
    path: String,
    metadata: ReferenceVideoMetadata,
}

/// Download or copy the example video into the session folder so it survives for compare mode,
/// keyframes and re-measurement.
#[tauri::command]
pub async fn import_reference_video(
    app: AppHandle,
    state: State<'_, ReferenceAnalysisState>,
    input: ReferenceVideoInput,
    session_id: i64,
    on_event: Channel<ReferenceProgress>,
) -> Result<ImportedReference, String> {
    validate_job_id(&input.job_id)?;
    let cancelled = state.start(&input.job_id)?;
    let result = match timeout(
        Duration::from_secs(Limits::configured().job_timeout),
        import_reference_inner(&app, &input, session_id, &on_event, &cancelled),
    )
    .await
    {
        Ok(result) => result,
        Err(_) => Err("Downloading the example timed out.".into()),
    };
    state.finish(&input.job_id);
    result
}

async fn import_reference_inner(
    app: &AppHandle,
    input: &ReferenceVideoInput,
    session_id: i64,
    progress: &Channel<ReferenceProgress>,
    cancelled: &Arc<AtomicBool>,
) -> Result<ImportedReference, String> {
    let job_path = create_job_dir(&input.job_id)?;
    let _cleanup = TempJobDir(job_path.clone());
    let acquired = acquire_reference(input, &job_path, progress, cancelled).await?;
    ensure_not_cancelled(cancelled)?;

    let dest_dir = ai_video_session_dir(app, session_id)?.join("reference");
    if dest_dir.exists() {
        std::fs::remove_dir_all(&dest_dir)
            .map_err(|error| format!("Could not replace the previous example: {error}"))?;
    }
    std::fs::create_dir_all(&dest_dir)
        .map_err(|error| format!("Could not create the example folder: {error}"))?;
    let extension = acquired
        .path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("mp4");
    let dest = dest_dir.join(format!("example.{extension}"));
    if acquired.path.starts_with(&job_path) {
        if std::fs::rename(&acquired.path, &dest).is_err() {
            std::fs::copy(&acquired.path, &dest)
                .map_err(|error| format!("Could not store the example: {error}"))?;
        }
    } else {
        std::fs::copy(&acquired.path, &dest)
            .map_err(|error| format!("Could not store the example: {error}"))?;
    }
    emit(progress, "downloaded", 100, "Example ready");
    Ok(ImportedReference {
        path: dest.to_string_lossy().to_string(),
        metadata: acquired.metadata(),
    })
}

/// Measure every shot of a local video. Progress is reported on `on_event`; cancel with
/// `cancel_reference_analysis` using the same job id.
#[tauri::command]
pub async fn measure_video(
    state: State<'_, ReferenceAnalysisState>,
    input: MeasureVideoInput,
    on_event: Channel<ReferenceProgress>,
) -> Result<VideoMeasurement, String> {
    validate_job_id(&input.job_id)?;
    let cancelled = state.start(&input.job_id)?;
    let result = measure_video_inner(&input, &on_event, &cancelled).await;
    state.finish(&input.job_id);
    result
}

async fn measure_video_inner(
    input: &MeasureVideoInput,
    progress: &Channel<ReferenceProgress>,
    cancelled: &Arc<AtomicBool>,
) -> Result<VideoMeasurement, String> {
    let limits = Limits::configured();
    let path = validate_local_video(&input.path, u64::MAX)?;
    emit(progress, "probing", 2, "Reading video details");
    let probed = probe_video(&path, limits.job_timeout, cancelled).await?;
    // Decoding is roughly real time in the worst case, so scale the budget with the length.
    let budget = limits.job_timeout + probed.duration.ceil() as u64;

    let frames = collect_frame_stats(&path, probed.duration, budget, progress, cancelled).await?;
    if frames.is_empty() {
        return Err("No video frames could be decoded.".into());
    }
    let fps = effective_fps(&frames, probed.fps);
    let transitions = Transitions::detect(&frames, fps);
    let boundaries = detect_boundaries(&frames, &transitions);
    let mut ranges = shot_ranges(&frames, &boundaries);
    if let Some(max) = input.max_shot_seconds.filter(|value| *value > 0.0) {
        ranges = split_long_ranges(&frames, ranges, max);
    }

    let mut shots: Vec<MeasuredShot> = ranges
        .iter()
        .enumerate()
        .map(|(index, range)| {
            measure_shot(&frames, index, range, fps, probed.duration, &transitions)
        })
        .collect();

    if input.keyframes {
        emit(progress, "keyframes", 92, "Saving a still from every shot");
        let dir = path
            .parent()
            .ok_or("The video has no parent folder.")?
            .join("keyframes");
        let frame_indices: Vec<u64> = ranges
            .iter()
            .map(|range| frames[(range.start + range.end) / 2].index)
            .collect();
        let paths =
            extract_keyframes(&path, &dir, &frame_indices, budget, cancelled).await?;
        for (shot, keyframe) in shots.iter_mut().zip(paths) {
            shot.keyframe_path = Some(keyframe.to_string_lossy().to_string());
        }
    }

    emit(progress, "measured", 100, format!("Found {} shots", shots.len()));
    Ok(VideoMeasurement {
        duration: round(probed.duration, 3),
        width: probed.width,
        height: probed.height,
        fps: round(fps, 3),
        frame_count: frames.len(),
        cut_threshold: round(transitions.threshold, 2),
        shots,
    })
}

/// Stream ffmpeg's per-frame metadata instead of buffering it: long videos print tens of MB.
async fn collect_frame_stats(
    path: &Path,
    duration: f64,
    timeout_seconds: u64,
    progress: &Channel<ReferenceProgress>,
    cancelled: &Arc<AtomicBool>,
) -> Result<Vec<FrameStat>, String> {
    ensure_not_cancelled(cancelled)?;
    let filter = format!(
        "scale={STATS_WIDTH}:-2,signalstats,scdet=threshold=100:sc_pass=0,metadata=mode=print:file=-"
    );
    let mut command = Command::new(crate::sidecar::resolve_sidecar_binary("ffmpeg")?);
    command
        .args(["-hide_banner", "-nostdin", "-loglevel", "error", "-i"])
        .arg(path)
        .args(["-an", "-sn", "-dn", "-vf", &filter, "-f", "null", "-"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    hide_console(&mut command);
    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not start video tool: {error}"))?;
    let stdout = child.stdout.take().ok_or("ffmpeg stdout unavailable")?;
    let mut stderr = child.stderr.take().ok_or("ffmpeg stderr unavailable")?;
    let stderr_task = tokio::spawn(async move {
        let mut text = String::new();
        let _ = stderr.read_to_string(&mut text).await;
        text
    });

    let parse = async {
        let mut lines = BufReader::new(stdout).lines();
        let mut frames = Vec::new();
        let mut current: Option<FrameStat> = None;
        let mut last_percent = 0u8;
        while let Some(line) = lines
            .next_line()
            .await
            .map_err(|error| format!("Could not read video measurements: {error}"))?
        {
            if line.starts_with("frame:") {
                frames.extend(current.take());
                current = parse_frame_header(&line);
                if let Some(frame) = current {
                    let percent = (5.0 + (frame.time / duration.max(0.001)) * 85.0).min(90.0) as u8;
                    if percent >= last_percent + 2 {
                        last_percent = percent;
                        emit(progress, "measuring", percent, "Measuring every frame");
                    }
                }
            } else if let (Some(frame), Some((key, value))) = (current.as_mut(), line.split_once('='))
            {
                apply_metadata(frame, key, value);
            }
        }
        frames.extend(current);
        Ok::<_, String>(frames)
    };

    let frames = tokio::select! {
        result = timeout(Duration::from_secs(timeout_seconds), parse) => match result {
            Ok(frames) => frames?,
            Err(_) => return Err(format!("Measuring the video timed out after {timeout_seconds} seconds.")),
        },
        _ = wait_for_cancellation(cancelled.clone()) => return Err("Reference analysis cancelled.".into()),
    };
    let status = child
        .wait()
        .await
        .map_err(|error| format!("Video tool failed: {error}"))?;
    let stderr = stderr_task.await.unwrap_or_default();
    if !status.success() {
        return Err(format!(
            "Could not measure the video: {}",
            stderr.lines().last().unwrap_or("unknown error")
        ));
    }
    Ok(frames)
}

fn parse_frame_header(line: &str) -> Option<FrameStat> {
    let mut frame = FrameStat::default();
    let mut has_time = false;
    for token in line.split_whitespace() {
        if let Some(value) = token.strip_prefix("frame:") {
            frame.index = value.parse().ok()?;
        } else if let Some(value) = token.strip_prefix("pts_time:") {
            frame.time = value.parse().ok().filter(|time: &f64| time.is_finite())?;
            has_time = true;
        }
    }
    has_time.then_some(frame)
}

fn apply_metadata(frame: &mut FrameStat, key: &str, value: &str) {
    let Ok(number) = value.trim().parse::<f64>() else {
        return;
    };
    match key {
        "lavfi.signalstats.YAVG" => frame.y = number,
        "lavfi.signalstats.UAVG" => frame.u = number,
        "lavfi.signalstats.VAVG" => frame.v = number,
        "lavfi.signalstats.SATAVG" => frame.sat = number,
        "lavfi.signalstats.YDIF" => frame.ydif = number,
        "lavfi.scd.score" => frame.score = number,
        _ => {}
    }
}

fn effective_fps(frames: &[FrameStat], probed: f64) -> f64 {
    let span = frames.last().map(|f| f.time).unwrap_or(0.0) - frames[0].time;
    if frames.len() > 1 && span > 0.0 {
        (frames.len() - 1) as f64 / span
    } else if probed > 0.0 {
        probed
    } else {
        30.0
    }
}

fn median(values: &mut [f64]) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    values.sort_by(f64::total_cmp);
    values[values.len() / 2]
}

/// Robust per-video threshold: busy handheld footage has a higher noise floor than tripod shots.
fn cut_threshold(frames: &[FrameStat]) -> f64 {
    let mut scores: Vec<f64> = frames.iter().map(|frame| frame.score).collect();
    let center = median(&mut scores);
    let mut deviations: Vec<f64> = scores.iter().map(|score| (score - center).abs()).collect();
    let mad = median(&mut deviations);
    (center + 10.0 * mad).clamp(CUT_THRESHOLD_MIN, CUT_THRESHOLD_MAX)
}

fn color_distance(a: &FrameStat, b: &FrameStat) -> f64 {
    ((a.y - b.y).powi(2) + (a.u - b.u).powi(2) + (a.v - b.v).powi(2)).sqrt()
}

/// Short bursts of brightness (white flashes). Returns inclusive frame spans.
fn detect_flashes(frames: &[FrameStat]) -> Vec<(usize, usize)> {
    let mut spans = Vec::new();
    let mut index = 1;
    while index < frames.len() {
        if frames[index].y - frames[index - 1].y >= FLASH_RISE {
            let mut peak = frames[index].y;
            let end = (index + 1..(index + 1 + FLASH_MAX_FRAMES).min(frames.len())).find(|&next| {
                peak = peak.max(frames[next].y);
                frames[next].y <= peak - FLASH_FALL
            });
            if let Some(end) = end {
                spans.push((index, end - 1));
                index = end + 1;
                continue;
            }
        }
        index += 1;
    }
    spans
}

fn is_local_max(frames: &[FrameStat], index: usize, radius: usize) -> bool {
    let from = index.saturating_sub(radius);
    let to = (index + radius).min(frames.len() - 1);
    (from..=to).all(|other| other == index || frames[other].score <= frames[index].score)
}

/// Everything that can separate or bridge shots, detected once per video.
struct Transitions {
    threshold: f64,
    /// Inclusive frame spans.
    flashes: Vec<(usize, usize)>,
    blends: Vec<Blend>,
}

impl Transitions {
    fn detect(frames: &[FrameStat], fps: f64) -> Self {
        Self {
            threshold: cut_threshold(frames),
            flashes: detect_flashes(frames),
            blends: detect_blends(frames, fps),
        }
    }

    /// Frames whose difference comes from the transition rather than motion inside the shot.
    fn is_transition_frame(&self, index: usize) -> bool {
        self.flashes
            .iter()
            .any(|&(start, end)| index >= start && index <= end + 1)
            || self
                .blends
                .iter()
                .any(|blend| index >= blend.start && index <= blend.end)
    }
}

fn detect_boundaries(frames: &[FrameStat], transitions: &Transitions) -> Vec<Boundary> {
    let Transitions {
        threshold,
        flashes,
        blends,
    } = transitions;
    let threshold = *threshold;
    let last = frames.len().saturating_sub(1);
    let in_flash = |index: usize| {
        flashes
            .iter()
            .any(|&(start, end)| index >= start && index <= end + 1)
    };
    let mut boundaries: Vec<Boundary> = (1..frames.len())
        .filter(|&index| {
            frames[index].score >= threshold && !in_flash(index) && is_local_max(frames, index, 2)
        })
        .map(|index| Boundary {
            frame: index,
            transition: Transition::Cut,
            strength: frames[index].score,
        })
        .collect();

    for &(start, end) in flashes.iter() {
        let after = (end + 1).min(last);
        let peak = frames[start..=after]
            .iter()
            .map(|frame| frame.score)
            .fold(0.0, f64::max);
        if peak >= threshold
            && color_distance(&frames[start - 1], &frames[after]) >= FLASH_CUT_COLOR_DISTANCE
        {
            boundaries.push(Boundary {
                frame: after,
                transition: Transition::Flash,
                strength: peak,
            });
        }
    }

    let blends: Vec<Blend> = blends
        .iter()
        .copied()
        .filter(|blend| {
            !boundaries
                .iter()
                .any(|b| b.frame >= blend.start && b.frame <= blend.end)
        })
        .collect();
    boundaries.extend(blend_boundaries(frames, &blends));

    boundaries.sort_by_key(|boundary| boundary.frame);
    let start_time = frames[0].time;
    let end_time = frames[last].time;
    let mut kept: Vec<Boundary> = Vec::with_capacity(boundaries.len());
    for boundary in boundaries {
        let time = frames[boundary.frame].time;
        if time - start_time < MIN_SHOT_SECONDS || end_time - time < MIN_SHOT_SECONDS {
            continue;
        }
        match kept.last_mut() {
            Some(previous) if time - frames[previous.frame].time < MIN_SHOT_SECONDS => {
                if boundary.strength > previous.strength {
                    *previous = boundary;
                }
            }
            _ => kept.push(boundary),
        }
    }
    kept
}

/// Frames `start..end` mix two images (dissolve, fade to or from black).
#[derive(Clone, Copy, Debug, PartialEq)]
struct Blend {
    start: usize,
    end: usize,
}

/// Scene scores stay near zero through a smooth blend, so blends are found from their own shape:
/// frame difference steps up, holds, then steps down, while the average color moves steadily
/// from one image to the other.
fn detect_blends(frames: &[FrameStat], fps: f64) -> Vec<Blend> {
    let min_len = ((fps * 0.25).round() as usize).max(5);
    let max_len = (fps * 2.0).round() as usize;
    let mut blends = Vec::new();
    let mut start = BLEND_BASELINE_FRAMES;
    while start < frames.len() {
        let mut window: Vec<f64> = frames[start - BLEND_BASELINE_FRAMES..start]
            .iter()
            .map(|frame| frame.ydif)
            .collect();
        let baseline = median(&mut window).max(0.3);
        if frames[start].ydif < BLEND_MIN_DIFF || frames[start].ydif < baseline * BLEND_STEP_RATIO {
            start += 1;
            continue;
        }
        let limit = (start + max_len).min(frames.len() - 1);
        let end = (start + min_len..=limit)
            .find(|&end| frames[end].ydif * BLEND_STEP_RATIO <= frames[end - 1].ydif);
        if let Some(end) = end {
            let sustained = frames[start..end]
                .iter()
                .all(|frame| frame.ydif >= baseline * 1.3);
            let net = color_distance(&frames[start - 1], &frames[end - 1]);
            let path: f64 = (start..end)
                .map(|index| color_distance(&frames[index - 1], &frames[index]))
                .sum();
            if sustained && net >= BLEND_COLOR_DISTANCE && net >= path * BLEND_MONOTONIC {
                blends.push(Blend { start, end });
                start = end;
                continue;
            }
        }
        start += 1;
    }
    blends
}

/// A fade out to black followed by a fade in is one "dip" transition; lone fades at the very
/// start or end of a shot are styling, not shot changes.
fn blend_boundaries(frames: &[FrameStat], blends: &[Blend]) -> Vec<Boundary> {
    let is_black = |index: usize| frames[index].y < BLACK_LUMA;
    let mut boundaries = Vec::new();
    let mut index = 0;
    while index < blends.len() {
        let blend = blends[index];
        if is_black(blend.end - 1) {
            let fade_in = blends.get(index + 1).filter(|next| {
                is_black(next.start - 1)
                    && frames[next.start].time - frames[blend.end - 1].time <= DIP_MAX_BLACK_SECONDS
            });
            if let Some(next) = fade_in {
                boundaries.push(Boundary {
                    frame: (blend.end + next.start) / 2,
                    transition: Transition::Dip,
                    strength: 0.0,
                });
                index += 2;
                continue;
            }
        } else if !is_black(blend.start - 1) {
            boundaries.push(Boundary {
                frame: (blend.start + blend.end) / 2,
                transition: Transition::Dissolve,
                strength: 0.0,
            });
        }
        index += 1;
    }
    boundaries
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct ShotRange {
    /// Inclusive first frame, exclusive end frame.
    start: usize,
    end: usize,
    transition_in: Transition,
}

fn shot_ranges(frames: &[FrameStat], boundaries: &[Boundary]) -> Vec<ShotRange> {
    let mut ranges = Vec::with_capacity(boundaries.len() + 1);
    let mut start = 0;
    let mut transition_in = Transition::Start;
    for boundary in boundaries {
        ranges.push(ShotRange {
            start,
            end: boundary.frame,
            transition_in,
        });
        start = boundary.frame;
        transition_in = boundary.transition;
    }
    ranges.push(ShotRange {
        start,
        end: frames.len(),
        transition_in,
    });
    ranges
}

fn split_long_ranges(frames: &[FrameStat], ranges: Vec<ShotRange>, max_seconds: f64) -> Vec<ShotRange> {
    let mut split = Vec::with_capacity(ranges.len());
    for range in ranges {
        let duration = range_end_time(frames, &range, None) - frames[range.start].time;
        let parts = (duration / max_seconds).ceil().max(1.0) as usize;
        let frame_count = range.end - range.start;
        if parts <= 1 || frame_count < parts {
            split.push(range);
            continue;
        }
        for part in 0..parts {
            split.push(ShotRange {
                start: range.start + frame_count * part / parts,
                end: range.start + frame_count * (part + 1) / parts,
                transition_in: if part == 0 {
                    range.transition_in
                } else {
                    Transition::Continuous
                },
            });
        }
    }
    split
}

fn range_end_time(frames: &[FrameStat], range: &ShotRange, duration: Option<f64>) -> f64 {
    frames
        .get(range.end)
        .map(|frame| frame.time)
        .or(duration)
        .unwrap_or_else(|| frames[range.end - 1].time)
}

fn measure_shot(
    frames: &[FrameStat],
    index: usize,
    range: &ShotRange,
    fps: f64,
    duration: f64,
    transitions: &Transitions,
) -> MeasuredShot {
    let slice = &frames[range.start..range.end];
    let count = slice.len() as f64;
    let mean = |pick: fn(&FrameStat) -> f64| slice.iter().map(pick).sum::<f64>() / count;
    // The first frame's difference is measured against the previous shot.
    let mut motion_frames: Vec<FrameStat> = (range.start + 1..range.end)
        .filter(|&frame| !transitions.is_transition_frame(frame))
        .map(|frame| frames[frame])
        .collect();
    if motion_frames.is_empty() {
        motion_frames = slice.to_vec();
    }
    let motion_mean =
        motion_frames.iter().map(|f| f.ydif).sum::<f64>() / motion_frames.len() as f64;
    let motion_peak = motion_frames.iter().map(|f| f.ydif).fold(0.0, f64::max);
    let start = slice[0].time;
    let end = range_end_time(frames, range, Some(duration));

    MeasuredShot {
        index,
        start: round(start, 3),
        end: round(end, 3),
        duration: round(end - start, 3),
        transition_in: range.transition_in,
        motion: round((motion_mean / MOTION_FULL_SCALE).min(1.0), 3),
        motion_peak: round((motion_peak / MOTION_FULL_SCALE).min(1.0), 3),
        brightness: round(mean(|f| f.y) / 255.0, 3),
        saturation: round((mean(|f| f.sat) / SATURATION_FULL_SCALE).min(1.0), 3),
        average_color: yuv_to_hex(mean(|f| f.y), mean(|f| f.u), mean(|f| f.v)),
        speed_ramp_hint: speed_ramp_hint(&motion_frames, end - start),
        freeze_hint: freeze_hint(&motion_frames, motion_mean, fps),
        // A flash that runs into the next shot is that shot's transition, not an in-shot effect.
        flashes: transitions
            .flashes
            .iter()
            .filter(|&&(flash_start, flash_end)| {
                flash_start >= range.start && flash_end + 1 < range.end
            })
            .map(|&(flash_start, _)| round(frames[flash_start].time, 3))
            .collect(),
        keyframe_path: None,
    }
}

fn speed_ramp_hint(frames: &[FrameStat], duration: f64) -> bool {
    if duration < 1.2 || frames.len() < 9 {
        return false;
    }
    let third = frames.len() / 3;
    let average = |part: &[FrameStat]| part.iter().map(|f| f.ydif).sum::<f64>() / part.len() as f64;
    let head = average(&frames[..third]);
    let tail = average(&frames[frames.len() - third..]);
    let (low, high) = if head < tail { (head, tail) } else { (tail, head) };
    high >= 3.0 && high / low.max(0.3) >= 2.5
}

fn freeze_hint(frames: &[FrameStat], motion_mean: f64, fps: f64) -> bool {
    if motion_mean < 1.5 {
        return false;
    }
    let needed = ((fps * 0.4).round() as usize).max(3);
    let mut run = 0;
    for frame in frames {
        run = if frame.ydif < FREEZE_FRAME_DIFF { run + 1 } else { 0 };
        if run >= needed {
            return true;
        }
    }
    false
}

fn yuv_to_hex(y: f64, u: f64, v: f64) -> String {
    let channel = |value: f64| value.round().clamp(0.0, 255.0) as u8;
    let r = channel(y + 1.402 * (v - 128.0));
    let g = channel(y - 0.344 * (u - 128.0) - 0.714 * (v - 128.0));
    let b = channel(y + 1.772 * (u - 128.0));
    format!("#{r:02x}{g:02x}{b:02x}")
}

/// One decode pass selects every requested frame; the filter goes through a script file so
/// hundreds of shots never hit the command-line length limit.
async fn extract_keyframes(
    video: &Path,
    dir: &Path,
    frame_indices: &[u64],
    timeout_seconds: u64,
    cancelled: &Arc<AtomicBool>,
) -> Result<Vec<PathBuf>, String> {
    if dir.exists() {
        std::fs::remove_dir_all(dir)
            .map_err(|error| format!("Could not clear old keyframes: {error}"))?;
    }
    std::fs::create_dir_all(dir).map_err(|error| format!("Could not create keyframes folder: {error}"))?;
    let selection = frame_indices
        .iter()
        .map(|index| format!("eq(n,{index})"))
        .collect::<Vec<_>>()
        .join("+");
    let script = dir.join("select.txt");
    std::fs::write(&script, format!("select='{selection}',scale={KEYFRAME_WIDTH}:-2"))
        .map_err(|error| format!("Could not write keyframe filter: {error}"))?;

    let pattern = dir.join("shot-%04d.jpg");
    let output = run_command(
        &crate::sidecar::resolve_sidecar_binary("ffmpeg")?,
        &[
            "-hide_banner",
            "-loglevel",
            "error",
            "-nostdin",
            "-i",
            &video.to_string_lossy(),
            "-an",
            "-filter_script:v",
            &script.to_string_lossy(),
            "-vsync",
            "vfr",
            "-q:v",
            "4",
            "-y",
            &pattern.to_string_lossy(),
        ],
        timeout_seconds,
        cancelled,
    )
    .await?;
    let _ = std::fs::remove_file(&script);
    if !output.status.success() {
        return Err(format!("Could not save shot stills: {}", concise_stderr(&output)));
    }
    let paths: Vec<PathBuf> = (1..=frame_indices.len())
        .map(|number| dir.join(format!("shot-{number:04}.jpg")))
        .collect();
    if let Some(missing) = paths.iter().find(|path| !path.exists()) {
        return Err(format!("Shot still missing: {}", missing.display()));
    }
    Ok(paths)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(index: usize, y: f64, ydif: f64, score: f64) -> FrameStat {
        FrameStat {
            index: index as u64,
            time: index as f64 / 30.0,
            y,
            u: 128.0,
            v: 128.0,
            sat: 40.0,
            ydif,
            score,
        }
    }

    fn steady(count: usize, y: f64) -> Vec<FrameStat> {
        (0..count).map(|i| frame(i, y, 1.0, 0.2)).collect()
    }

    fn reindex(mut frames: Vec<FrameStat>) -> Vec<FrameStat> {
        for (i, f) in frames.iter_mut().enumerate() {
            f.index = i as u64;
            f.time = i as f64 / 30.0;
        }
        frames
    }

    #[test]
    fn parses_frame_header() {
        let parsed = parse_frame_header("frame:12   pts:6144    pts_time:0.4").unwrap();
        assert_eq!(parsed.index, 12);
        assert!((parsed.time - 0.4).abs() < 1e-9);
        assert!(parse_frame_header("frame:1 pts:NOPTS pts_time:NAN").is_none());
    }

    #[test]
    fn finds_hard_cut_at_the_score_spike() {
        let mut frames = steady(180, 120.0);
        frames[90].score = 30.0;
        let boundaries = detect_boundaries(&frames, &Transitions::detect(&frames, 30.0));
        assert_eq!(boundaries.len(), 1);
        assert_eq!(boundaries[0].frame, 90);
        assert_eq!(boundaries[0].transition, Transition::Cut);
        let ranges = shot_ranges(&frames, &boundaries);
        assert_eq!(ranges.len(), 2);
        assert_eq!(ranges[1].transition_in, Transition::Cut);
    }

    #[test]
    fn white_flash_between_different_shots_is_one_flash_cut() {
        let mut frames = steady(60, 80.0);
        frames.extend(steady(3, 240.0));
        frames.extend(steady(60, 150.0));
        let mut frames = reindex(frames);
        frames[60].score = 40.0;
        frames[63].score = 35.0;
        let transitions = Transitions::detect(&frames, 30.0);
        assert_eq!(transitions.flashes, vec![(60, 62)]);
        let boundaries = detect_boundaries(&frames, &transitions);
        assert_eq!(boundaries.len(), 1);
        assert_eq!(boundaries[0].transition, Transition::Flash);
        assert_eq!(boundaries[0].frame, 63);
    }

    #[test]
    fn flash_inside_one_shot_is_not_a_cut() {
        let mut frames = steady(60, 100.0);
        frames.extend(steady(2, 230.0));
        frames.extend(steady(60, 100.0));
        let mut frames = reindex(frames);
        frames[60].score = 40.0;
        frames[62].score = 40.0;
        let transitions = Transitions::detect(&frames, 30.0);
        let boundaries = detect_boundaries(&frames, &transitions);
        assert!(boundaries.is_empty());
        let ranges = shot_ranges(&frames, &boundaries);
        let shot = measure_shot(&frames, 0, &ranges[0], 30.0, 4.0, &transitions);
        assert_eq!(shot.flashes, vec![2.0]);
    }

    fn ramp(count: usize, from: f64, step: f64) -> Vec<FrameStat> {
        (0..count)
            .map(|i| frame(0, from + step * (i + 1) as f64, 6.0, 0.1))
            .collect()
    }

    #[test]
    fn gradual_change_becomes_a_dissolve() {
        let mut frames = steady(60, 60.0);
        frames.extend(ramp(15, 52.0, 8.0));
        frames.extend(steady(60, 180.0));
        let frames = reindex(frames);
        let boundaries = detect_boundaries(&frames, &Transitions::detect(&frames, 30.0));
        assert_eq!(boundaries.len(), 1);
        assert_eq!(boundaries[0].transition, Transition::Dissolve);
        assert_eq!(boundaries[0].frame, 67);
    }

    #[test]
    fn fade_through_black_is_one_dip() {
        let mut frames = steady(60, 120.0);
        frames.extend(ramp(12, 120.0, -10.0));
        frames.extend((0..10).map(|_| frame(0, 0.0, 0.0, 0.0)));
        frames.extend(ramp(12, 0.0, 10.0));
        frames.extend(steady(60, 120.0));
        let frames = reindex(frames);
        let boundaries = detect_boundaries(&frames, &Transitions::detect(&frames, 30.0));
        assert_eq!(boundaries.len(), 1);
        assert_eq!(boundaries[0].transition, Transition::Dip);
        assert_eq!(boundaries[0].frame, 77);
    }

    #[test]
    fn steady_camera_motion_is_not_a_blend() {
        let frames: Vec<FrameStat> = (0..120)
            .map(|i| frame(i, 100.0 + (i as f64 * 0.7).sin() * 6.0, 4.0, 0.3))
            .collect();
        assert!(detect_blends(&frames, 30.0).is_empty());
    }

    #[test]
    fn splits_long_source_shots_into_equal_segments() {
        let frames = steady(300, 100.0);
        let ranges = split_long_ranges(&frames, shot_ranges(&frames, &[]), 4.0);
        assert_eq!(ranges.len(), 3);
        assert_eq!(ranges[1].transition_in, Transition::Continuous);
        assert_eq!(ranges[2].end, 300);
    }

    #[test]
    fn hints_speed_ramps_and_freezes() {
        let ramp: Vec<FrameStat> = (0..60)
            .map(|i| frame(i, 100.0, if i < 30 { 1.0 } else { 9.0 }, 0.5))
            .collect();
        assert!(speed_ramp_hint(&ramp, 2.0));
        let mut frozen: Vec<FrameStat> = (0..60).map(|i| frame(i, 100.0, 4.0, 0.5)).collect();
        for f in &mut frozen[20..35] {
            f.ydif = 0.0;
        }
        assert!(freeze_hint(&frozen, 3.0, 30.0));
    }

    #[test]
    fn converts_neutral_yuv_to_grey() {
        assert_eq!(yuv_to_hex(128.0, 128.0, 128.0), "#808080");
    }
}
