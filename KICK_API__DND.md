# Kick.com API Documentation

**⚠️ DO NOT DISTRIBUTE - FOR INTERNAL USE ONLY**

This document contains reverse-engineered API endpoints from Kick.com for accessing streamer information, VODs, and live streams.

## Table of Contents
1. [Authentication](#authentication)
2. [Core Channel APIs](#core-channel-apis)
3. [VODs/Video Content](#vodsvideo-content)
4. [Live Stream Integration](#live-stream-integration)
5. [Chat & Social Features](#chat--social-features)
6. [Discovery & Browse](#discovery--browse)
7. [Rate Limits & Headers](#rate-limits--headers)

---

## Authentication

**Method**: Session-based cookies (`credentials: "include"`)

All API requests require browser session cookies. No explicit API tokens are needed - the browser's authentication cookie is used.

**Required Headers for all requests:**
```http
accept: application/json
accept-language: en-US,en;q=0.6
cache-control: max-age=0
sec-ch-ua: "Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Windows"
sec-fetch-dest: empty
sec-fetch-mode: cors
sec-fetch-site: same-origin
sec-gpc: 1
```

---

## Core Channel APIs

### Channel Information
**Endpoint**: `GET https://kick.com/api/v2/channels/{channel_slug}`

**Returns**:
- Channel metadata (ID, slug, username, profile picture)
- Live status and current stream info
- Follower count, subscriber info
- Channel settings (mature content, VOD enabled, etc.)

### Channel Chatroom
**Endpoint**: `GET https://kick.com/api/v2/channels/{channel_slug}/chatroom`

**Usage Example**:
```bash
curl "https://kick.com/api/v2/channels/xqc/chatroom" \
  -H "accept: application/json" \
  -b "session_cookies_here"
```

### Channel Goals & Polls
**Endpoint**: `GET https://kick.com/api/v2/channels/{channel_slug}/goals`
**Endpoint**: `GET https://kick.com/api/v2/channels/{channel_slug}/polls`

### Channel Emotes
**Endpoint**: `GET https://kick.com/emotes/{channel_slug}`

### Channel Leaderboards
**Endpoint**: `GET https://kick.com/api/v2/channels/{channel_slug}/leaderboards`

---

## VODs/Video Content

### Get Channel Videos
**Endpoint**: `GET https://kick.com/api/v2/channels/{channel_slug}/videos`

**Usage Example**:
```bash
curl "https://kick.com/api/v2/channels/xqc/videos" \
  -H "accept: application/json" \
  -b "session_cookies_here"
```

**Response Structure**:
```json
[
  {
    "id": 85029703,
    "slug": "3ab2b5b5-livedramanewsthingsclipsvideosgamesvideosgamestune-in-quicke33-todaywe-shall-see",
    "channel_id": 668,
    "created_at": "2025-11-24 21:48:59",
    "session_title": "🧑‍🚀LIVE🧑‍🚀DRAMA🧑‍🚀NEWS🧑‍🚀THINGS🧑‍🚀CLIPS🧑‍🚀VIDEOS🧑‍🚀GAMES🧑‍🚀VIDEOSGAMES🧑‍🚀TUNE IN QUICK🧑‍🚀E33 TODAY?🧑‍🚀WE SHALL SEE🧑",
    "is_live": true,
    "risk_level_id": null,
    "start_time": "2025-11-24 21:48:59",
    "source": "https://stream.kick.com/3c81249a5ce0/ivs/v1/196233775518/DsuAwCgUc9Bh/2025/11/24/21/48/CbkPYkGhoL3E/media/hls/master.m3u8",
    "twitch_channel": null,
    "duration": 0,
    "language": "English",
    "is_mature": true,
    "viewer_count": 5344,
    "tags": [],
    "thumbnail": {
      "src": "https://images.kick.com/video_thumbnails/DsuAwCgUc9Bh/CbkPYkGhoL3E/720.webp?versionId=GLnwSK1ojG9uCrLo44MivUAObQKUmgHd",
      "srcset": "https://images.kick.com/video_thumbnails/DsuAwCgUc9Bh/CbkPYkGhoL3E/1080.webp?versionId=YGUHUR9I5AIdJxeRqVm3ai9vZBlOvGaU 1920w, https://images.kick.com/video_thumbnails/DsuAwCgUc9Bh/CbkPYkGhoL3E/720.webp?versionId=GLnwSK1ojG9uCrLo44MivUAObQKUmgHd 1280w, https://images.kick.com/video_thumbnails/DsuAwCgUc9Bh/CbkPYkGhoL3E/360.webp?versionId=QCi7rkIqQda4ljpZtAdAKzUTCpSj0gRS 480w, https://images.kick.com/video_thumbnails/DsuAwCgUc9Bh/CbkPYkGhoL3E/160.webp?versionId=.xkAcifsllhI09_TjKFnZu22Lnv1PfcF 284w, https://images.kick.com/video_thumbnails/DsuAwCgUc9Bh/CbkPYkGhoL3E/480.webp?versionId=JgNpQnTeEx4h7NtDMvPih.nJg..uOVED 640w"
    },
    "views": 2218,
    "video": {
      "id": 80804574,
      "live_stream_id": 85029703,
      "slug": null,
      "thumb": null,
      "s3": null,
      "trading_platform_id": null,
      "created_at": "2025-11-24T21:49:00.000000Z",
      "updated_at": "2025-11-25T02:12:07.000000Z",
      "uuid": "c459e683-7473-4900-b964-de6080f409cc",
      "views": 2218,
      "deleted_at": null,
      "is_pruned": false,
      "is_private": false,
      "status": "public"
    },
    "categories": [
      {
        "id": 10269,
        "category_id": 1,
        "name": "Clair Obscur: Expedition 33",
        "slug": "clair-obscur-expedition-33",
        "tags": ["Role-playing (RPG)"],
        "description": null,
        "deleted_at": null,
        "is_mature": false,
        "is_promoted": false,
        "viewers": 5480,
        "is_fallback": false
      }
    ],
    "channel": {
      "id": 668,
      "user_id": 676,
      "slug": "xqc",
      "is_banned": false,
      "playback_url": "https://fa723fc1b171.us-west-2.playback.live-video.net/api/video/v1/us-west-2.196233775518.channel.DsuAwCgUc9Bh.m3u8",
      "name_updated_at": null,
      "vod_enabled": true,
      "subscription_enabled": true,
      "is_affiliate": false,
      "can_host": true
    }
  }
]
```

**Key Fields**:
- `id`: Unique stream identifier
- `slug`: URL-friendly stream identifier
- `session_title`: Stream title
- `is_live`: Boolean indicating if currently live
- `source`: HLS master playlist URL
- `duration`: Length in milliseconds (0 for live streams)
- `viewer_count`: Current viewers
- `views`: Total view count
- `thumbnail`: Multiple resolution thumbnail URLs
- `categories`: Stream category information
- `channel`: Channel metadata including playback URL

---

## Live Stream Integration

Kick uses Amazon IVS (Interactive Video Service) for live streaming.

### HLS Master Playlist URLs

**Pattern**: `https://{region}.playback.live-video.net/api/video/v1/{region}.{account_id}.channel.{stream_key}.m3u8`

**Example**:
```
https://fa723fc1b171.us-west-2.playback.live-video.net/api/video/v1/us-west-2.196233775518.channel.DsuAwCgUc9Bh.m3u8
```

### Stream Source URLs

**Pattern**: `https://stream.kick.com/{path}/ivs/v1/{account_id}/{stream_key}/{date}/{time}/{session_id}/media/hls/master.m3u8`

**Example**:
```
https://stream.kick.com/3c81249a5ce0/ivs/v1/196233775518/DsuAwCgUc9Bh/2025/11/24/21/48/CbkPYkGhoL3E/media/hls/master.m3u8
```

### HLS Playlist Structure

The master playlist contains multiple quality variants:

```m3u8
#EXTM3U
#EXT-X-SESSION-DATA:DATA-ID="NODE",VALUE="b759bb0429b5.j.cloudfront.hls.live-video.net"
#EXT-X-SESSION-DATA:DATA-ID="BROADCAST-ID",VALUE="316215718106"
#EXT-X-SESSION-DATA:DATA-ID="VIDEO-SESSION-ID",VALUE="4235515547283562914"
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="720p60",NAME="720p60",AUTOSELECT=YES,DEFAULT=YES
#EXT-X-STREAM-INF:BANDWIDTH=3422999,RESOLUTION=1280x720,CODECS="avc1.4D401F,mp4a.40.2",VIDEO="720p60",FRAME-RATE=60.000
https://usw24.playlist.live-video.net/v1/playlist/[playlist_id].m3u8
```

### Supported Quality Levels
- 1080p60 (~9 Mbps)
- 720p60 (~3.4 Mbps)
- 480p30 (~1.4 Mbps)
- 360p30 (~630 kbps)
- 160p30 (~230 kbps)

### Integration Steps

1. **Get Current Live Stream**:
   ```bash
   curl "https://kick.com/api/v2/channels/{channel_slug}/videos" | jq '.[] | select(.is_live == true)'
   ```

2. **Extract Playback URL**:
   ```javascript
   const liveStream = videos.find(v => v.is_live);
   const playbackUrl = liveStream.channel.playback_url;
   ```

3. **Get HLS Master Playlist**:
   ```bash
   curl "{playback_url}"
   ```

4. **Parse Quality Variants**:
   Extract individual stream URLs from master playlist for different quality levels.

---

## Chat & Social Features

### Chat History
**Endpoint**: `GET https://web.kick.com/api/v1/chat/{channel_id}/history`

### Channel Gifts & Leaderboard
**Endpoint**: `GET https://web.kick.com/api/v1/kicks/{channel_id}/pinned-gifts`
**Endpoint**: `GET https://web.kick.com/api/v1/kicks/{channel_id}/leaderboard`

### Current Viewers
**Endpoint**: `GET https://kick.com/current-viewers?ids[]={stream_id}`

**Usage Example**:
```bash
curl "https://kick.com/current-viewers?ids[]=85029703"
```

---

## Discovery & Browse

### Featured Live Streams
**Endpoint**: `GET https://web.kick.com/api/v1/livestreams/featured?language={language}`

**Usage Example**:
```bash
curl "https://web.kick.com/api/v1/livestreams/featured?language=en"
```

**Response Structure**:
```json
{
  "data": {
    "livestreams": [
      {
        "id": "019ab7c8-4145-78a0-bb41-9c1e983ebde7",
        "title": "ARCIN TILL IM BARKIN! LAST FEW STREAM BEFORE I MOVE!",
        "viewer_count": 120,
        "thumbnail": {
          "src": "https://images.kick.com/video_thumbnails/vE7BBxhUope1/uLVc8LWP5D5R/720.webp",
          "srcset": "https://images.kick.com/video_thumbnails/... 1920w, ..."
        },
        "start_time": "2025-11-24T21:32:23Z",
        "channel": {
          "id": 205950,
          "slug": "oakleyboiii",
          "profile_pic": "https://files.kick.com/images/user/208056/profile_image/conversion/783adce5-a32e-445a-bb32-cb0ffd2b72e5-thumb.webp",
          "username": "OakleyBoiii"
        },
        "category": {
          "id": 4472,
          "name": "ARC Raiders",
          "slug": "arc-raiders"
        },
        "language": "en",
        "is_mature": true,
        "tags": []
      }
    ]
  },
  "message": "Success"
}
```

### Drop Campaigns
**Endpoint**: `GET https://web.kick.com/api/v1/drops/campaigns/livestream?channel_id={channel_id}&category_id={category_id}`

---

## Rate Limits & Headers

### Standard Headers Required
```http
accept: application/json
accept-language: en-US,en;q=0.6
cache-control: max-age=0
priority: u=1, i
sec-ch-ua: "Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Windows"
sec-fetch-dest: empty
sec-fetch-mode: cors
sec-fetch-site: same-origin (or same-site for web.kick.com)
sec-gpc: 1
```

### Conditional Requests
Some endpoints support conditional requests with:
```http
if-modified-since: {date_string}
```

### Cookie Requirements
All requests must include browser session cookies:
```bash
-b "session_cookie_name=session_cookie_value"
```

---

## Implementation Example

### Complete Workflow for Getting Live Stream

```javascript
async function getLiveStream(channelSlug) {
  try {
    // 1. Get channel videos
    const response = await fetch(`https://kick.com/api/v2/channels/${channelSlug}/videos`, {
      headers: {
        'accept': 'application/json',
        'Cookie': 'your_session_cookies_here'
      }
    });

    const videos = await response.json();

    // 2. Find current live stream
    const liveStream = videos.find(video => video.is_live);

    if (!liveStream) {
      throw new Error('No live stream found');
    }

    // 3. Get playback URL
    const playbackUrl = liveStream.channel.playback_url;

    // 4. Get HLS master playlist
    const playlistResponse = await fetch(playbackUrl);
    const playlist = await playlistResponse.text();

    // 5. Parse playlist for quality variants
    const qualities = parseHLSPlaylist(playlist);

    return {
      streamInfo: liveStream,
      playbackUrl,
      qualities
    };

  } catch (error) {
    console.error('Error getting live stream:', error);
    throw error;
  }
}

function parseHLSPlaylist(playlistText) {
  const lines = playlistText.split('\n');
  const qualities = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const nextLine = lines[i + 1];
      if (nextLine && nextLine.startsWith('http')) {
        // Parse bandwidth, resolution, codecs from EXT-X-STREAM-INF line
        const bandwidth = line.match(/BANDWIDTH=(\d+)/)?.[1];
        const resolution = line.match(/RESOLUTION=(\d+x\d+)/)?.[1];
        const frameRate = line.match(/FRAME-RATE=(\d+\.\d+)/)?.[1];

        qualities.push({
          url: nextLine,
          bandwidth: parseInt(bandwidth),
          resolution,
          frameRate: parseFloat(frameRate)
        });
      }
    }
  }

  return qualities;
}
```

---

## Security Considerations

1. **Session Management**: API requires valid browser session cookies
2. **Rate Limiting**: Be conservative with request frequency
3. **User-Agent**: Use realistic browser user-agent strings
4. **Authentication**: No explicit API tokens, uses session cookies
5. **CORS**: Proper origin headers required

---

## Data Models

### Stream Model
```typescript
interface Stream {
  id: number;
  slug: string;
  channel_id: number;
  created_at: string;
  session_title: string;
  is_live: boolean;
  start_time: string;
  source: string;
  duration: number;
  language: string;
  is_mature: boolean;
  viewer_count: number;
  views: number;
  thumbnail: Thumbnail;
  categories: Category[];
  channel: Channel;
}
```

### Channel Model
```typescript
interface Channel {
  id: number;
  user_id: number;
  slug: string;
  is_banned: boolean;
  playback_url: string;
  vod_enabled: boolean;
  subscription_enabled: boolean;
  is_affiliate: boolean;
  can_host: boolean;
}
```

### Category Model
```typescript
interface Category {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  tags: string[];
  viewers: number;
  is_mature: boolean;
  is_promoted: boolean;
}
```

---

**⚠️ IMPORTANT**: This documentation is based on reverse-engineered APIs and may change without notice. Use responsibly and in accordance with Kick.com's terms of service.