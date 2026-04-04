use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Get the target triple for the current platform (matches Tauri's sidecar naming)
fn get_target_triple() -> &'static str {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    return "x86_64-pc-windows-msvc";

    #[cfg(all(target_os = "windows", target_arch = "aarch64"))]
    return "aarch64-pc-windows-msvc";

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    return "x86_64-unknown-linux-gnu";

    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    return "aarch64-unknown-linux-gnu";

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    return "x86_64-apple-darwin";

    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    return "aarch64-apple-darwin";
}

/// Resolve the bundled node binary path using Tauri's sidecar naming convention.
pub fn resolve_node_binary() -> Result<String, String> {
    let exe_path =
        std::env::current_exe().map_err(|e| format!("Failed to get executable path: {}", e))?;

    let exe_dir = exe_path.parent().ok_or("Failed to get parent directory")?;

    let target_triple = get_target_triple();

    #[cfg(target_os = "windows")]
    let binary_name = format!("node-{}.exe", target_triple);

    #[cfg(not(target_os = "windows"))]
    let binary_name = format!("node-{}", target_triple);

    // Production: sidecar is next to the executable
    let prod_path = exe_dir.join(&binary_name);
    if prod_path.exists() {
        return Ok(prod_path.to_string_lossy().to_string());
    }

    // macOS production bundle: Tauri strips the target triple from sidecar names
    #[cfg(target_os = "windows")]
    let bare_name = "node.exe".to_string();
    #[cfg(not(target_os = "windows"))]
    let bare_name = "node".to_string();

    let bare_path = exe_dir.join(&bare_name);
    if bare_path.exists() {
        println!(
            "[RemotionSidecar] Found node at (bundle): {}",
            bare_path.display()
        );
        return Ok(bare_path.to_string_lossy().to_string());
    }

    // Development mode: check src-tauri/binaries/
    if let Some(target_dir) = exe_dir.parent() {
        if let Some(target_parent) = target_dir.parent() {
            let dev_path = target_parent.join("binaries").join(&binary_name);
            if dev_path.exists() {
                return Ok(dev_path.to_string_lossy().to_string());
            }
        }
    }

    // Fallback to system PATH
    #[cfg(target_os = "windows")]
    let fallback = "node.exe".to_string();

    #[cfg(not(target_os = "windows"))]
    let fallback = "node".to_string();

    println!(
        "[RemotionSidecar] node not found in bundle, falling back to PATH: {}",
        fallback
    );
    Ok(fallback)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RenderCommand {
    #[serde(rename = "render")]
    Render {
        #[serde(rename = "renderId")]
        render_id: String,
        composition: serde_json::Value,
        #[serde(rename = "outputPath")]
        output_path: String,
        codec: Option<String>,
        crf: Option<u32>,
    },
    #[serde(rename = "cancel")]
    Cancel {
        #[serde(rename = "renderId")]
        render_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SidecarMessage {
    #[serde(rename = "progress")]
    Progress {
        #[serde(rename = "renderId")]
        render_id: String,
        progress: f64,
    },
    #[serde(rename = "complete")]
    Complete {
        #[serde(rename = "renderId")]
        render_id: String,
        #[serde(rename = "outputPath")]
        output_path: String,
    },
    #[serde(rename = "error")]
    Error {
        #[serde(rename = "renderId")]
        render_id: String,
        error: String,
    },
}

pub struct RemotionSidecar {
    process: Child,
    stdin: Arc<Mutex<ChildStdin>>,
}

impl RemotionSidecar {
    pub fn spawn(app: &AppHandle) -> Result<Self, String> {
        // In development, use the bundle.js from the sidecars directory
        // In production, this would be bundled with the app

        // Development path: resolve from executable location
        // Exe is at: client/src-tauri/target/debug/clippster.exe
        // Bundle is at: client/src-tauri/sidecars/remotion-renderer/dist/bundle.js
        let dev_bundle_path = std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().map(|p| p.to_path_buf())) // target/debug/
            .and_then(|p| p.parent().map(|p| p.to_path_buf())) // target/
            .and_then(|p| p.parent().map(|p| p.to_path_buf())) // src-tauri/
            .map(|p| {
                p.join("sidecars")
                    .join("remotion-renderer")
                    .join("dist")
                    .join("bundle.js")
            })
            .ok_or("Failed to construct dev bundle path")?;

        let bundle_path = if dev_bundle_path.exists() {
            dev_bundle_path
        } else {
            // Production: look in resources
            let resource_path = app
                .path()
                .resource_dir()
                .map_err(|e| format!("Failed to get resource dir: {}", e))?;
            resource_path
                .join("sidecars")
                .join("remotion-renderer")
                .join("dist")
                .join("bundle.js")
        };

        if !bundle_path.exists() {
            return Err(format!(
                "Remotion renderer bundle not found at: {}",
                bundle_path.display()
            ));
        }

        // Resolve the bundled node binary (same pattern as kick.rs/twitch.rs)
        let node_path =
            resolve_node_binary().map_err(|e| format!("Failed to resolve node binary: {}", e))?;

        // Run with bundled Node.js
        let mut cmd = Command::new(&node_path);
        cmd.arg(&bundle_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let mut process = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar (node={}): {}", node_path, e))?;

        let stdin = process.stdin.take().ok_or("Failed to get stdin")?;

        let stdout = process.stdout.take().ok_or("Failed to get stdout")?;

        let stdin = Arc::new(Mutex::new(stdin));

        // Spawn thread to read messages from sidecar
        let app_handle = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        if let Ok(message) = serde_json::from_str::<SidecarMessage>(&line) {
                            // Emit message to frontend
                            let _ = app_handle.emit("remotion-render-message", message);
                        }
                    }
                    Err(e) => {
                        eprintln!("Error reading sidecar output: {}", e);
                        break;
                    }
                }
            }
        });

        Ok(Self { process, stdin })
    }

    pub fn send_command(&self, cmd: RenderCommand) -> Result<(), String> {
        let json = serde_json::to_string(&cmd)
            .map_err(|e| format!("Failed to serialize command: {}", e))?;

        let mut stdin = self
            .stdin
            .lock()
            .map_err(|e| format!("Failed to lock stdin: {}", e))?;

        writeln!(stdin, "{}", json).map_err(|e| format!("Failed to write to stdin: {}", e))?;

        stdin
            .flush()
            .map_err(|e| format!("Failed to flush stdin: {}", e))?;

        Ok(())
    }

    pub fn kill(&mut self) -> Result<(), String> {
        self.process
            .kill()
            .map_err(|e| format!("Failed to kill sidecar: {}", e))
    }
}

impl Drop for RemotionSidecar {
    fn drop(&mut self) {
        let _ = self.kill();
    }
}
