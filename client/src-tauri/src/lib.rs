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

static AUTH_RESULT: Lazy<Arc<Mutex<Option<AuthResult>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));
static SERVER_PORT: u16 = 48274; // Random high port

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn open_wallet_auth_window(app: tauri::AppHandle) -> Result<(), String> {
    // Start local callback server if not already running
    start_callback_server(app.clone());

    // Open the wallet auth page in the user's default browser
    let auth_url = format!("http://localhost:{}/wallet-auth", SERVER_PORT);

    tauri_plugin_opener::open_url(auth_url, None::<&str>)
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

fn start_callback_server(app: tauri::AppHandle) {
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

        println!("Starting local auth server on port {}", SERVER_PORT);
        warp::serve(routes).run(([127, 0, 0, 1], SERVER_PORT)).await;
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
                    vec![tauri_plugin_sql::Migration {
                        version: 1,
                        description: "initial_schema",
                        sql: include_str!("../migrations/001_initial_schema.sql"),
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    }],
                )
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            println!("[Rust] Application setup complete");
            println!("[Rust] SQL plugin should be registered");
            
            // Initialize storage directories
            if let Err(e) = storage::init_storage_dirs() {
                eprintln!("[Rust] Warning: Failed to initialize storage directories: {}", e);
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            open_wallet_auth_window,
            close_auth_window,
            poll_auth_result,
            storage::get_storage_paths
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
