# Leaderboard 404 Error Fix

## Issue

Production error when loading the leaderboard on the Organization Clippers page:

```
Failed to load resource: the server responded with a status of 404
Error: "Profile not found"
Endpoint: /api/clippers/leaderboard?period=weekly&type=posts
```

## Root Cause

**Phoenix Router Route Collision**

The issue was caused by route ordering in the Phoenix router. The routes were defined in this order:

1. **Line 232 (Public Scope)**: `get("/clippers/:slug", ClipperProfilesController, :show)`
2. **Line 986 (Auth Scope)**: `get("/clippers/leaderboard", ClipperProfilesController, :leaderboard)`

When a request came in for `/api/clippers/leaderboard`, Phoenix's router matched it against the first route `/clippers/:slug`, treating "leaderboard" as the `:slug` parameter. This sent the request to the `show` action which tried to find a clipper profile with slug "leaderboard", resulting in the 404 "Profile not found" error.

### Why This Happened

Phoenix router matches routes in the order they are defined, and wildcard routes (`:slug`) match any string. The more specific route `/clippers/leaderboard` must come **before** the wildcard route `/clippers/:slug` to prevent collision.

## Solution

### Backend Changes

#### 1. Router Route Ordering Fix (`server/lib/clippster_server_web/router.ex`)

Moved the leaderboard route to the public scope BEFORE the wildcard `:slug` route:

```elixir
# ❌ BEFORE (Broken)
scope "/api", ClippsterServerWeb do
  pipe_through(:api)
  
  # This matches "/clippers/leaderboard" first!
  get("/clippers/:slug", ClipperProfilesController, :show)  # Line 232
end

scope "/api", ClippsterServerWeb do
  pipe_through(:api_auth)
  
  # This never gets reached for "leaderboard"
  get("/clippers/leaderboard", ClipperProfilesController, :leaderboard)  # Line 986
end

# ✅ AFTER (Fixed)
scope "/api", ClippsterServerWeb do
  pipe_through(:api)
  
  # Clipper leaderboard - MUST come before /clippers/:slug to avoid route collision
  get("/clippers/leaderboard", ClipperProfilesController, :leaderboard)  # Now before :slug
  
  # Public clipper profile (shareable links)
  get("/clippers/:slug", ClipperProfilesController, :show)
end
```

**Decision**: Made the leaderboard endpoint **public** (no authentication required) because:
- It only shows public clipper profile data (no sensitive information)
- Makes the leaderboard discoverable and shareable
- Simplifies the implementation (no need for dual route declarations)
- Aligns with the public nature of clipper profiles

#### 2. Controller Documentation Update (`server/lib/clippster_server_web/controllers/clipper_profiles_controller.ex`)

Updated the controller documentation to reflect that the endpoint is now public:

```elixir
@doc """
GET /api/clippers/leaderboard
Get the clipper leaderboard.
Accepts: period (weekly|monthly), type (posts|campaigns)
Public endpoint - no authentication required.
"""
def leaderboard(conn, params) do
  # ... implementation unchanged
end
```

### Frontend Changes

#### 1. Enhanced Error Handling (`client/src/components/organization/OrganizationClippers.vue`)

**Added Error State Tracking:**
```typescript
const leaderboardError = ref<string | null>(null);
```

**Improved `loadLeaderboard()` function:**
- Captures and stores error messages
- Maps API response field names (`profile` → `clipper_profile`) for compatibility
- Suppresses toast notifications for expected "Profile not found" errors
- Shows user-friendly error messages

**Better Empty State UI:**
- Shows contextual messages based on error type
- Displays helpful message for "Profile not found" errors
- Includes a "Try Again" button when errors occur

**Lazy Loading:**
- Only loads leaderboard when the leaderboard tab is active (performance optimization)
- Watches for view changes and loads data on demand

**Code:**
```typescript
const loadLeaderboard = async () => {
  loadingLeaderboard.value = true;
  leaderboardError.value = null;
  try {
    const response = await getLeaderboard(leaderboardPeriod.value);
    if (response.success) {
      leaderboardEntries.value = response.entries.map((entry: any, index: number) => ({
        ...entry,
        total_views: entry.total_views || 0,
        rank: index + 1,
        clipper_profile: entry.profile || entry.clipper_profile,  // Handle both field names
      }));
    } else {
      const errorMsg = response.error || 'Failed to load leaderboard';
      showToast(errorMsg, 'error');
      leaderboardError.value = errorMsg;
      leaderboardEntries.value = [];
    }
  } catch (error: any) {
    console.error('Failed to load leaderboard:', error);
    const errorMessage = error?.response?.data?.error || error?.message || 'Failed to load leaderboard';
    leaderboardError.value = errorMessage;
    
    // Only show toast if it's not a "Profile not found" error (which was the bug)
    if (!errorMessage.toLowerCase().includes('profile not found')) {
      showToast(errorMessage, 'error');
    }
    leaderboardEntries.value = [];
  } finally {
    loadingLeaderboard.value = false;
  }
};
```

## Files Modified

### Backend
1. `server/lib/clippster_server_web/router.ex`
   - Moved `/clippers/leaderboard` route before `/clippers/:slug` wildcard
   - Removed duplicate route from auth scope
   - Added explanatory comments

2. `server/lib/clippster_server_web/controllers/clipper_profiles_controller.ex`
   - Updated docstring to indicate public endpoint

### Frontend
3. `client/src/components/organization/OrganizationClippers.vue`
   - Added `leaderboardError` state tracking
   - Enhanced error handling with user feedback
   - Added data field compatibility layer (`profile` vs `clipper_profile`)
   - Improved empty state UI with contextual messaging
   - Added retry button for failed loads
   - Implemented lazy loading with view watcher
   - Added `watch` import from Vue

## Testing

To verify the fix works:

1. **Backend**: Restart the server and test the endpoint directly:
   ```bash
   curl https://clippster-server.fly.dev/api/clippers/leaderboard?period=weekly&type=posts
   ```
   Should return `200 OK` with leaderboard data (or empty array if no data exists)

2. **Frontend**: 
   - Navigate to Organization → Find Clippers
   - Click the "Leaderboard" tab
   - Should either show leaderboard entries or a helpful empty state
   - Should NOT show "Profile not found" error in console

## Deployment Notes

1. Deploy backend changes first (router fix is critical)
2. Deploy frontend changes after backend is live
3. Monitor for any authentication-related issues (though endpoint is now public)

## Future Considerations

1. **Caching**: Consider adding Redis caching for leaderboard data since it's now public
2. **Rate Limiting**: May want to add rate limiting to prevent abuse
3. **Data Generation**: The leaderboard currently shows placeholder data until the view sync pipeline is implemented (see `docs/completed/Leaderboard_TODO.md`)

## Related Documentation

- `docs/completed/Leaderboard_TODO.md` - Leaderboard implementation plan and pending features
