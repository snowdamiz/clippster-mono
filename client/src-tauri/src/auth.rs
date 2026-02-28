use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use warp::Filter;

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
    #[serde(default)]
    pub token: Option<String>,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub user: Option<GoogleAuthUser>,
    #[serde(default)]
    pub is_new_user: Option<bool>,
    #[serde(default)]
    pub error: Option<String>,
}


pub static AUTH_RESULT: Lazy<Arc<Mutex<Option<AuthResult>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));
pub static PAYMENT_RESULT: Lazy<Arc<Mutex<Option<PaymentResult>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));
pub static GOOGLE_AUTH_RESULT: Lazy<Arc<Mutex<Option<GoogleAuthResult>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));
pub static EMAIL_VERIFICATION_RESULT: Lazy<Arc<Mutex<Option<EmailVerificationResult>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));
pub static AUTH_SERVER_PORT: u16 = 48274;
pub static PAYMENT_SERVER_PORT: u16 = 48275;
pub static GOOGLE_AUTH_SERVER_PORT: u16 = 54321;
pub static EMAIL_VERIFICATION_SERVER_PORT: u16 = 54322;

const WALLET_AUTH_HTML: &str = include_str!("../../public/wallet-auth.html");
const WALLET_PAYMENT_HTML: &str = include_str!("../../public/wallet-payment.html");

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

fn parse_optional_string(params: &HashMap<String, String>, key: &str) -> Option<String> {
    params
        .get(key)
        .cloned()
        .and_then(|v| if v.is_empty() { None } else { Some(v) })
}

fn parse_bool(value: Option<&String>, default: bool) -> bool {
    value
        .map(|v| matches!(v.as_str(), "true" | "1" | "yes" | "on"))
        .unwrap_or(default)
}

fn parse_optional_i64(value: Option<&String>) -> Option<i64> {
    value
        .and_then(|v| if v.is_empty() { None } else { Some(v) })
        .and_then(|v| v.parse::<i64>().ok())
}

fn parse_i64(value: Option<&String>, default: i64) -> i64 {
    value.and_then(|v| v.parse::<i64>().ok()).unwrap_or(default)
}

fn parse_i32(value: Option<&String>, default: i32) -> i32 {
    value.and_then(|v| v.parse::<i32>().ok()).unwrap_or(default)
}

fn oauth_result_html(title: &str, message: &str, color: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #0b0b0c; color: #f4f4f5; }}
    .card {{ width: min(92vw, 520px); border: 1px solid #27272a; border-radius: 14px; background: #111114; padding: 24px; text-align: center; }}
    h1 {{ color: {}; margin: 0 0 10px; font-size: 1.5rem; }}
    p {{ color: #a1a1aa; margin: 0; line-height: 1.5; }}
  </style>
</head>
<body>
  <main class="card">
    <h1>{}</h1>
    <p>{}</p>
  </main>
</body>
</html>"#,
        title, color, title, message
    )
}

#[tauri::command]
pub async fn open_wallet_auth_window(
    app: tauri::AppHandle,
    api_base: Option<String>,
) -> Result<(), String> {
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
    api_base: Option<String>,
) -> Result<(), String> {
    // Clear any previous payment result to prevent stale callbacks from being reused
    *PAYMENT_RESULT.lock().unwrap() = None;

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
pub async fn open_google_auth_window(
    app: tauri::AppHandle,
    api_base: String,
) -> Result<(), String> {
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
pub async fn start_post_for_me_oauth(
    _app: tauri::AppHandle,
    auth_url: String,
) -> Result<(), String> {
    tauri_plugin_opener::open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
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

        let wallet_auth_page = warp::path("wallet-auth")
            .and(warp::get())
            .map(|| warp::reply::html(WALLET_AUTH_HTML));

        let auth_callback = warp::path("auth-callback")
            .and(warp::post())
            .and(warp::body::json())
            .map(move |result: AuthResult| {
                println!(
                    "[Wallet Auth] Callback received for pubkey={}",
                    result.public_key
                );

                *auth_result.lock().unwrap() = Some(result.clone());
                let _ = app_handle.emit("wallet-auth-complete", result);

                warp::reply::json(&serde_json::json!({
                    "success": true,
                    "message": "Authentication received"
                }))
            });

        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "POST", "OPTIONS"])
            .allow_headers(vec!["Content-Type"]);

        let routes = wallet_auth_page.or(auth_callback).with(cors);

        println!(
            "Starting wallet auth callback server on port {}",
            AUTH_SERVER_PORT
        );

        warp::serve(routes)
            .run(([127, 0, 0, 1], AUTH_SERVER_PORT))
            .await;
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

        let wallet_payment_page = warp::path("wallet-payment")
            .and(warp::get())
            .map(|| warp::reply::html(WALLET_PAYMENT_HTML));

        let payment_callback = warp::path("payment-callback")
            .and(warp::post())
            .and(warp::body::json())
            .map(move |result: PaymentResult| {
                println!(
                    "[Wallet Payment] Callback received for pack={} from={}",
                    result.pack_key, result.from_address
                );

                *payment_result.lock().unwrap() = Some(result.clone());
                let _ = app_handle.emit("wallet-payment-complete", result);

                warp::reply::json(&serde_json::json!({
                    "success": true,
                    "message": "Payment received"
                }))
            });

        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "POST", "OPTIONS"])
            .allow_headers(vec!["Content-Type"]);

        let routes = wallet_payment_page.or(payment_callback).with(cors);

        println!(
            "Starting wallet payment callback server on port {}",
            PAYMENT_SERVER_PORT
        );

        warp::serve(routes)
            .run(([127, 0, 0, 1], PAYMENT_SERVER_PORT))
            .await;
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

        let google_callback = warp::path("google-callback")
            .and(warp::get())
            .and(warp::query::<HashMap<String, String>>())
            .map(move |params: HashMap<String, String>| {
                let success = parse_bool(params.get("success"), false);

                let result = if success {
                    let subscription_status = params
                        .get("subscription_status")
                        .cloned()
                        .unwrap_or_else(|| "none".to_string());

                    let subscription = Some(GoogleAuthSubscription {
                        status: subscription_status,
                        tier: parse_optional_string(&params, "subscription_tier"),
                        tier_name: parse_optional_string(&params, "subscription_tier_name"),
                        needs_subscription: parse_bool(
                            params.get("subscription_needs_subscription"),
                            false,
                        ),
                        days_remaining: parse_i32(params.get("subscription_days_remaining"), 0),
                    });

                    let credits = parse_optional_string(&params, "credits_hours_remaining")
                        .map(|hours_remaining| GoogleAuthCredits { hours_remaining });

                    let user = GoogleAuthUser {
                        id: parse_i64(params.get("user_id"), 0),
                        email: parse_optional_string(&params, "email"),
                        name: parse_optional_string(&params, "name"),
                        avatar_url: parse_optional_string(&params, "avatar_url"),
                        is_admin: parse_bool(params.get("is_admin"), false),
                        account_type: parse_optional_string(&params, "account_type"),
                        owned_organization_id: parse_optional_i64(
                            params.get("owned_organization_id"),
                        ),
                        created_by_organization_id: parse_optional_i64(
                            params.get("created_by_organization_id"),
                        ),
                        ai_allowed: params.get("ai_allowed").map(|v| parse_bool(Some(v), false)),
                        beta_activated: params
                            .get("beta_activated")
                            .map(|v| parse_bool(Some(v), false)),
                        subscription,
                        credits,
                    };

                    GoogleAuthResult {
                        success: true,
                        token: parse_optional_string(&params, "token"),
                        provider: Some("google".to_string()),
                        user: Some(user),
                        is_new_user: params
                            .get("is_new_user")
                            .map(|v| parse_bool(Some(v), false)),
                        error: None,
                    }
                } else {
                    GoogleAuthResult {
                        success: false,
                        token: None,
                        provider: Some("google".to_string()),
                        user: None,
                        is_new_user: None,
                        error: parse_optional_string(&params, "error")
                            .or_else(|| Some("Google authentication failed".to_string())),
                    }
                };

                println!(
                    "[Google Auth] Callback received: success={}",
                    result.success
                );

                *google_auth_result.lock().unwrap() = Some(result.clone());
                let _ = app_handle.emit("google-auth-complete", result.clone());

                let (title, message, color) = if result.success {
                    (
                        "Google Sign-In Successful",
                        "You can close this tab and return to the app.",
                        "#22c55e",
                    )
                } else {
                    (
                        "Google Sign-In Failed",
                        result
                            .error
                            .as_deref()
                            .unwrap_or("Authentication failed. You can close this tab."),
                        "#ef4444",
                    )
                };

                let html = oauth_result_html(title, message, color);

                warp::reply::html(html)
            });

        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "OPTIONS"])
            .allow_headers(vec!["Content-Type"]);

        println!(
            "Starting Google auth callback server on port {}",
            GOOGLE_AUTH_SERVER_PORT
        );

        warp::serve(google_callback.with(cors))
            .run(([127, 0, 0, 1], GOOGLE_AUTH_SERVER_PORT))
            .await;
    });
}

#[tauri::command]
pub async fn poll_auth_result() -> Result<Option<AuthResult>, String> {
    let result = AUTH_RESULT.lock().unwrap().clone();
    Ok(result)
}

#[tauri::command]
pub async fn clear_auth_result() -> Result<(), String> {
    *AUTH_RESULT.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub async fn poll_payment_result() -> Result<Option<PaymentResult>, String> {
    let result = PAYMENT_RESULT.lock().unwrap().clone();
    Ok(result)
}

#[tauri::command]
pub async fn clear_payment_result() -> Result<(), String> {
    *PAYMENT_RESULT.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub async fn poll_google_auth_result() -> Result<Option<GoogleAuthResult>, String> {
    let result = GOOGLE_AUTH_RESULT.lock().unwrap().clone();
    Ok(result)
}

#[tauri::command]
pub async fn clear_google_auth_result() -> Result<(), String> {
    *GOOGLE_AUTH_RESULT.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub async fn start_email_verification_listener(app: tauri::AppHandle) -> Result<(), String> {
    *EMAIL_VERIFICATION_RESULT.lock().unwrap() = None;
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

        let email_verification_callback = warp::path("email-verification-callback")
            .and(warp::post())
            .and(warp::body::json())
            .map(move |result: EmailVerificationResult| {
                let mut normalized_result = result;

                if normalized_result.provider.is_none() && normalized_result.success {
                    normalized_result.provider = Some("email".to_string());
                }

                println!(
                    "[Email Verification] Callback received: success={}",
                    normalized_result.success
                );

                *email_verification_result.lock().unwrap() = Some(normalized_result.clone());
                let _ = app_handle.emit("email-verification-complete", normalized_result);

                warp::reply::json(&serde_json::json!({
                    "success": true,
                    "message": "Email verification received"
                }))
            });

        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["POST", "OPTIONS"])
            .allow_headers(vec!["Content-Type"]);

        println!(
            "Starting email verification callback server on port {}",
            EMAIL_VERIFICATION_SERVER_PORT
        );

        warp::serve(email_verification_callback.with(cors))
            .run(([127, 0, 0, 1], EMAIL_VERIFICATION_SERVER_PORT))
            .await;
    });
}

#[tauri::command]
pub async fn poll_email_verification_result() -> Result<Option<EmailVerificationResult>, String> {
    let result = EMAIL_VERIFICATION_RESULT.lock().unwrap().clone();
    Ok(result)
}

#[tauri::command]
pub async fn clear_email_verification_result() -> Result<(), String> {
    *EMAIL_VERIFICATION_RESULT.lock().unwrap() = None;
    Ok(())
}

