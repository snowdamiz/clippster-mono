# Clippster Storage Configuration

This document describes how Clippster manages file storage across different operating systems.

## Storage Locations

Clippster uses platform-specific standard directories for storing clips, videos, and related media:

### Windows
```
%LOCALAPPDATA%\Clippster\
```
Typically: `C:\Users\<Username>\AppData\Local\Clippster`

### macOS
```
~/Library/Application Support/Clippster/
```
Typically: `/Users/<Username>/Library/Application Support/Clippster`

### Linux
```
~/.local/share/clippster/
```
Typically: `/home/<username>/.local/share/clippster`

## Directory Structure

Within the base storage directory, Clippster creates the following subdirectories:

```
Clippster/
├── clips/         # Processed clip files
├── videos/        # Original/raw video files
├── thumbnails/    # Generated thumbnail images
├── intros/        # Intro video files
├── outros/        # Outro video files
└── temp/          # Temporary files during processing
```

## Usage

### From Rust (Backend)

```rust
use crate::storage::{get_storage_paths, StoragePathsResponse};

// Get all storage paths
let paths = get_storage_paths()?;
println!("Clips directory: {}", paths.clips);

// Or use via Tauri command
#[tauri::command]
async fn my_command() -> Result<StoragePathsResponse, String> {
    get_storage_paths()
}
```

### From TypeScript (Frontend)

```typescript
import { getStoragePaths, getStoragePath } from '@/services/storage'

// Get all paths
const paths = await getStoragePaths()
console.log('Base directory:', paths.base)
console.log('Clips directory:', paths.clips)

// Get a specific path
const clipsPath = await getStoragePath('clips')
```

## Initialization

Storage directories are automatically created when the application starts. The initialization happens in the Tauri setup phase:

1. The base directory is determined based on the operating system
2. All subdirectories (clips, videos, thumbnails, etc.) are created
3. Paths are logged to the console for debugging

If directory creation fails, a warning is logged but the application continues to run.

## Database Location

The SQLite database (`clippster.db`) is stored in Tauri's default app data directory, which is managed by the `tauri-plugin-sql` plugin. This is typically:

- **Windows**: `%APPDATA%\com.openworth.clippster\`
- **macOS**: `~/Library/Application Support/com.openworth.clippster/`
- **Linux**: `~/.local/share/com.openworth.clippster/`

## File Path Storage

When storing file paths in the database:

1. Always use the appropriate storage subdirectory (clips, videos, thumbnails, etc.)
2. Store absolute paths in the database
3. Use the `getStoragePaths()` function to construct paths dynamically

### Example

```typescript
import { getStoragePath } from '@/services/storage'
import { createClip } from '@/services/database'

async function saveClip(projectId: string, filename: string) {
  const clipsDir = await getStoragePath('clips')
  const filePath = `${clipsDir}/${filename}`
  
  // Save to database with full path
  await createClip(projectId, filePath, { name: filename })
}
```

## Cleanup

Temporary files should be cleaned up after processing:

```typescript
import { getStoragePath } from '@/services/storage'
import { remove } from '@tauri-apps/plugin-fs'

async function cleanupTempFiles() {
  const tempDir = await getStoragePath('temp')
  // Remove files in temp directory
  // Implementation depends on your cleanup strategy
}
```

## Best Practices

1. **Always use storage service**: Don't hardcode paths; use `getStoragePaths()` or `getStoragePath()`
2. **Unique filenames**: Use UUIDs or timestamps to ensure unique filenames
3. **Clean up temp files**: Remove temporary files after processing to save disk space
4. **Error handling**: Handle storage errors gracefully (disk full, permissions, etc.)
5. **Path separators**: Use `path.join()` in Node/TypeScript or `PathBuf::join()` in Rust to avoid path separator issues

## Security Considerations

- Storage directories are user-specific and respect OS-level permissions
- Files are stored locally on the user's machine
- No data is transmitted to external services by the storage layer
- Ensure proper file permissions when creating files (handled automatically by the OS)
