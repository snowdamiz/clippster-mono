# View Tracking Per Platform (No-API Strategy)

## Overview
This document outlines the architecture for a "Posted Clip Tracker" feature in Clippster. The goal is to allow users to manually input links to clips posted on social media (TikTok, Instagram, X, YouTube) and have the app automatically track their view counts in real-time, without relying on expensive or restrictive official APIs.

## The Challenge
*   **Official APIs**: Often require business verification, have strict quotas, or don't provide granular view counts for public posts easily.
*   **Traditional Scraping (reqwest/Python)**: Fails against modern bot detection (especially X/Twitter and TikTok) which check for TLS fingerprints, JavaScript execution, and browser behavior.

## The Solution: "Hidden Window" Scraping
Since Clippster is a Tauri (desktop) app, we can leverage the **Native Webview**.
1.  **Mechanism**: The app opens a secondary window that is set to `visible: false`.
2.  **Identity**: To the social media platform, this looks exactly like a standard user browser (Chrome/Safari/Edge), sharing the same cookies and fingerprints as a real user.
3.  **Process**:
    *   App loads the clip URL in the hidden window.
    *   App injects a lightweight JavaScript snippet to find the "View Count" element.
    *   Data is passed back to the main app and saved to the database.
    *   Window is closed or reused for the next link.

## Implementation Plan

### 1. Database Schema
New table to track individual posted links.

```sql
CREATE TABLE IF NOT EXISTS posted_clips (
  id TEXT PRIMARY KEY,
  creator_profile_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'tiktok', 'instagram', 'x', 'youtube'
  title TEXT,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  posted_at INTEGER, -- When the user says it was posted
  last_checked_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posted_clips_creator ON posted_clips(creator_profile_id);
```

### 2. Backend (Rust)
We need commands to manage the data and a specialized command to handle the "Hidden Window" logic.

**Data Structure:**
```rust
pub struct PostedClip {
    pub id: String,
    pub creator_profile_id: String,
    pub url: String,
    pub platform: String,
    pub view_count: i64,
    // ... other fields
}
```

**Commands:**
*   `add_posted_clip(creator_id, url)`: Saves the link.
*   `get_posted_clips(creator_id)`: Returns list for the UI.
*   `update_clip_stats(id, views)`: Updates DB with new numbers.

### 3. Frontend (Vue)
*   **Creator Profile Page**: Add a new tab or section "Posted Clips".
*   **Input**: Simple "Add Link" button.
*   **Display**: List of clips showing Thumbnail (if possible), Title, Platform Icon, and **Big View Count**.
*   **Action**: "Refresh Stats" button that triggers the scraping process.

## Platform Specifics

### X (Twitter)
*   **Difficulty**: Extreme (for standard scrapers).
*   **Strategy**:
    *   X often blocks "Guest" viewing of detailed stats or sensitive content.
    *   **User Login**: If the user logs into X *once* inside Clippster (e.g., in a popup window), the cookies are saved in the webview context.
    *   **Automation**: The hidden window will use these cookies, allowing it to see exactly what the user sees (full view counts).
*   **Selector**: The script looks for the analytics bar usually found under the tweet (e.g., `[aria-label="100 Views"]`).

### TikTok
*   **Difficulty**: High (anti-bot), but usually allows viewing specific video pages as guest.
*   **Strategy**: Load page, wait for hydration.
*   **Selector**: Look for `strong[data-e2e="video-views"]` or similar meta tags in the DOM.

### Instagram
*   **Difficulty**: Medium. often requires login after a few requests.
*   **Strategy**: Same as X—rely on the user being logged in within the app's webview context if guest access is blocked.

## Workflow Example
1.  User posts a clip to X.
2.  User copies the link (`x.com/user/status/12345`).
3.  User goes to Creator Profile in Clippster -> "Posted Clips" -> Paste Link.
4.  Clippster saves it to DB.
5.  Clippster (background or on click) opens a hidden window to that URL.
6.  The window parses "1.2K Views".
7.  Database updates `view_count = 1200`.
8.  UI updates to show "1.2K" next to the clip.

