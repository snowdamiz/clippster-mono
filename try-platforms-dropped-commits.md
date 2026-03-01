# Dropped Commits from try-platforms Branch

These commits were ahead of `origin/main` and were dropped to clean up the branch.
They need to be re-applied manually after merging the platform work into main.

## Commits Dropped (newest first)

| Hash | Message |
|------|---------|
| `423bf083` | Refactor migrations: consolidate track_index/layer columns into self-healing code, renumber migration files |
| `030100af` | Fix channel link creation: normalize URLs, handle race conditions, improve error handling |
| `27ed7781` | Increase portfolio clip upload limit from 100MB to 200MB |
| `b77bae37` | Fix WebSocket connection management: only connect when project has active detection |
| `bab45b61` | Bump version to 0.1.102 |
| `d2d0e53a` | fix: add localhost:1420 to WebSocket check_origin for Tauri production app |
| `eea50da3` | Bump version to 0.1.100 |
| `41f13239` | Fix video editor CORS: add tauri-plugin-localhost to serve frontend from http://localhost:1420 in production |
| `75b77b1c` | Fix macOS code signing: remove --deep flag that strips entitlements from sidecars |
| `3fa8d8b9` | Bump version to 0.2.2 and revert media loading to localhost video server with chunked fetch for large files |
| `2ecca717` | Bump version to 0.2.1 |
| `52171458` | Fix editor media loading: replace localhost video server with convertFileSrc asset protocol |
| `8786765f` | Add leaderboard management section to admin settings with manual refresh controls |
| `eb87488a` | Bump version to 0.2.00 and simplify support conversation handling |
| `aaed9892` | Replace Rumble InnerTube scraping with yt-dlp for livestream checking and VOD fetching, add standardized download path handling |
| `2e8ab9b6` | Fetch YouTube streams instead of videos and add robust metadata parsing with JS-free extraction |
| `04379bcb` | Add YouTube VOD download support with standardized path handling and provider integration |
| `09ab6942` | Change YouTube and Rumble default segment duration from 5 minutes to 4 seconds and add platform-specific livestream checks |
| `007525ca` | Remove --live-from-start flag from YouTube yt-dlp, change HLS flags from append_list to standard, and add YouTube/Rumble livestream viewer support |
| `0205711f` | Replace YouTube InnerTube API with yt-dlp for livestream checking and add platform type variants |
| `2139e9d6` | Fix migration file path reference from 083 to 091 for transcript_raw_json column |
| `f7704888` | Rename migration file and add Rumble, Twitter, and YouTube platform support to LiveClip monitoring |
| `df23f0f5` | Add YouTubeStreamEndedPayload struct for stream completion events |
| `cf368d9c` | Add duplicate download prevention and stream-ended event emission for YouTube, Rumble, and Twitter recording modules |
| `777e3ba8` | Add YouTube, Rumble, and Twitter recording modules with livestream support |

## Notes
- The branch was reset to match `origin/try-platforms` exactly
- The platform work (YouTube/Rumble/Twitter) needs to be re-added on top of a clean main
- The fix commits (CORS, code signing, WebSocket, migrations) also need to be re-applied
