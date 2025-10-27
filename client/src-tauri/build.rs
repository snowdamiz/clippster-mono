use std::env;
use std::fs::{self, File};
use std::io::{self, Cursor};
use std::path::{Path, PathBuf};

fn main() {
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap();
    let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap();

    // Create binaries directory
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let binaries_dir = manifest_dir.join("binaries");
    fs::create_dir_all(&binaries_dir).expect("Failed to create binaries directory");

    // Platform-specific ffmpeg binary names and URLs
    let (ffmpeg_name, download_url) = match (target_os.as_str(), target_arch.as_str()) {
        ("windows", "x86_64") => (
            "ffmpeg-x86_64-pc-windows-msvc.exe",
            "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
        ),
        ("macos", "x86_64") => (
            "ffmpeg-x86_64-apple-darwin",
            "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip",
        ),
        ("macos", "aarch64") => (
            "ffmpeg-aarch64-apple-darwin",
            "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip",
        ),
        ("linux", "x86_64") => (
            "ffmpeg-x86_64-unknown-linux-gnu",
            "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz",
        ),
        _ => {
            println!("cargo:warning=Unsupported platform: {}-{}", target_os, target_arch);
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
        // Still need to run tauri-build
        tauri_build::build();
        return;
    }

    println!(
        "cargo:warning=Downloading ffmpeg for {}-{}...",
        target_os, target_arch
    );

    // Download ffmpeg
    match download_and_extract_ffmpeg(download_url, &ffmpeg_path, &target_os) {
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

    // Run tauri-build after ensuring ffmpeg is present
    tauri_build::build();
}

fn download_and_extract_ffmpeg(
    url: &str,
    output_path: &Path,
    _target_os: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Download the file
    let response = ureq::get(url).call()?;
    let mut bytes = Vec::new();
    response.into_reader().read_to_end(&mut bytes)?;

    // Extract based on file type
    if url.ends_with(".zip") {
        extract_from_zip(&bytes, output_path)?;
    } else if url.ends_with(".tar.xz") {
        extract_from_tar_xz(&bytes, output_path)?;
    } else {
        return Err("Unsupported archive format".into());
    }

    // Set executable permissions on Unix-like systems
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(output_path)?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(output_path, perms)?;
    }

    Ok(())
}

fn extract_from_zip(bytes: &[u8], output_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
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

fn extract_from_tar_xz(bytes: &[u8], output_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
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
