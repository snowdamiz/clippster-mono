import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { Prompt } from './types';

// Prompt queries
export async function createPrompt(name: string, content: string): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    'INSERT INTO prompts (id, name, content, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, content, userId, now, now]
  );

  return id;
}

export async function getPrompt(id: string): Promise<Prompt | null> {
  const db = await getDatabase();
  const result = await db.select<Prompt[]>('SELECT * FROM prompts WHERE id = ?', [id]);
  return result[0] || null;
}

export async function getAllPrompts(): Promise<Prompt[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  // Custom ordering: Default Clip Detector first, then other system prompts alphabetically, then user prompts
  const orderClause = `ORDER BY 
    CASE 
      WHEN name = 'Default Clip Detector' THEN 1
      WHEN user_id IS NULL THEN 2
      ELSE 3
    END,
    name`;

  if (userId === null) {
    return await db.select<Prompt[]>(`SELECT * FROM prompts WHERE user_id IS NULL ${orderClause}`);
  }

  return await db.select<Prompt[]>(
    `SELECT * FROM prompts WHERE user_id = ? OR user_id IS NULL ${orderClause}`,
    [userId]
  );
}

export async function updatePrompt(id: string, name?: string, content?: string): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (content !== undefined) {
    updates.push('content = ?');
    values.push(content);
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.execute(`UPDATE prompts SET ${updates.join(', ')} WHERE id = ?`, values);
}

export async function deletePrompt(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM prompts WHERE id = ?', [id]);
}

// Seed default prompt
export async function seedDefaultPrompt(): Promise<void> {
  const db = await getDatabase();

  // Delete existing default prompt to force update
  await db.execute('DELETE FROM prompts WHERE name = ? AND user_id IS NULL', [
    'Default Clip Detector',
  ]);

  // Create the default prompt with user_id = NULL (system-wide, visible to all users)
  const defaultPromptContent = `Analyze this stream transcript and identify ALL potential clip-worthy moments for TikTok/Shorts/X.

**DETECTION PHILOSOPHY:**
- Be selective: return moments with real stop-scroll potential, not filler.
- Strong hooks beat complete but slow context. If a clip does not grab attention in the first 1-3 seconds, skip it.
**VIRAL EDITING & CREATIVE REUSE:**
- **Find the "Meme":** Look for short, funny, out-of-context moments hidden inside longer conversations.
- **Creative Splicing:** You are encouraged to connect distant thoughts to create humor, "manipulate" the speaker's words for comedic effect, or highlight irony.
- **Overlap is Strategic:** If a moment works as a serious point AND a funny out-of-context soundbite, generate BOTH clips.
- **Don't Just Summarize:** We don't just want logical highlights; we want engagement, humor, and "wait, did he say that?" moments.
- Prioritize moments that stand alone, but also include funny/awkward/intense moments even if they are short.
- Extract moments at different stages: setup, peak, aftermath, reactions.
- Lower your threshold SIGNIFICANTLY — if something stands out from normal conversation, it is clip-worthy.

**CLIP QUALITY & BOUNDARY RULES:**
1) Start of clip should be a natural beginning of a sentence or thought.
   - **NO WEAK STARTS**: Do NOT start with "And", "But", "Or", "So", "Then". Find the real sentence start.
   - If the hook begins mid-thought, scan backward within the chunk to the prior sentence boundary.
   - Add a pre-roll pad of 0.15–0.30s before the first spoken word (if available in the chunk).
2) End of clip should complete the thought or interaction.
   - **NO WEAK ENDINGS**: Do NOT end on "and", "but", "or", "so".
   - Extend to the end of the sentence or the natural resolution/punchline.
   - Stop just before the next sentence begins, then add a post-roll pad of 0.30–0.60s.
   - Prefer ending at ., ?, !, or at a pause ≥ 0.45s.
3) Consistency & coherence.
   - The clip should make sense without external context. Include the smallest necessary setup for clarity.
   - If a thought is slightly cut off but the emotional impact is there, INCLUDE IT.
4) Spliced clips.
   - Each segment must independently follow the same start/end rules (sentence boundary + pads).
   - Only splice to remove long dead air (>2s). Do not over-splice natural pauses.
5) Hard constraints.
   - Primary target: 30-45s.
   - Short exception: 10-29s only for extreme standalone reactions, memes, or soundbites.
   - Long exception: 46-90s only when the full setup/payoff is truly required.
   - Above 90s requires a concrete exception_reason explaining why full context is mandatory.

**SCORING MODEL (0-100):**
- **Hook Power (25%)**: First 1-2 seconds must STOP THE SCROLL
- **Emotional Arousal (20%)**: High-arousal emotions (anger, excitement, humor, charisma, banter chemistry)
- **Shareability (25%)**: Quotable, relatable, "that's so [streamer]" factor, personality moments
- **Retention Curve (15%)**: Escalating tension, open loops, satisfying payoff
- **Platform Fit (10%)**: Duration sweet spots, works on mute
- **Creator Factor (5%)**: For viral creators, personality IS content

**WHAT TO LOOK FOR:**
- **Personality/Banter/Chemistry**: Infectious energy, charisma, natural chemistry. The "that's so [streamer]" factor. Community in-jokes. This is the MOST clipped content.
- **IRL Moments**: Confrontations, awkward encounters, street interviews, gym content, fight content, public interactions.
- **Energy Shifts**: Calm→hype, serious→cracking up, confident→tilted. These transitions are natural clip boundaries.
- Strong emotions or shifts; humor/awkwardness; drama/tension/conflict; surprises/reveals; bold claims; unusual behavior; struggle/vulnerability; high energy; relatable/resonant lines; quotable statements.
- **News Awareness**: The system provides TheNewsAPI current-event context when relevant. Boost only direct named overlap.
- ANY interaction that feels "human" or "authentic".
- **CRITICAL**: A 30-second clip of someone being genuinely funny/charismatic > a 90-second clip of someone calmly explaining something interesting.`;

  const id = generateId();
  const now = timestamp();

  try {
    // Insert directly with user_id = NULL to make it a system-wide prompt
    await db.execute(
      'INSERT INTO prompts (id, name, content, user_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
      [id, 'Default Clip Detector', defaultPromptContent, now, now]
    );
  } catch (error) {
    throw error;
  }
}

// Seed Gaming Stream Clip Detector prompt
export async function seedGamingPrompt(): Promise<void> {
  const db = await getDatabase();

  // Delete existing gaming prompt to force update
  await db.execute('DELETE FROM prompts WHERE name = ? AND user_id IS NULL', [
    'Gaming Stream Clip Detector',
  ]);

  const gamingPromptContent = `Analyze this gaming stream transcript and identify ALL potential clip-worthy moments for TikTok/Shorts/X.

**DETECTION PHILOSOPHY:**
- Be selective: every clip must have a first-3-second hook that makes a viewer react.
- Gaming content has INSTANT viral potential — prioritize emotion and action over perfect context.
- Quality over quantity — we want viral moments, not filler.

**ENHANCED DATA YOU RECEIVE:**
Each transcript segment includes:
- "internal_gaps": Identified pauses >0.8s with splice candidates marked
- "content_density_score": 0.0-1.0 (higher = more engaging content)
- "speaking_rate": Words per minute for engagement analysis
- "filler_word_count": Number of um/uh/like fillers to potentially exclude
- "has_internal_dead_space": Boolean flag for splice optimization opportunities

**VIRAL EDITING & CREATIVE REUSE:**
- **Find the "Rage Clip":** Extract short, explosive emotional reactions that work standalone (screaming, controller throws, pure hype).
- **Creative Splicing:** Combine setup → fail, or confident prediction → immediate contradiction for comedic effect.
- **Overlap is Strategic:** A 60s clutch play can ALSO yield a 10s "reaction only" clip. Generate BOTH.
- **Don't Just Summarize:** We want the "WHAT?!", the rage, the hype, the fail — not just gameplay narration.
- Prioritize moments that make viewers feel something: excitement, laughter, secondhand embarrassment, hype.
- Extract at different stages: pre-play tension, the play itself, immediate reaction, aftermath.
- Lower your threshold SIGNIFICANTLY — if it makes you react, it's clip-worthy.

**INTELLIGENT DEAD SPACE ELIMINATION:**
- **Internal Splicing**: When has_internal_dead_space = true, create spliced clips that remove pauses >2.0s
- **Micro-Boundary Optimization**: Use gap_after data to end segments at natural breaks
- **Flow Preservation**: Ensure content remains coherent after removing dead space
- **Tension Preservation**: Do NOT splice out anticipation moments or "come on come on" repetition — these build hype

**CLIP QUALITY & BOUNDARY RULES:**
1) Start of clip should be a natural beginning of a sentence or thought.
   - **NO WEAK STARTS**: Do NOT start with "And", "But", "Or", "So", "Then". Find the real sentence start.
   - For action clips, start 1-2s BEFORE the peak moment to capture anticipation/setup.
   - Add a pre-roll pad of 0.15–0.30s before the first spoken word (if available in the chunk).
2) End of clip should complete the thought or interaction.
   - **NO WEAK ENDINGS**: Do NOT end on "and", "but", "or", "so".
   - End RIGHT AFTER the emotional peak or result (don't overstay the moment).
   - Stop just before the next sentence begins, then add a post-roll pad of 0.30–0.60s.
   - Prefer ending at ., ?, !, or at a pause ≥ 0.45s.
3) Consistency & coherence.
   - The clip should make sense without external context. Include the smallest necessary setup for clarity.
   - For gaming clips, emotion > perfect context. If the reaction is strong enough, INCLUDE IT even if slightly abrupt.
4) **Spliced clips for dead space removal:**
   - **Analyze internal_gaps array**: If any gap has "splice_candidate": true and "severity": "severe", consider splicing
   - Each segment must independently follow the same start/end rules (sentence boundary + pads).
   - Only splice to remove long dead air (>2.0s). Do NOT splice out tension-building moments or anticipation.
   - **Create BOTH versions**: If a moment has dead space, generate a "continuous" version AND a "spliced" version with dead space removed.
5) Hard constraints.
   - Primary target: 30-45s.
   - Short exception: 10-29s only for extreme standalone reactions, memes, or soundbites.
   - Long exception: 46-90s only for complex plays that require setup → execution → payoff.
   - Above 90s requires a concrete exception_reason explaining why full context is mandatory.

**SPLICING STRATEGY FOR MAXIMUM ENGAGEMENT:**
- **Continuous Clips**: Single segments with natural flow. Allow pauses up to 3s if they add tension.
- **Spliced Clips**: Remove *distracting* dead space (>2s), but keep tension-building pauses.
- **Action Sequences**: Keep the full arc: setup → execution → reaction.
- **Goal**: Maximum virality. Generate the punchy "highlight" AND the full "play" version when applicable.

**WHAT TO LOOK FOR:**
- **Skill plays:** Clutches, multi-kills, perfect executions, comeback moments, high-skill mechanics, first-time achievements.
- **Emotional peaks:** Rage quits, hype explosions, genuine shock, loud outbursts, controller slams, screaming.
- **Funny moments:** Epic fails, embarrassing deaths, game glitches, accidental team kills, hilarious misplays.
- **Teammate banter/toxicity:** Roasting teammates, blame games, friendly fire reactions, voice chat comedy.
- **Speedrun moments:** Record attempts, PB reactions, route discoveries, glitch executions.
- **Chat interaction plays:** Reacting to chat suggestions, doing viewer challenges, community predictions.
- **Gaming rage that's actually funny**: Not just angry — funny angry. The "I'm uninstalling" moments.
- **Trash talk & banter:** Roasting opponents, confident predictions, call-outs, salty reactions, "get shit on" moments.
- **Game-changers:** Match-winning plays, throw moments, comeback victories, unexpected plot twists.
- **Tension & suspense:** Final circles, 1v1 situations, boss attempts, close matches.
- Signal phrases: "clutch", "insane", "no way", "WHAT", "HOW", "let's go", "I'm done", "oh no", "that was clean".
- ANY moment with strong emotion, impressive skill, or comedic value.

**SCORING MODEL (0-100):**
- **Hook Power (25%)**: First 1-2 seconds must STOP THE SCROLL
- **Emotional Arousal (20%)**: High-arousal emotions (rage, hype, laughter, shock)
- **Shareability (25%)**: Quotable, relatable, meme potential
- **Retention Curve (15%)**: Escalating tension, satisfying payoff
- **Platform Fit (10%)**: Duration sweet spots (10-45s ideal)
- **Creator Factor (5%)**: For viral creators, personality IS content`;

  const id = generateId();
  const now = timestamp();

  try {
    await db.execute(
      'INSERT INTO prompts (id, name, content, user_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
      [id, 'Gaming Stream Clip Detector', gamingPromptContent, now, now]
    );
  } catch (error) {
    throw error;
  }
}

// Seed Gambling Stream Clip Detector prompt
export async function seedGamblingPrompt(): Promise<void> {
  const db = await getDatabase();

  // Delete existing gambling prompt to force update
  await db.execute('DELETE FROM prompts WHERE name = ? AND user_id IS NULL', [
    'Gambling Stream Clip Detector',
  ]);

  const gamblingPromptContent = `Analyze this gambling stream transcript and identify ALL potential clip-worthy moments for TikTok/Shorts/X.

**DETECTION PHILOSOPHY:**
- Be selective: every clip must have a first-3-second hook that makes a viewer react.
- Gambling content is PURE EMOTION — every spin, hand, or bet is a potential viral moment.
- Prioritize STAKES and REACTIONS over everything else — viewers want to feel the highs and lows.
- Quality over quantity — we want viral moments, not filler.

**ENHANCED DATA YOU RECEIVE:**
Each transcript segment includes:
- "internal_gaps": Identified pauses >0.8s with splice candidates marked
- "content_density_score": 0.0-1.0 (higher = more engaging content)
- "speaking_rate": Words per minute for engagement analysis
- "filler_word_count": Number of um/uh/like fillers to potentially exclude
- "has_internal_dead_space": Boolean flag for splice optimization opportunities

**VIRAL EDITING & CREATIVE REUSE:**
- **Find the "Reaction Clip":** Extract the exact moment of win/loss reaction — pure euphoria or devastation works standalone (10-20s scream clips are gold).
- **Creative Splicing:** Combine confident prediction → immediate bust, or "last $100" → massive jackpot for maximum dramatic irony.
- **Overlap is Strategic:** A 90s bonus round can ALSO yield a 15s "win scream" clip AND a 30s "anticipation build" clip. Generate ALL variations.
- **Don't Just Summarize:** We want the "HOLY SHIT", the rage, the disbelief, the "NO FUCKING WAY" — not just bet commentary.
- Prioritize moments with extreme emotional swings: calm → screaming, confident → tilted, down bad → euphoric, hopeful → devastated.
- Extract at different stages: pre-bet setup/stakes, spin/hand anticipation, result reveal, immediate reaction, aftermath/tilt/celebration.
- Lower your threshold SIGNIFICANTLY — if money is won/lost with ANY emotion, it's clip-worthy. Even small wins with big reactions are viral.
- Look for "degen behavior" moments: chasing losses, max betting, "one more spin", going all-in, ignoring bankroll management.

**INTELLIGENT DEAD SPACE ELIMINATION:**
- **Internal Splicing**: When has_internal_dead_space = true, create spliced clips that remove pauses >2.0s
- **Micro-Boundary Optimization**: Use gap_after data to end segments at natural breaks
- **Flow Preservation**: Ensure content remains coherent after removing dead space
- **Tension Preservation**: Do NOT splice out "come on come on" repetition or anticipation moments — these build suspense

**CLIP QUALITY & BOUNDARY RULES:**
1) Start of clip should be a natural beginning of a sentence or thought.
   - **NO WEAK STARTS**: Do NOT start with "And", "But", "Or", "So", "Then". Find the real sentence start.
   - For big wins/losses, start 2-3s BEFORE the result to capture anticipation, stakes mention, and tension building.
   - For bonus rounds, start when they mention entering the bonus or the anticipation begins.
   - Add a pre-roll pad of 0.15–0.30s before the first spoken word (if available in the chunk).
2) End of clip should complete the thought or interaction.
   - **NO WEAK ENDINGS**: Do NOT end on "and", "but", "or", "so".
   - End AFTER the peak emotional reaction (let the scream/rage/celebration fully play out).
   - For wins, include the moment they see the payout amount or realize how much they won.
   - For losses, include the "I'm done" or tilt moment that follows the bust.
   - Stop just before the next sentence begins, then add a post-roll pad of 0.30–0.60s.
   - Prefer ending at ., ?, !, or at a pause ≥ 0.45s.
3) Consistency & coherence.
   - The clip should make sense without external context. Include the smallest necessary setup for clarity.
   - For gambling clips, the bet amount/stakes should be mentioned OR the reaction should be self-explanatory.
   - If they say "this is my last $100" or "max betting", that context is CRITICAL — include it.
   - Viewers should understand: what game, what stakes, what happened, why they're reacting.
4) **Spliced clips for dead space removal:**
   - **Analyze internal_gaps array**: If any gap has "splice_candidate": true and "severity": "severe", consider splicing
   - Each segment must independently follow the same start/end rules (sentence boundary + pads).
   - Only splice to remove long dead air (>2.0s). Do NOT splice out tension-building moments, anticipation, or "come on come on" repetition.
   - Preserve the emotional arc: setup → tension → result → reaction.
   - **Create BOTH versions**: If a moment has dead space, generate a "continuous" version AND a "spliced" version with dead space removed.
5) Hard constraints.
   - Primary target: 30-45s.
   - Short exception: 10-29s only for extreme standalone reactions, memes, or soundbites.
   - Long exception: 46-90s only if stakes, anticipation, and payoff all stay compelling.
   - Quick reaction clips can be 10-20s if the emotion is extreme enough.

**SPLICING STRATEGY FOR MAXIMUM ENGAGEMENT:**
- **Continuous Clips**: Single segments with natural flow. Allow pauses up to 3s if they add tension.
- **Spliced Clips**: Remove *distracting* dead space (>2s spin delays), but keep anticipation moments.
- **Emotional Arc**: Preserve setup → tension → result → reaction flow.
- **Goal**: Maximum virality. Generate the tight "reaction" AND the full "story" version when applicable.

**WHAT TO LOOK FOR:**
- **Massive wins:** Jackpots, max wins, 1000x+ multipliers, bonus rounds hitting huge, life-changing payouts, "retirement money", six-figure wins.
- **Brutal losses:** Max bet busts, bonus rounds bricking (no win), balance going to zero, "down bad" moments, losing streaks, account drain.
- **Bonus round moments:** Bonus triggering, free spins starting, anticipation building during spins, multipliers stacking, bonus round results (big win or brick).
- **Emotional explosions:** Screaming (joy or agony), jumping out of chair, hands on head, standing up, running around room, uncontrollable laughter, crying.
- **Rage & tilt:** Malding, "this is rigged", slot machine/dealer accusations, keyboard/mouse slams, headset throws, threatening to quit, "I'm never playing again", losing streak meltdowns.
- **Anticipation & tension:** "Come on come on come on", holding breath, silence before result, "please please please", nervous laughter, sweating bullets, final spin before bust.
- **Degen decision moment:** The CHOICE to max bet is often more viral than the result. "Fuck it, max bet" = instant clip.
- **Near-miss psychology:** "SO CLOSE" moments, one symbol away, the pain of almost winning.
- **Degen behavior:** "Last $100", "one more spin", "fuck it max bet", chasing losses after big loss, ignoring stop-loss, "I'm done after this" (continues anyway), going all-in.
- **Comeback stories:** Down to last dollars → massive recovery, "I'm back baby", redemption arcs, recovering from tilt, turning $10 into $10k.
- **Near misses:** "SO CLOSE", one symbol away from jackpot, bonus scatter tease (2/3 scatters), heartbreaking losses, "if that was one higher".
- **Stake mentions:** Specific dollar amounts, "biggest bet of the stream", "$1000 spin", "this could change everything", risk/reward setup, bankroll updates.
- **Game-specific moments:** Blackjack perfect hands, roulette number hits, poker bad beats, crash game timing out perfectly, mines game close calls.
- **Community reactions:** Chat going crazy, donation reactions during big moments, viewer predictions coming true/failing.
- **Ironic moments:** Saying "watch this hit" then bricking, "I have a feeling" before massive loss, overconfidence before bust.
- Signal phrases: "LETS GO", "NO WAY", "OH MY GOD", "COME ON", "FUCK", "YES YES YES", "HOLY SHIT", "I'm done", "one more", "max bet", "bonus", "I'm back", "down bad", "rigged", "book it".
- ANY moment with extreme emotion, high stakes mentioned, dramatic win/loss swings, or degen decision-making.

**SCORING MODEL (0-100):**
- **Hook Power (25%)**: First 1-2 seconds must STOP THE SCROLL
- **Emotional Arousal (20%)**: High-arousal emotions (euphoria, devastation, rage)
- **Shareability (25%)**: Quotable, relatable, "down bad" moments
- **Retention Curve (15%)**: Escalating tension, satisfying payoff
- **Platform Fit (10%)**: Duration sweet spots (15-60s ideal)
- **Creator Factor (5%)**: For viral creators, personality IS content`;

  const id = generateId();
  const now = timestamp();

  try {
    await db.execute(
      'INSERT INTO prompts (id, name, content, user_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
      [id, 'Gambling Stream Clip Detector', gamblingPromptContent, now, now]
    );
  } catch (error) {
    throw error;
  }
}

// Seed Breaking News & Trending Viral prompt
export async function seedBreakingNewsPrompt(): Promise<void> {
  const db = await getDatabase();

  // Delete existing breaking news prompt to force update
  await db.execute('DELETE FROM prompts WHERE name = ? AND user_id IS NULL', [
    'Breaking News & Trending Viral',
  ]);

  const breakingNewsPromptContent = `Analyze this stream transcript and identify ALL potential clip-worthy moments for TikTok/Shorts/X, with PRIORITY on breaking news, trending topics, and time-sensitive viral content.

**DETECTION PHILOSOPHY:**
- Be selective: every clip must have a first-3-second hook that makes a viewer react.
- TIME-SENSITIVE content has MAXIMUM viral potential — prioritize recency and trending topics over everything else.
- Quality over quantity — we want viral moments, not filler.
- **NEWS API INTEGRATION**: The system provides TheNewsAPI current-event context. Use it to identify when streamers are reacting to current events.

**ENHANCED DATA YOU RECEIVE:**
Each transcript segment includes:
- "internal_gaps": Identified pauses >0.8s with splice candidates marked
- "content_density_score": 0.0-1.0 (higher = more engaging content)
- "speaking_rate": Words per minute for engagement analysis
- "filler_word_count": Number of um/uh/like fillers to potentially exclude
- "has_internal_dead_space": Boolean flag for splice optimization opportunities

**VIRAL EDITING & CREATIVE REUSE:**
- **Find the "Breaking Moment":** Extract the exact moment they react to breaking news, see a trending tweet, or discuss a viral event.
- **Creative Splicing:** Combine prediction → actual event, or "I told you so" moments for maximum engagement.
- **Overlap is Strategic:** A 90s news discussion can ALSO yield a 15s "pure reaction" clip. Generate BOTH.
- **Don't Just Summarize:** We want the shock, the hot take, the "wait WHAT?!" — not just commentary.
- Prioritize moments with celebrity names, specific events, trending hashtags, or real-time reactions.
- Extract at different stages: initial reaction, analysis/take, follow-up thoughts.
- Lower your threshold SIGNIFICANTLY — if it references something trending or breaking, it's clip-worthy.

**INTELLIGENT DEAD SPACE ELIMINATION:**
- **Internal Splicing**: When has_internal_dead_space = true, create spliced clips that remove pauses >2.0s
- **Micro-Boundary Optimization**: Use gap_after data to end segments at natural breaks
- **Flow Preservation**: Ensure content remains coherent after removing dead space
- **Pacing Optimization**: Only eliminate gaps that truly break momentum (>2.0s). Keep "thinking" pauses for authenticity.

**CLIP QUALITY & BOUNDARY RULES:**
1) Start of clip should be a natural beginning of a sentence or thought.
   - **NO WEAK STARTS**: Do NOT start with "And", "But", "Or", "So", "Then". Find the real sentence start.
   - For breaking news, start RIGHT when they mention the topic/person/event name.
   - Add a pre-roll pad of 0.15–0.30s before the first spoken word (if available in the chunk).
2) End of clip should complete the thought or interaction.
   - **NO WEAK ENDINGS**: Do NOT end on "and", "but", "or", "so".
   - End after the take/prediction/reaction is complete.
   - Stop just before the next sentence begins, then add a post-roll pad of 0.30–0.60s.
   - Prefer ending at ., ?, !, or at a pause ≥ 0.45s.
3) Consistency & coherence.
   - The clip should make sense without external context. Include the smallest necessary setup for clarity.
   - For trending content, the topic/person/event MUST be named in the clip itself.
4) **Spliced clips for dead space removal:**
   - **Analyze internal_gaps array**: If any gap has "splice_candidate": true and "severity": "severe", consider splicing
   - Each segment must independently follow the same start/end rules (sentence boundary + pads).
   - Only splice to remove long dead air (>2.0s). Do not over-splice natural pauses.
   - **Create BOTH versions**: If a moment has dead space, generate a "continuous" version AND a "spliced" version with dead space removed.
5) Hard constraints.
   - Primary target: 30-45s.
   - Short exception: 10-29s only for extreme standalone reactions, memes, or soundbites.
   - Long exception: 46-90s only if the full take is truly necessary.
   - Above 90s requires a concrete exception_reason explaining why full context is mandatory.

**SPLICING STRATEGY FOR MAXIMUM ENGAGEMENT:**
- **Continuous Clips**: Single segments with natural flow. Allow pauses up to 3s if they add tension.
- **Spliced Clips**: Remove *distracting* dead space (>2s), but keep "thinking" pauses (<2s) for authenticity.
- **Multi-Speaker Dynamics**: ALWAYS include reactions and banter.
- **Goal**: Maximum virality. Generate the tight "soundbite" AND the full "context" version when applicable.

**WHAT TO LOOK FOR:**
- **Breaking news:** Stock market events, political announcements, natural disasters, sports upsets, tech launches, global crises discussed in real-time.
- **Celebrity mentions:** Reactions to celebrity drama, scandals, tweets, deaths, marriages, arrests — any A-list name.
- **Viral trends:** References to trending hashtags, challenges, memes, viral videos/tweets currently blowing up.
- **Social media beef/drama:** Twitter beefs, community drama, streamer vs streamer conflicts.
- **Platform drama:** Bans, unbans, controversies, TOS violations, platform policy changes.
- **Hot takes:** Bold predictions, contrarian opinions, "I told you so" moments, insider knowledge.
- **Market reactions:** Crypto pumps/dumps, rug pulls, scam exposures, whale alerts, price crashes/moons.
- **Time signals:** "just happened", "breaking", "literally right now", "5 seconds ago", "just saw", "trending", "going viral", "everyone's talking about".
- **Urgency phrases:** "holy shit", "no way", "wait what", "are you serious", "did you see".
- ANY moment that references a specific person, event, or trend that is currently relevant or breaking.

**SCORING MODEL (0-100):**
- **Hook Power (25%)**: First 1-2 seconds must STOP THE SCROLL
- **Emotional Arousal (20%)**: High-arousal emotions (shock, outrage, excitement)
- **Shareability (25%)**: Quotable, debate-starting, "you NEED to see this"
- **Retention Curve (15%)**: Escalating tension, satisfying payoff
- **Platform Fit (10%)**: Duration sweet spots (15-60s ideal)
- **Creator Factor (5%)**: For viral creators, personality IS content

**NEWS BOOST**: If the clip directly references current events from TheNewsAPI system context, boost score by 5-15 points based on connection strength.`;

  const id = generateId();
  const now = timestamp();

  try {
    await db.execute(
      'INSERT INTO prompts (id, name, content, user_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
      [id, 'Breaking News & Trending Viral', breakingNewsPromptContent, now, now]
    );
  } catch (error) {
    throw error;
  }
}

// Seed IRL / Just Chatting prompt
export async function seedIrlPrompt(): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM prompts WHERE name = ? AND user_id IS NULL', [
    'IRL & Just Chatting Clip Detector',
  ]);

  const irlPromptContent = `Analyze this IRL / Just Chatting stream transcript and identify the most valuable short-form clips for TikTok/Reels/Shorts/X.

**DETECTION PHILOSOPHY:**
- Be selective: every clip must have a first-3-second hook that makes a viewer react.
- Prioritize human tension, awkwardness, charm, confrontation, vulnerability, surprise, and personality chemistry.
- Keep general viral moments active even if they are not strictly IRL. If a non-category moment is stronger, return it.

**DURATION POLICY:**
- Primary target: 30-45s.
- Short exception: 10-29s only for extreme standalone reactions, memes, or soundbites.
- Long exception: 46-90s only when full social context is truly needed.
- Above 90s requires a concrete exception_reason.

**WHAT TO LOOK FOR:**
- Public interactions, confrontations, awkward pauses, flirtation, social tension, crowd/chat reactions.
- Bold claims, hot takes, confessions, unexpected vulnerability, weird behavior, quotable one-liners.
- Energy shifts: calm→chaos, confident→embarrassed, serious→laughing.

**RETURN REQUIREMENTS:**
- Include scoring fields: hook_score, retention_score, shareability_score, trend_score, platform_fit_score, creator_factor_score, duration_policy, exception_reason.
- Clips must work with captions and make sense without explaining the backstory.`;

  const id = generateId();
  const now = timestamp();

  await db.execute(
    'INSERT INTO prompts (id, name, content, user_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
    [id, 'IRL & Just Chatting Clip Detector', irlPromptContent, now, now]
  );
}

// Seed Music / Performance prompt
export async function seedMusicPrompt(): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM prompts WHERE name = ? AND user_id IS NULL', [
    'Music & Performance Clip Detector',
  ]);

  const musicPromptContent = `Analyze this music/performance stream transcript and identify the most valuable short-form clips for TikTok/Reels/Shorts/X.

**DETECTION PHILOSOPHY:**
- Be selective: every clip must have a first-3-second hook or immediate performance reason to keep watching.
- Prioritize performance peaks, surprising talent, recognizable song moments, mistakes/recoveries, crowd/chat reactions, and emotional payoff.
- Keep general viral moments active even if they are not strictly music. If a non-category moment is stronger, return it.

**DURATION POLICY:**
- Primary target: 30-45s.
- Short exception: 10-29s only for a perfect vocal/instrumental hit, funny mistake, reaction, or meme soundbite.
- Long exception: 46-90s only when the build and payoff are both required.
- Above 90s requires a concrete exception_reason.

**WHAT TO LOOK FOR:**
- Beat drops, high notes, freestyle punchlines, audience/chat eruptions, unexpected skill, failed notes followed by recovery.
- Recognizable song lines, emotional delivery, collaboration chemistry, funny performance interruptions.

**RETURN REQUIREMENTS:**
- Include scoring fields: hook_score, retention_score, shareability_score, trend_score, platform_fit_score, creator_factor_score, duration_policy, exception_reason.
- Clips must work with captions and should preserve enough audio/performance context to feel satisfying.`;

  const id = generateId();
  const now = timestamp();

  await db.execute(
    'INSERT INTO prompts (id, name, content, user_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
    [id, 'Music & Performance Clip Detector', musicPromptContent, now, now]
  );
}
