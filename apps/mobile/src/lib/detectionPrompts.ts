export interface DetectionPrompt {
  id: string;
  name: string;
  content: string;
}

const DEFAULT_CLIP_DETECTOR = `Analyze this stream transcript and identify ALL potential clip-worthy moments for TikTok/Shorts/X.

**DETECTION PHILOSOPHY:**
- Be selective: return moments with real stop-scroll potential, not filler.
- Strong hooks beat complete but slow context. If a clip does not grab attention in the first 1-3 seconds, skip it.
**VIRAL EDITING & CREATIVE REUSE:**
- **Find the "Meme":** Look for short, funny, out-of-context moments hidden inside longer conversations.
- **Creative Splicing:** You are encouraged to connect distant thoughts to create humor or highlight irony.
- **Overlap is Strategic:** If a moment works as a serious point AND a funny out-of-context soundbite, generate BOTH clips.
- Prioritize moments that stand alone, but also include funny/awkward/intense moments even if they are short.
- Lower your threshold SIGNIFICANTLY — if something stands out from normal conversation, it is clip-worthy.

**CLIP QUALITY & BOUNDARY RULES:**
1) Start of clip should be a natural beginning of a sentence or thought. Do NOT start with "And", "But", "Or", "So", "Then".
2) End of clip should complete the thought. Do NOT end on "and", "but", "or", "so".
3) Primary target: 30-45s. Short exception: 10-29s for extreme standalone reactions. Long exception: 46-90s only when setup/payoff is required.

**WHAT TO LOOK FOR:**
- Personality/banter/chemistry, IRL moments, energy shifts, strong emotions, humor, drama, surprises, quotable lines.`;

export const DEFAULT_DETECTION_PROMPTS: DetectionPrompt[] = [
  {
    id: 'default-clip-detector',
    name: 'Default Clip Detector',
    content: DEFAULT_CLIP_DETECTOR,
  },
  {
    id: 'gaming-stream-clip-detector',
    name: 'Gaming Stream Clip Detector',
    content: `Analyze this gaming stream transcript and identify ALL potential clip-worthy moments for TikTok/Shorts/X.

Be selective: every clip must have a first-3-second hook. Prioritize emotion and action over perfect context.

Look for: clutches, multi-kills, rage, hype, fails, teammate banter, trash talk, comeback moments, "WHAT" / "HOW" / "let's go" reactions.

Primary target 30-45s. Short 10-29s for standalone reactions. Long 46-90s only for full play arcs.`,
  },
  {
    id: 'gambling-stream-clip-detector',
    name: 'Gambling Stream Clip Detector',
    content: `Analyze this gambling stream transcript and identify ALL potential clip-worthy moments for TikTok/Shorts/X.

Prioritize stakes and reactions. Look for jackpots, brutal losses, bonus rounds, tilt, "max bet", "one more spin", near misses, and extreme emotional swings.

Primary target 30-45s. Short 10-29s for scream/reaction clips.`,
  },
  {
    id: 'breaking-news-trending-viral',
    name: 'Breaking News & Trending Viral',
    content: `Analyze this stream transcript and identify clip-worthy moments with PRIORITY on breaking news, trending topics, and time-sensitive viral content.

Look for celebrity names, current events, hot takes, "just happened", "trending", "going viral", and real-time reactions.

Primary target 30-45s.`,
  },
  {
    id: 'irl-just-chatting',
    name: 'IRL & Just Chatting Clip Detector',
    content: `Analyze this IRL / Just Chatting stream transcript and identify the most valuable short-form clips.

Prioritize human tension, awkwardness, charm, confrontation, vulnerability, surprise, and personality chemistry.

Primary target 30-45s.`,
  },
  {
    id: 'music-performance',
    name: 'Music & Performance Clip Detector',
    content: `Analyze this music/performance stream transcript and identify the most valuable short-form clips.

Prioritize performance peaks, recognizable song moments, mistakes/recoveries, crowd/chat reactions, and emotional payoff.

Primary target 30-45s.`,
  },
];
