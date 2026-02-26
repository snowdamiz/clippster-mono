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
pub static STRIPE_SERVER_PORT: u16 = 48277;
pub static EMAIL_VERIFICATION_SERVER_PORT: u16 = 54322;
pub static INSTAGRAM_AUTH_SERVER_PORT: u16 = 54323;
pub static TWITTER_AUTH_SERVER_PORT: u16 = 54324;

fn split_base_and_query(input: &str) -> (&str, Option<&str>) {
    match input.split_once('?') {
        Some((base, query)) => (base, Some(query)),
        None => (input, None),
    }
}

fn normalize_api_origin(api_base: &str) -> String {
    let (base, _) = split_base_and_query(api_base);
    let trimmed = base.trim_end_matches('/');

    if trimmed.to_ascii_lowercase().ends_with("/api") {
        trimmed[..trimmed.len() - 4].to_string()
    } else {
        trimmed.to_string()
    }
}

fn build_api_url(api_base: &str, path: &str) -> String {
    let origin = normalize_api_origin(api_base);
    format!("{}/api{}", origin, path)
}

fn build_api_url_with_query(api_base: &str, path: &str) -> String {
    let (_, query) = split_base_and_query(api_base);
    let mut url = build_api_url(api_base, path);

    if let Some(query_str) = query {
        if !query_str.is_empty() {
            url.push('?');
            url.push_str(query_str);
        }
    }

    url
}

#[tauri::command]
pub async fn open_wallet_auth_window(app: tauri::AppHandle, api_base: Option<String>) -> Result<(), String> {
    // Clear any previous auth result to prevent stale data from being picked up
    *AUTH_RESULT.lock().unwrap() = None;

    // Start local callback server if not already running
    start_auth_callback_server(app.clone());

    // Open the wallet auth page in the user's default browser
    // Pass api_base as URL parameter if provided
    let auth_url = match api_base {
        Some(base) => {
            let normalized_base = normalize_api_origin(&base);
            format!(
                "http://localhost:{}/wallet-auth?apiBase={}",
                AUTH_SERVER_PORT,
                urlencoding::encode(&normalized_base)
            )
        }
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
        .map(|base| {
            let normalized_base = normalize_api_origin(&base);
            format!("&apiBase={}", urlencoding::encode(&normalized_base))
        })
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
pub async fn open_google_auth_window(app: tauri::AppHandle, api_base: String) -> Result<(), String> {
    // Clear any previous auth result to prevent stale data from being picked up
    *GOOGLE_AUTH_RESULT.lock().unwrap() = None;

    // Start local callback server if not already running
    start_google_callback_server(app.clone());

    // Open the Google OAuth page in the user's default browser
    // The API server will redirect to Google and then to our callback
    let auth_url = build_api_url_with_query(&api_base, "/auth/google");

    tauri_plugin_opener::open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
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
        "{}?organization_id={}&callback_port={}&auth_token={}",
        build_api_url(&api_base, "/auth/instagram/start"),
        urlencoding::encode(&organization_id),
        INSTAGRAM_AUTH_SERVER_PORT,
        urlencoding::encode(&auth_token)
    );

    tauri_plugin_opener::open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
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
        "{}?callback_port={}&auth_token={}",
        build_api_url(&api_base, "/auth/user-instagram/start"),
        INSTAGRAM_AUTH_SERVER_PORT,
        urlencoding::encode(&auth_token)
    );

    tauri_plugin_opener::open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
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
        "{}?organization_id={}&callback_port={}&auth_token={}",
        build_api_url(&api_base, "/auth/twitter/start"),
        urlencoding::encode(&organization_id),
        TWITTER_AUTH_SERVER_PORT,
        urlencoding::encode(&auth_token)
    );

    tauri_plugin_opener::open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
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
        "{}?callback_port={}&auth_token={}",
        build_api_url(&api_base, "/auth/user-twitter/start"),
        TWITTER_AUTH_SERVER_PORT,
        urlencoding::encode(&auth_token)
    );

    tauri_plugin_opener::open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
}

// Stub implementations for callback servers that are called but not yet implemented
pub fn start_auth_callback_server(_app: tauri::AppHandle) {
    // TODO: Implement wallet auth callback server
    println!("[Auth] Wallet auth callback server not yet implemented");
}

pub fn start_payment_callback_server(_app: tauri::AppHandle) {
    // TODO: Implement wallet payment callback server
    println!("[Auth] Wallet payment callback server not yet implemented");
}

pub fn start_google_callback_server(_app: tauri::AppHandle) {
    // TODO: Implement Google auth callback server
    println!("[Auth] Google auth callback server not yet implemented");
}

pub fn start_instagram_callback_server(_app: tauri::AppHandle) {
    // TODO: Implement Instagram auth callback server
    println!("[Auth] Instagram auth callback server not yet implemented");
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