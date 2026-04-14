//! Extract time-coded speaker hints from X (Twitter) Space replay HLS.
//!
//! X serves replays as HLS `.ts` segments with ID3 timed metadata (same Periscope stack
//! the web player uses). `yt-dlp`/ffmpeg remux drops those tags, so we scan segment
//! prefixes over the manifest after download.

use std::sync::Arc;

use futures::{stream, StreamExt};
use reqwest::Url;
use serde::Serialize;
use serde_json::Value;

const SEGMENT_HEAD_BYTES: u64 = 262_144;
const HTTP_PARALLEL: usize = 10;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpaceSpeakerTimelineSegment {
    pub id: String,
    pub speaker_id: String,
    pub start: f64,
    pub end: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpaceStageSnapshot {
    pub id: String,
    /// Playlist time (seconds) when this on-stage roster applies.
    pub t: f64,
    pub on_stage_user_ids: Vec<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpaceHlsMetadataResult {
    pub speaker_segments: Vec<SpaceSpeakerTimelineSegment>,
    pub stage_snapshots: Vec<SpaceStageSnapshot>,
}

struct SegmentScan {
    seg_start: f64,
    active_speaker: Option<String>,
    /// Best-effort roster from ID3 (X/Twitter user ids when present).
    stage_user_ids: Option<Vec<String>>,
}

#[derive(Clone, Default)]
struct KeyState {
    key: Option<Vec<u8>>,
    iv: Option<Vec<u8>>,
}

fn synchsafe_u32(b0: u8, b1: u8, b2: u8, b3: u8) -> u32 {
    ((b0 as u32 & 0x7f) << 21)
        | ((b1 as u32 & 0x7f) << 14)
        | ((b2 as u32 & 0x7f) << 7)
        | (b3 as u32 & 0x7f)
}

/// Parse ID3v2 tag at `data[offset..]`; returns (payloads as strings/utf8, bytes consumed).
fn parse_id3_at(data: &[u8], offset: usize) -> Option<(Vec<String>, usize)> {
    if data.len().saturating_sub(offset) < 10 {
        return None;
    }
    let o = offset;
    if data[o..o + 3] != *b"ID3" {
        return None;
    }
    let ver_maj = data[o + 3];
    let _ver_min = data[o + 4];
    let flags = data[o + 5];
    let tag_size = synchsafe_u32(data[o + 6], data[o + 7], data[o + 8], data[o + 9]) as usize;
    let mut pos = o + 10;
    let end = pos.saturating_add(tag_size).min(data.len());
    let mut out = Vec::new();

    if (flags & 0x40) != 0 && ver_maj == 4 {
        // Extended header — skip minimally (not expected in Space segments)
        if pos + 4 > end {
            return Some((out, 10 + tag_size));
        }
        let ext = synchsafe_u32(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]) as usize;
        pos = pos.saturating_add(4 + ext);
    }

    while pos + (if ver_maj == 4 { 10 } else { 10 }) <= end {
        if data[pos] == 0 {
            break;
        }
        let frame_id = std::str::from_utf8(&data[pos..pos + 4]).unwrap_or("");
        let (frame_len, header_len) = if ver_maj == 4 {
            let fl = synchsafe_u32(data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]) as usize;
            (fl, 10)
        } else {
            let fl = u32::from_be_bytes([data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]])
                as usize;
            (fl, 10)
        };
        pos += header_len;
        if pos + frame_len > end {
            break;
        }
        let body = &data[pos..pos + frame_len];
        pos += frame_len;

        match frame_id {
            "TXXX" | "TXX" => {
                if let Some(s) = parse_txxx_body(body) {
                    out.push(s);
                }
            }
            "PRIV" => {
                if let Some(s) = parse_priv_body(body) {
                    out.push(s);
            }
            }
            _ => {
                if let Ok(s) = std::str::from_utf8(body) {
                    let t = s.trim();
                    if t.starts_with('{') && t.len() > 2 {
                        out.push(t.to_string());
                    }
                }
            }
        }
    }

    Some((out, 10 + tag_size))
}

fn parse_txxx_body(body: &[u8]) -> Option<String> {
    if body.is_empty() {
        return None;
    }
    let enc = body[0];
    let rest = &body[1..];
    // description\0 value
    let sep = rest.iter().position(|&b| b == 0)?;
    let value_start = sep + 1;
    if value_start >= rest.len() {
        return None;
    }
    let value_bytes = &rest[value_start..];
    decode_id3_text(enc, value_bytes)
}

fn parse_priv_body(body: &[u8]) -> Option<String> {
    let sep = body.iter().position(|&b| b == 0)?;
    let data = &body[sep + 1..];
    if data.starts_with(b"{") {
        return String::from_utf8(data.to_vec()).ok();
    }
    None
}

fn decode_id3_text(encoding: u8, bytes: &[u8]) -> Option<String> {
    match encoding {
        0 => String::from_utf8(bytes.to_vec()).ok(),
        1 | 2 => {
            if bytes.len() < 2 {
                return None;
            }
            // UTF-16 with BOM
            let (bom, rest) = bytes.split_at(2);
            let be = bom == [0xfe, 0xff];
            let u16s: Vec<u16> = rest
                .chunks_exact(2)
                .map(|c| {
                    if be {
                        u16::from_be_bytes([c[0], c[1]])
                    } else {
                        u16::from_le_bytes([c[0], c[1]])
                    }
                })
                .collect();
            String::from_utf16(&u16s).ok()
        }
        3 => String::from_utf8(bytes.to_vec()).ok(),
        _ => String::from_utf8(bytes.to_vec()).ok(),
    }
}

fn collect_id3_strings(buffer: &[u8]) -> Vec<String> {
    let mut results = Vec::new();
    let mut i = 0usize;
    while i + 10 < buffer.len() {
        if buffer[i..i + 3] == *b"ID3" {
            if let Some((payloads, consumed)) = parse_id3_at(buffer, i) {
                results.extend(payloads);
                i += consumed.max(1);
                continue;
            }
        }
        i += 1;
    }
    results
}

fn first_user_id_in_json(v: &Value, depth: u8) -> Option<String> {
    if depth == 0 {
        return None;
    }
    const KEYS: &[&str] = &[
        "user_id",
        "userId",
        "twitter_user_id",
        "periscope_user_id",
        "user_numeric_id",
        "speaker_user_id",
        "speaking_user_id",
        "broadcast_user_id",
    ];
    for k in KEYS {
        if let Some(x) = v.get(*k) {
            if let Some(s) = x.as_str() {
                let t = s.trim();
                if !t.is_empty() {
                    return Some(t.to_string());
                }
            }
            if let Some(n) = x.as_i64() {
                return Some(n.to_string());
            }
            if let Some(n) = x.as_u64() {
                return Some(n.to_string());
            }
            if let Some(n) = x.as_f64() {
                if n.is_finite() && n >= 0.0 {
                    return Some((n as u64).to_string());
                }
            }
        }
    }
    if let Some(s) = v.pointer("/user_results/result/rest_id").and_then(|x| x.as_str()) {
        return Some(s.to_string());
    }
    if let Some(n) = v.pointer("/user_results/result/rest_id").and_then(|x| x.as_i64()) {
        return Some(n.to_string());
    }
    if let Some(s) = v
        .pointer("/participant/user_results/result/rest_id")
        .and_then(|x| x.as_str())
    {
        return Some(s.to_string());
    }

    match v {
        Value::Object(map) => {
            for child in map.values() {
                if let Some(s) = first_user_id_in_json(child, depth - 1) {
                    return Some(s);
                }
            }
        }
        Value::Array(arr) => {
            for child in arr {
                if let Some(s) = first_user_id_in_json(child, depth - 1) {
                    return Some(s);
                }
            }
        }
        _ => {}
    }
    None
}

/// Prefer the last JSON blob in the segment (final ID3 state in the chunk).
fn last_speaker_from_json_strings(strings: &[String]) -> Option<String> {
    strings.iter().rev().find_map(|s| {
        let t = s.trim();
        if !t.starts_with('{') {
            return None;
        }
        serde_json::from_str::<Value>(t)
            .ok()
            .and_then(|v| first_user_id_in_json(&v, 8))
    })
}

fn participant_rest_id_value(v: &Value) -> Option<String> {
    if let Some(s) = v.as_str() {
        let t = s.trim();
        return (!t.is_empty()).then(|| t.to_string());
    }
    let obj = v.as_object()?;
    if let Some(s) = obj.get("rest_id").and_then(|x| x.as_str()) {
        return Some(s.to_string());
    }
    if let Some(n) = obj.get("rest_id").and_then(|x| x.as_i64()) {
        return Some(n.to_string());
    }
    if let Some(s) = obj.get("user_id").and_then(|x| x.as_str()) {
        return Some(s.to_string());
    }
    if let Some(n) = obj.get("user_id").and_then(|x| x.as_i64()) {
        return Some(n.to_string());
    }
    if let Some(s) = obj.get("periscope_user_id").and_then(|x| x.as_str()) {
        return Some(s.to_string());
    }
    if let Some(s) = obj.get("twitter_user_id").and_then(|x| x.as_str()) {
        return Some(s.to_string());
    }
    obj.get("user_results")?
        .get("result")?
        .get("rest_id")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            obj.get("user_results")?
                .get("result")?
                .get("rest_id")?
                .as_i64()
                .map(|n| n.to_string())
        })
}

fn collect_stage_ids_from_array(arr: &[Value]) -> Vec<String> {
    let mut out = Vec::new();
    for item in arr {
        if let Some(id) = participant_rest_id_value(item) {
            let t = id.trim();
            if !t.is_empty() && !out.iter().any(|x| x == t) {
                out.push(t.to_string());
            }
        }
    }
    out
}

/// Pull `speakers`/`admins`-style arrays from common X / Periscope ID3 JSON shapes.
fn stage_user_ids_from_payload(v: &Value) -> Option<Vec<String>> {
    let mut out: Vec<String> = Vec::new();
    let merge = |out: &mut Vec<String>, arr: &[Value]| {
        for id in collect_stage_ids_from_array(arr) {
            if !out.iter().any(|x| x == &id) {
                out.push(id);
            }
        }
    };

    if let Some(obj) = v.as_object() {
        for key in [
            "speakers",
            "admins",
            "on_stage_speakers",
            "broadcast_speakers",
            "cohosts",
            "moderators",
        ] {
            if let Some(arr) = obj.get(key).and_then(|x| x.as_array()) {
                merge(&mut out, arr);
            }
        }
    }

    for ptr in [
        "/participants/speakers",
        "/participants/admins",
        "/audioSpace/participants/speakers",
        "/audioSpace/participants/admins",
        "/data/audioSpace/participants/speakers",
        "/data/audioSpace/participants/admins",
    ] {
        if let Some(arr) = v.pointer(ptr).and_then(|x| x.as_array()) {
            merge(&mut out, arr);
        }
    }

    if out.is_empty() {
        None
    } else {
        Some(out)
    }
}

fn best_stage_from_json_strings(strings: &[String]) -> Option<Vec<String>> {
    let mut best: Option<Vec<String>> = None;
    let mut best_len = 0usize;
    for s in strings {
        let t = s.trim();
        if !t.starts_with('{') {
            continue;
        }
        let Ok(v) = serde_json::from_str::<Value>(t) else {
            continue;
        };
        if let Some(ids) = stage_user_ids_from_payload(&v) {
            if ids.len() > best_len {
                best_len = ids.len();
                best = Some(ids);
            }
        }
    }
    best
}

fn merge_stage_snapshots(mut rows: Vec<(f64, Vec<String>)>, total_duration: f64) -> Vec<SpaceStageSnapshot> {
    if rows.is_empty() {
        return Vec::new();
    }
    rows.sort_by(|a, b| {
        a.0.partial_cmp(&b.0)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    fn same_roster(a: &[String], b: &[String]) -> bool {
        if a.len() != b.len() {
            return false;
        }
        let mut x: Vec<&String> = a.iter().collect();
        let mut y: Vec<&String> = b.iter().collect();
        x.sort();
        y.sort();
        x == y
    }
    let mut deduped: Vec<(f64, Vec<String>)> = Vec::new();
    for (t, ids) in rows {
        let t = t.clamp(0.0, total_duration);
        if let Some((_, last)) = deduped.last() {
            if same_roster(&ids, last) {
                continue;
            }
        }
        deduped.push((t, ids));
    }
    deduped
        .into_iter()
        .enumerate()
        .map(|(i, (t, on_stage_user_ids))| SpaceStageSnapshot {
            id: format!("stage-{i}"),
            t,
            on_stage_user_ids,
        })
        .collect()
}

fn resolve_uri(base: &Url, line: &str) -> Result<Url, String> {
    let line = line.trim();
    base.join(line).map_err(|e| format!("Bad URI join: {}", e))
}

async fn fetch_text(client: &reqwest::Client, url: &Url) -> Result<String, String> {
    let resp = client
        .get(url.clone())
        .send()
        .await
        .map_err(|e| format!("GET {}: {}", url, e))?;
    if !resp.status().is_success() {
        return Err(format!("GET {} -> {}", url, resp.status()));
    }
    resp.text()
        .await
        .map_err(|e| format!("read body: {}", e))
}

async fn fetch_bytes_range(
    client: &reqwest::Client,
    url: &Url,
    max: u64,
) -> Result<Vec<u8>, String> {
    let resp = client
        .get(url.clone())
        .header(
            reqwest::header::RANGE,
            format!("bytes=0-{}", max.saturating_sub(1)),
        )
        .send()
        .await
        .map_err(|e| format!("GET {}: {}", url, e))?;
    if !(resp.status().is_success() || resp.status() == reqwest::StatusCode::PARTIAL_CONTENT) {
        return Err(format!("GET {} -> {}", url, resp.status()));
    }
    resp.bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| format!("read bytes: {}", e))
}

fn parse_hls_key_line(line: &str, base: &Url) -> Option<(Url, Option<Vec<u8>>)> {
    // EXT-X-KEY:METHOD=AES-128,URI="...",IV=0x...
    if !line.contains("METHOD=AES-128") {
        return None;
    }
    let uri_part = line.split("URI=\"").nth(1)?.split('"').next()?;
    let key_url = resolve_uri(base, uri_part).ok()?;
    let iv = if let Some(hex_start) = line.find("IV=0x") {
        let hex = &line[hex_start + 5..];
        let hex = hex.split(|c: char| !c.is_ascii_hexdigit()).next()?;
        (hex.len() == 32)
            .then(|| hex::decode(hex).ok())
            .flatten()
    } else {
        None
    };
    Some((key_url, iv))
}

async fn fetch_aes_key(client: &reqwest::Client, url: &Url) -> Result<Vec<u8>, String> {
    let bytes = fetch_bytes_range(client, url, 4096).await?;
    if bytes.len() != 16 {
        return Err(format!("AES key length {}, expected 16", bytes.len()));
    }
    Ok(bytes)
}

fn aes128_cbc_decrypt_segment(ciphertext: &[u8], key: &[u8], iv: &[u8; 16]) -> Option<Vec<u8>> {
    use aes::cipher::block_padding::Pkcs7;
    use aes::cipher::{BlockDecryptMut, KeyIvInit};
    type Dec = cbc::Decryptor<aes::Aes128>;
    let mut buf = ciphertext.to_vec();
    if buf.len() < 16 || buf.len() % 16 != 0 {
        return None;
    }
    let dec = Dec::new_from_slices(key, iv.as_slice()).ok()?;
    let pt = dec.decrypt_padded_mut::<Pkcs7>(&mut buf).ok()?;
    Some(pt.to_vec())
}

/// HLS AES-128 IV: explicit attribute, else 128-bit big-endian media sequence (RFC 8216).
fn iv_for_segment(media_sequence: u64, explicit_iv: &Option<Vec<u8>>) -> [u8; 16] {
    if let Some(iv) = explicit_iv {
        if iv.len() == 16 {
            let mut out = [0u8; 16];
            out.copy_from_slice(iv);
            return out;
        }
    }
    let mut iv = [0u8; 16];
    iv[8..].copy_from_slice(&media_sequence.to_be_bytes());
    iv
}

struct ParsedPlaylist {
    segments: Vec<(Url, f64)>,
    /// (key_url, optional_iv) when encrypted
    key_template: Option<(Url, Option<Vec<u8>>)>,
}

fn parse_media_playlist(body: &str, base: &Url) -> Result<(ParsedPlaylist, u64), String> {
    let mut segments: Vec<(Url, f64)> = Vec::new();
    let mut key_template: Option<(Url, Option<Vec<u8>>)> = None;
    let mut expect_uri = false;
    let mut last_duration = 2.0_f64;
    let mut media_sequence_start: u64 = 0;

    for raw_line in body.lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(rest) = line.strip_prefix("#EXT-X-MEDIA-SEQUENCE:") {
            media_sequence_start = rest.trim().parse::<u64>().unwrap_or(0);
        }
        if line.starts_with("#EXT-X-KEY:") {
            key_template = parse_hls_key_line(line, base);
        }
        if line.starts_with("#EXTINF:") {
            let part = line.trim_start_matches("#EXTINF:").split(',').next().unwrap_or("");
            last_duration = part.parse::<f64>().unwrap_or(2.0);
            expect_uri = true;
            continue;
        }
        if line.starts_with('#') {
            continue;
        }
        if expect_uri {
            let u = resolve_uri(base, line)?;
            segments.push((u, last_duration));
            expect_uri = false;
        }
    }

    Ok((
        ParsedPlaylist {
            segments,
            key_template,
        },
        media_sequence_start,
    ))
}

async fn resolve_to_media_playlist(
    client: &reqwest::Client,
    start: &Url,
) -> Result<(ParsedPlaylist, u64), String> {
    let text = fetch_text(client, start).await?;
    if text.contains("#EXT-X-STREAM-INF") {
        let base = start
            .join("./")
            .map_err(|e| format!("base: {}", e))?;
        let mut best: Option<(u64, Url)> = None;
        let mut next_line_is_uri = false;
        let mut pending_bw: Option<u64> = None;
        for line in text.lines() {
            let line = line.trim();
            if line.starts_with("#EXT-X-STREAM-INF:") {
                next_line_is_uri = true;
                pending_bw = line
                    .split(',')
                    .find_map(|p| p.strip_prefix("BANDWIDTH="))
                    .and_then(|v| v.parse::<u64>().ok());
                continue;
            }
            if next_line_is_uri && !line.starts_with('#') && !line.is_empty() {
                if let Ok(u) = resolve_uri(&base, line) {
                    let bw = pending_bw.unwrap_or(u64::MAX);
                    best = Some(match best {
                        None => (bw, u),
                        Some((obw, _ou)) if bw < obw => (bw, u),
                        Some(other) => other,
                    });
                }
                next_line_is_uri = false;
                pending_bw = None;
            }
        }
        let variant = best
            .map(|(_, u)| u)
            .ok_or("Master playlist: no variant URI")?;
        let vtext = fetch_text(client, &variant).await?;
        let vbase = variant
            .join("./")
            .map_err(|e| format!("{}", e))?;
        parse_media_playlist(&vtext, &vbase)
    } else {
        let base = start
            .join("./")
            .map_err(|e| format!("base: {}", e))?;
        parse_media_playlist(&text, &base)
    }
}

async fn scan_one_segment(
    client: &reqwest::Client,
    uri: &Url,
    seg_start: f64,
    media_sequence: u64,
    key_state: &Arc<KeyState>,
) -> SegmentScan {
    let mut raw = match fetch_bytes_range(client, uri, SEGMENT_HEAD_BYTES).await {
        Ok(b) => b,
        Err(e) => {
            eprintln!("[SpaceHls] segment fetch failed {}: {}", uri, e);
            return SegmentScan {
                seg_start,
                active_speaker: None,
                stage_user_ids: None,
            };
        }
    };

    if let Some(ref key) = key_state.key {
        let iv = iv_for_segment(media_sequence, &key_state.iv);
        if let Some(pt) = aes128_cbc_decrypt_segment(&raw, key, &iv) {
            raw = pt;
        }
    }

    let strings = collect_id3_strings(&raw);
    SegmentScan {
        seg_start,
        active_speaker: last_speaker_from_json_strings(&strings),
        stage_user_ids: best_stage_from_json_strings(&strings),
    }
}

fn merge_events(mut events: Vec<(f64, String)>, total_duration: f64) -> Vec<SpaceSpeakerTimelineSegment> {
    if events.is_empty() {
        return Vec::new();
    }
    events.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    // Drop consecutive duplicates at ~same time
    let mut deduped: Vec<(f64, String)> = Vec::new();
    for (t, id) in events {
        if let Some((lt, lid)) = deduped.last_mut() {
            if *lid == id && (t - *lt).abs() < 0.25 {
                continue;
            }
        }
        deduped.push((t, id));
    }
    // Collapse consecutive identical speakers (multiple HLS chunks may repeat the same ID3).
    let mut collapsed: Vec<(f64, String)> = Vec::new();
    for (t, id) in deduped {
        match collapsed.last() {
            Some((_, lid)) if lid == &id => continue,
            _ => collapsed.push((t, id)),
        }
    }
    let mut out = Vec::new();
    for i in 0..collapsed.len() {
        let start = collapsed[i].0.clamp(0.0, total_duration);
        let end = if i + 1 < collapsed.len() {
            collapsed[i + 1].0
        } else {
            total_duration
        }
        .clamp(0.0, total_duration);
        if end <= start {
            continue;
        }
        let speaker_id = collapsed[i].1.clone();
        out.push(SpaceSpeakerTimelineSegment {
            id: format!("tl-{}-{}", speaker_id, start.floor() as i64),
            speaker_id,
            start,
            end,
        });
    }
    out
}

/// Walks the Space replay HLS manifest and collects ID3 hints: talking timeline + on-stage roster cues.
#[tauri::command]
pub async fn extract_space_speaker_timeline_from_hls_manifest(
    manifest_url: String,
    duration_secs: Option<f64>,
) -> Result<SpaceHlsMetadataResult, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;

    let start_url = Url::parse(&manifest_url).map_err(|e| format!("Bad manifest URL: {}", e))?;
    let (parsed, media_sequence_start) = resolve_to_media_playlist(&client, &start_url).await?;

    if parsed.segments.is_empty() {
        return Ok(SpaceHlsMetadataResult {
            speaker_segments: Vec::new(),
            stage_snapshots: Vec::new(),
        });
    }

    let key_for_segments: Arc<KeyState> = if let Some((ref key_url, ref iv)) = parsed.key_template {
        match fetch_aes_key(&client, key_url).await {
            Ok(k) => Arc::new(KeyState {
                key: Some(k),
                iv: iv.clone(),
            }),
            Err(_) => Arc::new(KeyState::default()),
        }
    } else {
        Arc::new(KeyState::default())
    };

    let mut cumulative = 0.0_f64;
    let mut work: Vec<(Url, f64, f64, u64)> = Vec::new();
    let mut seq: u64 = 0;
    for (uri, dur) in &parsed.segments {
        work.push((
            uri.clone(),
            cumulative,
            *dur,
            media_sequence_start.saturating_add(seq),
        ));
        cumulative += dur;
        seq += 1;
    }

    let total = duration_secs
        .filter(|d| *d > 1.0)
        .unwrap_or(cumulative)
        .max(1.0);

    let key_clone = key_for_segments.clone();
    let scans: Vec<SegmentScan> = stream::iter(work)
        .map(|(uri, start, _dur, media_seq)| {
            let c = client.clone();
            let ks = key_clone.clone();
            async move { scan_one_segment(&c, &uri, start, media_seq, &ks).await }
        })
        .buffer_unordered(HTTP_PARALLEL)
        .collect()
        .await;

    let mut speaker_rows: Vec<(f64, String)> = Vec::new();
    let mut stage_rows: Vec<(f64, Vec<String>)> = Vec::new();
    for scan in scans {
        if let Some(sp) = scan.active_speaker {
            speaker_rows.push((scan.seg_start, sp));
        }
        if let Some(ids) = scan.stage_user_ids {
            stage_rows.push((scan.seg_start, ids));
        }
    }
    speaker_rows.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    let speaker_segments = merge_events(speaker_rows, total);
    let stage_snapshots = merge_stage_snapshots(stage_rows, total);
    println!(
        "[SpaceHls] talking_segments={} stage_cues={} from {} HLS parts",
        speaker_segments.len(),
        stage_snapshots.len(),
        parsed.segments.len()
    );
    Ok(SpaceHlsMetadataResult {
        speaker_segments,
        stage_snapshots,
    })
}
