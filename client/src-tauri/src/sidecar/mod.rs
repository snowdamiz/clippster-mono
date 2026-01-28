use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

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
        let app_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app dir: {}", e))?;
        
        // Development path: client/src-tauri/sidecars/remotion-renderer/dist/bundle.js
        let dev_bundle_path = app_dir
            .parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
            .map(|p| p.join("client").join("src-tauri").join("sidecars").join("remotion-renderer").join("dist").join("bundle.js"))
            .ok_or("Failed to construct dev bundle path")?;

        let bundle_path = if dev_bundle_path.exists() {
            dev_bundle_path
        } else {
            // Production: look in resources
            let resource_path = app
                .path()
                .resource_dir()
                .map_err(|e| format!("Failed to get resource dir: {}", e))?;
            resource_path.join("remotion-renderer").join("bundle.js")
        };

        if !bundle_path.exists() {
            return Err(format!(
                "Remotion renderer bundle not found at: {}",
                bundle_path.display()
            ));
        }

        // Run with Node.js
        let mut process = Command::new("node")
            .arg(&bundle_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

        let stdin = process
            .stdin
            .take()
            .ok_or("Failed to get stdin")?;

        let stdout = process
            .stdout
            .take()
            .ok_or("Failed to get stdout")?;

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

        writeln!(stdin, "{}", json)
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;

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
