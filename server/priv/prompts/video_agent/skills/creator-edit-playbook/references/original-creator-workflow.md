---
name: creator-edit-playbook
description: Turn a creator's livestream or talking-head recording into fact-checked long-form YouTube videos, vertical Shorts, viral thumbnails and ready-to-post titles, descriptions and tags, in a "news show" style that keeps every word the creator says and shows only real, dated sources. Use whenever someone wants their stream or recording edited, cut into Shorts, packaged for upload, or wants thumbnails, titles or descriptions for those videos.
---

# Creator Edit Playbook

This is the original creator-specific reference. Its format lengths, niche examples, sponsor rules, and word-preservation defaults are examples. Apply them only when the selected creator profile or this project calls for them. The main `creator-edit-playbook/SKILL` and current project instructions take precedence.

A complete workflow for editing streams and recordings into videos that get views without embarrassing the creator: every word kept, every claim backed by a real dated source, sponsors disclosed properly, nothing private on screen. It was built and refined over weeks of daily stream edits and feedback from a finance and crypto creator, and it works for any niche.

Optimize for views first, but never at the cost of truth, the creator's words or their audience's trust.

## 0. Start here: set up the creator profile

Before the first edit, ask the creator for these and save them in a `creator.md` you re-read every time:

- **Brand:** channel name, colors, fonts, logo, end card, company or product link (if any).
- **Sponsors:** each sponsor's name, the creator's real referral link and code, the required disclosure wording, which platforms allow them (some apps can't be promoted on TikTok), and whether discount wording is allowed in descriptions. Discount numbers never go on screen.
- **Schedule and platforms:** when long videos and Shorts go out, which platforms get which formats.
- **Hard rules:** the creator's own non-negotiables. Defaults that worked:
  1. Never cut a word they say unless they ask.
  2. Thumbnail faces only from that day's recording.
  3. No color grading of their face.
  4. No em dashes in anything they post.
  5. No casino branding.
- **Delivery:** where finished files go, and what preview size their chat or phone accepts.

When the creator gives feedback that reveals a lasting preference ("don't use old photos", "the cuts don't flow"), add it to `creator.md` as a rule so it is never re-learned.

## 1. Formats (defaults, adjust per creator)

| Format | Spec |
|---|---|
| Long-form take | One topic, 2 to 12 minutes, every word of the chosen segment kept, real sources on screen, chapters, end card |
| Stream Short | 20 to 60 s vertical cut from the stream, one contiguous excerpt |
| Recorded Short | 45 to 70 s vertical, recorded on purpose with a hook, the story and a CTA |
| Thumbnails | 2 to 4 per long-form (A = pick, B, C, D alternates for testing) |
| Copy files | One for long-forms (titles, descriptions, tags, pinned comments), one for Shorts (captions, titles, hashtags) |

A schedule that worked: one long video a day around midday, Shorts in the morning, one or two a day. Re-check with the channel's own "when your viewers are on YouTube" data after two weeks.

## 2. Plan with a funnel before cutting anything

Every piece needs a job. Tag each candidate before you cut it:

- **Top (reach):** news where money meets culture, viral moments, the creator's life. Strangers follow a person, not a ticker.
- **Middle (trust):** receipts and value. Real screens, real numbers, losses included (losses build more trust than wins).
- **Bottom A (sponsor conversions):** "follow my trades on X", "how I use X", with the referral card.
- **Bottom B (the creator's own product or service):** advanced posts for the people who buy from them.

Rules:
- If a piece fits no stage, don't make it, however good it is.
- Top pieces need a bridge to a middle or bottom stage (for example: viral news, then the creator's position, then the CTA).
- Put the stage tags in the delivery summary and the copy files. Track one number per stage: follows (top), saves and shares (middle), sign-ups and booked calls (bottom).

## 3. Ingest the recording

- **Get the original files.** Use the camera and screen-share ISO tracks if the streaming tool records them separately. Keep raw files untouched and record their md5.
- **Extract audio.** Make a 48 kHz WAV for editing and a 16 kHz mono WAV for speech recognition: `ffmpeg -i cam.mp4 -vn -ac 1 -ar 48000 cam_48k.wav`. If the source is 44.1 kHz, resample before trimming (`aresample=48000` before `atrim`), or every piece runs long and the next word bleeds in.
- **Sync camera and screen.** The camera clock is the master. Find the screen offset one of three ways:
  - a visible clock flipping minutes on both tracks (the most reliable);
  - audio cross-correlation;
  - video cross-correlation of the camera box inside the stream layout.

  Write the offset and its error down in a small mapping module, `scr_of_cam(t)`.
- **Transcribe with faster-whisper.** Use `base.en` for a quick full pass and `small.en` with word timestamps on the segments you'll use. Whisper word times can be 0.3 to 0.9 s off and include the pause before a word, so never cut on Whisper times alone.
- **Build a loudness envelope** in 5 ms steps (dB). Every cut decision is checked against it.
- **Run a face track** (MediaPipe face landmarker or Haar plus smoothing) over the segments for crops and thumbnails.

## 4. Choose the segments

- **One topic per video.** Never stitch unrelated segments. A second topic becomes its own video or Short.
- **Start** on the line that frames the topic (reading the post they react to, the question they ask), never mid-thought ("But...").
- **End** on a punchline, a conclusion or their real sign-off, never trailing chatter.
- **Under about 60 s of body:** also plan a vertical Short of it.
- **Scout the whole stream.** Rank 30 s chunks for standalone strength, list Short candidates, then tag each with its funnel stage.

## 5. Cut without losing a word

The creator's words are sacred. Only dead air comes out.

**Long-form algorithm:**
1. Set the segment's first and last word.
2. Inside the segment, shrink every silence (below -50 dB for 0.42 s or more) to about 0.25 s.
3. Never drop a single 5 ms frame above -50 dB.
4. **Gap check:** print the loudest level inside every removed gap. Anything above -50 dB means a word or breath was cut, so fix it.
5. Re-transcribe the cut and diff it word by word against the source transcript. Only Whisper noise may differ.
6. Build frame-exact pieces: 1600 samples per frame at 48 kHz and 30 fps. Use PCM audio per piece, concatenate, and do one AAC encode at the end.
7. Check sync against the source: the offset must be under 20 ms, and the audio length must equal the video length.

**Recorded Shorts and restarts:**
- Whole sentences only.
- Whisper decides which sentences; Silero VAD decides where to cut.
- Keep a little air at sentence ends (up to about 0.16 s).
- If the creator did several takes, use the clean take. Restarts inside a take stay unless the creator says otherwise.

**Non-speech scan:** run an AudioSet classifier (AST, 0.6 s windows) over the cut. Zero coughs or throat clears allowed. Mute breaths only inside pauses, never over a word.

Never use generative voice enhancers: they rewrite words. After any audio processing, re-transcribe and diff.

## 6. Build a fact-check kit for every video (before graphics)

Make one folder per video with these files:

**`claims.md`.** Every claim, with:
- its timestamp;
- a verdict: VERIFIED, PARTLY, UNCONFIRMED, RUMOR, OPINION, PREDICTION or NOT FOUND;
- the real source: URL, date, and time with time zone;
- the exact on-screen label.

Put a "Labels first" table at the top: line → label or card while the creator says it.

**Label rules:**
- **Neutral wording only:** "Unconfirmed: ...", "[Name]'s take", "Rumor, not confirmed", or a plain dated fact card.
- **No "WRONG" stamps.** When a number they say is off, keep the line and show the real dated figure as a plain fact card.
- **Ambiguous numbers:** show both, labeled (for example, market cap and fully diluted).
- **Internal numbers:** label the creator's own figures as theirs ("[Creator]'s company figure"). Never dress them up as sourced facts.
- **Named people:** rumors and claims about real people must read as rumors or the creator's account, never as fact. Our own copy never accuses anyone ("scam", "rug", "industry plant") and never mocks anyone's looks, even if the creator jokes about it on air. Their joke stays in the audio and captions; it never becomes a title, card or chip.
- **Neutrality:** politics gets neutral dated facts only. Every company, including AI companies, gets the same treatment.
- **Personal data:** pseudonymous people stay pseudonymous. No real names, channel handles or anything that identifies them beyond the name they use, and no links that lead to that.

**`footage.md`.** What may be shown from the screen recording, as crop rectangles and time ranges, and what must never be shown:
- browser tabs, address bar and bookmarks;
- taskbar and notifications;
- the creator's own account panels, balances, cash and positions (unless deliberately shown as a receipt the creator talks about);
- other users' usernames, chats and referral codes;
- community notes, ads and sidebars in article crops;
- profanity, casino branding and children as a focal point.

**`data/`, `web/`, `x/`.** Raw pulls (price APIs, OHLCV, filings), article captures and post or profile JSON (fxtwitter-style APIs give real avatars, text and dates without logging in).

Every number on screen or in a thumbnail must come from a VERIFIED line.

## 7. Long-form graphics: it's a news show

**Style:**
- plain editorial with hard cuts;
- real screens, articles and posts, with the face cam as picture-in-picture during inserts;
- a split view (card panel plus camera) for data;
- lower thirds;
- chapter cards;
- one chip at a time in a fixed corner;
- a small source label with a date on every image.

**Density:** something should change every 5 to 8 s while the creator makes a point.

**What to show:**
- **People and companies they mention:** their real profile card or post card (real avatar, name, handle, exact text, date).
- **Articles:** screenshots with the highlight on the exact lines. Measure the line boxes; a misaligned highlight looks cheap.
- **Data:** charts built from real data, with source, date and time zone.
- **Sponsor reads and positions:** the referral card and disclosure chip (section 8).

**Motion:** deterministic, driven by time, never random. Number tickers, a single light sweep, words rising out of a mask. Avoid meteors, sparkles, aurora backgrounds, rainbow gradients and typewriter text on long lines.

**No flicker, ever:**
- no graphic shorter than about 0.5 s;
- no 1 to 10 frame glimpse of the camera between two graphics;
- snap every edge to a whole frame and onto the camera cut points;
- run a flash detector over the final (target: 0 events).

**Ending:** the final stat stays readable for at least 1.5 s; no new graphic in the last 1.5 s; then the brand end card over the creator's real sign-off, with no outro music.

**Copy on screen:** no em dashes, no placeholder text ("X%"), no editorial text inside a real profile's bio slot, and profanity masked ("f***").

## 8. Sponsors and disclosures

**When the creator names a sponsor, show a referral card with:**
- the sponsor's logo;
- "Trade with me on [X]" or "Try [X]";
- the real referral URL in a pill that lights up on "link below";
- a scannable QR code of the full link (decode it to check);
- the code;
- the risk line;
- "link in the description".

Put one "Ad" chip over the whole read.

**Rules:**
- Never put a discount number on screen. Descriptions can carry it if the sponsor allows.
- **Disclosure chip** whenever the creator talks about their own positions or the sponsor's product: "[Sponsor] is a sponsor · I hold [X] · not financial advice", from the first frame of that section.
- Hide other people's referral links and codes in screenshots; they compete with the creator's.
- **Platform toggles:** YouTube "Includes paid promotion", Instagram "Paid partnership", TikTok "Branded content". Sponsored posts only use licensed music.
- **TikTok:** if a sponsor can't be promoted there, deliver a TikTok cut that ends before the CTA.

## 9. Vertical Shorts

**Layout (1080x1920):**

| Zone | What goes there |
|---|---|
| Top panel (y 0 to 860) | Screen crop or still of exactly the element they mention, with a slow zoom and a highlight box drawn on its measured coordinates, or a fact card |
| Bottom | Face-cam crop around a smoothed face track, face about 40% from the top, punch-ins on money words and jokes |
| Captions (on the seam between the two) | 2 to 3 words per page, heavy font with a black stroke, the active word highlighted, money words green, loss words red, profanity masked |

**Frame 1 must already work:**
- the hook title is readable;
- the source label is on (no fade-in);
- sponsored Shorts show the disclosure chip from frame 1.

**Hook:** a money goal, or a famous thing doing something weird. Never lead with a ticker or the creator's own company.

**Rules:**
- **Sponsor:** a referral pill is on screen for at least 2.5 s when the sponsor is named, and a full CTA card with QR runs at the end.
- **Fill the top panel:** it is never empty or half black, and text is never clipped at the edges. Re-crop until the subject fills it.
- **Labels:** every number has a source and a date, and unconfirmed lines carry their label while spoken.
- **Sound:** no music or sound effects on talking Shorts unless the creator wants them. If you use music, always also deliver a no-music version.
- **Audio:** -14 LUFS, true peak about -1.5 dBFS.

## 10. Audio

- -14 LUFS integrated, true peak at or below -1 dBTP. Use a static gain plus a limiter, not dynamic loudnorm on the voice.
- Measure with `ffmpeg -i out.mp4 -af ebur128=peak=true -f null -`.
- Music only where the creator approved it. Duck it under the voice and use licensed or CC0 tracks.

## 11. Captions (.srt)

- Build them from a re-transcription of the final audio, with word times.
- Apply a spelling list from the kit: brand names, handles, tickers, the people mentioned.
- Mask profanity and keep everything else exactly as said, jokes included.
- Two lines max per cue. Read the finished file once for names.

## 12. Thumbnails

**The face:**
- Only from that day's recording.
- Scan frames with a face landmarker. You want a closed mouth, open eyes, small yaw and pitch, a sharp image and a clear expression from the blendshapes: concern, skepticism, a confident half-smile, or wide eyes looking at the subject.
- Reject frames with a hand in front of the body or face (motion blur reads badly), glare on glasses, or a goofy side-eye. Look at a contact sheet of candidates and the full frame around them before picking.
- Cut them out with BiRefNet-portrait (MIT license). Then only resize, add a white outline and a soft shadow. Never grade, mirror or edit the face, eyes, teeth or hair. No AI images.

**The design:**
- 2 to 4 giant words, or one giant verified number. Maximum contrast in the graphics, never on the face.
- One idea, plus a real photo, object or logo that tells the story instantly.
- Red arrows or circles where they add tension.
- Check the thumbnail at 320x180 and 168x94.
- The thumbnail complements the title and never repeats it.

**Licensing:**
- Pexels and Unsplash photos.
- Wikimedia public domain or CC BY images (put the attribution in the description).
- Logos for commentary.
- People's own public posts as news commentary.
- Log every source.

**Testing:** make A, B, C and D and run three of them in YouTube "Test & Compare".

**Examples that worked:**

| Thumbnail | What made it work |
|---|---|
| "ON FIRE?" | Real burning-cash photo, the company logo, and a red "-$2.12B FREE CASH FLOW · Q3" tag (verified) |
| "THEY MADE HIM A COIN" | A gold coin carrying the person's own photo, plus a green "$40M IN UNDER 1 HOUR" tag (verified) |
| "FINAL BOSS" | The person's nickname as a video-game boss health bar over their own public photo |
| "EVERYONE FELL OFF" | A quote from a famous creator's own slide, credited, over a red falling chart of their real numbers |
| A plain stare | Concerned stare at the camera, bold short question, real photo background, recognizable logo |

**What got rejected:**
- a warm color grade on the face;
- old photos instead of that day's stream;
- a blurred hand in front of the body;
- a goofy expression;
- text-heavy article screenshots as the main visual.

## 13. Titles, descriptions, tags, pinned comment

**Titles:**
- About 40 to 55 characters, no ALL CAPS, no em dashes.
- They must match what happens in the first minute and contain the phrase people search for.
- Curiosity plus stakes, and still true. Patterns that worked:
  - **Personal stakes:** "I Sold Meta Before Earnings. Was That a Mistake?"
  - **Twist:** "Streaming Is Dying (But Not How You Think)"
  - **Mystery:** "Meta Hasn't Done This Since 2012"
- Avoid jargon in broad titles, and don't name people who are dormant on YouTube.

**Description template:**
1. A hook of 2 to 3 lines in the creator's voice, with the strongest verified facts. The first 150 characters matter most.
2. "In this video:" followed by 4 or 5 keyword bullets.
3. Chapters. The first must be at 0:00 and last at least 10 s, and you need at least 3. Take the times from the edit timeline, rounded down to the second. Never add a separate short "Intro" chapter.
4. Sponsor block: "Ad: [Sponsor] is a sponsor of this video." plus the link, then other sponsors, the live schedule and the creator's own link.
5. Disclosures: holdings, unconfirmed items, and which lines are opinion.
6. Sources: title, date and URL for each. Don't link anything that would expose a pseudonymous person.
7. Three hashtags at the end. The first three show above the title.

**Tags:** 20 to 30 search phrases under 500 characters (the topic, "is X dying", the names involved, the creator's name).

**Pinned comment:** a question that invites answers, plus the CTA, labeled "(Ad)" if it carries a sponsor link.

**Upload settings:** paid promotion on or off, the captions file, thumbnail tests.

**Writing:** all copy in the creator's voice, never AI-sounding, no em dashes.

## 14. QA and independent review

**Automated checks on every final:**
- flash detector: 0 events;
- loudness: about -14 LUFS;
- sync under 20 ms, and audio length equal to video length;
- a full decode with no errors;
- a re-transcription of the final, diffed against the cut;
- the non-speech scan.

**Visual check:** a contact sheet (`ffmpeg -i v.mp4 -vf fps=0.5,scale=480:-1,tile=6x5 sheet.jpg`), then full-resolution frames wherever something looks off.

**Independent reviewer:**
- Have a separate agent that didn't build the video review it against a written brief.
- The report comes back as FIX FIRST (rule violations), SHOULD FIX and OK, with output times.
- Builders never grade their own work.

**Fixing:**
- Edit the timeline.
- Preview the changed frames as stills.
- Re-render only the chunks that changed (use a deterministic, frame-range renderer).
- Re-run the checks and look at the fixed frames in the new file.

Judge reviewer findings against the creator's real rules. For example, a discount code in a description is fine if the rule only bans it on screen.

## 15. Delivery

- **Previews first:** phone previews under 30 MB (720x1280, two-pass x264, AAC 128k) go out as soon as they're ready.
- **Final files:** masters, `.srt` files, thumbnails and both copy files go into dated folders. Verify the md5 after every transfer. For big files, split into chunks, checksum them, and reassemble on the other side.
- **Summary for the creator:**
  - what's ready, with lengths;
  - the funnel tag of each piece;
  - flags (unconfirmed items, jokes kept as asked, anything you changed);
  - one open question if you have one (for example, "are you still holding X? It changes the disclosure").

## 16. Working at scale with parallel agents

**Split the work:**
- a research kit per video;
- a timeline builder per video;
- one builder per Short;
- one agent for thumbnails and titles;
- independent reviewers;
- fixers.

**Give each agent a brief** with:
- the goal;
- the files to read;
- the hard rules;
- the deliverables and where to write them;
- a time budget.

Keep agents away from the creator's computer and accounts.

**Shared machine:**
- one render lane per agent, nice'd;
- chunked, resumable renders that skip finished chunks;
- clean up temp files (model weights, intermediate audio);
- never delete the creator's files.

**Everything is a file:** transcripts, kits, timelines, briefs, copy. Anyone can pick the work up and reproduce it.

## Appendix: handy commands

```bash
# audio for editing / for speech recognition
ffmpeg -i cam.mp4 -vn -ac 1 -ar 48000 cam_48k.wav
ffmpeg -i cam.mp4 -vn -ac 1 -ar 16000 cam_16k.wav
# exact frame at time t
ffmpeg -v error -ss 12.5 -i video.mp4 -frames:v 1 frame.jpg
# loudness and true peak
ffmpeg -i final.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:"
# contact sheet, one frame every 2 s
ffmpeg -i final.mp4 -vf fps=0.5,scale=480:-1,tile=6x5 sheet.jpg
# phone preview under 30 MB (set VB in kbit/s from the duration: 28*8*1024/seconds - 140)
ffmpeg -y -i in.mp4 -vf scale=720:1280 -c:v libx264 -b:v ${VB}k -pass 1 -an -f mp4 /dev/null
ffmpeg -y -i in.mp4 -vf scale=720:1280 -c:v libx264 -b:v ${VB}k -pass 2 -c:a aac -b:a 128k -movflags +faststart out_phone.mp4
# check a transfer
md5sum file.mp4
```

```python
# keep-every-word silence shrink: find removable gaps on a 5 ms dB envelope
import numpy as np, soundfile as sf
a, sr = sf.read('cut_48k.wav'); a = a if a.ndim == 1 else a.mean(1)
hop = int(sr * 0.005)
env = 20 * np.log10(np.sqrt(np.convolve(a ** 2, np.ones(hop) / hop, 'same')[::hop]) + 1e-9)
quiet = env < -50
gaps, start = [], None
for i, q in enumerate(quiet):
    if q and start is None: start = i
    if not q and start is not None:
        if (i - start) * 0.005 >= 0.42: gaps.append((start * 0.005, i * 0.005))   # shrink each to ~0.25 s
        start = None
print(len(gaps), 'gaps; every removed span must stay below -50 dB')
```
