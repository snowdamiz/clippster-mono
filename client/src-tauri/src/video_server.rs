use warp::{Filter, Reply};
use std::sync::atomic::{AtomicBool, Ordering};
use std::path::PathBuf;

pub static VIDEO_SERVER_PORT: u16 = 48276;

pub async fn start_video_server_impl() {
    static SERVER_STARTED: AtomicBool = AtomicBool::new(false);

    if SERVER_STARTED.swap(true, Ordering::SeqCst) {
        return; // Server already running
    }

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
                Some("mp4") => "video/mp4",
                Some("webm") => "video/webm",
                Some("mov") => "video/quicktime",
                Some("avi") => "video/x-msvideo",
                Some("mkv") => "video/x-matroska",
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

                            let end = if parts[1].is_empty() {
                                file_size - 1
                            } else {
                                parts[1].parse::<u64>().unwrap_or(file_size - 1)
                            };

                            // Validate range and ensure it's not too large
                            if start < file_size && end < file_size && start <= end {
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
                    return Ok(warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({"error": "Invalid range header"})),
                        warp::http::StatusCode::RANGE_NOT_SATISFIABLE
                    ).into_response());
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

                        return Ok(response.into_response());
                    } else {
                        // Large file without range: require range request
                        return Ok(warp::reply::with_status(
                            warp::reply::json(&serde_json::json!({
                                "error": "Range header required",
                                "message": "Files larger than 50MB require range requests",
                                "file_size": file_size,
                                "content_type": content_type
                            })),
                            warp::http::StatusCode::RANGE_NOT_SATISFIABLE
                        ).into_response());
                    }
                }
            }
        });

    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "OPTIONS"])
        .allow_headers(vec!["Content-Type", "Range"]);

    let routes = video_route.with(cors);

    println!("Starting local video server on port {}", VIDEO_SERVER_PORT);
    warp::serve(routes).run(([127, 0, 0, 1], VIDEO_SERVER_PORT)).await;
}