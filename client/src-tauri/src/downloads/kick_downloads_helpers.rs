// Helper functions for Kick VOD downloads

#[cfg(target_os = "windows")]
pub fn no_window(cmd: &mut tokio::process::Command) -> &mut tokio::process::Command {
    cmd.creation_flags(0x08000000) // CREATE_NO_WINDOW
}

#[cfg(not(target_os = "windows"))]
pub fn no_window(cmd: &mut tokio::process::Command) -> &mut tokio::process::Command {
    cmd
}

/// Resolve the yt-dlp binary path for Kick downloads
pub fn resolve_kick_ytdlp_binary() -> Result<String, String> {
    crate::kick::resolve_sidecar_binary("yt-dlp")
}

/// Resolve the ffmpeg binary path for Kick downloads
pub fn resolve_kick_ffmpeg_binary() -> Result<String, String> {
    crate::kick::resolve_sidecar_binary("ffmpeg")
}
