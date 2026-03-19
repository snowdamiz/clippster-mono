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
    let icon = if color == "#22c55e" {
        r#"<polyline points="20 6 9 17 4 12"></polyline>"#
    } else {
        r#"<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>"#
    };

    format!(
        r##"<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{0}</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #0a0a0b; color: #f4f4f5; padding: 1.5rem; }}
    .container {{ max-width: 28rem; width: 100%; animation: fadeIn 0.5s ease-out; }}
    .logo {{ display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 2rem; }}
    .card {{ position: relative; overflow: hidden; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.05); background: #0a0a0b; backdrop-filter: blur(10px); box-shadow: 0 8px 32px rgba(0,0,0,0.37); }}
    .gradient-overlay {{ position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 50%, {1}14 100%); pointer-events: none; }}
    .content {{ position: relative; padding: 2.5rem 2rem; text-align: center; }}
    .icon-container {{ width: 64px; height: 64px; margin: 0 auto 1.5rem; background: {1}1a; border: 1px solid {1}33; border-radius: 1rem; display: flex; align-items: center; justify-content: center; animation: scaleIn 0.5s ease-out; }}
    .icon-container svg {{ width: 32px; height: 32px; }}
    h1 {{ font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; color: {1}; }}
    p {{ font-size: 0.875rem; color: #a1a1aa; line-height: 1.5; margin-bottom: 1rem; }}
    .close-notice {{ margin-top: 0.5rem; font-size: 0.75rem; color: #52525b; }}
    @keyframes scaleIn {{ 0% {{ transform: scale(0); opacity: 0; }} 50% {{ transform: scale(1.1); }} 100% {{ transform: scale(1); opacity: 1; }} }}
    @keyframes fadeIn {{ from {{ opacity: 0; transform: translateY(10px); }} to {{ opacity: 1; transform: translateY(0); }} }}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <svg width="32" height="32" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_1170_213)"><rect width="1024" height="1024" rx="250" fill="#F8F8F8"/><path d="M834.343 499.337C843.771 504.707 843.771 518.297 834.343 523.667L591.997 661.706C582.663 667.023 571.067 660.282 571.067 649.542L571.067 373.462C571.067 362.721 582.663 355.981 591.997 361.297L834.343 499.337Z" fill="#111212"/><path d="M414.797 522.603C405.416 517.224 405.416 503.693 414.797 498.313L611.831 385.331C621.164 379.979 632.795 386.717 632.795 397.476L632.795 623.441C632.795 634.2 621.164 640.938 611.831 635.586L414.797 522.603Z" fill="#111212"/><path d="M526.51 323.63C535.843 329.018 535.843 342.49 526.51 347.878L283.877 487.961C274.544 493.35 262.877 486.614 262.877 475.837L262.877 195.671C262.877 184.894 274.544 178.158 283.877 183.546L526.51 323.63Z" fill="#111212"/><path d="M526.51 675.124C535.843 680.512 535.843 693.984 526.51 699.372L283.877 839.456C274.544 844.844 262.877 838.108 262.877 827.331L262.877 547.165C262.877 536.388 274.544 529.652 283.877 535.041L526.51 675.124Z" fill="#111212"/></g><defs><clipPath id="clip0_1170_213"><rect width="1024" height="1024" fill="white"/></clipPath></defs></svg>
      <svg height="20" viewBox="0 0 215 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.624 32.896C10.624 36.4373 11.2427 38.9973 12.48 40.576C13.7173 42.112 15.6587 42.88 18.304 42.88C20.736 42.88 23.04 42.3253 25.216 41.216C27.4347 40.064 29.2907 38.4853 30.784 36.48L32.256 37.12C30.848 40.7467 28.3947 43.648 24.896 45.824C21.44 47.9573 17.8133 49.024 14.016 49.024C9.06666 49.024 5.48266 47.7867 3.264 45.312C1.088 42.7947 -3.33786e-06 38.784 -3.33786e-06 33.28C-3.33786e-06 29.7387 0.447997 26.048 1.344 22.208C2.24 18.368 3.47733 14.9333 5.056 11.904C7.104 8.02133 9.57866 5.07733 12.48 3.072C15.424 1.024 18.7093 -3.8147e-06 22.336 -3.8147e-06C25.7493 -3.8147e-06 28.3733 0.746663 30.208 2.24C32.0853 3.69066 33.024 5.80266 33.024 8.576C33.024 10.496 32.64 11.968 31.872 12.992C31.104 13.9733 29.9947 14.464 28.544 14.464C27.8187 14.464 27.136 14.336 26.496 14.08C25.8987 13.7813 25.3653 13.3547 24.896 12.8C25.664 12.416 26.3467 11.648 26.944 10.496C27.5413 9.30133 27.84 8.10667 27.84 6.912C27.84 5.67467 27.4987 4.71467 26.816 4.032C26.1333 3.34933 25.1733 3.008 23.936 3.008C22.0587 3.008 20.2027 4.16 18.368 6.464C16.5333 8.72533 14.9333 11.8613 13.568 15.872C12.6293 18.6027 11.904 21.4613 11.392 24.448C10.88 27.392 10.624 30.208 10.624 32.896ZM30.0845 40.704C30.0845 40.1493 30.1272 39.5307 30.2125 38.848C30.2978 38.1227 30.4258 37.3547 30.5965 36.544L37.4445 4.48L46.9165 3.2L39.5565 37.76C39.4712 38.144 39.4072 38.5067 39.3645 38.848C39.3218 39.1467 39.3005 39.4667 39.3005 39.808C39.3005 40.6613 39.4925 41.28 39.8765 41.664C40.3032 42.0053 40.9858 42.176 41.9245 42.176C43.1192 42.176 44.2498 41.664 45.3165 40.64C46.3832 39.5733 47.1725 38.208 47.6845 36.544H50.3725C49.0072 40.4267 47.1725 43.3707 44.8685 45.376C42.5645 47.3813 39.9192 48.384 36.9325 48.384C34.7992 48.384 33.1138 47.7227 31.8765 46.4C30.6818 45.0347 30.0845 43.136 30.0845 40.704ZM63.1545 7.488C63.1545 8.896 62.6425 10.0907 61.6185 11.072C60.6372 12.0533 59.4425 12.544 58.0345 12.544C56.6265 12.544 55.4318 12.0533 54.4505 11.072C53.4692 10.0907 52.9785 8.896 52.9785 7.488C52.9785 6.08 53.4692 4.88533 54.4505 3.904C55.4318 2.92267 56.6265 2.432 58.0345 2.432C59.4425 2.432 60.6372 2.92267 61.6185 3.904C62.6425 4.88533 63.1545 6.08 63.1545 7.488ZM53.1065 48L60.3145 11.2L51.0985 12.48L43.8905 49.28L53.1065 48ZM93.8086 28.096C93.8086 31.6373 94.4273 34.1973 95.6646 36.776C96.9019 39.312 98.8433 40.58 101.489 40.58C103.921 40.58 106.225 40.0253 108.401 38.916C110.619 37.764 112.475 36.1853 113.969 34.18L115.441 34.82C114.033 38.4467 111.579 41.348 108.081 43.524C104.625 45.6573 100.998 46.724 97.2006 46.724C92.2513 46.724 88.6673 45.4867 86.4486 43.012C84.2726 40.4947 83.1846 36.484 83.1846 30.98C83.1846 27.4387 83.6326 23.748 84.5286 19.908C85.4246 16.068 86.6619 12.6333 88.2406 9.604C90.2886 5.72133 92.7633 2.77733 95.6646 0.772C98.6086 -1.276 101.894 -2.3 105.521 -2.3C108.934 -2.3 111.558 -1.55333 113.393 -0.0599997C115.27 1.39067 116.209 3.50267 116.209 6.276C116.209 8.196 115.825 9.668 115.057 10.692C114.289 11.6733 113.179 12.164 111.729 12.164C111.003 12.164 110.321 12.036 109.681 11.78C109.083 11.4813 108.55 11.0547 108.081 10.5C108.849 10.116 109.531 9.348 110.129 8.196C110.726 7.00133 111.025 5.80667 111.025 4.612C111.025 3.37467 110.683 2.41467 110.001 1.732C109.318 1.04933 108.358 0.708 107.121 0.708C105.243 0.708 103.387 1.86 101.553 4.164C99.7179 6.42533 98.1179 9.56133 96.7526 13.572C95.8139 16.3027 95.0886 19.1613 94.5766 22.148C94.0646 25.092 93.8086 27.908 93.8086 30.596V28.096ZM116.269 48L123.477 11.2L114.261 12.48L107.053 49.28L116.269 48ZM154.763 28.096C154.763 31.6373 155.382 34.1973 156.619 36.776C157.857 39.312 159.798 40.58 162.443 40.58C164.875 40.58 167.179 40.0253 169.355 38.916C171.574 37.764 173.43 36.1853 174.923 34.18L176.395 34.82C174.987 38.4467 172.534 41.348 169.035 43.524C165.579 45.6573 161.953 46.724 158.155 46.724C153.206 46.724 149.622 45.4867 147.403 43.012C145.227 40.4947 144.139 36.484 144.139 30.98C144.139 27.4387 144.587 23.748 145.483 19.908C146.379 16.068 147.617 12.6333 149.195 9.604C151.243 5.72133 153.718 2.77733 156.619 0.772C159.563 -1.276 162.849 -2.3 166.475 -2.3C169.889 -2.3 172.513 -1.55333 174.347 -0.0599997C176.225 1.39067 177.163 3.50267 177.163 6.276C177.163 8.196 176.779 9.668 176.011 10.692C175.243 11.6733 174.134 12.164 172.683 12.164C171.958 12.164 171.275 12.036 170.635 11.78C170.038 11.4813 169.505 11.0547 169.035 10.5C169.803 10.116 170.486 9.348 171.083 8.196C171.681 7.00133 171.979 5.80667 171.979 4.612C171.979 3.37467 171.638 2.41467 170.955 1.732C170.273 1.04933 169.313 0.708 168.075 0.708C166.198 0.708 164.342 1.86 162.507 4.164C160.673 6.42533 159.073 9.56133 157.707 13.572C156.769 16.3027 156.043 19.1613 155.531 22.148C155.019 25.092 154.763 27.908 154.763 30.596V28.096ZM177.224 48L184.432 11.2L175.216 12.48L168.008 49.28L177.224 48ZM206.878 48C206.878 47.4453 206.921 46.8267 207.006 46.144C207.091 45.4187 207.219 44.6507 207.39 43.84L214.238 11.78L223.71 10.5L216.35 45.06C216.265 45.444 216.201 45.8067 216.158 46.148C216.115 46.4467 216.094 46.7667 216.094 47.108C216.094 47.9613 216.286 48.58 216.67 48.964C217.097 49.3053 217.779 49.476 218.718 49.476C219.913 49.476 221.043 48.964 222.11 47.94C223.177 46.8733 223.966 45.508 224.478 43.844H227.166C225.801 47.7267 223.966 50.6707 221.662 52.676C219.358 54.6813 216.713 55.684 213.726 55.684C211.593 55.684 209.908 55.0227 208.67 53.7C207.476 52.3347 206.878 50.436 206.878 48Z"/></svg>
    </div>
    <div class="card">
      <div class="gradient-overlay"></div>
      <div class="content">
        <div class="icon-container">
          <svg viewBox="0 0 24 24" fill="none" stroke="{1}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">{3}</svg>
        </div>
        <h1>{0}</h1>
        <p>{2}</p>
        <p class="close-notice">You can close this tab and return to the app.</p>
      </div>
    </div>
  </div>
</body>
</html>"##,
        title, color, message, icon
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
        },
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

