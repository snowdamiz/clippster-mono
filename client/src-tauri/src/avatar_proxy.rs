use base64::{engine::general_purpose, Engine as _};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use tokio::sync::RwLock;

/// In-memory cache: original URL → base64 data URL
static AVATAR_CACHE: Lazy<RwLock<HashMap<String, String>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

/// Allowed CDN domains for avatar images
const ALLOWED_PREFIXES: &[&str] = &[
    "https://lh3.googleusercontent.com/",
    "https://googleusercontent.com/",
    "https://avatars.githubusercontent.com/",
    "https://pbs.twimg.com/",
    "https://secure.gravatar.com/",
    "https://cdn.discordapp.com/",
];

/// Fetch an avatar image via the native HTTP client (reqwest), bypassing WKWebView
/// rate limiting. Returns a base64-encoded data URL that can be used directly as
/// an <img> src. Results are cached in memory for the lifetime of the app.
#[tauri::command]
pub async fn fetch_avatar_image(url: String) -> Result<String, String> {
    // Security: only allow known avatar CDN domains or Cloudflare R2 presigned URLs
    let allowed = ALLOWED_PREFIXES
        .iter()
        .any(|prefix| url.starts_with(prefix))
        || url.contains(".r2.cloudflarestorage.com/");

    if !allowed {
        return Err(format!("URL domain not allowed for avatar proxy"));
    }

    // Return from cache if available
    {
        let cache = AVATAR_CACHE.read().await;
        if let Some(data_url) = cache.get(&url) {
            return Ok(data_url.clone());
        }
    }

    // Build a browser-like client to avoid CDN blocks
    let client = reqwest::Client::builder()
        .user_agent(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) \
             AppleWebKit/537.36 (KHTML, like Gecko) \
             Chrome/120.0.0.0 Safari/537.36",
        )
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch avatar: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Avatar server returned {}", response.status()));
    }

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .split(';')
        .next()
        .unwrap_or("image/jpeg")
        .trim()
        .to_string();

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read avatar bytes: {}", e))?;

    let encoded = general_purpose::STANDARD.encode(&bytes);
    let data_url = format!("data:{};base64,{}", content_type, encoded);

    // Store in cache
    {
        let mut cache = AVATAR_CACHE.write().await;
        cache.insert(url, data_url.clone());
    }

    Ok(data_url)
}
