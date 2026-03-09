use serde::{Deserialize, Serialize};

/// Organization creator profile from server API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerCreatorProfile {
    pub id: i64,
    pub organization_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub profile_image_url: Option<String>,
    pub intro_id: Option<i64>,
    pub outro_id: Option<i64>,
    pub watermark_id: Option<i64>,
    pub watermark_settings: Option<serde_json::Value>,
    pub layout_overlays: Option<Vec<serde_json::Value>>,
    pub scope: Option<String>,
    pub inserted_at: String,
    pub updated_at: String,
}

/// Response from /user/assigned-creator-profiles endpoint
#[derive(Debug, Deserialize)]
pub struct AssignedProfilesResponse {
    pub success: bool,
    pub profiles: Vec<ServerCreatorProfile>,
    #[serde(default)]
    pub error: Option<String>,
}

/// Fetch campaign branding profile from server API
pub async fn fetch_campaign_branding_profile(
    api_base_url: &str,
    auth_token: &str,
    branding_profile_id: i64,
) -> Result<ServerCreatorProfile, String> {
    let url = format!(
        "{}/api/organization-creator-profiles/{}",
        api_base_url, branding_profile_id
    );

    println!("[API] Fetching campaign branding profile from: {}", url);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", auth_token))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch campaign branding profile: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "HTTP error fetching campaign branding profile: {}",
            response.status()
        ));
    }

    let profile: ServerCreatorProfile = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse campaign branding profile: {}", e))?;

    println!(
        "[API] Successfully fetched campaign branding profile: {}",
        profile.name
    );

    Ok(profile)
}

/// Download organization asset from server
pub async fn download_org_asset(
    api_base_url: &str,
    auth_token: &str,
    asset_id: i64,
    asset_type: &str,
    organization_id: i64,
    storage_path: &std::path::Path,
) -> Result<String, String> {
    let url = format!("{}/api/organization-assets/{}", api_base_url, asset_id);

    println!("[API] Fetching asset metadata from: {}", url);

    let client = reqwest::Client::new();
    
    // First, get asset metadata
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", auth_token))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch asset metadata: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error fetching asset: {}", response.status()));
    }

    #[derive(Deserialize)]
    struct AssetMetadata {
        file_url: String,
        filename: String,
    }

    let metadata: AssetMetadata = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse asset metadata: {}", e))?;

    println!("[API] Downloading asset from: {}", metadata.file_url);

    // Download the actual file
    let file_response = client
        .get(&metadata.file_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download asset file: {}", e))?;

    if !file_response.status().is_success() {
        return Err(format!(
            "HTTP error downloading asset file: {}",
            file_response.status()
        ));
    }

    let data = file_response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read asset file: {}", e))?;

    println!("[API] Downloaded {} bytes", data.len());

    // Save to storage
    let org_dir = storage_path
        .join("org")
        .join(organization_id.to_string());
    std::fs::create_dir_all(&org_dir)
        .map_err(|e| format!("Failed to create org directory: {}", e))?;

    let dest_path = org_dir.join(&metadata.filename);
    std::fs::write(&dest_path, &data)
        .map_err(|e| format!("Failed to write asset file: {}", e))?;

    println!("[API] Saved asset to: {}", dest_path.display());

    dest_path
        .to_str()
        .ok_or_else(|| "Invalid path".to_string())
        .map(|s| s.to_string())
}
