use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::Emitter;
use warp::Filter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StripePaymentResult {
    pub success: bool,
    pub session_id: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}

pub static STRIPE_PAYMENT_RESULT: Lazy<Arc<Mutex<Option<StripePaymentResult>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));
pub static STRIPE_SERVER_PORT: u16 = 48277;

pub fn start_stripe_callback_server(app: tauri::AppHandle) {
    static SERVER_STARTED: AtomicBool = AtomicBool::new(false);

    if SERVER_STARTED.swap(true, Ordering::SeqCst) {
        return; // Server already running
    }

    tokio::spawn(async move {
        let stripe_result = STRIPE_PAYMENT_RESULT.clone();
        let app_handle = app.clone();

        // GET callback endpoint for Stripe success redirect
        let stripe_result_success = stripe_result.clone();
        let app_handle_success = app_handle.clone();
        let stripe_success = warp::path("stripe-success")
            .and(warp::get())
            .and(warp::query::<std::collections::HashMap<String, String>>())
            .map(move |params: std::collections::HashMap<String, String>| {
                let session_id = params.get("session_id").cloned();
                
                let result = StripePaymentResult {
                    success: true,
                    session_id,
                    error: None,
                };

                println!("[Stripe] Payment success callback received: {:?}", result);

                // Store the result
                *stripe_result_success.lock().unwrap() = Some(result.clone());

                // Emit event to frontend
                let _ = app_handle_success.emit("stripe-payment-complete", result);

                // Return HTML page
                let html = r#"<!DOCTYPE html>
<html>
<head>
    <title>Payment Successful</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fff; }
        .container { text-align: center; padding: 2rem; }
        .icon { font-size: 4rem; margin-bottom: 1rem; color: #10b981; }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        p { color: #888; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✓</div>
        <h1>Payment Successful!</h1>
        <p>Your subscription has been activated.</p>
        <p>You can close this tab and return to the app.</p>
    </div>
</body>
</html>"#;
                warp::reply::html(html)
            });

        // GET callback endpoint for Stripe cancel redirect
        let stripe_result_cancel = stripe_result.clone();
        let app_handle_cancel = app_handle.clone();
        let stripe_cancel = warp::path("stripe-cancel")
            .and(warp::get())
            .map(move || {
                let result = StripePaymentResult {
                    success: false,
                    session_id: None,
                    error: Some("Payment cancelled by user".to_string()),
                };

                println!("[Stripe] Payment cancelled");

                // Store the result
                *stripe_result_cancel.lock().unwrap() = Some(result.clone());

                // Emit event to frontend
                let _ = app_handle_cancel.emit("stripe-payment-complete", result);

                // Return HTML page
                let html = r#"<!DOCTYPE html>
<html>
<head>
    <title>Payment Cancelled</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fff; }
        .container { text-align: center; padding: 2rem; }
        .icon { font-size: 4rem; margin-bottom: 0rem; color: #ef4444; }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        p { color: #888; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✗</div>
        <h1>Payment Cancelled</h1>
        <p>No charges were made to your account.</p>
        <p>You can close this tab and return to the app.</p>
    </div>
</body>
</html>"#;
                warp::reply::html(html)
            });

        // CORS configuration
        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "POST", "OPTIONS"])
            .allow_headers(vec!["Content-Type"]);

        let routes = stripe_success.or(stripe_cancel).with(cors);

        println!(
            "Starting Stripe callback server on port {}",
            STRIPE_SERVER_PORT
        );
        warp::serve(routes)
            .run(([127, 0, 0, 1], STRIPE_SERVER_PORT))
            .await;
    });
}

#[tauri::command]
pub async fn open_stripe_payment_window(
    app: tauri::AppHandle,
    checkout_url: String,
) -> Result<(), String> {
    // Clear any previous payment result
    *STRIPE_PAYMENT_RESULT.lock().unwrap() = None;

    // Start local callback server
    start_stripe_callback_server(app.clone());

    // Open Stripe checkout in browser
    tauri_plugin_opener::open_url(checkout_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn poll_stripe_payment_result() -> Result<Option<StripePaymentResult>, String> {
    let result = STRIPE_PAYMENT_RESULT.lock().unwrap().clone();
    Ok(result)
}

#[tauri::command]
pub async fn clear_stripe_payment_result() -> Result<(), String> {
    *STRIPE_PAYMENT_RESULT.lock().unwrap() = None;
    Ok(())
}
