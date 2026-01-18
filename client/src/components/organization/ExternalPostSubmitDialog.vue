<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]"
        @click.self="$emit('close')"
      >
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-4 border border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 flex-shrink-0" />

            <div class="p-6 overflow-y-auto custom-scrollbar">
              <!-- Header -->
              <div class="mb-6 text-center">
                <div
                  class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-purple-500/30 mb-4"
                >
                  <Link class="h-6 w-6 text-purple-400" />
                </div>
                <h2 class="text-xl font-bold text-white tracking-tight">Submit Post Link</h2>
                <p class="text-zinc-400 text-sm mt-1">
                  Share a post you've made on your personal account
                </p>
              </div>

              <form @submit.prevent="submit" class="space-y-4">
                <!-- Post URL (platform auto-detected) -->
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-zinc-300">Post URL *</label>
                  <input
                    v-model="postUrl"
                    type="url"
                    :disabled="submitting"
                    placeholder="Paste Instagram, TikTok, YouTube, or X post URL..."
                    class="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                  <!-- Detected platform badge -->
                  <div v-if="detectedPlatform" class="flex items-center gap-2 mt-1">
                    <span class="text-xs px-2 py-0.5 rounded-full" :class="platformBadgeClass">
                      {{ platformDisplayName }}
                    </span>
                    <span class="text-xs text-zinc-500">detected</span>
                  </div>
                  <p v-if="urlError" class="text-xs text-red-400">{{ urlError }}</p>
                </div>

                <!-- Creator Profile -->
                <div v-if="creatorProfiles.length > 0 && !preselectedCreatorProfileId" class="space-y-1.5">
                  <label class="block text-sm font-medium text-zinc-300">Creator Profile (Optional)</label>
                  <div class="relative">
                    <select
                      v-model="creatorProfileId"
                      :disabled="submitting"
                      class="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/50 pr-10"
                    >
                      <option value="">None</option>
                      <option v-for="profile in creatorProfiles" :key="profile.id" :value="String(profile.id)">
                        {{ profile.name }}
                      </option>
                    </select>
                    <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                <!-- Campaign (optional) -->
                <div v-if="campaigns.length > 0" class="space-y-1.5">
                  <label class="block text-sm font-medium text-zinc-300">Campaign (Optional)</label>
                  <div class="relative">
                    <select
                      v-model="campaignId"
                      :disabled="submitting"
                      class="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/50 pr-10"
                    >
                      <option value="">None</option>
                      <option v-for="campaign in campaigns" :key="campaign.id" :value="String(campaign.id)">
                        {{ campaign.name }}
                      </option>
                    </select>
                    <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                <!-- Error Display -->
                <div v-if="error" class="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                  <p class="text-red-400 text-sm">{{ error }}</p>
                </div>

                <!-- Actions -->
                <div class="flex gap-3 pt-4">
                  <button
                    type="button"
                    @click="$emit('close')"
                    :disabled="submitting"
                    class="flex-1 px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 disabled:opacity-50 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    :disabled="!canSubmit || submitting"
                    class="flex-1 px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold transition-all relative overflow-hidden group disabled:opacity-50 text-sm"
                  >
                    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <span v-if="submitting" class="relative flex items-center justify-center">
                      <Loader2 class="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </span>
                    <span v-else class="relative flex items-center justify-center">
                      <Send class="h-4 w-4 mr-2" />
                      Submit
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Link, ChevronDown, Loader2, Send } from 'lucide-vue-next';
import { useToast } from '@/composables/useToast';
import { submitExternalPost } from '@/services/schedulingApi';

interface CreatorProfile {
  id: number;
  name: string;
}

interface Campaign {
  id: number;
  name: string;
}

const props = defineProps<{
  open: boolean;
  organizationId: string | number;
  creatorProfiles: CreatorProfile[];
  campaigns: Campaign[];
  clipId?: string;
  preselectedCreatorProfileId?: number | string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submitted', submission: any): void;
}>();

const { showToast } = useToast();

const postUrl = ref('');
const creatorProfileId = ref('');
const detectedPlatform = ref<string | null>(null);
const campaignId = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);
const urlError = ref<string | null>(null);

// Auto-detect platform from URL
watch(postUrl, () => {
  if (!postUrl.value) {
    detectedPlatform.value = null;
    urlError.value = null;
    return;
  }

  const url = postUrl.value.toLowerCase();
  
  if (url.includes('instagram.com') || url.includes('instagr.am')) {
    detectedPlatform.value = 'instagram';
    urlError.value = null;
  } else if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
    detectedPlatform.value = 'tiktok';
    urlError.value = null;
  } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
    detectedPlatform.value = 'youtube';
    urlError.value = null;
  } else if (url.includes('twitter.com') || url.includes('x.com')) {
    detectedPlatform.value = 'twitter';
    urlError.value = null;
  } else {
    detectedPlatform.value = null;
    urlError.value = 'URL must be from Instagram, TikTok, YouTube, or X';
  }
});

// Platform display helpers
const platformDisplayName = computed(() => {
  switch (detectedPlatform.value) {
    case 'instagram': return 'Instagram';
    case 'tiktok': return 'TikTok';
    case 'youtube': return 'YouTube';
    case 'twitter': return 'X (Twitter)';
    default: return '';
  }
});

const platformBadgeClass = computed(() => {
  switch (detectedPlatform.value) {
    case 'instagram': return 'bg-pink-500/20 text-pink-400 border border-pink-500/30';
    case 'tiktok': return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
    case 'youtube': return 'bg-red-500/20 text-red-400 border border-red-500/30';
    case 'twitter': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    default: return 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30';
  }
});

const canSubmit = computed(() => {
  return postUrl.value && detectedPlatform.value && !urlError.value;
});

// Reset form when dialog opens
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    resetForm();
  }
});

function resetForm() {
  postUrl.value = '';
  detectedPlatform.value = null;
  // Use preselected creator profile if provided
  creatorProfileId.value = props.preselectedCreatorProfileId ? String(props.preselectedCreatorProfileId) : '';
  campaignId.value = '';
  error.value = null;
  urlError.value = null;
}

async function submit() {
  if (!canSubmit.value) return;

  submitting.value = true;
  error.value = null;

  try {
    const response = await submitExternalPost(props.organizationId, {
      platform: detectedPlatform.value!,
      post_url: postUrl.value,
      creator_profile_id: creatorProfileId.value ? parseInt(creatorProfileId.value) : undefined,
      campaign_id: campaignId.value ? parseInt(campaignId.value) : undefined,
      clip_id: props.clipId,
    });

    if (response.success) {
      showToast('Post submitted successfully', 'success');
      emit('submitted', response.submission);
      emit('close');
    } else {
      error.value = response.error || 'Failed to submit post';
      showToast(response.error || 'Failed to submit', 'error');
    }
  } catch (err) {
    console.error('Failed to submit post:', err);
    error.value = 'Failed to submit post. Please try again.';
    showToast('Failed to submit', 'error');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.dialog-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-leave-active {
  transition: all 0.2s ease-in;
}

.dialog-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.dialog-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgb(63 63 70);
  border-radius: 3px;
}

select option {
  background: rgb(24 24 27);
  color: white;
  padding: 8px;
}
</style>
