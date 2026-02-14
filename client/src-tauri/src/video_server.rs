use warp::{Filter, Reply};
use std::sync::atomic::{AtomicBool, Ordering};
use std::path::{Path, PathBuf};

pub static VIDEO_SERVER_PORT: u16 = 48276;

/// Probe the duration of a .ts file using FFmpeg
async fn probe_ts_duration(file_path: &Path) -> Result<f64, String> {
    use tokio::process::Command;
    use regex::Regex;
    
    // Get FFmpeg path - try exe dir first, then dev path, then system
    let ffmpeg_path = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("ffmpeg.exe")))
        .filter(|p| p.exists())
        .unwrap_or_else(|| {
            let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("binaries")
                .join("ffmpeg-x86_64-pc-windows-msvc.exe");
            if dev_path.exists() { dev_path } else { PathBuf::from("ffmpeg") }
        });
    
    let output = Command::new(&ffmpeg_path)
        .args(["-i", file_path.to_str().ok_or("Invalid path")?])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;
    
    let stderr = String::from_utf8_lossy(&output.stderr);
    let re = Regex::new(r"Duration: (\d{2}):(\d{2}):([\d.]+)").map_err(|e| e.to_string())?;
    
    if let Some(caps) = re.captures(&stderr) {
        let h: f64 = caps.get(1).unwrap().as_str().parse().unwrap_or(0.0);
        let m: f64 = caps.get(2).unwrap().as_str().parse().unwrap_or(0.0);
        let s: f64 = caps.get(3).unwrap().as_str().parse().unwrap_or(0.0);
        let total = h * 3600.0 + m * 60.0 + s;
        if total > 0.0 { return Ok(total); }
    }
    Err("Duration not found".to_string())
}

pub async fn start_video_server_impl() {
    static SERVER_STARTED: AtomicBool = AtomicBool::new(false);

    if SERVER_STARTED.swap(true, Ordering::SeqCst) {
        return; // Server already running
    }

    // HEAD route for video health checks with CORS headers
    let video_head_route = warp::path!("video" / String)
        .and(warp::head())
        .and_then(|encoded_path: String| async move {
            use base64::{Engine as _, engine::general_purpose};
            let decoded = match general_purpose::STANDARD.decode(&encoded_path) {
                Ok(d) => d,
                Err(_) => {
                    let resp = warp::reply::with_header("", "Access-Control-Allow-Origin", "*");
                    return Ok::<_, warp::Rejection>(warp::reply::with_status(resp, warp::http::StatusCode::BAD_REQUEST).into_response());
                }
            };
            let path_str = match String::from_utf8(decoded) {
                Ok(s) => s,
                Err(_) => {
                    let resp = warp::reply::with_header("", "Access-Control-Allow-Origin", "*");
                    return Ok(warp::reply::with_status(resp, warp::http::StatusCode::BAD_REQUEST).into_response());
                }
            };
            let file_path = PathBuf::from(&path_str);
            if !file_path.exists() {
                let resp = warp::reply::with_header("", "Access-Control-Allow-Origin", "*");
                return Ok(warp::reply::with_status(resp, warp::http::StatusCode::NOT_FOUND).into_response());
            }
            let file_size = tokio::fs::metadata(&file_path).await.map(|m| m.len()).unwrap_or(0);
            let content_type = match file_path.extension().and_then(|e| e.to_str()) {
                Some("mp4") => "video/mp4",
                Some("webm") => "video/webm",
                _ => "application/octet-stream",
            };
            let resp = warp::reply::with_header("", "Content-Type", content_type);
            let resp = warp::reply::with_header(resp, "Content-Length", file_size.to_string());
            let resp = warp::reply::with_header(resp, "Accept-Ranges", "bytes");
            let resp = warp::reply::with_header(resp, "Access-Control-Allow-Origin", "*");
            let resp = warp::reply::with_header(resp, "Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
            Ok(warp::reply::with_status(resp, warp::http::StatusCode::OK).into_response())
        });

    let video_route = warp::path!("video" / String)
        .and(warp::get())
        .and(warp::header::optional::<String>("range"))
        .and_then(|encoded_path: String, range_header: Option<String>| async move {
            // Decode the base64-encoded path
            use base64::{Engine as _, engine::general_purpose};
            let decoded = match general_purpose::STANDARD.decode(encoded_path) {
                Ok(d) => d,
                Err(_) => {
                    return Ok::<_, warp::Rejection>(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Invalid path encoding"})),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let path_str = match String::from_utf8(decoded) {
                Ok(s) => s,
                Err(_) => {
                    return Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Invalid path encoding"})),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let file_path = PathBuf::from(&path_str);

            if !file_path.exists() {
                return Ok(warp::reply::with_status(
                    warp::reply::json(&serde_json::json!({"error": "File not found"})),
                    warp::http::StatusCode::NOT_FOUND
                ).into_response());
            }

            // Get file metadata
            let metadata = match tokio::fs::metadata(&file_path).await {
                Ok(m) => m,
                Err(_) => {
                    return Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Cannot read file metadata"})),
                        warp::http::StatusCode::INTERNAL_SERVER_ERROR
                    ).into_response());
                }
            };

            let file_size = metadata.len();

            // Determine content type
            let content_type = match file_path.extension().and_then(|e| e.to_str()) {
                // Video formats
                Some("mp4") => "video/mp4",
                Some("webm") => "video/webm",
                Some("mov") => "video/quicktime",
                Some("avi") => "video/x-msvideo",
                Some("mkv") => "video/x-matroska",
                // Audio formats
                Some("mp3") => "audio/mpeg",
                Some("wav") => "audio/wav",
                Some("flac") => "audio/flac",
                Some("aac") => "audio/aac",
                Some("m4a") => "audio/mp4",
                Some("ogg") => "audio/ogg",
                Some("wma") => "audio/x-ms-wma",
                _ => "application/octet-stream",
            };

            // Always require range requests for large files to prevent memory overflow
            const LARGE_FILE_THRESHOLD: u64 = 50 * 1024 * 1024; // 50MB

            // Handle Range header for seeking support
            match range_header {
                Some(range) => {
                    // Parse Range header: "bytes=start-end"
                    if let Some(range_str) = range.strip_prefix("bytes=") {
                        let parts: Vec<&str> = range_str.split('-').collect();
                        if parts.len() == 2 {
                            let start = if parts[0].is_empty() {
                                0
                            } else {
                                parts[0].parse::<u64>().unwrap_or(0)
                            };

                            let requested_end = if parts[1].is_empty() {
                                file_size - 1
                            } else {
                                parts[1].parse::<u64>().unwrap_or(file_size - 1)
                            };
                            
                            // Clamp end to file size (standard HTTP range behavior)
                            let end = std::cmp::min(requested_end, file_size - 1);

                            // Validate range
                            if start < file_size && start <= end {
                                let content_length = end - start + 1;

                                // For very large ranges, serve the first 50MB chunk instead
                                let actual_end = if content_length > LARGE_FILE_THRESHOLD {
                                    start + LARGE_FILE_THRESHOLD - 1
                                } else {
                                    end
                                };
                                let actual_content_length = actual_end - start + 1;

                                // Open file and seek to start position
                                match tokio::fs::File::open(&file_path).await {
                                    Ok(mut file) => {
                                        use tokio::io::{AsyncSeekExt, AsyncReadExt};

                                        if let Err(e) = file.seek(std::io::SeekFrom::Start(start)).await {
                                            eprintln!("Failed to seek to position {}: {}", start, e);
                                            return Ok(warp::reply::with_status(
                                                warp::reply::json(&serde_json::json!({"error": "Cannot seek in file"})),
                                                warp::http::StatusCode::INTERNAL_SERVER_ERROR
                                            ).into_response());
                                        }

                                        let mut buffer = vec![0u8; actual_content_length as usize];
                                        if let Err(e) = file.read_exact(&mut buffer).await {
                                            eprintln!("Failed to read range {}-{}: {}", start, actual_end, e);
                                            return Ok(warp::reply::with_status(
                                                warp::reply::json(&serde_json::json!({"error": "Cannot read file range"})),
                                                warp::http::StatusCode::INTERNAL_SERVER_ERROR
                                            ).into_response());
                                        }

                                        eprintln!("Serving range {}-{}/{} ({} bytes, requested: {}-{}) for file: {}",
                                            start, actual_end, file_size, actual_content_length, start, end, file_path.display());

                                        // Return 206 Partial Content with actual served range
                                        let response = warp::reply::with_header(
                                            warp::reply::with_header(
                                                buffer,
                                                "Content-Range",
                                                format!("bytes {}-{}/{}", start, actual_end, file_size)
                                            ),
                                            "Content-Length",
                                            actual_content_length.to_string()
                                        );

                                        let response = warp::reply::with_header(
                                            response,
                                            "Content-Type",
                                            content_type
                                        );

                                        let response = warp::reply::with_header(
                                            response,
                                            "Accept-Ranges",
                                            "bytes"
                                        );

                                        // Add CORS headers for Web Audio API support
                                        let response = warp::reply::with_header(
                                            response,
                                            "Access-Control-Allow-Origin",
                                            "*"
                                        );

                                        let response = warp::reply::with_header(
                                            response,
                                            "Access-Control-Expose-Headers",
                                            "Content-Range, Content-Length, Accept-Ranges"
                                        );

                                        return Ok(warp::reply::with_status(
                                            response,
                                            warp::http::StatusCode::PARTIAL_CONTENT
                                        ).into_response());
                                    }
                                    Err(e) => {
                                        eprintln!("Failed to open file for range request: {}", e);
                                        return Ok(warp::reply::with_status(
                                            warp::reply::json(&serde_json::json!({"error": "Cannot open file"})),
                                            warp::http::StatusCode::INTERNAL_SERVER_ERROR
                                        ).into_response());
                                    }
                                }
                            }
                        }
                    }

                    // If range parsing failed, return error
                    Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Invalid range header"})),
                        warp::http::StatusCode::RANGE_NOT_SATISFIABLE
                    ).into_response())
                }
                None => {
                    // No range header - only serve small files entirely
                    if file_size <= LARGE_FILE_THRESHOLD {
                        // Small file: serve normally
                        let bytes = match tokio::fs::read(&file_path).await {
                            Ok(b) => b,
                            Err(e) => {
                                eprintln!("Failed to read small file {}: {}", file_path.display(), e);
                                return Ok(warp::reply::with_status(
                                    warp::reply::json(&serde_json::json!({"error": "Cannot read file"})),
                                    warp::http::StatusCode::INTERNAL_SERVER_ERROR
                                ).into_response());
                            }
                        };

                        let response = warp::reply::with_header(
                            warp::reply::with_header(
                                bytes,
                                "Content-Length",
                                file_size.to_string()
                            ),
                            "Content-Type",
                            content_type
                        );

                        let response = warp::reply::with_header(
                            response,
                            "Accept-Ranges",
                            "bytes"
                        );

                        // Add CORS headers for Web Audio API support
                        let response = warp::reply::with_header(
                            response,
                            "Access-Control-Allow-Origin",
                            "*"
                        );

                        Ok(response.into_response())
                    } else {
                        // Large file without range: require range request
                        Ok(warp::reply::with_status(
                            warp::reply::json(&serde_json::json!({
                                "error": "Range header required",
                                "message": "Files larger than 50MB require range requests",
                                "file_size": file_size,
                                "content_type": content_type
                            })),
                            warp::http::StatusCode::RANGE_NOT_SATISFIABLE
                        ).into_response())
                    }
                }
            }
        });

    // HLS playlist HEAD route for existence check: /hls/{base64_dir_path}/playlist.m3u8
    let hls_playlist_head_route = warp::path!("hls" / String / "playlist.m3u8")
        .and(warp::head())
        .and_then(|encoded_dir: String| async move {
            use base64::{Engine as _, engine::general_purpose};
            
            let decoded = match general_purpose::STANDARD.decode(&encoded_dir) {
                Ok(d) => d,
                Err(_) => {
                    return Ok::<_, warp::Rejection>(warp::reply::with_status(
                        warp::reply::with_header(
                            warp::reply::with_header(
                                "",
                                "Access-Control-Allow-Origin",
                                "*"
                            ),
                            "Access-Control-Allow-Methods",
                            "GET, HEAD, OPTIONS"
                        ),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let dir_str = match String::from_utf8(decoded) {
                Ok(s) => s,
                Err(_) => {
                    return Ok(warp::reply::with_status(
                        warp::reply::with_header(
                            warp::reply::with_header(
                                "",
                                "Access-Control-Allow-Origin",
                                "*"
                            ),
                            "Access-Control-Allow-Methods",
                            "GET, HEAD, OPTIONS"
                        ),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let playlist_path = PathBuf::from(&dir_str).join("playlist.m3u8");

            if !playlist_path.exists() {
                return Ok(warp::reply::with_status(
                    warp::reply::with_header(
                        warp::reply::with_header(
                            "",
                            "Access-Control-Allow-Origin",
                            "*"
                        ),
                        "Access-Control-Allow-Methods",
                        "GET, HEAD, OPTIONS"
                    ),
                    warp::http::StatusCode::NOT_FOUND
                ).into_response());
            }

            // File exists - return 200 OK with CORS headers
            let response = warp::reply::with_header(
                warp::reply::with_header(
                    warp::reply::with_header(
                        "",
                        "Content-Type",
                        "application/vnd.apple.mpegurl"
                    ),
                    "Access-Control-Allow-Origin",
                    "*"
                ),
                "Access-Control-Allow-Methods",
                "GET, HEAD, OPTIONS"
            );
            Ok(response.into_response())
        });

    // HLS playlist .tmp HEAD route: /hls/{base64_dir_path}/playlist.m3u8.tmp
    let hls_playlist_tmp_head_route = warp::path!("hls" / String / "playlist.m3u8.tmp")
        .and(warp::head())
        .and_then(|encoded_dir: String| async move {
            use base64::{Engine as _, engine::general_purpose};
            
            let decoded = match general_purpose::STANDARD.decode(&encoded_dir) {
                Ok(d) => d,
                Err(_) => {
                    return Ok::<_, warp::Rejection>(warp::reply::with_status(
                        warp::reply::with_header(
                            warp::reply::with_header(
                                "",
                                "Access-Control-Allow-Origin",
                                "*"
                            ),
                            "Access-Control-Allow-Methods",
                            "GET, HEAD, OPTIONS"
                        ),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let dir_str = match String::from_utf8(decoded) {
                Ok(s) => s,
                Err(_) => {
                    return Ok(warp::reply::with_status(
                        warp::reply::with_header(
                            warp::reply::with_header(
                                "",
                                "Access-Control-Allow-Origin",
                                "*"
                            ),
                            "Access-Control-Allow-Methods",
                            "GET, HEAD, OPTIONS"
                        ),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let playlist_tmp = PathBuf::from(&dir_str).join("playlist.m3u8.tmp");
            let playlist_final = PathBuf::from(&dir_str).join("playlist.m3u8");

            // Accept either the tmp (preferred) or the stable playlist
            if !playlist_tmp.exists() && !playlist_final.exists() {
                return Ok(warp::reply::with_status(
                    warp::reply::with_header(
                        warp::reply::with_header(
                            "",
                            "Access-Control-Allow-Origin",
                            "*"
                        ),
                        "Access-Control-Allow-Methods",
                        "GET, HEAD, OPTIONS"
                    ),
                    warp::http::StatusCode::NOT_FOUND
                ).into_response());
            }

            // File exists - return 200 OK with CORS headers
            let response = warp::reply::with_header(
                warp::reply::with_header(
                    warp::reply::with_header(
                        "",
                        "Content-Type",
                        "application/vnd.apple.mpegurl"
                    ),
                    "Access-Control-Allow-Origin",
                    "*"
                ),
                "Access-Control-Allow-Methods",
                "GET, HEAD, OPTIONS"
            );
            Ok(response.into_response())
        });

    // HLS playlist GET route: /hls/{base64_dir_path}/playlist.m3u8
    let hls_playlist_route = warp::path!("hls" / String / "playlist.m3u8")
        .and(warp::get())
        .and_then(|encoded_dir: String| async move {
            use base64::{Engine as _, engine::general_purpose};
            
            // Try multiple base64 variants: STANDARD, STANDARD_NO_PAD, URL_SAFE_NO_PAD
            let decoded = general_purpose::STANDARD.decode(&encoded_dir)
                .or_else(|_| general_purpose::STANDARD_NO_PAD.decode(&encoded_dir))
                .or_else(|_| general_purpose::URL_SAFE_NO_PAD.decode(&encoded_dir));
            let decoded = match decoded {
                Ok(d) => d,
                Err(_) => {
                    return Ok::<_, warp::Rejection>(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Invalid directory encoding"})),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let dir_str = match String::from_utf8(decoded) {
                Ok(s) => s,
                Err(_) => {
                    return Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Invalid directory encoding"})),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let playlist_path = PathBuf::from(&dir_str).join("playlist.m3u8");

            if !playlist_path.exists() {
                return Ok(warp::reply::with_status(
                    warp::reply::json(&serde_json::json!({"error": "Playlist not found"})),
                    warp::http::StatusCode::NOT_FOUND
                ).into_response());
            }

            match tokio::fs::read(&playlist_path).await {
                Ok(content) => {
                    let response = warp::reply::with_header(
                        content,
                        "Content-Type",
                        "application/vnd.apple.mpegurl"
                    );
                    let response = warp::reply::with_header(
                        response,
                        "Access-Control-Allow-Origin",
                        "*"
                    );
                    // Prevent caching for live playlist
                    let response = warp::reply::with_header(
                        response,
                        "Cache-Control",
                        "no-cache, no-store, must-revalidate"
                    );
                    Ok(response.into_response())
                }
                Err(e) => {
                    eprintln!("Failed to read HLS playlist: {}", e);
                    Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Cannot read playlist"})),
                        warp::http::StatusCode::INTERNAL_SERVER_ERROR
                    ).into_response())
                }
            }
        });

    // HLS playlist .tmp GET route: /hls/{base64_dir_path}/playlist.m3u8.tmp
    let hls_playlist_tmp_route = warp::path!("hls" / String / "playlist.m3u8.tmp")
        .and(warp::get())
        .and_then(|encoded_dir: String| async move {
            use base64::{Engine as _, engine::general_purpose};
            
            let decoded = match general_purpose::STANDARD.decode(&encoded_dir) {
                Ok(d) => d,
                Err(_) => {
                    return Ok::<_, warp::Rejection>(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Invalid directory encoding"})),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let dir_str = match String::from_utf8(decoded) {
                Ok(s) => s,
                Err(_) => {
                    return Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Invalid directory encoding"})),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let playlist_tmp = PathBuf::from(&dir_str).join("playlist.m3u8.tmp");
            let playlist_final = PathBuf::from(&dir_str).join("playlist.m3u8");

            // Prefer tmp (newest), fall back to stable playlist if tmp not present
            let playlist_path = if playlist_tmp.exists() {
                playlist_tmp
            } else if playlist_final.exists() {
                playlist_final
            } else {
                return Ok(warp::reply::with_status(
                    warp::reply::json(&serde_json::json!({"error": "Playlist not found"})),
                    warp::http::StatusCode::NOT_FOUND
                ).into_response());
            };

            match tokio::fs::read(&playlist_path).await {
                Ok(content) => {
                    let response = warp::reply::with_header(
                        content,
                        "Content-Type",
                        "application/vnd.apple.mpegurl"
                    );
                    let response = warp::reply::with_header(
                        response,
                        "Access-Control-Allow-Origin",
                        "*"
                    );
                    // Prevent caching for live playlist
                    let response = warp::reply::with_header(
                        response,
                        "Cache-Control",
                        "no-cache, no-store, must-revalidate"
                    );
                    Ok(response.into_response())
                }
                Err(e) => {
                    eprintln!("Failed to read HLS playlist tmp: {}", e);
                    Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Cannot read playlist"})),
                        warp::http::StatusCode::INTERNAL_SERVER_ERROR
                    ).into_response())
                }
            }
        });

    // HLS segment route: /hls/{base64_dir_path}/{segment_filename}
    let hls_segment_route = warp::path!("hls" / String / String)
        .and(warp::get())
        .and_then(|encoded_dir: String, segment_filename: String| async move {
            use base64::{Engine as _, engine::general_purpose};

            // Only allow .ts files
            if !segment_filename.ends_with(".ts") {
                return Ok::<_, warp::Rejection>(warp::reply::with_status(
                    warp::reply::json(&serde_json::json!({"error": "Invalid segment file type"})),
                    warp::http::StatusCode::BAD_REQUEST
                ).into_response());
            }

            // Try multiple base64 variants: STANDARD, STANDARD_NO_PAD, URL_SAFE_NO_PAD
            let decoded = general_purpose::STANDARD.decode(&encoded_dir)
                .or_else(|_| general_purpose::STANDARD_NO_PAD.decode(&encoded_dir))
                .or_else(|_| general_purpose::URL_SAFE_NO_PAD.decode(&encoded_dir));
            let decoded = match decoded {
                Ok(d) => d,
                Err(_) => {
                    return Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Invalid directory encoding"})),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let dir_str = match String::from_utf8(decoded) {
                Ok(s) => s,
                Err(_) => {
                    return Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Invalid directory encoding"})),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let segment_path = PathBuf::from(&dir_str).join(&segment_filename);

            if !segment_path.exists() {
                return Ok(warp::reply::with_status(
                    warp::reply::json(&serde_json::json!({"error": "Segment not found"})),
                    warp::http::StatusCode::NOT_FOUND
                ).into_response());
            }

            match tokio::fs::read(&segment_path).await {
                Ok(content) => {
                    let file_size = content.len();
                    let response = warp::reply::with_header(content, "Content-Type", "video/mp2t");
                    let response = warp::reply::with_header(response, "Content-Length", file_size.to_string());
                    let response = warp::reply::with_header(response, "Access-Control-Allow-Origin", "*");
                    // Live DVR: disable caching so HLS.js always fetches fresh segments
                    let response = warp::reply::with_header(
                        response,
                        "Cache-Control",
                        "no-cache, no-store, must-revalidate"
                    );
                    let response = warp::reply::with_header(response, "Pragma", "no-cache");
                    let response = warp::reply::with_header(response, "Expires", "0");
                    Ok(response.into_response())
                }
                Err(e) => {
                    eprintln!("Failed to read HLS segment {}: {}", segment_filename, e);
                    Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Cannot read segment"})),
                        warp::http::StatusCode::INTERNAL_SERVER_ERROR
                    ).into_response())
                }
            }
        });

    // Kick HLS proxy route - proxies Kick's HLS stream to bypass origin restrictions
    let kick_hls_proxy_route = warp::path!("kick-hls-proxy" / String)
        .and(warp::get())
        .and_then(|encoded_url: String| async move {
            use base64::{Engine as _, engine::general_purpose};

            // Try URL_SAFE_NO_PAD first (JS btoa with manual conversion), then fallbacks
            let decoded = general_purpose::URL_SAFE_NO_PAD.decode(&encoded_url)
                .or_else(|_| general_purpose::URL_SAFE.decode(&encoded_url))
                .or_else(|_| general_purpose::STANDARD.decode(&encoded_url));

            let decoded = match decoded {
                Ok(d) => d,
                Err(e) => {
                    eprintln!("Kick proxy: Base64 decode failed: {:?}", e);
                    return Ok::<_, warp::Rejection>(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Invalid URL encoding"})),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let url_str = match String::from_utf8(decoded) {
                Ok(s) => s,
                Err(_) => {
                    return Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Invalid UTF-8 in URL"})),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            println!("Kick proxy: Fetching {}", &url_str[..std::cmp::min(80, url_str.len())]);

            // Validate it's a Kick-related URL for security
            if !url_str.contains("kick.com") && !url_str.contains("live-video.net") && !url_str.contains("kick.live") {
                eprintln!("Kick proxy: URL not allowed: {}", &url_str[..std::cmp::min(50, url_str.len())]);
                return Ok(warp::reply::with_status(
                    warp::reply::json(&serde_json::json!({"error": "Only Kick URLs allowed"})),
                    warp::http::StatusCode::FORBIDDEN
                ).into_response());
            }

            // Fetch from Kick with proper headers
            let client = reqwest::Client::builder()
                .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .build()
                .unwrap_or_else(|_| reqwest::Client::new());

            match client.get(&url_str)
                .header("Referer", "https://kick.com/")
                .header("Origin", "https://kick.com")
                .send()
                .await
            {
                Ok(resp) => {
                    if !resp.status().is_success() {
                        eprintln!("Kick proxy: Upstream error {}", resp.status());
                        return Ok(warp::reply::with_status(
                            warp::reply::json(&serde_json::json!({"error": format!("Upstream: {}", resp.status())})),
                            warp::http::StatusCode::BAD_GATEWAY
                        ).into_response());
                    }

                    let content_type = if url_str.contains(".m3u8") {
                        "application/vnd.apple.mpegurl"
                    } else if url_str.contains(".ts") {
                        "video/mp2t"
                    } else {
                        "application/octet-stream"
                    };

                    match resp.bytes().await {
                        Ok(body) => {
                            // For m3u8 playlists, rewrite URLs to go through proxy
                            let final_body = if url_str.contains(".m3u8") {
                                let playlist = String::from_utf8_lossy(&body);
                                let base = url_str.rsplit_once('/').map(|(b, _)| b).unwrap_or(&url_str);

                                let rewritten: String = playlist.lines().map(|line| {
                                    if line.starts_with('#') || line.trim().is_empty() {
                                        line.to_string()
                                    } else {
                                        let abs = if line.starts_with("http") {
                                            line.to_string()
                                        } else {
                                            format!("{}/{}", base, line)
                                        };
                                        let enc = general_purpose::URL_SAFE_NO_PAD.encode(abs.as_bytes());
                                        format!("http://127.0.0.1:{}/kick-hls-proxy/{}", VIDEO_SERVER_PORT, enc)
                                    }
                                }).collect::<Vec<_>>().join("\n");

                                rewritten.into_bytes()
                            } else {
                                body.to_vec()
                            };

                            let response = warp::reply::with_header(final_body, "Content-Type", content_type);
                            let response = warp::reply::with_header(response, "Access-Control-Allow-Origin", "*");
                            let cache = if url_str.contains(".m3u8") { "no-cache" } else { "max-age=3600" };
                            let response = warp::reply::with_header(response, "Cache-Control", cache);
                            Ok(response.into_response())
                        }
                        Err(e) => {
                            eprintln!("Kick proxy: Body read error: {}", e);
                            Ok(warp::reply::with_status(
                                warp::reply::json(&serde_json::json!({"error": "Body read failed"})),
                                warp::http::StatusCode::BAD_GATEWAY
                            ).into_response())
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Kick proxy: Fetch error: {}", e);
                    Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": format!("Fetch failed: {}", e)})),
                        warp::http::StatusCode::BAD_GATEWAY
                    ).into_response())
                }
            }
        });

    // Single TS file HLS wrapper - generates an on-the-fly HLS playlist for a single .ts file
    // This allows HLS.js to play standalone .ts segment files that browsers can't play natively
    // Route: /ts-hls/{base64_file_path}/playlist.m3u8
    let ts_hls_playlist_route = warp::path!("ts-hls" / String / "playlist.m3u8")
        .and(warp::get())
        .and_then(|encoded_path: String| async move {
            use base64::{Engine as _, engine::general_purpose};

            // Decode the base64-encoded file path
            let decoded = general_purpose::STANDARD.decode(&encoded_path)
                .or_else(|_| general_purpose::STANDARD_NO_PAD.decode(&encoded_path))
                .or_else(|_| general_purpose::URL_SAFE_NO_PAD.decode(&encoded_path));
            let decoded = match decoded {
                Ok(d) => d,
                Err(_) => {
                    return Ok::<_, warp::Rejection>(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Invalid path encoding"})),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let file_path_str = match String::from_utf8(decoded) {
                Ok(s) => s,
                Err(_) => {
                    return Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Invalid path encoding"})),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let file_path = PathBuf::from(&file_path_str);

            // Verify the file exists and is a .ts file
            if !file_path.exists() {
                return Ok(warp::reply::with_status(
                    warp::reply::json(&serde_json::json!({"error": "File not found"})),
                    warp::http::StatusCode::NOT_FOUND
                ).into_response());
            }

            if file_path.extension().and_then(|e| e.to_str()) != Some("ts") {
                return Ok(warp::reply::with_status(
                    warp::reply::json(&serde_json::json!({"error": "Not a .ts file"})),
                    warp::http::StatusCode::BAD_REQUEST
                ).into_response());
            }

            // Probe actual duration using FFmpeg
            let duration = match probe_ts_duration(&file_path).await {
                Ok(d) => { eprintln!("[ts-hls] Probed duration: {:.2}s", d); d }
                Err(_) => {
                    // Fallback: estimate from file size (~2MB/min)
                    let size = tokio::fs::metadata(&file_path).await.map(|m| m.len()).unwrap_or(0);
                    ((size as f64) / (2.0 * 1024.0 * 1024.0) * 60.0).max(10.0)
                }
            };

            // Get file size for byte-range playlist generation
            let file_size = match tokio::fs::metadata(&file_path).await {
                Ok(m) => m.len(),
                Err(_) => 0,
            };

            // Get the filename for the segment reference
            let filename = file_path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("segment.ts");

            // Generate HLS playlist. For large .ts files, use byte-range segments
            // so HLS.js can request small chunks instead of downloading the entire file.
            const BYTE_RANGE_THRESHOLD: u64 = 50 * 1024 * 1024; // 50MB
            const BYTE_RANGE_CHUNK_SIZE: u64 = 5 * 1024 * 1024; // 5MB

            let playlist = if file_size > BYTE_RANGE_THRESHOLD {
                let segment_count = file_size.div_ceil(BYTE_RANGE_CHUNK_SIZE).max(1);
                let segment_duration = (duration / segment_count as f64).max(0.1);
                let target_duration = (segment_duration.ceil() as u64).max(1);

                let mut playlist = String::new();
                playlist.push_str("#EXTM3U\n");
                playlist.push_str("#EXT-X-VERSION:3\n");
                playlist.push_str(&format!("#EXT-X-TARGETDURATION:{}\n", target_duration));
                playlist.push_str("#EXT-X-MEDIA-SEQUENCE:0\n");
                playlist.push_str("#EXT-X-PLAYLIST-TYPE:VOD\n");

                let mut offset = 0u64;
                for _ in 0..segment_count {
                    let remaining = file_size.saturating_sub(offset);
                    let byte_len = remaining.min(BYTE_RANGE_CHUNK_SIZE);
                    if byte_len == 0 {
                        break;
                    }
                    playlist.push_str(&format!("#EXTINF:{:.6},\n", segment_duration));
                    playlist.push_str(&format!("#EXT-X-BYTERANGE:{}@{}\n", byte_len, offset));
                    playlist.push_str(&format!("{}\n", filename));
                    offset = offset.saturating_add(byte_len);
                }

                playlist.push_str("#EXT-X-ENDLIST\n");
                playlist
            } else {
                // Small file - single segment playlist
                format!(
                    "#EXTM3U\n\
                    #EXT-X-VERSION:3\n\
                    #EXT-X-TARGETDURATION:{}\n\
                    #EXT-X-MEDIA-SEQUENCE:0\n\
                    #EXT-X-PLAYLIST-TYPE:VOD\n\
                    #EXTINF:{:.6},\n\
                    {}\n\
                    #EXT-X-ENDLIST\n",
                    (duration as u64) + 1,
                    duration,
                    filename
                )
            };

            let response = warp::reply::with_header(
                playlist,
                "Content-Type",
                "application/vnd.apple.mpegurl"
            );
            let response = warp::reply::with_header(
                response,
                "Access-Control-Allow-Origin",
                "*"
            );
            let response = warp::reply::with_header(
                response,
                "Cache-Control",
                "no-cache"
            );
            Ok(response.into_response())
        });

    // Single TS file segment serving route - serves the actual .ts file with Range support
    // Route: /ts-hls/{base64_file_path}/{segment_filename}
    let ts_hls_segment_route = warp::path!("ts-hls" / String / String)
        .and(warp::get())
        .and(warp::header::optional::<String>("range"))
        .and_then(|encoded_path: String, _segment_filename: String, range_header: Option<String>| async move {
            use base64::{Engine as _, engine::general_purpose};
            use tokio::io::{AsyncReadExt, AsyncSeekExt};

            // Decode the base64-encoded file path
            let decoded = general_purpose::STANDARD.decode(&encoded_path)
                .or_else(|_| general_purpose::STANDARD_NO_PAD.decode(&encoded_path))
                .or_else(|_| general_purpose::URL_SAFE_NO_PAD.decode(&encoded_path));
            let decoded = match decoded {
                Ok(d) => d,
                Err(_) => {
                    return Ok::<_, warp::Rejection>(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Invalid path encoding"})),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let file_path_str = match String::from_utf8(decoded) {
                Ok(s) => s,
                Err(_) => {
                    return Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Invalid path encoding"})),
                        warp::http::StatusCode::BAD_REQUEST
                    ).into_response());
                }
            };

            let file_path = PathBuf::from(&file_path_str);

            if !file_path.exists() {
                return Ok(warp::reply::with_status(
                    warp::reply::json(&serde_json::json!({"error": "Segment not found"})),
                    warp::http::StatusCode::NOT_FOUND
                ).into_response());
            }

            // Get file size
            let metadata = match tokio::fs::metadata(&file_path).await {
                Ok(m) => m,
                Err(_) => {
                    return Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Cannot read file metadata"})),
                        warp::http::StatusCode::INTERNAL_SERVER_ERROR
                    ).into_response());
                }
            };
            let file_size = metadata.len();

            // Handle Range requests for efficient streaming (critical for large .ts files)
            if let Some(range) = range_header {
                if let Some(range_str) = range.strip_prefix("bytes=") {
                    let parts: Vec<&str> = range_str.split('-').collect();
                    if parts.len() == 2 {
                        let start = if parts[0].is_empty() { 0 } else { parts[0].parse::<u64>().unwrap_or(0) };
                        let requested_end = if parts[1].is_empty() { file_size - 1 } else { parts[1].parse::<u64>().unwrap_or(file_size - 1) };
                        let end = std::cmp::min(requested_end, file_size - 1);

                        if start < file_size && start <= end {
                            let content_length = end - start + 1;

                            match tokio::fs::File::open(&file_path).await {
                                Ok(mut file) => {
                                    if (file.seek(std::io::SeekFrom::Start(start)).await).is_err() {
                                        return Ok(warp::reply::with_status(
                                            warp::reply::json(&serde_json::json!({"error": "Cannot seek in file"})),
                                            warp::http::StatusCode::INTERNAL_SERVER_ERROR
                                        ).into_response());
                                    }

                                    let mut buffer = vec![0u8; content_length as usize];
                                    if (file.read_exact(&mut buffer).await).is_err() {
                                        return Ok(warp::reply::with_status(
                                            warp::reply::json(&serde_json::json!({"error": "Cannot read file range"})),
                                            warp::http::StatusCode::INTERNAL_SERVER_ERROR
                                        ).into_response());
                                    }

                                    let response = warp::reply::with_header(buffer, "Content-Type", "video/mp2t");
                                    let response = warp::reply::with_header(
                                        response,
                                        "Content-Range",
                                        format!("bytes {}-{}/{}", start, end, file_size)
                                    );
                                    let response = warp::reply::with_header(response, "Content-Length", content_length.to_string());
                                    let response = warp::reply::with_header(response, "Accept-Ranges", "bytes");
                                    let response = warp::reply::with_header(response, "Access-Control-Allow-Origin", "*");
                                    let response = warp::reply::with_header(response, "Cache-Control", "max-age=3600");
                                    return Ok(warp::reply::with_status(response, warp::http::StatusCode::PARTIAL_CONTENT).into_response());
                                }
                                Err(_) => {
                                    return Ok(warp::reply::with_status(
                                        warp::reply::json(&serde_json::json!({"error": "Cannot open file"})),
                                        warp::http::StatusCode::INTERNAL_SERVER_ERROR
                                    ).into_response());
                                }
                            }
                        }
                    }
                }
            }

            // No range header - serve entire file for VOD segments
            match tokio::fs::read(&file_path).await {
                Ok(content) => {
                    let response = warp::reply::with_header(content, "Content-Type", "video/mp2t");
                    let response = warp::reply::with_header(response, "Content-Length", file_size.to_string());
                    let response = warp::reply::with_header(response, "Accept-Ranges", "bytes");
                    let response = warp::reply::with_header(response, "Access-Control-Allow-Origin", "*");
                    let response = warp::reply::with_header(response, "Cache-Control", "max-age=3600");
                    Ok(response.into_response())
                }
                Err(e) => {
                    eprintln!("Failed to read TS file {}: {}", file_path.display(), e);
                    Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Cannot read file"})),
                        warp::http::StatusCode::INTERNAL_SERVER_ERROR
                    ).into_response())
                }
            }
        });

    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "HEAD", "OPTIONS"])
        .allow_headers(vec!["Content-Type", "Range", "Accept", "Origin", "Access-Control-Request-Private-Network"])
        .expose_headers(vec!["Content-Range", "Content-Length", "Accept-Ranges"]);

    // Chrome Private Network Access (PNA) policy: requests from http://tauri.localhost
    // (non-loopback origin) to http://127.0.0.1 (loopback) require this header on ALL
    // responses including preflight OPTIONS. Without it, production builds cannot reach
    // the local video/HLS server.
    let pna_header = warp::reply::with::header(
        "Access-Control-Allow-Private-Network",
        "true",
    );

    let routes = video_head_route.or(video_route).or(hls_playlist_head_route)
        .or(hls_playlist_tmp_head_route)
        .or(hls_playlist_route)
        .or(hls_playlist_tmp_route)
        .or(hls_segment_route)
        .or(ts_hls_playlist_route)
        .or(ts_hls_segment_route)
        .or(kick_hls_proxy_route)
        .with(cors)
        .with(pna_header);

    println!("Starting local video server on port {}", VIDEO_SERVER_PORT);
    warp::serve(routes).run(([127, 0, 0, 1], VIDEO_SERVER_PORT)).await;
}