use super::types::StudioFinalizeConfig;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

pub async fn finalize_recording(
    app: &AppHandle,
    config: StudioFinalizeConfig,
) -> Result<String, String> {
    let intro = config.intro_path.filter(|p| PathBuf::from(p).exists());
    let outro = config.outro_path.filter(|p| PathBuf::from(p).exists());

    if intro.is_none() && outro.is_none() {
        return Ok(config.recording_path);
    }

    let parent = PathBuf::from(&config.recording_path)
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let output_path = parent.join(format!("studio_final_{}.mp4", timestamp));
    let concat_list = parent.join(format!("studio_concat_{}.txt", timestamp));

    let mut lines = Vec::new();
    if let Some(p) = &intro {
        lines.push(format!("file '{}'", p.replace('\\', "/")));
    }
    lines.push(format!("file '{}'", config.recording_path.replace('\\', "/")));
    if let Some(p) = &outro {
        lines.push(format!("file '{}'", p.replace('\\', "/")));
    }

    fs::write(&concat_list, lines.join("\n"))
        .map_err(|e| format!("Failed to write concat list: {}", e))?;

    let output_str = output_path.to_string_lossy().to_string();
    let concat_str = concat_list.to_string_lossy().to_string();

    let output = crate::ffmpeg_sidecar::run_ffmpeg(
        app,
        &[
            "-y",
            "-nostdin",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            &concat_str,
            "-c",
            "copy",
            &output_str,
        ],
    )
    .await?;

    let _ = fs::remove_file(&concat_list);

    if !output.status.success() {
        // Re-encode fallback if stream copy fails
        let reencode = crate::ffmpeg_sidecar::run_ffmpeg(
            app,
            &[
                "-y",
                "-nostdin",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                &concat_str,
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-c:a",
                "aac",
                &output_str,
            ],
        )
        .await?;
        if !reencode.status.success() {
            return Err(format!(
                "Finalize failed: {}",
                String::from_utf8_lossy(&reencode.stderr)
            ));
        }
    }

    Ok(output_str)
}
