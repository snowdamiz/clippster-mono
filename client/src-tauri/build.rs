use std::env;
use std::fs::{self, File};
use std::io::{self, Cursor, Read, Write};
use std::path::{Path, PathBuf};

const NODE_VERSION: &str = "v20.11.0";
const FFMPEG_STATIC_VERSION: &str = "b6.0";
const YTDLP_VERSION: &str = "2026.02.20.235452";
const YTDLP_NIGHTLY_REPO: &str = "yt-dlp/yt-dlp-nightly-builds";

fn main() {
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap();
    let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap();

    // Create binaries directory
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let binaries_dir = manifest_dir.join("binaries");
    fs::create_dir_all(&binaries_dir).expect("Failed to create binaries directory");

    // Configure FFmpeg paths for ffmpeg-sys-next (Windows only)
    if target_os == "windows" {
        let ffmpeg_dir = manifest_dir
            .join("ffmpeg-dev")
            .join("ffmpeg-master-latest-win64-gpl-shared");
        if ffmpeg_dir.exists() {
            println!("cargo:warning=Found FFmpeg at: {}", ffmpeg_dir.display());
            env::set_var("FFMPEG_DIR", &ffmpeg_dir);
            env::set_var("FFMPEG_INCLUDE_DIR", ffmpeg_dir.join("include"));
            env::set_var("FFMPEG_LIB_DIR", ffmpeg_dir.join("lib"));

            // Add to system paths for MSVC
            if let Ok(include) = env::var("INCLUDE") {
                env::set_var(
                    "INCLUDE",
                    format!("{};{}", ffmpeg_dir.join("include").display(), include),
                );
            } else {
                env::set_var("INCLUDE", ffmpeg_dir.join("include").display().to_string());
            }

            if let Ok(lib) = env::var("LIB") {
                env::set_var(
                    "LIB",
                    format!("{};{}", ffmpeg_dir.join("lib").display(), lib),
                );
            } else {
                env::set_var("LIB", ffmpeg_dir.join("lib").display().to_string());
            }
        } else {
            // Fallback to vcpkg FFmpeg paths for Windows CI/dev
            let vcpkg_dir = "C:/vcpkg/installed/x64-windows";
            if Path::new(vcpkg_dir).exists() {
                println!("cargo:warning=Using vcpkg FFmpeg at: {}", vcpkg_dir);
                env::set_var("FFMPEG_DIR", vcpkg_dir);
                env::set_var("FFMPEG_INCLUDE_DIR", format!("{}/include", vcpkg_dir));
                env::set_var("FFMPEG_LIB_DIR", format!("{}/lib", vcpkg_dir));
                env::set_var("FFMPEG_DLL_PATH", format!("{}/bin", vcpkg_dir));
                env::set_var("PKG_CONFIG_PATH", format!("{}/lib/pkgconfig", vcpkg_dir));
                env::set_var("PKG_CONFIG_LIBDIR", format!("{}/lib/pkgconfig", vcpkg_dir));
            }
        }

        // Bindgen needs MSVC/Windows SDK include paths for stddef.h, stdint.h
        if env::var("BINDGEN_EXTRA_CLANG_ARGS").is_err() {
            env::set_var("BINDGEN_EXTRA_CLANG_ARGS",
                "-IC:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Tools/MSVC/14.44.35207/include \
                 -IC:/Program Files (x86)/Windows Kits/10/Include/10.0.26100.0/ucrt \
                 -IC:/Program Files (x86)/Windows Kits/10/Include/10.0.26100.0/shared");
        }

        // Auto-copy FFmpeg DLLs to the Cargo output directory so the binary can find them at runtime.
        // This ensures DLLs survive cargo clean and are always present after any build.
        let ffmpeg_bin_dir = manifest_dir
            .join("ffmpeg-dev")
            .join("ffmpeg-master-latest-win64-gpl-shared")
            .join("bin");
        if ffmpeg_bin_dir.exists() {
            let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
            // OUT_DIR is something like target/debug/build/<pkg>/out — walk up 3 levels to get target/debug
            if let Some(target_dir) = out_dir.ancestors().nth(3) {
                if let Ok(entries) = fs::read_dir(&ffmpeg_bin_dir) {
                    for entry in entries.filter_map(|e| e.ok()) {
                        let path = entry.path();
                        if path.extension().map(|e| e == "dll").unwrap_or(false) {
                            let dest = target_dir.join(path.file_name().unwrap());
                            if let Err(e) = fs::copy(&path, &dest) {
                                println!(
                                    "cargo:warning=Failed to copy FFmpeg DLL {:?}: {}",
                                    path.file_name().unwrap(),
                                    e
                                );
                            }
                        }
                    }
                }
                println!(
                    "cargo:warning=FFmpeg DLLs copied to {}",
                    target_dir.display()
                );
            }
        } else {
            println!("cargo:warning=FFmpeg DLL source not found at {:?} — run will fail with DLL_NOT_FOUND", ffmpeg_bin_dir);
        }
    }

    // Download ffmpeg and ffprobe
    download_ffmpeg(&binaries_dir, &target_os, &target_arch);
    download_ffprobe(&binaries_dir, &target_os, &target_arch);

    // Download node for ALL platforms (needed for cross-platform bundling)
    // Windows
    download_node(&binaries_dir, "windows", "x86_64");
    // macOS Intel
    download_node(&binaries_dir, "macos", "x86_64");
    // macOS Apple Silicon
    download_node(&binaries_dir, "macos", "aarch64");
    // Linux
    download_node(&binaries_dir, "linux", "x86_64");

    // Download yt-dlp (standalone binaries for all platforms)
    download_ytdlp(&binaries_dir, &target_os, &target_arch);

    // Generate migrations
    generate_migrations(&manifest_dir);

    // On macOS/Linux, ensure ffmpeg-libs dylibs have at least 644 permissions.
    // They are sometimes extracted/committed with 444 (read-only) which causes
    // tauri_build::build() to fail with "Permission denied (os error 13)" when
    // it tries to process them as bundle resources on the initial build.
    #[cfg(unix)]
    fix_ffmpeg_lib_permissions(&manifest_dir);

    // Ensure ffmpeg-libs directory exists with at least one file so the
    // "ffmpeg-libs/*" glob in tauri.conf.json doesn't fail on platforms
    // that don't need dynamic FFmpeg libraries (macOS/Linux use static linking).
    let ffmpeg_libs_dir = manifest_dir.join("ffmpeg-libs");
    fs::create_dir_all(&ffmpeg_libs_dir).ok();
    let placeholder = ffmpeg_libs_dir.join(".gitkeep");
    if !placeholder.exists() {
        File::create(&placeholder).ok();
    }

    // Run tauri-build
    tauri_build::build();
}

#[cfg(unix)]
fn fix_ffmpeg_lib_permissions(manifest_dir: &Path) {
    use std::os::unix::fs::PermissionsExt;
    let ffmpeg_libs_dir = manifest_dir.join("ffmpeg-libs");
    if !ffmpeg_libs_dir.exists() {
        return;
    }
    if let Ok(entries) = fs::read_dir(&ffmpeg_libs_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if ext == "dylib" || ext == "so" {
                if let Ok(metadata) = fs::metadata(&path) {
                    let mut perms = metadata.permissions();
                    // Ensure owner read+write so tauri_build can process the file
                    perms.set_mode(perms.mode() | 0o644);
                    let _ = fs::set_permissions(&path, perms);
                }
            }
        }
    }
}

/// Generates a Rust file containing all SQL migrations from the migrations directory.
/// Migrations are discovered by filename pattern: `NNN_description.sql` where NNN is the version number.
/// If both `NNN_foo.sql` and `NNN_foo_fixed.sql` exist, the `_fixed` version is preferred.
fn generate_migrations(manifest_dir: &Path) {
    let migrations_dir = manifest_dir.join("migrations");
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let output_path = out_dir.join("migrations_generated.rs");

    // Tell Cargo to rerun if any individual migration file changes.
    // Watching the directory alone is unreliable on some filesystems.
    println!("cargo:rerun-if-changed=migrations");
    if let Ok(entries) = fs::read_dir(&migrations_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().is_some_and(|ext| ext == "sql") {
                println!("cargo:rerun-if-changed={}", path.display());
            }
        }
    }

    // Read all .sql files from migrations directory
    let mut migration_files: Vec<(u32, String, PathBuf)> = Vec::new();

    if let Ok(entries) = fs::read_dir(&migrations_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().is_some_and(|ext| ext == "sql") {
                let filename = path.file_stem().unwrap().to_string_lossy().to_string();

                // Parse version number from filename (e.g., "001_initial_schema" -> 1)
                if let Some(version) = parse_migration_version(&filename) {
                    migration_files.push((version, filename, path));
                }
            }
        }
    }

    // Sort by version number first so duplicate detection is deterministic
    migration_files.sort_by_key(|(v, _, _)| *v);

    // Handle duplicates: prefer _fixed versions, fail hard on ambiguous duplicates
    let mut seen_versions: std::collections::HashMap<u32, (String, PathBuf)> =
        std::collections::HashMap::new();
    for (version, filename, path) in migration_files {
        if let Some((existing_filename, _)) = seen_versions.get(&version) {
            if filename.ends_with("_fixed") && !existing_filename.ends_with("_fixed") {
                // Prefer _fixed version over non-fixed
                seen_versions.insert(version, (filename, path));
            } else if !filename.ends_with("_fixed") && !existing_filename.ends_with("_fixed") {
                // Two non-fixed files with the same version: this is a mistake that
                // causes non-deterministic builds. Fail immediately with a clear message.
                panic!(
                    "Duplicate migration version {}: '{}' and '{}' both exist. \
                     Rename one of them to a unique version number. \
                     This causes non-deterministic builds.",
                    version, existing_filename, filename
                );
            }
            // If existing is _fixed and new is not, keep existing (no action needed)
        } else {
            seen_versions.insert(version, (filename, path));
        }
    }

    // Convert to sorted vec
    let mut final_migrations: Vec<(u32, String, PathBuf)> = seen_versions
        .into_iter()
        .map(|(v, (f, p))| (v, f, p))
        .collect();
    final_migrations.sort_by_key(|(v, _, _)| *v);

    // Generate the Rust code
    let mut generated_code = String::new();
    generated_code.push_str("// Auto-generated by build.rs - do not edit manually\n");
    generated_code
        .push_str("// This file contains all SQL migrations from the migrations directory\n\n");
    generated_code.push_str("pub fn get_migrations() -> Vec<tauri_plugin_sql::Migration> {\n");
    generated_code.push_str("    vec![\n");

    for (version, filename, path) in &final_migrations {
        // Read the SQL content
        let sql_content = fs::read_to_string(path)
            .unwrap_or_else(|e| panic!("Failed to read migration file {:?}: {}", path, e));

        // Extract description from filename (remove version prefix and _fixed suffix)
        let description = extract_description(filename);

        // Escape the SQL content for Rust string literal
        let escaped_sql = escape_rust_string(&sql_content);

        generated_code.push_str("        tauri_plugin_sql::Migration {\n");
        generated_code.push_str(&format!("            version: {},\n", version));
        generated_code.push_str(&format!("            description: \"{}\",\n", description));
        generated_code.push_str(&format!("            sql: r##\"{}\"##,\n", escaped_sql));
        generated_code.push_str("            kind: tauri_plugin_sql::MigrationKind::Up,\n");
        generated_code.push_str("        },\n");
    }

    generated_code.push_str("    ]\n");
    generated_code.push_str("}\n");

    // Write the generated file
    fs::write(&output_path, generated_code)
        .unwrap_or_else(|e| panic!("Failed to write migrations file: {}", e));

    println!(
        "cargo:warning=Generated {} migrations to {:?}",
        final_migrations.len(),
        output_path
    );
}

/// Parse version number from migration filename (e.g., "001_initial_schema" -> Some(1))
fn parse_migration_version(filename: &str) -> Option<u32> {
    let parts: Vec<&str> = filename.splitn(2, '_').collect();
    if parts.len() >= 2 {
        parts[0].parse().ok()
    } else {
        None
    }
}

/// Extract description from filename (remove version prefix and _fixed suffix)
fn extract_description(filename: &str) -> String {
    let parts: Vec<&str> = filename.splitn(2, '_').collect();
    if parts.len() >= 2 {
        let desc = parts[1].to_string();
        // Remove _fixed suffix if present
        if desc.ends_with("_fixed") {
            desc[..desc.len() - 6].to_string()
        } else {
            desc
        }
    } else {
        filename.to_string()
    }
}

/// Escape a string for use in a Rust raw string literal r##"..."##
/// We need to handle the case where the SQL contains "##
fn escape_rust_string(s: &str) -> String {
    // For raw strings with r##"..."##, we need to make sure there's no "## sequence
    // If there is, we replace it with a safe alternative
    s.replace("\"##", "\" ##")
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

fn download_ffprobe(binaries_dir: &Path, target_os: &str, target_arch: &str) {
    // Platform-specific ffprobe binary names and URLs
    // Using eugeneware/ffmpeg-static for direct binary downloads (no archive extraction needed for macOS/Linux)
    // Using BtbN for Windows (requires zip extraction)
    let (ffprobe_name, download_url, is_archive) = match (target_os, target_arch) {
        ("windows", "x86_64") => (
            "ffprobe-x86_64-pc-windows-msvc.exe",
            "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip".to_string(),
            true,
        ),
        ("macos", "x86_64") => (
            "ffprobe-x86_64-apple-darwin",
            format!("https://github.com/eugeneware/ffmpeg-static/releases/download/{}/ffprobe-darwin-x64", FFMPEG_STATIC_VERSION),
            false,
        ),
        ("macos", "aarch64") => (
            "ffprobe-aarch64-apple-darwin",
            format!("https://github.com/eugeneware/ffmpeg-static/releases/download/{}/ffprobe-darwin-arm64", FFMPEG_STATIC_VERSION),
            false,
        ),
        ("linux", "x86_64") => (
            "ffprobe-x86_64-unknown-linux-gnu",
            format!("https://github.com/eugeneware/ffmpeg-static/releases/download/{}/ffprobe-linux-x64", FFMPEG_STATIC_VERSION),
            false,
        ),
        _ => {
            println!(
                "cargo:warning=Unsupported platform for ffprobe: {}-{}",
                target_os, target_arch
            );
            return;
        }
    };

    let ffprobe_path = binaries_dir.join(ffprobe_name);

    // Skip download if already exists
    if ffprobe_path.exists() {
        println!(
            "cargo:warning=ffprobe binary already exists at {:?}",
            ffprobe_path
        );
        return;
    }

    println!(
        "cargo:warning=Downloading ffprobe for {}-{}...",
        target_os, target_arch
    );

    // Download ffprobe
    let result = if is_archive {
        download_and_extract_ffprobe(&download_url, &ffprobe_path)
    } else {
        download_binary(&download_url, &ffprobe_path)
    };

    match result {
        Ok(_) => println!(
            "cargo:warning=Successfully downloaded ffprobe to {:?}",
            ffprobe_path
        ),
        Err(e) => {
            println!("cargo:warning=Failed to download ffprobe: {}", e);
            println!(
                "cargo:warning=Please download manually from: {}",
                download_url
            );
            println!("cargo:warning=Extract and place at: {:?}", ffprobe_path);
        }
    }
}

fn download_and_extract_ffprobe(
    url: &str,
    output_path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    // Download the file
    let response = ureq::get(url).call()?;
    let mut bytes = Vec::new();
    response.into_reader().read_to_end(&mut bytes)?;

    // Extract ffprobe from zip (Windows only)
    if url.ends_with(".zip") {
        extract_ffprobe_from_zip(&bytes, output_path)?;
    } else {
        return Err("Unsupported archive format for ffprobe".into());
    }

    set_executable_permissions(output_path)?;
    Ok(())
}

fn extract_ffprobe_from_zip(
    bytes: &[u8],
    output_path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let reader = Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(reader)?;

    // Find ffprobe executable in the archive
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let file_name = file.name().to_string();

        // Look for ffprobe executable (might be in subdirectory)
        if file_name.contains("ffprobe")
            && (file_name.ends_with("ffprobe.exe")
                || file_name.ends_with("/ffprobe")
                || file_name.ends_with("\\ffprobe"))
        {
            let mut output_file = File::create(output_path)?;
            io::copy(&mut file, &mut output_file)?;
            return Ok(());
        }
    }

    Err("ffprobe binary not found in archive".into())
}

fn download_ytdlp(binaries_dir: &Path, target_os: &str, target_arch: &str) {
    // yt-dlp nightly builds fix Kick's Cloudflare 403 (stable builds are blocked)
    // https://github.com/yt-dlp/yt-dlp-nightly-builds/releases

    // Tauri externalBin requires target triple suffix (e.g., yt-dlp-x86_64-pc-windows-msvc.exe)
    let (ytdlp_name, download_url) = match (target_os, target_arch) {
        ("windows", "x86_64") => (
            "yt-dlp-x86_64-pc-windows-msvc.exe",
            format!(
                "https://github.com/{}/releases/download/{}/yt-dlp.exe",
                YTDLP_NIGHTLY_REPO, YTDLP_VERSION
            ),
        ),
        ("windows", "aarch64") => (
            "yt-dlp-aarch64-pc-windows-msvc.exe",
            format!(
                "https://github.com/{}/releases/download/{}/yt-dlp_arm64.exe",
                YTDLP_NIGHTLY_REPO, YTDLP_VERSION
            ),
        ),
        ("linux", "x86_64") => (
            "yt-dlp-x86_64-unknown-linux-gnu",
            format!(
                "https://github.com/{}/releases/download/{}/yt-dlp_linux",
                YTDLP_NIGHTLY_REPO, YTDLP_VERSION
            ),
        ),
        ("linux", "aarch64") => (
            "yt-dlp-aarch64-unknown-linux-gnu",
            format!(
                "https://github.com/{}/releases/download/{}/yt-dlp_linux_aarch64",
                YTDLP_NIGHTLY_REPO, YTDLP_VERSION
            ),
        ),
        ("macos", "x86_64") => (
            "yt-dlp-x86_64-apple-darwin",
            format!(
                "https://github.com/{}/releases/download/{}/yt-dlp_macos",
                YTDLP_NIGHTLY_REPO, YTDLP_VERSION
            ),
        ),
        ("macos", "aarch64") => (
            "yt-dlp-aarch64-apple-darwin",
            // Nightly builds publish yt-dlp_macos as a universal macOS binary
            format!(
                "https://github.com/{}/releases/download/{}/yt-dlp_macos",
                YTDLP_NIGHTLY_REPO, YTDLP_VERSION
            ),
        ),
        _ => {
            println!(
                "cargo:warning=Unsupported platform for yt-dlp: {}-{}",
                target_os, target_arch
            );
            return;
        }
    };

    let ytdlp_path = binaries_dir.join(ytdlp_name);

    // Skip download if already exists
    if ytdlp_path.exists() {
        println!(
            "cargo:warning=yt-dlp binary already exists at {:?}",
            ytdlp_path
        );
        return;
    }

    println!(
        "cargo:warning=Downloading yt-dlp {} for {}-{}...",
        YTDLP_VERSION, target_os, target_arch
    );

    // yt-dlp binaries are standalone executables - download directly
    match download_binary(&download_url, &ytdlp_path) {
        Ok(_) => println!(
            "cargo:warning=Successfully downloaded yt-dlp to {:?}",
            ytdlp_path
        ),
        Err(e) => {
            println!("cargo:warning=Failed to download yt-dlp: {}", e);
            println!(
                "cargo:warning=Please download manually from: {}",
                download_url
            );
            println!("cargo:warning=Place at: {:?}", ytdlp_path);
        }
    }
}
