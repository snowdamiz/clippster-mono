use serde::Serialize;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
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

    #[cfg(not(any(
        all(target_os = "windows", any(target_arch = "x86_64", target_arch = "aarch64")),
        all(target_os = "linux", any(target_arch = "x86_64", target_arch = "aarch64")),
        all(target_os = "macos", any(target_arch = "x86_64", target_arch = "aarch64"))
    )))]
    compile_error!("Unsupported platform for sidecar binaries");
}

/// Resolve a bundled binary (`externalBin` in tauri.conf.json) using Tauri's naming convention.
/// Production places it next to the executable with a `-{target_triple}` suffix (stripped in macOS
/// bundles); dev keeps it in `src-tauri/binaries/`. Falls back to the system PATH.
pub fn resolve_sidecar_binary(base_name: &str) -> Result<String, String> {
    let exe_path =
        std::env::current_exe().map_err(|e| format!("Failed to get executable path: {}", e))?;
    let exe_dir = exe_path.parent().ok_or("Failed to get parent directory")?;

    let suffix = if cfg!(target_os = "windows") { ".exe" } else { "" };
    let binary_name = format!("{}-{}{}", base_name, get_target_triple(), suffix);
    let bare_name = format!("{}{}", base_name, suffix);

    let mut candidates = vec![exe_dir.join(&binary_name), exe_dir.join(&bare_name)];
    if let Some(src_tauri) = exe_dir.parent().and_then(|target| target.parent()) {
        candidates.push(src_tauri.join("binaries").join(&binary_name));
    }

    if let Some(found) = candidates.into_iter().find(|path| path.exists()) {
        return Ok(found.to_string_lossy().to_string());
    }

    println!(
        "[Sidecar] {} not found in bundle, falling back to PATH: {}",
        base_name, bare_name
    );
    Ok(bare_name)
}

/// Resolve the bundled Node.js binary.
pub fn resolve_node_binary() -> Result<String, String> {
    resolve_sidecar_binary("node")
}

/// Locate a bundled resource directory: `src-tauri/{relative}` in dev, `{resources}/{relative}`
/// in production.
pub fn resolve_resource_dir(app: &AppHandle, relative: &str) -> Result<PathBuf, String> {
    let dev_dir = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent()?.parent()?.parent().map(|p| p.to_path_buf()))
        .map(|src_tauri| src_tauri.join(relative));

    if let Some(dir) = dev_dir.filter(|d| d.exists()) {
        return Ok(dir);
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    let dir = resource_dir.join(relative);
    if dir.exists() {
        Ok(dir)
    } else {
        Err(format!("Resource '{}' not found at {}", relative, dir.display()))
    }
}

/// A long-lived Node.js process speaking newline-delimited JSON over stdin/stdout.
/// Every stdout line that parses as JSON is re-emitted to the frontend on `event`.
pub struct NodeSidecar {
    process: Child,
    stdin: Arc<Mutex<ChildStdin>>,
}

impl NodeSidecar {
    pub fn spawn(
        app: &AppHandle,
        name: &str,
        entry: &str,
        event: &'static str,
        envs: &[(&str, String)],
    ) -> Result<Self, String> {
        let dir = resolve_resource_dir(app, &format!("sidecars/{name}"))?;
        let entry_path = dir.join(entry);
        if !entry_path.exists() {
            return Err(format!(
                "Sidecar entry not found: {}",
                entry_path.display()
            ));
        }

        let node_path = resolve_node_binary()?;
        let mut cmd = Command::new(&node_path);
        cmd.arg(&entry_path)
            .current_dir(&dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        for (key, value) in envs {
            cmd.env(key, value);
        }

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let mut process = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar '{}' (node={}): {}", name, node_path, e))?;

        let stdin = process.stdin.take().ok_or("Failed to get sidecar stdin")?;
        let stdout = process.stdout.take().ok_or("Failed to get sidecar stdout")?;
        let stderr = process.stderr.take().ok_or("Failed to get sidecar stderr")?;

        let app_handle = app.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if let Ok(message) = serde_json::from_str::<serde_json::Value>(&line) {
                    let _ = app_handle.emit(event, message);
                }
            }
        });

        let label = name.to_string();
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                eprintln!("[{}] {}", label, line);
            }
        });

        Ok(Self {
            process,
            stdin: Arc::new(Mutex::new(stdin)),
        })
    }

    pub fn send<T: Serialize>(&self, message: &T) -> Result<(), String> {
        let json = serde_json::to_string(message)
            .map_err(|e| format!("Failed to serialize sidecar message: {}", e))?;
        let mut stdin = self
            .stdin
            .lock()
            .map_err(|e| format!("Failed to lock sidecar stdin: {}", e))?;
        writeln!(stdin, "{}", json).map_err(|e| format!("Failed to write to sidecar: {}", e))?;
        stdin
            .flush()
            .map_err(|e| format!("Failed to flush sidecar stdin: {}", e))
    }

    pub fn is_running(&mut self) -> bool {
        matches!(self.process.try_wait(), Ok(None))
    }

    pub fn kill(&mut self) -> Result<(), String> {
        self.process
            .kill()
            .map_err(|e| format!("Failed to kill sidecar: {}", e))
    }
}

impl Drop for NodeSidecar {
    fn drop(&mut self) {
        let _ = self.kill();
    }
}
