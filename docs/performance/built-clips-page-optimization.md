# Built Clips Page Performance Improvements

## Overview
Implemented comprehensive performance optimizations to dramatically reduce the load time of the Built Clips page (`client/src/pages/Clips.vue`). The page was experiencing severe performance issues due to sequential N+1 queries and loading all thumbnails at once.

## Changes Made

### 1. Batched and Parallelized Data Loading (`Clips.vue`)

**Before:**
- Sequential `for` loop loading project info one at a time
- Sequential raw video loading for each project
- Sequential build thumbnail loading
- All operations blocking the UI

**After:**
- Collect all unique project IDs first
- Load all project info in parallel with `Promise.all()`
- Load all raw videos in parallel after collecting project IDs
- Defer non-critical operations to after initial render
- Batch build thumbnail loading in groups of 10

**Key Code Change:**
```typescript
// Collect unique project IDs for batch loading
const uniqueProjectIds = new Set<string>();
clips.value.forEach(clip => {
  if (clip.project_id) {
    uniqueProjectIds.add(clip.project_id);
  }
});

// Load all critical operations in parallel
await Promise.all([
  loadTranscribedClipIds(),
  thumbnailStore.loadThumbnailsLazy(clips.value.slice(0, 20), 'high'),
  Promise.all(Array.from(uniqueProjectIds).map(projectId => getProjectInfo(projectId))),
]);

// Defer heavy operations
setTimeout(() => {
  loadDeferredData(uniqueProjectIds);
}, 100);
```

### 2. IndexedDB Persistent Cache (`utils/persistentCache.ts`)

**New Feature:**
- Created a robust IndexedDB-based caching layer
- Caches persist across browser sessions
- Automatic expiration with configurable TTL
- Separate stores for projects, rawVideos, and thumbnails
- Background cleanup of expired entries

**Benefits:**
- First load is fast, subsequent loads are instant (cache hits)
- Reduces Tauri IPC calls dramatically
- Project info cached for 1 hour
- Raw videos cached for 30 minutes
- Thumbnails cached for 24 hours

**API:**
```typescript
await persistentCache.get<T>('storeName', 'key');
await persistentCache.set('storeName', 'key', value, ttlMs);
await persistentCache.delete('storeName', 'key');
await persistentCache.clear('storeName');
```

### 3. Enhanced Thumbnail Store (`stores/clipThumbnails.ts`)

**New Features:**
- Integrated with IndexedDB persistent cache
- Added `loadThumbnailsLazy()` for priority-based loading
- Thumbnails persist in IndexedDB (24-hour TTL)
- High priority: load 3 at a time immediately
- Low priority: load 10 at a time with 50ms delays

**Before:**
```typescript
// Loaded all thumbnails sequentially
for (const clip of clips) {
  await loadThumbnail(clip);
}
```

**After:**
```typescript
// Load first 20 immediately, rest in background
await thumbnailStore.loadThumbnailsLazy(clips.slice(0, 20), 'high');
setTimeout(() => {
  thumbnailStore.loadThumbnailsLazy(clips.slice(20), 'low');
}, 500);
```

### 4. Deferred Non-Critical Operations

Operations now split into critical and deferred:

**Critical (blocks initial render):**
- Load clips from database
- Load transcribed clip IDs
- Load first 20 clip thumbnails
- Load all project info

**Deferred (runs after UI shows):**
- Load raw videos for fallback thumbnails
- Load build thumbnails
- Load remaining clip thumbnails (21+)

## Performance Impact

### Expected Improvements:

**Initial Page Load:**
- Before: 5-10+ seconds for 50+ clips
- After: <1 second to show UI with first 20 thumbnails

**Subsequent Loads:**
- Before: Same slow load every time
- After: Nearly instant (IndexedDB cache hits)

**Memory Usage:**
- Reduced redundant data loading
- Thumbnails cached efficiently in IndexedDB
- No more duplicate requests for same data

**Network/IPC Calls:**
- Reduced from ~200+ sequential calls to ~20-30 parallel calls
- Cache hits eliminate most calls on subsequent loads

## Testing Checklist

- [ ] Open Built Clips page with 0 clips (empty state)
- [ ] Open Built Clips page with 10-20 clips (small list)
- [ ] Open Built Clips page with 50+ clips (large list)
- [ ] Verify thumbnails load progressively (first 20 → rest)
- [ ] Refresh page to test IndexedDB cache (should be instant)
- [ ] Clear browser cache and test cold start
- [ ] Check browser DevTools → Application → IndexedDB for cache entries
- [ ] Verify no console errors or warnings
- [ ] Test filtering/sorting still works correctly
- [ ] Test build card thumbnails load correctly

## Future Enhancements

1. **Virtual Scrolling**: Only render visible clips in DOM (for 100+ clips)
2. **Intersection Observer**: Load thumbnails only when scrolled into view
3. **Service Worker**: Cache thumbnails in Service Worker for offline access
4. **Optimistic Updates**: Show cached thumbnails immediately, refresh in background
5. **Prefetching**: Preload likely-to-be-viewed clips based on user behavior

## Files Modified

1. `client/src/pages/Clips.vue` - Refactored loadClips() with batching/parallelization
2. `client/src/stores/clipThumbnails.ts` - Added IndexedDB integration and lazy loading
3. `client/src/utils/persistentCache.ts` - New IndexedDB cache utility

## Rollback Plan

If issues arise, revert these commits:
- The changes are isolated to these 3 files
- Cache is optional - app works without it
- No database schema changes
- No breaking API changes
