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
    pub from_address: String,
    pub pack_hours: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleAuthUser {
    pub id: i64,
    pub email: Option<String>,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub is_admin: bool,
    pub account_type: Option<String>,
    pub owned_organization_id: Option<i64>,
    pub created_by_organization_id: Option<i64>,
    #[serde(default)]
    pub ai_allowed: Option<bool>,
    #[serde(default)]
    pub beta_activated: Option<bool>,
    #[serde(default)]
    pub subscription: Option<GoogleAuthSubscription>,
    #[serde(default)]
    pub credits: Option<GoogleAuthCredits>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleAuthSubscription {
    pub status: String,
    pub tier: Option<String>,
    pub tier_name: Option<String>,
    pub needs_subscription: bool,
    pub days_remaining: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleAuthCredits {
    pub hours_remaining: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleAuthResult {
    pub success: bool,
    pub token: String,
    pub provider: String,
    pub user: GoogleAuthUser,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StripePaymentResult {
    pub success: bool,
    pub session_id: String,
    pub pack_key: String,
    pub pack_hours: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailAuthUser {
    pub id: i64,
    pub email: Option<String>,
    pub name: Option<String>,
    pub is_admin: bool,
    pub account_type: Option<String>,
    pub owned_organization_id: Option<i64>,
    pub created_by_organization_id: Option<i64>,
    #[serde(default)]
    pub ai_allowed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailVerificationResult {
    pub success: bool,
    #[serde(default)]
    pub token: Option<String>,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub user: Option<EmailAuthUser>,
    #[serde(default)]
    pub error: Option<String>,
}

/// Instagram OAuth result from the backend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstagramAuthResult {
    pub success: bool,
    #[serde(default)]
    pub account: Option<InstagramAccount>,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstagramAccount {
    pub id: i64,
    pub platform: String,
    pub platform_user_id: String,
    pub username: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub profile_image_url: Option<String>,
    pub is_active: bool,
    pub connected_at: String,
}

/// Twitter OAuth result from the backend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TwitterAuthResult {
    pub success: bool,
    #[serde(default)]
    pub account: Option<TwitterAccount>,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TwitterAccount {
    pub id: i64,
    pub platform: String,
    pub platform_user_id: String,
    pub username: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub profile_image_url: Option<String>,
    pub is_active: bool,
    pub connected_at: String,
}

pub static AUTH_RESULT: Lazy<Arc<Mutex<Option<AuthResult>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));
pub static PAYMENT_RESULT: Lazy<Arc<Mutex<Option<PaymentResult>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));
pub static GOOGLE_AUTH_RESULT: Lazy<Arc<Mutex<Option<GoogleAuthResult>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));
pub static STRIPE_PAYMENT_RESULT: Lazy<Arc<Mutex<Option<StripePaymentResult>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));
pub static EMAIL_VERIFICATION_RESULT: Lazy<Arc<Mutex<Option<EmailVerificationResult>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));
pub static INSTAGRAM_AUTH_RESULT: Lazy<Arc<Mutex<Option<InstagramAuthResult>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));
pub static TWITTER_AUTH_RESULT: Lazy<Arc<Mutex<Option<TwitterAuthResult>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));
pub static AUTH_SERVER_PORT: u16 = 48274;
pub static PAYMENT_SERVER_PORT: u16 = 48275;
pub static GOOGLE_AUTH_SERVER_PORT: u16 = 54321;
pub static STRIPE_SERVER_PORT: u16 = 48276;
pub static EMAIL_VERIFICATION_SERVER_PORT: u16 = 54322;
pub static INSTAGRAM_AUTH_SERVER_PORT: u16 = 54323;
pub static TWITTER_AUTH_SERVER_PORT: u16 = 54324;

#[tauri::command]
pub async fn open_wallet_auth_window(app: tauri::AppHandle, api_base: Option<String>) -> Result<(), String> {
    // Clear any previous auth result to prevent stale data from being picked up
    *AUTH_RESULT.lock().unwrap() = None;

    // Start local callback server if not already running
    start_auth_callback_server(app.clone());

    // Open the wallet auth page in the user's default browser
    // Pass api_base as URL parameter if provided
    let auth_url = match api_base {
        Some(base) => format!(
            "http://localhost:{}/wallet-auth?apiBase={}",
            AUTH_SERVER_PORT,
            urlencoding::encode(&base)
        ),
        None => format!("http://localhost:{}/wallet-auth", AUTH_SERVER_PORT),
    };

    tauri_plugin_opener::open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn open_wallet_payment_window(
    app: tauri::AppHandle,
    pack_key: String,
    pack_name: String,
    hours: u32,
    usd: f64,
    sol: f64,
    company_wallet: String,
    auth_token: String,
    api_base: Option<String>
) -> Result<(), String> {
    // Start payment callback server
    start_payment_callback_server(app.clone());

    // Build payment URL with query parameters
    let api_base_param = api_base
        .map(|base| format!("&apiBase={}", urlencoding::encode(&base)))
        .unwrap_or_default();
    
    let payment_url = format!(
        "http://localhost:{}/wallet-payment?packKey={}&packName={}&hours={}&usd={}&sol={}&companyWallet={}&authToken={}{}",
        PAYMENT_SERVER_PORT,
        urlencoding::encode(&pack_key),
        urlencoding::encode(&pack_name),
        hours,
        usd,
        sol,
        urlencoding::encode(&company_wallet),
        urlencoding::encode(&auth_token),
        api_base_param
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

#[tauri::command]
pub async fn open_google_auth_window(app: tauri::AppHandle, api_base: String) -> Result<(), String> {
    // Clear any previous auth result to prevent stale data from being picked up
    *GOOGLE_AUTH_RESULT.lock().unwrap() = None;

    // Start local callback server if not already running
    start_google_callback_server(app.clone());

    // Open the Google OAuth page in the user's default browser
    // The API server will redirect to Google and then to our callback
    let auth_url = format!("{}/api/auth/google", api_base);

    tauri_plugin_opener::open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn poll_google_auth_result() -> Result<Option<GoogleAuthResult>, String> {
    let result = GOOGLE_AUTH_RESULT.lock().unwrap().clone();
    if result.is_some() {
        // Clear after retrieval
        *GOOGLE_AUTH_RESULT.lock().unwrap() = None;
    }
    Ok(result)
}

#[tauri::command]
pub async fn open_stripe_payment_window(
    app: tauri::AppHandle,
    checkout_url: String,
    pack_key: String,
    pack_hours: u32,
) -> Result<(), String> {
    // Start Stripe callback server
    start_stripe_callback_server(app.clone(), pack_key, pack_hours);

    // Open Stripe Checkout in the user's default browser
    tauri_plugin_opener::open_url(checkout_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn poll_stripe_payment_result() -> Result<Option<StripePaymentResult>, String> {
    let result = STRIPE_PAYMENT_RESULT.lock().unwrap().clone();
    if result.is_some() {
        // Clear after retrieval
        *STRIPE_PAYMENT_RESULT.lock().unwrap() = None;
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

pub fn start_google_callback_server(app: tauri::AppHandle) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static SERVER_STARTED: AtomicBool = AtomicBool::new(false);

    if SERVER_STARTED.swap(true, Ordering::SeqCst) {
        return; // Server already running
    }

    tokio::spawn(async move {
        let google_auth_result = GOOGLE_AUTH_RESULT.clone();
        let app_handle = app.clone();

        // POST callback endpoint for Google OAuth result (kept for backwards compatibility)
        let google_auth_result_post = google_auth_result.clone();
        let app_handle_post = app_handle.clone();
        let google_callback_post = warp::path("google-callback")
            .and(warp::post())
            .and(warp::body::json())
            .map(move |result: GoogleAuthResult| {
                println!("[Google Auth] Received POST callback result: {:?}", result);
                
                // Store the result
                *google_auth_result_post.lock().unwrap() = Some(result.clone());

                // Emit event to frontend
                let _ = app_handle_post.emit("google-auth-complete", result);

                warp::reply::json(&serde_json::json!({
                    "success": true,
                    "message": "Google authentication received. You can close this tab."
                }))
            });

        // GET callback endpoint for redirect from backend (avoids mixed content issues)
        let google_auth_result_get = google_auth_result.clone();
        let app_handle_get = app_handle.clone();
        let google_callback_get = warp::path("google-callback")
            .and(warp::get())
            .and(warp::query::<std::collections::HashMap<String, String>>())
            .map(move |params: std::collections::HashMap<String, String>| {
                let success = params.get("success").map(|s| s == "true").unwrap_or(false);
                let error = params.get("error").cloned();

                if success {
                    // Parse subscription data from query params
                    let subscription = if let Some(status) = params.get("subscription_status") {
                        Some(GoogleAuthSubscription {
                            status: status.clone(),
                            tier: params.get("subscription_tier").cloned().filter(|s| !s.is_empty()),
                            tier_name: params.get("subscription_tier_name").cloned().filter(|s| !s.is_empty()),
                            needs_subscription: params.get("subscription_needs_subscription").map(|s| s == "true").unwrap_or(true),
                            days_remaining: params.get("subscription_days_remaining").and_then(|s| s.parse().ok()).unwrap_or(0),
                        })
                    } else {
                        None
                    };

                    // Parse credits data from query params
                    let credits = params.get("credits_hours_remaining").map(|hours| GoogleAuthCredits {
                        hours_remaining: hours.clone(),
                    });

                    // Parse user data from query params
                    let user = GoogleAuthUser {
                        id: params.get("user_id").and_then(|s| s.parse().ok()).unwrap_or(0),
                        email: params.get("email").cloned().filter(|s| !s.is_empty()),
                        name: params.get("name").cloned().filter(|s| !s.is_empty()),
                        avatar_url: params.get("avatar_url").cloned().filter(|s| !s.is_empty()),
                        is_admin: params.get("is_admin").map(|s| s == "true").unwrap_or(false),
                        account_type: params.get("account_type").cloned().filter(|s| !s.is_empty()),
                        owned_organization_id: params.get("owned_organization_id").and_then(|s| s.parse().ok()),
                        created_by_organization_id: params.get("created_by_organization_id").and_then(|s| s.parse().ok()),
                        ai_allowed: Some(params.get("ai_allowed").map(|s| s == "true").unwrap_or(true)),
                        beta_activated: Some(params.get("beta_activated").map(|s| s == "true").unwrap_or(false)),
                        subscription,
                        credits,
                    };

                    let result = GoogleAuthResult {
                        success: true,
                        token: params.get("token").cloned().unwrap_or_default(),
                        provider: params.get("provider").cloned().unwrap_or_else(|| "google".to_string()),
                        user,
                    };

                    println!("[Google Auth] Received GET callback result: {:?}", result);

                    // Store the result
                    *google_auth_result_get.lock().unwrap() = Some(result.clone());

                    // Emit event to frontend
                    match app_handle_get.emit("google-auth-complete", result) {
                        Ok(_) => println!("[Google Auth] Successfully emitted google-auth-complete event"),
                        Err(e) => println!("[Google Auth] Failed to emit event: {:?}", e),
                    }

                    // Return success HTML page
                    let html = r#"<!DOCTYPE html>
<html>
<head>
    <title>Authentication Successful - Clippster</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fff; }
        .container { text-align: center; padding: 2rem; }
        .icon { font-size: 4rem; margin-bottom: 1rem; color: #22c55e; }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        p { color: #888; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✓</div>
        <h1>Authentication Successful</h1>
        <p>You can close this tab and return to the app.</p>
    </div>
</body>
</html>"#.to_string();
                    warp::reply::html(html)
                } else {
                    // Handle error case
                    let error_msg = error.clone().unwrap_or_else(|| "Unknown error".to_string());
                    
                    println!("[Google Auth] Received GET callback error: {}", error_msg);

                    // Create a failed result to notify the frontend
                    let failed_result = GoogleAuthResult {
                        success: false,
                        token: String::new(),
                        provider: "google".to_string(),
                        user: GoogleAuthUser {
                            id: 0,
                            email: None,
                            name: None,
                            avatar_url: None,
                            is_admin: false,
                            account_type: None,
                            owned_organization_id: None,
                            created_by_organization_id: None,
                            ai_allowed: None,
                            beta_activated: None,
                            subscription: None,
                            credits: None,
                        },
                    };

                    // Emit error event to frontend so it can stop loading
                    let _ = app_handle_get.emit("google-auth-complete", failed_result);

                    // Return error HTML page
                    let html = format!(r#"<!DOCTYPE html>
<html>
<head>
    <title>Authentication Failed - Clippster</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fff; }}
        .container {{ text-align: center; padding: 2rem; }}
        .icon {{ font-size: 4rem; margin-bottom: 1rem; color: #ef4444; }}
        h1 {{ font-size: 1.5rem; margin-bottom: 0.5rem; }}
        p {{ color: #888; }}
        .error {{ color: #ef4444; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✗</div>
        <h1>Authentication Failed</h1>
        <p class="error">{}</p>
        <p>Please close this tab and try again.</p>
    </div>
</body>
</html>"#, error_msg);
                    warp::reply::html(html)
                }
            });

        // OPTIONS preflight handler for CORS
        let google_callback_options = warp::path("google-callback")
            .and(warp::options())
            .map(|| {
                warp::reply::with_status("", warp::http::StatusCode::OK)
            });

        // CORS configuration
        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "POST", "OPTIONS"])
            .allow_headers(vec!["Content-Type", "Accept"]);

        let routes = google_callback_options.or(google_callback_get).or(google_callback_post).with(cors);

        println!("Starting Google auth callback server on port {}", GOOGLE_AUTH_SERVER_PORT);
        warp::serve(routes).run(([127, 0, 0, 1], GOOGLE_AUTH_SERVER_PORT)).await;
    });
}

pub fn start_stripe_callback_server(app: tauri::AppHandle, pack_key: String, pack_hours: u32) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static SERVER_STARTED: AtomicBool = AtomicBool::new(false);

    if SERVER_STARTED.swap(true, Ordering::SeqCst) {
        return; // Server already running
    }

    tokio::spawn(async move {
        let stripe_payment_result = STRIPE_PAYMENT_RESULT.clone();
        let app_handle = app.clone();
        let pack_key_clone = pack_key.clone();
        let pack_hours_clone = pack_hours;

        // Serve the stripe-success.html page
        let stripe_payment_result_success = stripe_payment_result.clone();
        let app_handle_success = app_handle.clone();
        let pack_key_success = pack_key_clone.clone();
        
        let stripe_success_page = warp::path("stripe-success")
            .and(warp::query::<std::collections::HashMap<String, String>>())
            .map(move |params: std::collections::HashMap<String, String>| {
                let session_id = params.get("session_id").cloned().unwrap_or_default();
                
                // Create the result
                let result = StripePaymentResult {
                    success: true,
                    session_id: session_id.clone(),
                    pack_key: pack_key_success.clone(),
                    pack_hours: pack_hours_clone,
                };

                // Store the result
                *stripe_payment_result_success.lock().unwrap() = Some(result.clone());

                // Emit event to frontend
                let _ = app_handle_success.emit("stripe-payment-complete", result);

                warp::reply::html(include_str!("../../public/stripe-success.html"))
            });

        // Serve the stripe-cancel.html page
        let stripe_cancel_page = warp::path("stripe-cancel")
            .map(|| warp::reply::html(include_str!("../../public/stripe-cancel.html")));

        // CORS configuration
        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "POST", "OPTIONS"])
            .allow_headers(vec!["Content-Type"]);

        let routes = stripe_success_page.or(stripe_cancel_page).with(cors);

        println!("Starting Stripe callback server on port {}", STRIPE_SERVER_PORT);
        warp::serve(routes).run(([127, 0, 0, 1], STRIPE_SERVER_PORT)).await;
    });
}

#[tauri::command]
pub async fn poll_email_verification_result() -> Result<Option<EmailVerificationResult>, String> {
    let result = EMAIL_VERIFICATION_RESULT.lock().unwrap().clone();
    if result.is_some() {
        // Clear after retrieval
        *EMAIL_VERIFICATION_RESULT.lock().unwrap() = None;
    }
    Ok(result)
}

#[tauri::command]
pub async fn open_instagram_auth_window(
    app: tauri::AppHandle,
    api_base: String,
    organization_id: String,
    auth_token: String,
) -> Result<(), String> {
    // Clear any previous auth result
    *INSTAGRAM_AUTH_RESULT.lock().unwrap() = None;

    // Start local callback server
    start_instagram_callback_server(app.clone());

    // Build the Instagram OAuth initiation URL
    // The backend will redirect to Instagram and handle the OAuth flow
    let auth_url = format!(
        "{}/api/auth/instagram/start?organization_id={}&callback_port={}&auth_token={}",
        api_base,
        urlencoding::encode(&organization_id),
        INSTAGRAM_AUTH_SERVER_PORT,
        urlencoding::encode(&auth_token)
    );

    tauri_plugin_opener::open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn poll_instagram_auth_result() -> Result<Option<InstagramAuthResult>, String> {
    let result = INSTAGRAM_AUTH_RESULT.lock().unwrap().clone();
    if result.is_some() {
        // Clear after retrieval
        *INSTAGRAM_AUTH_RESULT.lock().unwrap() = None;
    }
    Ok(result)
}

#[tauri::command]
pub async fn start_user_instagram_oauth(
    app: tauri::AppHandle,
    api_base: String,
    auth_token: String,
) -> Result<(), String> {
    // Clear any previous auth result
    *INSTAGRAM_AUTH_RESULT.lock().unwrap() = None;

    // Start local callback server (reuse the same server)
    start_instagram_callback_server(app.clone());

    // Build the user Instagram OAuth initiation URL
    let auth_url = format!(
        "{}/api/auth/user-instagram/start?callback_port={}&auth_token={}",
        api_base,
        INSTAGRAM_AUTH_SERVER_PORT,
        urlencoding::encode(&auth_token)
    );

    tauri_plugin_opener::open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn start_email_verification_listener(app: tauri::AppHandle) -> Result<(), String> {
    start_email_verification_callback_server(app);
    Ok(())
}

pub fn start_email_verification_callback_server(app: tauri::AppHandle) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static SERVER_STARTED: AtomicBool = AtomicBool::new(false);

    if SERVER_STARTED.swap(true, Ordering::SeqCst) {
        return; // Server already running
    }

    tokio::spawn(async move {
        let email_verification_result = EMAIL_VERIFICATION_RESULT.clone();
        let app_handle = app.clone();

        // Callback endpoint for email verification result (from magic link)
        let email_verification_callback = warp::path("email-verification-callback")
            .and(warp::post())
            .and(warp::body::json())
            .map(move |result: EmailVerificationResult| {
                // Store the result
                *email_verification_result.lock().unwrap() = Some(result.clone());

                // Emit event to frontend
                let _ = app_handle.emit("email-verification-complete", result);

                warp::reply::json(&serde_json::json!({
                    "success": true,
                    "message": "Email verification received. You can close this tab."
                }))
            });

        // CORS configuration
        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "POST", "OPTIONS"])
            .allow_headers(vec!["Content-Type"]);

        let routes = email_verification_callback.with(cors);

        println!("Starting email verification callback server on port {}", EMAIL_VERIFICATION_SERVER_PORT);
        warp::serve(routes).run(([127, 0, 0, 1], EMAIL_VERIFICATION_SERVER_PORT)).await;
    });
}

pub fn start_instagram_callback_server(app: tauri::AppHandle) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static SERVER_STARTED: AtomicBool = AtomicBool::new(false);

    if SERVER_STARTED.swap(true, Ordering::SeqCst) {
        return; // Server already running
    }

    tokio::spawn(async move {
        let instagram_auth_result = INSTAGRAM_AUTH_RESULT.clone();
        let app_handle = app.clone();

        // POST callback endpoint for Instagram OAuth result
        let instagram_auth_result_post = instagram_auth_result.clone();
        let app_handle_post = app_handle.clone();
        let instagram_callback_post = warp::path("instagram-callback")
            .and(warp::post())
            .and(warp::body::json())
            .map(move |result: InstagramAuthResult| {
                println!("[Instagram Auth] Received callback result: {:?}", result);
                
                // Store the result
                *instagram_auth_result_post.lock().unwrap() = Some(result.clone());

                // Emit event to frontend
                let _ = app_handle_post.emit("instagram-auth-complete", result);

                warp::reply::json(&serde_json::json!({
                    "success": true,
                    "message": "Instagram authentication received. You can close this tab."
                }))
            });

        // GET callback endpoint for redirect from backend (shows success/error page)
        let instagram_auth_result_get = instagram_auth_result.clone();
        let app_handle_get = app_handle.clone();
        let instagram_callback_get = warp::path("instagram-callback")
            .and(warp::get())
            .and(warp::query::<std::collections::HashMap<String, String>>())
            .map(move |params: std::collections::HashMap<String, String>| {
                let success = params.get("success").map(|s| s == "true").unwrap_or(false);
                let error = params.get("error").cloned();
                
                // Parse account data from query params if present
                let account = if success {
                    Some(InstagramAccount {
                        id: params.get("account_id").and_then(|s| s.parse().ok()).unwrap_or(0),
                        platform: "instagram".to_string(),
                        platform_user_id: params.get("platform_user_id").cloned().unwrap_or_default(),
                        username: params.get("username").cloned().unwrap_or_default(),
                        display_name: params.get("display_name").cloned(),
                        profile_image_url: params.get("profile_image_url").cloned(),
                        is_active: true,
                        connected_at: params.get("connected_at").cloned().unwrap_or_default(),
                    })
                } else {
                    None
                };

                let result = InstagramAuthResult {
                    success,
                    account,
                    error: error.clone(),
                };

                println!("[Instagram Auth] Received GET callback: {:?}", result);

                // Store the result
                *instagram_auth_result_get.lock().unwrap() = Some(result.clone());

                // Emit event to frontend
                let _ = app_handle_get.emit("instagram-auth-complete", result);

                // Return HTML page
                let html = if success {
                    r#"<!DOCTYPE html>
<html>
<head>
    <title>Instagram Connected</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fff; }
        .container { text-align: center; padding: 2rem; }
        .icon { font-size: 4rem; margin-bottom: 1rem; }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        p { color: #888; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✓</div>
        <h1>Instagram Connected!</h1>
        <p>You can close this tab and return to the app.</p>
    </div>
</body>
</html>"#.to_string()
                } else {
                    let error_msg = error.unwrap_or_else(|| "Unknown error".to_string());
                    format!(r#"<!DOCTYPE html>
<html>
<head>
    <title>Connection Failed</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fff; }}
        .container {{ text-align: center; padding: 2rem; }}
        .icon {{ font-size: 4rem; margin-bottom: 1rem; color: #ef4444; }}
        h1 {{ font-size: 1.5rem; margin-bottom: 0.5rem; }}
        p {{ color: #888; }}
        .error {{ color: #ef4444; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✗</div>
        <h1>Connection Failed</h1>
        <p class="error">{}</p>
        <p>Please close this tab and try again.</p>
    </div>
</body>
</html>"#, error_msg)
                };
                warp::reply::html(html)
            });

        // CORS configuration
        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "POST", "OPTIONS"])
            .allow_headers(vec!["Content-Type"]);

        let routes = instagram_callback_post.or(instagram_callback_get).with(cors);

        println!("Starting Instagram auth callback server on port {}", INSTAGRAM_AUTH_SERVER_PORT);
        warp::serve(routes).run(([127, 0, 0, 1], INSTAGRAM_AUTH_SERVER_PORT)).await;
    });
}

#[tauri::command]
pub async fn open_twitter_auth_window(
    app: tauri::AppHandle,
    api_base: String,
    organization_id: String,
    auth_token: String,
) -> Result<(), String> {
    // Clear any previous auth result
    *TWITTER_AUTH_RESULT.lock().unwrap() = None;

    // Start local callback server
    start_twitter_callback_server(app.clone());

    // Build the Twitter OAuth initiation URL for organizations
    let auth_url = format!(
        "{}/api/auth/twitter/start?organization_id={}&callback_port={}&auth_token={}",
        api_base,
        urlencoding::encode(&organization_id),
        TWITTER_AUTH_SERVER_PORT,
        urlencoding::encode(&auth_token)
    );

    tauri_plugin_opener::open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn poll_twitter_auth_result() -> Result<Option<TwitterAuthResult>, String> {
    let result = TWITTER_AUTH_RESULT.lock().unwrap().clone();
    if result.is_some() {
        // Clear after retrieval
        *TWITTER_AUTH_RESULT.lock().unwrap() = None;
    }
    Ok(result)
}

#[tauri::command]
pub async fn start_user_twitter_oauth(
    app: tauri::AppHandle,
    api_base: String,
    auth_token: String,
) -> Result<(), String> {
    // Clear any previous auth result
    *TWITTER_AUTH_RESULT.lock().unwrap() = None;

    // Start local callback server
    start_twitter_callback_server(app.clone());

    // Build the user Twitter OAuth initiation URL
    let auth_url = format!(
        "{}/api/auth/user-twitter/start?callback_port={}&auth_token={}",
        api_base,
        TWITTER_AUTH_SERVER_PORT,
        urlencoding::encode(&auth_token)
    );

    tauri_plugin_opener::open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
}

pub fn start_twitter_callback_server(app: tauri::AppHandle) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static SERVER_STARTED: AtomicBool = AtomicBool::new(false);

    if SERVER_STARTED.swap(true, Ordering::SeqCst) {
        return; // Server already running
    }

    tokio::spawn(async move {
        let twitter_auth_result = TWITTER_AUTH_RESULT.clone();
        let app_handle = app.clone();

        // POST callback endpoint for Twitter OAuth result
        let twitter_auth_result_post = twitter_auth_result.clone();
        let app_handle_post = app_handle.clone();
        let twitter_callback_post = warp::path("twitter-callback")
            .and(warp::post())
            .and(warp::body::json())
            .map(move |result: TwitterAuthResult| {
                println!("[Twitter Auth] Received callback result: {:?}", result);
                
                // Store the result
                *twitter_auth_result_post.lock().unwrap() = Some(result.clone());

                // Emit event to frontend
                let _ = app_handle_post.emit("twitter-auth-complete", result);

                warp::reply::json(&serde_json::json!({
                    "success": true,
                    "message": "Twitter authentication received. You can close this tab."
                }))
            });

        // GET callback endpoint for redirect from backend (shows success/error page)
        let twitter_auth_result_get = twitter_auth_result.clone();
        let app_handle_get = app_handle.clone();
        let twitter_callback_get = warp::path("twitter-callback")
            .and(warp::get())
            .and(warp::query::<std::collections::HashMap<String, String>>())
            .map(move |params: std::collections::HashMap<String, String>| {
                let success = params.get("success").map(|s| s == "true").unwrap_or(false);
                let error = params.get("error").cloned();
                
                // Parse account data from query params if present
                let account = if success {
                    Some(TwitterAccount {
                        id: params.get("account_id").and_then(|s| s.parse().ok()).unwrap_or(0),
                        platform: "twitter".to_string(),
                        platform_user_id: params.get("platform_user_id").cloned().unwrap_or_default(),
                        username: params.get("username").cloned().unwrap_or_default(),
                        display_name: params.get("display_name").cloned(),
                        profile_image_url: params.get("profile_image_url").cloned(),
                        is_active: true,
                        connected_at: params.get("connected_at").cloned().unwrap_or_default(),
                    })
                } else {
                    None
                };

                let result = TwitterAuthResult {
                    success,
                    account,
                    error: error.clone(),
                };

                println!("[Twitter Auth] Received GET callback: {:?}", result);

                // Store the result
                *twitter_auth_result_get.lock().unwrap() = Some(result.clone());

                // Emit event to frontend
                let _ = app_handle_get.emit("twitter-auth-complete", result);

                // Return HTML page
                let html = if success {
                    r#"<!DOCTYPE html>
<html>
<head>
    <title>Twitter Connected</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fff; }
        .container { text-align: center; padding: 2rem; }
        .icon { font-size: 4rem; margin-bottom: 1rem; }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        p { color: #888; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✓</div>
        <h1>Twitter Account Connected!</h1>
        <p>You can close this tab and return to the app.</p>
    </div>
</body>
</html>"#.to_string()
                } else {
                    let error_msg = error.unwrap_or_else(|| "Unknown error".to_string());
                    format!(r#"<!DOCTYPE html>
<html>
<head>
    <title>Connection Failed</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fff; }}
        .container {{ text-align: center; padding: 2rem; }}
        .icon {{ font-size: 4rem; margin-bottom: 1rem; color: #ef4444; }}
        h1 {{ font-size: 1.5rem; margin-bottom: 0.5rem; }}
        p {{ color: #888; }}
        .error {{ color: #ef4444; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✗</div>
        <h1>Connection Failed</h1>
        <p class="error">{}</p>
        <p>Please close this tab and try again.</p>
    </div>
</body>
</html>"#, error_msg)
                };
                warp::reply::html(html)
            });

        // CORS configuration
        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "POST", "OPTIONS"])
            .allow_headers(vec!["Content-Type"]);

        let routes = twitter_callback_post.or(twitter_callback_get).with(cors);

        println!("Starting Twitter auth callback server on port {}", TWITTER_AUTH_SERVER_PORT);
        warp::serve(routes).run(([127, 0, 0, 1], TWITTER_AUTH_SERVER_PORT)).await;
    });
}