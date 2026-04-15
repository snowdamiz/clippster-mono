//! Speaker diarization via bundled `diarize-*` PyInstaller sidecar (pyannote).

use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};

#[cfg(target_os = "windows")]
fn no_window(cmd: &mut tokio::process::Command) -> &mut tokio::process::Command {
    cmd.creation_flags(0x0800_0000) // CREATE_NO_WINDOW
}

#[cfg(not(target_os = "windows"))]
fn no_window(cmd: &mut tokio::process::Command) -> &mut tokio::process::Command {
    cmd
}

#[derive(Debug, Deserialize)]
struct RawSegment {
    speaker: String,
    start: f64,
    end: f64,
}

fn emit_download_progress_json(app: &tauri::AppHandle, download_id: &str, progress: f64, status: &str) {
    let payload = json!({
        "download_id": download_id,
        "progress": progress,
        "current_time": serde_json::Value::Null,
        "total_time": serde_json::Value::Null,
        "status": status,
    });
    let _ = app.emit("download-progress", payload);
}

/// Map diarize stdout sub-progress (0–100) into overall download band 75–95%.
fn emit_diarize_subprogress(app: &tauri::AppHandle, download_id: &str, sub_percent: f64, detail: &str) {
    let sub = sub_percent.clamp(0.0, 100.0);
    let overall = 75.0 + (sub / 100.0) * 20.0;
    let status = if detail.is_empty() {
        "Analyzing speakers...".to_string()
    } else {
        format!("Analyzing speakers — {}", detail)
    };
    emit_download_progress_json(app, download_id, overall, &status);
}

/// True when the resolved path looks like a real PyInstaller bundle (not the `build.rs` text stub).
fn diarize_binary_is_real_bundle(path: &str) -> bool {
    let p = Path::new(path);
    if !p.is_file() {
        return false;
    }
    let Ok(meta) = std::fs::metadata(p) else {
        return false;
    };
    meta.len() >= 512
}

/// Returns true when the diarize sidecar is a real PyInstaller binary (not the build.rs placeholder).
pub fn is_diarize_available() -> bool {
    match crate::youtube::resolve_sidecar_binary("diarize") {
        Ok(bin) => diarize_binary_is_real_bundle(&bin),
        Err(_) => false,
    }
}

/// Find a working Node.js interpreter (bundled or system).
fn find_node() -> Option<String> {
    // Try the bundled node binary first
    if let Ok(bin) = crate::sidecar::resolve_node_binary() {
        let p = Path::new(&bin);
        if p.is_file() {
            return Some(bin);
        }
    }
    // System PATH fallback
    for name in ["node", "node.exe"] {
        let check = std::process::Command::new(name)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
        if let Ok(s) = check {
            if s.success() {
                return Some(name.to_string());
            }
        }
    }
    None
}

/// Locate `diarize-node.mjs` relative to the executable.
fn find_diarize_node_script() -> Option<PathBuf> {
    find_sidecar_file("diarize-node.mjs")
}

/// Find a working Python interpreter on the system (python3 or python).
fn find_python() -> Option<String> {
    for name in ["python3", "python"] {
        let check = std::process::Command::new(name)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
        if let Ok(s) = check {
            if s.success() {
                return Some(name.to_string());
            }
        }
    }
    None
}

/// Locate `diarize.py` relative to the executable.
fn find_diarize_py() -> Option<PathBuf> {
    find_sidecar_file("diarize.py")
}

/// Generic: locate a file inside sidecars/diarize/ by walking up from the exe.
fn find_sidecar_file(filename: &str) -> Option<PathBuf> {
    let candidates = [
        std::env::current_exe()
            .ok()
            .and_then(|e| e.parent().map(|p| p.to_path_buf()))
            .map(|p| p.join(format!("../../../sidecars/diarize/{}", filename))),
        Some(PathBuf::from(format!(
            "client/src-tauri/sidecars/diarize/{}",
            filename
        ))),
        std::env::current_exe().ok().and_then(|e| {
            let mut p = e;
            for _ in 0..10 {
                p = match p.parent() {
                    Some(parent) => parent.to_path_buf(),
                    None => return None,
                };
                let candidate = p.join(format!("sidecars/diarize/{}", filename));
                if candidate.is_file() {
                    return Some(candidate);
                }
                let candidate2 =
                    p.join(format!("client/src-tauri/sidecars/diarize/{}", filename));
                if candidate2.is_file() {
                    return Some(candidate2);
                }
            }
            None
        }),
    ];
    for c in candidates.into_iter().flatten() {
        let canon = std::fs::canonicalize(&c).unwrap_or(c);
        if canon.is_file() {
            return Some(canon);
        }
    }
    None
}

/// Check if the required Python packages for diarization are available.
async fn check_python_deps(python: &str) -> bool {
    let check = tokio::process::Command::new(python)
        .args(["-c", "import pyannote.audio; print('ok')"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await;
    match check {
        Ok(o) => o.status.success(),
        Err(_) => false,
    }
}

/// Run pyannote sidecar and replace `metadata["speakerTimeline"]` when successful.
/// Returns `Ok(true)` when diarization ran and modified the metadata,
/// `Ok(false)` when it was skipped (binary missing/placeholder AND python fallback unavailable),
/// `Err(...)` when it failed.
pub async fn run_twitter_space_diarization(
    app: &tauri::AppHandle,
    download_id: &str,
    audio_path: &str,
    metadata: &mut Value,
    preferred_num_speakers: Option<usize>,
) -> Result<bool, String> {
    let audio = PathBuf::from(audio_path);
    let out_json = audio.with_extension("diarize_raw.json");

    // Priority: 1) PyInstaller sidecar  2) Node.js + diarize-node.mjs  3) Python + diarize.py
    let use_sidecar = match crate::youtube::resolve_sidecar_binary("diarize") {
        Ok(ref bin) if diarize_binary_is_real_bundle(bin) => true,
        _ => false,
    };

    // Resolve ffmpeg path for the Node script
    let ffmpeg_path = crate::youtube::resolve_sidecar_binary("ffmpeg").ok();

    let mut cmd = if use_sidecar {
        let bin = crate::youtube::resolve_sidecar_binary("diarize").unwrap();
        println!("[diarize] using sidecar binary: {}", bin);
        let mut c = tokio::process::Command::new(&bin);
        no_window(&mut c);
        c
    } else if let (Some(node), Some(script)) = (find_node(), find_diarize_node_script()) {
        // Node.js fallback — uses @huggingface/transformers with pyannote ONNX model
        println!(
            "[diarize] sidecar binary unavailable — using Node.js: {} {}",
            node,
            script.display()
        );
        let mut c = tokio::process::Command::new(&node);
        no_window(&mut c);
        c.arg(script.to_string_lossy().as_ref());
        if let Some(ref ff) = ffmpeg_path {
            c.arg("--ffmpeg").arg(ff);
        }
        c
    } else if let (Some(python), Some(script)) = (find_python(), find_diarize_py()) {
        // Python fallback
        println!(
            "[diarize] Node.js unavailable — falling back to Python: {} {}",
            python,
            script.display()
        );
        if !check_python_deps(&python).await {
            return Err(format!(
                "pyannote.audio not installed for {}. Run: {} -m pip install pyannote.audio",
                python, python
            ));
        }
        let mut c = tokio::process::Command::new(&python);
        no_window(&mut c);
        c.arg(script.to_string_lossy().as_ref());
        c
    } else {
        return Err(
            "No diarization backend available: need Node.js (bundled or system) or Python with pyannote.audio"
                .to_string(),
        );
    };

    cmd.arg("--audio")
        .arg(audio_path)
        .arg("--output")
        .arg(out_json.to_string_lossy().as_ref());
    if let Some(n) = preferred_num_speakers.filter(|n| *n > 0 && *n < 64) {
        cmd.arg("--num-speakers").arg(n.to_string());
    }
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    emit_diarize_subprogress(app, download_id, 0.0, "starting");

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("spawn diarize: {}", e))?;

    let stdout = child.stdout.take().ok_or("diarize: no stdout")?;
    let stderr = child.stderr.take();

    if let Some(stderr) = stderr {
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                eprintln!("[diarize stderr] {}", line);
            }
        });
    }

    {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if let Some(rest) = line.strip_prefix("DIARIZE_PROGRESS ") {
                let mut parts = rest.splitn(4, ' ');
                let pct: f64 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0.0);
                let cur = parts.next().unwrap_or("0");
                let tot = parts.next().unwrap_or("0");
                let msg = parts.next().unwrap_or("").trim();
                let detail = if msg.is_empty() {
                    format!("{}/{}", cur, tot)
                } else {
                    format!("{}/{} {}", cur, tot, msg)
                };
                emit_diarize_subprogress(app, download_id, pct, &detail);
            }
        }
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;
    if !status.success() {
        let _ = tokio::fs::remove_file(&out_json).await;
        return Err(format!("diarize exited with {:?}", status.code()));
    }

    let raw = tokio::fs::read_to_string(&out_json)
        .await
        .map_err(|e| format!("read diarize output: {}", e))?;
    let _ = tokio::fs::remove_file(&out_json).await;

    let segments: Vec<RawSegment> =
        serde_json::from_str(&raw).map_err(|e| format!("diarize JSON: {}", e))?;
    if segments.is_empty() {
        return Err("diarize returned zero segments".into());
    }

    let matched_timeline = map_diarization_to_speaker_timeline(&segments, metadata)?;
    if matched_timeline.is_empty() {
        return Err("mapped speaker timeline empty".into());
    }

    if let Some(arr) = metadata.get("participants").and_then(|v| v.as_array()) {
        let mut tl = matched_timeline.clone();
        crate::twitter::remap_timeline_speaker_ids_to_roster(&mut tl, arr);
        metadata["speakerTimeline"] = Value::Array(tl);
    } else {
        metadata["speakerTimeline"] = Value::Array(matched_timeline);
    }

    Ok(true)
}

fn map_diarization_to_speaker_timeline(
    segments: &[RawSegment],
    metadata: &Value,
) -> Result<Vec<Value>, String> {
    let label_to_uid = build_label_to_participant_map(segments, metadata);
    let mut out = Vec::new();
    for (i, s) in segments.iter().enumerate() {
        let speaker_id = label_to_uid
            .get(&s.speaker)
            .cloned()
            .unwrap_or_else(|| s.speaker.clone());
        out.push(json!({
            "id": format!("dz-{}", i),
            "speakerId": speaker_id,
            "start": s.start,
            "end": s.end,
        }));
    }
    Ok(out)
}

/// Build diarization label → participant ID mapping.
///
/// Strategy (in priority order):
/// 1. If an existing `speakerTimeline` from HLS ID3 data exists, compute overlap between
///    each diarization label's time spans and each participant's ID3 time spans.  The label
///    with the highest temporal overlap with a participant gets assigned to that participant.
/// 2. If `stageJoinHints` exist, use first-speech-time proximity as before.
/// 3. Fall back to participant list ordering with synthetic timing.
///
/// This overlap-based approach is far more accurate than pure first-appearance timing because
/// it leverages the ground-truth speaker IDs embedded in HLS ID3 metadata.
fn build_label_to_participant_map(segments: &[RawSegment], metadata: &Value) -> HashMap<String, String> {
    // Collect per-label stats: first speech time + total duration
    let mut label_first: HashMap<String, f64> = HashMap::new();
    let mut label_duration: HashMap<String, f64> = HashMap::new();
    let mut label_spans: HashMap<String, Vec<(f64, f64)>> = HashMap::new();
    for s in segments {
        label_first
            .entry(s.speaker.clone())
            .and_modify(|t| *t = (*t).min(s.start))
            .or_insert(s.start);
        *label_duration.entry(s.speaker.clone()).or_insert(0.0) += s.end - s.start;
        label_spans.entry(s.speaker.clone()).or_default().push((s.start, s.end));
    }

    // Sort labels by total speech duration (most talkative first → better matching)
    let mut labels_sorted: Vec<(String, f64)> = label_first.into_iter().collect();
    labels_sorted.sort_by(|a, b| {
        let dur_b = label_duration.get(&b.0).unwrap_or(&0.0);
        let dur_a = label_duration.get(&a.0).unwrap_or(&0.0);
        dur_b.partial_cmp(dur_a).unwrap_or(std::cmp::Ordering::Equal)
    });

    // Try overlap-based matching against existing speakerTimeline (HLS ID3 ground truth)
    let id3_timeline = metadata.get("speakerTimeline").and_then(|v| v.as_array());
    if let Some(tl) = id3_timeline {
        let mut pid_spans: HashMap<String, Vec<(f64, f64)>> = HashMap::new();
        for seg in tl {
            let sid = seg.get("speakerId").and_then(|x| x.as_str()).unwrap_or("");
            let st = seg.get("start").and_then(|x| x.as_f64()).unwrap_or(0.0);
            let en = seg.get("end").and_then(|x| x.as_f64()).unwrap_or(0.0);
            if !sid.is_empty() && en > st {
                pid_spans.entry(sid.to_string()).or_default().push((st, en));
            }
        }

        if !pid_spans.is_empty() {
            let map = overlap_match(&labels_sorted, &label_spans, &pid_spans, segments, metadata);
            if !map.is_empty() {
                println!("[diarize] overlap-matched {} labels to participants", map.len());
                return map;
            }
        }
    }

    // Fallback: stageJoinHints or participant-list proximity
    let participants_with_t = build_participant_timing(metadata);
    let mut map = HashMap::new();
    let mut used: HashSet<String> = HashSet::new();

    for (lab, t_lab) in &labels_sorted {
        let best = participants_with_t
            .iter()
            .filter(|(id, _)| !used.contains(id))
            .min_by(|(_, t1), (_, t2)| {
                let d1 = (*t1 - t_lab).abs();
                let d2 = (*t2 - t_lab).abs();
                d1.partial_cmp(&d2).unwrap_or(std::cmp::Ordering::Equal)
            })
            .map(|(id, _)| id.clone());

        if let Some(id) = best {
            used.insert(id.clone());
            map.insert(lab.clone(), id);
        }
    }

    apply_fallback(&mut map, segments, metadata);
    map
}

/// Compute temporal overlap between diarization label spans and ID3 participant spans.
/// Returns a mapping assigning each label to the participant with the highest overlap.
fn overlap_match(
    labels_sorted: &[(String, f64)],
    label_spans: &HashMap<String, Vec<(f64, f64)>>,
    pid_spans: &HashMap<String, Vec<(f64, f64)>>,
    segments: &[RawSegment],
    metadata: &Value,
) -> HashMap<String, String> {
    let pids: Vec<String> = pid_spans.keys().cloned().collect();
    let mut scores: Vec<(String, String, f64)> = Vec::new();

    for (lab, _) in labels_sorted {
        let lab_s = match label_spans.get(lab) {
            Some(s) => s,
            None => continue,
        };
        for pid in &pids {
            let pid_s = match pid_spans.get(pid) {
                Some(s) => s,
                None => continue,
            };
            let mut overlap = 0.0_f64;
            for &(ls, le) in lab_s {
                for &(ps, pe) in pid_s {
                    let o = (le.min(pe) - ls.max(ps)).max(0.0);
                    overlap += o;
                }
            }
            if overlap > 0.0 {
                scores.push((lab.clone(), pid.clone(), overlap));
            }
        }
    }

    scores.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));

    let mut map = HashMap::new();
    let mut used_labels: HashSet<String> = HashSet::new();
    let mut used_pids: HashSet<String> = HashSet::new();

    for (lab, pid, _score) in &scores {
        if used_labels.contains(lab) || used_pids.contains(pid) {
            continue;
        }
        map.insert(lab.clone(), pid.clone());
        used_labels.insert(lab.clone());
        used_pids.insert(pid.clone());
    }

    apply_fallback(&mut map, segments, metadata);
    map
}

/// Gather participant timing from stageJoinHints, speakerTimeline, or participant order.
fn build_participant_timing(metadata: &Value) -> Vec<(String, f64)> {
    let from_hints: Vec<(String, f64)> = metadata
        .get("stageJoinHints")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|h| {
                    let id = h.get("speakerId")?.as_str()?.to_string();
                    let t = h.get("approxJoinSec")?.as_f64()?;
                    Some((id, t))
                })
                .collect()
        })
        .unwrap_or_default();

    if !from_hints.is_empty() {
        return from_hints;
    }

    let from_tl: Vec<(String, f64)> = metadata
        .get("speakerTimeline")
        .and_then(|v| v.as_array())
        .map(|segs| {
            let mut m: HashMap<String, f64> = HashMap::new();
            for seg in segs {
                let sid = seg.get("speakerId").and_then(|x| x.as_str()).unwrap_or("");
                let st = seg.get("start").and_then(|x| x.as_f64()).unwrap_or(0.0);
                if !sid.is_empty() {
                    m.entry(sid.to_string()).and_modify(|t| *t = (*t).min(st)).or_insert(st);
                }
            }
            let mut v: Vec<_> = m.into_iter().collect();
            v.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
            v
        })
        .unwrap_or_default();

    if !from_tl.is_empty() {
        return from_tl;
    }

    metadata
        .get("participants")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .enumerate()
                .filter_map(|(i, p)| {
                    let role = p.get("role").and_then(|r| r.as_str()).unwrap_or("");
                    if role == "listener" { return None; }
                    let id = p.get("id")?.as_str()?.to_string();
                    Some((id, i as f64 * 30.0))
                })
                .collect()
        })
        .unwrap_or_default()
}

fn apply_fallback(map: &mut HashMap<String, String>, segments: &[RawSegment], metadata: &Value) {
    let fallback = metadata
        .get("participants")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .and_then(|p| p.get("id").and_then(|x| x.as_str()))
        .unwrap_or("unknown")
        .to_string();

    let mut seen_labels: HashSet<String> = HashSet::new();
    for s in segments {
        seen_labels.insert(s.speaker.clone());
    }
    for lab in seen_labels {
        if !map.contains_key(&lab) {
            map.insert(lab, fallback.clone());
        }
    }
}

/// Manual re-run: fetch Space metadata, run diarization on disk, return updated metadata JSON.
#[tauri::command]
pub async fn diarize_space_audio(
    app: tauri::AppHandle,
    download_id: String,
    audio_path: String,
    space_url: String,
) -> Result<String, String> {
    let meta_str = crate::twitter::get_twitter_broadcast_info(space_url).await?;
    let mut meta_val: Value =
        serde_json::from_str(&meta_str).map_err(|e| format!("parse metadata: {}", e))?;
    let n_speakers = meta_val
        .get("participants")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter(|p| {
                    let role = p.get("role").and_then(|r| r.as_str()).unwrap_or("");
                    role != "listener"
                })
                .count()
        })
        .filter(|&c| c > 0);
    let ran = run_twitter_space_diarization(
        &app,
        &download_id,
        &audio_path,
        &mut meta_val,
        n_speakers,
    )
    .await?;
    if !ran {
        return Err("diarize sidecar not available (build placeholder)".into());
    }
    serde_json::to_string(&meta_val).map_err(|e| e.to_string())
}
