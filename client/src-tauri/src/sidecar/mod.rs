use std::process::{Child, Command, Stdio};
use std::io::{BufRead, BufReader, Write};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum RenderCommand {
    #[serde(rename = "render")]
    Render {
        id: String,
        composition: serde_json::Value,
        #[serde(rename = "outputPath")]
        output_path: String,
        options: Option<RenderOptions>,
    },
    #[serde(rename = "cancel")]
    Cancel { id: String },
}

#[derive(Debug, Serialize)]
pub struct RenderOptions {
    pub codec: Option<String>,
    pub crf: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SidecarMessage {
    #[serde(rename = "ready")]
    Ready,
    #[serde(rename = "progress")]
    Progress {
        id: String,
        progress: f64,
        #[serde(rename = "renderedFrames")]
        rendered_frames: u32,
        #[serde(rename = "totalFrames")]
        total_frames: u32,
    },
    #[serde(rename = "complete")]
    Complete { id: String, success: bool },
    #[serde(rename = "error")]
    Error { id: Option<String>, error: String },
    #[serde(rename = "cancelled")]
    Cancelled { id: String },
}

pub struct RemotionSidecar {
    process: Child,
    stdin: Arc<Mutex<std::process::ChildStdin>>,
}

impl RemotionSidecar {
    pub fn spawn(app: &AppHandle) -> Result<Self, String> {
        let resource_dir = app
            .path()
            .resource_dir()
            .map_err(|e| e.to_string())?;
        
        let sidecar_path = resource_dir
            .join("sidecars")
            .join(if cfg!(target_os = "windows") {
                "remotion-renderer.exe"
            } else if cfg!(target_os = "macos") {
                "remotion-renderer-macos"
            } else {
                "remotion-renderer-linux"
            });
        
        let mut child = Command::new(sidecar_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;
        
        let stdin = child.stdin.take().ok_or("Failed to get stdin")?;
        
        Ok(Self {
            process: child,
            stdin: Arc::new(Mutex::new(stdin)),
        })
    }
    
    pub fn send_command(&self, cmd: RenderCommand) -> Result<(), String> {
        let json = serde_json::to_string(&cmd).map_err(|e| e.to_string())?;
        let mut stdin = self.stdin.lock().map_err(|e| e.to_string())?;
        writeln!(stdin, "{}", json).map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;
        Ok(())
    }
    
    pub fn read_messages<F>(&mut self, callback: F) -> Result<(), String>
    where
        F: Fn(SidecarMessage) + Send + 'static,
    {
        let stdout = self.process.stdout.take().ok_or("Failed to get stdout")?;
        let reader = BufReader::new(stdout);
        
        std::thread::spawn(move || {
            for line in reader.lines() {
                if let Ok(line) = line {
                    if let Ok(msg) = serde_json::from_str::<SidecarMessage>(&line) {
                        callback(msg);
                    }
                }
            }
        });
        
        Ok(())
    }
}

impl Drop for RemotionSidecar {
    fn drop(&mut self) {
        let _ = self.process.kill();
    }
}
