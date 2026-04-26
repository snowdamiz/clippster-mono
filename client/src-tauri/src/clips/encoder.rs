use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use std::process::Output;

use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

// Helper function to get FFmpeg quality settings
pub fn get_quality_settings(quality: &str) -> (&str, &str) {
    match quality {
        "low" => ("ultrafast", "28"),
        "medium" => ("fast", "23"),
        "high" => ("medium", "20"),
        _ => ("fast", "23"),
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
        hw_accel: Some("auto".to_string()),
        hw_accel_output_format: None,
        hw_accel_device: None,
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
    matches!(
        codec,
        "h264_nvenc" | "h264_amf" | "h264_qsv" | "h264_videotoolbox" | "h264_vaapi"
    )
}

// Check if FFmpeg output indicates a hardware decoder failure
pub fn is_hardware_decoder_failure(stderr: &str) -> bool {
    let failure_patterns = [
        "hwaccel initialisation returned error",
        "No decoder surfaces left",
        "Failed to get HW surface",
        "Cannot load",
        "hwaccel_output_format not supported",
        "Failed to set hwaccel",
        "Device creation failed",
        "No device available",
        "hwaccel_device",
        "Failed to initialise device",
        "Incompatible pixel format",
    ];

    let stderr_lower = stderr.to_lowercase();
    for pattern in failure_patterns {
        if stderr_lower.contains(&pattern.to_lowercase()) {
            return true;
        }
    }
    false
}

// Remove hardware acceleration flags from FFmpeg args
pub fn remove_hwaccel_flags(args: &mut Vec<String>) {
    let mut i = 0;
    while i < args.len() {
        if args[i] == "-hwaccel"
            || args[i] == "-hwaccel_output_format"
            || args[i] == "-hwaccel_device"
        {
            args.remove(i); // Remove flag
            if i < args.len() {
                args.remove(i); // Remove value
            }
        } else {
            i += 1;
        }
    }
}

// Build hardware acceleration args from encoder config
// These args must be placed BEFORE the -i input argument
// IMPORTANT: hwaccel_output_format should NOT be used when there are no video filters,
// as FFmpeg cannot convert from CUDA format to encoder format without a filter chain.
// Always use GPU decode, but skip hwaccel_output_format to let FFmpeg handle format conversion.
pub fn build_hwaccel_args(encoder: &EncoderConfig, _uses_cpu_filters: bool) -> Vec<String> {
    let mut args = Vec::new();

    if let Some(hw_accel) = &encoder.hw_accel {
        println!("[Rust] Building hardware acceleration args:");
        println!("[Rust]   -hwaccel {}", hw_accel);
        args.push("-hwaccel".to_string());
        args.push(hw_accel.clone());

        // NEVER use hwaccel_output_format - it causes format conversion errors
        // FFmpeg will automatically handle GPU decode -> CPU memory -> GPU encode
        println!("[Rust]   Skipping hwaccel_output_format (let FFmpeg handle format conversion)");

        if let Some(device) = &encoder.hw_accel_device {
            println!("[Rust]   -hwaccel_device {}", device);
            args.push("-hwaccel_device".to_string());
            args.push(device.clone());
        }
    } else {
        println!("[Rust] No hardware acceleration args (hw_accel is None)");
    }

    args
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
    args: Vec<String>,
    encoder: &EncoderConfig,
    quality: &str,
    env_vars: Option<Vec<(&str, String)>>,
) -> Result<Output, String> {
    run_ffmpeg_with_fallback_impl(app, args, encoder, quality, env_vars, None).await
}

/// Same as [`run_ffmpeg_with_fallback`], but aborts in-flight FFmpeg when `cancel` becomes true.
pub async fn run_ffmpeg_with_fallback_cancellable(
    app: &tauri::AppHandle,
    args: Vec<String>,
    encoder: &EncoderConfig,
    quality: &str,
    env_vars: Option<Vec<(&str, String)>>,
    cancel: &AtomicBool,
) -> Result<Output, String> {
    run_ffmpeg_with_fallback_impl(app, args, encoder, quality, env_vars, Some(cancel)).await
}

/// Message returned when a cancellable FFmpeg run is stopped via `cancel`.
pub const FFMPEG_OPERATION_CANCELLED: &str = "FFmpeg operation cancelled";

fn output_from_exit_code(code: Option<i32>, stdout: Vec<u8>, stderr: Vec<u8>) -> Output {
    let code = code.unwrap_or(-1);
    #[cfg(unix)]
    let status = {
        use std::os::unix::process::ExitStatusExt;
        std::process::ExitStatus::from_raw((code as i32) << 8)
    };
    #[cfg(windows)]
    let status = {
        use std::os::windows::process::ExitStatusExt;
        std::process::ExitStatus::from_raw(code as u32)
    };
    Output {
        status,
        stdout,
        stderr,
    }
}

/// Run ffmpeg sidecar once, optionally watching `cancel` to kill the child.
pub async fn ffmpeg_sidecar_run_once_cancellable(
    app: &tauri::AppHandle,
    args: &[String],
    env_vars: Option<&[(&str, String)]>,
    cancel: Option<&AtomicBool>,
) -> Result<Output, String> {
    let shell = app.shell();
    let mut cmd = shell
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to get ffmpeg sidecar: {}", e))?;

    if let Some(vars) = env_vars {
        for (key, value) in vars {
            cmd = cmd.env(key, value);
        }
    }

    let (mut rx, child) = cmd
        .args(args)
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

    let mut stdout_buf = Vec::new();
    let mut stderr_buf = Vec::new();

    loop {
        if matches!(cancel, Some(c) if c.load(Ordering::SeqCst)) {
            let _ = child.kill();
            return Err(FFMPEG_OPERATION_CANCELLED.to_string());
        }

        tokio::select! {
            ev = rx.recv() => {
                match ev {
                    Some(CommandEvent::Stdout(data)) => stdout_buf.extend_from_slice(&data),
                    Some(CommandEvent::Stderr(data)) => stderr_buf.extend_from_slice(&data),
                    Some(CommandEvent::Terminated(payload)) => {
                        return Ok(output_from_exit_code(payload.code, stdout_buf, stderr_buf));
                    }
                    Some(CommandEvent::Error(err)) => {
                        let _ = child.kill();
                        return Err(format!("FFmpeg process error: {}", err));
                    }
                    Some(_) => {}
                    None => {
                        return Err("FFmpeg closed without termination".to_string());
                    }
                }
            }
            _ = tokio::time::sleep(Duration::from_millis(120)) => {}
        }
    }
}

async fn run_ffmpeg_with_fallback_impl(
    app: &tauri::AppHandle,
    mut args: Vec<String>,
    encoder: &EncoderConfig,
    quality: &str,
    env_vars: Option<Vec<(&str, String)>>,
    cancel: Option<&AtomicBool>,
) -> Result<Output, String> {
    let cpu_count = num_cpus::get().max(1);
    let encode_threads = (cpu_count / 2).clamp(2, 8);
    let filter_threads = (encode_threads / 2).max(1);

    // CRITICAL: Add -nostdin to prevent FFmpeg from hanging waiting for user input
    args.insert(0, "-nostdin".to_string());
    args.insert(0, encode_threads.to_string());
    args.insert(0, "-threads".to_string());
    args.insert(0, filter_threads.to_string());
    args.insert(0, "-filter_threads".to_string());
    args.insert(0, filter_threads.to_string());
    args.insert(0, "-filter_complex_threads".to_string());

    println!("[Rust] ========== FFMPEG EXECUTION START ==========");
    println!("[Rust] Encoder: {}", encoder.codec);
    println!("[Rust] Hardware Accel: {:?}", encoder.hw_accel);
    println!(
        "[Rust] Hardware Accel Output Format: {:?}",
        encoder.hw_accel_output_format
    );
    println!(
        "[Rust] Hardware Accel Device: {:?}",
        encoder.hw_accel_device
    );
    println!("[Rust] FFmpeg args count: {}", args.len());

    // Log first 20 args for debugging
    let preview_args: Vec<String> = args.iter().take(20).cloned().collect();
    println!("[Rust] FFmpeg args (first 20): {:?}", preview_args);

    let output = ffmpeg_sidecar_run_once_cancellable(
        app,
        &args,
        env_vars.as_ref().map(|v| v.as_slice()),
        cancel,
    )
    .await?;

    // Always log FFmpeg stderr for performance analysis
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Extract and log encoding speed from last progress line
    for line in stderr.lines().rev().take(20) {
        if line.contains("speed=") || line.contains("fps=") {
            println!("[Rust] FFmpeg progress: {}", line.trim());
            break;
        }
    }

    // Check if successful
    if output.status.success() {
        println!("[Rust] ✓ FFmpeg execution succeeded");
        println!("[Rust] ========== FFMPEG EXECUTION END ==========");
        return Ok(output);
    }

    println!("[Rust] ✗ FFmpeg execution failed");

    let stderr = String::from_utf8_lossy(&output.stderr);

    // Check for hardware decoder failure first (more common than encoder failure)
    if is_hardware_decoder_failure(&stderr) {
        println!("[Rust] ⚠ HARDWARE DECODER FAILURE DETECTED");
        println!(
            "[Rust] Error snippet: {}. Retrying with CPU decode...",
            stderr.lines().take(2).collect::<Vec<_>>().join(" | ")
        );

        // Remove hardware acceleration flags
        remove_hwaccel_flags(&mut args);

        println!("[Rust] ========== RETRY #1: CPU DECODE ==========");
        println!("[Rust] Removed hardware acceleration flags");
        println!("[Rust] Retrying FFmpeg with CPU decode");
        let retry_output = ffmpeg_sidecar_run_once_cancellable(
            app,
            &args,
            env_vars.as_ref().map(|v| v.as_slice()),
            cancel,
        )
        .await?;

        if retry_output.status.success() {
            println!("[Rust] ✓ CPU decode succeeded");
            println!("[Rust] ========== FFMPEG EXECUTION END ==========");
            return Ok(retry_output);
        }

        println!("[Rust] ✗ CPU decode also failed");

        // Decoder fallback failed, check if it's an encoder issue
        let retry_stderr = String::from_utf8_lossy(&retry_output.stderr);

        if is_hardware_encoder(&encoder.codec) && is_hardware_encoder_failure(&retry_stderr) {
            println!("[Rust] ⚠ HARDWARE ENCODER FAILURE DETECTED");
            println!("[Rust] ========== RETRY #2: CPU DECODE + SOFTWARE ENCODER ==========");
            println!("[Rust] Switching to libx264 software encoder");

            // Replace encoder with software encoder
            replace_encoder_in_args(&mut args, quality);

            let final_output = ffmpeg_sidecar_run_once_cancellable(
                app,
                &args,
                env_vars.as_ref().map(|v| v.as_slice()),
                cancel,
            )
            .await?;

            if final_output.status.success() {
                println!("[Rust] ✓ CPU decode + software encoder succeeded");
                println!("[Rust] ========== FFMPEG EXECUTION END ==========");
                return Ok(final_output);
            }

            println!("[Rust] ✗ All fallback attempts failed");
            println!("[Rust] ========== FFMPEG EXECUTION END ==========");

            let final_stderr = String::from_utf8_lossy(&final_output.stderr);
            return Err(format!(
                "FFmpeg failed with all fallback attempts. Final error: {}",
                final_stderr
            ));
        }

        return Err(format!(
            "FFmpeg failed after decoder fallback: {}",
            retry_stderr
        ));
    }

    // Check if this was a hardware encoder failure
    if is_hardware_encoder(&encoder.codec) && is_hardware_encoder_failure(&stderr) {
        println!("[Rust] ⚠ HARDWARE ENCODER FAILURE DETECTED");
        println!(
            "[Rust] Encoder: {} failed: {}. Retrying with libx264...",
            encoder.codec,
            stderr.lines().take(3).collect::<Vec<_>>().join(" | ")
        );

        // Replace encoder in args with software encoder
        replace_encoder_in_args(&mut args, quality);

        println!("[Rust] ========== RETRY: SOFTWARE ENCODER ==========");
        println!("[Rust] Switching to libx264 software encoder");
        let retry_output = ffmpeg_sidecar_run_once_cancellable(
            app,
            &args,
            env_vars.as_ref().map(|v| v.as_slice()),
            cancel,
        )
        .await?;

        if retry_output.status.success() {
            println!("[Rust] ✓ Software encoder (libx264) succeeded");
            println!("[Rust] ========== FFMPEG EXECUTION END ==========");
            return Ok(retry_output);
        }

        println!("[Rust] ✗ Software encoder also failed");
        println!("[Rust] ========== FFMPEG EXECUTION END ==========");

        // Both attempts failed
        let retry_stderr = String::from_utf8_lossy(&retry_output.stderr);
        return Err(format!(
            "FFmpeg failed with both hardware and software encoders. Software encoder error: {}",
            retry_stderr
        ));
    }

    // Not a hardware failure, return original error
    println!("[Rust] ✗ FFmpeg failed with non-hardware error");
    println!("[Rust] ========== FFMPEG EXECUTION END ==========");
    Err(format!("FFmpeg failed: {}", stderr))
}

// Hardware encoder configuration with decoder support
#[derive(Debug, Clone)]
pub struct EncoderConfig {
    pub codec: String,
    pub preset: Option<String>,
    pub quality_param: String,
    pub quality_value: String,
    pub hw_accel: Option<String>,
    pub hw_accel_output_format: Option<String>,
    pub hw_accel_device: Option<String>,
}

// Detect available hardware encoders and return optimal encoder config
pub async fn detect_hardware_encoder(app: &tauri::AppHandle, quality: &str) -> EncoderConfig {
    println!("[Rust] ========== HARDWARE ENCODER DETECTION START ==========");
    println!("[Rust] Requested quality: {}", quality);
    let shell = app.shell();

    // Try to get ffmpeg encoder list
    let encoder_check = shell
        .sidecar("ffmpeg")
        .map_err(|_| ())
        .map(|cmd| cmd.args(["-encoders"]));

    if let Ok(cmd) = encoder_check {
        if let Ok(output) = cmd.output().await {
            let encoders = String::from_utf8_lossy(&output.stdout);
            println!(
                "[Rust] FFmpeg encoders list retrieved ({} bytes)",
                encoders.len()
            );

            // Check for NVIDIA NVENC (best quality/speed)
            if encoders.contains("h264_nvenc") {
                println!("[Rust] ✓ Hardware encoder detected: NVIDIA NVENC");
                println!("[Rust]   - Codec: h264_nvenc");
                println!("[Rust]   - Preset: p4 (medium)");
                println!("[Rust]   - Hardware Decoder: CUDA");
                println!("[Rust]   - Decoder Output Format: cuda");
                println!("[Rust] Hardware decoder enabled: CUDA");
                let (_, crf) = get_quality_settings(quality);
                return EncoderConfig {
                    codec: "h264_nvenc".to_string(),
                    preset: Some("p4".to_string()), // p4 = medium quality preset
                    quality_param: "-cq".to_string(),
                    quality_value: crf.to_string(), // NVENC uses same CRF values
                    hw_accel: Some("cuda".to_string()),
                    hw_accel_output_format: Some("cuda".to_string()),
                    hw_accel_device: None,
                };
            }

            // Check for AMD AMF
            if encoders.contains("h264_amf") {
                println!("[Rust] ✓ Hardware encoder detected: AMD AMF");
                println!("[Rust]   - Codec: h264_amf");
                println!("[Rust]   - Hardware Decoder: D3D11VA");
                println!("[Rust]   - Decoder Output Format: d3d11");
                println!("[Rust] Hardware decoder enabled: D3D11VA");
                return EncoderConfig {
                    codec: "h264_amf".to_string(),
                    preset: Some("balanced".to_string()),
                    quality_param: "-rc".to_string(),
                    quality_value: "cqp".to_string(), // Use CQP mode for AMF if possible, or just default
                    hw_accel: Some("d3d11va".to_string()),
                    hw_accel_output_format: Some("d3d11".to_string()),
                    hw_accel_device: None,
                };
            }

            // Check for Intel Quick Sync
            if encoders.contains("h264_qsv") {
                println!("[Rust] ✓ Hardware encoder detected: Intel Quick Sync");
                println!("[Rust]   - Codec: h264_qsv");
                println!("[Rust]   - Hardware Decoder: QSV");
                println!("[Rust]   - Decoder Output Format: qsv");
                println!("[Rust] Hardware decoder enabled: QSV");
                let (_, crf) = get_quality_settings(quality);
                return EncoderConfig {
                    codec: "h264_qsv".to_string(),
                    preset: None,
                    quality_param: "-global_quality".to_string(),
                    quality_value: crf.to_string(),
                    hw_accel: Some("qsv".to_string()),
                    hw_accel_output_format: Some("qsv".to_string()),
                    hw_accel_device: None,
                };
            }

            // Check for Apple VideoToolbox (macOS)
            if encoders.contains("h264_videotoolbox") {
                println!("[Rust] ✓ Hardware encoder detected: Apple VideoToolbox");
                println!("[Rust]   - Codec: h264_videotoolbox");
                println!("[Rust]   - Hardware Decoder: VideoToolbox");
                println!("[Rust]   - Decoder Output Format: videotoolbox_vld");
                println!("[Rust] Hardware decoder enabled: VideoToolbox");
                // VideoToolbox uses different quality scale, map CRF to bitrate
                let quality_value = match quality {
                    "low" => "2000000",    // 2 Mbps
                    "medium" => "5000000", // 5 Mbps
                    "high" => "10000000",  // 10 Mbps
                    _ => "5000000",
                };
                return EncoderConfig {
                    codec: "h264_videotoolbox".to_string(),
                    preset: None,
                    quality_param: "-b:v".to_string(),
                    quality_value: quality_value.to_string(),
                    hw_accel: Some("videotoolbox".to_string()),
                    hw_accel_output_format: Some("videotoolbox_vld".to_string()),
                    hw_accel_device: None,
                };
            }

            // Check for VAAPI (Linux)
            if encoders.contains("h264_vaapi") {
                println!("[Rust] ✓ Hardware encoder detected: VAAPI");
                println!("[Rust]   - Codec: h264_vaapi");
                println!("[Rust]   - Hardware Decoder: VAAPI");
                println!("[Rust]   - Decoder Output Format: vaapi");
                println!("[Rust] Hardware decoder enabled: VAAPI");
                return EncoderConfig {
                    codec: "h264_vaapi".to_string(),
                    preset: None,
                    quality_param: "-qp".to_string(),
                    quality_value: "20".to_string(), // Fixed QP for now
                    hw_accel: Some("vaapi".to_string()),
                    hw_accel_output_format: Some("vaapi".to_string()),
                    hw_accel_device: None,
                };
            }
        }
    }

    // Fallback to software encoder
    println!("[Rust] ⚠ No hardware encoder detected, falling back to software");
    println!("[Rust]   - Codec: libx264");
    println!("[Rust]   - Hardware Decoder: auto (will attempt hardware decode)");
    println!("[Rust] ========== HARDWARE ENCODER DETECTION END ==========");
    println!("[Rust] Hardware decoder enabled: auto (will attempt hardware decode)");
    let (preset, crf) = get_quality_settings(quality);
    EncoderConfig {
        codec: "libx264".to_string(),
        preset: Some(preset.to_string()),
        quality_param: "-crf".to_string(),
        quality_value: crf.to_string(),
        hw_accel: Some("auto".to_string()),
        hw_accel_output_format: None,
        hw_accel_device: None,
    }
}
