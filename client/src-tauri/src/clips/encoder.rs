use tauri_plugin_shell::ShellExt;

// Helper function to get FFmpeg quality settings
pub fn get_quality_settings(quality: &str) -> (&str, &str) {
    match quality {
        "low" => ("faster", "28"),
        "medium" => ("medium", "23"),
        "high" => ("slow", "18"),
        _ => ("medium", "23"),
    }
}

// Hardware encoder configuration
#[derive(Debug, Clone)]
pub struct EncoderConfig {
    pub codec: String,
    pub preset: Option<String>,
    pub quality_param: String,
    pub quality_value: String,
}

// Detect available hardware encoders and return optimal encoder config
pub async fn detect_hardware_encoder(app: &tauri::AppHandle, quality: &str) -> EncoderConfig {
    let shell = app.shell();
    
    // Try to get ffmpeg encoder list
    let encoder_check = shell.sidecar("ffmpeg")
        .map_err(|_| ())
        .and_then(|cmd| Ok(cmd.args(["-encoders"])));
    
    if let Ok(cmd) = encoder_check {
        if let Ok(output) = cmd.output().await {
            let encoders = String::from_utf8_lossy(&output.stdout);
            
            // Check for NVIDIA NVENC (best quality/speed)
            if encoders.contains("h264_nvenc") {
                println!("[Rust] Hardware encoder detected: NVIDIA NVENC");
                let (_, crf) = get_quality_settings(quality);
                return EncoderConfig {
                    codec: "h264_nvenc".to_string(),
                    preset: Some("p4".to_string()), // p4 = medium quality preset
                    quality_param: "-cq".to_string(),
                    quality_value: crf.to_string(), // NVENC uses same CRF values
                };
            }
            
            // Check for Intel Quick Sync
            if encoders.contains("h264_qsv") {
                println!("[Rust] Hardware encoder detected: Intel Quick Sync");
                let (_, crf) = get_quality_settings(quality);
                return EncoderConfig {
                    codec: "h264_qsv".to_string(),
                    preset: None,
                    quality_param: "-global_quality".to_string(),
                    quality_value: crf.to_string(),
                };
            }
            
            // Check for Apple VideoToolbox (macOS)
            if encoders.contains("h264_videotoolbox") {
                println!("[Rust] Hardware encoder detected: Apple VideoToolbox");
                // VideoToolbox uses different quality scale, map CRF to bitrate
                let quality_value = match quality {
                    "low" => "2000000",   // 2 Mbps
                    "medium" => "5000000", // 5 Mbps
                    "high" => "10000000",  // 10 Mbps
                    _ => "5000000",
                };
                return EncoderConfig {
                    codec: "h264_videotoolbox".to_string(),
                    preset: None,
                    quality_param: "-b:v".to_string(),
                    quality_value: quality_value.to_string(),
                };
            }
        }
    }
    
    // Fallback to software encoder
    println!("[Rust] No hardware encoder detected, using libx264");
    let (preset, crf) = get_quality_settings(quality);
    EncoderConfig {
        codec: "libx264".to_string(),
        preset: Some(preset.to_string()),
        quality_param: "-crf".to_string(),
        quality_value: crf.to_string(),
    }
}

