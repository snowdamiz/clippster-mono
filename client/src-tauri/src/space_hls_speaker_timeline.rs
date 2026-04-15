//! Extract time-coded speaker hints from X (Twitter) Space replay HLS.
//!
//! X serves replays as HLS `.ts` segments with ID3 timed metadata (same Periscope stack
//! the web player uses). `yt-dlp`/ffmpeg remux drops those tags, so we scan segment
//! prefixes over the manifest after download.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::SystemTime;

use futures::{stream, StreamExt};
use reqwest::header::{HeaderMap, HeaderValue};
use reqwest::Url;
use serde::Serialize;
use serde_json::Value;

/// Per-segment prefix to scan for ID3 (metadata may sit after a large PAT/PMT run).
const SEGMENT_HEAD_BYTES: u64 = 1_048_576;
const HTTP_PARALLEL: usize = 10;

fn build_space_hls_http_client() -> Result<reqwest::Client, String> {
    let mut headers = HeaderMap::new();
    headers.insert(
        reqwest::header::REFERER,
        HeaderValue::from_static("https://x.com/"),
    );
    headers.insert(
        reqwest::header::ORIGIN,
        HeaderValue::from_static("https://x.com"),
    );
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())
}

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

/// ID3v2.2: 3-byte frame id + 3-byte big-endian size (Periscope often emits v2.2 in TS).
fn parse_id3_v22_frames(data: &[u8], mut pos: usize, end: usize) -> Vec<String> {
    let mut out = Vec::new();
    while pos + 6 <= end {
        if data[pos] == 0 {
            break;
        }
        let fl = u32::from_be_bytes([0u8, data[pos + 3], data[pos + 4], data[pos + 5]]) as usize;
        pos += 6;
        if pos + fl > end {
            break;
        }
        let body = &data[pos..pos + fl];
        pos += fl;

        if let Some(s) = parse_txxx_body(body) {
            out.push(s);
            continue;
        }
        if let Ok(s) = std::str::from_utf8(body) {
            let t = s.trim();
            if t.starts_with('{') {
                out.push(t.to_string());
            }
        }
    }
    out
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

    // ID3v2.2 uses 3-byte frame IDs + 3-byte sizes (not 4-byte IDs like v2.3/v2.4).
    if ver_maj == 2 {
        let frames = parse_id3_v22_frames(data, pos, end);
        return Some((frames, 10 + tag_size));
    }

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

/// Periscope ID3 JSON often carries `screen_name` / `username` but not numeric `user_id`.
fn speaker_screen_name_hint(v: &Value, depth: u8) -> Option<String> {
    if depth == 0 {
        return None;
    }
    const KEYS: &[&str] = &[
        "screen_name",
        "screenName",
        "username",
        "twitter_screen_name",
        "handle",
        "twitter_handle",
        "user_name",
    ];
    for k in KEYS {
        if let Some(x) = v.get(*k) {
            if let Some(s) = x.as_str() {
                let t = s.trim().trim_start_matches('@');
                if (2..=32).contains(&t.len())
                    && t.chars()
                        .all(|c| c.is_ascii_alphanumeric() || c == '_')
                {
                    return Some(t.to_lowercase());
                }
            }
        }
    }
    match v {
        Value::Object(map) => {
            for child in map.values() {
                if let Some(s) = speaker_screen_name_hint(child, depth - 1) {
                    return Some(s);
                }
            }
        }
        Value::Array(arr) => {
            for child in arr {
                if let Some(s) = speaker_screen_name_hint(child, depth - 1) {
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
        let v = serde_json::from_str::<Value>(t).ok()?;
        first_user_id_in_json(&v, 8).or_else(|| speaker_screen_name_hint(&v, 8))
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

/// Decrypt the first `take` ciphertext bytes under AES-128-CBC **without** PKCS7 unpadding.
///
/// We only fetch a prefix of each `.ts` segment; PKCS7 validation on that truncated
/// ciphertext almost always fails (padding bytes belong to the tail of the full segment),
/// which previously left the buffer encrypted so ID3 scans saw nothing — hence
/// `talking_segments=0 stage_cues=0` despite thousands of HLS parts.
fn aes128_cbc_decrypt_prefix(ciphertext: &[u8], key: &[u8], iv: &[u8; 16], take: usize) -> Option<Vec<u8>> {
    use aes::cipher::generic_array::GenericArray;
    use aes::cipher::{BlockDecryptMut, KeyInit};
    if key.len() != 16 {
        return None;
    }
    let want = take.min(ciphertext.len());
    let n_blocks = want / 16;
    if n_blocks == 0 {
        return None;
    }
    let len = n_blocks * 16;
    let mut buf = ciphertext[..len].to_vec();
    let mut cipher = aes::Aes128::new_from_slice(key).ok()?;
    let mut prev = GenericArray::from(*iv);
    for i in 0..n_blocks {
        let o = i * 16;
        let mut block = GenericArray::clone_from_slice(&buf[o..o + 16]);
        let ct_block = block;
        cipher.decrypt_block_mut(&mut block);
        for j in 0..16 {
            buf[o + j] = block[j] ^ prev[j];
        }
        prev = ct_block;
    }
    Some(buf)
}

const TS_PACKET: usize = 188;

fn ts_sync_likely(buf: &[u8]) -> bool {
    if buf.len() < TS_PACKET {
        return false;
    }
    if buf[0] == 0x47 {
        return true;
    }
    for start in 1..TS_PACKET.min(buf.len()) {
        if buf[start] != 0x47 {
            continue;
        }
        let mut ok = true;
        for k in 1..5 {
            let p = start + k * TS_PACKET;
            if p >= buf.len() {
                break;
            }
            if buf[p] != 0x47 {
                ok = false;
                break;
            }
        }
        if ok {
            return true;
        }
    }
    false
}

fn id3_strings_non_empty(buf: &[u8]) -> bool {
    !collect_id3_strings(buf).is_empty()
}

/// Decrypt AES-128-CBC segment prefix; try small `media_sequence` deltas (CDN off-by-one vs playlist).
fn decrypt_hls_segment_prefix(
    raw: &[u8],
    key: &[u8],
    explicit_iv: &Option<Vec<u8>>,
    media_sequence: u64,
) -> Vec<u8> {
    if raw.len() < 16 {
        return raw.to_vec();
    }
    const DELTAS: &[i64] = &[0, -1, 1, -2, 2, 3, -3, 4, -4, 5, -5];
    for &d in DELTAS {
        let seq = (media_sequence as i64 + d).max(0) as u64;
        let iv = iv_for_segment(seq, explicit_iv);
        if let Some(pt) = aes128_cbc_decrypt_prefix(raw, key, &iv, raw.len()) {
            if ts_sync_likely(&pt) || id3_strings_non_empty(&pt) {
                return pt;
            }
        }
    }
    let iv = iv_for_segment(media_sequence, explicit_iv);
    aes128_cbc_decrypt_prefix(raw, key, &iv, raw.len()).unwrap_or_else(|| raw.to_vec())
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
            if line.contains("SAMPLE-AES") {
                eprintln!(
                    "[SpaceHls] playlist has SAMPLE-AES — segment-wide AES-128-CBC may not apply; cleartext ID3 + ffprobe fallback used"
                );
            }
            if let Some(kt) = parse_hls_key_line(line, base) {
                key_template = Some(kt);
            }
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
                    let bw = pending_bw.unwrap_or(0);
                    // Prefer **highest** bandwidth — low variants are often stripped-down and may
                    // omit timed ID3 metadata that the primary audio variant carries.
                    best = Some(match best {
                        None => (bw, u),
                        Some((obw, _ou)) if bw > obw => (bw, u),
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
    let raw_http = match fetch_bytes_range(client, uri, SEGMENT_HEAD_BYTES).await {
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

    // SAMPLE-AES / mixed layouts: timed ID3 may appear in **cleartext** while our AES-128-CBC
    // path is wrong — merge strings from raw + decrypted.
    let mut merged_strings = collect_id3_strings(&raw_http);
    if let Some(ref key) = key_state.key {
        let dec = decrypt_hls_segment_prefix(&raw_http, key, &key_state.iv, media_sequence);
        for s in collect_id3_strings(&dec) {
            if !merged_strings.iter().any(|x| x == &s) {
                merged_strings.push(s);
            }
        }
    }

    SegmentScan {
        seg_start,
        active_speaker: last_speaker_from_json_strings(&merged_strings),
        stage_user_ids: best_stage_from_json_strings(&merged_strings),
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

#[cfg(windows)]
fn hide_subprocess_console(cmd: &mut tokio::process::Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let _ = cmd.as_std_mut().creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn hide_subprocess_console(_cmd: &mut tokio::process::Command) {}

/// Best-effort timestamp for an ffprobe packet/frame (`pts_time` often missing on some TS/HLS paths).
fn ffprobe_packet_time_secs(p: &Value) -> Option<f64> {
    for key in ["pts_time", "dts_time", "best_effort_timestamp_time", "time"] {
        if let Some(x) = p.get(key) {
            let n = x
                .as_str()
                .and_then(|s| s.parse::<f64>().ok())
                .or_else(|| x.as_f64());
            if let Some(t) = n {
                if t.is_finite() && t >= 0.0 {
                    return Some(t);
                }
            }
        }
    }
    None
}

/// Recursively collect string leaves (ID3 / side_data blobs) from ffprobe JSON.
fn collect_ffprobe_metadata_strings(v: &Value, depth: u8, budget: &mut usize, out: &mut Vec<String>) {
    if depth == 0 || *budget == 0 {
        return;
    }
    const MAX_STR: usize = 768 * 1024;
    match v {
        Value::String(s) => {
            if s.is_empty() || s.len() > MAX_STR {
                return;
            }
            out.push(s.clone());
            *budget -= 1;
        }
        Value::Array(a) => {
            for x in a {
                collect_ffprobe_metadata_strings(x, depth - 1, budget, out);
            }
        }
        Value::Object(o) => {
            for x in o.values() {
                collect_ffprobe_metadata_strings(x, depth - 1, budget, out);
            }
        }
        _ => {}
    }
}

fn push_unique_candidate(out: &mut Vec<String>, s: String) {
    if s.is_empty() {
        return;
    }
    if !out.iter().any(|x| x == &s) {
        out.push(s);
    }
}

/// ffprobe often omits `packet.tags` for MPEG-TS; timed metadata may live in `side_data_list[].data` (hex).
fn collect_ffprobe_side_data_id3_strings(packet: &Value, out: &mut Vec<String>) {
    let Some(arr) = packet.get("side_data_list").and_then(|v| v.as_array()) else {
        return;
    };
    for entry in arr {
        let Some(obj) = entry.as_object() else {
            continue;
        };
        if let Some(Value::String(hex_raw)) = obj.get("data") {
            let clean: String = hex_raw.chars().filter(|c| c.is_ascii_hexdigit()).collect();
            if clean.len() < 8 || clean.len() % 2 != 0 {
                continue;
            }
            if let Ok(bytes) = hex::decode(&clean) {
                for id3 in collect_id3_strings(&bytes) {
                    push_unique_candidate(out, id3);
                }
                if let Ok(s) = std::str::from_utf8(&bytes) {
                    let t = s.trim();
                    if t.contains('{') {
                        push_unique_candidate(out, t.to_string());
                    }
                }
            }
        }
    }
}

/// Parse Periscope-style JSON from a metadata string (handles `…prefix…{"user_id":…`).
fn speaker_from_id3_like_string(s: &str) -> Option<String> {
    let t = s.trim();
    let start = if t.starts_with('{') {
        0usize
    } else {
        t.find('{')?
    };
    let slice = t.get(start..)?;
    if slice.len() > 768 * 1024 {
        return None;
    }
    let val: Value = serde_json::from_str(slice).ok()?;
    first_user_id_in_json(&val, 8).or_else(|| speaker_screen_name_hint(&val, 8))
}

fn ffprobe_first_packet_diag(packets: &[Value]) -> Option<String> {
    let p0 = packets.first()?;
    let top: Vec<String> = p0
        .as_object()
        .map(|m| m.keys().map(|k| k.to_string()).collect())
        .unwrap_or_default();
    let tag_keys: Vec<String> = p0
        .get("tags")
        .and_then(|t| t.as_object())
        .map(|m| m.keys().map(|k| k.to_string()).collect())
        .unwrap_or_default();
    let side_types: Vec<String> = p0
        .get("side_data_list")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|e| {
                    e.get("side_data_type")
                        .and_then(|x| x.as_str().map(std::string::ToString::to_string))
                })
                .collect()
        })
        .unwrap_or_default();
    Some(format!(
        "no speaker rows; first_packet_top_keys={:?} tag_keys={:?} side_data_type={:?}",
        top, tag_keys, side_types
    ))
}

fn parse_ffprobe_speaker_packet_json(stdout: &str) -> Result<(Vec<(f64, String)>, Option<String>), String> {
    if stdout.len() > 80_000_000 {
        return Err(format!(
            "ffprobe JSON too large ({} MiB)",
            stdout.len() / 1_048_576
        ));
    }
    let root: Value = serde_json::from_str(stdout).map_err(|e| format!("ffprobe json: {}", e))?;
    let packets: Vec<Value> = root
        .get("packets")
        .and_then(|x| x.as_array())
        .cloned()
        .or_else(|| root.get("frames").and_then(|x| x.as_array()).cloned())
        .unwrap_or_default();

    let diag = ffprobe_first_packet_diag(&packets);
    let mut rows: Vec<(f64, String)> = Vec::new();
    for p in packets {
        let Some(pts) = ffprobe_packet_time_secs(&p) else {
            continue;
        };
        let mut candidates: Vec<String> = Vec::new();
        let mut budget = 96usize;
        collect_ffprobe_metadata_strings(&p, 7, &mut budget, &mut candidates);
        collect_ffprobe_side_data_id3_strings(&p, &mut candidates);
        for s in candidates {
            if let Some(uid) = speaker_from_id3_like_string(&s) {
                rows.push((pts, uid));
                break;
            }
        }
    }
    Ok((rows, diag))
}

struct TempTsSnippet(PathBuf);

impl Drop for TempTsSnippet {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// Read the first `clip_seconds` of the HLS manifest sequentially (no seek) into a local TS file
/// so ffprobe can read packet tags. Periscope HLS often rejects `ffprobe -read_intervals` on the
/// remote URL (`Could not seek to position 0: Operation not permitted`).
async fn ffmpeg_hls_audio_snippet_ts(
    ffmpeg: &str,
    manifest_url: &str,
    out_path: &Path,
    clip_seconds: f64,
    map_first_audio: bool,
) -> Result<(), String> {
    let t = format!("{}", clip_seconds);
    let mut cmd = tokio::process::Command::new(ffmpeg);
    hide_subprocess_console(&mut cmd);
    cmd.args([
        "-y",
        "-loglevel",
        "error",
        "-nostdin",
        "-headers",
        "Referer: https://x.com/\r\nOrigin: https://x.com\r\n",
        "-i",
        manifest_url,
        "-t",
        &t,
    ]);
    if map_first_audio {
        cmd.args(["-map", "0:a:0", "-c", "copy", "-f", "mpegts"]);
    } else {
        cmd.args(["-vn", "-c", "copy", "-f", "mpegts"]);
    }
    cmd.arg(out_path);
    let out = tokio::time::timeout(std::time::Duration::from_secs(360), cmd.output())
        .await
        .map_err(|_| "ffmpeg HLS snippet timed out after 360s".to_string())?
        .map_err(|e| format!("ffmpeg spawn: {}", e))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!(
            "ffmpeg exit {}: {}",
            out.status,
            err.chars().take(1200).collect::<String>()
        ));
    }
    Ok(())
}

async fn ffprobe_show_packets_on_file(ffprobe: &str, local_ts: &Path) -> Result<String, String> {
    let mut cmd = tokio::process::Command::new(ffprobe);
    hide_subprocess_console(&mut cmd);
    cmd.args([
        "-v",
        "error",
        "-hide_banner",
        "-print_format",
        "json",
        "-show_packets",
        "-select_streams",
        "a:0",
        "-i",
    ]);
    cmd.arg(local_ts);
    let out = tokio::time::timeout(std::time::Duration::from_secs(120), cmd.output())
        .await
        .map_err(|_| "ffprobe local ts timed out after 120s".to_string())?
        .map_err(|e| format!("ffprobe spawn: {}", e))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!(
            "ffprobe exit {}: {}",
            out.status,
            err.chars().take(800).collect::<String>()
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Demux a short prefix of the HLS replay with ffmpeg, then ffprobe the local TS for timed metadata.
/// Avoids `-read_intervals` on the manifest URL, which often fails on Periscope CDNs.
async fn ffprobe_hls_speaker_hints_from_manifest(
    manifest_url: &str,
    probe_wall_seconds: f64,
) -> Result<Vec<(f64, String)>, String> {
    let clip = probe_wall_seconds.clamp(60.0, 300.0);
    let ffmpeg = crate::youtube::resolve_sidecar_binary("ffmpeg")?;
    let ffprobe = crate::youtube::resolve_sidecar_binary("ffprobe")?;

    let stamp = SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let snippet_path = std::env::temp_dir().join(format!("clippster_space_hls_probe_{}.ts", stamp));
    let _cleanup = TempTsSnippet(snippet_path.clone());

    match ffmpeg_hls_audio_snippet_ts(&ffmpeg, manifest_url, &snippet_path, clip, true).await {
        Ok(()) => {}
        Err(e1) => {
            ffmpeg_hls_audio_snippet_ts(&ffmpeg, manifest_url, &snippet_path, clip, false)
                .await
                .map_err(|e2| {
                    format!(
                        "ffmpeg HLS snippet (map 0:a:0): {}; fallback (-vn): {}",
                        e1, e2
                    )
                })?;
        }
    }

    let stdout = ffprobe_show_packets_on_file(&ffprobe, &snippet_path).await?;
    let (rows, diag) = parse_ffprobe_speaker_packet_json(&stdout)?;
    println!(
        "[SpaceHls] ffprobe packet speaker rows={} (ffmpeg head {:.0}s → local ts)",
        rows.len(),
        clip
    );
    if rows.is_empty() {
        if let Some(msg) = diag {
            eprintln!("[SpaceHls] ffprobe: {}", msg);
        }
    }
    Ok(rows)
}

/// Diagnostic: fetch the first `n_segments` of the HLS playlist and dump every raw ID3 string
/// to stdout.  Call from the frontend temporarily to understand the actual JSON schema in the
/// stream, then use that to improve the parser.
#[tauri::command]
pub async fn dump_hls_id3_debug(manifest_url: String, n_segments: usize) -> Result<Vec<String>, String> {
    let client = build_space_hls_http_client()?;

    let start_url = Url::parse(&manifest_url).map_err(|e| format!("Bad manifest URL: {}", e))?;
    let (parsed, media_sequence_start) = resolve_to_media_playlist(&client, &start_url).await?;

    let take = n_segments.min(parsed.segments.len());
    let mut output: Vec<String> = Vec::new();
    let key_state: Arc<KeyState> = if let Some((ref key_url, ref iv)) = parsed.key_template {
        match fetch_aes_key(&client, key_url).await {
            Ok(k) => Arc::new(KeyState { key: Some(k), iv: iv.clone() }),
            Err(_) => Arc::new(KeyState::default()),
        }
    } else {
        Arc::new(KeyState::default())
    };

    let mut cumulative = 0.0_f64;
    for (idx, (uri, dur)) in parsed.segments.iter().enumerate().take(take) {
        let seg_start = cumulative;
        cumulative += dur;
        let seq = media_sequence_start.saturating_add(idx as u64);

        let raw_http = match fetch_bytes_range(&client, uri, SEGMENT_HEAD_BYTES).await {
            Ok(b) => b,
            Err(e) => {
                output.push(format!("[seg {idx}@{seg_start:.1}s] FETCH ERROR: {e}"));
                continue;
            }
        };
        let mut merged = collect_id3_strings(&raw_http);
        let mut raw = raw_http;
        if let Some(ref key) = key_state.key {
            let dec = decrypt_hls_segment_prefix(&raw, key, &key_state.iv, seq);
            for s in collect_id3_strings(&dec) {
                if !merged.iter().any(|x| x == &s) {
                    merged.push(s);
                }
            }
            raw = dec;
        }

        let strings = merged;
        if strings.is_empty() {
            let head = raw.iter().take(24).map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(" ");
            output.push(format!(
                "[seg {idx}@{seg_start:.1}s] NO ID3 STRINGS FOUND (first24hex={head})"
            ));
        } else {
            for (si, s) in strings.iter().enumerate() {
                let preview = if s.len() > 2000 { format!("{}…(+{})", &s[..2000], s.len() - 2000) } else { s.clone() };
                let line = format!("[seg {idx}@{seg_start:.1}s str {si}] {preview}");
                println!("[SpaceHls dump] {}", &line);
                output.push(line);
            }
        }
    }
    Ok(output)
}

/// Walks the Space replay HLS manifest and collects ID3 hints: talking timeline + on-stage roster cues.
#[tauri::command]
pub async fn extract_space_speaker_timeline_from_hls_manifest(
    manifest_url: String,
    duration_secs: Option<f64>,
) -> Result<SpaceHlsMetadataResult, String> {
    let client = build_space_hls_http_client()?;

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
            Err(e) => {
                eprintln!(
                    "[SpaceHls] AES-128 key fetch failed (ID3 scan will fail on encrypted segments): {} — {}",
                    key_url, e
                );
                Arc::new(KeyState::default())
            }
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

    if speaker_rows.is_empty() {
        match ffprobe_hls_speaker_hints_from_manifest(&manifest_url, 120.0).await {
            Ok(mut v) => {
                v.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
                speaker_rows = v;
            }
            Err(e) => {
                eprintln!("[SpaceHls] ffprobe HLS speaker hints failed: {}", e);
            }
        }
    }

    let speaker_segments = merge_events(speaker_rows, total);
    let stage_snapshots = merge_stage_snapshots(stage_rows, total);
    println!(
        "[SpaceHls] talking_segments={} stage_cues={} from {} HLS parts",
        speaker_segments.len(),
        stage_snapshots.len(),
        parsed.segments.len()
    );
    if speaker_segments.is_empty()
        && stage_snapshots.is_empty()
        && !parsed.segments.is_empty()
    {
        eprintln!(
            "[SpaceHls] No speaker cues from TS scan or ffprobe — use dump_hls_id3_debug(manifest) to inspect bytes."
        );
    }
    Ok(SpaceHlsMetadataResult {
        speaker_segments,
        stage_snapshots,
    })
}
