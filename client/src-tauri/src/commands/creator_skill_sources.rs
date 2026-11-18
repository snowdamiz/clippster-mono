//! Bounded public-page captures for a creator clip's manual fact review.

use std::{net::SocketAddr, time::Duration};
use regex::Regex;
use reqwest::{header::CONTENT_TYPE, Client, Url};
use serde::Serialize;

use super::reference_video::resolve_public_addresses;

const MAX_PAGE_BYTES: usize = 1024 * 1024;
const MAX_LOGO_BYTES: usize = 5 * 1024 * 1024;

fn readable_page(html: &str) -> String {
    let mut text = html.to_string();
    for tag in ["script", "style", "noscript", "svg"] {
        let pattern = format!(r"(?is)<{tag}\b[^>]*>.*?</{tag}\s*>");
        text = Regex::new(&pattern).unwrap().replace_all(&text, " ").into_owned();
    }
    text = Regex::new(r"(?i)<br\s*/?\s*>|</(?:p|div|article|section|h[1-6]|li)>")
        .unwrap().replace_all(&text, "\n").into_owned();
    text = Regex::new(r"<[^>]+>").unwrap().replace_all(&text, " ").into_owned();
    for (entity, replacement) in [("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", "\""), ("&apos;", "'"), ("&nbsp;", " ")] {
        text = text.replace(entity, replacement);
    }
    Regex::new(r"[ \t]{2,}").unwrap().replace_all(&text, " ").trim().to_string()
}

async fn fetch_public_page(raw_url: &str) -> Result<String, String> {
    let mut url = Url::parse(raw_url).map_err(|_| "Invalid source URL.".to_string())?;
    for _ in 0..=3 {
        if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() || url.port().is_some_and(|port| port != 443) {
            return Err("Source pages must use public HTTPS without credentials or custom ports.".into());
        }
        let host = url.host_str().ok_or("Source URL has no host.")?;
        let addresses = resolve_public_addresses(&url).await?;
        let sockets = addresses.into_iter().map(|address| SocketAddr::new(address, 443)).collect::<Vec<_>>();
        let client = Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(20))
            .resolve_to_addrs(host, &sockets)
            .build()
            .map_err(|error| format!("Could not prepare source request: {error}"))?;
        let mut response = client.get(url.clone()).send().await.map_err(|error| format!("Could not fetch source page: {error}"))?;
        if response.status().is_redirection() {
            let location = response.headers().get(reqwest::header::LOCATION).and_then(|value| value.to_str().ok()).ok_or("Source redirect has no location.")?;
            url = url.join(location).map_err(|_| "Source redirect is invalid.".to_string())?;
            continue;
        }
        if !response.status().is_success() { return Err(format!("Source page returned HTTP {}.", response.status())); }
        let content_type = response.headers().get(CONTENT_TYPE).and_then(|value| value.to_str().ok()).unwrap_or("").to_ascii_lowercase();
        if !content_type.starts_with("text/html") && !content_type.starts_with("text/plain") && !content_type.starts_with("application/xhtml+xml") {
            return Err("Source did not return a readable page.".into());
        }
        if response.content_length().is_some_and(|size| size > MAX_PAGE_BYTES as u64) { return Err("Source page is too large.".into()); }
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|error| format!("Could not read source page: {error}"))? {
            if bytes.len() + chunk.len() > MAX_PAGE_BYTES { return Err("Source page is too large.".into()); }
            bytes.extend_from_slice(&chunk);
        }
        let html = String::from_utf8_lossy(&bytes).into_owned();
        if readable_page(&html).is_empty() { return Err("Source page has no readable text.".into()); }
        return Ok(html);
    }
    Err("Source page redirected too many times.".into())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatorSkillPageCapture { path: String, linked_logo_url: Option<String>, screenshot_html: String, page_published_at: Option<String> }

fn page_published_date(html: &str) -> Option<String> {
    let without_comments = Regex::new(r"(?s)<!--.*?-->").unwrap().replace_all(html, " ");
    let key = Regex::new(r#"(?i)\b(?:name|property|itemprop)\s*=\s*["'](?:article:published_time|datepublished|pubdate|parsely-pub-date|citation_publication_date|dc\.date\.issued)["']"#).unwrap();
    let content = Regex::new(r#"(?i)\bcontent\s*=\s*["'](\d{4}[-/]\d{2}[-/]\d{2})[^"']*["']"#).unwrap();
    for tag in Regex::new(r"(?is)<meta\b[^>]*>").unwrap().find_iter(&without_comments) {
        if !key.is_match(tag.as_str()) { continue; }
        let date = content.captures(tag.as_str()).and_then(|capture| capture.get(1)).map(|value| value.as_str().replace('/', "-"));
        if let Some(date) = date {
            if chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d").is_ok() { return Some(date); }
        }
    }
    None
}

fn page_links_logo(html: &str, logo_url: &str) -> bool {
    let without_comments = Regex::new(r"(?s)<!--.*?-->").unwrap().replace_all(html, " ");
    let visible_markup = Regex::new(r"(?is)<(script|style|noscript)\b[^>]*>.*?</(?:script|style|noscript)\s*>").unwrap().replace_all(&without_comments, " ");
    let logo_alt = Regex::new(r#"(?i)\balt\s*=\s*["'][^"']*logo[^"']*["']"#).unwrap();
    let image_meta = Regex::new(r#"(?i)\b(?:name|property)\s*=\s*["'](?:og:image|twitter:image|logo)["']"#).unwrap();
    Regex::new(r"(?is)<(?:img|meta)\b[^>]*>").unwrap().find_iter(&visible_markup).any(|tag| {
        let tag = tag.as_str();
        tag.contains(logo_url) && (tag.contains("src=") || tag.contains("content=")) &&
            ((tag.to_ascii_lowercase().starts_with("<img") && logo_alt.is_match(tag)) ||
             (tag.to_ascii_lowercase().starts_with("<meta") && image_meta.is_match(tag)))
    })
}

#[tauri::command]
pub async fn capture_creator_skill_page(url: String, clip_id: String, index: u8, title: String, kind: String, fetched_at: String, logo_url: Option<String>) -> Result<CreatorSkillPageCapture, String> {
    uuid::Uuid::parse_str(&clip_id).map_err(|_| "Invalid clip ID.".to_string())?;
    if index >= 12 { return Err("Too many source captures.".into()); }
    if kind != "source" && kind != "brand" { return Err("Invalid source capture kind.".into()); }
    if title.len() > 300 || fetched_at.len() > 80 { return Err("Source capture metadata is too long.".into()); }
    let html = fetch_public_page(&url).await?;
    let text = readable_page(&html);
    let page_published_at = page_published_date(&html);
    let linked_logo_url = logo_url.filter(|candidate| {
        Url::parse(candidate).is_ok_and(|parsed| parsed.scheme() == "https" && parsed.username().is_empty() && parsed.password().is_none() && parsed.port().is_none_or(|port| port == 443)) && page_links_logo(&html, candidate)
    });
    let folder = crate::storage::init_storage_dirs().map_err(|error| format!("Could not prepare source folder: {error}"))?.videos;
    let path = folder.join(format!("creator-skill-{clip_id}-source-{index}.txt"));
    let title = title.replace(['\r', '\n'], " ");
    let captured = format!("Kind: {kind}\nProposed title: {title}\nRequested URL: {url}\nCaptured at: {fetched_at}\nPage-advertised publication date: {}\nClaim support and asset rights require human review.\n\n{text}", page_published_at.as_deref().unwrap_or("not found"));
    tokio::fs::write(&path, captured).await.map_err(|error| format!("Could not save source capture: {error}"))?;
    Ok(CreatorSkillPageCapture { path: path.to_string_lossy().to_string(), linked_logo_url, screenshot_html: html.chars().take(64_000).collect(), page_published_at })
}

#[tauri::command]
pub async fn capture_creator_skill_logo(url: String, clip_id: String) -> Result<String, String> {
    uuid::Uuid::parse_str(&clip_id).map_err(|_| "Invalid clip ID.".to_string())?;
    let url = Url::parse(&url).map_err(|_| "Invalid logo URL.".to_string())?;
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() || url.port().is_some_and(|port| port != 443) {
        return Err("Brand logos must use public HTTPS without credentials or custom ports.".into());
    }
    let host = url.host_str().ok_or("Logo URL has no host.")?;
    let addresses = resolve_public_addresses(&url).await?;
    let sockets = addresses.into_iter().map(|address| SocketAddr::new(address, 443)).collect::<Vec<_>>();
    let client = Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(20))
        .resolve_to_addrs(host, &sockets)
        .build().map_err(|error| format!("Could not prepare logo request: {error}"))?;
    let mut response = client.get(url).send().await.map_err(|error| format!("Could not fetch logo: {error}"))?;
    if !response.status().is_success() { return Err(format!("Logo returned HTTP {}.", response.status())); }
    let content_type = response.headers().get(CONTENT_TYPE).and_then(|value| value.to_str().ok()).unwrap_or("").to_ascii_lowercase();
    if !["image/png", "image/jpeg", "image/webp"].iter().any(|kind| content_type.starts_with(kind)) {
        return Err("The proposed logo is not a supported raster image.".into());
    }
    if response.content_length().is_some_and(|size| size > MAX_LOGO_BYTES as u64) { return Err("The proposed logo exceeds 5 MB.".into()); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| format!("Could not read logo: {error}"))? {
        if bytes.len() + chunk.len() > MAX_LOGO_BYTES { return Err("The proposed logo exceeds 5 MB.".into()); }
        bytes.extend_from_slice(&chunk);
    }
    let logo = image::load_from_memory(&bytes).map_err(|_| "Could not decode the proposed logo.".to_string())?;
    if logo.width() > 4096 || logo.height() > 4096 { return Err("The proposed logo dimensions are too large.".into()); }
    let folder = crate::storage::init_storage_dirs().map_err(|error| format!("Could not prepare logo folder: {error}"))?.videos;
    let path = folder.join(format!("creator-skill-{clip_id}-brand-logo.png"));
    logo.save_with_format(&path, image::ImageFormat::Png).map_err(|error| format!("Could not save logo draft: {error}"))?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::{page_links_logo, page_published_date, readable_page};

    #[test]
    fn removes_executable_markup_from_review_text() {
        let text = readable_page("<h1>Acme &amp; Co</h1><script>hidden()</script><p>Published today</p>");
        assert!(text.contains("Acme & Co"));
        assert!(text.contains("Published today"));
        assert!(!text.contains("hidden"));
    }

    #[test]
    fn recognizes_embedded_logo_but_not_an_unrelated_image() {
        let logo = "https://cdn.example/logo.png";
        assert!(page_links_logo(&format!(r#"<img alt="Company logo" src="{logo}">"#), logo));
        assert!(!page_links_logo(&format!(r#"<img alt="Product photo" src="{logo}">"#), logo));
        assert!(!page_links_logo(&format!(r#"<script>const image = '{logo}'</script>"#), logo));
        assert!(!page_links_logo(&format!(r#"<script>const html = '<img alt="Company logo" src="{logo}">'</script>"#), logo));
        assert!(!page_links_logo(&format!(r#"<!-- <img alt="Company logo" src="{logo}"> -->"#), logo));
    }

    #[test]
    fn reads_valid_publication_meta_date() {
        assert_eq!(page_published_date(r#"<meta content="2026-11-02T16:30:00-08:00" property="article:published_time">"#), Some("2026-11-02".into()));
        assert_eq!(page_published_date(r#"<meta property="article:published_time" content="2026-02-30">"#), None);
    }
}
