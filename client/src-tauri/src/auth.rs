use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use warp::Filter;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResult {
    pub signature: String,
    pub public_key: String,
    pub message: String,
    pub nonce: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentResult {
    pub signature: String,
    pub pack_key: String,
    pub auth_token: String,
}

pub static AUTH_RESULT: Lazy<Arc<Mutex<Option<AuthResult>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));
pub static PAYMENT_RESULT: Lazy<Arc<Mutex<Option<PaymentResult>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));
pub static AUTH_SERVER_PORT: u16 = 48274;
pub static PAYMENT_SERVER_PORT: u16 = 48275;

#[tauri::command]
pub async fn open_wallet_auth_window(app: tauri::AppHandle) -> Result<(), String> {
    // Start local callback server if not already running
    start_auth_callback_server(app.clone());

    // Open the wallet auth page in the user's default browser
    let auth_url = format!("http://localhost:{}/wallet-auth", AUTH_SERVER_PORT);

    tauri_plugin_opener::open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn open_wallet_payment_window(
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
pub async fn close_auth_window(_app: tauri::AppHandle) -> Result<(), String> {
    // No-op for browser-based flow, but keep for compatibility
    Ok(())
}

#[tauri::command]
pub async fn poll_auth_result() -> Result<Option<AuthResult>, String> {
    let result = AUTH_RESULT.lock().unwrap().clone();
    if result.is_some() {
        // Clear after retrieval
        *AUTH_RESULT.lock().unwrap() = None;
    }
    Ok(result)
}

#[tauri::command]
pub async fn poll_payment_result() -> Result<Option<PaymentResult>, String> {
    let result = PAYMENT_RESULT.lock().unwrap().clone();
    if result.is_some() {
        // Clear after retrieval
        *PAYMENT_RESULT.lock().unwrap() = None;
    }
    Ok(result)
}

pub fn start_auth_callback_server(app: tauri::AppHandle) {
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

pub fn start_payment_callback_server(app: tauri::AppHandle) {
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