# Streamer discovery → Clippster clips → review drafts

A resumable Node 24 command-line tool for the requested Twitch/Kick outreach workflow. No extra npm packages are needed.

- Find low-viewer Twitch and Kick livestreams, defaulting to **5–100 current viewers**.
- Search X for posts asking for clippers over the **last 60 days**, including pagination and author-profile channel links.
- Choose up to **150 streamers**, configurable from 1–200; prioritize people explicitly asking for clippers.
- Import an eligible completed recording into the existing Clippster web workspace, use Clippster's AI detection, and render **1–3 MP4 clips per streamer**.
- Save the MP4s, project metadata, evidence, contact candidates, and **email, X message, and post drafts** in a local review page.

**Nothing is emailed, messaged, uploaded for publication, or posted.** Drafts include attachment placeholders for your review. No sending credentials are needed.

## 1. Put your keys here

From the repository root:

```sh
node scripts/streamer-outreach/cli.mjs init
```

Edit **`scripts/streamer-outreach/.env`**:

```dotenv
X_BEARER_TOKEN=your_x_bearer_token

TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret

KICK_CLIENT_ID=your_kick_client_id
KICK_CLIENT_SECRET=your_kick_client_secret

CLIPPSTER_API_URL=http://127.0.0.1:4000/api
CLIPPSTER_WORKSPACE_URL=http://127.0.0.1:8090/api
CLIPPSTER_ACCOUNT_ORIGIN=http://localhost:5173
CLIPPSTER_EMAIL=your_clippster_email
CLIPPSTER_PASSWORD="your_clippster_password"
```

For X, use **Developer Console → your app → Keys and tokens → Bearer Token**. The API Key/API Key Secret are different credentials; paste the Bearer Token into `X_BEARER_TOKEN`. A 60-day search uses `/2/tweets/search/all` and requires full-archive access. The tool reports missing access instead of quietly substituting a seven-day search. X reads can incur charges according to your developer account; `doctor` performs a small search of up to ten results. [X bearer token setup](https://docs.x.com/fundamentals/authentication/oauth-2-0/bearer-tokens), [X search access](https://docs.x.com/x-api/posts/search/introduction).

Create the Twitch app at [Twitch Developer Console](https://dev.twitch.tv/console/apps), and the Kick app through [Kick's app setup](https://docs.kick.com/getting-started/kick-apps-setup). The script obtains and renews app tokens using client credentials. Alternatively set `TWITCH_ACCESS_TOKEN` (with `TWITCH_CLIENT_ID`) and/or `KICK_ACCESS_TOKEN`; replace these supplied tokens yourself when they expire. [Twitch authentication](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/), [Kick authentication](https://docs.kick.com/getting-started/generating-tokens-oauth2-flow).

The `.env` and generated campaign directory are ignored by Git. `init` preserves existing files and sets new configuration files to owner-only permissions. Shell environment variables override the `.env` file. Quote values containing spaces or `#`. The script does not read any other project's secret files.

## 2. Have the Clippster workspace running

Discovery can run on its own. Rendering uses the existing [web media service](../../apps/web/README.md), which provides yt-dlp, FFmpeg, authentication, AI integration, and account credits. Start the normal stack with `yarn dev`, or start Phoenix and the web container with `yarn server` and `yarn web` in separate terminals. See the web README for its first-time setup.

The defaults above target local development. For a hosted account, point `CLIPPSTER_API_URL` at the same Phoenix API that the workspace uses, for example `https://api.clippster.app/api`. `CLIPPSTER_WORKSPACE_URL` is the **media service API**, not the Phoenix API: a deployment using the website proxy can use `https://clippster.app/workspace/api`. Verify that this workspace is deployed and configured before running. `CLIPPSTER_ACCOUNT_ORIGIN` must exactly match that service's `ACCOUNT_ORIGIN`, for example `https://clippster.app`.

Sign in with an existing verified account. An account using Google sign-in can instead supply `CLIPPSTER_API_TOKEN`, an existing account JWT, and leave email/password blank. For the website account dashboard, this is the `auth_token` entry in browser developer tools → Application/Storage → Local Storage for the account origin. Treat it like a password. The script exchanges the JWT for a normal workspace cookie; it does not bypass authentication. Secrets and session cookies are not written into campaign state.

Bulk processing needs sufficient account credits and download/build allowances. Clippster's existing limits still apply: public completed recordings up to two hours and 2 GB, a 10 GB workspace allowance, and 20 stored projects. The script looks through the latest 20 recordings for one within the configured duration limit. It skips channels without an eligible recording and reports source/provider failures. It does not record live streams or bypass private/deleted/blocked sources. Kick recording lookup uses Clippster's existing `/media/vods` resolver; that server needs its normal yt-dlp configuration and, if its fallback is used, its configured `RAPID_API_KEY`.

## 3. Configure the campaign

Edit **`scripts/streamer-outreach/config.json`**, created by `init`. A few useful settings:

| Setting                            | Default                   | Meaning                                                                                                                                  |
| ---------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `sources`                          | `["twitch", "kick", "x"]` | Discovery sources. Use `["x"]` for X-only research.                                                                                      |
| `targetStreamers`                  | `150`                     | Maximum selected channels to attempt, 1–200. Successful clip count may be smaller.                                                       |
| `minViewers`, `maxViewers`         | `5`, `100`                | Live viewer snapshot, not average audience or follower count.                                                                            |
| `languages`                        | `["en"]`                  | Twitch/Kick stream language filters; `[]` includes all.                                                                                  |
| `twitchGameIds`, `kickCategoryIds` | `[]`                      | Optional category filters to narrow discovery.                                                                                           |
| `streamPageLimit`                  | `300`                     | Maximum pages per stream platform.                                                                                                       |
| `xDays`                            | `60`                      | Historical window, frozen at campaign creation.                                                                                          |
| `xPageLimit`                       | `100`                     | Maximum X pages, 100 posts/page; a cap is reported as partial coverage.                                                                  |
| `xQuery`                           | Clip-request phrases      | Edit the phrases or add `lang:en` to narrow X results.                                                                                   |
| `clipsPerStreamer`                 | `3`                       | Maximum rendered clips, 1–3; fewer may meet the length limits.                                                                           |
| `minClipSeconds`, `maxClipSeconds` | `15`, `90`                | Eligible detected highlight lengths.                                                                                                     |
| `maxSourceSeconds`                 | `7200`                    | Maximum recording length; reduce for a cheaper pilot.                                                                                    |
| `aspectRatio`, `captions`          | `"9:16"`, `true`          | Vertical video, with captions when the model returns word timings. `"16:9"` is also supported.                                           |
| `archiveCompletedProjects`         | `true`                    | Save clips and edit metadata locally, verify hashes, then delete this campaign's temporary workspace project to free its source/storage. |
| `outputDir`                        | `"./output"`              | Campaign files; relative to the config file's directory.                                                                                 |

**Archiving is how the batch stays below the 20-project cap.** The local MP4s, source URL, and `project.json` remain available. Full source recordings and temporary workspace entries are removed; these are not desktop-library imports. Existing unrelated projects are never selected for cleanup. Set `archiveCompletedProjects` to `false` to retain projects in the web library, and run a small enough batch for your available slots/storage. Failed projects are kept for inspection and may need manual cleanup before a large batch can finish.

Twitch lists streams by viewer count descending, so finding small streamers can require many pages. Kick uses the current paginated **`/public/v2/livestreams`** endpoint. Both APIs expose a changing view, so deduplication is necessary. Viewer counts do not prove historical audience size. [Twitch pagination](https://dev.twitch.tv/docs/api/guide#pagination), [Kick livestream API](https://docs.kick.com/apis/livestreams).

X searches save every returned matching post, even if no channel can be resolved. Only channel links published on the author's profile are automatically associated with that author; links mentioned solely in a post remain review candidates. X-only prospects have unknown audience size unless found in the livestream scan. The script never guesses that an X username matches a Twitch/Kick username, never invents emails, and does not crawl arbitrary linked websites. Keyword matches can include recruiters, jokes, or offers rather than requests; inspect the saved post before outreach. This is a query-based search of accessible public posts, not a guarantee of every clipper request on X.

## 4. Run it

```sh
# Check credentials and services; does not import or start AI jobs.
node scripts/streamer-outreach/cli.mjs doctor

# Discovery only: no Clippster login/credits required.
node scripts/streamer-outreach/cli.mjs discover

# Process the selected channels and prepare all drafts.
node scripts/streamer-outreach/cli.mjs clips

# Or do both in one command; re-running resumes the campaign.
node scripts/streamer-outreach/cli.mjs run

# Open the finished review page on macOS.
open scripts/streamer-outreach/output/review.html
```

You can also use `yarn streamer-outreach <command>`. Start with a new campaign configured for `targetStreamers: 2` and `clipsPerStreamer: 1` to verify live-provider behavior and clip quality with your credentials.

For X research alone, set `sources` to `["x"]`, fill in only `X_BEARER_TOKEN`, and run `discover`. Twitch/Kick credentials are only needed later if you choose to render clips from those channels. `doctor` checks Clippster too, so missing Clippster credentials can be ignored for discovery-only use.

Output:

```text
output/
  review.html                  Searchable local review page, MP4 players, drafts
  leads.json                   Channels, viewer observations, contact evidence, status
  x-posts.json                 Matching posts, author info, unresolved/mentioned channels
  drafts.json                  Email recipients, attachment paths, X text, captions
  drafts.txt                   Copyable email/X/post text
  state.json                   Durable progress, frozen config, server job IDs
  clips/twitch-channel/
    clip-01.mp4
    clip-02.mp4
    clip-03.mp4
    project.json               Source URL, clip segments, and workspace edit metadata
```

Draft attachment paths are relative to `outputDir`. Email and X drafts need you to choose/review the recipient and attach the MP4 files or provide your own public download link. Private workspace download URLs are never presented as public sharing links. Posting drafts include channel attribution. The tool does not automatically submit any of these drafts to external accounts.

## Resume and troubleshoot

Re-run the same command with the same config/output directory. HTTP reads have bounded retries and honor short rate-limit waits. Long cooldowns are reported so you can resume later. X pagination and its date window are checkpointed after every page. Once clipping starts, the selected batch stays fixed.

AI/import/build submissions are recorded before sending. If a response is lost, the script looks for the corresponding server job instead of submitting it again. Definitively failed jobs and ambiguous requests require an explicit retry after checking the workspace:

```sh
node scripts/streamer-outreach/cli.mjs retry --lead twitch:channel_name
node scripts/streamer-outreach/cli.mjs clips
```

`retry` can cause a new AI request and use more credits; it never runs automatically. It refuses to reset a project with an active job. Completed clips are not rerendered on ordinary resume. Account/server binding prevents resuming against the wrong workspace. If a local clip is lost or corrupted after its temporary project has been archived, restore the file from backup or create a new campaign.

If a process was force-killed and `.lock` remains, verify no run is active before removing that file. Normal errors release the lock. Do not edit `state.json` during a run. To start a new search window, change `outputDir` (for example `./output/campaign-02`); changing settings in an existing campaign is rejected to keep resume behavior predictable. With a custom output path, add that path to `.gitignore` if it is inside the repository.

Use `report` to rebuild the review page without API calls. Exit codes are `0` for success, `1` for a fatal setup/runtime error, and `2` for partial discovery, fewer candidates than requested, or per-channel issues. Inspect coverage and clip counts even on success: 150 candidate attempts do not guarantee 150 usable recordings or three suitable highlights each.

## Verification

```sh
node --test scripts/streamer-outreach/*.test.mjs
```

Tests cover discovery pagination and caps, current Kick v2 shapes, X profile/post identity separation, secret redaction, rate limits, account binding, interrupted job recovery, checksum checks, HTML escaping, and a 150-streamer HTTP-fixture batch that stays under the 20-project cap. Provider results, AI responses, and media payloads are fixtures. These tests do not establish live API access, rendering quality, account credits, or source availability; use `doctor` and a small pilot after adding credentials.
