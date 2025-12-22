use once_cell::sync::Lazy;
use reqwest::StatusCode;
use serde_json::{json, Value};

static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("ClippsterKick/1.0")
        .build()
        .expect("Failed to build Kick HTTP client")
});

fn normalize_channel_slug(input: &str) -> Result<String, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("Channel slug cannot be empty".to_string());
    }

    let mut slug = trimmed;
    if let Some(rest) = slug.strip_prefix("https://") {
        slug = rest;
    }
    if let Some(rest) = slug.strip_prefix("http://") {
        slug = rest;
    }
    if let Some(rest) = slug.strip_prefix("www.") {
        slug = rest;
    }
    if let Some(rest) = slug.strip_prefix("kick.com/") {
        slug = rest;
    }

    let slug = slug
        .split(['/', '?', '#'])
        .next()
        .unwrap_or_default()
        .trim();

    if slug.is_empty() {
        return Err("Invalid Kick channel slug".to_string());
    }

    Ok(slug.to_string())
}

async fn fetch_channel_payload(slug: &str) -> Result<Value, String> {
    let endpoints = [
        format!("https://kick.com/api/v2/channels/{}", slug),
        format!("https://kick.com/api/v1/channels/{}/livestream", slug),
    ];

    let mut last_error: Option<String> = None;

    for url in endpoints.iter() {
        match HTTP_CLIENT.get(url).send().await {
            Ok(response) => {
                if response.status() == StatusCode::NOT_FOUND {
                    last_error = Some("Channel not found on Kick".to_string());
                    continue;
                }

                if !response.status().is_success() {
                    last_error = Some(format!(
                        "Kick API responded with {} for {}",
                        response.status(),
                        url
                    ));
                    continue;
                }

                match response.json::<Value>().await {
                    Ok(json) => return Ok(json),
                    Err(err) => {
                        last_error = Some(format!("Failed to parse Kick response: {}", err));
                        continue;
                    }
                }
            }
            Err(err) => {
                last_error = Some(format!("Kick request failed: {}", err));
                continue;
            }
        }
    }

    Err(last_error.unwrap_or_else(|| "Failed to fetch Kick channel metadata".to_string()))
}

fn extract_data_root<'a>(payload: &'a Value) -> &'a Value {
    payload
        .get("data")
        .or_else(|| payload.get("channel"))
        .unwrap_or(payload)
}

fn extract_livestream<'a>(payload: &'a Value) -> Option<&'a Value> {
    let candidates = [
        Some(payload),
        payload.get("data"),
        payload.get("channel"),
        payload.get("livestream"),
        payload
            .get("data")
            .and_then(|data| data.get("livestream")),
        payload
            .get("channel")
            .and_then(|channel| channel.get("livestream")),
    ];

    for candidate in candidates.into_iter().flatten() {
        if let Some(live) = candidate.get("livestream") {
            return Some(live);
        }
    }

    payload.get("livestream")
}

fn read_bool(value: Option<&Value>, keys: &[&str]) -> Option<bool> {
    value.and_then(|node| {
        for key in keys {
            if let Some(val) = node.get(*key) {
                if let Some(boolean) = val.as_bool() {
                    return Some(boolean);
                }
            }
        }
        None
    })
}

fn read_string(node: Option<&Value>, keys: &[&str]) -> Option<String> {
    node.and_then(|value| {
        for key in keys {
            if let Some(val) = value.get(*key) {
                match val {
                    Value::String(s) if !s.is_empty() => return Some(s.clone()),
                    Value::Number(num) => return Some(num.to_string()),
                    Value::Bool(boolean) => return Some(boolean.to_string()),
                    _ => continue,
                }
            }
        }
        None
    })
}

fn read_number(node: Option<&Value>, keys: &[&str]) -> Option<i64> {
    node.and_then(|value| {
        for key in keys {
            if let Some(val) = value.get(*key) {
                if let Some(num) = val.as_i64() {
                    return Some(num);
                }
            }
        }
        None
    })
}

fn read_nested_string(node: Option<&Value>, parent_keys: &[&str], child_keys: &[&str]) -> Option<String> {
    node.and_then(|value| {
        for parent in parent_keys {
            if let Some(child) = value.get(*parent) {
                let result = read_string(Some(child), child_keys);
                if result.is_some() {
                    return result;
                }
            }
        }
        None
    })
}

fn build_status_payload(slug: &str, payload: &Value) -> Value {
    let data = extract_data_root(payload);
    let livestream = extract_livestream(payload);

    let is_live = read_bool(livestream, &["is_live", "isLive"]).unwrap_or(false);
    let viewer_count = read_number(livestream, &["viewer_count", "viewerCount"]);
    let stream_id = read_string(livestream, &["id", "stream_id", "slug"]);
    let title = read_string(livestream, &["session_title", "sessionTitle", "title"]);
    let started_at =
        read_string(livestream, &["created_at", "createdAt", "started_at", "startedAt"]);
    let playback_url = read_string(
        livestream,
        &["playback_url", "playbackUrl", "source", "source_url", "url"],
    );
    let thumbnail_url = read_nested_string(
        livestream,
        &["thumbnail", "thumbnail_url", "thumbnailUrl"],
        &["url", "src"],
    );

    let channel_id = read_number(Some(data), &["id"]);
    let channel_name = read_string(Some(data), &["username", "slug", "name"]);
    let language = read_string(Some(data), &["language", "language_code", "languageCode"]);

    json!({
        "isLive": is_live,
        "channelSlug": slug,
        "channelId": channel_id,
        "channelName": channel_name,
        "streamId": stream_id,
        "title": title,
        "viewerCount": viewer_count,
        "startedAt": started_at,
        "language": language,
        "playbackUrl": playback_url,
        "thumbnailUrl": thumbnail_url,
        "raw": payload,
    })
}

fn extract_playback_url(payload: &Value) -> Option<String> {
    let livestream = extract_livestream(payload);
    read_string(
        livestream,
        &["playback_url", "playbackUrl", "source", "source_url", "url"],
    )
}

#[tauri::command]
pub async fn check_kick_livestream(channel_slug: String) -> Result<String, String> {
    let slug = normalize_channel_slug(&channel_slug)?;
    let payload = fetch_channel_payload(&slug).await?;
    let status = build_status_payload(&slug, &payload);
    Ok(status.to_string())
}

#[tauri::command]
pub async fn get_kick_stream_url(channel_slug: String) -> Result<String, String> {
    let slug = normalize_channel_slug(&channel_slug)?;
    let payload = fetch_channel_payload(&slug).await?;

    if let Some(url) = extract_playback_url(&payload) {
        Ok(url)
    } else {
        Err("No playback URL found for this channel. Is the stream live?".to_string())
    }
}
