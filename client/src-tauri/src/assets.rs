use serde::{Deserialize, Serialize};
use tauri::Emitter;
use crate::storage;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetUploadResult {
    pub upload_id: String,
    pub success: bool,
    pub file_path: Option<String>,
    pub thumbnail_path: Option<String>,
    pub duration: Option<f64>,
    pub error: Option<String>,
}

// Async asset upload with thumbnail generation (follows PumpFun download pattern)
#[tauri::command]
pub async fn upload_asset_async(
    app: tauri::AppHandle,
    upload_id: String,
    asset_type: String,
    source_path: String,
    original_filename: String
) -> Result<(), String> {
    println!("[Rust] upload_asset_async called with:");
    println!("[Rust]   upload_id: {}", upload_id);
    println!("[Rust]   asset_type: {}", asset_type);
    println!("[Rust]   source_path: {}", source_path);
    println!("[Rust]   original_filename: {}", original_filename);

    // Extract the actual upload_id (everything before the colon)
    let actual_upload_id = upload_id.split(':').next().unwrap_or(&upload_id).to_string();

    let app_clone = app.clone();
    let upload_id_for_task = actual_upload_id.clone();
    let upload_id_for_result = upload_id.clone();

    let result = tokio::spawn(async move {
        let upload_id_for_event = upload_id_for_result.clone();
        println!("[Rust] Async asset upload task started for: {}", upload_id_for_task);

        // Copy asset to storage
        let copy_result = storage::copy_asset_to_storage(source_path, asset_type.clone(), app_clone.clone()).await;
        let (destination_path, thumbnail_path) = match copy_result {
            Ok(result) => {
                println!("[Rust] Asset copied to storage: {}", result.destination_path);
                (result.destination_path, result.thumbnail_path)
            }
            Err(e) => {
                println!("[Rust] Failed to copy asset: {}", e);
                let error_result = AssetUploadResult {
                    upload_id: upload_id_for_event.clone(),
                    success: false,
                    file_path: None,
                    thumbnail_path: None,
                    duration: None,
                    error: Some(format!("Failed to copy asset: {}", e)),
                };
                let _ = app_clone.emit("asset-upload-complete", error_result);
                return Err(e);
            }
        };

        // Get video duration
        let duration = match storage::get_video_duration(app_clone.clone(), destination_path.clone()).await {
            Ok(d) => {
                println!("[Rust] Asset duration: {:?}", d);
                Some(d)
            }
            Err(e) => {
                println!("[Rust] Failed to get asset duration: {}", e);
                None
            }
        };

        // Generate thumbnail if we don't have one
        let final_thumbnail_path = if thumbnail_path.is_none() {
            println!("[Rust] Generating thumbnail for asset...");
            match storage::generate_thumbnail(app_clone.clone(), destination_path.clone()).await {
                Ok(path) => {
                    println!("[Rust] Thumbnail generated: {}", path);
                    Some(path)
                }
                Err(e) => {
                    println!("[Rust] Failed to generate thumbnail: {}", e);
                    None
                }
            }
        } else {
            thumbnail_path
        };

        // Send success completion event with the original upload_id (containing metadata)
        let success_result = AssetUploadResult {
            upload_id: upload_id_for_event, // Use the original full upload_id with metadata
            success: true,
            file_path: Some(destination_path),
            thumbnail_path: final_thumbnail_path,
            duration,
            error: None,
        };

        println!("[Rust] Sending asset upload completion event...");
        let _ = app_clone.emit("asset-upload-complete", success_result);
        println!("[Rust] Asset upload completion event sent successfully");

        Ok(())
    }).await;

    match result {
        Ok(_) => {
            println!("[Rust] Async asset upload task completed successfully");
            Ok(())
        }
        Err(e) => {
            println!("[Rust] Async asset upload task failed: {}", e);
            let error_result = AssetUploadResult {
                upload_id: upload_id,
                success: false,
                file_path: None,
                thumbnail_path: None,
                duration: None,
                error: Some(format!("Upload task failed: {}", e)),
            };
            let _ = app.emit("asset-upload-complete", error_result);
            Err(format!("Upload task failed: {}", e))
        }
    }
}