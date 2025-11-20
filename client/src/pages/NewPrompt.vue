<template>
  <PageLayout
    title="New Prompt"
    description="Create a new AI prompt template for your video editing workflow"
    :show-header="true"
    :icon="MessageSquare"
  >
    <div>
      <!-- Main Form -->
      <div>
        <!-- Form Card -->
        <div class="bg-card border border-border rounded-md p-6 shadow-sm">
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Name Field -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label for="name" class="block text-sm font-medium text-foreground">
                  Prompt Name
                  <span class="text-red-500 ml-1">*</span>
                </label>
                <span class="text-xs text-muted-foreground">{{ formData.name.length }}/100</span>
              </div>
              <input
                id="name"
                ref="nameInput"
                v-model="formData.name"
                type="text"
                maxlength="100"
                placeholder="e.g., Viral Shorts Creator, Tutorial Intro Template"
                class="w-full px-3.5 py-2.5 bg-background border border-border rounded-md focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10 text-foreground placeholder:text-muted-foreground transition-all"
                required
              />
            </div>
            <!-- Content Field -->
            <div class="space-y-1.5">
              <label for="content" class="block text-sm font-medium text-foreground">
                Prompt Content
                <span class="text-red-500 ml-1">*</span>
              </label>
              <textarea
                id="content"
                v-model="formData.content"
                rows="20"
                placeholder="Write your AI prompt here... Be specific about the task and desired output."
                class="w-full px-3.5 py-2.5 bg-background border border-border rounded-md focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10 text-foreground placeholder:text-muted-foreground transition-all resize-vertical"
                required
              ></textarea>
            </div>
            <!-- Actions -->
            <div class="flex items-center justify-between">
              <button
                type="button"
                @click="handleCancel"
                class="px-5 py-2.5 text-muted-foreground hover:text-foreground font-medium transition-all flex items-center gap-2"
              >
                <ArrowLeft class="h-4 w-4" />
                Cancel
              </button>
              <div class="flex items-center gap-3">
                <button
                  v-if="formData.name || formData.content"
                  type="button"
                  @click="resetForm"
                  class="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-md font-medium transition-all flex items-center gap-2"
                >
                  <RotateCcw class="h-4 w-4" />
                  Reset
                </button>
                <button
                  type="submit"
                  :disabled="saving || !isFormValid"
                  class="px-5 py-2.5 bg-gradient-to-br from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-md font-medium shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
                >
                  <Save v-if="!saving" class="h-5 w-5" />
                  <Loader2 v-else class="animate-spin h-5 w-5" />
                  {{ saving ? 'Saving...' : 'Save Prompt' }}
                </button>
              </div>
            </div>
          </form>
        </div>
        <!-- Tips & Help - Bottom Section -->
        <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Quick Tips Card -->
          <div
            class="bg-gradient-to-br from-purple-500/5 to-indigo-500/5 border border-purple-500/20 rounded-md p-5 space-y-3"
          >
            <div class="flex items-center gap-2.5">
              <div class="p-1.5 bg-purple-500/10 rounded-md">
                <Star class="h-4 w-4 text-purple-500" />
              </div>

              <h3 class="font-medium text-foreground">Quick Tips</h3>
            </div>

            <ul class="space-y-2.5 text-sm text-muted-foreground">
              <li class="flex items-start gap-2">
                <Check class="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Be specific about the task and desired output</span>
              </li>

              <li class="flex items-start gap-2">
                <Check class="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Create reusable templates for common tasks</span>
              </li>

              <li class="flex items-start gap-2">
                <Check class="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Include context about video style and tone</span>
              </li>

              <li class="flex items-start gap-2">
                <Check class="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Test and refine your prompts iteratively</span>
              </li>
            </ul>
          </div>
          <!-- Example Templates Card -->
          <div class="bg-card border border-border rounded-md p-5 space-y-3">
            <div class="flex items-center gap-2.5">
              <div class="p-1.5 bg-muted rounded-md">
                <FileText class="h-4 w-4 text-foreground" />
              </div>

              <h3 class="font-medium text-foreground">Example Templates</h3>
            </div>

            <div class="space-y-2">
              <button
                v-for="(example, index) in examples"
                :key="index"
                type="button"
                @click="loadExample(example)"
                class="w-full text-left p-3 bg-muted/30 hover:bg-muted/50 rounded-md transition-all group border border-border/50 hover:border-foreground/20 hover:shadow-sm"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-foreground group-hover:text-foreground transition-colors mb-1">
                      {{ example.name }}
                    </p>

                    <p
                      class="text-xs text-muted-foreground group-hover:text-foreground/70 transition-colors line-clamp-2"
                    >
                      {{ example.preview }}
                    </p>
                  </div>
                  <ArrowRight
                    class="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-all flex-shrink-0 group-hover:translate-x-0.5"
                  />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { createPrompt } from '@/services/database';
  import {
    MessageSquare,
    ArrowLeft,
    RotateCcw,
    Save,
    Loader2,
    Star,
    Check,
    FileText,
    ArrowRight,
  } from 'lucide-vue-next';
  import { useToast } from '@/composables/useToast';
  import PageLayout from '@/components/PageLayout.vue';

  const router = useRouter();
  const { success, error } = useToast();
  const saving = ref(false);
  const nameInput = ref<HTMLInputElement | null>(null);
  const nameError = ref('');
  const contentError = ref('');

  const formData = reactive({
    name: '',
    content: '',
  });

  interface Example {
    name: string;
    preview: string;
    content: string;
  }

  const examples: Example[] = [
    {
      name: 'Default Clip Detector',
      preview: 'Comprehensive clip detection for TikTok, Shorts, and X - optimized for viral moments',
      content: `Analyze this stream transcript and identify ALL clip-worthy moments for TikTok/Shorts/X.

**DETECTION PHILOSOPHY:**
- BIAS TOWARDS FINDING CLIPS — when in doubt, include it, BUT NEVER at the cost of coherence.
- Prioritize moments that stand alone: a clear setup → development → payoff.
- Extract moments at different stages: setup, peak, aftermath, reactions.
- Lower your threshold — if something stands out from normal conversation, it's likely clip-worthy.

**CLIP QUALITY & BOUNDARY RULES:**
1) Start of clip MUST be a natural beginning of a sentence or thought.
   - Avoid starting mid-sentence or on connective fillers ("and", "so", "but", "because", "like") unless they naturally begin a new bit.
   - If the hook begins mid-thought, scan backward within the chunk to the prior sentence boundary, speaker turn, or a pause ≥ 0.35s.
   - Add a pre-roll pad of 0.15–0.30s before the first spoken word (if available in the chunk).
2) End of clip MUST complete the thought.
   - Extend to the end of the sentence or the natural resolution/punchline.
   - Do NOT end at the first word of a new sentence. Stop just before the next sentence begins, then add a post-roll pad of 0.30–0.60s.
   - Prefer ending at ., ?, !, or at a pause ≥ 0.45s.
3) Consistency & coherence.
   - The clip should make sense without external context. Include the smallest necessary setup for clarity.
   - If a complete coherent thought cannot fit within duration limits, SKIP it.
4) Spliced clips.
   - Each segment must independently follow the same start/end rules (sentence boundary + pads).
   - Segments must be chronological, non-overlapping, and thematically unified.
   - Only splice to remove dull filler between high-value moments or to tighten a single topic.
5) Hard constraints.
   - Minimum 15s, maximum 120s total per clip.
   - Prefer 20–75s when possible for short-form platforms.

**WHAT TO LOOK FOR:**
- Strong emotions or shifts; humor/awkwardness; drama/tension/conflict; surprises/reveals; bold claims; unusual behavior; struggle/vulnerability; high energy; relatable/resonant lines; quotable statements; notable reactions or audience moments.`,
    },
  ];

  const isFormValid = computed(() => {
    return formData.name.trim().length > 0 && formData.content.trim().length > 0;
  });

  function resetForm() {
    formData.name = '';
    formData.content = '';
    nameInput.value?.focus();
  }

  function loadExample(example: Example) {
    formData.name = example.name;
    formData.content = example.content;
    nameError.value = '';
    contentError.value = '';
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit() {
    if (!isFormValid.value) {
      return;
    }

    saving.value = true;
    try {
      await createPrompt(formData.name.trim(), formData.content.trim());
      success('Prompt created', `"${formData.name.trim()}" has been created successfully`);
      // Navigate back to prompts list
      router.push('/prompts');
    } catch (err) {
      error('Failed to create prompt', 'An error occurred while creating the prompt. Please try again.');
    } finally {
      saving.value = false;
    }
  }

  function handleCancel() {
    router.push('/prompts');
  }

  onMounted(() => {
    // Auto-focus the name input
    nameInput.value?.focus();
  });
</script>
