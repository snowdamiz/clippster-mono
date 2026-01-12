# Twitter Integration Plan (via twitterapi.io)

## Overview

This document outlines the implementation plan for integrating Twitter/X functionality using the third-party **twitterapi.io** service. Unlike Instagram which uses OAuth for user authentication, twitterapi.io is a **data-only API** that uses API key authentication to fetch public Twitter data.

**Key Difference from Instagram:**
- **Instagram**: OAuth flow → User connects their account → Publish content on their behalf
- **Twitter (twitterapi.io)**: API key auth → Fetch public data about any Twitter user → Read-only (no publishing)

---

## API Overview (twitterapi.io)

### Authentication
- **Method**: API Key in header
- **Header**: `x-api-key: YOUR_API_KEY`
- **Base URL**: `https://api.twitterapi.io`

### Pricing
- $0.15/1k tweets
- $0.18/1k user profiles  
- $0.15/1k followers
- Minimum charge: $0.00015 per request

### Available Endpoints

| Endpoint | Method | URL | Description |
|----------|--------|-----|-------------|
| Get User Info | GET | `/twitter/user/info?userName={username}` | Get user profile by username |
| Get Tweets by IDs | GET | `/twitter/tweets?tweet_ids={ids}` | Get tweets by comma-separated IDs |
| Advanced Search | GET | `/twitter/tweet/advanced_search?query={query}` | Search tweets with filters |
| Get User Followers | GET | `/twitter/user/followers?userName={username}` | Get user's followers (200/page) |
| Get User Followings | GET | `/twitter/user/followings?userName={username}` | Get who user follows |
| Get User Tweets | GET | `/twitter/user/tweets?userName={username}` | Get user's recent tweets |

### Response Format (User Profile)
```json
{
  "data": {
    "type": "user",
    "userName": "string",
    "id": "string",
    "name": "string",
    "isBlueVerified": true,
    "profilePicture": "string",
    "coverPicture": "string",
    "description": "string",
    "location": "string",
    "followers": 123,
    "following": 123,
    "mediaCount": 123,
    "statusesCount": 123,
    "createdAt": "string"
  },
  "status": "success"
}
```

### Response Format (Tweets)
```json
{
  "tweets": [{
    "type": "tweet",
    "id": "string",
    "url": "string",
    "text": "string",
    "retweetCount": 123,
    "replyCount": 123,
    "likeCount": 123,
    "quoteCount": 123,
    "viewCount": 123,
    "createdAt": "string",
    "author": { /* user object */ },
    "entities": {
      "hashtags": [],
      "urls": [],
      "user_mentions": []
    }
  }],
  "has_next_page": true,
  "next_cursor": "string"
}
```

---

## Use Cases for Clippster

Since twitterapi.io is read-only, the integration would support:

1. **Creator Discovery**: Search for Twitter users to add as monitored streamers
2. **Profile Enrichment**: Fetch Twitter profile data for creator profiles
3. **Analytics/Insights**: Track follower counts, engagement metrics
4. **Content Research**: Search tweets for trending topics, hashtags
5. **Cross-Platform Linking**: Link Twitter accounts to creator profiles

**NOT Supported** (would need official Twitter API v2 with OAuth):
- Publishing tweets on behalf of users
- Direct messaging
- Account management

---

## Implementation Plan

### Phase 1: Backend - Twitter API Service

#### 1.1 Create Twitter Platform Module
**File**: `server/lib/clippster_server/social/platforms/twitter.ex`

```elixir
defmodule ClippsterServer.Social.Platforms.Twitter do
  @moduledoc """
  Twitter data integration via twitterapi.io
  
  Note: This is a read-only integration using a third-party API.
  Unlike Instagram, this does NOT use OAuth - it uses an API key
  to fetch public Twitter data.
  """
  
  @behaviour ClippsterServer.Social.Platform
  
  @api_base "https://api.twitterapi.io"
  @http_timeout 30_000
  
  # Implement Platform callbacks (some will return :not_supported)
  def platform_id, do: "twitter"
  def platform_name, do: "Twitter"
  
  # OAuth not supported - return error
  def authorize_url(_opts), do: {:error, :not_supported}
  def exchange_code(_code, _opts), do: {:error, :not_supported}
  def refresh_tokens(_token), do: {:error, :not_supported}
  
  # Publishing not supported
  def publish_media(_token, _url, _opts), do: {:error, :not_supported}
  
  # Read operations - use API key from config
  def get_user_profile(username) do
    api_key = get_api_key()
    # GET /twitter/user/info?userName={username}
  end
  
  def get_user_tweets(username, opts \\ []) do
    # GET /twitter/user/tweets
  end
  
  def search_tweets(query, opts \\ []) do
    # GET /twitter/tweet/advanced_search
  end
  
  def get_user_followers(username, opts \\ []) do
    # GET /twitter/user/followers
  end
end
```

#### 1.2 Create Twitter Controller
**File**: `server/lib/clippster_server_web/controllers/twitter_controller.ex`

```elixir
defmodule ClippsterServerWeb.TwitterController do
  @moduledoc """
  Controller for Twitter data endpoints.
  Proxies requests to twitterapi.io with our API key.
  """
  
  use ClippsterServerWeb, :controller
  
  alias ClippsterServer.Social.Platforms.Twitter
  
  # GET /api/twitter/user/:username
  def get_user(conn, %{"username" => username})
  
  # GET /api/twitter/user/:username/tweets
  def get_user_tweets(conn, %{"username" => username})
  
  # GET /api/twitter/search
  def search_tweets(conn, %{"query" => query})
  
  # GET /api/twitter/user/:username/followers
  def get_user_followers(conn, %{"username" => username})
end
```

#### 1.3 Add Routes
**File**: `server/lib/clippster_server_web/router.ex`

```elixir
scope "/api/twitter", ClippsterServerWeb do
  pipe_through [:api, :require_auth]
  
  get "/user/:username", TwitterController, :get_user
  get "/user/:username/tweets", TwitterController, :get_user_tweets
  get "/user/:username/followers", TwitterController, :get_user_followers
  get "/search", TwitterController, :search_tweets
end
```

#### 1.4 Configuration
**File**: `server/config/runtime.exs`

```elixir
config :clippster_server, :twitter,
  api_key: System.get_env("TWITTER_API_IO_KEY"),
  api_base: "https://api.twitterapi.io"
```

---

### Phase 2: Frontend - Twitter API Service

#### 2.1 Create Twitter API Service
**File**: `client/src/services/twitterApi.ts`

```typescript
/**
 * Twitter API service using twitterapi.io
 * Read-only access to public Twitter data
 */

export interface TwitterUser {
  id: string;
  userName: string;
  name: string;
  isBlueVerified: boolean;
  profilePicture: string;
  coverPicture: string;
  description: string;
  location: string;
  followers: number;
  following: number;
  mediaCount: number;
  statusesCount: number;
  createdAt: string;
}

export interface Tweet {
  id: string;
  url: string;
  text: string;
  retweetCount: number;
  replyCount: number;
  likeCount: number;
  quoteCount: number;
  viewCount: number;
  createdAt: string;
  author: TwitterUser;
}

// API functions
export async function getTwitterUser(username: string): Promise<TwitterUser>
export async function getUserTweets(username: string, cursor?: string): Promise<{tweets: Tweet[], nextCursor?: string}>
export async function searchTweets(query: string, opts?: SearchOptions): Promise<{tweets: Tweet[], nextCursor?: string}>
export async function getUserFollowers(username: string, cursor?: string): Promise<{followers: TwitterUser[], nextCursor?: string}>
```

---

### Phase 3: UI Integration

#### 3.1 Twitter Profile Lookup Component
**File**: `client/src/components/TwitterProfileLookup.vue`

A component to search and display Twitter user profiles, useful for:
- Adding Twitter handle to creator profiles
- Discovering new creators to monitor
- Viewing Twitter stats alongside other platform stats

#### 3.2 Integrate with Creator Profiles
**File**: `client/src/pages/ClipperProfileEditPage.vue`

Add Twitter username field and display fetched Twitter stats:
- Follower count
- Tweet count
- Verification status
- Profile picture sync option

#### 3.3 Cross-Platform Analytics Dashboard
Show Twitter metrics alongside Instagram/TikTok/YouTube stats for creators.

---

### Phase 4: Database Schema (Optional)

If caching Twitter data locally:

**Migration**: `server/priv/repo/migrations/XXXXXX_add_twitter_profiles.exs`

```elixir
create table(:twitter_profiles) do
  add :twitter_user_id, :string, null: false
  add :username, :string, null: false
  add :display_name, :string
  add :profile_image_url, :string
  add :followers_count, :integer
  add :following_count, :integer
  add :tweet_count, :integer
  add :is_verified, :boolean, default: false
  add :last_fetched_at, :utc_datetime
  
  # Link to creator profile if applicable
  add :creator_profile_id, references(:creator_profiles, on_delete: :nilify_all)
  
  timestamps()
end

create unique_index(:twitter_profiles, [:twitter_user_id])
create index(:twitter_profiles, [:username])
create index(:twitter_profiles, [:creator_profile_id])
```

---

## Comparison: Instagram vs Twitter Integration

| Aspect | Instagram | Twitter (twitterapi.io) |
|--------|-----------|------------------------|
| **Auth Type** | OAuth 2.0 (user login) | API Key (server-side) |
| **User Connection** | User connects their account | No user connection needed |
| **Data Access** | User's own data only | Any public profile/tweets |
| **Publishing** | ✅ Post images, videos, reels | ❌ Read-only |
| **Token Management** | Access/refresh tokens per user | Single API key for all requests |
| **Rate Limits** | Per-user limits | QPS-based (200 QPS max) |
| **Cost Model** | Free (within Meta limits) | Pay-per-request |
| **Use Case** | Publish clips to user's IG | Fetch creator data, analytics |

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `server/lib/clippster_server/social/platforms/twitter.ex` | Twitter API client |
| `server/lib/clippster_server_web/controllers/twitter_controller.ex` | API endpoints |
| `client/src/services/twitterApi.ts` | Frontend API service |
| `client/src/components/TwitterProfileLookup.vue` | Profile search UI |

### Modified Files
| File | Changes |
|------|---------|
| `server/lib/clippster_server/social/platform.ex` | Add twitter to `get_platform_module/1` |
| `server/lib/clippster_server_web/router.ex` | Add Twitter routes |
| `server/config/runtime.exs` | Add Twitter API config |
| `client/src/pages/ClipperProfileEditPage.vue` | Add Twitter field |

---

## Environment Variables

```bash
# Add to server/.env
TWITTER_API_IO_KEY=your_api_key_here
```

---

## Estimated Effort

| Phase | Effort | Description |
|-------|--------|-------------|
| Phase 1 | 3-4 hours | Backend Twitter service + controller |
| Phase 2 | 2-3 hours | Frontend API service |
| Phase 3 | 3-4 hours | UI components |
| Phase 4 | 1-2 hours | Database schema (optional) |

**Total: ~9-13 hours**

---

## Future Considerations

1. **Official Twitter API v2**: If publishing is needed, would require:
   - Twitter Developer account
   - OAuth 2.0 PKCE flow (similar to Instagram)
   - New platform module for official API

2. **Rate Limiting**: Implement request caching to reduce API costs

3. **Webhook Support**: twitterapi.io may offer webhooks for real-time updates

4. **Cost Monitoring**: Track API usage to manage costs ($0.15-0.18 per 1k requests)
