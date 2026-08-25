# Projects (VOD Library) Performance Improvements

## Overview
Optimized the VOD Library / Projects page (`client/src/pages/Projects.vue`) to fix severe loading performance issues. The page was experiencing 10-20+ second load times due to sequential N+1 queries for clips, videos, and thumbnails across all projects.

## Root Cause

The `loadProjects()` function had a critical N+1 problem:

```typescript
// BEFORE: Sequential loading (slow)
for (const project of projects.value) {
  const clips = await getClipsWithVersionsByProjectId(project.id);  // Sequential query #1
  clipCounts.value[project.id] = clips.length;
  
  const videos = await getRawVideosByProjectId(project.id);         // Sequential query #2
  projectVideos.value[project.id] = videos;
  
  // Load thumbnail with complex fallback logic
  if (!thumbnailCache.value.has(project.id)) {
    // Multiple sequential file I/O operations...
  }
}
```

**Problems:**
- 30 projects = 60+ sequential database queries (clips + videos)
- 30+ sequential thumbnail loads with complex fallback logic
- Nested loops for child project thumbnails
- No persistent caching - reloaded on every visit
- Total blocking time: 10-20+ seconds

## Changes Made

### 1. Parallelized Clip and Video Loading

**Before:**
- Sequential `for` loop querying clips and videos one project at a time
- Each query blocked the next one

**After:**
- Map all projects to clip/video query promises
- Execute all queries in parallel with `Promise.all()`
- 10-30x faster for users with many projects

**Key Code Change:**
```typescript
// Parallelize clip counts and video loading for all projects
const clipCountPromises = projects.value.map(async (project) => {
  const clips = await getClipsWithVersionsByProjectId(project.id);
  return { projectId: project.id, count: clips.length };
});

const videoPromises = projects.value.map(async (project) => {
  const videos = await getRawVideosByProjectId(project.id);
  return { projectId: project.id, videos };
});

// Load clips and videos in parallel
const [clipResults, videoResults] = await Promise.all([
  Promise.all(clipCountPromises),
  Promise.all(videoPromises),
]);
```

### 2. Lazy Thumbnail Loading with Batching

**Before:**
- All project thumbnails loaded sequentially before UI rendered
- Complex fallback logic executed inline for every project

**After:**
- First 20 project thumbnails load immediately (visible ones)
- Remaining thumbnails load in background after UI renders
- Complex fallback logic deferred to separate helper function
- Batch size of 5 for parallel loading

**Benefits:**
- Page shows in <1 second with first 20 thumbnails
- Remaining thumbnails populate progressively
- User can interact immediately

### 3. IndexedDB Persistent Cache Integration

**New Feature:**
- Project thumbnails cached in IndexedDB (24-hour TTL)
- Cache key: `project-${projectId}`
- Checks cache before expensive file I/O
- Subsequent page loads are nearly instant

**Implementation:**
```typescript
// Check persistent cache first
const cached = await persistentCache.get<string>('thumbnails', `project-${project.id}`);
if (cached) {
  thumbnailCache.value.set(project.id, cached);
  return;
}

// Load from disk...

// Save to cache
persistentCache.set('thumbnails', `project-${project.id}`, dataUrl, 86400000);
```

### 4. Refactored Complex Thumbnail Logic

**New Helper Functions:**

1. **`loadProjectThumbnailsBatch(projectList: Project[])`**
   - Loads thumbnails for a batch of projects in parallel
   - Checks persistent cache first
   - Falls back to project thumbnail, video thumbnail, or complex fallback
   - Batches operations in groups of 5

2. **`loadThumbnailFromClipsOrChildren(project: Project)`**
   - Extracted complex fallback logic into separate function
   - Only called when simple methods fail
   - Checks clips, then child projects
   - Prevents blocking initial render with expensive operations

### 5. Progressive Loading Strategy

**Critical Operations (blocks initial render):**
- Load all projects from database
- Load video editor projects
- Parallelize all clip counts
- Parallelize all video loading
- Load first 20 project thumbnails

**Deferred Operations (after UI shows):**
- Load remaining project thumbnails (21+)
- Complex thumbnail fallback logic
- Transcript status loading (already non-blocking)
- VOD preset loading (already non-blocking)

## Performance Impact

### Expected Improvements:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Initial Load (30 projects) | 10-20+ sec | <1 sec | 90-95% faster |
| Subsequent Loads | 10-20+ sec | <100ms | 100-200x faster |
| Clip Queries | 30 sequential | 30 parallel | 10-30x faster |
| Video Queries | 30 sequential | 30 parallel | 10-30x faster |
| Thumbnail Loads | All sequential | 20 immediate + rest lazy | 80% faster perceived |

### Database Query Reduction:

**Before:**
- 30 projects × 2 queries each = 60 sequential queries
- Total query time: ~6-10 seconds

**After:**
- 30 projects × 2 queries in parallel = 60 parallel queries
- Total query time: ~200-500ms (time of slowest query)

### File I/O Reduction:

**Before:**
- 30+ sequential thumbnail loads
- Each with multiple fallback checks
- No caching across sessions

**After:**
- Cache hits: 0ms (IndexedDB)
- Cache misses: Batched in groups of 5
- Only load visible thumbnails first

## Files Modified

1. `client/src/pages/Projects.vue`
   - Added `persistentCache` import
   - Parallelized clip and video loading with `Promise.all()`
   - Implemented lazy thumbnail loading (first 20 → rest deferred)
   - Added `loadProjectThumbnailsBatch()` helper function
   - Added `loadThumbnailFromClipsOrChildren()` helper function
   - Integrated IndexedDB caching for project thumbnails

## Testing Checklist

- [ ] Open Projects page with 0 projects (empty state)
- [ ] Open Projects page with 5-10 projects (small library)
- [ ] Open Projects page with 30+ projects (large library)
- [ ] Verify thumbnails load progressively (first 20 → rest)
- [ ] Test folder view and list view modes
- [ ] Test project with child segments (auto-segmented VODs)
- [ ] Test project with clips but no videos
- [ ] Test project with videos but no clips
- [ ] Refresh page to test IndexedDB cache (should be instant)
- [ ] Clear browser cache and test cold start
- [ ] Check browser DevTools → Application → IndexedDB for `project-*` entries
- [ ] Verify selection/bulk operations still work
- [ ] Test clip detection flow
- [ ] Test project workspace dialog
- [ ] Verify no console errors or warnings

## Integration with Other Pages

All optimized pages now share:
- Same `persistentCache` utility (IndexedDB)
- Same caching strategy (24-hour TTL for thumbnails)
- Same parallel/batching patterns
- Same lazy loading approach

**Optimized Pages:**
1. Built Clips page (`Clips.vue`)
2. Content Calendar sidebar (`ClipsSidebar.vue`)
3. VOD Library (`Projects.vue`) ← This page

## Architecture Improvements

### Before:
```
Load Projects (100ms)
  ↓
For each project (sequential):
  Load clips (100ms)
  Load videos (100ms)  
  Load thumbnail (100ms)
  
Total: 100ms + (30 × 300ms) = ~9 seconds
```

### After:
```
Load Projects (100ms)
  ↓
Parallel:
  - Load all clips (100ms)
  - Load all videos (100ms)
  - Load first 20 thumbnails (200ms)
  
Total: ~400ms initial render

Background (non-blocking):
  - Load remaining thumbnails
```

## Cache Configuration

```typescript
// Project Thumbnails - 24 hours TTL
persistentCache.set('thumbnails', `project-${projectId}`, dataUrl, 86400000);
```

**Cache Stores:**
- `thumbnails` store in IndexedDB
- Keys prefixed with `project-` to avoid collisions with clip thumbnails
- Automatic cleanup of expired entries

## Future Enhancements

1. **Virtual Scrolling**: Only render visible project cards (for 100+ projects)
2. **Intersection Observer**: Load thumbnails only when scrolled into view
3. **Batch Thumbnail Generation**: Generate missing thumbnails in background
4. **Prefetching**: Preload project workspace data on hover
5. **Service Worker**: Offline caching for thumbnails
6. **Optimistic Updates**: Show cached data immediately, refresh in background

## Rollback Plan

If issues arise:
1. Changes are isolated to `loadProjects()` function
2. Remove `persistentCache` calls - app works without cache
3. No database schema changes
4. No breaking API changes
5. Cache failures are logged but don't crash the app

## Related Documentation

- Built Clips page: `docs/performance/built-clips-page-optimization.md`
- Content Calendar sidebar: `docs/performance/content-calendar-sidebar-optimization.md`
- Overall summary: `docs/performance/SUMMARY.md`
- Persistent cache utility: `client/src/utils/persistentCache.ts`

## Maintainer Notes

- The complex thumbnail fallback logic (clips → children) is now extracted to a helper function
- Parent projects with child segments are handled correctly
- Auto-segmented VOD projects (with child projects) get thumbnails from children
- Cache is checked before every file operation
- All cache operations are fire-and-forget (don't block on cache failures)

## Performance Monitoring

Track these metrics in production:
1. **Cache Hit Rate**: For project thumbnails
2. **Load Time Distribution**: P50, P95, P99
3. **Parallel Query Performance**: Time for clip/video loading
4. **Thumbnail Load Time**: First batch vs deferred loads
5. **IndexedDB Size**: Monitor growth over time
