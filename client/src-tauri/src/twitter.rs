use std::{
    collections::{HashMap, HashSet},
    path::PathBuf,
    sync::{Arc, Mutex},
};

use once_cell::sync::Lazy;
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
/// Document hash changes when X updates the query; keep aligned with current web clients/crawlers.
const TWITTER_AUDIO_SPACE_GQL: &str =
    "https://x.com/i/api/graphql/kZ9wfR8EBtiP0As3sFFrBA/AudioSpaceById";

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
        "withReplays": true,
        "withListeners": true,
    })
}

fn audio_space_gql_features() -> Value {
    serde_json::json!({
        "spaces_2022_h2_clipping": true,
        "spaces_2022_h2_spaces_communities": true,
        "responsive_web_graphql_exclude_directive_enabled": true,
        "verified_phone_label_enabled": false,
        "creator_subscriptions_tweet_preview_api_enabled": true,
        "responsive_web_graphql_skip_user_profile_image_extensions_enabled": false,
        "tweetypie_unmention_optimization_enabled": true,
        "responsive_web_edit_tweet_api_enabled": true,
        "graphql_is_translatable_rweb_tweet_is_translatable_enabled": true,
        "view_counts_everywhere_api_enabled": true,
        "longform_notetweets_consumption_enabled": true,
        "responsive_web_twitter_article_tweet_consumption_enabled": false,
        "tweet_awards_web_tipping_enabled": false,
        "freedom_of_speech_not_reach_fetch_enabled": true,
        "standardized_nudges_misinfo": true,
        "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": true,
        "responsive_web_graphql_timeline_navigation_enabled": true,
        "longform_notetweets_rich_text_read_enabled": true,
        "longform_notetweets_inline_media_enabled": true,
        "responsive_web_media_download_video_enabled": false,
        "responsive_web_enhance_cards_enabled": false,
    })
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

fn participant_periscope_user_id(obj: &serde_json::Map<String, Value>) -> Option<String> {
    for key in ["periscope_user_id", "periscopeUserId", "periscope_id", "periscopeId"] {
        if let Some(s) = obj.get(key).and_then(|v| v.as_str()) {
            let t = s.trim();
            if !t.is_empty() {
                return Some(t.to_string());
            }
        }
    }
    None
}

fn participant_screen_name(obj: &serde_json::Map<String, Value>) -> Option<String> {
    participant_username(obj)
}

/// Any nested X/Twitter CDN profile image URL (GraphQL shapes vary widely).
fn find_pbs_twimg_profile_url_recursive(v: &Value) -> Option<String> {
    match v {
        Value::String(s) => {
            let t = s.trim();
            if t.starts_with("http")
                && (t.contains("pbs.twimg.com/profile_images")
                    || t.contains("twimg.com/profile_images"))
            {
                Some(t.to_string())
            } else {
                None
            }
        }
        Value::Object(map) => {
            for child in map.values() {
                if let Some(found) = find_pbs_twimg_profile_url_recursive(child) {
                    return Some(found);
                }
            }
            None
        }
        Value::Array(arr) => {
            for child in arr {
                if let Some(found) = find_pbs_twimg_profile_url_recursive(child) {
                    return Some(found);
                }
            }
            None
        }
        _ => None,
    }
}

fn participant_avatar_url(obj: &serde_json::Map<String, Value>) -> Option<String> {
    fn upgrade_size(url: &str) -> String {
        url.replace("_normal", "_400x400")
            .replace("_mini", "_400x400")
            .replace("_bigger", "_400x400")
    }

    if let Some(s) = obj.get("avatar_url").and_then(|v| v.as_str()) {
        if !s.is_empty() {
            return Some(upgrade_size(s));
        }
    }
    if let Some(s) = obj.get("profile_image_url_https").and_then(|v| v.as_str()) {
        if !s.is_empty() {
            return Some(upgrade_size(s));
        }
    }
    if let Some(s) = obj.get("profile_image_url").and_then(|v| v.as_str()) {
        if !s.is_empty() {
            return Some(upgrade_size(s));
        }
    }

    if let Some(user_results) = obj.get("user_results") {
        if let Some(result) = user_results.get("result") {
            for ptr in [
                "/legacy/profile_image_url_https",
                "/legacy/profile_image_url",
                "/profile_image_url_https",
                "/profile_image_url",
                "/avatar/image_url",
                "/avatar_url",
                // CamelCase variants seen in some clients
                "/legacy/profileImageUrlHttps",
                "/profileImageUrlHttps",
            ] {
                if let Some(s) = result.pointer(ptr).and_then(|v| v.as_str()) {
                    if !s.is_empty() {
                        return Some(upgrade_size(s));
                    }
                }
            }
            if let Some(s) = find_pbs_twimg_profile_url_recursive(result) {
                return Some(upgrade_size(&s));
            }
        }
        if let Some(s) = find_pbs_twimg_profile_url_recursive(user_results) {
            return Some(upgrade_size(&s));
        }
    }

    if let Some(s) = find_pbs_twimg_profile_url_recursive(&Value::Object(obj.clone())) {
        return Some(upgrade_size(&s));
    }

    None
}

fn participant_username(obj: &serde_json::Map<String, Value>) -> Option<String> {
    if let Some(s) = obj.get("twitter_screen_name").and_then(|v| v.as_str()) {
        let t = s.trim().trim_start_matches('@');
        if !t.is_empty() {
            return Some(t.to_string());
        }
    }
    if let Some(s) = obj.get("screen_name").and_then(|v| v.as_str()) {
        let t = s.trim().trim_start_matches('@');
        if !t.is_empty() {
            return Some(t.to_string());
        }
    }
    if let Some(s) = obj.get("username").and_then(|v| v.as_str()) {
        let t = s.trim().trim_start_matches('@');
        if !t.is_empty() {
            return Some(t.to_string());
        }
    }
    if let Some(ur) = obj.get("user_results").and_then(|v| v.get("result")) {
        for ptr in ["/legacy/screen_name", "/screen_name"] {
            if let Some(s) = ur.pointer(ptr).and_then(|v| v.as_str()) {
                let t = s.trim().trim_start_matches('@');
                if !t.is_empty() {
                    return Some(t.to_string());
                }
            }
        }
    }
    None
}

fn participant_from_audio_space_row(
    obj: &serde_json::Map<String, Value>,
    role: &str,
) -> Option<Value> {
    let screen = participant_screen_name(obj).unwrap_or_default();
    let rest = participant_rest_id(obj).unwrap_or_default();
    let periscope = participant_periscope_user_id(obj).unwrap_or_default();
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
    let id = if !periscope.is_empty() {
        periscope.clone()
    } else if !rest.is_empty() {
        rest.clone()
    } else if !screen.is_empty() {
        screen.clone()
    } else {
        slugify_participant_id(&display)
    };
    let name = if !screen.is_empty() {
        format!("@{}", screen)
    } else {
        display.clone()
    };
    let mut out = serde_json::Map::new();
    out.insert("id".into(), Value::String(id));
    out.insert("name".into(), Value::String(name));
    out.insert("display_name".into(), Value::String(display.to_string()));
    if !periscope.is_empty() {
        out.insert("periscope_user_id".into(), Value::String(periscope));
    }
    if !rest.is_empty() {
        out.insert("x_rest_id".into(), Value::String(rest));
    }
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
    if let Some(u) = participant_username(obj) {
        out.insert("twitter_username".into(), Value::String(u));
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
async fn fetch_audio_space_full(space_id: &str) -> Result<AudioSpaceFullData, String> {
    let guest = twitter_guest_token().await?;
    let variables = audio_space_gql_variables(space_id);
    let features = audio_space_gql_features();
    let resp = TWITTER_HTTP
        .get(TWITTER_AUDIO_SPACE_GQL)
        .header("Authorization", format!("Bearer {}", TWITTER_PUBLIC_BEARER))
        .header("x-guest-token", &guest)
        .header("x-twitter-client-language", "en")
        .header("x-twitter-active-user", "no")
        .header("Origin", "https://x.com")
        .header("Referer", format!("https://x.com/i/spaces/{}", space_id))
        .query(&[
            ("variables", variables.to_string()),
            ("features", features.to_string()),
        ])
        .send()
        .await
        .map_err(|e| format!("AudioSpace GraphQL request failed: {}", e))?;
    let status = resp.status();
    if !status.is_success() {
        let t = resp.text().await.unwrap_or_default();
        return Err(format!(
            "AudioSpace GraphQL HTTP {}: {}",
            status,
            t.chars().take(400).collect::<String>()
        ));
    }
    let root: Value = resp
        .json()
        .await
        .map_err(|e| format!("AudioSpace GraphQL JSON: {}", e))?;
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

    // ---- started_at: GraphQL may return camelCase or snake_case; value is Unix SECONDS ----
    let started_at_secs = space
        .pointer("/metadata/started_at")
        .or_else(|| space.pointer("/metadata/startedAt"))
        .or_else(|| space.pointer("/metadata/created_at"))
        .or_else(|| space.pointer("/metadata/createdAt"))
        .and_then(|v| v.as_i64());

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
                let id = participant_periscope_user_id(obj)
                    .or_else(|| participant_rest_id(obj))
                    .or_else(|| {
                        participant_screen_name(obj)
                            .map(|s| s.to_lowercase().replace(|c: char| !c.is_alphanumeric(), "_"))
                    })
                    .unwrap_or_default();
                if id.is_empty() { continue; }
                // `start` is Unix seconds; fall back to space start if absent
                let join_secs = obj.get("start").and_then(|v| v.as_i64())
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
    push_audio_space_role_capped(participants_root, "listeners", "listener", &mut roster, &mut seen, 500);

    // ---- try live_video_stream/status to get chatToken ----
    let chat_token = if let Some(ref mk) = media_key {
        match fetch_live_video_stream_status(mk, &guest).await {
            Ok(stream_status) => {
                // Log all top-level keys so we can see what the stream status returns
                if let Some(obj) = stream_status.as_object() {
                    let keys: Vec<&str> = obj.keys().map(String::as_str).collect();
                    println!("[Twitter] live_video_stream/status keys: {:?}", keys);
                }
                let token = stream_status
                    .get("chatToken")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                println!("[Twitter] live_video_stream chatToken present={}", token.is_some());
                token
            }
            Err(e) => {
                println!("[Twitter] live_video_stream/status failed (non-fatal): {}", e);
                None
            }
        }
    } else {
        println!("[Twitter] No media_key — skipping live_video_stream/status");
        None
    };

    Ok(AudioSpaceFullData {
        participants: roster,
        media_key,
        started_at_secs,
        stage_join_times,
        chat_token,
    })
}

/// GET /1.1/live_video_stream/status/{media_key}
async fn fetch_live_video_stream_status(media_key: &str, guest_token: &str) -> Result<Value, String> {
    let url = format!(
        "https://twitter.com/i/api/1.1/live_video_stream/status/{}",
        media_key
    );
    let resp = TWITTER_HTTP
        .get(&url)
        .header("Authorization", format!("Bearer {}", TWITTER_PUBLIC_BEARER))
        .header("x-guest-token", guest_token)
        .header("x-twitter-client-language", "en")
        .header("x-twitter-active-user", "no")
        .header("Origin", "https://x.com")
        .header("Referer", format!("https://x.com/i/spaces/{}", media_key))
        .send()
        .await
        .map_err(|e| format!("live_video_stream/status request failed: {}", e))?;
    let status = resp.status();
    if !status.is_success() {
        let t = resp.text().await.unwrap_or_default();
        return Err(format!(
            "live_video_stream/status HTTP {}: {}",
            status,
            t.chars().take(300).collect::<String>()
        ));
    }
    resp.json().await.map_err(|e| format!("live_video_stream/status JSON: {}", e))
}

#[derive(Clone)]
struct ChatmanSpeakerEvent {
    periscope_user_id: String,
    username: Option<String>,
    display_name: Option<String>,
    twitter_id: Option<String>,
    event_code: i64,
    timestamp_ns: u128,
}

fn value_as_u128(v: &Value) -> Option<u128> {
    if let Some(n) = v.as_u64() {
        return Some(n as u128);
    }
    if let Some(n) = v.as_i64() {
        if n >= 0 {
            return Some(n as u128);
        }
    }
    if let Some(s) = v.as_str() {
        return s.trim().parse::<u128>().ok();
    }
    None
}

fn parse_chatman_replay_messages(data: &Value) -> (Vec<ChatmanSpeakerEvent>, usize) {
    let Some(messages) = data.get("messages").and_then(|v| v.as_array()) else {
        return (Vec::new(), 0);
    };

    let mut events = Vec::new();
    for message in messages {
        let Some(payload_raw) = message.get("payload").and_then(|v| v.as_str()) else {
            continue;
        };
        let Ok(payload) = serde_json::from_str::<Value>(payload_raw) else {
            continue;
        };
        let Some(body_raw) = payload.get("body").and_then(|v| v.as_str()) else {
            continue;
        };
        let Ok(body) = serde_json::from_str::<Value>(body_raw) else {
            continue;
        };
        if body.get("type").and_then(value_as_i64) != Some(40) {
            continue;
        }
        let Some(event_code) = body.get("guestBroadcastingEvent").and_then(value_as_i64) else {
            continue;
        };
        if event_code != 17 && event_code != 16 {
            continue;
        }
        let Some(periscope_user_id) = body
            .get("guestRemoteID")
            .and_then(value_as_id)
            .filter(|s| !s.is_empty())
        else {
            continue;
        };
        let Some(timestamp_ns) = payload.get("timestamp").and_then(value_as_u128) else {
            continue;
        };
        let sender = payload.get("sender").and_then(|v| v.as_object());
        events.push(ChatmanSpeakerEvent {
            periscope_user_id,
            username: body
                .get("guestUsername")
                .and_then(|v| v.as_str())
                .map(String::from)
                .or_else(|| {
                    sender
                        .and_then(|s| s.get("username"))
                        .and_then(|v| v.as_str())
                        .map(String::from)
                }),
            display_name: sender
                .and_then(|s| s.get("display_name"))
                .and_then(|v| v.as_str())
                .map(String::from),
            twitter_id: sender
                .and_then(|s| s.get("twitter_id"))
                .and_then(value_as_id),
            event_code,
            timestamp_ns,
        });
    }

    (events, messages.len())
}

async fn fetch_chatman_replay_events(chat_token: &str) -> Vec<ChatmanSpeakerEvent> {
    let access_resp = match TWITTER_HTTP
        .post("https://proxsee.pscp.tv/api/v2/accessChatPublic")
        .header("Origin", "https://x.com")
        .json(&serde_json::json!({ "chat_token": chat_token }))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            println!("[Twitter] Chatman accessChatPublic request failed: {}", e);
            return Vec::new();
        }
    };
    if !access_resp.status().is_success() {
        println!("[Twitter] Chatman accessChatPublic HTTP {}", access_resp.status());
        return Vec::new();
    }
    let access: Value = match access_resp.json().await {
        Ok(v) => v,
        Err(e) => {
            println!("[Twitter] Chatman accessChatPublic JSON: {}", e);
            return Vec::new();
        }
    };
    let Some(access_token) = access.get("access_token").and_then(|v| v.as_str()) else {
        println!("[Twitter] Chatman access token missing");
        return Vec::new();
    };
    let endpoint = access
        .get("endpoint")
        .and_then(|v| v.as_str())
        .unwrap_or("https://chatman-replay-us-west-2.pscp.tv")
        .trim_end_matches('/');
    let url = format!("{}/chatapi/v1/history", endpoint);

    let mut cursor = String::new();
    let mut seen_cursors = HashSet::new();
    let mut total_messages = 0usize;
    let mut all_events = Vec::new();
    for _page in 0..50usize {
        let body = serde_json::json!({
            "access_token": access_token,
            "cursor": cursor,
            "limit": 1000,
            "since": Value::Null,
            "quick_get": true,
        });
        let resp = match TWITTER_HTTP
            .post(&url)
            .header("Origin", "https://x.com")
            .json(&body)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                println!("[Twitter] Chatman history request failed: {}", e);
                break;
            }
        };
        if !resp.status().is_success() {
            println!("[Twitter] Chatman history HTTP {}", resp.status());
            break;
        }
        let data: Value = match resp.json().await {
            Ok(v) => v,
            Err(e) => {
                println!("[Twitter] Chatman history JSON: {}", e);
                break;
            }
        };
        let (mut events, messages) = parse_chatman_replay_messages(&data);
        total_messages += messages;
        all_events.append(&mut events);

        let next_cursor = data
            .get("cursor")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if next_cursor.is_empty() || !seen_cursors.insert(next_cursor.clone()) {
            break;
        }
        cursor = next_cursor;
    }

    all_events.sort_by(|a, b| a.timestamp_ns.cmp(&b.timestamp_ns));
    all_events.dedup_by(|a, b| {
        a.timestamp_ns == b.timestamp_ns
            && a.periscope_user_id == b.periscope_user_id
            && a.event_code == b.event_code
    });
    println!(
        "[Twitter] Chatman messages parsed={} speaker_events={}",
        total_messages,
        all_events.len()
    );
    all_events
}

fn participant_string_field(participant: &Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(s) = participant.get(*key).and_then(|v| v.as_str()) {
            let t = s.trim();
            if !t.is_empty() {
                return Some(t.to_string());
            }
        }
    }
    None
}

fn build_chatman_speaker_timeline(
    events: &[ChatmanSpeakerEvent],
    participants: &[Value],
    started_at_ms: i64,
    total_duration_secs: f64,
) -> Vec<Value> {
    if events.is_empty() || started_at_ms <= 0 {
        return Vec::new();
    }

    let mut participant_by_periscope: HashMap<String, &Value> = HashMap::new();
    for participant in participants {
        if let Some(id) = participant
            .get("periscope_user_id")
            .and_then(|v| v.as_str())
            .or_else(|| participant.get("id").and_then(|v| v.as_str()))
        {
            if !id.is_empty() {
                participant_by_periscope.entry(id.to_string()).or_insert(participant);
            }
        }
    }

    let event_time_secs = |event: &ChatmanSpeakerEvent| -> f64 {
        let ts_ms = (event.timestamp_ns / 1_000_000) as i128;
        ((ts_ms - started_at_ms as i128).max(0) as f64) / 1000.0
    };

    let mut open: HashMap<String, (ChatmanSpeakerEvent, f64)> = HashMap::new();
    let mut raw_segments: Vec<(String, f64, f64, ChatmanSpeakerEvent)> = Vec::new();
    let close_segment = |
        user_id: &str,
        end: f64,
        open: &mut HashMap<String, (ChatmanSpeakerEvent, f64)>,
        raw_segments: &mut Vec<(String, f64, f64, ChatmanSpeakerEvent)>,
    | {
        if let Some((event, start)) = open.remove(user_id) {
            let start = start.clamp(0.0, total_duration_secs);
            let end = end.clamp(0.0, total_duration_secs);
            if end > start {
                raw_segments.push((user_id.to_string(), start, end, event));
            }
        }
    };

    for event in events {
        let t = event_time_secs(event);
        if event.event_code == 17 {
            if open.contains_key(&event.periscope_user_id) {
                close_segment(&event.periscope_user_id, t, &mut open, &mut raw_segments);
            }
            open.insert(event.periscope_user_id.clone(), (event.clone(), t));
        } else if event.event_code == 16 {
            close_segment(&event.periscope_user_id, t, &mut open, &mut raw_segments);
        }
    }

    for (user_id, (_event, start)) in open.clone() {
        let next_start = events
            .iter()
            .filter(|e| e.event_code == 17 && event_time_secs(e) > start)
            .map(|e| event_time_secs(e))
            .min_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        close_segment(
            &user_id,
            next_start.unwrap_or(total_duration_secs),
            &mut open,
            &mut raw_segments,
        );
    }

    let mut unmatched = HashSet::new();
    let mut out = Vec::new();
    for (i, (periscope_user_id, start, end, event)) in raw_segments.iter().enumerate() {
        let participant = participant_by_periscope.get(periscope_user_id);
        if participant.is_none() {
            unmatched.insert(periscope_user_id.clone());
        }
        let username = participant
            .and_then(|p| participant_string_field(p, &["twitter_username", "username"]))
            .or_else(|| event.username.clone());
        let display_name = participant
            .and_then(|p| participant_string_field(p, &["display_name", "name"]))
            .or_else(|| event.display_name.clone());
        out.push(serde_json::json!({
            "id": format!("cm-{}-{}", periscope_user_id, i),
            "speakerId": periscope_user_id,
            "periscopeUserId": periscope_user_id,
            "xRestId": participant
                .and_then(|p| participant_string_field(p, &["x_rest_id"]))
                .or_else(|| event.twitter_id.clone()),
            "username": username,
            "displayName": display_name,
            "avatarUrl": participant.and_then(|p| participant_string_field(p, &["avatar_url"])),
            "role": participant.and_then(|p| participant_string_field(p, &["role"])),
            "start": start,
            "end": end,
            "source": "chatman_replay",
        }));
    }

    println!("[Twitter] Chatman speaker segments created={}", out.len());
    for seg in out.iter().take(10) {
        println!(
            "[Twitter] Chatman segment {} start={:.3} end={:.3}",
            seg.get("username")
                .or_else(|| seg.get("displayName"))
                .or_else(|| seg.get("periscopeUserId"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown"),
            seg.get("start").and_then(|v| v.as_f64()).unwrap_or(0.0),
            seg.get("end").and_then(|v| v.as_f64()).unwrap_or(0.0)
        );
    }
    if !unmatched.is_empty() {
        let mut ids: Vec<String> = unmatched.into_iter().collect();
        ids.sort();
        println!("[Twitter] Chatman unmatched guestRemoteIDs: {:?}", ids);
    }

    out
}

fn value_as_id(v: &Value) -> Option<String> {
    if let Some(s) = v.as_str() {
        let t = s.trim();
        return (!t.is_empty()).then(|| t.to_string());
    }
    if let Some(n) = v.as_i64() {
        return Some(n.to_string());
    }
    if let Some(n) = v.as_u64() {
        return Some(n.to_string());
    }
    None
}

#[allow(dead_code)]
fn parse_jsonish_body(comment: &Value) -> Option<Value> {
    for key in ["body", "payload", "message", "data"] {
        let Some(raw) = comment.get(key) else { continue };
        if raw.is_object() {
            return Some(raw.clone());
        }
        if let Some(s) = raw.as_str() {
            if let Ok(v) = serde_json::from_str::<Value>(s) {
                return Some(v);
            }
        }
    }
    None
}

#[allow(dead_code)]
fn event_type_is_speaking(v: &Value) -> bool {
    for key in ["type", "kind", "event_type", "eventType", "name"] {
        if let Some(s) = v.get(key).and_then(|x| x.as_str()) {
            let lower = s.to_ascii_lowercase();
            if matches!(
                lower.as_str(),
                "typing_active" | "speaking" | "speaker_active" | "audio_speaker_active"
            ) || lower.contains("speaking")
                || lower.contains("speaker_active")
            {
                return true;
            }
        }
    }
    match v {
        Value::Object(map) => map.values().any(event_type_is_speaking),
        Value::Array(arr) => arr.iter().any(event_type_is_speaking),
        _ => false,
    }
}

fn value_as_i64(v: &Value) -> Option<i64> {
    if let Some(n) = v.as_i64() {
        return Some(n);
    }
    if let Some(n) = v.as_u64() {
        return i64::try_from(n).ok();
    }
    if let Some(s) = v.as_str() {
        return s.trim().parse::<i64>().ok();
    }
    None
}

#[allow(dead_code)]
fn find_first_by_keys_recursive<'a>(v: &'a Value, keys: &[&str], depth: u8) -> Option<&'a Value> {
    if depth == 0 {
        return None;
    }
    match v {
        Value::Object(map) => {
            for key in keys {
                if let Some(hit) = map.get(*key) {
                    return Some(hit);
                }
            }
            for child in map.values() {
                if let Some(hit) = find_first_by_keys_recursive(child, keys, depth - 1) {
                    return Some(hit);
                }
            }
            None
        }
        Value::Array(arr) => {
            for child in arr {
                if let Some(hit) = find_first_by_keys_recursive(child, keys, depth - 1) {
                    return Some(hit);
                }
            }
            None
        }
        _ => None,
    }
}

#[allow(dead_code)]
fn periscope_event_timestamp_ms(comment: &Value, body: Option<&Value>) -> Option<i64> {
    for root in [Some(comment), body] {
        let Some(v) = root else { continue };
        let time_keys = [
            "timestamp_ms",
            "timestampMs",
            "offset_ms",
            "offsetMs",
            "created_at_ms",
            "createdAtMs",
            "time_ms",
            "timeMs",
            "timestamp",
            "created_at",
            "createdAt",
            "time",
        ];
        if let Some(n) = find_first_by_keys_recursive(v, &time_keys, 5).and_then(value_as_i64) {
            return Some(n);
        }
    }
    None
}

#[allow(dead_code)]
fn periscope_event_user_id(comment: &Value, body: Option<&Value>) -> Option<String> {
    for root in [Some(comment), body] {
        let Some(v) = root else { continue };
        let id_keys = [
            "user_id",
            "userId",
            "twitter_user_id",
            "twitterUserId",
            "speaker_user_id",
            "speakerUserId",
            "active_speaker_user_id",
            "activeSpeakerUserId",
            "current_speaker_id",
            "currentSpeakerId",
            "sender_id",
            "senderId",
        ];
        if let Some(id) = find_first_by_keys_recursive(v, &id_keys, 5).and_then(value_as_id) {
            return Some(id);
        }
        for ptr in [
            "/user/id",
            "/user/user_id",
            "/user/twitter_user_id",
            "/sender/id",
            "/sender/user_id",
            "/participant/user_results/result/rest_id",
        ] {
            if let Some(id) = v.pointer(ptr).and_then(value_as_id) {
                return Some(id);
            }
        }
    }
    None
}

#[allow(dead_code)]
fn periscope_comment_arrays(data: &Value) -> Vec<&Vec<Value>> {
    [
        data.get("comments"),
        data.get("events"),
        data.get("results"),
        data.pointer("/data/comments"),
        data.pointer("/data/events"),
        data.pointer("/data/results"),
    ]
    .iter()
    .filter_map(|opt| opt.and_then(|v| v.as_array()))
    .collect()
}

#[allow(dead_code)]
fn collect_speaking_events_from_comments(data: &Value, started_at_ms: i64) -> Vec<(f64, String)> {
    let mut events: Vec<(f64, String)> = Vec::new();
    for comments in periscope_comment_arrays(data) {
        for comment in comments {
            let body = parse_jsonish_body(comment);
            let is_speaking_event =
                event_type_is_speaking(comment) || body.as_ref().is_some_and(event_type_is_speaking);
            if !is_speaking_event {
                continue;
            }
            let Some(ts_ms) = periscope_event_timestamp_ms(comment, body.as_ref()) else {
                continue;
            };
            let offset_secs = if ts_ms > 1_000_000_000_000 {
                (ts_ms - started_at_ms).max(0) as f64 / 1000.0
            } else if ts_ms > 1_000_000_000 {
                (ts_ms - (started_at_ms / 1000)).max(0) as f64
            } else {
                ts_ms as f64 / 1000.0
            };
            if let Some(uid) = periscope_event_user_id(comment, body.as_ref()) {
                events.push((offset_secs, uid));
            }
        }
    }
    events
}

/// Extract `typing_active` (speaking) events from Periscope chat replay.
/// Returns Vec<(offset_secs, participant_id)>.
#[allow(dead_code)]
async fn fetch_periscope_speaking_events(
    media_key: &str,
    chat_token: &str,
    started_at_ms: i64,
) -> Vec<(f64, String)> {
    let broadcast_id = media_key
        .split_once('_')
        .map(|(_, n)| n)
        .unwrap_or(media_key);

    let mut all_events: Vec<(f64, String)> = Vec::new();
    let page_size = 5000usize;
    for page in 0..5usize {
        let start = page * page_size;
        let url = format!(
            "https://proxsee.pscp.tv/api/v2/broadcastComments?broadcast_id={}&count={}&start={}",
            broadcast_id, page_size, start
        );
        let resp = match TWITTER_HTTP
            .get(&url)
            .header("Authorization", format!("Bearer {}", chat_token))
            .header("Origin", "https://x.com")
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                println!("[Twitter] Periscope broadcastComments request failed: {}", e);
                break;
            }
        };

        if !resp.status().is_success() {
            println!("[Twitter] Periscope broadcastComments HTTP {}", resp.status());
            break;
        }

        let data: Value = match resp.json().await {
            Ok(v) => v,
            Err(e) => {
                println!("[Twitter] Periscope broadcastComments JSON: {}", e);
                break;
            }
        };

        if page == 0 {
            println!("[Twitter] Periscope broadcastComments keys: {:?}",
                data.as_object().map(|o| o.keys().collect::<Vec<_>>()));
        }

        let raw_count: usize = periscope_comment_arrays(&data).iter().map(|arr| arr.len()).sum();
        let mut page_events = collect_speaking_events_from_comments(&data, started_at_ms);
        all_events.append(&mut page_events);
        if raw_count < page_size {
            break;
        }
    }

    all_events.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    all_events.dedup_by(|a, b| (a.0 - b.0).abs() < 0.001 && a.1 == b.1);
    println!("[Twitter] Periscope speaking events found: {}", all_events.len());
    all_events
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

    if is_valid_twitter_vod_url(&normalized) {
        Ok(normalized)
    } else {
        Err(
            "Invalid Twitter URL. Must be a broadcast, Space, or timeline video post URL."
                .to_string(),
        )
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

            match fetch_audio_space_full(&space_id).await {
                Ok(space_data) => {
                    if !space_data.participants.is_empty() {
                        println!(
                            "[Twitter] Merged AudioSpace GraphQL roster: {} participants",
                            space_data.participants.len()
                        );
                        metadata["participants"] = Value::Array(space_data.participants.clone());
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
                    // Which Rust branch produced `speakerTimeline` (for client UI labels).
                    let mut timeline_primary_source: Option<String> = None;

                    // ── Priority 1: Chatman replay guestBroadcastingEvent 17/16 ────────────
                    if let Some(ref tok) = space_data.chat_token {
                        let events = fetch_chatman_replay_events(tok).await;
                        speaker_timeline = build_chatman_speaker_timeline(
                            &events,
                            &space_data.participants,
                            started_at_secs * 1000,
                            total_duration,
                        );
                        if !speaker_timeline.is_empty() {
                            timeline_primary_source = Some("chatman_replay".to_string());
                        }
                    }

                    // ── Priority 2: Try live_video_stream/status if GraphQL had no chatToken ──
                    if speaker_timeline.is_empty() {
                        if let (Some(ref mk), None) = (&effective_media_key, &space_data.chat_token) {
                            let guest = twitter_guest_token().await.unwrap_or_default();
                            if !guest.is_empty() {
                                if let Ok(stream_status) = fetch_live_video_stream_status(mk, &guest).await {
                                    if let Some(tok) = stream_status.get("chatToken").and_then(|v| v.as_str()) {
                                        println!("[Twitter] Got chatToken from live_video_stream (retry)");
                                        let events = fetch_chatman_replay_events(tok).await;
                                        speaker_timeline = build_chatman_speaker_timeline(
                                            &events,
                                            &space_data.participants,
                                            started_at_secs * 1000,
                                            total_duration,
                                        );
                                        if !speaker_timeline.is_empty() {
                                            timeline_primary_source = Some("chatman_replay".to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if speaker_timeline.is_empty() && !space_data.stage_join_times.is_empty() {
                        println!(
                            "[Twitter] Stage-join timing available for {} participants, but not using it as active-speaker data",
                            space_data.stage_join_times.len()
                        );
                    }

                    if !speaker_timeline.is_empty() {
                        println!("[Twitter] Speaker timeline: {} segments", speaker_timeline.len());
                        metadata["speakerTimeline"] = Value::Array(speaker_timeline);
                    } else {
                        println!("[Twitter] No speaker timeline could be built");
                    }

                    let stage_join_hints: Vec<Value> = space_data
                        .stage_join_times
                        .iter()
                        .map(|(uid, js)| {
                            let offset_secs = (*js - started_at_secs).max(0) as f64;
                            serde_json::json!({
                                "userId": uid,
                                "joinSecsAbsolute": js,
                                "offsetSecs": offset_secs,
                            })
                        })
                        .collect();

                    metadata["spaceReplayHints"] = serde_json::json!({
                            "speakerTimelinePrimarySource": timeline_primary_source.unwrap_or_else(|| "none".to_string()),
                        "startedAtSecs": started_at_secs,
                        "stageJoinTimes": stage_join_hints,
                    });
                }
                Err(e) => {
                    eprintln!(
                        "[Twitter] AudioSpace GraphQL enrich failed (continuing with yt-dlp only): {}",
                        e
                    );
                    // Without GraphQL we do not have the AudioSpace roster needed to map
                    // guestRemoteID to periscope_user_id, so avoid injecting a guessed active-speaker timeline.
                    if let Some(ref mk) = hls_derived_media_key {
                        let guest_token = twitter_guest_token().await.unwrap_or_default();
                        if let Ok(stream_status) = fetch_live_video_stream_status(mk, &guest_token).await {
                            let _chat_token = stream_status
                                .get("chatToken").or_else(|| stream_status.get("chat_token"))
                                .and_then(|v| v.as_str())
                                .map(String::from);
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

/// Resolve a Twitter/X account by numeric user id (rest_id) using guest auth.
/// Returns `users/show.json` body — used when the speaker timeline references ids
/// not present in the saved roster (stubs with no handle / avatar).
#[tauri::command]
pub async fn resolve_twitter_user_by_rest_id(rest_id: String) -> Result<String, String> {
    let trimmed = rest_id.trim();
    if trimmed.is_empty() || !trimmed.chars().all(|c| c.is_ascii_digit()) {
        return Err("rest_id must be a numeric Twitter user id".to_string());
    }
    let guest = twitter_guest_token().await?;
    let url = format!("{}users/show.json", TWITTER_API_V11);
    let resp = TWITTER_HTTP
        .get(&url)
        .header(
            "Authorization",
            format!("Bearer {}", TWITTER_PUBLIC_BEARER),
        )
        .header("x-guest-token", &guest)
        .header("x-twitter-client-language", "en")
        .header("x-twitter-active-user", "no")
        .header("Origin", "https://x.com")
        .header("Referer", "https://x.com/")
        .query(&[("user_id", trimmed), ("include_entities", "false")])
        .send()
        .await
        .map_err(|e| format!("users/show request failed: {}", e))?;
    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("users/show body: {}", e))?;
    if !status.is_success() {
        return Err(format!(
            "users/show HTTP {}: {}",
            status,
            text.chars().take(280).collect::<String>()
        ));
    }
    Ok(text)
}

/// Download Twitter broadcast thumbnail and return as data URL
#[tauri::command]
pub async fn download_twitter_thumbnail(thumbnail_url: String) -> Result<String, String> {
    let client = reqwest::Client::new();

    // Twimg and unavatar often reject anonymous scrapers without a browser-like UA.
    let response = client
        .get(&thumbnail_url)
        .header(
            reqwest::header::USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        )
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

    let source_id = extract_twitter_source_id(&vod_url).unwrap_or_else(|_| broadcast_id.clone());
    let filename = format!("twitter_{}_{}_{}.mp4", source_id, safe_title, timestamp);
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

/// Extract broadcast or space ID from URL (live/recording paths only).
fn extract_broadcast_id(url: &str) -> Result<String, String> {
    if let Some(broadcast_part) = url.split("/i/broadcasts/").nth(1) {
        Ok(broadcast_part
            .split('/')
            .next()
            .unwrap_or("")
            .split('?')
            .next()
            .unwrap_or("")
            .to_string())
    } else if let Some(space_part) = url.split("/i/spaces/").nth(1) {
        Ok(space_part
            .split('/')
            .next()
            .unwrap_or("")
            .split('?')
            .next()
            .unwrap_or("")
            .to_string())
    } else {
        Err("Could not extract broadcast/space ID from URL".to_string())
    }
}

fn is_valid_twitter_vod_url(normalized: &str) -> bool {
    let lower = normalized.to_lowercase();
    if !(lower.contains("twitter.com") || lower.contains("x.com")) {
        return false;
    }
    lower.contains("/i/broadcasts/")
        || lower.contains("/i/spaces/")
        || lower.contains("/status/")
        || lower.contains("/statuses/")
}

/// Broadcast, space, or tweet status id — used for VOD download filenames and metadata.
fn extract_twitter_source_id(url: &str) -> Result<String, String> {
    if let Ok(id) = extract_broadcast_id(url) {
        if !id.is_empty() {
            return Ok(id);
        }
    }

    for marker in ["/status/", "/statuses/"] {
        if let Some(rest) = url.split(marker).nth(1) {
            let id = rest
                .split('/')
                .next()
                .unwrap_or("")
                .split('?')
                .next()
                .unwrap_or("")
                .trim();
            if !id.is_empty() && id.chars().all(|c| c.is_ascii_digit()) {
                return Ok(id.to_string());
            }
        }
    }

    Err("Could not extract broadcast, space, or status ID from URL".to_string())
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

    let source_id = extract_twitter_source_id(&vod_url).unwrap_or_else(|_| broadcast_id.clone());
    let filename = format!(
        "twitter_{}_{}_{}_{}_{}.mp4",
        source_id, safe_title, start_formatted, end_formatted, timestamp
    );
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
