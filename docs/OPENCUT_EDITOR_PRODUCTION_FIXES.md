# OpenCut Editor Production Fixes

## Issues Identified

When loading a manually clipped livestream in the OpenCut editor in production, two critical issues occurred:

### 1. CSP Blocking Filmstrip Thumbnails
**Error**: `Loading the image 'blob:http://tauri.localhost/...' violates the following Content Security Policy directive: "img-src 'self' asset: https://asset.localhost data: https:"`

**Root Cause**: The filmstrip thumbnails are generated as `blob:` URLs by the FilmstripService using mediabunny's `CanvasSink.canvasesAtTimestamps()`. The Content Security Policy in production did not allow `blob:` URLs in the `img-src` directive.

**Fix**: Added `blob:` to the `img-src` CSP directive in `client/src-tauri/tauri.conf.json`:
```
img-src 'self' asset: https://asset.localhost data: blob: https:
```

### 2. Race Condition - "No active project/scene" Errors
**Errors**:
```
Error: No active project
Error: No active scene
```

**Root Cause**: The `EditorLayout` component was rendering before the project was fully loaded. The `loadClippsterProject()` function is asynchronous and performs several operations:
1. Load project from SQLite
2. Convert to OpenCut format
3. Save to storage
4. Load media assets
5. Initialize scenes

Components in `EditorLayout` immediately call `editor.project.getActive()` and `editor.scenes.getActiveScene()`, which throw errors when called before initialization completes.

**Fix**: Added a polling loop in `OpenCutEditor.vue` to wait for both project and scenes to be fully loaded before rendering `EditorLayout`:

```typescript
// Wait for project to be fully loaded and ready
let retries = 0;
const maxRetries = 50; // 5 seconds max wait
while (retries < maxRetries) {
  const project = editor.project.getActiveOrNull();
  const scenes = editor.scenes.getScenes();
  
  if (project && scenes.length > 0) {
    // Project and scenes are loaded, safe to render
    break;
  }
  
  await new Promise(resolve => setTimeout(resolve, 100));
  retries++;
}
```

## Files Modified

### `client/src-tauri/tauri.conf.json`
- **Line 28**: Added `blob:` to `img-src` CSP directive
- **Line 4**: Bumped version from `0.1.93` to `0.1.94`

### `client/src/pages/OpenCutEditor.vue`
- **Lines 26-47**: Added project/scene readiness check before rendering EditorLayout
- Uses `getActiveOrNull()` and `getScenes()` to safely check state
- Polls every 100ms for up to 5 seconds
- Throws timeout error if project doesn't load in time

## Expected Behavior After Fix

1. **Filmstrip thumbnails display correctly** - No CSP violations, thumbnails load and render on timeline elements
2. **No "No active project/scene" errors** - EditorLayout only renders after project is fully initialized
3. **Smooth editor loading** - Loading spinner shows until both project and scenes are ready

## Testing Recommendations

1. Load a manually clipped livestream in production build
2. Verify filmstrip thumbnails appear on timeline video elements
3. Verify no console errors about "No active project" or "No active scene"
4. Verify editor loads within 5 seconds (or shows timeout error)
5. Test with different clip sources (VOD clips, uploaded videos, livestream clips)

## Related Systems

- **FilmstripService** (`client/src/editor/services/filmstrip-service.ts`) - Generates blob URLs for thumbnails
- **ProjectManager** (`client/src/editor/core/managers/project-manager.ts`) - Manages project loading state
- **ScenesManager** (`client/src/editor/core/managers/scenes-manager.ts`) - Manages scene initialization
- **Project Loader** (`client/src/editor/bridge/project-loader.ts`) - Converts Clippster projects to OpenCut format
