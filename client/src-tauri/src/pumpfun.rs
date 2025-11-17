use std::process::Command;

#[tauri::command]
pub async fn get_pumpfun_clips(mint_id: String, limit: Option<u32>) -> Result<String, String> {
    let limit_str = limit.unwrap_or(20).to_string();

    // Get the path to the Node.js service
    // In dev mode, the script is in src-tauri/pumpfun-service/
    // In production, it should be bundled with the app
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;

    let exe_dir = exe_path
        .parent()
        .ok_or("Failed to get parent directory")?;

    // In development mode (tauri dev), the exe is in target/debug/
    // and we need to go up two levels to reach src-tauri/
    let dev_script_path = exe_dir
        .parent()  // Go from target/debug/ to target/
        .and_then(|p| p.parent())  // Go from target/ to src-tauri/
        .map(|p| p.join("pumpfun-service").join("fetch-clips.mjs"));

    // Try the current directory approach (for when running from src-tauri/)
    let current_dir_path = exe_dir
        .join("pumpfun-service")
        .join("fetch-clips.mjs");

    // Production path (bundled with app)
    let prod_script_path = exe_dir.join("pumpfun-service").join("fetch-clips.mjs");

    let script_path = if let Some(ref path) = dev_script_path {
        if path.exists() {
            path
        } else if current_dir_path.exists() {
            &current_dir_path
        } else {
            &prod_script_path
        }
    } else if current_dir_path.exists() {
        &current_dir_path
    } else {
        &prod_script_path
    };

    // Execute the Node.js script
    let output = Command::new("node")
        .arg(script_path)
        .arg(&mint_id)
        .arg(&limit_str)
        .output()
        .map_err(|e| format!("Failed to execute Node.js script: {}. Make sure Node.js is installed.", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("PumpFun API error: {}", stderr))
    }
}