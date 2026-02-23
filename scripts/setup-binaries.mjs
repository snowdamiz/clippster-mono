import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// This script is intended to be run from the project root or client directory
// It resolves paths relative to client/src-tauri/binaries

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine target directory relative to this script
const TARGET_DIR = path.resolve(__dirname, '../client/src-tauri/binaries');

// Ensure target directory exists
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

const PLATFORM = process.platform;
const ARCH = process.arch;

// FFmpeg config
const FFMPEG_VERSION = 'b6.0';
const FFMPEG_BASE_URL = `https://github.com/eugeneware/ffmpeg-static/releases/download/${FFMPEG_VERSION}`;

// Node config
const NODE_VERSION = 'v20.11.0';
const NODE_BASE_URL = 'https://nodejs.org/dist';

console.log(`Detected Platform: ${PLATFORM}, Arch: ${ARCH}`);
console.log(`Target Directory: ${TARGET_DIR}`);

function getFfmpegConfig() {
  if (PLATFORM === 'win32') {
    return {
      url: `${FFMPEG_BASE_URL}/ffmpeg-win32-x64`,
      filename: 'ffmpeg-x86_64-pc-windows-msvc.exe'
    };
  } else if (PLATFORM === 'darwin') {
    if (ARCH === 'arm64') {
      return {
        url: `${FFMPEG_BASE_URL}/ffmpeg-darwin-arm64`,
        filename: 'ffmpeg-aarch64-apple-darwin'
      };
    } else {
      return {
        url: `${FFMPEG_BASE_URL}/ffmpeg-darwin-x64`,
        filename: 'ffmpeg-x86_64-apple-darwin'
      };
    }
  } else if (PLATFORM === 'linux') {
    return {
      url: `${FFMPEG_BASE_URL}/ffmpeg-linux-x64`,
      filename: 'ffmpeg-x86_64-unknown-linux-gnu'
    };
  }
  throw new Error(`Unsupported platform for auto-download: ${PLATFORM}-${ARCH}`);
}

function getNodeConfig() {
  if (PLATFORM === 'win32') {
    return {
      url: `${NODE_BASE_URL}/${NODE_VERSION}/node-${NODE_VERSION}-win-x64.zip`,
      filename: 'node-x86_64-pc-windows-msvc.exe',
      type: 'zip',
      extractPath: `node-${NODE_VERSION}-win-x64/node.exe`
    };
  } else if (PLATFORM === 'darwin') {
    if (ARCH === 'arm64') {
      return {
        url: `${NODE_BASE_URL}/${NODE_VERSION}/node-${NODE_VERSION}-darwin-arm64.tar.gz`,
        filename: 'node-aarch64-apple-darwin',
        type: 'tar',
        extractPath: `node-${NODE_VERSION}-darwin-arm64/bin/node`
      };
    } else {
      return {
        url: `${NODE_BASE_URL}/${NODE_VERSION}/node-${NODE_VERSION}-darwin-x64.tar.gz`,
        filename: 'node-x86_64-apple-darwin',
        type: 'tar',
        extractPath: `node-${NODE_VERSION}-darwin-x64/bin/node`
      };
    }
  } else if (PLATFORM === 'linux') {
    return {
      url: `${NODE_BASE_URL}/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.gz`,
      filename: 'node-x86_64-unknown-linux-gnu',
      type: 'tar',
      extractPath: `node-${NODE_VERSION}-linux-x64/bin/node`
    };
  }
  throw new Error(`Unsupported platform for auto-download: ${PLATFORM}-${ARCH}`);
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function installBinary(config, name) {
  const destPath = path.join(TARGET_DIR, config.filename);
  
  if (fs.existsSync(destPath)) {
    console.log(`✅ ${config.filename} already exists.`);
    
    // Ensure executable permissions on Unix-like systems even if file exists
    if (PLATFORM !== 'win32') {
      try {
        fs.chmodSync(destPath, 0o755);
        
        // On macOS, try to remove quarantine attribute
        if (PLATFORM === 'darwin') {
          try {
            execSync(`xattr -d com.apple.quarantine "${destPath}"`);
          } catch (e) {
            // Ignore error, attribute might not exist
          }
        }
      } catch (e) {
        console.error(`Warning: Could not set executable permissions for ${config.filename}: ${e.message}`);
      }
    }
    
    return;
  }

  console.log(`⬇️  Downloading ${name} (${config.filename})...`);
  const tempFile = path.join(TARGET_DIR, `temp_${Date.now()}_${path.basename(config.url)}`);

  try {
    await downloadFile(config.url, tempFile);

    if (config.type === 'zip') {
      console.log(`📦 Extracting ${name}...`);
      try {
        // Windows: tar -xf file.zip -C dir
        execSync(`tar -xf "${tempFile}" -C "${TARGET_DIR}"`);
        
        const srcPath = path.join(TARGET_DIR, config.extractPath);
        // Wait for FS
        await new Promise(r => setTimeout(r, 1000));
        
        if (fs.existsSync(srcPath)) {
          fs.renameSync(srcPath, destPath);
          // Cleanup extracted folder
          const rootFolder = config.extractPath.split('/')[0];
          try { fs.rmSync(path.join(TARGET_DIR, rootFolder), { recursive: true, force: true }); } catch(e) {}
        } else {
          throw new Error(`Extracted file not found at ${srcPath}`);
        }
      } catch (e) {
        console.error("Extraction failed (zip). Check if 'tar' is available.", e);
        throw e;
      }
    } else if (config.type === 'tar') {
      console.log(`📦 Extracting ${name}...`);
      try {
        // Extract ONLY the bin/node file to avoid symlink issues on Windows
        const rootFolder = config.extractPath.split('/')[0];
        
        // Determine the path to extract inside the tar
        // config.extractPath is like "node-v.../bin/node"
        // Windows tar needs the path inside archive to extract specifically
        
        // Try generic extraction first
        execSync(`tar -xf "${tempFile}" -C "${TARGET_DIR}"`);
        const srcPath = path.join(TARGET_DIR, config.extractPath);
        
        await new Promise(r => setTimeout(r, 1000));
        
        if (fs.existsSync(srcPath)) {
          fs.renameSync(srcPath, destPath);
          // Cleanup extracted folder
          try { fs.rmSync(path.join(TARGET_DIR, rootFolder), { recursive: true, force: true }); } catch(e) {}
        } else {
          throw new Error(`Extracted file not found at ${srcPath}`);
        }
      } catch (e) {
        console.error("Extraction failed (tar).", e);
        throw e;
      }
    } else {
      // Direct download (ffmpeg binaries from eugeneware are just raw executables usually, but check)
      // The URL we used for ffmpeg is a raw binary stream, so we just rename tempFile
      fs.renameSync(tempFile, destPath);
    }

    // Make executable on unix
    if (PLATFORM !== 'win32') {
      fs.chmodSync(destPath, 0o755);

      // On macOS, try to remove quarantine attribute
      if (PLATFORM === 'darwin') {
        try {
          execSync(`xattr -d com.apple.quarantine "${destPath}"`);
        } catch (e) {
          // Ignore error, attribute might not exist
        }
      }
    }

    console.log(`✅ Installed ${config.filename}`);

  } catch (e) {
    console.error(`❌ Failed to install ${name}:`, e.message);
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath); // Cleanup partial
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

function fixFfmpegLibsPermissions() {
  // ffmpeg-libs/*.dylib are sometimes extracted with 444 (read-only) permissions,
  // which causes tauri_build::build() to fail with "Permission denied" when it
  // tries to process them as bundle resources. Ensure they are 644.
  if (PLATFORM === 'win32') return;
  const ffmpegLibsDir = path.resolve(__dirname, '../client/src-tauri/ffmpeg-libs');
  if (!fs.existsSync(ffmpegLibsDir)) return;
  for (const file of fs.readdirSync(ffmpegLibsDir)) {
    if (file.endsWith('.dylib') || file.endsWith('.so')) {
      try {
        fs.chmodSync(path.join(ffmpegLibsDir, file), 0o644);
      } catch (e) {
        console.error(`Warning: Could not fix permissions for ${file}: ${e.message}`);
      }
    }
  }
}

async function main() {
  try {
    const ffmpeg = getFfmpegConfig();
    const node = getNodeConfig();

    await installBinary(ffmpeg, 'FFmpeg');
    await installBinary(node, 'Node.js');
    fixFfmpegLibsPermissions();

    console.log('🎉 Binary setup complete.');
  } catch (e) {
    console.error('Setup failed:', e.message);
    process.exit(1);
  }
}

main();

