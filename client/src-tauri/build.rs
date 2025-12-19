use std::env;
use std::fs::{self, File};
use std::io::{self, Cursor, Read, Write};
use std::path::{Path, PathBuf};

const NODE_VERSION: &str = "v20.11.0";
const FFMPEG_STATIC_VERSION: &str = "b6.0";

fn main() {
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap();
    let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap();

    // Create binaries directory
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let binaries_dir = manifest_dir.join("binaries");
    fs::create_dir_all(&binaries_dir).expect("Failed to create binaries directory");

    // Download ffmpeg
    download_ffmpeg(&binaries_dir, &target_os, &target_arch);

    // Download node
    download_node(&binaries_dir, &target_os, &target_arch);

    // Run tauri-build
    tauri_build::build();
}

fn download_ffmpeg(binaries_dir: &Path, target_os: &str, target_arch: &str) {
    // Platform-specific ffmpeg binary names and URLs
    // Using eugeneware/ffmpeg-static for direct binary downloads (no archive extraction needed for macOS/Linux)
    // Using BtbN for Windows (requires zip extraction)
    let (ffmpeg_name, download_url, is_archive) = match (target_os, target_arch) {
        ("windows", "x86_64") => (
            "ffmpeg-x86_64-pc-windows-msvc.exe",
            "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip".to_string(),
            true,
        ),
        ("macos", "x86_64") => (
            "ffmpeg-x86_64-apple-darwin",
            format!("https://github.com/eugeneware/ffmpeg-static/releases/download/{}/ffmpeg-darwin-x64", FFMPEG_STATIC_VERSION),
            false,
        ),
        ("macos", "aarch64") => (
            "ffmpeg-aarch64-apple-darwin",
            format!("https://github.com/eugeneware/ffmpeg-static/releases/download/{}/ffmpeg-darwin-arm64", FFMPEG_STATIC_VERSION),
            false,
        ),
        ("linux", "x86_64") => (
            "ffmpeg-x86_64-unknown-linux-gnu",
            format!("https://github.com/eugeneware/ffmpeg-static/releases/download/{}/ffmpeg-linux-x64", FFMPEG_STATIC_VERSION),
            false,
        ),
        _ => {
            println!(
                "cargo:warning=Unsupported platform for ffmpeg: {}-{}",
                target_os, target_arch
            );
            return;
        }
    };

    let ffmpeg_path = binaries_dir.join(ffmpeg_name);

    // Skip download if already exists
    if ffmpeg_path.exists() {
        println!(
            "cargo:warning=ffmpeg binary already exists at {:?}",
            ffmpeg_path
        );
        return;
    }

    println!(
        "cargo:warning=Downloading ffmpeg for {}-{}...",
        target_os, target_arch
    );

    // Download ffmpeg
    let result = if is_archive {
        download_and_extract_ffmpeg(&download_url, &ffmpeg_path)
    } else {
        download_binary(&download_url, &ffmpeg_path)
    };

    match result {
        Ok(_) => println!(
            "cargo:warning=Successfully downloaded ffmpeg to {:?}",
            ffmpeg_path
        ),
        Err(e) => {
            println!("cargo:warning=Failed to download ffmpeg: {}", e);
            println!(
                "cargo:warning=Please download manually from: {}",
                download_url
            );
            println!("cargo:warning=Extract and place at: {:?}", ffmpeg_path);
        }
    }
}

/// Download a binary file directly (no archive extraction)
fn download_binary(url: &str, output_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let response = ureq::get(url).call()?;
    let mut bytes = Vec::new();
    response.into_reader().read_to_end(&mut bytes)?;

    let mut file = File::create(output_path)?;
    file.write_all(&bytes)?;

    set_executable_permissions(output_path)?;
    Ok(())
}

fn download_node(binaries_dir: &Path, target_os: &str, target_arch: &str) {
    // Platform-specific node binary names and URLs
    let (node_name, download_url, archive_type, extract_path) = match (target_os, target_arch) {
        ("windows", "x86_64") => (
            "node-x86_64-pc-windows-msvc.exe",
            format!(
                "https://nodejs.org/dist/{}/node-{}-win-x64.zip",
                NODE_VERSION, NODE_VERSION
            ),
            "zip",
            format!("node-{}-win-x64/node.exe", NODE_VERSION),
        ),
        ("macos", "x86_64") => (
            "node-x86_64-apple-darwin",
            format!(
                "https://nodejs.org/dist/{}/node-{}-darwin-x64.tar.gz",
                NODE_VERSION, NODE_VERSION
            ),
            "tar.gz",
            format!("node-{}-darwin-x64/bin/node", NODE_VERSION),
        ),
        ("macos", "aarch64") => (
            "node-aarch64-apple-darwin",
            format!(
                "https://nodejs.org/dist/{}/node-{}-darwin-arm64.tar.gz",
                NODE_VERSION, NODE_VERSION
            ),
            "tar.gz",
            format!("node-{}-darwin-arm64/bin/node", NODE_VERSION),
        ),
        ("linux", "x86_64") => (
            "node-x86_64-unknown-linux-gnu",
            format!(
                "https://nodejs.org/dist/{}/node-{}-linux-x64.tar.gz",
                NODE_VERSION, NODE_VERSION
            ),
            "tar.gz",
            format!("node-{}-linux-x64/bin/node", NODE_VERSION),
        ),
        _ => {
            println!(
                "cargo:warning=Unsupported platform for node: {}-{}",
                target_os, target_arch
            );
            return;
        }
    };

    let node_path = binaries_dir.join(node_name);

    // Skip download if already exists
    if node_path.exists() {
        println!(
            "cargo:warning=node binary already exists at {:?}",
            node_path
        );
        return;
    }

    println!(
        "cargo:warning=Downloading node {} for {}-{}...",
        NODE_VERSION, target_os, target_arch
    );

    // Download node
    match download_and_extract_node(&download_url, &node_path, archive_type, &extract_path) {
        Ok(_) => println!(
            "cargo:warning=Successfully downloaded node to {:?}",
            node_path
        ),
        Err(e) => {
            println!("cargo:warning=Failed to download node: {}", e);
            println!(
                "cargo:warning=Please download manually from: {}",
                download_url
            );
            println!("cargo:warning=Extract and place at: {:?}", node_path);
        }
    }
}

fn download_and_extract_ffmpeg(
    url: &str,
    output_path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    // Download the file
    let response = ureq::get(url).call()?;
    let mut bytes = Vec::new();
    response.into_reader().read_to_end(&mut bytes)?;

    // Extract based on file type
    if url.ends_with(".zip") {
        extract_ffmpeg_from_zip(&bytes, output_path)?;
    } else if url.ends_with(".tar.xz") {
        extract_ffmpeg_from_tar_xz(&bytes, output_path)?;
    } else {
        return Err("Unsupported archive format".into());
    }

    set_executable_permissions(output_path)?;
    Ok(())
}

fn download_and_extract_node(
    url: &str,
    output_path: &Path,
    archive_type: &str,
    extract_path: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Download the file
    let response = ureq::get(url).call()?;
    let mut bytes = Vec::new();
    response.into_reader().read_to_end(&mut bytes)?;

    // Extract based on archive type
    match archive_type {
        "zip" => extract_node_from_zip(&bytes, output_path, extract_path)?,
        "tar.gz" => extract_node_from_tar_gz(&bytes, output_path, extract_path)?,
        _ => return Err("Unsupported archive format".into()),
    }

    set_executable_permissions(output_path)?;
    Ok(())
}

fn set_executable_permissions(_output_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(_output_path)?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(_output_path, perms)?;
    }
    Ok(())
}

fn extract_ffmpeg_from_zip(
    bytes: &[u8],
    output_path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let reader = Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(reader)?;

    // Find ffmpeg executable in the archive
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let file_name = file.name().to_string();

        // Look for ffmpeg executable (might be in subdirectory)
        if file_name.contains("ffmpeg")
            && (file_name.ends_with("ffmpeg.exe")
                || file_name.ends_with("/ffmpeg")
                || file_name.ends_with("\\ffmpeg"))
            && !file_name.contains("ffprobe")
            && !file_name.contains("ffplay")
        {
            let mut output_file = File::create(output_path)?;
            io::copy(&mut file, &mut output_file)?;
            return Ok(());
        }
    }

    Err("ffmpeg binary not found in archive".into())
}

fn extract_ffmpeg_from_tar_xz(
    bytes: &[u8],
    output_path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let reader = Cursor::new(bytes);
    let decompressor = xz2::read::XzDecoder::new(reader);
    let mut archive = tar::Archive::new(decompressor);

    // Find ffmpeg executable in the archive
    for entry in archive.entries()? {
        let mut entry = entry?;
        let path = entry.path()?;
        let path_str = path.to_string_lossy();

        if path_str.contains("ffmpeg")
            && !path_str.contains("ffprobe")
            && !path_str.contains("ffplay")
            && path_str.ends_with("ffmpeg")
        {
            let mut output_file = File::create(output_path)?;
            io::copy(&mut entry, &mut output_file)?;
            return Ok(());
        }
    }

    Err("ffmpeg binary not found in archive".into())
}

fn extract_node_from_zip(
    bytes: &[u8],
    output_path: &Path,
    extract_path: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let reader = Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(reader)?;

    // Find the specific node executable path
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let file_name = file.name().to_string();

        // Normalize path separators for comparison
        let normalized_name = file_name.replace('\\', "/");
        let normalized_extract = extract_path.replace('\\', "/");

        if normalized_name == normalized_extract || normalized_name.ends_with(&normalized_extract) {
            let mut output_file = File::create(output_path)?;
            io::copy(&mut file, &mut output_file)?;
            return Ok(());
        }
    }

    Err(format!("node binary not found in archive at path: {}", extract_path).into())
}

fn extract_node_from_tar_gz(
    bytes: &[u8],
    output_path: &Path,
    extract_path: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let reader = Cursor::new(bytes);
    let decompressor = flate2::read::GzDecoder::new(reader);
    let mut archive = tar::Archive::new(decompressor);

    // Find the specific node executable path
    for entry in archive.entries()? {
        let mut entry = entry?;
        let path = entry.path()?;
        let path_str = path.to_string_lossy();

        if path_str == extract_path || path_str.ends_with(extract_path) {
            let mut output_file = File::create(output_path)?;
            io::copy(&mut entry, &mut output_file)?;
            return Ok(());
        }
    }

    Err(format!("node binary not found in archive at path: {}", extract_path).into())
}
