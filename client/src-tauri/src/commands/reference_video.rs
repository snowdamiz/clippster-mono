use base64::{engine::general_purpose::STANDARD, Engine as _};
use parking_lot::Mutex;
use regex::Regex;
use reqwest::{header::LOCATION, Url};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::{IpAddr, Ipv4Addr, Ipv6Addr},
    path::{Path, PathBuf},
    process::Output,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, SystemTime},
};
use tauri::{ipc::Channel, AppHandle, State};
use tokio::{fs::File, io::AsyncWriteExt, net::lookup_host, process::Command, time::timeout};

const DEFAULT_MAX_BYTES: u64 = 500 * 1024 * 1024;
const DEFAULT_MAX_DURATION_SECONDS: f64 = 30.0 * 60.0;
const DEFAULT_JOB_TIMEOUT_SECONDS: u64 = 5 * 60;
const DEFAULT_RETENTION_SECONDS: u64 = 60 * 60;
const MAX_FRAMES: usize = 16;

#[derive(Default)]
pub struct ReferenceAnalysisState {
    jobs: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl ReferenceAnalysisState {
    fn start(&self, job_id: &str) -> Result<Arc<AtomicBool>, String> {
        let mut jobs = self.jobs.lock();
        if jobs.contains_key(job_id) {
            return Err("A reference analysis with this ID is already running.".into());
        }
        let cancelled = Arc::new(AtomicBool::new(false));
        jobs.insert(job_id.to_string(), cancelled.clone());
        Ok(cancelled)
    }

    fn finish(&self, job_id: &str) {
        self.jobs.lock().remove(job_id);
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceVideoInput {
    pub job_id: String,
    pub kind: ReferenceInputKind,
    pub value: String,
}

#[derive(Debug, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ReferenceInputKind {
    Url,
    Upload,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceProgress {
    stage: &'static str,
    progress: u8,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceVideoMetadata {
    duration: f64,
    width: u32,
    height: u32,
    fps: f64,
    aspect_ratio: String,
    file_size_bytes: u64,
    source_type: &'static str,
    display_name: String,
    source_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceFrame {
    timestamp: f64,
    kind: &'static str,
    mime_type: &'static str,
    base64_data: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceAnalysisPayload {
    metadata: ReferenceVideoMetadata,
    frames: Vec<ReferenceFrame>,
    cut_timestamps: Vec<f64>,
    audio_peaks: Vec<crate::audio_peaks::AudioPeak>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum RemoteKind {
    Platform,
    Direct,
}

struct TempJobDir(PathBuf);

impl Drop for TempJobDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[tauri::command]
pub async fn cancel_reference_analysis(
    state: State<'_, ReferenceAnalysisState>,
    job_id: String,
) -> Result<bool, String> {
    let jobs = state.jobs.lock();
    if let Some(cancelled) = jobs.get(&job_id) {
        cancelled.store(true, Ordering::Relaxed);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn prepare_reference_video(
    app: AppHandle,
    state: State<'_, ReferenceAnalysisState>,
    input: ReferenceVideoInput,
    on_event: Channel<ReferenceProgress>,
) -> Result<ReferenceAnalysisPayload, String> {
    validate_job_id(&input.job_id)?;
    let cancelled = state.start(&input.job_id)?;
    let result = match timeout(
        Duration::from_secs(Limits::configured().job_timeout),
        prepare_reference_video_inner(&app, &input, &on_event, &cancelled),
    )
    .await
    {
        Ok(result) => result,
        Err(_) => Err("Reference analysis timed out before completion.".into()),
    };
    state.finish(&input.job_id);
    result
}

async fn prepare_reference_video_inner(
    app: &AppHandle,
    input: &ReferenceVideoInput,
    progress: &Channel<ReferenceProgress>,
    cancelled: &Arc<AtomicBool>,
) -> Result<ReferenceAnalysisPayload, String> {
    emit(progress, "validating", 3, "Validating reference video");
    ensure_not_cancelled(cancelled)?;

    let root = std::env::temp_dir().join("clippster-reference-analysis");
    std::fs::create_dir_all(&root)
        .map_err(|error| format!("Could not create reference workspace: {error}"))?;
    cleanup_stale_jobs(
        &root,
        configured_u64(
            "CLIPPSTER_REFERENCE_RETENTION_SECONDS",
            DEFAULT_RETENTION_SECONDS,
        ),
    );
    let job_path = root.join(&input.job_id);
    std::fs::create_dir_all(&job_path)
        .map_err(|error| format!("Could not create reference workspace: {error}"))?;
    let _cleanup = TempJobDir(job_path.clone());

    let limits = Limits::configured();
    let (video_path, display_name, source_url, source_type) = match input.kind {
        ReferenceInputKind::Url => {
            let url = validate_reference_url(&input.value).await?;
            emit(
                progress,
                "downloading",
                10,
                "Downloading one public reference video",
            );
            let kind = classify_remote_url(&url)?;
            let path = match kind {
                RemoteKind::Platform => {
                    download_platform_video(&url, &job_path, &limits, cancelled).await?
                }
                RemoteKind::Direct => {
                    download_direct_video(&url, &job_path, &limits, progress, cancelled).await?
                }
            };
            let name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("reference-video")
                .to_string();
            (path, name, Some(redact_url(&url)), "url")
        }
        ReferenceInputKind::Upload => {
            let path = validate_local_video(&input.value, limits.max_bytes)?;
            let name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("reference-video")
                .to_string();
            (path, name, None, "upload")
        }
    };

    ensure_not_cancelled(cancelled)?;
    emit(
        progress,
        "probing",
        45,
        "Reading duration, dimensions, frame rate, and cuts",
    );
    let probed = probe_video(&video_path, limits.job_timeout, cancelled).await?;
    if probed.duration <= 0.0 {
        return Err("The reference has no readable video duration.".into());
    }
    if probed.duration > limits.max_duration {
        return Err(format!(
            "The reference is {:.0} minutes long; the limit is {:.0} minutes.",
            probed.duration / 60.0,
            limits.max_duration / 60.0
        ));
    }
    if probed.file_size > limits.max_bytes {
        return Err(format!(
            "The reference is {:.1} MB; the limit is {:.0} MB.",
            probed.file_size as f64 / 1_048_576.0,
            limits.max_bytes as f64 / 1_048_576.0
        ));
    }

    let cut_timestamps =
        detect_cuts(&video_path, probed.duration, limits.job_timeout, cancelled).await?;
    emit(
        progress,
        "sampling",
        58,
        "Sampling the full timeline and shot boundaries",
    );
    let frame_specs = frame_sample_plan(probed.duration, &cut_timestamps);
    let mut frames = Vec::with_capacity(frame_specs.len());
    for (index, (timestamp, kind)) in frame_specs.into_iter().enumerate() {
        ensure_not_cancelled(cancelled)?;
        frames.push(
            extract_frame(
                &video_path,
                &job_path,
                index,
                timestamp,
                kind,
                limits.job_timeout,
                cancelled,
            )
            .await?,
        );
        let percent = 58 + (((index + 1) as f64 / MAX_FRAMES as f64) * 20.0) as u8;
        emit(
            progress,
            "sampling",
            percent.min(78),
            format!("Sampled frame {}", index + 1),
        );
    }

    let audio_peaks = match timeout(
        Duration::from_secs(limits.job_timeout),
        crate::audio_peaks::detect_audio_peaks(
            app.clone(),
            video_path.to_string_lossy().to_string(),
            0.35,
            0.75,
        ),
    )
    .await
    {
        Ok(Ok(peaks)) => peaks.into_iter().take(120).collect(),
        _ => Vec::new(),
    };

    ensure_not_cancelled(cancelled)?;
    emit(progress, "analyzing", 80, "Reference evidence prepared");
    Ok(ReferenceAnalysisPayload {
        metadata: ReferenceVideoMetadata {
            duration: round(probed.duration, 3),
            width: probed.width,
            height: probed.height,
            fps: round(probed.fps, 3),
            aspect_ratio: aspect_ratio(probed.width, probed.height),
            file_size_bytes: probed.file_size,
            source_type,
            display_name,
            source_url,
        },
        frames,
        cut_timestamps: cut_timestamps
            .into_iter()
            .map(|value| round(value, 3))
            .collect(),
        audio_peaks,
    })
}

#[derive(Clone, Copy)]
struct Limits {
    max_bytes: u64,
    max_duration: f64,
    job_timeout: u64,
}

impl Limits {
    fn configured() -> Self {
        Self {
            max_bytes: configured_u64("CLIPPSTER_REFERENCE_MAX_BYTES", DEFAULT_MAX_BYTES),
            max_duration: configured_f64(
                "CLIPPSTER_REFERENCE_MAX_DURATION_SECONDS",
                DEFAULT_MAX_DURATION_SECONDS,
            ),
            job_timeout: configured_u64(
                "CLIPPSTER_REFERENCE_TIMEOUT_SECONDS",
                DEFAULT_JOB_TIMEOUT_SECONDS,
            ),
        }
    }
}

#[derive(Debug)]
struct ProbedVideo {
    duration: f64,
    width: u32,
    height: u32,
    fps: f64,
    file_size: u64,
}

async fn probe_video(
    path: &Path,
    timeout_seconds: u64,
    cancelled: &Arc<AtomicBool>,
) -> Result<ProbedVideo, String> {
    let path_string = path.to_string_lossy().to_string();
    let output = run_command(
        &crate::youtube::resolve_sidecar_binary("ffprobe")?,
        &[
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,avg_frame_rate,r_frame_rate:format=duration,size",
            "-of",
            "json",
            &path_string,
        ],
        timeout_seconds,
        cancelled,
    )
    .await?;
    if !output.status.success() {
        return Err(format!(
            "Could not inspect the reference video: {}",
            concise_stderr(&output)
        ));
    }
    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Could not read reference metadata: {error}"))?;
    let stream = json["streams"]
        .as_array()
        .and_then(|streams| streams.first())
        .ok_or("The reference does not contain a readable video stream.")?;
    let duration = parse_json_number(&json["format"]["duration"])
        .ok_or("The reference duration could not be determined.")?;
    let width = stream["width"].as_u64().unwrap_or_default() as u32;
    let height = stream["height"].as_u64().unwrap_or_default() as u32;
    if width == 0 || height == 0 {
        return Err("The reference dimensions could not be determined.".into());
    }
    let fps = stream["avg_frame_rate"]
        .as_str()
        .and_then(parse_ratio)
        .or_else(|| stream["r_frame_rate"].as_str().and_then(parse_ratio))
        .unwrap_or(30.0);
    let file_size = std::fs::metadata(path)
        .map_err(|error| format!("Could not read reference file size: {error}"))?
        .len();
    Ok(ProbedVideo {
        duration,
        width,
        height,
        fps,
        file_size,
    })
}

async fn detect_cuts(
    path: &Path,
    duration: f64,
    timeout_seconds: u64,
    cancelled: &Arc<AtomicBool>,
) -> Result<Vec<f64>, String> {
    let output = run_command(
        &crate::youtube::resolve_sidecar_binary("ffmpeg")?,
        &[
            "-hide_banner",
            "-nostdin",
            "-i",
            &path.to_string_lossy(),
            "-filter:v",
            "select='gt(scene,0.32)',showinfo",
            "-an",
            "-f",
            "null",
            "-",
        ],
        timeout_seconds,
        cancelled,
    )
    .await?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    let regex = Regex::new(r"pts_time:([0-9]+(?:\.[0-9]+)?)").expect("valid cut timestamp regex");
    let mut cuts: Vec<f64> = regex
        .captures_iter(&stderr)
        .filter_map(|capture| capture[1].parse::<f64>().ok())
        .filter(|value| *value > 0.15 && *value < duration - 0.15)
        .take(120)
        .collect();
    cuts.sort_by(f64::total_cmp);
    cuts.dedup_by(|a, b| (*a - *b).abs() < 0.12);
    Ok(cuts)
}

fn frame_sample_plan(duration: f64, cuts: &[f64]) -> Vec<(f64, &'static str)> {
    let selected_cuts = evenly_spaced_values(cuts, 4);
    let mut samples = Vec::with_capacity(MAX_FRAMES);
    for cut in selected_cuts {
        samples.push(((cut - 0.12).max(0.02), "cut-before"));
        samples.push(((cut + 0.12).min(duration - 0.02), "cut-after"));
    }
    for index in 0..8 {
        samples.push((((index as f64 + 0.5) / 8.0) * duration, "uniform"));
    }
    samples.sort_by(|a, b| a.0.total_cmp(&b.0));
    samples.dedup_by(|a, b| (a.0 - b.0).abs() < 0.08);
    samples.truncate(MAX_FRAMES);
    samples
}

async fn extract_frame(
    video_path: &Path,
    job_path: &Path,
    index: usize,
    timestamp: f64,
    kind: &'static str,
    timeout_seconds: u64,
    cancelled: &Arc<AtomicBool>,
) -> Result<ReferenceFrame, String> {
    let frame_path = job_path.join(format!("frame-{index:02}.jpg"));
    let output = run_command(
        &crate::youtube::resolve_sidecar_binary("ffmpeg")?,
        &[
            "-hide_banner",
            "-loglevel",
            "error",
            "-nostdin",
            "-ss",
            &format!("{timestamp:.3}"),
            "-i",
            &video_path.to_string_lossy(),
            "-frames:v",
            "1",
            "-vf",
            "scale=640:-2:force_original_aspect_ratio=decrease",
            "-q:v",
            "5",
            "-y",
            &frame_path.to_string_lossy(),
        ],
        timeout_seconds,
        cancelled,
    )
    .await?;
    if !output.status.success() || !frame_path.exists() {
        return Err(format!(
            "Could not sample the reference at {timestamp:.1}s: {}",
            concise_stderr(&output)
        ));
    }
    let bytes = std::fs::read(&frame_path)
        .map_err(|error| format!("Could not read sampled frame: {error}"))?;
    Ok(ReferenceFrame {
        timestamp: round(timestamp, 3),
        kind,
        mime_type: "image/jpeg",
        base64_data: STANDARD.encode(bytes),
    })
}

async fn download_platform_video(
    url: &Url,
    job_path: &Path,
    limits: &Limits,
    cancelled: &Arc<AtomicBool>,
) -> Result<PathBuf, String> {
    let ytdlp = crate::youtube::resolve_sidecar_binary("yt-dlp")?;
    let url_string = url.as_str().to_string();
    let metadata = run_command(
        &ytdlp,
        &[
            "--dump-single-json",
            "--skip-download",
            "--no-playlist",
            "--no-warnings",
            "--socket-timeout",
            "15",
            "--retries",
            "2",
            &url_string,
        ],
        45,
        cancelled,
    )
    .await?;
    if !metadata.status.success() {
        return Err(actionable_download_error(&metadata));
    }
    let info: serde_json::Value = serde_json::from_slice(&metadata.stdout)
        .map_err(|_| "The video provider returned invalid metadata.".to_string())?;
    if info["_type"].as_str() == Some("playlist") || info["entries"].is_array() {
        return Err("Playlist URLs are not supported. Paste one video URL.".into());
    }
    if info["is_live"].as_bool() == Some(true) {
        return Err(
            "Live videos cannot be used as references. Use a completed public video.".into(),
        );
    }
    if let Some(duration) = parse_json_number(&info["duration"]) {
        if duration > limits.max_duration {
            return Err(format!(
                "The reference is {:.0} minutes long; the limit is {:.0} minutes.",
                duration / 60.0,
                limits.max_duration / 60.0
            ));
        }
    }
    let estimated_size = parse_json_number(&info["filesize"])
        .or_else(|| parse_json_number(&info["filesize_approx"]))
        .unwrap_or_default() as u64;
    if estimated_size > limits.max_bytes {
        return Err(format!(
            "The reference exceeds the {:.0} MB size limit.",
            limits.max_bytes as f64 / 1_048_576.0
        ));
    }

    let output_template = job_path
        .join("reference.%(ext)s")
        .to_string_lossy()
        .to_string();
    let ffmpeg_dir = Path::new(&crate::youtube::resolve_sidecar_binary("ffmpeg")?)
        .parent()
        .unwrap_or(Path::new("."))
        .to_string_lossy()
        .to_string();
    let downloaded = run_command(
        &ytdlp,
        &[
            "--no-playlist",
            "--max-downloads",
            "1",
            "--no-part",
            "--no-warnings",
            "--socket-timeout",
            "15",
            "--retries",
            "2",
            "--max-filesize",
            &limits.max_bytes.to_string(),
            "--ffmpeg-location",
            &ffmpeg_dir,
            "--merge-output-format",
            "mp4",
            "-f",
            "bv*+ba/b",
            "-o",
            &output_template,
            &url_string,
        ],
        limits.job_timeout,
        cancelled,
    )
    .await?;
    if !downloaded.status.success() {
        return Err(actionable_download_error(&downloaded));
    }
    find_downloaded_video(job_path)
}

async fn download_direct_video(
    initial_url: &Url,
    job_path: &Path,
    limits: &Limits,
    progress: &Channel<ReferenceProgress>,
    cancelled: &Arc<AtomicBool>,
) -> Result<PathBuf, String> {
    let mut url = initial_url.clone();
    for _ in 0..=5 {
        let host = url.host_str().ok_or("Reference URL is missing a host.")?;
        let addresses = resolve_public_addresses(&url).await?;
        let socket_addresses = addresses
            .into_iter()
            .map(|address| std::net::SocketAddr::new(address, 443))
            .collect::<Vec<_>>();
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(limits.job_timeout))
            .resolve_to_addrs(host, &socket_addresses)
            .build()
            .map_err(|error| format!("Could not initialize the reference download: {error}"))?;
        ensure_not_cancelled(cancelled)?;
        let mut response = client
            .get(url.clone())
            .send()
            .await
            .map_err(|error| format!("Could not download the reference: {error}"))?;
        if response.status().is_redirection() {
            let location = response
                .headers()
                .get(LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or("The reference redirected without a valid destination.")?;
            url = url
                .join(location)
                .map_err(|_| "The reference redirected to an invalid URL.".to_string())?;
            if classify_remote_url(&url)? != RemoteKind::Direct {
                return Err("A direct video URL redirected to an unsupported page.".into());
            }
            continue;
        }
        if !response.status().is_success() {
            return Err(format!(
                "The reference server returned HTTP {}.",
                response.status()
            ));
        }
        if response
            .content_length()
            .is_some_and(|size| size > limits.max_bytes)
        {
            return Err(format!(
                "The reference exceeds the {:.0} MB size limit.",
                limits.max_bytes as f64 / 1_048_576.0
            ));
        }
        let output_path = job_path.join("reference.mp4");
        let mut file = File::create(&output_path)
            .await
            .map_err(|error| format!("Could not create the temporary reference file: {error}"))?;
        let total = response.content_length();
        let mut downloaded = 0u64;
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|error| format!("Reference download stalled: {error}"))?
        {
            ensure_not_cancelled(cancelled)?;
            downloaded += chunk.len() as u64;
            if downloaded > limits.max_bytes {
                return Err(format!(
                    "The reference exceeds the {:.0} MB size limit.",
                    limits.max_bytes as f64 / 1_048_576.0
                ));
            }
            file.write_all(&chunk)
                .await
                .map_err(|error| format!("Could not save the reference: {error}"))?;
            if let Some(total) = total {
                let percent = 10 + ((downloaded as f64 / total as f64) * 30.0) as u8;
                emit(
                    progress,
                    "downloading",
                    percent.min(40),
                    "Downloading reference video",
                );
            }
        }
        file.flush()
            .await
            .map_err(|error| format!("Could not finish saving the reference: {error}"))?;
        return Ok(output_path);
    }
    Err("The reference redirected too many times.".into())
}

async fn run_command(
    binary: &str,
    args: &[&str],
    timeout_seconds: u64,
    cancelled: &Arc<AtomicBool>,
) -> Result<Output, String> {
    ensure_not_cancelled(cancelled)?;
    let mut command = Command::new(binary);
    command.args(args).kill_on_drop(true);
    hide_console(&mut command);
    tokio::select! {
        result = timeout(Duration::from_secs(timeout_seconds), command.output()) => {
            match result {
                Ok(Ok(output)) => Ok(output),
                Ok(Err(error)) => Err(format!("Could not start video tool: {error}")),
                Err(_) => Err(format!("Reference processing timed out after {timeout_seconds} seconds.")),
            }
        }
        _ = wait_for_cancellation(cancelled.clone()) => Err("Reference analysis cancelled.".into()),
    }
}

async fn wait_for_cancellation(cancelled: Arc<AtomicBool>) {
    while !cancelled.load(Ordering::Relaxed) {
        tokio::time::sleep(Duration::from_millis(75)).await;
    }
}

fn hide_console(_command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        _command.creation_flags(0x08000000);
    }
}

async fn validate_reference_url(value: &str) -> Result<Url, String> {
    let url =
        Url::parse(value.trim()).map_err(|_| "Enter a valid public video URL.".to_string())?;
    classify_remote_url(&url)?;
    validate_public_host(&url).await?;
    Ok(url)
}

fn classify_remote_url(url: &Url) -> Result<RemoteKind, String> {
    if url.scheme() != "https" {
        return Err("Reference URLs must use HTTPS.".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Reference URLs cannot contain embedded credentials.".into());
    }
    if url.port().is_some_and(|port| port != 443) {
        return Err("Reference URLs cannot use custom ports.".into());
    }
    if url.path().to_ascii_lowercase().contains("playlist")
        || url
            .query_pairs()
            .any(|(key, _)| key.eq_ignore_ascii_case("list"))
    {
        return Err("Playlist URLs are not supported. Paste one video URL.".into());
    }
    let host = url.host_str().ok_or("Reference URL is missing a host.")?;
    if is_platform_host(host) {
        return Ok(RemoteKind::Platform);
    }
    let extension = Path::new(url.path())
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if ["mp4", "mov", "webm", "mkv"].contains(&extension.as_str()) {
        Ok(RemoteKind::Direct)
    } else {
        Err(
            "Supported references are YouTube, TikTok, Vimeo, Rumble, or a direct video file URL."
                .into(),
        )
    }
}

fn is_platform_host(host: &str) -> bool {
    [
        "youtube.com",
        "youtu.be",
        "tiktok.com",
        "vimeo.com",
        "rumble.com",
    ]
    .iter()
    .any(|allowed| {
        host.eq_ignore_ascii_case(allowed)
            || host.to_ascii_lowercase().ends_with(&format!(".{allowed}"))
    })
}

async fn validate_public_host(url: &Url) -> Result<(), String> {
    resolve_public_addresses(url).await.map(|_| ())
}

async fn resolve_public_addresses(url: &Url) -> Result<Vec<IpAddr>, String> {
    let host = url.host_str().ok_or("Reference URL is missing a host.")?;
    if host.eq_ignore_ascii_case("localhost") || host.ends_with(".localhost") {
        return Err("Local and private-network reference URLs are not allowed.".into());
    }
    if let Ok(ip) = host.parse::<IpAddr>() {
        return if is_public_ip(ip) {
            Ok(vec![ip])
        } else {
            Err("Local and private-network reference URLs are not allowed.".into())
        };
    }
    let addresses = timeout(Duration::from_secs(10), lookup_host((host, 443)))
        .await
        .map_err(|_| "Reference host lookup timed out.".to_string())?
        .map_err(|_| "Reference host could not be resolved.".to_string())?
        .map(|address| address.ip())
        .collect::<Vec<_>>();
    if addresses.is_empty() || addresses.iter().any(|ip| !is_public_ip(*ip)) {
        return Err("Local and private-network reference URLs are not allowed.".into());
    }
    Ok(addresses)
}

fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => is_public_ipv4(ip),
        IpAddr::V6(ip) => is_public_ipv6(ip),
    }
}

fn is_public_ipv4(ip: Ipv4Addr) -> bool {
    let [a, b, c, _] = ip.octets();
    !(ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_broadcast()
        || ip.is_unspecified()
        || ip.is_multicast()
        || a == 0
        || a >= 224
        || (a == 100 && (64..=127).contains(&b))
        || (a == 192 && b == 0 && c == 0)
        || (a == 192 && b == 0 && c == 2)
        || (a == 198 && (b == 18 || b == 19))
        || (a == 198 && b == 51 && c == 100)
        || (a == 203 && b == 0 && c == 113))
}

fn is_public_ipv6(ip: Ipv6Addr) -> bool {
    if let Some(ipv4) = ip.to_ipv4_mapped() {
        return is_public_ipv4(ipv4);
    }
    let first = ip.segments()[0];
    !(ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_multicast()
        || (first & 0xfe00) == 0xfc00
        || (first & 0xffc0) == 0xfe80
        || (first == 0x2001 && ip.segments()[1] == 0x0db8))
}

fn validate_local_video(value: &str, max_bytes: u64) -> Result<PathBuf, String> {
    let path = PathBuf::from(value);
    if !path.is_file() {
        return Err("The uploaded reference video could not be found.".into());
    }
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !["mp4", "mov", "webm", "mkv", "avi", "m4v"].contains(&extension.as_str()) {
        return Err("Choose an MP4, MOV, WebM, MKV, AVI, or M4V video.".into());
    }
    let size = std::fs::metadata(&path)
        .map_err(|error| format!("Could not read the uploaded reference: {error}"))?
        .len();
    if size > max_bytes {
        return Err(format!(
            "The reference exceeds the {:.0} MB size limit.",
            max_bytes as f64 / 1_048_576.0
        ));
    }
    Ok(path)
}

fn find_downloaded_video(job_path: &Path) -> Result<PathBuf, String> {
    std::fs::read_dir(job_path)
        .map_err(|error| format!("Could not read the downloaded reference: {error}"))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| {
            path.is_file()
                && path.extension().and_then(|extension| extension.to_str()).is_some_and(|extension| {
                    ["mp4", "mov", "webm", "mkv", "avi", "m4v"].contains(&extension.to_ascii_lowercase().as_str())
                })
        })
        .ok_or_else(|| "The provider did not return a usable video. It may be private, deleted, DRM-protected, or unsupported.".into())
}

fn actionable_download_error(output: &Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).to_ascii_lowercase();
    if stderr.contains("drm") {
        "This video is DRM-protected and cannot be analyzed.".into()
    } else if stderr.contains("private") || stderr.contains("login") || stderr.contains("sign in") {
        "This video is private or requires sign-in. Use a public reference.".into()
    } else if stderr.contains("unavailable")
        || stderr.contains("deleted")
        || stderr.contains("not available")
    {
        "This video is deleted or unavailable in your region.".into()
    } else if stderr.contains("unsupported url") {
        "This video host or URL format is not supported.".into()
    } else if stderr.contains("larger than max-filesize") {
        "This reference exceeds the configured size limit.".into()
    } else {
        format!(
            "The reference could not be downloaded: {}",
            concise_stderr(output)
        )
    }
}

fn concise_stderr(output: &Output) -> String {
    String::from_utf8_lossy(&output.stderr)
        .lines()
        .rev()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("unknown video error")
        .chars()
        .take(300)
        .collect()
}

fn evenly_spaced_values(values: &[f64], count: usize) -> Vec<f64> {
    if values.len() <= count {
        return values.to_vec();
    }
    (0..count)
        .map(|index| values[index * (values.len() - 1) / (count - 1)])
        .collect()
}

fn parse_json_number(value: &serde_json::Value) -> Option<f64> {
    value.as_f64().or_else(|| value.as_str()?.parse().ok())
}

fn parse_ratio(value: &str) -> Option<f64> {
    let (numerator, denominator) = value.split_once('/')?;
    let numerator = numerator.parse::<f64>().ok()?;
    let denominator = denominator.parse::<f64>().ok()?;
    (denominator != 0.0).then_some(numerator / denominator)
}

fn aspect_ratio(width: u32, height: u32) -> String {
    let divisor = gcd(width, height).max(1);
    format!("{}:{}", width / divisor, height / divisor)
}

fn gcd(mut a: u32, mut b: u32) -> u32 {
    while b != 0 {
        (a, b) = (b, a % b);
    }
    a
}

fn round(value: f64, places: i32) -> f64 {
    let factor = 10f64.powi(places);
    (value * factor).round() / factor
}

fn redact_url(url: &Url) -> String {
    let mut redacted = url.clone();
    redacted.set_fragment(None);
    if classify_remote_url(url) == Ok(RemoteKind::Direct) {
        redacted.set_query(None);
    }
    redacted.to_string()
}

fn ensure_not_cancelled(cancelled: &AtomicBool) -> Result<(), String> {
    if cancelled.load(Ordering::Relaxed) {
        Err("Reference analysis cancelled.".into())
    } else {
        Ok(())
    }
}

fn emit(
    progress: &Channel<ReferenceProgress>,
    stage: &'static str,
    percent: u8,
    message: impl Into<String>,
) {
    let _ = progress.send(ReferenceProgress {
        stage,
        progress: percent,
        message: message.into(),
    });
}

fn validate_job_id(job_id: &str) -> Result<(), String> {
    if !job_id.is_empty()
        && job_id.len() <= 80
        && job_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        Ok(())
    } else {
        Err("Invalid reference analysis job ID.".into())
    }
}

fn cleanup_stale_jobs(root: &Path, retention_seconds: u64) {
    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let stale = entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .ok()
            .and_then(|modified| SystemTime::now().duration_since(modified).ok())
            .is_some_and(|age| age.as_secs() > retention_seconds);
        if stale {
            let _ = std::fs::remove_dir_all(entry.path());
        }
    }
}

fn configured_u64(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .filter(|value| *value > 0)
        .unwrap_or(default)
}

fn configured_f64(name: &str, default: f64) -> f64 {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .filter(|value| *value > 0.0)
        .unwrap_or(default)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_supported_single_video_urls() {
        assert_eq!(
            classify_remote_url(&Url::parse("https://youtu.be/abc123").unwrap()),
            Ok(RemoteKind::Platform)
        );
        assert_eq!(
            classify_remote_url(&Url::parse("https://www.youtube.com/shorts/abc123").unwrap()),
            Ok(RemoteKind::Platform)
        );
        assert_eq!(
            classify_remote_url(&Url::parse("https://www.tiktok.com/@user/video/123").unwrap()),
            Ok(RemoteKind::Platform)
        );
        assert_eq!(
            classify_remote_url(
                &Url::parse("https://cdn.example.com/video.mp4?token=public").unwrap()
            ),
            Ok(RemoteKind::Direct)
        );
    }

    #[test]
    fn rejects_unsafe_or_unsupported_urls() {
        assert!(classify_remote_url(&Url::parse("file:///tmp/reference.mp4").unwrap()).is_err());
        assert!(
            classify_remote_url(&Url::parse("http://example.com/reference.mp4").unwrap()).is_err()
        );
        assert!(classify_remote_url(
            &Url::parse("https://youtube.com/playlist?list=PL123").unwrap()
        )
        .is_err());
        assert!(
            classify_remote_url(&Url::parse("https://example.com/watch/123").unwrap()).is_err()
        );
    }

    #[test]
    fn blocks_private_and_reserved_networks() {
        for ip in [
            "127.0.0.1",
            "10.0.0.1",
            "172.16.0.1",
            "192.168.1.1",
            "169.254.1.1",
            "100.64.0.1",
            "::1",
            "fc00::1",
            "fe80::1",
        ] {
            assert!(!is_public_ip(ip.parse().unwrap()), "{ip} must be blocked");
        }
        assert!(is_public_ip("8.8.8.8".parse().unwrap()));
        assert!(is_public_ip("2606:4700:4700::1111".parse().unwrap()));
    }

    #[test]
    fn samples_uniform_timeline_and_both_sides_of_cuts() {
        let samples = frame_sample_plan(80.0, &[10.0, 20.0, 30.0, 40.0, 50.0, 60.0]);
        assert!(samples.len() <= MAX_FRAMES);
        assert!(samples.iter().any(|(_, kind)| *kind == "uniform"));
        assert!(samples.iter().any(|(_, kind)| *kind == "cut-before"));
        assert!(samples.iter().any(|(_, kind)| *kind == "cut-after"));
        assert!(samples.first().unwrap().0 < 10.0);
        assert!(samples.last().unwrap().0 > 60.0);
    }

    #[test]
    fn redacts_direct_url_credentials_from_persisted_metadata() {
        let url = Url::parse("https://cdn.example.com/video.mp4?token=secret#fragment").unwrap();
        assert_eq!(redact_url(&url), "https://cdn.example.com/video.mp4");
    }
}
