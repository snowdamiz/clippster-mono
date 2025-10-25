use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn open_wallet_auth_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;
    
    let _webview_window = WebviewWindowBuilder::new(
        &app,
        "wallet-auth",
        tauri::WebviewUrl::App("wallet-auth.html".into()),
    )
    .title("Connect Wallet")
    .inner_size(500.0, 600.0)
    .resizable(false)
    .always_on_top(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn close_auth_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("wallet-auth") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            open_wallet_auth_window,
            close_auth_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
