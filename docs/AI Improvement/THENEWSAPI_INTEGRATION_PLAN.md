# TheNewsAPI Integration for Breaking News Clip Detection

Integrate TheNewsAPI to enhance clip detection by providing real-time breaking news context every 20 minutes, helping identify when streamers discuss major world events, celebrity news, political developments, and other headline-making stories.

## Overview

TheNewsAPI will be used to:
- Fetch breaking/world news every 20 minutes (72 requests/day, leaving 28 for retries/manual triggers)
- Store articles in database with relevance scoring (recency-based)
- Pass top news context to AI prompts during VOD and real-time clip detection
- Boost virality scores when streamers discuss breaking news

## Key Constraints

- **100 requests/day limit** - Fetch every 20 minutes = 72 requests, 28 buffer
- **Free plan** - Use `/v1/news/top` and `/v1/news/all` endpoints (no `/headlines`)
- **Server-side only** - API key stored on backend, news fetched via scheduled job
- **Context injection** - News data passed to existing AI detection prompts

## How News Context Flows to AI and Back to Client

### Complete Data Flow
```
1. [Scheduled Job: Every 20 min]
       ↓
2. [Fetch from TheNewsAPI] → Store in news_articles table with relevance score
       ↓
3. [Client requests clip detection] → POST /clips/detect-chunked or /clips/detect
       ↓
4. [Server: clips_controller.ex]
       ↓
5. [Get recent high-scoring news] → News.get_formatted_context(hours: 24, min_score: 0.5)
       ↓
6. [Inject into system_prompt] → enhanced_system_prompt = system_prompt <> "\n\n" <> news_context
       ↓
7. [Pass to AI detection] → OpenRouterAPI.generate_clips(transcript, enhanced_system_prompt, user_prompt)
       ↓
8. [AI receives transcript + news context] → Analyzes content, boosts scores for news-related clips
       ↓
9. [AI returns JSON response] → {"clips": [...], "extensions": [...]}
       ↓
10. [Server validates & formats] → Adds validation, quality scores, processing info
       ↓
11. [Server returns to client] → json(conn, %{success: true, clips: %{"clips" => final_clips}, ...})
       ↓
12. [Client receives response] → response.data in useChunkedClipDetection.ts
       ↓
13. [Client persists to SQLite] → persistClipDetectionResults(projectId, prompt, result)
       ↓
14. [Client displays clips] → UI shows detected clips with virality scores
```

### Key Point: News Context is INVISIBLE to Client

**Important:** The news context is injected server-side into the AI prompt. The client never sees the actual news articles. Here's what happens:

1. **Server-side only:** News articles are fetched, stored, and formatted on the server
2. **Prompt injection:** News context is appended to the system prompt before calling the AI
3. **AI processing:** The AI model sees the news context and uses it to inform clip detection
4. **Response format:** The AI returns standard clip JSON (title, description, virality_score, etc.)
5. **Client receives:** Standard clip data - no news articles in the response

**Example:**
```javascript
// Client sends (no news data):
POST /clips/detect-chunked
{
  prompt: "Detect viral moments",
  chunks: [...]
}

// Server internally enhances prompt with news:
system_prompt = SystemPrompt.get() + "\n\n" + 
  "🌍 BREAKING NEWS: Trump sends troops to Iran (15 min ago)..."

// AI sees enhanced prompt, returns standard clips:
{
  "clips": [
    {
      "title": "Streamer Reacts to Iran News",
      "virality_score": 95,  // ← Boosted because AI saw news context
      "reason": "Breaking news reaction"
    }
  ]
}

// Client receives (no news data):
response.data = {
  success: true,
  clips: { clips: [...] },
  transcript: "...",
  validation: {...}
}
```

The news context influences the AI's decisions (virality scores, detection reasons) but doesn't appear in the client response.

### Integration Points

**1. VOD Detection (`detect_chunked/2`):**
```elixir
# In clips_controller.ex, line ~433
system_prompt = SystemPrompt.get()

# NEW: Fetch and format news context
news_context = News.get_formatted_context(hours: 24, min_score: 0.5)

# NEW: Inject news into system prompt
enhanced_system_prompt = system_prompt <> "\n\n" <> news_context

# Pass to standard single-model detection
process_chunks_parallel_normal(
  sorted_chunks,
  enhanced_system_prompt,  # ← News context included here
  user_prompt,
  project_id,
  user_id
)
```

**2. Real-time Detection (`detect_realtime/2`):**
```elixir
# In clips_controller.ex, line ~3409
system_prompt = SystemPrompt.get()

# NEW: Fetch recent breaking news (last 6 hours for real-time)
news_context = News.get_formatted_context(hours: 6, min_score: 0.6)

# NEW: Append to formatted_transcript
formatted_transcript = """
TRANSCRIPT (#{transcript_start}s - #{transcript_end}s):
#{transcript}#{audio_info}#{pending_clip_context}

#{news_context}

You are a clip detector analyzing livestream content...
"""

# AI receives transcript with news context embedded
OpenRouterAPI.generate_clips(formatted_transcript, system_prompt, user_prompt)
```

**3. News Context Format (passed to AI):**
```
🌍 BREAKING NEWS CONTEXT (last 6 hours):

1. "President announces military deployment to Iran" (World, 15 min ago, Score: 0.95)
2. "Celebrity actor dies at age 45" (Entertainment, 2 hours ago, Score: 0.85)
3. "Stock market crashes 800 points" (Business, 4 hours ago, Score: 0.70)

⚡ DETECTION BOOST: If the streamer discusses ANY of these topics, this is likely a HIGH-VALUE clip. Increase virality score by +10-15 points. Reactions to breaking news are highly shareable.
```

## Architecture

### 1. Server-Side News Pooling Service

**New Module:** `server/lib/clippster_server/news/news_api.ex`
- HTTP client using HTTPoison (already in use across codebase)
- Fetch breaking news from TheNewsAPI endpoints:
  - `/v1/news/top` - Top stories (free plan compatible)
  - `/v1/news/all` - All news with filters (free plan compatible)
- Parameters: `api_token`, `language=en`, `categories=general`, `limit=50`
- Cache responses in database to avoid re-fetching

**New Schema:** `server/priv/repo/migrations/XXX_create_news_articles.exs`
```elixir
create table(:news_articles) do
  add :uuid, :string, null: false
  add :title, :string, null: false
  add :description, :text
  add :url, :string
  add :image_url, :string
  add :published_at, :utc_datetime
  add :source, :string
  add :categories, {:array, :string}
  add :keywords, {:array, :string}
  add :relevance_score, :float, default: 0.0
  add :is_breaking, :boolean, default: false
  timestamps()
end

create unique_index(:news_articles, [:uuid])
create index(:news_articles, [:published_at])
create index(:news_articles, [:is_breaking])
```

**New Context Module:** `server/lib/clippster_server/news.ex`
- `fetch_and_store_news/0` - Fetch from API, store in DB with deduplication
- `get_recent_news/1` - Get news from last N hours with min score filter
- `get_formatted_context/1` - Format news list for AI context (main function)
- `cleanup_old_articles/0` - Delete articles older than 48 hours
- `get_api_usage_today/0` - Track daily request count

### 2. Scheduled News Fetching

**Update:** `server/lib/clippster_server/application.ex`
- Add Quantum scheduler (or Oban job) to fetch news **every 20 minutes**
- 72 fetches/day = 72 requests, leaves 28 for retries/manual triggers
- Runs 24/7 to stay on top of breaking news

**Job Configuration:**
- Fetch 50 articles per request (maximize data per fetch)
- Endpoint: `/v1/news/top` and `/v1/news/all` (free plan)
- Parameters: `language=en`, `categories=general` (covers world news, politics, major events)
- Store with relevance scoring based on:
  - **Recency:** Last 1hr=1.0, 1-6hr=0.8, 6-12hr=0.6, 12-24hr=0.4, 24-48hr=0.2
  - **Keywords:** +0.1 each for "breaking", "just in", "announced", "dies", "war", "attack"
  - **Deduplication:** Skip if article UUID already exists in database

### 3. AI Prompt Context Injection

**Update System Prompt:** `server/lib/clippster_server/ai/system_prompt.ex`
Add new section:
```
**BREAKING NEWS CONTEXT:**
When streamers discuss current events, these clips have higher viral potential.
Recent breaking news (last 24 hours):
{news_context}

If the transcript mentions any of these topics, INCREASE virality score by +10-15 points.
Reactions to breaking news are highly shareable.
```

**Update Controllers:**

1. **VOD Detection:** `clips_controller.ex` - `detect_chunked/2`
   - Before calling AI: `news_context = News.format_for_ai_prompt(News.get_recent_news(24))`
   - Inject into system prompt or user prompt

2. **Real-time Detection:** `clips_controller.ex` - `detect_realtime/2`
   - Same approach, but use last 6 hours: `News.get_recent_news(6)`
   - More recent news = more likely streamer is reacting live

**Format Example:**
```
BREAKING NEWS CONTEXT (last 24 hours):
- "Major tech company announces layoffs affecting 10,000 employees" (Technology, 2 hours ago)
- "Celebrity couple announces divorce after 15 years" (Entertainment, 5 hours ago)
- "Stock market hits record high amid economic concerns" (Business, 8 hours ago)

If transcript discusses these topics, this is likely a high-value clip.
```

### 4. Environment Configuration

**Update:** `server/.env.example`
```bash
# TheNewsAPI (breaking news context for clip detection)
THENEWSAPI_KEY=your_api_key_here
THENEWSAPI_BASE_URL=https://api.thenewsapi.com/v1
```

**Update:** `server/config/runtime.exs`
```elixir
config :clippster_server, :news_api,
  api_key: System.get_env("THENEWSAPI_KEY"),
  base_url: System.get_env("THENEWSAPI_BASE_URL", "https://api.thenewsapi.com/v1"),
  fetch_interval_minutes: 20,
  retention_hours: 48,
  articles_per_fetch: 50
```

### 5. Admin Controls Interface

**New Admin Panel Page:** `/admin/news`

**Features:**
1. **News Dashboard:**
   - Display all cached articles (last 48 hours)
   - Show article: title, source, published time, relevance score, categories
   - Filter by: time range, score threshold, keywords
   - Search functionality

2. **API Usage Monitor:**
   - Display: "API Requests Today: 45/100"
   - Show request history (timestamps of last 20 fetches)
   - Warning when approaching limit (>90 requests)

3. **Manual Controls:**
   - "Fetch Now" button - Manually trigger news fetch (counts against daily limit)
   - Confirmation dialog: "This will use 1 of your 100 daily requests. Continue?"
   - Shows last fetch time: "Last fetched: 12 minutes ago"

4. **Article Management:**
   - Delete individual articles (if irrelevant)
   - Bulk delete by criteria (e.g., delete all articles >24 hours old)
   - Mark articles as "pinned" (always include in AI context regardless of score)

5. **Statistics:**
   - Total articles cached: 150
   - Average relevance score: 0.72
   - Most common categories: World (45%), Entertainment (30%), Business (25%)
   - Clips detected with news context: 23 (last 24 hours)

**Implementation:**
- New controller: `server/lib/clippster_server_web/controllers/admin/news_controller.ex`
- New routes in `router.ex` under `/admin` scope
- Frontend: Add admin page in client (Vue component)

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create news_articles schema and migration
2. Create `ClippsterServer.News` context module
3. Create `ClippsterServer.News.NewsAPI` HTTP client
4. Add environment variables

### Phase 2: Scheduled Fetching
1. Add Quantum/Oban job for scheduled fetching
2. Implement fetch_and_store_news with deduplication
3. Add logging and error handling
4. Test with TheNewsAPI sandbox/free tier

### Phase 3: AI Integration
1. Update SystemPrompt with news context section
2. Modify detect_chunked to inject news context
3. Modify detect_realtime to inject news context
4. Test with sample news data

### Phase 4: Admin Interface
1. Create admin news controller and routes
2. Build Vue admin panel page
3. Add API usage tracking and display
4. Implement manual fetch and article management features
5. Add statistics dashboard

## API Request Budget (20-Minute Intervals)

- **Scheduled fetches:** 72/day (every 20 minutes)
- **Buffer for retries/failures:** 20 requests
- **Manual admin triggers:** 8 requests
- **Total:** 100 requests/day

**Daily Schedule Example:**
- 00:00, 00:20, 00:40, 01:00... (72 fetches across 24 hours)
- Each fetch retrieves 50 articles
- Database stores ~150-200 unique articles at any time (after deduplication)

## News Relevance Scoring System

**What is relevance scoring?**
When we store news articles, we calculate a score (0.0 to 1.0) for each article based on how recent and important it is. This helps us prioritize which articles to show the AI.

**Scoring Formula:**
- **Recency (base score):** 
  - Last 1hr = 1.0 (very fresh)
  - 1-6hr = 0.8 (recent)
  - 6-12hr = 0.6 (somewhat recent)
  - 12-24hr = 0.4 (older)
  - 24-48hr = 0.2 (stale)
- **Breaking news bonus:** +0.2 if article marked as breaking
- **Major event keywords:** +0.1 each for: "breaking", "dies", "dead", "war", "attack", "troops", "military", "announces", "confirmed", "just in"
- **Celebrity/political keywords:** +0.05 each for: "president", "celebrity", "star", "senator", "congress"

**Why use scoring?**
- Prevents overwhelming AI with 200+ articles
- Only passes high-quality, recent news (score ≥0.5)
- Keeps AI prompts concise and focused on major headlines
- Example: "Trump sends troops to Iran" (15 min old) = score 1.0 + 0.2 (breaking) + 0.2 (keywords) = **1.4** (capped at 1.0) ✅ Passed to AI
- Example: "Local weather update" (20 hours old) = score 0.4 + 0.0 = **0.4** ❌ Not passed to AI

## Error Handling

- **API rate limit hit:** Log warning, skip fetch, continue with cached data
- **API timeout:** Retry once with exponential backoff, then skip
- **Invalid response:** Log error, skip storage, alert admin
- **Database errors:** Log error, continue detection without news context

## Testing Strategy

1. **Unit tests:** NewsAPI client with mocked responses
2. **Integration tests:** Full fetch→store→format pipeline
3. **AI tests:** Verify news context improves detection accuracy
4. **Load tests:** Ensure no performance impact on clip detection

## Success Metrics

- News context injected into 100% of detection requests
- Average news articles cached: 50-100 at any time
- API requests stay under 100/day limit
- Clip detection with news context shows +5-10% virality score improvement on news-related clips

## Files to Create

- `server/lib/clippster_server/news.ex` (context)
- `server/lib/clippster_server/news/news_api.ex` (HTTP client)
- `server/lib/clippster_server/news/article.ex` (schema)
- `server/priv/repo/migrations/XXX_create_news_articles.exs`
- `server/test/clippster_server/news_test.exs`

## Files to Modify

- `server/.env.example`
- `server/config/runtime.exs`
- `server/lib/clippster_server/application.ex`
- `server/lib/clippster_server/ai/system_prompt.ex`
- `server/lib/clippster_server_web/controllers/clips_controller.ex`

## Questions for User

1. **News categories:** Which categories are most relevant? (general, business, entertainment, sports, technology, science, health)
2. **Fetch frequency:** Is 6 hours optimal, or should we fetch more/less frequently?
3. **Retention period:** Keep news for 48 hours or longer/shorter?
4. **Admin controls:** Should admins be able to manually curate/filter news?
5. **Platform-specific news:** Should we filter news by streaming platform (e.g., gaming news for Twitch, IRL news for Kick)?
