//! Normalize filesystem paths from the webview (often `file://` URLs or percent-encoded).

/// Strips `file://`, optional `localhost`, and percent-decodes so Rust `Path` matches the real file.
/// macOS / WKWebView frequently passes `file:///...` paths into Tauri commands; using them as-is
/// makes `Path::exists()` fail because the path literally starts with `file:`.
pub fn normalize_local_fs_path(path: String) -> String {
    let trimmed = path.trim();
    if !trimmed.starts_with("file://") {
        return trimmed.to_string();
    }

    let mut rest = trimmed.trim_start_matches("file://").to_string();
    if rest.starts_with("localhost") {
        // `file://localhost/Users/x` → `/Users/x` (do not strip `/` — that breaks absolute paths)
        rest = rest.strip_prefix("localhost").unwrap_or(&rest).to_string();
    }

    if rest.contains('%') {
        if let Ok(decoded) = urlencoding::decode(&rest) {
            return decoded.into_owned();
        }
    }

    rest
}
