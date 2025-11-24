# Pump.fun Live Streams API Documentation

## Overview
Public API endpoint for fetching currently live streams on Pump.fun. This API provides access to live streaming tokens with comprehensive metadata including stream URLs, participant counts, and token information.

## Base URL
```
https://frontend-api-v3.pump.fun
```

## Live Streams Endpoint

### GET /coins/search-unrestricted

**Purpose**: Fetch currently live streaming tokens

**Authentication**: None required (public endpoint)

**Rate Limiting**:
- Limit: 20 requests per minute
- Headers: `x-ratelimit-limit: 20`, `x-ratelimit-remaining`, `x-ratelimit-reset: 60`

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | 60 | Number of results per page (max appears to be 60) |
| `offset` | number | No | 0 | Number of results to skip for pagination |
| `includeNsfw` | boolean | No | false | Include NSFW content |
| `order` | string | No | "desc" | Sort order (asc/desc) |
| `currentlyLive` | boolean | **Yes** | true | **Filter for currently live streams only** |
| `sort` | string | No | "featured" | Sort method (featured, latest, etc.) |

### Example Requests

**Basic live streams request:**
```bash
GET https://frontend-api-v3.pump.fun/coins/search-unrestricted?limit=60&offset=0&includeNsfw=false&order=desc&currentlyLive=true&sort=featured
```

**Paginated request (page 2):**
```bash
GET https://frontend-api-v3.pump.fun/coins/search-unrestricted?limit=60&offset=60&includeNsfw=false&order=desc&currentlyLive=true&sort=featured
```

### Response Format

**Response Type**: Array of live stream objects

**Status Codes**:
- `200 OK` - Success
- `429 Too Many Requests` - Rate limit exceeded

### Response Object Structure

```typescript
interface LiveStream {
  // Token Information
  mint: string;                    // Token contract address
  name: string;                    // Token name
  symbol: string;                  // Token symbol
  description: string;             // Token description
  image_uri: string;               // Token image URL (IPFS)
  metadata_uri: string;            // Token metadata URL (IPFS)

  // Social Links
  twitter?: string;                // Twitter profile URL
  telegram?: string;               // Telegram group URL
  website?: string;                // Project website URL

  // Blockchain & Trading
  bonding_curve: string;           // Bonding curve address
  associated_bonding_curve: string; // Associated bonding curve
  creator: string;                 // Creator wallet address
  raydium_pool?: string;           // Raydium pool address
  pump_swap_pool?: string;         // Pump.swap pool address

  // Market Data
  market_cap: number;              // Market cap in SOL
  usd_market_cap: number;          // Market cap in USD
  virtual_sol_reserves: number;    // Virtual SOL reserves
  virtual_token_reserves: number;  // Virtual token reserves
  real_sol_reserves: number;       // Real SOL reserves
  real_token_reserves: number;     // Real token reserves

  // Timestamps
  created_timestamp: number;       // Creation timestamp (Unix ms)
  last_trade_timestamp: number;    // Last trade timestamp
  king_of_the_hill_timestamp: number; // KOTH timestamp
  updated_at: number;              // Last updated timestamp

  // Stream Information
  is_currently_live: boolean;      // Currently streaming
  livestream_title?: string;       // Stream title
  playlist_url: string;            // Live stream playlist URL (M3U8)
  playlist_url_high?: string;      // High quality playlist
  playlist_url_low?: string;       // Low quality playlist
  vod_playlist_url: string;        // Video on demand playlist
  playlist_status: string;         // "ACTIVE", "ENDED", etc.
  playlist_updated_at: string;     // Playlist last updated (ISO)
  num_participants: number;        // Current viewer count

  // Media
  thumbnail: string;               // Stream thumbnail URL
  thumbnail_updated_at: number;    // Thumbnail timestamp
  video_uri?: string;              // Promotional video URL
  banner_uri?: string;             // Banner image URL

  // Content & Moderation
  nsfw: boolean;                   // NSFW content flag
  is_banned: boolean;              // Banned status
  livestream_ban_expiry: number;   // Ban expiry timestamp
  reply_count: number;             // Number of replies/comments
  last_reply: number;              // Last reply timestamp

  // Metadata
  total_supply: number;            // Token total supply
  show_name: boolean;              // Show name publicly
  complete: boolean;               // Complete listing
  inverted: boolean;               // Inverted pairing
  hidden: boolean|null;            // Hidden status
  initialized: boolean;            // Token initialized
  hide_banner: boolean;            // Hide banner setting

  // All-time High
  ath_market_cap?: number;         // All-time high market cap
  ath_market_cap_timestamp?: number; // ATH timestamp

  // System
  program: string;                 // Program type ("pump")
  platform?: string;               // Platform
  token_program?: string;          // Token program
  mayhem_state?: any;              // Mayhem event state
  market_id?: string;              // Market ID
}
```

### Pagination Implementation

**Current Data**: As of analysis, there are ~172 total live streams

**Pagination Strategy**:
- Use `offset` parameter for pagination
- Each page returns up to 60 items
- Increment offset by 60 for subsequent pages
- When response returns empty array, you've reached the end

**Example Pagination Logic**:
```javascript
async function getAllLiveStreams() {
  const limit = 60;
  let offset = 0;
  let allStreams = [];

  while (true) {
    const response = await fetch(
      `https://frontend-api-v3.pump.fun/coins/search-unrestricted?limit=${limit}&offset=${offset}&includeNsfw=false&order=desc&currentlyLive=true&sort=featured`
    );
    const streams = await response.json();

    if (streams.length === 0) break;

    allStreams = allStreams.concat(streams);
    offset += limit;
  }

  return allStreams;
}
```

### Stream Playback

The live streams use HLS (HTTP Live Streaming) with M3U8 playlists:

- **Live Stream**: `playlist_url` (ends with `_live.m3u8`)
- **VOD**: `vod_playlist_url` (same content without live flag)
- **Qualities**: May have separate high/low quality variants

### CORS & Headers

**Important Headers**:
- `Origin: https://pump.fun` (required for CORS)
- `Referer: https://pump.fun/` (recommended)
- `Content-Type: application/json`

**CORS Configuration**:
- `access-control-allow-credentials: true`
- `access-control-allow-origin: https://pump.fun`

### Error Handling

**Common Issues**:
1. **Rate Limiting**: Respect 20 requests/minute limit
2. **Empty Responses**: Indicates end of pagination
3. **CORS Errors**: Ensure proper origin/referer headers

**Rate Limit Response Headers**:
- `x-ratelimit-limit: 20`
- `x-ratelimit-remaining: [remaining_requests]`
- `x-ratelimit-reset: [seconds_until_reset]`

### Usage Example

```javascript
// Basic usage
async function getLiveStreams(page = 0) {
  const limit = 60;
  const offset = page * limit;

  const response = await fetch(
    `https://frontend-api-v3.pump.fun/coins/search-unrestricted?limit=${limit}&offset=${offset}&includeNsfw=false&order=desc&currentlyLive=true&sort=featured`,
    {
      headers: {
        'Origin': 'https://pump.fun',
        'Referer': 'https://pump.fun/'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

// Get stream with playback URLs
function extractStreamInfo(stream) {
  return {
    id: stream.mint,
    name: stream.name,
    symbol: stream.symbol,
    title: stream.livestream_title,
    viewers: stream.num_participants,
    thumbnail: stream.thumbnail,
    livePlaylist: stream.playlist_url,
    vodPlaylist: stream.vod_playlist_url,
    isActive: stream.playlist_status === 'ACTIVE',
    nsfw: stream.nsfw,
    marketCap: stream.usd_market_cap,
    social: {
      twitter: stream.twitter,
      telegram: stream.telegram,
      website: stream.website
    }
  };
}
```

---

**Last Updated**: November 24, 2025
**Total Live Streams**: ~172 (at time of analysis)
**API Version**: v3
**Documentation Source**: Network analysis of pump.fun/live