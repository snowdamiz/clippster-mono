<template>
  <Teleport to="body">
    <Transition name="prompt-modal">
      <div v-if="show" class="prompt-modal__overlay" @click.self="closeDialog">
        <Transition name="prompt-dialog" appear>
          <div class="prompt-modal">
            <!-- Accent Bar -->
            <div class="prompt-modal__accent" />

            <!-- Header -->
            <div class="prompt-modal__header">
              <button class="prompt-modal__close" @click="closeDialog" title="Close">
                <X :size="18" />
              </button>
              <div class="prompt-modal__icon">
                <component :is="isEditing ? Pencil : MessageSquarePlus" :size="24" />
              </div>
              <h2 class="prompt-modal__title">
                {{ isSystemPrompt ? 'View System Prompt' : isEditing ? 'Edit Prompt' : 'Create Prompt' }}
              </h2>
              <p class="prompt-modal__subtitle">
                {{
                  isSystemPrompt ? 'System prompts are read-only and cannot be modified' : isEditing ? 'Update your AI prompt template' : 'Create a new AI prompt template for clip detection'
                }}
              </p>
            </div>

            <!-- Content -->
            <div class="prompt-content">
              <!-- Form Fields -->
              <div class="prompt-section">
                <h3 class="prompt-section__title">Prompt Details</h3>
                <div class="prompt-section__items">
                  <div class="prompt-field">
                    <div class="prompt-field__header">
                      <label for="prompt-name" class="prompt-field__label">
                        Name
                        <span class="prompt-field__required">*</span>
                      </label>
                      <span class="prompt-field__counter">{{ formData.name.length }}/100</span>
                    </div>
                    <input
                      id="prompt-name"
                      ref="nameInput"
                      v-model="formData.name"
                      type="text"
                      maxlength="100"
                      placeholder="e.g., Viral Shorts Creator"
                      class="prompt-field__input"
                      :readonly="isSystemPrompt"
                      :disabled="isSystemPrompt"
                    />
                  </div>

                  <div class="prompt-field">
                    <label for="prompt-content" class="prompt-field__label">
                      Content
                      <span class="prompt-field__required">*</span>
                    </label>
                    <textarea
                      id="prompt-content"
                      v-model="formData.content"
                      rows="10"
                      placeholder="Write your AI prompt here... Be specific about the task and desired output."
                      class="prompt-field__textarea"
                      :readonly="isSystemPrompt"
                      :disabled="isSystemPrompt"
                    />
                  </div>
                </div>
              </div>

              <!-- Quick Templates -->
              <div v-if="!isSystemPrompt" class="prompt-section">
                <h3 class="prompt-section__title">Quick Templates</h3>
                <div class="prompt-templates">
                  <button
                    v-for="(template, index) in templates"
                    :key="index"
                    type="button"
                    @click="loadTemplate(template)"
                    class="prompt-template-btn"
                  >
                    <div class="prompt-template-btn__content">
                      <FileText :size="14" class="prompt-template-btn__icon" />
                      <span class="prompt-template-btn__name">{{ template.name }}</span>
                    </div>
                    <ArrowRight :size="14" class="prompt-template-btn__arrow" />
                  </button>
                </div>
              </div>

              <!-- Tips -->
              <div v-if="!isSystemPrompt" class="prompt-tips">
                <div class="prompt-tips__icon">
                  <Lightbulb :size="14" />
                </div>
                <p class="prompt-tips__text">
                  <strong>Tip:</strong>
                  Be specific about the task, include context about video style, and test your prompts iteratively.
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div class="prompt-modal__footer">
              <button type="button" @click="closeDialog" :disabled="saving" class="prompt-btn prompt-btn--secondary">
                {{ isSystemPrompt ? 'Close' : 'Cancel' }}
              </button>
              <button v-if="!isSystemPrompt" @click="handleSubmit" :disabled="!isValid || saving" class="prompt-btn prompt-btn--primary">
                <Loader2 v-if="saving" :size="16" class="animate-spin" />
                <Save v-else :size="16" />
                {{ saving ? 'Saving...' : isEditing ? 'Update Prompt' : 'Create Prompt' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, nextTick } from 'vue';
  import { X, MessageSquarePlus, Pencil, Save, Loader2, FileText, ArrowRight, Lightbulb } from 'lucide-vue-next';
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

  const nameInput = ref<HTMLInputElement | null>(null);
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
        nameInput.value?.focus();
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

<style scoped>
  /* ===== Modal Overlay ===== */
  .prompt-modal__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  /* ===== Modal Container ===== */
  .prompt-modal {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 600px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Accent Bar ===== */
  .prompt-modal__accent {
    height: 3px;
    flex-shrink: 0;
    background: linear-gradient(90deg, #06b6d4, #0ea5e9, #3b82f6);
  }

  /* ===== Header ===== */
  .prompt-modal__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .prompt-modal__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .prompt-modal__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .prompt-modal__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    margin-bottom: 0.875rem;
    background-color: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
  }

  .prompt-modal__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .prompt-modal__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .prompt-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .prompt-content::-webkit-scrollbar {
    width: 6px;
  }

  .prompt-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .prompt-content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .prompt-content::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.25);
  }

  /* ===== Sections ===== */
  .prompt-section {
    margin-bottom: 1.25rem;
  }

  .prompt-section:last-of-type {
    margin-bottom: 1rem;
  }

  .prompt-section__title {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.625rem;
  }

  .prompt-section__items {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* ===== Form Fields ===== */
  .prompt-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .prompt-field__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .prompt-field__label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .prompt-field__required {
    color: #ef4444;
    margin-left: 0.125rem;
  }

  .prompt-field__counter {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .prompt-field__input,
  .prompt-field__textarea {
    width: 100%;
    padding: 0.625rem 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .prompt-field__input::placeholder,
  .prompt-field__textarea::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .prompt-field__input:focus,
  .prompt-field__textarea:focus {
    outline: none;
    border-color: transparent;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
  }

  .prompt-field__textarea {
    resize: vertical;
    min-height: 120px;
    font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
    font-size: 0.8125rem;
    line-height: 1.6;
  }

  /* ===== Templates ===== */
  .prompt-templates {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .prompt-template-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .prompt-template-btn:hover {
    background-color: var(--sidebar-active);
    border-color: rgba(6, 182, 212, 0.3);
  }

  .prompt-template-btn__content {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .prompt-template-btn__icon {
    color: var(--sidebar-text-muted);
  }

  .prompt-template-btn__name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .prompt-template-btn__arrow {
    color: var(--sidebar-text-muted);
    transition: transform 150ms ease;
  }

  .prompt-template-btn:hover .prompt-template-btn__arrow {
    transform: translateX(2px);
    color: #06b6d4;
  }

  /* ===== Tips ===== */
  .prompt-tips {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.875rem;
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.15);
    border-radius: 8px;
  }

  .prompt-tips__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background-color: rgba(6, 182, 212, 0.15);
    border-radius: 6px;
    color: #06b6d4;
    flex-shrink: 0;
  }

  .prompt-tips__text {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
    margin: 0;
  }

  .prompt-tips__text strong {
    color: var(--sidebar-text);
    font-weight: 600;
  }

  /* ===== Footer ===== */
  .prompt-modal__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: rgba(0, 0, 0, 0.2);
  }

  /* ===== Buttons ===== */
  .prompt-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
  }

  .prompt-btn--secondary {
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    color: var(--sidebar-text-muted);
  }

  .prompt-btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .prompt-btn--primary {
    background: linear-gradient(135deg, #06b6d4, #0ea5e9);
    color: white;
  }

  .prompt-btn--primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #0891b2, #0284c7);
  }

  .prompt-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ===== Modal Animations ===== */
  .prompt-modal-enter-active,
  .prompt-modal-leave-active {
    transition: opacity 200ms ease;
  }

  .prompt-modal-enter-from,
  .prompt-modal-leave-to {
    opacity: 0;
  }

  .prompt-dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .prompt-dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .prompt-dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .prompt-dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* ===== Utility Classes ===== */
  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
