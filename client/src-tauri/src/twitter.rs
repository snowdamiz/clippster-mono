use std::{
    collections::{HashMap, HashSet},
    path::PathBuf,
    sync::{Arc, Mutex},
};

use once_cell::sync::Lazy;
use regex::Regex;
use serde::Serialize;
use serde_json::Value;
use tauri::Emitter;
use tokio::sync::oneshot;
use crate::storage;
use crate::thumbnail_utils::generate_thumbnail_hybrid;
use tokio::io::AsyncBufReadExt;
use base64::Engine;

#[cfg(target_os = "windows")]
#[allow(unused_imports)]
use std::os::windows::process::CommandExt;

/// On Windows, set CREATE_NO_WINDOW flag to prevent a visible console window.
#[cfg(target_os = "windows")]
fn no_window(cmd: &mut tokio::process::Command) -> &mut tokio::process::Command {
    cmd.creation_flags(0x08000000) // CREATE_NO_WINDOW
}

#[cfg(not(target_os = "windows"))]
fn no_window(cmd: &mut tokio::process::Command) -> &mut tokio::process::Command {
    cmd
}

/// Same public OAuth2 bearer yt-dlp uses for guest X API access (`TwitterBaseIE._AUTH`).
const TWITTER_PUBLIC_BEARER: &str = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
const TWITTER_API_V11: &str = "https://api.x.com/1.1/";
/// Document hash changes when X updates the query; keep aligned with yt-dlp `TwitterSpacesIE`.
const TWITTER_AUDIO_SPACE_GQL: &str =
    "https://x.com/i/api/graphql/HPEisOmj1epUNLCWTYhUWw/AudioSpaceById";

static TWITTER_HTTP: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .build()
        .expect("twitter HTTP client")
});

async fn twitter_guest_token() -> Result<String, String> {
    let url = format!("{}guest/activate.json", TWITTER_API_V11);
    let resp = TWITTER_HTTP
        .post(url)
        .header(
            "Authorization",
            format!("Bearer {}", TWITTER_PUBLIC_BEARER),
        )
        .body("")
        .send()
        .await
        .map_err(|e| format!("Twitter guest activate failed: {}", e))?;
    let status = resp.status();
    if !status.is_success() {
        let t = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Twitter guest activate HTTP {}: {}",
            status,
            t.chars().take(300).collect::<String>()
        ));
    }
    let v: Value = resp
        .json()
        .await
        .map_err(|e| format!("Twitter guest token JSON: {}", e))?;
    v.get("guest_token")
        .and_then(|x| x.as_str())
        .map(String::from)
        .ok_or_else(|| "Twitter guest_token missing".to_string())
}

fn audio_space_gql_variables(space_id: &str) -> Value {
    serde_json::json!({
        "id": space_id,
        "isMetatagsQuery": true,
        "withDownvotePerspective": false,
        "withReactionsMetadata": false,
        "withReactionsPerspective": false,
        "withReplays": true,
        "withSuperFollowsUserFields": true,
        "withSuperFollowsTweetFields": true,
    })
}

fn audio_space_gql_features() -> Value {
    serde_json::json!({
        "dont_mention_me_view_api_enabled": true,
        "interactive_text_enabled": true,
        "responsive_web_edit_tweet_api_enabled": true,
        "responsive_web_enhance_cards_enabled": true,
        "responsive_web_uc_gql_enabled": true,
        "spaces_2022_h2_clipping": true,
        "spaces_2022_h2_spaces_communities": false,
        "standardized_nudges_misinfo": true,
        "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": false,
        "vibe_api_enabled": true,
    })
}

async fn audio_space_graphql_request(
    space_id: &str,
    guest: &str,
    variables: &Value,
    features: &Value,
) -> Result<reqwest::Response, String> {
    let vars_str =
        serde_json::to_string(variables).map_err(|e| format!("AudioSpace variables JSON: {}", e))?;
    let feats_str =
        serde_json::to_string(features).map_err(|e| format!("AudioSpace features JSON: {}", e))?;
    TWITTER_HTTP
        .get(TWITTER_AUDIO_SPACE_GQL)
        .header("Authorization", format!("Bearer {}", TWITTER_PUBLIC_BEARER))
        .header("x-guest-token", guest)
        .header("x-twitter-client-language", "en")
        .header("x-twitter-active-user", "no")
        .header("Origin", "https://x.com")
        .header("Referer", format!("https://x.com/i/spaces/{}", space_id))
        .query(&[("variables", vars_str), ("features", feats_str)])
        .send()
        .await
        .map_err(|e| format!("AudioSpace GraphQL request failed: {}", e))
}

fn slugify_participant_id(display: &str) -> String {
    let s: String = display
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect();
    let trimmed = s.trim_matches('_').to_string();
    if trimmed.is_empty() {
        "speaker".to_string()
    } else {
        trimmed
    }
}

fn participant_rest_id(obj: &serde_json::Map<String, Value>) -> Option<String> {
    if let Some(s) = obj.get("rest_id").and_then(|v| v.as_str()) {
        return Some(s.to_string());
    }
    if let Some(n) = obj.get("rest_id").and_then(|v| v.as_i64()) {
        return Some(n.to_string());
    }
    if let Some(u) = obj.get("user_results") {
        if let Some(r) = u.get("result") {
            if let Some(s) = r.get("rest_id").and_then(|v| v.as_str()) {
                return Some(s.to_string());
            }
            if let Some(n) = r.get("rest_id").and_then(|v| v.as_i64()) {
                return Some(n.to_string());
            }
        }
    }
    None
}

fn participant_screen_name(obj: &serde_json::Map<String, Value>) -> Option<String> {
    if let Some(s) = obj.get("twitter_screen_name").and_then(|v| v.as_str()) {
        return Some(s.trim_start_matches('@').to_string());
    }
    if let Some(s) = obj.get("screen_name").and_then(|v| v.as_str()) {
        return Some(s.trim_start_matches('@').to_string());
    }
    obj.get("user_results")?
        .get("result")?
        .get("legacy")?
        .get("screen_name")
        .and_then(|v| v.as_str())
        .map(|s| s.trim_start_matches('@').to_string())
}

/// Canonical ID shared by **roster JSON** and **speaker timeline** so Vue can match
/// `segment.speakerId` to `participant.id` for highlighting.
///
/// - Prefer numeric `rest_id` (stable; matches Periscope user id when that path is used).
/// - Otherwise the same lowercase slug used for stage-join times (never raw mixed-case handles).
fn space_participant_stable_id(obj: &serde_json::Map<String, Value>) -> String {
    if let Some(r) = participant_rest_id(obj) {
        if !r.is_empty() {
            return r;
        }
    }
    participant_screen_name(obj)
        .map(|s| s.to_lowercase().replace(|c: char| !c.is_alphanumeric(), "_"))
        .filter(|s| !s.is_empty())
        .unwrap_or_default()
}

fn participant_avatar_url(obj: &serde_json::Map<String, Value>) -> Option<String> {
    if let Some(s) = obj.get("avatar_url").and_then(|v| v.as_str()) {
        return Some(s.replace("_normal", "_400x400"));
    }
    let nested = obj
        .get("user_results")?
        .get("result")?
        .pointer("/legacy/profile_image_url_https")
        .and_then(|v| v.as_str())?;
    Some(nested.replace("_normal", "_400x400"))
}

fn participant_from_audio_space_row(
    obj: &serde_json::Map<String, Value>,
    role: &str,
) -> Option<Value> {
    let screen = participant_screen_name(obj).unwrap_or_default();
    let rest = participant_rest_id(obj).unwrap_or_default();
    let display = obj
        .get("display_name")
        .or_else(|| obj.get("displayName"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string)
        .or_else(|| {
            if !screen.is_empty() {
                Some(screen.clone())
            } else {
                None
            }
        })
        .or_else(|| {
            if !rest.is_empty() {
                Some(format!("User {}", rest))
            } else {
                None
            }
        })?;
    let mut id = space_participant_stable_id(obj);
    if id.is_empty() {
        id = slugify_participant_id(&display);
    }
    let name = if !screen.is_empty() {
        format!("@{}", screen)
    } else {
        display.clone()
    };
    let mut out = serde_json::Map::new();
    out.insert("id".into(), Value::String(id));
    out.insert("name".into(), Value::String(name));
    out.insert("display_name".into(), Value::String(display.to_string()));
    if !screen.is_empty() {
        out.insert("username".into(), Value::String(screen));
    }
    out.insert(
        "role".into(),
        Value::String(
            if role == "admins" {
                "host"
            } else if role == "speakers" {
                "speaker"
            } else {
                role
            }
            .to_string(),
        ),
    );
    if let Some(a) = participant_avatar_url(obj) {
        out.insert("avatar_url".into(), Value::String(a));
    }
    Some(Value::Object(out))
}

fn push_audio_space_role(
    participants_root: Option<&Value>,
    key: &str,
    role_key: &str,
    out: &mut Vec<Value>,
    seen: &mut HashSet<String>,
) {
    let Some(arr) = participants_root
        .and_then(|p| p.get(key))
        .and_then(|a| a.as_array())
    else {
        return;
    };
    for item in arr {
        let Some(obj) = item.as_object() else {
            continue;
        };
        let Some(entry) = participant_from_audio_space_row(obj, role_key) else {
            continue;
        };
        let id = entry
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if id.is_empty() || seen.contains(&id) {
            continue;
        }
        seen.insert(id);
        out.push(entry);
    }
}

/// Rich data returned from AudioSpaceById + live_video_stream/status
struct AudioSpaceFullData {
    participants: Vec<Value>,
    /// media_key — e.g. "1_12345678901234567" — needed for live_video_stream/status
    media_key: Option<String>,
    /// Unix SECONDS when the space started; used to compute relative speaker-join times
    started_at_secs: Option<i64>,
    /// (participant_id, join_time_secs) for admins + speakers; `start` field from GraphQL (Unix secs)
    stage_join_times: Vec<(String, i64)>,
    /// chatToken from live_video_stream/status — used to access Periscope replay events
    chat_token: Option<String>,
}

/// Fetch full AudioSpaceById data and live_video_stream/status in one call.
///
/// `prepend_periscope_broadcast_ids` — e.g. HLS-derived `1_{playlistId}`; tried **first** for
/// `accessVideoPublic` before Space id / GraphQL `mediaKey` (Periscope often keys replays by
/// the numeric id from the playlist filename, not `28_*` GraphQL keys).
async fn fetch_audio_space_full(
    space_id: &str,
    prepend_periscope_broadcast_ids: &[String],
) -> Result<AudioSpaceFullData, String> {
    let mut guest = twitter_guest_token().await?;
    let variables = audio_space_gql_variables(space_id);
    let features = audio_space_gql_features();
    let mut resp = audio_space_graphql_request(space_id, &guest, &variables, &features).await?;
    let mut status = resp.status();
    let mut body = resp
        .text()
        .await
        .map_err(|e| format!("AudioSpace GraphQL body: {}", e))?;
    // Guest tokens expire quickly; one refresh fixes intermittent "Bad guest token" (239).
    if !status.is_success() {
        let retry = status == reqwest::StatusCode::FORBIDDEN
            && (body.contains("Bad guest token") || body.contains("\"code\":239"));
        if retry {
            println!("[Twitter] AudioSpace GraphQL {} — refreshing guest token and retrying once", status);
            guest = twitter_guest_token().await?;
            resp = audio_space_graphql_request(space_id, &guest, &variables, &features).await?;
            status = resp.status();
            body = resp
                .text()
                .await
                .map_err(|e| format!("AudioSpace GraphQL body: {}", e))?;
        }
    }
    if !status.is_success() {
        return Err(format!(
            "AudioSpace GraphQL HTTP {}: {}",
            status,
            body.chars().take(400).collect::<String>()
        ));
    }
    let root: Value = serde_json::from_str(&body).map_err(|e| format!("AudioSpace GraphQL JSON: {}", e))?;
    if let Some(errs) = root.get("errors").and_then(|e| e.as_array()) {
        if !errs.is_empty() {
            let msg: String = errs
                .iter()
                .filter_map(|e| e.get("message").and_then(|m| m.as_str()))
                .collect::<Vec<_>>()
                .join("; ");
            if !msg.is_empty() {
                return Err(format!("Twitter GraphQL: {}", msg));
            }
        }
    }
    let space = root
        .pointer("/data/audioSpace")
        .ok_or_else(|| "AudioSpace response missing data.audioSpace".to_string())?;

    // Log the top-level keys inside metadata so we know the exact field names
    if let Some(meta_obj) = space.get("metadata").and_then(|v| v.as_object()) {
        let keys: Vec<&str> = meta_obj.keys().map(String::as_str).collect();
        println!("[Twitter] AudioSpace metadata keys: {:?}", keys);
    }

    // ---- extract media_key: GraphQL uses camelCase "mediaKey" ----
    let media_key = space
        .pointer("/metadata/mediaKey")    // camelCase — what X GraphQL actually returns
        .or_else(|| space.pointer("/metadata/media_key"))  // snake_case fallback
        .and_then(|v| v.as_str())
        .map(String::from);

    // ---- started_at: GraphQL returns milliseconds; normalise to Unix SECONDS ----
    // X GraphQL `startedAt` / `started_at` is epoch-milliseconds (13 digits).
    // yt-dlp `timestamp` is epoch-seconds (10 digits). Normalise everything to seconds.
    let started_at_secs = space
        .pointer("/metadata/started_at")
        .or_else(|| space.pointer("/metadata/startedAt"))
        .or_else(|| space.pointer("/metadata/created_at"))
        .or_else(|| space.pointer("/metadata/createdAt"))
        .and_then(|v| v.as_i64())
        .map(|v| if v > 1_000_000_000_000 { v / 1000 } else { v }); // ms → s if needed

    println!(
        "[Twitter] AudioSpace media_key={:?} started_at_secs={:?}",
        media_key, started_at_secs
    );

    // ---- extract stage-join times for admins + speakers ----
    // X GraphQL `start` field on participants = Unix SECONDS when they joined the stage.
    let mut stage_join_times: Vec<(String, i64)> = Vec::new();
    for role_key in ["admins", "speakers"] {
        if let Some(arr) = space
            .pointer(&format!("/participants/{}", role_key))
            .and_then(|v| v.as_array())
        {
            for item in arr {
                let obj = match item.as_object() { Some(o) => o, None => continue };
                let id = space_participant_stable_id(obj);
                if id.is_empty() { continue; }
                // `start` is the epoch-ms when the participant joined the stage.
                // Normalise to seconds for consistent arithmetic with started_at_secs.
                let join_secs = obj.get("start").and_then(|v| v.as_i64())
                    .map(|v| if v > 1_000_000_000_000 { v / 1000 } else { v })
                    .unwrap_or(started_at_secs.unwrap_or(0));
                println!("[Twitter] Participant stage-join: id={} join_secs={}", id, join_secs);
                stage_join_times.push((id, join_secs));
            }
        }
    }

    // ---- build participant roster ----
    let participants_root = space.get("participants");
    let mut roster = Vec::new();
    let mut seen = HashSet::new();
    push_audio_space_role(participants_root, "admins", "admins", &mut roster, &mut seen);
    push_audio_space_role(participants_root, "speakers", "speakers", &mut roster, &mut seen);
    push_audio_space_role_capped(participants_root, "listeners", "listener", &mut roster, &mut seen, 50);

    let broadcast_probe_ids =
        build_broadcast_probe_ids_vec(prepend_periscope_broadcast_ids, space_id, media_key.as_deref());

    // ---- Periscope replay token: accessVideoPublic, else live_video_stream/status (guest) ----
    let mut chat_token = if media_key.is_some() || !prepend_periscope_broadcast_ids.is_empty() {
        match fetch_periscope_access_video(
            prepend_periscope_broadcast_ids,
            media_key.as_deref(),
            Some(space_id),
        )
        .await
        {
            Ok(tok) => {
                println!("[Twitter] Got Periscope access_token for space_id={}", space_id);
                Some(tok)
            }
            Err(e) => {
                println!("[Twitter] Periscope accessVideoPublic failed (non-fatal): {}", e);
                None
            }
        }
    } else {
        println!("[Twitter] No media_key and no HLS-derived id — skipping Periscope accessVideoPublic");
        None
    };

    if chat_token.is_none() {
        if let Some(ref mk) = media_key {
            if let Some(tok) = fetch_chat_token_from_live_video_stream_status(
                mk.as_str(),
                &guest,
                &broadcast_probe_ids,
            )
            .await
            {
                println!(
                    "[Twitter] Using validated Periscope chat token from live_video_stream/status (media_key={})",
                    mk
                );
                chat_token = Some(tok);
            }
        }
    }

    // AudioSpace GraphQL payload sometimes embeds a Periscope chat token the web player uses.
    if chat_token.is_none() {
        if let Some(tok) = deep_find_chat_token_json(space, 0) {
            if periscope_chat_token_valid_for_any_broadcast(&broadcast_probe_ids, &tok).await {
                println!("[Twitter] Using validated chat token from AudioSpace GraphQL subtree");
                chat_token = Some(tok);
            }
        }
    }

    // Public Space HTML (SSR/hydration fragments) occasionally embeds chatToken + broadcast_id.
    if chat_token.is_none() {
        if let Some(tok) =
            scrape_x_space_public_page_for_chat_token(space_id, &guest, &broadcast_probe_ids).await
        {
            println!("[Twitter] Using validated chat token from public Space page HTML");
            chat_token = Some(tok);
        }
    }

    Ok(AudioSpaceFullData {
        participants: roster,
        media_key,
        started_at_secs,
        stage_join_times,
        chat_token,
    })
}

fn build_broadcast_probe_ids_vec(
    prepend: &[String],
    space_id: &str,
    media_key: Option<&str>,
) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut push = |s: &str| {
        let t = s.trim();
        if t.is_empty() || out.iter().any(|x| x == t) {
            return;
        }
        out.push(t.to_string());
    };
    for s in prepend {
        push(s);
    }
    push(space_id);
    if let Some(mk) = media_key {
        push(mk);
        if let Some((_, n)) = mk.split_once('_') {
            push(n);
        }
    }
    out
}

/// Periscope replay chat token — **only** `chatToken` / `chat_token` (not `access_token`, which is
/// often a Twitter playback credential and makes `broadcastComments` return 404).
fn deep_find_chat_token_json(v: &Value, depth: u8) -> Option<String> {
    if depth > 14 {
        return None;
    }
    match v {
        Value::Object(m) => {
            for (k, child) in m {
                let is_chat_token_key = matches!(k.as_str(), "chatToken" | "chat_token");
                if is_chat_token_key {
                    if let Some(s) = child.as_str() {
                        if s.len() >= 16 {
                            return Some(s.to_string());
                        }
                    }
                }
                if let Some(found) = deep_find_chat_token_json(child, depth + 1) {
                    return Some(found);
                }
            }
        }
        Value::Array(a) => {
            for item in a {
                if let Some(found) = deep_find_chat_token_json(item, depth + 1) {
                    return Some(found);
                }
            }
        }
        _ => {}
    }
    None
}

/// Pull `broadcast_id` / `chatToken` fragments from the public Space document (X still ships some
/// config as inline JSON even though most UI is client-rendered).
async fn scrape_x_space_public_page_for_chat_token(
    space_id: &str,
    guest: &str,
    broadcast_candidates: &[String],
) -> Option<String> {
    static BROADCAST_ID_HTML: Lazy<Regex> = Lazy::new(|| {
        Regex::new(r#"(?i)(?:\\"|")(?:broadcast_id|broadcastId)(?:\\"|")\s*:\s*(?:\\"|")([0-9A-Za-z_]+)(?:\\"|")"#)
            .expect("broadcast_id html regex")
    });
    static PLAYLIST_REPLAY_ID: Lazy<Regex> = Lazy::new(|| {
        Regex::new(r"playlist_(\d{10,32})\.m3u8").expect("playlist replay id regex")
    });

    const HOSTS: &[&str] = &["https://x.com", "https://twitter.com"];
    let token_needles = [
        "\"chatToken\":\"",
        "\"chat_token\":\"",
        "chatToken\":\"",
        "chat_token\":\"",
        "\\\"chatToken\\\":\\\"",
        "\\\"chat_token\\\":\\\"",
    ];

    for host in HOSTS {
        let url = format!("{}/i/spaces/{}", host, space_id);
        let resp = match TWITTER_HTTP
            .get(&url)
            .header("Authorization", format!("Bearer {}", TWITTER_PUBLIC_BEARER))
            .header("x-guest-token", guest)
            .header("x-twitter-client-language", "en")
            .header("x-twitter-active-user", "yes")
            .header(
                "Accept",
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            )
            .header("Accept-Language", "en-US,en;q=0.9")
            .header("Origin", "https://x.com")
            .header("Referer", format!("https://x.com/i/spaces/{}", space_id))
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                println!("[Twitter] Space page scrape request failed ({}): {}", url, e);
                continue;
            }
        };
        if !resp.status().is_success() {
            println!(
                "[Twitter] Space page scrape HTTP {} from {}",
                resp.status(),
                url
            );
            continue;
        }
        let html = match resp.text().await {
            Ok(h) => h,
            Err(_) => continue,
        };
        if html.len() < 800 {
            continue;
        }

        let mut probe_ids: Vec<String> = broadcast_candidates.to_vec();
        for cap in BROADCAST_ID_HTML.captures_iter(&html) {
            if let Some(m) = cap.get(1) {
                let s = m.as_str().to_string();
                if !s.is_empty() && !probe_ids.iter().any(|x| x == &s) {
                    probe_ids.insert(0, s);
                }
            }
        }
        for cap in PLAYLIST_REPLAY_ID.captures_iter(&html) {
            if let Some(m) = cap.get(1) {
                let prefixed = format!("1_{}", m.as_str());
                if !probe_ids.iter().any(|x| x == &prefixed) {
                    probe_ids.insert(0, prefixed);
                }
            }
        }

        for needle in token_needles {
            let mut pos = 0usize;
            while let Some(i) = html[pos..].find(needle) {
                let start = pos + i + needle.len();
                let rest = html.get(start..)?;
                let end = rest.find('"').unwrap_or(0);
                if end >= 16 {
                    let tok = rest.get(..end)?.to_string();
                    if periscope_chat_token_valid_for_any_broadcast(&probe_ids, &tok).await {
                        return Some(tok);
                    }
                }
                pos = start.saturating_add(1);
            }
        }
    }

    println!("[Twitter] Space page HTML scrape: no chatToken accepted by broadcastComments");
    None
}

/// `true` if `broadcastComments` accepts this token for at least one `broadcast_id` / host pair.
async fn periscope_chat_token_valid_for_any_broadcast(
    broadcast_candidates: &[String],
    token: &str,
) -> bool {
    const BASES: &[&str] = &[
        "https://proxsee.pscp.tv/api/v2/broadcastComments",
        "https://api.periscope.tv/api/v2/broadcastComments",
    ];
    let mut seen = HashSet::<String>::new();
    for raw in broadcast_candidates {
        let bid = raw.trim();
        if bid.is_empty() || !seen.insert(bid.to_string()) {
            continue;
        }
        for base in BASES {
            let resp = match TWITTER_HTTP
                .get(*base)
                .query(&[
                    ("broadcast_id", bid),
                    ("access_token", token),
                    ("limit", "5"),
                ])
                .header("Origin", "https://x.com")
                .header("Referer", "https://x.com/")
                .send()
                .await
            {
                Ok(r) => r,
                Err(_) => continue,
            };
            if resp.status().is_success() {
                return true;
            }
        }
    }
    false
}

/// Guest `live_video_stream/status` (TwitterSpacesWiretap / yt-dlp legacy path).
async fn fetch_chat_token_from_live_video_stream_status(
    media_key: &str,
    guest: &str,
    broadcast_candidates: &[String],
) -> Option<String> {
    let url = format!(
        "https://x.com/i/api/1.1/live_video_stream/status/{}",
        media_key
    );
    let resp = TWITTER_HTTP
        .get(&url)
        .query(&[
            ("client", "web"),
            ("use_syndication_guest_id", "false"),
            ("cookie_set_host", "x.com"),
        ])
        .header("Authorization", format!("Bearer {}", TWITTER_PUBLIC_BEARER))
        .header("x-guest-token", guest)
        .header("x-twitter-active-user", "yes")
        .header("x-twitter-client-language", "en")
        .header("Origin", "https://x.com")
        .header("Referer", "https://x.com/")
        .send()
        .await
        .ok()?;
    let status = resp.status();
    if !status.is_success() {
        let _ = resp.text().await;
        println!(
            "[Twitter] live_video_stream/status HTTP {} for media_key={}",
            status, media_key
        );
        return None;
    }
    let v: Value = resp.json().await.ok()?;
    if let Some(t) = deep_find_chat_token_json(&v, 0) {
        if periscope_chat_token_valid_for_any_broadcast(broadcast_candidates, &t).await {
            return Some(t);
        }
        println!(
            "[Twitter] live_video_stream/status: found chat_token-shaped field but broadcastComments rejected it — ignoring"
        );
        return None;
    }
    let keys: Vec<&str> = v
        .as_object()
        .map(|o| o.keys().map(|k| k.as_str()).collect())
        .unwrap_or_default();
    println!(
        "[Twitter] live_video_stream/status OK but no chatToken/chat_token (top_keys={:?})",
        keys
    );
    None
}

/// Fetch a Periscope replay access token using the public `accessVideoPublic` endpoint.
/// Requires NO Twitter authentication — works for any publicly available Space replay.
///
/// Candidate order: `preferred_broadcast_ids` (e.g. HLS `1_{id}`), Space id, GraphQL
/// `media_key`, then the numeric suffix of `media_key` when it differs.
async fn fetch_periscope_access_video(
    preferred_broadcast_ids: &[String],
    graphql_media_key: Option<&str>,
    space_id: Option<&str>,
) -> Result<String, String> {
    let mut candidates: Vec<String> = Vec::new();
    for s in preferred_broadcast_ids {
        let t = s.trim();
        if !t.is_empty() {
            candidates.push(t.to_string());
        }
    }
    if let Some(sid) = space_id {
        let t = sid.trim();
        if !t.is_empty() {
            candidates.push(t.to_string());
        }
    }
    if let Some(mk) = graphql_media_key {
        let t = mk.trim();
        if !t.is_empty() {
            candidates.push(t.to_string());
            let numeric_id = mk
                .split_once('_')
                .map(|(_, n)| n.trim().to_string())
                .unwrap_or_else(|| t.to_string());
            if !numeric_id.is_empty() && numeric_id != t {
                candidates.push(numeric_id);
            }
        }
    }

    let mut seen = HashSet::<String>::new();
    candidates.retain(|c| seen.insert(c.clone()));

    let candidates: Vec<&str> = candidates.iter().map(String::as_str).collect();

    let mut last_err = String::new();
    for &broadcast_id in &candidates {
        let resp = match TWITTER_HTTP
            .get("https://proxsee.pscp.tv/api/v2/accessVideoPublic")
            .query(&[
                ("broadcast_id", broadcast_id),
                ("replay_redirect", "false"),
            ])
            .header("Origin", "https://x.com")
            .header("Referer", "https://x.com/")
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                last_err = format!("request failed: {}", e);
                println!("[Twitter] accessVideoPublic {}", last_err);
                continue;
            }
        };

        let http_status = resp.status();
        if !http_status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            last_err = format!(
                "HTTP {} for broadcast_id={}: {}",
                http_status,
                broadcast_id,
                &body[..body.len().min(300)]
            );
            println!("[Twitter] accessVideoPublic {}", last_err);
            continue;
        }

        let data: Value = match resp.json().await {
            Ok(v) => v,
            Err(e) => {
                last_err = format!("JSON parse error: {}", e);
                println!("[Twitter] accessVideoPublic {}", last_err);
                continue;
            }
        };

        println!(
            "[Twitter] accessVideoPublic keys (broadcast_id={}): {:?}",
            broadcast_id,
            data.as_object().map(|o| o.keys().collect::<Vec<_>>())
        );

        if let Some(tok) = data
            .get("access_token")
            .or_else(|| data.get("chatToken"))
            .or_else(|| data.get("chat_token"))
            .and_then(|v| v.as_str())
        {
            println!(
                "[Twitter] Got Periscope access_token (broadcast_id={})",
                broadcast_id
            );
            return Ok(tok.to_string());
        }

        last_err = format!("no access_token field in response for broadcast_id={}", broadcast_id);
        println!("[Twitter] accessVideoPublic: {}", last_err);
    }

    Err(format!("accessVideoPublic: {}", last_err))
}

/// Fetch all speaker/stage events from Periscope broadcastComments (paginated).
/// `access_token` must come from `fetch_periscope_access_video`.
/// Returns Vec<(offset_secs_from_space_start, user_id)>.
async fn fetch_periscope_speaking_events(
    media_key: &str,
    access_token: &str,
    started_at_ms: i64,
    prepend_broadcast_ids: &[String],
) -> Vec<(f64, String)> {
    let mut candidates: Vec<String> = Vec::new();
    let mut push = |s: &str| {
        let t = s.trim();
        if t.is_empty() {
            return;
        }
        if !candidates.iter().any(|x| x == t) {
            candidates.push(t.to_string());
        }
    };
    for s in prepend_broadcast_ids {
        push(s);
    }
    push(media_key);
    if let Some((_, n)) = media_key.split_once('_') {
        push(n);
    }

    for broadcast_id in &candidates {
        let events =
            fetch_broadcast_comments_paged(broadcast_id, access_token, started_at_ms).await;
        if !events.is_empty() {
            return events;
        }
    }
    Vec::new()
}

/// Fetch and parse all pages of broadcastComments for one broadcast_id.
async fn fetch_broadcast_comments_paged(
    broadcast_id: &str,
    access_token: &str,
    started_at_ms: i64,
) -> Vec<(f64, String)> {
    const COMMENT_BASES: &[&str] = &[
        "https://proxsee.pscp.tv/api/v2/broadcastComments",
        "https://api.periscope.tv/api/v2/broadcastComments",
    ];

    let mut all_events: Vec<(f64, String)> = Vec::new();
    let mut cursor = String::new();
    let mut page = 0usize;
    // Once a host works, keep using it for cursor pagination.
    let mut sticky_base: Option<String> = None;

    loop {
        let mut query: Vec<(&str, String)> = vec![
            ("broadcast_id", broadcast_id.to_string()),
            ("access_token", access_token.to_string()),
            ("limit", "500".to_string()),
        ];
        if !cursor.is_empty() {
            query.push(("cursor", cursor.clone()));
        }

        let bases: Vec<&str> = if let Some(ref b) = sticky_base {
            vec![b.as_str()]
        } else {
            COMMENT_BASES.to_vec()
        };

        let mut data: Option<Value> = None;
        for base in bases {
            let resp = match TWITTER_HTTP
                .get(base)
                .query(&query)
                .header("Origin", "https://x.com")
                .header("Referer", "https://x.com/")
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) => {
                    println!(
                        "[Twitter] broadcastComments fetch failed (page {}, base={}, broadcast_id={}): {}",
                        page, base, broadcast_id, e
                    );
                    continue;
                }
            };

            let http_status = resp.status();
            if !http_status.is_success() {
                let body = resp.text().await.unwrap_or_default();
                println!(
                    "[Twitter] broadcastComments HTTP {} (page {}, base={}, broadcast_id={}): {}",
                    http_status,
                    page,
                    base,
                    broadcast_id,
                    &body[..body.len().min(300)]
                );
                continue;
            }

            match resp.json().await {
                Ok(v) => {
                    if sticky_base.is_none() {
                        println!(
                            "[Twitter] broadcastComments using host {} (broadcast_id={})",
                            base, broadcast_id
                        );
                        sticky_base = Some(base.to_string());
                    }
                    data = Some(v);
                    break;
                }
                Err(e) => {
                    println!(
                        "[Twitter] broadcastComments JSON error (page {}, base={}, broadcast_id={}): {}",
                        page, base, broadcast_id, e
                    );
                }
            }
        }

        let data = match data {
            Some(v) => v,
            None => break,
        };

        if page == 0 {
            println!(
                "[Twitter] broadcastComments keys (broadcast_id={}): {:?}",
                broadcast_id,
                data.as_object().map(|o| o.keys().collect::<Vec<_>>())
            );
        }

        // On the first page, log every unique event type to understand what's available
        if page == 0 {
            let empty2 = vec![];
            let all_comments_for_types = data
                .get("comments")
                .or_else(|| data.get("events"))
                .or_else(|| data.get("results"))
                .and_then(|v| v.as_array())
                .unwrap_or(&empty2);
            let mut type_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
            for c in all_comments_for_types {
                let t = c.get("type")
                    .map(|v| v.to_string())
                    .unwrap_or_else(|| "?".to_string());
                *type_counts.entry(t).or_insert(0) += 1;
            }
            let mut sorted_types: Vec<(String, usize)> = type_counts.into_iter().collect();
            sorted_types.sort_by(|a, b| b.1.cmp(&a.1));
            println!(
                "[Twitter] broadcastComments event type distribution (broadcast_id={}): {:?}",
                broadcast_id, sorted_types
            );
        }

        let empty = vec![];
        let comments = data
            .get("comments")
            .or_else(|| data.get("events"))
            .or_else(|| data.get("results"))
            .and_then(|v| v.as_array())
            .unwrap_or(&empty);

        let page_count = comments.len();
        let mut page_events = 0usize;

        for (i, comment) in comments.iter().enumerate() {
            if i < 5 && page == 0 {
                println!("[Twitter] Periscope event sample [{}]: {:?}", i, comment);
            }

            // Periscope events use either string names or integer type codes.
            // Integer codes (from Periscope open protocol):
            //   1 = chat, 2 = share, 3 = ping/heartbeat, 4 = participant_join,
            //   5 = participant_leave, 6 = verified_chat, 7 = screenshot,
            //   8 = ??, 9 = speaker_active/typing_active, 17 = host_speak,
            //   18 = admin_speak, 19 = guest_speak, 20 = mute, 21 = unmute
            let type_int = comment.get("type").and_then(|v| v.as_i64());
            let type_str = comment
                .get("type")
                .and_then(|v| v.as_str())
                .or_else(|| comment.get("kind").and_then(|v| v.as_str()))
                .or_else(|| comment.get("event_type").and_then(|v| v.as_str()))
                .unwrap_or("");

            // Join events are stage presence, not "who is talking" — including them
            // smears the timeline. Keep only speak/active-style events.
            let is_speaking_str = matches!(
                type_str,
                "typing_active"
                    | "speaking"
                    | "speaker_active"
                    | "SPEAKING"
                    | "speaker_join"
                    | "SPEAKER_JOIN"
            );
            // 9 = speaker_active / typing_active, 17–19 = host/admin/guest speak; 21 = unmute (weak signal)
            let is_speaking_int = matches!(type_int, Some(9) | Some(17) | Some(18) | Some(19) | Some(21));

            if !is_speaking_str && !is_speaking_int {
                continue;
            }

            let ts_ms = comment
                .get("timestamp_ms")
                .and_then(|v| v.as_i64())
                .or_else(|| comment.get("offset_ms").and_then(|v| v.as_i64()))
                .or_else(|| comment.get("created_at_ms").and_then(|v| v.as_i64()))
                .or_else(|| comment.get("timestamp").and_then(|v| v.as_i64()));

            let offset_secs = match ts_ms {
                Some(abs_ms) if abs_ms > 1_000_000_000_000 => {
                    (abs_ms - started_at_ms).max(0) as f64 / 1000.0
                }
                Some(rel_ms) => rel_ms as f64 / 1000.0,
                None => continue,
            };

            let uid = periscope_comment_user_id(comment);

            if let Some(uid) = uid {
                all_events.push((offset_secs, uid));
                page_events += 1;
            }
        }

        println!(
            "[Twitter] broadcastComments page {} (broadcast_id={}): {} total, {} speaker events",
            page, broadcast_id, page_count, page_events
        );

        let next_cursor = data
            .get("cursor")
            .or_else(|| data.get("next_cursor"))
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(String::from)
            .unwrap_or_default();

        if next_cursor.is_empty() || page_count == 0 {
            break;
        }
        cursor = next_cursor;
        page += 1;

        if page > 50 {
            println!("[Twitter] broadcastComments: safety limit (50 pages) reached");
            break;
        }
    }

    println!(
        "[Twitter] broadcastComments done (broadcast_id={}): {} total speaking events",
        broadcast_id,
        all_events.len()
    );
    all_events.sort_by(|a, b| {
        a.0.total_cmp(&b.0)
            .then_with(|| a.1.cmp(&b.1))
    });
    all_events
}

/// Convert Periscope (offset_secs, user_id) events into JSON timeline segments.
///
/// - Sorts and **clusters** events whose timestamps fall within `COALESCE_SECS` of the
///   cluster start (handles simultaneous speakers → **overlapping** segments).
/// - Merges adjacent intervals for the **same** user so we do not fragment needlessly.
fn build_speaker_timeline_from_events(
    events: &[(f64, String)],
    total_duration: f64,
    id_prefix: &str,
) -> Vec<Value> {
    if events.is_empty() || !total_duration.is_finite() || total_duration <= 0.0 {
        return Vec::new();
    }
    /// Events within this span of the cluster anchor are treated as one instant (crosstalk).
    const COALESCE_SECS: f64 = 0.12;

    let mut sorted: Vec<(f64, String)> = events.to_vec();
    sorted.sort_by(|a, b| a.0.total_cmp(&b.0).then_with(|| a.1.cmp(&b.1)));

    // Time-cluster: anchor at sorted[i].0; absorb all events with t - anchor <= COALESCE_SECS
    let mut groups: Vec<(f64, Vec<String>)> = Vec::new();
    let mut i = 0usize;
    while i < sorted.len() {
        let anchor = sorted[i].0;
        let mut seen = std::collections::HashSet::<String>::new();
        let mut users: Vec<String> = Vec::new();
        let mut j = i;
        while j < sorted.len() && sorted[j].0 - anchor <= COALESCE_SECS {
            if seen.insert(sorted[j].1.clone()) {
                users.push(sorted[j].1.clone());
            }
            j += 1;
        }
        if !users.is_empty() {
            groups.push((anchor, users));
        }
        i = j;
    }

    if groups.is_empty() {
        return Vec::new();
    }

    let mut raw: Vec<(f64, f64, String)> = Vec::new();
    for (idx, (t_start, uids)) in groups.iter().enumerate() {
        let t_start = t_start.clamp(0.0, total_duration);
        let t_end = groups
            .get(idx + 1)
            .map(|(next_t, _)| next_t.clamp(0.0, total_duration))
            .unwrap_or(total_duration)
            .max(t_start)
            .min(total_duration);
        for uid in uids {
            raw.push((t_start, t_end, uid.clone()));
        }
    }

    raw.sort_by(|a, b| {
        a.0.total_cmp(&b.0)
            .then_with(|| a.2.cmp(&b.2))
            .then_with(|| a.1.total_cmp(&b.1))
    });

    let mut merged: Vec<(f64, f64, String)> = Vec::new();
    for (s, e, u) in raw {
        let s = s.clamp(0.0, total_duration);
        let e = e.clamp(s, total_duration);
        if e <= s {
            continue;
        }
        if let Some(last) = merged.last_mut() {
            if last.2 == u && s <= last.1 + 1e-3 {
                last.1 = last.1.max(e);
                continue;
            }
        }
        merged.push((s, e, u));
    }

    merged
        .iter()
        .enumerate()
        .map(|(i, (start, end, uid))| {
            serde_json::json!({
                "id": format!("{}-{}", id_prefix, i),
                "speakerId": uid,
                "start": start,
                "end": end,
            })
        })
        .collect()
}

fn json_value_to_id_string(v: &Value) -> Option<String> {
    v.as_str()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .or_else(|| v.as_i64().map(|n| n.to_string()))
        .or_else(|| v.as_u64().map(|n| n.to_string()))
}

/// Pull a stable user key from a Periscope broadcastComments row (numeric id preferred).
fn periscope_comment_user_id(comment: &Value) -> Option<String> {
    comment
        .get("user_id")
        .and_then(json_value_to_id_string)
        .or_else(|| comment.get("sender_user_id").and_then(json_value_to_id_string))
        .or_else(|| comment.pointer("/user/id_str").and_then(json_value_to_id_string))
        .or_else(|| comment.pointer("/user/id").and_then(json_value_to_id_string))
        .or_else(|| comment.pointer("/sender/id").and_then(json_value_to_id_string))
        .or_else(|| comment.pointer("/payload/user/user_id").and_then(json_value_to_id_string))
        .or_else(|| comment.pointer("/payload/user/id").and_then(json_value_to_id_string))
        .or_else(|| {
            comment
                .pointer("/user/legacy/screen_name")
                .or_else(|| comment.pointer("/user/screen_name"))
                .and_then(|v| v.as_str())
                .map(|s| {
                    s.trim_start_matches('@')
                        .to_lowercase()
                        .chars()
                        .map(|c| if c.is_alphanumeric() { c } else { '_' })
                        .collect::<String>()
                })
        })
}

fn slugify_handle_for_match(s: &str) -> String {
    s.trim()
        .trim_start_matches('@')
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect::<String>()
        .trim_matches('_')
        .to_string()
}

/// Map a Periscope / raw timeline `speakerId` onto `participants[].id` when possible.
fn resolve_timeline_speaker_id(raw: &str, participants: &[Value]) -> Option<String> {
    let raw_trim = raw.trim();
    if raw_trim.is_empty() {
        return None;
    }
    let raw_slug = slugify_handle_for_match(raw_trim);

    for p in participants {
        let Some(id) = p.get("id").and_then(|v| v.as_str()) else {
            continue;
        };
        if id == raw_trim {
            return Some(id.to_string());
        }
        if let Some(u) = p.get("username").and_then(|v| v.as_str()) {
            if u.eq_ignore_ascii_case(raw_trim) {
                return Some(id.to_string());
            }
            if slugify_handle_for_match(u) == raw_slug {
                return Some(id.to_string());
            }
        }
        if let Some(name) = p.get("name").and_then(|v| v.as_str()) {
            let handle = name.strip_prefix('@').unwrap_or(name).trim();
            if handle.eq_ignore_ascii_case(raw_trim) {
                return Some(id.to_string());
            }
            if slugify_handle_for_match(handle) == raw_slug {
                return Some(id.to_string());
            }
        }
    }
    None
}

/// Align timeline segment `speakerId` with GraphQL roster ids for correct UI highlighting.
pub(crate) fn remap_timeline_speaker_ids_to_roster(timeline: &mut [Value], participants: &[Value]) {
    if participants.is_empty() {
        return;
    }
    let roster_ids: std::collections::HashSet<&str> = participants
        .iter()
        .filter_map(|p| p.get("id").and_then(|v| v.as_str()))
        .collect();
    for seg in timeline.iter_mut() {
        let Some(obj) = seg.as_object_mut() else {
            continue;
        };
        let Some(raw) = obj.get("speakerId").and_then(|v| v.as_str()) else {
            continue;
        };
        if roster_ids.contains(raw) {
            continue;
        }
        if let Some(resolved) = resolve_timeline_speaker_id(raw, participants) {
            obj.insert("speakerId".into(), Value::String(resolved));
        }
    }
}

/// Like `push_audio_space_role` but stops after `cap` entries (listeners can be unbounded).
fn push_audio_space_role_capped(
    participants_root: Option<&Value>,
    key: &str,
    role_key: &str,
    out: &mut Vec<Value>,
    seen: &mut HashSet<String>,
    cap: usize,
) {
    let Some(arr) = participants_root
        .and_then(|p| p.get(key))
        .and_then(|a| a.as_array())
    else {
        return;
    };
    let mut added = 0usize;
    for item in arr {
        if added >= cap {
            break;
        }
        let Some(obj) = item.as_object() else { continue };
        let Some(entry) = participant_from_audio_space_row(obj, role_key) else { continue };
        let id = entry.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if id.is_empty() || seen.contains(&id) {
            continue;
        }
        seen.insert(id);
        out.push(entry);
        added += 1;
    }
}

// Recording state management
#[derive(Debug)]
struct TwitterRecordingEntry {
    stop_tx: Option<oneshot::Sender<()>>,
    task: tokio::task::JoinHandle<()>,
    broadcast_id: String, // Store broadcast_id to allow lookup by broadcast
}

// Track recordings by session_id instead of broadcast_id to allow multiple sessions per broadcast
// This enables both temp viewer sessions (4-sec segments) and persistent auto-detect sessions
// to record the same broadcast simultaneously in different directories
static TWITTER_ACTIVE_RECORDINGS: Lazy<Arc<Mutex<HashMap<String, TwitterRecordingEntry>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Event payloads for frontend communication
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TwitterSegmentReadyPayload {
    streamer_id: String,
    session_id: String,
    broadcast_id: String,
    mint_id: String,
    segment: u32,
    path: String,
    duration: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TwitterRecorderLogPayload {
    streamer_id: String,
    broadcast_id: String,
    mint_id: String,
    message: String,
    level: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TwitterStreamEndedPayload {
    streamer_id: String,
    session_id: String,
    broadcast_id: String,
    mint_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TwitterRecorderExitPayload {
    streamer_id: String,
    session_id: String,
    broadcast_id: String,
    mint_id: String,
    code: Option<i32>,
}

/// Validate and normalize Twitter/X URL
/// 
/// # Arguments
/// * `url` - Twitter broadcast or Space URL (supports both x.com and twitter.com)
#[tauri::command]
pub fn validate_twitter_url(url: String) -> Result<String, String> {
    let normalized = normalize_twitter_url(&url);
    
    // Validate URL format
    if normalized.contains("/i/broadcasts/") || normalized.contains("/i/spaces/") {
        Ok(normalized)
    } else {
        Err("Invalid Twitter URL. Must be a broadcast or Space URL.".to_string())
    }
}

/// Start recording a Twitter broadcast or Space using yt-dlp
/// 
/// # Arguments
/// * `url` - Twitter broadcast or Space URL
/// * `streamer_id` - Unique identifier for the streamer
/// * `session_id` - Unique identifier for this recording session
#[tauri::command]
pub async fn start_twitter_recording(
    app: tauri::AppHandle,
    url: String,
    streamer_id: String,
    session_id: String,
    segment_duration_minutes: Option<u32>,
) -> Result<(), String> {
    let normalized_url = normalize_twitter_url(&url);
    
    // Extract broadcast/space ID for tracking
    let broadcast_id = extract_broadcast_id(&normalized_url)?;
    
    // Check if this specific session is already recording
    // Allow multiple sessions per broadcast (e.g., temp viewer + persistent auto-detect)
    if TWITTER_ACTIVE_RECORDINGS.lock().unwrap().contains_key(&session_id) {
        println!("[Twitter] Session {} already recording, skipping duplicate start", session_id);
        return Ok(());
    }
    
    let output_dir = storage::get_livestream_recordings_dir()?;
    let session_dir = output_dir.join(&session_id);
    std::fs::create_dir_all(&session_dir)
        .map_err(|e| format!("Failed to create session directory: {}", e))?;
    
    let segment_duration = segment_duration_minutes.unwrap_or(5);
    let (stop_tx, stop_rx) = oneshot::channel();
    
    let broadcast_clone = broadcast_id.clone();
    let streamer_clone = streamer_id.clone();
    let session_clone = session_id.clone();
    let output_str = session_dir.to_string_lossy().to_string();
    let app_handle = app.clone();
    
    let session_for_cleanup = session_id.clone();
    let task = tokio::spawn(async move {
        if let Err(err) = run_twitter_recorder(
            app_handle,
            normalized_url,
            broadcast_clone.clone(),
            streamer_clone,
            session_clone,
            output_str,
            segment_duration,
            stop_rx,
        ).await {
            eprintln!("[TwitterRecorder] {}", err);
        }
        
        // Cleanup by session_id (not broadcast_id) since we track by session now
        TWITTER_ACTIVE_RECORDINGS.lock().unwrap().remove(&session_for_cleanup);
    });
    
    // Insert by session_id (not broadcast_id) to allow multiple sessions per broadcast
    TWITTER_ACTIVE_RECORDINGS.lock().unwrap().insert(
        session_id.clone(),
        TwitterRecordingEntry {
            stop_tx: Some(stop_tx),
            task,
            broadcast_id,
        },
    );
    
    Ok(())
}

async fn run_twitter_recorder(
    app: tauri::AppHandle,
    url: String,
    broadcast_id: String,
    streamer_id: String,
    session_id: String,
    output_dir: String,
    segment_duration_minutes: u32,
    mut stop_rx: oneshot::Receiver<()>,
) -> Result<(), String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    let ffmpeg_path = resolve_ffmpeg_binary()?;
    
    // HLS segment duration in seconds
    // For Auto-Detect/Record: use user-configured segment duration (e.g., 5 minutes = 300 seconds)
    // For Watch mode (segment_duration_minutes <= 1): use 4-second segments for low-latency playback
    let hls_segment_seconds = if segment_duration_minutes <= 1 {
        4 // Low-latency mode for live watching
    } else {
        segment_duration_minutes * 60 // Convert minutes to seconds for recording
    };
    
    let playlist_path = PathBuf::from(&output_dir).join("playlist.m3u8");
    let segment_pattern = PathBuf::from(&output_dir).join("segment_%04d.ts");
    
    let mut ytdlp_cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut ytdlp_cmd);
    
    ytdlp_cmd
        .arg(&url)
        .arg("-o").arg("-")
        .arg("--quiet")
        .arg("--no-part")
        .arg("--impersonate").arg("chrome")
        .arg("--ffmpeg-location").arg(&ffmpeg_path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    
    let mut ytdlp_child = ytdlp_cmd.spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;
    
    let ytdlp_stdout = ytdlp_child.stdout.take()
        .ok_or("Failed to get yt-dlp stdout")?;
    
    if let Some(ytdlp_stderr) = ytdlp_child.stderr.take() {
        let broadcast_log = broadcast_id.clone();
        let streamer_log = streamer_id.clone();
        let app_log = app.clone();
        
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(ytdlp_stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                println!("[TwitterRecorder] yt-dlp: {}", line);
                let _ = app_log.emit("recorder-log", TwitterRecorderLogPayload {
                    streamer_id: streamer_log.clone(),
                    broadcast_id: broadcast_log.clone(),
                    mint_id: broadcast_log.clone(),
                    message: line,
                    level: "info".to_string(),
                });
            }
        });
    }
    
    let ytdlp_stdout_std: std::process::Stdio = ytdlp_stdout.try_into()
        .map_err(|e| format!("Failed to convert stdout: {}", e))?;
    
    let mut ffmpeg_cmd = tokio::process::Command::new(&ffmpeg_path);
    no_window(&mut ffmpeg_cmd);
    
    ffmpeg_cmd
        .arg("-i").arg("pipe:0")
        .arg("-c:v").arg("copy")
        .arg("-c:a").arg("copy")
        .arg("-f").arg("hls")
        .arg("-hls_time").arg(hls_segment_seconds.to_string())
        .arg("-hls_list_size").arg("0")
        .arg("-hls_flags").arg("append_list+omit_endlist+temp_file")
        .arg("-hls_segment_filename").arg(segment_pattern.to_string_lossy().to_string())
        .arg(playlist_path.to_string_lossy().to_string())
        .stdin(ytdlp_stdout_std)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped());
    
    let mut ffmpeg_child = ffmpeg_cmd.spawn()
        .map_err(|e| format!("Failed to spawn FFmpeg: {}", e))?;
    
    // Drain FFmpeg stderr in background - only log important lines to avoid flooding
    if let Some(ffmpeg_stderr) = ffmpeg_child.stderr.take() {
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(ffmpeg_stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                // Only log important FFmpeg lines to avoid flooding server logs
                let dominated = line.contains("Opening") || line.contains("Skip");
                if !dominated {
                    println!("[TwitterRecorder] FFmpeg: {}", line);
                }
            }
        });
    }
    
    let mut last_emitted_segment: u32 = 0;
    
    loop {
        tokio::select! {
            status = ffmpeg_child.wait() => {
                println!("[TwitterRecorder] FFmpeg exited: {:?}", status);
                let _ = ytdlp_child.kill().await;
                
                let exit_status = status.ok();
                let _ = app.emit("recorder-exit", TwitterRecorderExitPayload {
                    streamer_id: streamer_id.clone(),
                    session_id: session_id.clone(),
                    broadcast_id: broadcast_id.clone(),
                    mint_id: broadcast_id.clone(),
                    code: exit_status.as_ref().and_then(|s| s.code()),
                });
                
                // If FFmpeg exited unsuccessfully, stream likely ended
                if let Some(exit_status) = exit_status {
                    if !exit_status.success() {
                        let _ = app.emit("stream-ended", TwitterStreamEndedPayload {
                            streamer_id: streamer_id.clone(),
                            session_id: session_id.clone(),
                            broadcast_id: broadcast_id.clone(),
                            mint_id: broadcast_id.clone(),
                        });
                    }
                }
                
                break;
            }
            
            _ = &mut stop_rx => {
                println!("[TwitterRecorder] Stop signal received");
                let _ = ffmpeg_child.kill().await;
                let _ = ytdlp_child.kill().await;
                break;
            }
            
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(2)) => {
                // Sequential segment detection: check for the next expected segment
                // With +temp_file flag, FFmpeg writes to .tmp then renames to .ts when complete
                let next_segment_index = last_emitted_segment;
                let seg_path = PathBuf::from(&output_dir).join(format!("segment_{:04}.ts", next_segment_index));
                
                if seg_path.exists() {
                    // Verify file is stable (not still being written)
                    let size1 = std::fs::metadata(&seg_path).ok().map(|m| m.len());
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    let size2 = std::fs::metadata(&seg_path).ok().map(|m| m.len());
                    
                    if let (Some(s1), Some(s2)) = (size1, size2) {
                        if s1 == s2 && s1 > 0 {
                            println!("[TwitterRecorder] Segment {} ready (size: {} bytes)", next_segment_index, s1);
                            
                            let segment_number = next_segment_index + 1;
                            
                            let _ = app.emit("segment-ready", TwitterSegmentReadyPayload {
                                streamer_id: streamer_id.clone(),
                                session_id: session_id.clone(),
                                broadcast_id: broadcast_id.clone(),
                                mint_id: broadcast_id.clone(),
                                segment: segment_number,
                                path: seg_path.to_string_lossy().to_string(),
                                duration: hls_segment_seconds as f64,
                            });
                            
                            last_emitted_segment = segment_number;
                        }
                    }
                }
            }
        }
    }
    
    Ok(())
}

/// Stop recording a Twitter broadcast or Space
/// Stops ALL sessions recording this broadcast (both temp viewer and persistent auto-detect)
#[tauri::command]
pub async fn stop_twitter_recording(url: String) -> Result<(), String> {
    let normalized_url = normalize_twitter_url(&url);
    let broadcast_id = extract_broadcast_id(&normalized_url)?;
    
    // Find all sessions recording this broadcast and collect their entries
    let entries: Vec<(String, TwitterRecordingEntry)> = {
        let mut recordings = TWITTER_ACTIVE_RECORDINGS.lock().unwrap();
        let session_ids: Vec<String> = recordings
            .iter()
            .filter(|(_, entry)| entry.broadcast_id == broadcast_id)
            .map(|(session_id, _)| session_id.clone())
            .collect();

        session_ids
            .into_iter()
            .filter_map(|session_id| {
                recordings.remove(&session_id).map(|entry| (session_id, entry))
            })
            .collect()
    };
    
    for (session_id, mut entry) in entries {
        if let Some(stop_tx) = entry.stop_tx.take() {
            let _ = stop_tx.send(());
        }
        if let Err(err) = entry.task.await {
            eprintln!("[TwitterRecorder] Join error for session {}: {}", session_id, err);
        }
    }
    
    Ok(())
}

/// Stop a specific Twitter recording session by session_id
/// Unlike stop_twitter_recording which stops ALL sessions for a broadcast,
/// this only stops the one specific session, leaving others untouched.
#[tauri::command]
pub async fn stop_twitter_recording_session(session_id: String) -> Result<(), String> {
    let entry_opt = {
        let mut recordings = TWITTER_ACTIVE_RECORDINGS.lock().unwrap();
        recordings.remove(&session_id)
    };

    if let Some(mut entry) = entry_opt {
        if let Some(stop_tx) = entry.stop_tx.take() {
            let _ = stop_tx.send(());
        }
        if let Err(err) = entry.task.await {
            eprintln!("[TwitterRecorder] Join error for session {}: {}", session_id, err);
        }
        println!("[TwitterRecorder] Stopped session: {}", session_id);
    } else {
        println!("[TwitterRecorder] No active session found for: {}", session_id);
    }

    Ok(())
}

/// Stop all active Twitter recordings
#[tauri::command]
pub async fn stop_all_twitter_recordings() -> Result<(), String> {
    let entries: Vec<(String, TwitterRecordingEntry)> = {
        let mut recordings = TWITTER_ACTIVE_RECORDINGS.lock().unwrap();
        recordings.drain().collect()
    };
    
    for (session_id, mut entry) in entries {
        if let Some(stop_tx) = entry.stop_tx.take() {
            let _ = stop_tx.send(());
        }
        if let Err(err) = entry.task.await {
            eprintln!("[TwitterRecorder] Join error for session {}: {}", session_id, err);
        }
    }
    
    Ok(())
}

/// Get the output directory for a Twitter recording session
#[tauri::command]
pub fn get_twitter_session_output_dir(session_id: String) -> Result<String, String> {
    let output_dir = storage::get_livestream_recordings_dir()?;
    let session_dir = output_dir.join(&session_id);
    Ok(session_dir.to_string_lossy().to_string())
}

/// Get list of active Twitter recording session IDs
#[tauri::command]
pub fn get_active_twitter_recordings() -> Result<Vec<String>, String> {
    let recordings = TWITTER_ACTIVE_RECORDINGS.lock().unwrap();
    Ok(recordings.keys().cloned().collect())
}

/// Check if a Twitter recording is currently active for a broadcast
#[tauri::command]
pub fn is_twitter_recording_active(url: String) -> bool {
    let normalized_url = normalize_twitter_url(&url);
    if let Ok(broadcast_id) = extract_broadcast_id(&normalized_url) {
        TWITTER_ACTIVE_RECORDINGS
            .lock()
            .unwrap()
            .values()
            .any(|entry| entry.broadcast_id == broadcast_id)
    } else {
        false
    }
}

/// Get metadata for a Twitter broadcast/space using yt-dlp
#[tauri::command]
pub async fn get_twitter_broadcast_info(url: String) -> Result<String, String> {
    let ytdlp_path = resolve_ytdlp_binary()?;
    let normalized_url = normalize_twitter_url(&url);
    
    println!("[Twitter] Fetching metadata for URL: {}", normalized_url);
    
    let mut cmd = tokio::process::Command::new(&ytdlp_path);
    no_window(&mut cmd);
    
    cmd.arg("--dump-json")
        .arg("--skip-download")
        .arg("--verbose")
        .arg("--impersonate").arg("chrome")
        .arg(&normalized_url);
    
    let output = cmd.output().await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;
    
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    
    // Log stderr for debugging (yt-dlp writes verbose output to stderr)
    if !stderr.is_empty() {
        println!("[Twitter] yt-dlp stderr: {}", stderr);
    }
    
    if !output.status.success() {
        eprintln!("[Twitter] yt-dlp failed with exit code: {:?}", output.status.code());
        eprintln!("[Twitter] stderr: {}", stderr);
        return Err(format!("yt-dlp failed: {}", stderr));
    }
    
    if stdout.trim().is_empty() {
        eprintln!("[Twitter] yt-dlp returned empty stdout");
        eprintln!("[Twitter] stderr: {}", stderr);
        return Err("No metadata returned from yt-dlp. The broadcast may be unavailable or expired.".to_string());
    }
    
    println!("[Twitter] Successfully fetched metadata ({} bytes)", stdout.len());

    let mut metadata: Value = serde_json::from_str(stdout.trim()).map_err(|e| {
        format!("yt-dlp returned invalid JSON: {}", e)
    })?;

    // Spaces: enrich metadata with GraphQL roster + build speaker timeline.
    if normalized_url.contains("/i/spaces/") {
        if let Ok(space_id) = extract_broadcast_id(&normalized_url) {

            // ── Resolve media_key unconditionally from HLS URL first ─────────────────
            // This works even if the GraphQL call below fails.
            // yt-dlp always gives us the HLS URL in `url` field containing
            // `playlist_{broadcast_id}.m3u8`.  We construct `1_{broadcast_id}` as the
            // Periscope/Twitter media_key needed for live_video_stream/status.
            let hls_derived_media_key: Option<String> = {
                let hls_url = metadata
                    .get("url").or_else(|| metadata.get("manifest_url"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                hls_url.find("playlist_").and_then(|pos| {
                    let rest = &hls_url[pos + 9..];
                    let end = rest.find('.').unwrap_or(rest.len());
                    let numeric = &rest[..end];
                    if numeric.chars().all(|c| c.is_ascii_digit()) && !numeric.is_empty() {
                        let mk = format!("1_{}", numeric);
                        println!("[Twitter] HLS-derived media_key: {}", mk);
                        Some(mk)
                    } else {
                        None
                    }
                })
            };

            // ── Resolve started_at_secs from yt-dlp (no GraphQL needed) ──────────────
            let ytdlp_started_at_secs: i64 = metadata
                .get("timestamp").and_then(|v| v.as_i64())
                .or_else(|| metadata.get("release_timestamp").and_then(|v| v.as_i64()))
                .unwrap_or(0);
            println!("[Twitter] yt-dlp started_at_secs: {}", ytdlp_started_at_secs);

            // Inject media_key now so it's always present in the returned JSON
            if let Some(ref mk) = hls_derived_media_key {
                metadata["mediaKey"] = Value::String(mk.clone());
            }

            let periscope_ids_first: Vec<String> =
                hls_derived_media_key.clone().into_iter().collect();
            match fetch_audio_space_full(&space_id, &periscope_ids_first).await {
                Ok(space_data) => {
                    if !space_data.participants.is_empty() {
                        println!(
                            "[Twitter] Merged AudioSpace GraphQL roster: {} participants",
                            space_data.participants.len()
                        );
                        metadata["participants"] = Value::Array(space_data.participants);
                    } else {
                        println!("[Twitter] AudioSpace GraphQL returned empty participant lists");
                    }

                    // Prefer GraphQL started_at; fall back to yt-dlp value
                    let started_at_secs = space_data.started_at_secs
                        .unwrap_or(ytdlp_started_at_secs);
                    println!("[Twitter] started_at_secs resolved to: {}", started_at_secs);

                    // Prefer GraphQL media_key; fall back to HLS-derived one (already set above)
                    let effective_media_key = space_data.media_key.clone()
                        .or_else(|| hls_derived_media_key.clone());
                    println!("[Twitter] effective_media_key={:?}", effective_media_key);

                    // Duration from yt-dlp metadata (seconds); may be null for Spaces
                    let duration_secs = metadata
                        .get("duration")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.0);
                    let total_duration = if duration_secs > 0.0 { duration_secs } else { 3600.0 };

                    let mut speaker_timeline: Vec<Value> = Vec::new();

                    // ── Priority 1: Periscope broadcastComments speaker events ──────────────
                    // access_token was obtained via accessVideoPublic (no Twitter auth needed)
                    // during fetch_audio_space_full and stored in space_data.chat_token.
                    if let (Some(ref mk), Some(ref tok)) = (&effective_media_key, &space_data.chat_token) {
                        let events = fetch_periscope_speaking_events(
                            mk,
                            tok,
                            started_at_secs * 1000,
                            &periscope_ids_first,
                        )
                        .await;
                        if !events.is_empty() {
                            println!(
                                "[Twitter] Building timeline from {} Periscope speaking events",
                                events.len()
                            );
                            speaker_timeline =
                                build_speaker_timeline_from_events(&events, total_duration, "ps");
                        }
                    }

                    // ── Priority 2: accessVideoPublic retry if no chatToken yet ──────────────
                    // Happens when fetch_audio_space_full didn't have a media_key yet
                    // (GraphQL failed to return it) but we do now via hls_derived_media_key.
                    if speaker_timeline.is_empty() {
                        if let (Some(ref mk), None) = (&effective_media_key, &space_data.chat_token) {
                            if let Ok(tok) = fetch_periscope_access_video(
                                &periscope_ids_first,
                                Some(mk.as_str()),
                                Some(&space_id),
                            )
                            .await
                            {
                                println!("[Twitter] Got Periscope access_token (Priority 2 retry)");
                                let events = fetch_periscope_speaking_events(
                                    mk,
                                    &tok,
                                    started_at_secs * 1000,
                                    &periscope_ids_first,
                                )
                                .await;
                                speaker_timeline =
                                    build_speaker_timeline_from_events(&events, total_duration, "rt");
                            }
                        }
                    }

                    // ── Priority 3: Stage-join timestamps → stageJoinHints only ──────────
                    // Stage-join data tells us WHEN someone joined the stage, NOT when they
                    // were actually speaking.  Creating fake sequential talking segments from
                    // join order is wrong (e.g. person who joined at t=198 is NOT necessarily
                    // talking from t=198 until the next person joins at t=965).
                    // Instead, we store the join hints so that diarization (or HLS ID3) can
                    // use them for mapping speaker labels to participant IDs.
                    if speaker_timeline.is_empty() && !space_data.stage_join_times.is_empty() {
                        println!(
                            "[Twitter] Stage-join data available ({} participants) — stored as hints only (no fake timeline)",
                            space_data.stage_join_times.len()
                        );
                        let mut joins = space_data.stage_join_times.clone();
                        joins.sort_by(|a, b| a.1.cmp(&b.1));

                        let base_secs = if started_at_secs > 0 {
                            started_at_secs
                        } else {
                            joins.first().map(|(_, t)| *t).unwrap_or(0)
                        };

                        let mut hints = Vec::new();
                        for (uid, join_secs) in &joins {
                            let approx = ((join_secs - base_secs).max(0) as f64).min(total_duration);
                            println!("[Twitter] Stage-join hint: id={} approxJoinSec={:.1}", uid, approx);
                            hints.push(serde_json::json!({
                                "speakerId": uid,
                                "approxJoinSec": approx,
                            }));
                        }
                        metadata["stageJoinHints"] = serde_json::Value::Array(hints);
                        // speaker_timeline intentionally left empty — diarization or HLS
                        // ID3 extraction should provide the actual talking data.
                    }

                    // Priority 4 intentionally removed — equal-distribution fake segments
                    // produce the same kind of wrong attribution as stage-join fallback.

                    if !speaker_timeline.is_empty() {
                        if let Some(arr) = metadata.get("participants").and_then(|v| v.as_array()) {
                            remap_timeline_speaker_ids_to_roster(&mut speaker_timeline, arr);
                        }
                        println!("[Twitter] Speaker timeline: {} segments", speaker_timeline.len());
                        metadata["speakerTimeline"] = Value::Array(speaker_timeline);
                    } else {
                        println!("[Twitter] No speaker timeline could be built");
                    }
                }
                Err(e) => {
                    eprintln!(
                        "[Twitter] AudioSpace GraphQL enrich failed (continuing with yt-dlp only): {}",
                        e
                    );
                    // Even without GraphQL, try Periscope using HLS-derived media_key.
                    // accessVideoPublic requires no Twitter auth — works for any public replay.
                    if let Some(ref mk) = hls_derived_media_key {
                        if let Ok(tok) =
                            fetch_periscope_access_video(&[], Some(mk.as_str()), Some(&space_id)).await
                        {
                            let events = fetch_periscope_speaking_events(
                                mk,
                                &tok,
                                ytdlp_started_at_secs * 1000,
                                &periscope_ids_first,
                            )
                            .await;
                            if !events.is_empty() {
                                let duration_secs =
                                    metadata.get("duration").and_then(|v| v.as_f64()).unwrap_or(0.0);
                                let total_duration =
                                    if duration_secs > 0.0 { duration_secs } else { 3600.0 };
                                let mut timeline = build_speaker_timeline_from_events(
                                    &events,
                                    total_duration,
                                    "p",
                                );
                                if !timeline.is_empty() {
                                    if let Some(arr) =
                                        metadata.get("participants").and_then(|v| v.as_array())
                                    {
                                        remap_timeline_speaker_ids_to_roster(&mut timeline, arr);
                                    }
                                    println!(
                                        "[Twitter] (fallback) speakerTimeline injected: {} segments",
                                        timeline.len()
                                    );
                                    metadata["speakerTimeline"] = Value::Array(timeline);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    serde_json::to_string(&metadata).map_err(|e| format!("metadata serialize: {}", e))
}

/// Get duration for a Twitter broadcast using yt-dlp + ffprobe
/// First extracts the direct stream URL using yt-dlp, then uses ffprobe to get duration
#[tauri::command]
pub async fn get_twitter_broadcast_duration(_app: tauri::AppHandle, manifest_url: String) -> Result<f64, String> {
    println!("[Twitter] Getting duration for URL: {}", manifest_url);
    
    // Step 1: Use yt-dlp to extract the direct stream URL
    let ytdlp_path = resolve_ytdlp_binary()?;
    
    println!("[Twitter] Extracting stream URL via yt-dlp...");
    let ytdlp_output = no_window(
        tokio::process::Command::new(&ytdlp_path)
            .arg("--get-url")
            .arg("--no-download")
            .arg("--no-warnings")
            .arg("--impersonate").arg("chrome")
            .arg(&manifest_url)
    )
    .output()
    .await
    .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;
    
    if !ytdlp_output.status.success() {
        let stderr = String::from_utf8_lossy(&ytdlp_output.stderr);
        return Err(format!("yt-dlp failed to extract stream URL: {}", stderr.chars().take(300).collect::<String>()));
    }
    
    let stream_url = String::from_utf8_lossy(&ytdlp_output.stdout).trim().to_string();
    if stream_url.is_empty() {
        return Err("yt-dlp returned empty stream URL".to_string());
    }
    
    println!("[Twitter] Got stream URL, probing duration with ffprobe...");
    
    // Step 2: Use ffprobe on the direct stream URL
    let ffprobe_path = resolve_sidecar_binary("ffprobe")?;
    
    let mut cmd = tokio::process::Command::new(&ffprobe_path);
    no_window(&mut cmd);
    
    let output = cmd
        .args([
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            &stream_url
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffprobe failed: {}", stderr));
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let duration_str = stdout.trim();
    
    println!("[Twitter] ffprobe duration output: {}", duration_str);
    
    if duration_str.is_empty() || duration_str == "N/A" {
        return Err("Duration not available".to_string());
    }
    
    duration_str.parse::<f64>()
        .map_err(|e| format!("Failed to parse duration: {}", e))
}

/// Download Twitter broadcast thumbnail and return as data URL
#[tauri::command]
pub async fn download_twitter_thumbnail(thumbnail_url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    let response = client.get(&thumbnail_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download thumbnail: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }
    
    let content_type = response.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();
    
    let bytes = response.bytes()
        .await
        .map_err(|e| format!("Failed to read thumbnail bytes: {}", e))?;
    
    let base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", content_type, base64))
}

/// Download a Twitter broadcast using yt-dlp
#[tauri::command]
pub async fn download_twitter_vod(
    app: tauri::AppHandle,
    download_id: String,
    title: String,
    vod_url: String,
    broadcast_id: String,
) -> Result<(), String> {
    use crate::downloads::{ACTIVE_DOWNLOADS, ACTIVE_DOWNLOAD_CANCELLERS, DOWNLOAD_METADATA, DownloadMetadata, DownloadResult, DownloadProgress};
    
    let ytdlp_path = resolve_ytdlp_binary()?;
    let ffmpeg_path = resolve_ffmpeg_binary()?;
    
    // Check if download already exists
    {
        let mut downloads = ACTIVE_DOWNLOADS.lock().unwrap();
        if downloads.contains_key(&download_id) {
            println!("[Twitter] Download already in progress: {}", download_id);
            return Err("Download already in progress".to_string());
        }
        downloads.insert(download_id.clone(), true);
    }

    // Resolve output path from storage
    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let safe_title = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    let filename = format!("twitter_{}_{}_{}.mp4", broadcast_id, safe_title, timestamp);
    let output_file = paths.videos.join(&filename);
    
    // Clean up when done
    let cleanup_download = {
        let download_id = download_id.clone();
        let downloads = ACTIVE_DOWNLOADS.clone();
        move || {
            println!("[Twitter] Cleaning up download: {}", download_id);
            let mut downloads = downloads.lock().unwrap();
            downloads.remove(&download_id);
        }
    };
    
    let (cancel_tx, mut cancel_rx) = oneshot::channel::<()>();
    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.insert(download_id.clone(), cancel_tx);
    }
    
    let download_id_clone = download_id.clone();
    let app_clone = app.clone();
    let output_file_str = output_file.to_string_lossy().to_string();

    // Store download metadata
    {
        let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
        metadata_map.insert(download_id.clone(), DownloadMetadata {
            output_path: Some(output_file_str.clone()),
            thumbnail_path: None,
            started_at: std::time::SystemTime::now(),
            process_id: None,
        });
    }
    
    // Fetch video duration for time-based progress
    println!("[Twitter] Fetching video duration for {}", broadcast_id);
    let total_duration = match get_twitter_broadcast_info(vod_url.clone()).await {
        Ok(json_str) => {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&json_str) {
                json.get("duration").and_then(|d| d.as_f64())
            } else {
                None
            }
        }
        Err(e) => {
            println!("[Twitter] Failed to fetch duration: {}", e);
            None
        }
    };
    
    if let Some(dur) = total_duration {
        println!("[Twitter] Video duration: {:.2}s", dur);
    }
    
    // Send initial progress
    let _ = app.emit("download-progress", DownloadProgress {
        download_id: download_id.clone(),
        progress: 0.0,
        current_time: None,
        total_time: total_duration,
        status: "Starting download...".to_string(),
    });
    
    tokio::spawn(async move {
        let mut cmd = tokio::process::Command::new(&ytdlp_path);
        no_window(&mut cmd);
        
        // yt-dlp --ffmpeg-location expects a DIRECTORY so it can find both ffmpeg and ffprobe
        let ffmpeg_dir = std::path::Path::new(&ffmpeg_path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ffmpeg_path.clone());
        
        cmd.arg(&vod_url)
            .arg("-o").arg(&output_file_str)
            .arg("--impersonate").arg("chrome")
            .arg("--ffmpeg-location").arg(&ffmpeg_dir)
            .arg("--format").arg("bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best")
            .arg("--concurrent-fragments").arg("16")  // 16x parallel downloads for speed
            .arg("--merge-output-format").arg("mp4")
            .arg("--newline")
            .arg("--progress")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                cleanup_download();
                let _ = app_clone.emit("download-error", DownloadResult {
                    download_id: download_id_clone.clone(),
                    success: false,
                    file_path: None,
                    thumbnail_path: None,
                    duration: None,
                    width: None,
                    height: None,
                    codec: None,
                    file_size: None,
                    error: Some(format!("Failed to spawn yt-dlp: {}", e)),
                });
                return;
            }
        };
        
        let stdout = child.stdout.take().expect("Failed to get stdout");
        let stderr = child.stderr.take().expect("Failed to get stderr");
        
        use tokio::io::{AsyncBufReadExt, BufReader};
        let mut stdout_reader = BufReader::new(stdout).lines();
        let mut stderr_reader = BufReader::new(stderr).lines();
        
        loop {
            tokio::select! {
                _ = &mut cancel_rx => {
                    println!("[Twitter] Download cancelled: {}", download_id_clone);
                    let _ = child.kill().await;
                    cleanup_download();
                    let _ = app_clone.emit("download-error", DownloadResult {
                        download_id: download_id_clone.clone(),
                        success: false,
                        file_path: None,
                        thumbnail_path: None,
                        duration: None,
                        width: None,
                        height: None,
                        codec: None,
                        file_size: None,
                        error: Some("Download cancelled".to_string()),
                    });
                    return;
                }
                line = stdout_reader.next_line() => {
                    match line {
                        Ok(Some(line)) => {
                            // Log all stdout for debugging
                            println!("[Twitter] yt-dlp: {}", line);
                            
                            if line.contains("[download]") && line.contains("%") {
                                if let Some(percent_str) = line.split_whitespace()
                                    .find(|s| s.ends_with('%'))
                                    .and_then(|s| s.trim_end_matches('%').parse::<f64>().ok())
                                {
                                    // Calculate current time from percentage if we have total duration
                                    let current_time = total_duration.map(|dur| (percent_str / 100.0) * dur);
                                    
                                    let _ = app_clone.emit("download-progress", DownloadProgress {
                                        download_id: download_id_clone.clone(),
                                        progress: percent_str,
                                        current_time,
                                        total_time: total_duration,
                                        status: format!("Downloading... {}%", percent_str as u32),
                                    });
                                }
                            }
                        }
                        Ok(None) => break,
                        Err(_) => break,
                    }
                }
                line = stderr_reader.next_line() => {
                    if let Ok(Some(line)) = line {
                        println!("[Twitter] yt-dlp stderr: {}", line);
                        
                        // Parse FFmpeg progress output: out_time=HH:MM:SS.MS
                        if line.starts_with("out_time=") && total_duration.is_some() {
                            if let Some(time_str) = line.strip_prefix("out_time=") {
                                // Parse time format HH:MM:SS.MS or -577014:32:22.775807 (invalid)
                                if !time_str.starts_with('-') {
                                    let parts: Vec<&str> = time_str.split(':').collect();
                                    if parts.len() == 3 {
                                        if let (Ok(hours), Ok(mins), Ok(secs)) = (
                                            parts[0].parse::<f64>(),
                                            parts[1].parse::<f64>(),
                                            parts[2].parse::<f64>()
                                        ) {
                                            let current_time = hours * 3600.0 + mins * 60.0 + secs;
                                            let total_dur = total_duration.unwrap();
                                            let progress = (current_time / total_dur * 100.0).min(100.0);
                                            
                                            let _ = app_clone.emit("download-progress", DownloadProgress {
                                                download_id: download_id_clone.clone(),
                                                progress,
                                                current_time: Some(current_time),
                                                total_time: total_duration,
                                                status: format!("Downloading... {}%", progress as u32),
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        let status = child.wait().await;
        cleanup_download();
        
        match status {
            Ok(exit_status) if exit_status.success() => {
                // Get file metadata
                let file_size = std::fs::metadata(&output_file_str).ok().map(|m| m.len());
                
                // Generate thumbnail using hybrid approach (yt-dlp first, FFmpeg fallback)
                println!("[Twitter] Generating thumbnail...");
                let thumbnail_path = paths.thumbnails.join(format!("{}_thumb.jpg", filename.replace(".mp4", "")));
                
                let thumbnail_path_str = match generate_thumbnail_hybrid(
                    &ytdlp_path,
                    &ffmpeg_path,
                    &vod_url,
                    &thumbnail_path,
                    "00:00:05",
                ).await {
                    Ok(()) => {
                        println!("[Twitter] Thumbnail generated: {}", thumbnail_path.display());
                        Some(thumbnail_path.to_string_lossy().to_string())
                    }
                    Err(e) => {
                        println!("[Twitter] Thumbnail generation failed: {}", e);
                        None
                    }
                };
                
                // Get video info
                println!("[Twitter] Getting video info...");
                let video_path = std::path::Path::new(&output_file_str);
                let video_info = crate::ffmpeg_utils::get_video_info(&app_clone, video_path).await.ok();
                let (width, height, codec, duration) = if let Some(ref info) = video_info {
                    println!("[Twitter] Video info - width: {}, height: {}, codec: {}, duration: {:?}", 
                        info.width, info.height, info.codec, info.duration);
                    (Some(info.width), Some(info.height), Some(info.codec.clone()), info.duration)
                } else {
                    println!("[Twitter] Could not get video info");
                    (None, None, None, None)
                };
                
                let _ = app_clone.emit("download-complete", DownloadResult {
                    download_id: download_id_clone,
                    success: true,
                    file_path: Some(output_file_str.clone()),
                    thumbnail_path: thumbnail_path_str,
                    duration,
                    width,
                    height,
                    codec,
                    file_size,
                    error: None,
                });
            }
            _ => {
                let _ = app_clone.emit("download-error", DownloadResult {
                    download_id: download_id_clone,
                    success: false,
                    file_path: None,
                    thumbnail_path: None,
                    duration: None,
                    width: None,
                    height: None,
                    codec: None,
                    file_size: None,
                    error: Some("Download failed".to_string()),
                });
            }
        }
    });
    
    Ok(())
}

// Helper functions

/// Normalize Twitter/X URL to twitter.com format for yt-dlp compatibility
fn normalize_twitter_url(url: &str) -> String {
    url.trim()
        .replace("x.com", "twitter.com")
        .replace("https://twitter.com", "https://twitter.com") // Ensure https
}

/// Extract broadcast or space ID from URL
fn extract_broadcast_id(url: &str) -> Result<String, String> {
    // Strip query string and fragment before extracting the ID segment
    let clean = url.split('?').next().unwrap_or(url).split('#').next().unwrap_or(url);
    if let Some(broadcast_part) = clean.split("/i/broadcasts/").nth(1) {
        Ok(broadcast_part.split('/').next().unwrap_or("").to_string())
    } else if let Some(space_part) = clean.split("/i/spaces/").nth(1) {
        Ok(space_part.split('/').next().unwrap_or("").to_string())
    } else {
        Err("Could not extract broadcast/space ID from URL".to_string())
    }
}

/// Resolve a sidecar binary path using Tauri's naming convention.
/// Tauri places sidecars next to the executable with -{target_triple} suffix.
/// In dev mode, they're in src-tauri/binaries/ with the same naming.
fn resolve_sidecar_binary(base_name: &str) -> Result<String, String> {
    let exe_path =
        std::env::current_exe().map_err(|e| format!("Failed to get executable path: {}", e))?;

    let exe_dir = exe_path.parent().ok_or("Failed to get parent directory")?;

    let target_triple = get_target_triple();

    #[cfg(target_os = "windows")]
    let binary_name = format!("{}-{}.exe", base_name, target_triple);

    #[cfg(not(target_os = "windows"))]
    let binary_name = format!("{}-{}", base_name, target_triple);

    // Production: sidecar is next to the executable
    let prod_path = exe_dir.join(&binary_name);
    if prod_path.exists() {
        println!(
            "[Twitter] Found {} at (prod): {}",
            base_name,
            prod_path.display()
        );
        return Ok(prod_path.to_string_lossy().to_string());
    }

    // macOS production bundle: Tauri strips the target triple from sidecar names
    #[cfg(target_os = "windows")]
    let bare_name = format!("{}.exe", base_name);
    #[cfg(not(target_os = "windows"))]
    let bare_name = base_name.to_string();

    let bare_path = exe_dir.join(&bare_name);
    if bare_path.exists() {
        println!(
            "[Twitter] Found {} at (bundle): {}",
            base_name,
            bare_path.display()
        );
        return Ok(bare_path.to_string_lossy().to_string());
    }

    // Development mode: check src-tauri/binaries/
    if let Some(target_dir) = exe_dir.parent() {
        if let Some(target_parent) = target_dir.parent() {
            let dev_path = target_parent.join("binaries").join(&binary_name);
            if dev_path.exists() {
                println!(
                    "[Twitter] Found {} at (dev): {}",
                    base_name,
                    dev_path.display()
                );
                return Ok(dev_path.to_string_lossy().to_string());
            }
        }
    }

    // Fallback to system PATH
    #[cfg(target_os = "windows")]
    let fallback = format!("{}.exe", base_name);

    #[cfg(not(target_os = "windows"))]
    let fallback = base_name.to_string();

    println!(
        "[Twitter] {} not found in bundle, falling back to PATH: {}",
        base_name, fallback
    );
    Ok(fallback)
}

fn get_target_triple() -> &'static str {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    return "x86_64-pc-windows-msvc";

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    return "x86_64-apple-darwin";

    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    return "aarch64-apple-darwin";

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    return "x86_64-unknown-linux-gnu";

    #[cfg(not(any(
        all(target_os = "windows", target_arch = "x86_64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "linux", target_arch = "x86_64")
    )))]
    compile_error!("Unsupported platform - only x86_64 Windows/Linux and x86_64/aarch64 macOS are supported");
}

fn resolve_ytdlp_binary() -> Result<String, String> {
    resolve_sidecar_binary("yt-dlp")
}

fn resolve_ffmpeg_binary() -> Result<String, String> {
    resolve_sidecar_binary("ffmpeg")
}

fn format_time_for_filename(seconds: f64) -> String {
    let h = (seconds / 3600.0) as u32;
    let m = ((seconds % 3600.0) / 60.0) as u32;
    let s = (seconds % 60.0) as u32;
    format!("{:02}{:02}{:02}", h, m, s)
}

/// Download a segment of a Twitter VOD using yt-dlp with time range
#[tauri::command]
pub async fn download_twitter_vod_segment(
    app: tauri::AppHandle,
    download_id: String,
    title: String,
    vod_url: String,
    broadcast_id: String,
    start_time: f64,
    end_time: f64,
) -> Result<(), String> {
    use crate::downloads::{ACTIVE_DOWNLOADS, ACTIVE_DOWNLOAD_CANCELLERS, DOWNLOAD_METADATA, DownloadMetadata, DownloadResult, DownloadProgress};
    
    println!("[Twitter] download_twitter_vod_segment called");
    
    if start_time < 0.0 || end_time <= start_time {
        return Err("Invalid time range specified".to_string());
    }

    let segment_duration = end_time - start_time;
    if segment_duration < 10.0 {
        return Err("Segment too short (minimum 10 seconds)".to_string());
    }

    {
        let mut downloads = ACTIVE_DOWNLOADS.lock().unwrap();
        if downloads.contains_key(&download_id) {
            return Err("Download already in progress".to_string());
        }
        downloads.insert(download_id.clone(), true);
    }

    let cleanup_download = {
        let download_id = download_id.clone();
        let downloads = ACTIVE_DOWNLOADS.clone();
        move || {
            let mut downloads = downloads.lock().unwrap();
            downloads.remove(&download_id);
        }
    };

    let paths = crate::storage::init_storage_dirs()
        .map_err(|e| format!("Failed to get storage paths: {}", e))?;

    let safe_title = title.chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_secs();

    let start_formatted = format_time_for_filename(start_time);
    let end_formatted = format_time_for_filename(end_time);

    let filename = format!("twitter_{}_{}_{}_{}_{}.mp4", broadcast_id, safe_title, start_formatted, end_formatted, timestamp);
    let video_path = paths.videos.join(&filename);

    {
        let mut metadata_map = DOWNLOAD_METADATA.lock().unwrap();
        metadata_map.insert(download_id.clone(), DownloadMetadata {
            output_path: Some(video_path.to_string_lossy().to_string()),
            thumbnail_path: None,
            started_at: std::time::SystemTime::now(),
            process_id: None,
        });
    }

    let _ = app.emit("download-progress", DownloadProgress {
        download_id: download_id.clone(),
        progress: 0.0,
        current_time: Some(0.0),
        total_time: Some(segment_duration),
        status: "Starting Twitter segment download...".to_string(),
    });

    let app_clone = app.clone();
    let download_id_clone = download_id.clone();

    let (cancel_tx, mut cancel_rx) = oneshot::channel();
    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.insert(download_id.clone(), cancel_tx);
    }

    let result = tokio::spawn(async move {
        let ytdlp_path = resolve_ytdlp_binary()?;
        let ffmpeg_path = resolve_ffmpeg_binary()?;
        let video_path_str = video_path.to_string_lossy().to_string();

        let section_arg = format!("*{:.0}-{:.0}", start_time, end_time);

        let mut cmd = tokio::process::Command::new(&ytdlp_path);
        no_window(&mut cmd);
        let ffmpeg_dir = std::path::Path::new(&ffmpeg_path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ffmpeg_path.clone());
        cmd.arg(&vod_url)
            .arg("-o").arg(&video_path_str)
            .arg("--impersonate").arg("chrome")
            .arg("--ffmpeg-location").arg(&ffmpeg_dir)
            .arg("--format").arg("bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best")
            .arg("--concurrent-fragments").arg("16")  // 16x parallel downloads for speed
            .arg("--merge-output-format").arg("mp4")
            .arg("--download-sections").arg(&section_arg)
            .arg("--force-keyframes-at-cuts")
            .arg("--newline")
            .arg("--progress")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let app_for_progress = app_clone.clone();
        let download_id_for_progress = download_id_clone.clone();
        let segment_dur = segment_duration;
        
        let stdout_task = stdout.map(|stdout| tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            let mut last_progress_time = std::time::Instant::now();
            
            while let Ok(Some(line)) = lines.next_line().await {
                if line.contains("% of") {
                    if let Some(pct_str) = line.split('%').next() {
                        let pct_str = pct_str.trim_start_matches(|c: char| !c.is_ascii_digit() && c != '.');
                        if let Ok(pct) = pct_str.trim().parse::<f64>() {
                            if last_progress_time.elapsed().as_millis() >= 500 {
                                let _ = app_for_progress.emit("download-progress", DownloadProgress {
                                    download_id: download_id_for_progress.clone(),
                                    progress: pct.min(99.0),
                                    current_time: Some((pct / 100.0) * segment_dur),
                                    total_time: Some(segment_dur),
                                    status: format!("Downloading segment: {:.1}%", pct),
                                });
                                last_progress_time = std::time::Instant::now();
                            }
                        }
                    }
                }
            }
        }));

        let stderr_task = stderr.map(|stderr| tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(_)) = lines.next_line().await {}
        }));

        let status = tokio::select! {
            result = child.wait() => result.map_err(|e| format!("Failed to wait: {}", e))?,
            _ = &mut cancel_rx => {
                let _ = child.kill().await;
                if let Some(task) = stdout_task { task.abort(); }
                if let Some(task) = stderr_task { task.abort(); }
                return Err("Cancelled".to_string());
            }
        };

        if let Some(task) = stderr_task { let _ = task.await; }
        if let Some(task) = stdout_task { let _ = task.await; }

        if !status.success() {
            return Err(format!("yt-dlp failed: {:?}", status.code()));
        }

        if !video_path.exists() {
            return Err("File not found".to_string());
        }

        let file_size = std::fs::metadata(&video_path).ok().map(|m| m.len());

        let thumbnail_path = paths.thumbnails.join(format!("{}_thumb.jpg", filename.replace(".mp4", "")));
        let mut thumb_cmd = tokio::process::Command::new(&ffmpeg_path);
        let thumbnail_result = no_window(&mut thumb_cmd)
            .args(["-hwaccel", "auto", "-ss", "00:00:01", "-i", &video_path_str, "-vframes", "1", "-vf", "scale=320:-1", "-y", thumbnail_path.to_str().unwrap_or("")])
            .output()
            .await;

        let thumbnail_path_str = match thumbnail_result {
            Ok(output) if output.status.success() => Some(thumbnail_path.to_string_lossy().to_string()),
            _ => None,
        };

        let video_info = tokio::time::timeout(
            std::time::Duration::from_secs(30),
            crate::ffmpeg_utils::get_video_info(&app_clone, &video_path)
        ).await;
        
        let (width, height, codec, actual_duration) = match video_info {
            Ok(Ok(info)) => (Some(info.width), Some(info.height), Some(info.codec.clone()), info.duration),
            _ => (None, None, None, None),
        };

        Ok(DownloadResult {
            download_id: download_id_clone,
            success: true,
            file_path: Some(video_path_str),
            thumbnail_path: thumbnail_path_str,
            duration: Some(actual_duration.unwrap_or(segment_duration)),
            width,
            height,
            codec,
            file_size,
            error: None,
        })
    }).await;

    {
        let mut cancellers = ACTIVE_DOWNLOAD_CANCELLERS.lock().unwrap();
        cancellers.remove(&download_id);
    }
    cleanup_download();

    match result {
        Ok(Ok(download_result)) => {
            let _ = app.emit("download-progress", DownloadProgress {
                download_id: download_id.clone(),
                progress: 100.0,
                current_time: None,
                total_time: None,
                status: "Completed!".to_string(),
            });
            let _ = app.emit("download-complete", download_result);
            Ok(())
        }
        Ok(Err(e)) => {
            let _ = app.emit("download-complete", DownloadResult {
                download_id,
                success: false,
                file_path: None,
                thumbnail_path: None,
                duration: None,
                width: None,
                height: None,
                codec: None,
                file_size: None,
                error: Some(e.clone()),
            });
            Err(e)
        }
        Err(e) => {
            let error_msg = format!("Task failed: {}", e);
            let _ = app.emit("download-complete", DownloadResult {
                download_id,
                success: false,
                file_path: None,
                thumbnail_path: None,
                duration: None,
                width: None,
                height: None,
                codec: None,
                file_size: None,
                error: Some(error_msg.clone()),
            });
            Err(error_msg)
        }
    }
}
