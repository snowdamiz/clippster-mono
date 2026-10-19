use tauri::{ipc::CapabilityBuilder, Manager};

/// Production uses a dynamic localhost server, which Tauri classifies as remote.
/// Grant native commands only to that server's exact origin and the intended UI.
pub fn register_production_capabilities(app: &tauri::AppHandle, port: u16) -> tauri::Result<()> {
    let origin = format!("http://localhost:{port}/*");
    app.add_capability(
        CapabilityBuilder::new("production-native-main")
            .local(false)
            .remote(origin.clone())
            .window("main")
            .permission("allow-native-commands"),
    )?;
    app.add_capability(
        CapabilityBuilder::new("production-native-pip")
            .local(false)
            .remote(origin)
            .window("pip-controls")
            .permission("allow-pip-native-commands"),
    )
}
