# Transcript-Based Search for My Clips (Clips.vue)

## Goal
Enable the My Clips page (`client/src/pages/Clips.vue`) to search clips by transcript content so users can find clips based on what the streamer said.

## Current state
- **My Clips search behavior**: Client-side filter on clip name and project name only (@client/src/pages/Clips.vue#897-909).
- **Transcripts exist**:
  - Server runs Whisper and stores transcripts with segments/words/timestamps (@server/lib/clippster_server_web/controllers/clips_controller.ex).
  - Clip validation uses word/segment timestamps (@server/lib/clippster_server/clip_validation.ex#64-100).
  - Client DB has `transcripts`, `transcript_segments`, and an FTS virtual table `transcripts_fts`, with CRUD/search helpers (@client/src/services/database/transcripts.ts#4-108).
  - Editor loads and renders transcripts (words/segments) via `useTranscriptData` and `TranscriptTab` (@client/src/components/clip-editor/tabs/TranscriptTab.vue).
  - Clip segment edits split/realign transcript data (@client/src/services/database/clip-segments.ts).
- **Gap**: The My Clips listing/search does not query transcripts; it only filters on in-memory clip/build data.

## What we want
Search box should return clips/build cards whose transcripts contain the query (words/phrases), ranked by relevance, and still respect existing filters (project, aspect ratio, status, sort).

## Proposed approach (MVP with server-backed search)
1) **Backend search endpoint**
   - `GET /clips/search?q=...&project=...&aspect_ratio=...&page=...&page_size=...&sort=...&include_snippets=true`
   - Performs full-text search over transcript text (and optionally clip name/project name) and returns:
     - `clip_id`, `build_id` (or file path), `score`, `created_at`, `aspect_ratio`, `project_id/project_name`
     - Optional `snippets`: array of `{ text, start_ms, end_ms }` for highlight/seek.
     - `total`, `has_more`, `page`, `page_size`
   - Sort: if `q` present → relevance default; allow override (created desc/asc, name, duration).

2) **Indexing strategy**
   - **Small/medium**: Postgres FTS (tsvector on transcript text + clip name/project name). Add GIN index; store transcript text in table, plus optional segment times for snippets.
   - **If needed later**: Switch to Meilisearch/Typesense/Elasticsearch for fuzzy/typo tolerance and built-in highlighting.
   - Upsert index on build completion or transcript update (webhook/job).

3) **Transcript source of truth**
   - Prefer per-build transcript (post-trim) so snippets align with the rendered clip.
   - If only source-VOD transcript exists, map timecodes to clip ranges or store both.

4) **Frontend integration (Clips.vue)**
   - When `searchQuery` is empty: keep current client-side filtering/sorting on `displayableBuilds`.
   - When `searchQuery` is non-empty: call `/clips/search` (debounced), passing current filters (project, aspect ratio, status) and sort. Render returned results instead of local filter.
   - Respect existing pagination UI; backend provides paged results.
   - Relevance sort shown when searching; allow switching sort (created, name, duration).
   - Optional: display 1–2 highlighted snippets under each card; clicking a timestamp seeks the player to that time if supported.

5) **Permissions/tenancy**
   - Search must scope to clips the user can access (user/org). If multi-tenant index, namespace documents per org/user.

## Data model notes
- Index fields: `clip_id`, `build_id`, `clip_name`, `project_id/name`, `aspect_ratio`, `created_at`, `transcript_text`, optional `segments` (start/end/text) for snippets.
- Large VODs: consider storing trimmed transcript per build; keep raw transcript elsewhere.
- Languages: ensure tokenizer supports expected languages; store language field.

## UX details
- Loading state: “Searching transcripts…” when `q` is active.
- Empty state: “No clips match this transcript search.”
- Snippets (optional but recommended): show matched text with timestamp badge (e.g., `02:13`); clicking seeks.
- Keep existing filters: project, aspect ratio, status (status remains trivial here: generated-only).

## Performance & ops
- Debounce client queries (e.g., 300ms).
- Paginate results; limit page_size (e.g., 20–50).
- Monitor index drift; add retry job on transcript/build updates.
- Consider FTS normalization (unaccent, lowercase) and phrase search.

## Rollout plan
1) Add backend search endpoint using Postgres FTS (relevance + filters + snippets).
2) Index/update on build completion or transcript edits.
3) Wire Clips.vue to call the endpoint when `searchQuery` is set; keep local mode otherwise.
4) Add snippet display and timestamp seek (if player supports deep link).
5) Instrument and monitor query latency and result quality; iterate on scoring/fuzziness.

## Open questions
- Do we store per-build (trimmed) transcripts, or only source-VOD transcripts? If only source, how to map timecodes to builds for snippet/seek?
- Do we need typo tolerance/fuzzy search in MVP, or is exact/phrase search sufficient?
- Any org-level privacy/tenancy constraints beyond current user/org scoping?
