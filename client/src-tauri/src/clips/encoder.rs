use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::Output;

// Helper function to get FFmpeg quality settings
pub fn get_quality_settings(quality: &str) -> (&str, &str) {
    match quality {
        "low" => ("faster", "28"),
        "medium" => ("medium", "23"),
        "high" => ("slow", "18"),
        _ => ("medium", "23"),
    }
}

// Get software encoder config (libx264) for fallback
pub fn get_software_encoder(quality: &str) -> EncoderConfig {
    let (preset, crf) = get_quality_settings(quality);
    EncoderConfig {
        codec: "libx264".to_string(),
        preset: Some(preset.to_string()),
        quality_param: "-crf".to_string(),
        quality_value: crf.to_string(),
    }
}

// Check if FFmpeg output indicates a hardware encoder failure
pub fn is_hardware_encoder_failure(stderr: &str) -> bool {
    let failure_patterns = [
        "Cannot load nvcuda.dll",
        "Cannot load nvEncodeAPI64.dll",
        "Cannot load libcuda.so",
        "nvenc",
        "Error while opening encoder",
        "No NVENC capable devices found",
        "Cannot initialize NVENC",
        "InitializeEncoder failed",
        "h264_amf",
        "amf",
        "h264_qsv",
        "qsv",
        "h264_videotoolbox",
        "videotoolbox",
        "h264_vaapi",
        "vaapi",
        "Provided device doesn't support",
        "Failed to initialise",
        "Cannot open",
        "Device setup failed",
    ];
    
    let stderr_lower = stderr.to_lowercase();
    for pattern in failure_patterns {
        if stderr_lower.contains(&pattern.to_lowercase()) {
            return true;
        }
    }
    false
}

// Check if encoder is a hardware encoder that might fail at runtime
pub fn is_hardware_encoder(codec: &str) -> bool {
    matches!(codec, "h264_nvenc" | "h264_amf" | "h264_qsv" | "h264_videotoolbox" | "h264_vaapi")
}

// Replace encoder args in an args vector with software encoder settings
pub fn replace_encoder_in_args(args: &mut Vec<String>, quality: &str) {
    let software_encoder = get_software_encoder(quality);
    
    // Find and replace -c:v argument
    for i in 0..args.len() {
        if args[i] == "-c:v" && i + 1 < args.len() {
            args[i + 1] = software_encoder.codec.clone();
            break;
        }
    }
    
    // Find and replace -preset if present, or add it
    let mut preset_idx = None;
    for i in 0..args.len() {
        if args[i] == "-preset" && i + 1 < args.len() {
            preset_idx = Some(i);
            break;
        }
    }
    
    if let Some(idx) = preset_idx {
        if let Some(preset) = &software_encoder.preset {
            args[idx + 1] = preset.clone();
        }
    } else if let Some(preset) = &software_encoder.preset {
        // Find position after -c:v to insert preset
        for i in 0..args.len() {
            if args[i] == "-c:v" && i + 2 < args.len() {
                args.insert(i + 2, preset.clone());
                args.insert(i + 2, "-preset".to_string());
                break;
            }
        }
    }
    
    // Find and replace quality param (various hardware encoder quality params)
    let hw_quality_params = ["-cq", "-global_quality", "-qp", "-rc"];
    for i in 0..args.len() {
        if hw_quality_params.contains(&args[i].as_str()) && i + 1 < args.len() {
            args[i] = software_encoder.quality_param.clone();
            args[i + 1] = software_encoder.quality_value.clone();
            break;
        }
    }
}

/// Run FFmpeg with automatic fallback to software encoder if hardware encoding fails.
/// 
/// This function:
/// 1. Runs FFmpeg with the provided args (which may use hardware encoding)
/// 2. If FFmpeg fails with a hardware encoder error, modifies args to use libx264 and retries
/// 3. Returns the final output
/// 
/// # Arguments
/// * `app` - Tauri app handle
/// * `args` - FFmpeg arguments (will be modified in-place if fallback needed)
/// * `encoder` - The encoder config used to build the args
/// * `quality` - Quality setting for fallback encoder
/// * `env_vars` - Optional environment variables to set
/// 
/// # Returns
/// * `Ok(Output)` on success
/// * `Err(String)` if both attempts fail
pub async fn run_ffmpeg_with_fallback(
    app: &tauri::AppHandle,
    mut args: Vec<String>,
    encoder: &EncoderConfig,
    quality: &str,
    env_vars: Option<Vec<(&str, String)>>,
) -> Result<Output, String> {
    let shell = app.shell();
    
    // First attempt with original encoder
    let mut cmd = shell.sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?;
    
    // Add environment variables if provided
    if let Some(vars) = &env_vars {
        for (key, value) in vars {
            cmd = cmd.env(key, value);
        }
    }
    
    println!("[Rust] Running FFmpeg with encoder: {}", encoder.codec);
    let output = cmd.args(&args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;
    
    // Check if successful
    if output.status.success() {
        return Ok(output);
    }
    
    // Check if this was a hardware encoder failure
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    if is_hardware_encoder(&encoder.codec) && is_hardware_encoder_failure(&stderr) {
        println!("[Rust] Hardware encoder ({}) failed: {}. Retrying with libx264...", 
                 encoder.codec, stderr.lines().take(3).collect::<Vec<_>>().join(" | "));
        
        // Replace encoder in args with software encoder
        replace_encoder_in_args(&mut args, quality);
        
        // Retry with software encoder
        let mut retry_cmd = shell.sidecar("ffmpeg")
            .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?;
        
        if let Some(vars) = &env_vars {
            for (key, value) in vars {
                retry_cmd = retry_cmd.env(key, value);
            }
        }
        
        println!("[Rust] Retrying FFmpeg with software encoder: libx264");
        let retry_output = retry_cmd.args(&args)
            .output()
            .await
            .map_err(|e| format!("Failed to run ffmpeg (retry): {}", e))?;
        
        if retry_output.status.success() {
            println!("[Rust] Software encoder (libx264) succeeded");
            return Ok(retry_output);
        }
        
        // Both attempts failed
        let retry_stderr = String::from_utf8_lossy(&retry_output.stderr);
        return Err(format!("FFmpeg failed with both hardware and software encoders. Software encoder error: {}", retry_stderr));
    }
    
    // Not a hardware encoder failure, return original error
    Err(format!("FFmpeg failed: {}", stderr))
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
            
            // Check for AMD AMF
            if encoders.contains("h264_amf") {
                println!("[Rust] Hardware encoder detected: AMD AMF");
                return EncoderConfig {
                    codec: "h264_amf".to_string(),
                    preset: Some("balanced".to_string()),
                    quality_param: "-rc".to_string(),
                    quality_value: "cqp".to_string(), // Use CQP mode for AMF if possible, or just default
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

            // Check for VAAPI (Linux)
            if encoders.contains("h264_vaapi") {
                println!("[Rust] Hardware encoder detected: VAAPI");
                return EncoderConfig {
                    codec: "h264_vaapi".to_string(),
                    preset: None,
                    quality_param: "-qp".to_string(),
                    quality_value: "20".to_string(), // Fixed QP for now
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

