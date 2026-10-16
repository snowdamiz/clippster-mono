<template>
  <Modal
    :open="show"
    :title="isSystemPrompt ? 'View system prompt' : isEditing ? 'Edit prompt' : 'New prompt'"
    :description="
      isSystemPrompt
        ? 'System prompts are read-only and cannot be modified'
        : isEditing
          ? 'Update your AI prompt template'
          : 'Create a new AI prompt template for clip detection'
    "
    :icon="isSystemPrompt ? Lock : isEditing ? Pencil : MessageSquarePlus"
    size="lg"
    :dismissible="!saving"
    :hide-close="saving"
    @close="closeDialog"
  >
    <div class="flex flex-col gap-4">
      <Field label="Name" for="prompt-name" :required="!isSystemPrompt">
        <template #label-end>
          <span v-if="!isSystemPrompt" class="tabular text-2xs text-fg-subtle">{{ formData.name.length }}/100</span>
        </template>
        <Input
          id="prompt-name"
          ref="nameInput"
          v-model="formData.name"
          type="text"
          maxlength="100"
          placeholder="e.g., Viral Shorts Creator"
          class="disabled:cursor-default disabled:opacity-100 disabled:text-fg-muted"
          :readonly="isSystemPrompt"
          :disabled="isSystemPrompt"
        />
      </Field>

      <Field
        label="Content"
        for="prompt-content"
        :required="!isSystemPrompt"
        :hint="
          isSystemPrompt
            ? undefined
            : 'Be specific about the task, include context about video style, and test your prompts iteratively.'
        "
      >
        <Textarea
          id="prompt-content"
          v-model="formData.content"
          rows="10"
          placeholder="Write your AI prompt here... Be specific about the task and desired output."
          class="h-[min(260px,calc(100vh-24rem))] min-h-[140px] resize-y font-mono text-xs leading-5 disabled:cursor-text disabled:opacity-100 disabled:text-fg-muted"
          :readonly="isSystemPrompt"
          :disabled="isSystemPrompt"
        />
      </Field>

      <Field v-if="!isSystemPrompt" label="Start from a template">
        <div class="flex flex-wrap gap-1.5">
          <Button
            v-for="(template, index) in templates"
            :key="index"
            type="button"
            variant="secondary"
            size="sm"
            @click="loadTemplate(template)"
          >
            <FileText />
            {{ template.name }}
          </Button>
        </div>
      </Field>
    </div>

    <template #footer>
      <Button variant="ghost" :disabled="saving" @click="closeDialog">{{ isSystemPrompt ? 'Close' : 'Cancel' }}</Button>
      <Button v-if="!isSystemPrompt" variant="primary" :disabled="!isValid || saving" :loading="saving" @click="handleSubmit">
        {{ saving ? 'Saving…' : isEditing ? 'Save changes' : 'Create prompt' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, computed, watch, nextTick } from 'vue';
  import { MessageSquarePlus, Pencil, Lock, FileText } from 'lucide-vue-next';
  import { Modal } from '@/components/ui/modal';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Textarea } from '@/components/ui/textarea';
  import { createPrompt, updatePrompt, type Prompt } from '@/services/database';
  import { useToast } from '@/composables/useToast';

  interface Props {
    show: boolean;
    prompt?: Prompt | null;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'saved'): void;
  }>();

  const { success, error } = useToast();

  const nameInput = ref<{ $el?: HTMLInputElement } | null>(null);
  const saving = ref(false);
  const formData = ref({
    name: '',
    content: '',
  });

  const isEditing = computed(() => !!props.prompt);

  const isSystemPrompt = computed(() => {
    if (!props.prompt) return false;
    return props.prompt.name === 'Default Clip Detector' || 
           props.prompt.name === 'Gaming Stream Clip Detector' || 
           props.prompt.name === 'Gambling Stream Clip Detector' ||
           props.prompt.name === 'Breaking News & Trending Viral';
  });

  const isValid = computed(() => {
    return formData.value.name.trim().length > 0 && formData.value.content.trim().length > 0;
  });

  interface Template {
    name: string;
    content: string;
  }

  const templates: Template[] = [
    {
      name: 'Viral Clip Detector',
      content: `Analyze this stream transcript and identify ALL potential clip-worthy moments for TikTok/Shorts/X.

**DETECTION PHILOSOPHY:**
- EXTREME BIAS TOWARDS FINDING CLIPS — when in doubt, INCLUDE IT.
- It is better to provide a "maybe" clip than to miss a good one.
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
   - Minimum 10s, maximum 180s total per clip.
   - Prefer 15–90s when possible for short-form platforms.

**WHAT TO LOOK FOR:**
- Strong emotions or shifts; humor/awkwardness; drama/tension/conflict; surprises/reveals; bold claims; unusual behavior; struggle/vulnerability; high energy; relatable/resonant lines; quotable statements; notable reactions or audience moments.
- ANY interaction that feels "human" or "authentic".`,
    },
    {
      name: 'Breaking News & Trending Viral',
      content: `Detect ULTRA-VIRAL, time-sensitive content that capitalizes on breaking news, trending topics, and cultural zeitgeist.

**PRIORITY DETECTION SIGNALS:**

**1. BREAKING NEWS & CURRENT EVENTS:**
- Stock market crashes/surges mentioned within minutes/hours
- Political events, elections, policy announcements in real-time
- Natural disasters, major accidents, global crises as they unfold
- Sports events (game-winning plays, upsets, records) discussed live
- Tech announcements (launches, failures, CEO drama)
- Signal phrases: "just happened", "breaking", "literally right now", "5 seconds ago", "just saw", "holy shit did you see"

**2. CELEBRITY & INFLUENCER MENTIONS:**
- Reactions to celebrity drama, scandals, controversies
- Commentary on famous people's tweets/posts/statements
- Celebrity deaths, marriages, breakups, arrests
- Influencer beef, call-outs, exposés
- Signal: Names of A-list celebrities, politicians, athletes

**3. VIRAL TREND PARTICIPATION:**
- References to trending hashtags, challenges, memes
- "This is blowing up on X/TikTok right now"
- Reactions to viral videos, tweets, posts
- Signal phrases: "going viral", "trending on", "everyone's talking about"

**4. CONTROVERSIAL TAKES ON HOT TOPICS:**
- Bold predictions about trending events ("I told you so")
- Contrarian opinions on popular topics
- Hot takes aligning with/opposing trending narratives
- Insider knowledge or leaked information

**5. REAL-TIME MARKET/CRYPTO REACTIONS:**
- Live reactions to price movements, rug pulls, pumps/dumps
- Breaking news about coins, NFTs, tokens
- Scam exposures, hack announcements
- Major whale movements or exchange drama

**VIRALITY MULTIPLIERS (+20-30 to score):**
✅ Mentioned within 1 hour of event occurring
✅ Unique angle or first-mover commentary
✅ Emotional authenticity (genuine shock, anger, excitement)
✅ Includes specific names, numbers, verifiable details
✅ "Receipts" or proof mentioned
✅ Prediction that came true or was proven wrong
✅ Insider perspective or exclusive information

**CONTENT STRUCTURE:**

**Hook (First 3 seconds) - CRITICAL:**
- Immediately reference the trending topic/person/event
- Use urgency: "BREAKING", "JUST IN", "WAIT WHAT"
- Name-drop celebrity/event/trend in first sentence

**Body:** Streamer's take, reaction, analysis with unique insights

**Payoff (Final 3 seconds):** Strong closing, quotable soundbite

**TIMESTAMP PRECISION:**
- Start 0.5-1.0s BEFORE topic mentioned (capture energy shift)
- Include FULL context of what they're reacting to
- End 0.5-1.0s AFTER final statement (let it land)
- Duration: 15-60s (shorter = more shareable)

**VIRALITY SCORING:**
- Base: 70-100 (trending content starts high)
- +30 if within 1 hour of event
- +20 if unique/contrarian take
- +15 if celebrity name-dropped
- +15 if specific details/numbers
- +10 if high emotional authenticity
- -20 if requires too much background
- -15 if trend is stale (>24 hours)

**DETECTION KEYWORDS:**
Breaking: "just broke", "breaking news", "just announced", "literally just", "seconds ago"
Trending: "trending", "viral", "blowing up", "everyone's talking", "all over my feed"
Celebrity: Actual names (Elon Musk, Trump, Drake, MrBeast, etc.)
Market: "crashed", "mooned", "rug pull", "just pumped", "whale alert"
Urgency: "holy shit", "no way", "wait what", "are you serious", "did you see"

**CRITICAL RULES:**
1. Prioritize recency - "just happened" gets highest scores
2. Name recognition matters - celebrity/brand mentions boost virality
3. Emotion is key - authentic reactions > analysis
4. Context completeness - viewer must understand what they're reacting to
5. Shareability - clip must work standalone
6. Time-sensitive - if trend is dead, clip won't perform

**AVOID:**
❌ Generic commentary without specific references
❌ Stale trends (>48 hours unless evergreen)
❌ Inside jokes requiring deep community knowledge
❌ Reactions without showing what they're reacting to
❌ Long setup - get to trending topic FAST`,
    },
  ];

  watch(
    () => props.show,
    async (newVal) => {
      if (newVal) {
        if (props.prompt) {
          formData.value = {
            name: props.prompt.name,
            content: props.prompt.content,
          };
        } else {
          formData.value = {
            name: '',
            content: '',
          };
        }
        await nextTick();
        nameInput.value?.$el?.focus?.();
      }
    }
  );

  function closeDialog() {
    if (!saving.value) {
      emit('close');
    }
  }

  function loadTemplate(template: Template) {
    formData.value.name = template.name;
    formData.value.content = template.content;
  }

  async function handleSubmit() {
    if (!isValid.value) return;

    saving.value = true;
    try {
      if (isEditing.value && props.prompt) {
        await updatePrompt(props.prompt.id, formData.value.name.trim(), formData.value.content.trim());
        success('Prompt Updated', `"${formData.value.name.trim()}" has been updated successfully`);
      } else {
        await createPrompt(formData.value.name.trim(), formData.value.content.trim());
        success('Prompt Created', `"${formData.value.name.trim()}" has been created successfully`);
      }
      emit('saved');
      emit('close');
    } catch (err: any) {
      console.error('Failed to save prompt:', err);
      error('Save Failed', err.message || 'An error occurred while saving the prompt');
    } finally {
      saving.value = false;
    }
  }
</script>
