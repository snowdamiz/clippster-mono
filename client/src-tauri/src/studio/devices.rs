use super::types::StudioDevice;
use tauri::AppHandle;

#[cfg(target_os = "windows")]
fn quoted_device_name(line: &str) -> Option<String> {
    if line.contains("Alternative name") {
        return None;
    }

    let start = line.find('"')?;
    let rest = &line[start + 1..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

#[cfg(target_os = "windows")]
pub async fn list_studio_devices(app: &AppHandle) -> Result<Vec<StudioDevice>, String> {
    let mut devices = Vec::new();

    // Displays (gdigrab desktop + monitor indices)
    devices.push(StudioDevice {
        id: "desktop".to_string(),
        label: "Full Desktop".to_string(),
        kind: "display".to_string(),
    });

    // List dshow video/audio devices via ffmpeg
    let output = crate::ffmpeg_sidecar::run_ffmpeg(
        app,
        &["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"],
    )
    .await?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    println!("[Studio] FFmpeg device listing output:\n{}", stderr);

    let mut in_video = false;
    let mut in_audio = false;

    for line in stderr.lines() {
        let trimmed = line.trim();
        if trimmed.contains("DirectShow video devices") {
            in_video = true;
            in_audio = false;
            continue;
        }
        if trimmed.contains("DirectShow audio devices") {
            in_audio = true;
            in_video = false;
            continue;
        }
        if let Some(name) = quoted_device_name(trimmed) {
            println!("[Studio] Found device: {} (video={}, audio={})", name, in_video, in_audio);
            if in_video {
                devices.push(StudioDevice {
                    id: format!("video={}", name),
                    label: name.to_string(),
                    kind: "camera".to_string(),
                });
            } else if in_audio {
                devices.push(StudioDevice {
                    id: format!("audio={}", name),
                    label: name.to_string(),
                    kind: "microphone".to_string(),
                });
            }
        }
    }

    println!("[Studio] Total devices found: {}", devices.len());
    Ok(devices)
}

#[cfg(not(target_os = "windows"))]
pub async fn list_studio_devices(_app: &AppHandle) -> Result<Vec<StudioDevice>, String> {
    Ok(vec![
        StudioDevice {
            id: "desktop".to_string(),
            label: "Full Desktop".to_string(),
            kind: "display".to_string(),
        },
    ])
}
