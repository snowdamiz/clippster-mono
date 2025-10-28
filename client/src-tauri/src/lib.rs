use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use warp::Filter;

mod storage;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AuthResult {
    signature: String,
    public_key: String,
    message: String,
    nonce: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PaymentResult {
    signature: String,
    pack_key: String,
    auth_token: String,
}

static AUTH_RESULT: Lazy<Arc<Mutex<Option<AuthResult>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));
static PAYMENT_RESULT: Lazy<Arc<Mutex<Option<PaymentResult>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));
static AUTH_SERVER_PORT: u16 = 48274;
static PAYMENT_SERVER_PORT: u16 = 48275;
static VIDEO_SERVER_PORT: u16 = 48276;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn open_wallet_auth_window(app: tauri::AppHandle) -> Result<(), String> {
    // Start local callback server if not already running
    start_auth_callback_server(app.clone());

    // Open the wallet auth page in the user's default browser
    let auth_url = format!("http://localhost:{}/wallet-auth", AUTH_SERVER_PORT);

    tauri_plugin_opener::open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn open_wallet_payment_window(
    app: tauri::AppHandle,
    pack_key: String,
    pack_name: String,
    hours: u32,
    usd: f64,
    sol: f64,
    company_wallet: String,
    auth_token: String
) -> Result<(), String> {
    // Start payment callback server
    start_payment_callback_server(app.clone());

    // Build payment URL with query parameters
    let payment_url = format!(
        "http://localhost:{}/wallet-payment?packKey={}&packName={}&hours={}&usd={}&sol={}&companyWallet={}&authToken={}",
        PAYMENT_SERVER_PORT,
        urlencoding::encode(&pack_key),
        urlencoding::encode(&pack_name),
        hours,
        usd,
        sol,
        urlencoding::encode(&company_wallet),
        urlencoding::encode(&auth_token)
    );

    tauri_plugin_opener::open_url(payment_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn close_auth_window(_app: tauri::AppHandle) -> Result<(), String> {
    // No-op for browser-based flow, but keep for compatibility
    Ok(())
}

#[tauri::command]
async fn poll_auth_result() -> Result<Option<AuthResult>, String> {
    let result = AUTH_RESULT.lock().unwrap().clone();
    if result.is_some() {
        // Clear after retrieval
        *AUTH_RESULT.lock().unwrap() = None;
    }
    Ok(result)
}

#[tauri::command]
async fn poll_payment_result() -> Result<Option<PaymentResult>, String> {
    let result = PAYMENT_RESULT.lock().unwrap().clone();
    if result.is_some() {
        // Clear after retrieval
        *PAYMENT_RESULT.lock().unwrap() = None;
    }
    Ok(result)
}

fn start_auth_callback_server(app: tauri::AppHandle) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static SERVER_STARTED: AtomicBool = AtomicBool::new(false);

    if SERVER_STARTED.swap(true, Ordering::SeqCst) {
        return; // Server already running
    }

    tokio::spawn(async move {
        let auth_result = AUTH_RESULT.clone();
        let app_handle = app.clone();

        // Serve the wallet-auth.html page
        let wallet_auth_page = warp::path("wallet-auth")
            .map(|| warp::reply::html(include_str!("../../public/wallet-auth.html")));

        // Callback endpoint for auth result
        let auth_callback = warp::path("auth-callback")
            .and(warp::post())
            .and(warp::body::json())
            .map(move |result: AuthResult| {
                // Store the result
                *auth_result.lock().unwrap() = Some(result.clone());

                // Emit event to frontend
                let _ = app_handle.emit("wallet-auth-complete", result);

                warp::reply::json(&serde_json::json!({
                    "success": true,
                    "message": "Authentication received. You can close this tab."
                }))
            });

        // CORS configuration
        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "POST", "OPTIONS"])
            .allow_headers(vec!["Content-Type"]);

        let routes = wallet_auth_page.or(auth_callback).with(cors);

        println!("Starting local auth server on port {}", AUTH_SERVER_PORT);
        warp::serve(routes).run(([127, 0, 0, 1], AUTH_SERVER_PORT)).await;
    });
}

#[tauri::command]
fn get_video_server_port() -> u16 {
    VIDEO_SERVER_PORT
}

async fn start_video_server_impl() {
    use std::sync::atomic::{AtomicBool, Ordering};
    static SERVER_STARTED: AtomicBool = AtomicBool::new(false);

    if SERVER_STARTED.swap(true, Ordering::SeqCst) {
        return; // Server already running
    }

    {
        use std::path::PathBuf;
        use warp::Reply;

        let video_route = warp::path!("video" / String)
            .and(warp::get())
            .and_then(|encoded_path: String| async move {
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

                // Read the entire file into memory (simpler approach)
                let bytes = match tokio::fs::read(&file_path).await {
                    Ok(b) => b,
                    Err(_) => {
                        return Ok(warp::reply::with_status(
                            warp::reply::json(&serde_json::json!({"error": "Cannot read file"})),
                            warp::http::StatusCode::INTERNAL_SERVER_ERROR
                        ).into_response());
                    }
                };

                // Determine content type
                let content_type = match file_path.extension().and_then(|e| e.to_str()) {
                    Some("mp4") => "video/mp4",
                    Some("webm") => "video/webm",
                    Some("mov") => "video/quicktime",
                    Some("avi") => "video/x-msvideo",
                    Some("mkv") => "video/x-matroska",
                    _ => "application/octet-stream",
                };

                Ok(warp::reply::with_header(
                    warp::reply::with_status(
                        bytes,
                        warp::http::StatusCode::OK
                    ),
                    "Content-Type",
                    content_type
                ).into_response())
            });

        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "OPTIONS"])
            .allow_headers(vec!["Content-Type", "Range"]);

        let routes = video_route.with(cors);

    println!("Starting local video server on port {}", VIDEO_SERVER_PORT);
    warp::serve(routes).run(([127, 0, 0, 1], VIDEO_SERVER_PORT)).await;
    }
}

fn start_payment_callback_server(app: tauri::AppHandle) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static SERVER_STARTED: AtomicBool = AtomicBool::new(false);

    if SERVER_STARTED.swap(true, Ordering::SeqCst) {
        return; // Server already running
    }

    tokio::spawn(async move {
        let payment_result = PAYMENT_RESULT.clone();
        let app_handle = app.clone();

        // Serve the wallet-payment.html page
        let wallet_payment_page = warp::path("wallet-payment")
            .map(|| warp::reply::html(include_str!("../../public/wallet-payment.html")));

        // Callback endpoint for payment result
        let payment_callback = warp::path("payment-callback")
            .and(warp::post())
            .and(warp::body::json())
            .map(move |result: PaymentResult| {
                // Store the result
                *payment_result.lock().unwrap() = Some(result.clone());

                // Emit event to frontend
                let _ = app_handle.emit("wallet-payment-complete", result);

                warp::reply::json(&serde_json::json!({
                    "success": true,
                    "message": "Payment received. You can close this tab."
                }))
            });

        // CORS configuration
        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "POST", "OPTIONS"])
            .allow_headers(vec!["Content-Type"]);

        let routes = wallet_payment_page.or(payment_callback).with(cors);

        println!("Starting local payment server on port {}", PAYMENT_SERVER_PORT);
        warp::serve(routes).run(([127, 0, 0, 1], PAYMENT_SERVER_PORT)).await;
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("[Rust] Starting Tauri application");
    println!("[Rust] Registering SQL plugin...");
    
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:clippster.db",
                    vec![
                        tauri_plugin_sql::Migration {
                            version: 1,
                            description: "initial_schema",
                            sql: include_str!("../migrations/001_initial_schema.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 2,
                            description: "add_raw_video_path",
                            sql: include_str!("../migrations/002_add_raw_video_path.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 3,
                            description: "add_raw_videos_table",
                            sql: include_str!("../migrations/003_add_raw_videos_table.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 4,
                            description: "transcripts_reference_raw_videos",
                            sql: include_str!("../migrations/004_transcripts_reference_raw_videos.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 5,
                            description: "make_project_id_nullable",
                            sql: include_str!("../migrations/005_make_project_id_nullable.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 6,
                            description: "add_original_filename",
                            sql: include_str!("../migrations/006_add_original_filename.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 7,
                            description: "add_thumbnail_path",
                            sql: include_str!("../migrations/007_add_thumbnail_path.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                    ],
                )
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            println!("[Rust] Application setup complete");
            println!("[Rust] SQL plugin should be registered");
            
            // Initialize storage directories
            if let Err(e) = storage::init_storage_dirs() {
                eprintln!("[Rust] Warning: Failed to initialize storage directories: {}", e);
            }
            
            // Start video streaming server in Tauri's async runtime
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                start_video_server_impl().await;
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            open_wallet_auth_window,
            open_wallet_payment_window,
            close_auth_window,
            poll_auth_result,
            poll_payment_result,
            get_video_server_port,
            storage::get_storage_paths,
            storage::copy_video_to_storage,
            storage::generate_thumbnail,
            storage::read_file_as_data_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
