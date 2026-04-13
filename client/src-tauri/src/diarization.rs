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

/// Run pyannote sidecar and replace `metadata["speakerTimeline"]` when successful.
/// Returns `Ok(true)` when diarization ran and modified the metadata,
/// `Ok(false)` when it was skipped (binary missing/placeholder),
/// `Err(...)` when it failed.
pub async fn run_twitter_space_diarization(
    app: &tauri::AppHandle,
    download_id: &str,
    audio_path: &str,
    metadata: &mut Value,
    preferred_num_speakers: Option<usize>,
) -> Result<bool, String> {
    let bin = crate::youtube::resolve_sidecar_binary("diarize")
        .map_err(|e| format!("resolve diarize: {}", e))?;
    if !Path::new(&bin).is_file() {
        return Err(format!(
            "diarize sidecar not found (expected bundled binary): {}",
            bin
        ));
    }
    if !diarize_binary_is_real_bundle(&bin) {
        println!(
            "[diarize] skipping speaker analysis — binary missing or build placeholder at {}",
            bin
        );
        return Ok(false);
    }

    let audio = PathBuf::from(audio_path);
    let out_json = audio.with_extension("diarize_raw.json");

    let mut cmd = tokio::process::Command::new(&bin);
    no_window(&mut cmd);
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

fn build_label_to_participant_map(segments: &[RawSegment], metadata: &Value) -> HashMap<String, String> {
    let mut first: HashMap<String, f64> = HashMap::new();
    for s in segments {
        first
            .entry(s.speaker.clone())
            .and_modify(|t| *t = (*t).min(s.start))
            .or_insert(s.start);
    }
    let mut labels_sorted: Vec<(String, f64)> = first.into_iter().collect();
    labels_sorted.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

    let mut participants_with_t: Vec<(String, f64)> = metadata
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

    if participants_with_t.is_empty() {
        participants_with_t = metadata
            .get("speakerTimeline")
            .and_then(|v| v.as_array())
            .map(|segs| {
                let mut m: HashMap<String, f64> = HashMap::new();
                for seg in segs {
                    let sid = seg.get("speakerId").and_then(|x| x.as_str()).unwrap_or("");
                    let st = seg.get("start").and_then(|x| x.as_f64()).unwrap_or(0.0);
                    if sid.is_empty() {
                        continue;
                    }
                    m.entry(sid.to_string())
                        .and_modify(|t| *t = (*t).min(st))
                        .or_insert(st);
                }
                let mut v: Vec<_> = m.into_iter().collect();
                v.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
                v
            })
            .unwrap_or_default();
    }

    if participants_with_t.is_empty() {
        participants_with_t = metadata
            .get("participants")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .enumerate()
                    .filter_map(|(i, p)| {
                        let role = p.get("role").and_then(|r| r.as_str()).unwrap_or("");
                        if role == "listener" {
                            return None;
                        }
                        let id = p.get("id")?.as_str()?.to_string();
                        Some((id, i as f64 * 30.0))
                    })
                    .collect()
            })
            .unwrap_or_default();
    }

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

    map
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
