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
                <!-- Platform -->
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-zinc-300">Platform *</label>
                  <div class="relative">
                    <select
                      v-model="platform"
                      :disabled="submitting"
                      class="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/50 pr-10"
                    >
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="youtube">YouTube</option>
                      <option value="twitter">Twitter / X</option>
                    </select>
                    <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                <!-- Post URL -->
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-zinc-300">Post URL *</label>
                  <input
                    v-model="postUrl"
                    type="url"
                    :disabled="submitting"
                    placeholder="https://www.instagram.com/reel/..."
                    class="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                  <p v-if="urlError" class="text-xs text-red-400">{{ urlError }}</p>
                </div>

                <!-- Creator Profile (optional) -->
                <div v-if="creatorProfiles.length > 0" class="space-y-1.5">
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

                <!-- Caption (optional) -->
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-zinc-300">Caption (Optional)</label>
                  <textarea
                    v-model="caption"
                    :disabled="submitting"
                    rows="3"
                    maxlength="2200"
                    placeholder="Copy your post caption here..."
                    class="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  />
                </div>

                <!-- Analytics (optional) -->
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-zinc-300">Analytics (Optional)</label>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs text-zinc-500 mb-1">Views</label>
                      <input
                        v-model.number="viewCount"
                        type="number"
                        min="0"
                        :disabled="submitting"
                        placeholder="0"
                        class="w-full px-3 py-2 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-zinc-500 mb-1">Likes</label>
                      <input
                        v-model.number="likeCount"
                        type="number"
                        min="0"
                        :disabled="submitting"
                        placeholder="0"
                        class="w-full px-3 py-2 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      />
                    </div>
                  </div>
                </div>

                <!-- Notes (optional) -->
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-zinc-300">Notes (Optional)</label>
                  <textarea
                    v-model="notes"
                    :disabled="submitting"
                    rows="2"
                    placeholder="Any additional notes for the admin..."
                    class="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  />
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
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submitted', submission: any): void;
}>();

const { showToast } = useToast();

const platform = ref('instagram');
const postUrl = ref('');
const creatorProfileId = ref('');
const campaignId = ref('');
const caption = ref('');
const viewCount = ref<number | undefined>(undefined);
const likeCount = ref<number | undefined>(undefined);
const notes = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);
const urlError = ref<string | null>(null);

// Validate URL matches platform
watch([postUrl, platform], () => {
  if (!postUrl.value) {
    urlError.value = null;
    return;
  }

  const url = postUrl.value.toLowerCase();
  let valid = true;

  switch (platform.value) {
    case 'instagram':
      valid = url.includes('instagram.com') || url.includes('instagr.am');
      break;
    case 'tiktok':
      valid = url.includes('tiktok.com') || url.includes('vm.tiktok.com');
      break;
    case 'youtube':
      valid = url.includes('youtube.com') || url.includes('youtu.be');
      break;
    case 'twitter':
      valid = url.includes('twitter.com') || url.includes('x.com');
      break;
  }

  urlError.value = valid ? null : `URL doesn't match ${platform.value}`;
});

const canSubmit = computed(() => {
  return postUrl.value && !urlError.value;
});

// Reset form when dialog opens
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    resetForm();
  }
});

function resetForm() {
  platform.value = 'instagram';
  postUrl.value = '';
  creatorProfileId.value = '';
  campaignId.value = '';
  caption.value = '';
  viewCount.value = undefined;
  likeCount.value = undefined;
  notes.value = '';
  error.value = null;
  urlError.value = null;
}

async function submit() {
  if (!canSubmit.value) return;

  submitting.value = true;
  error.value = null;

  try {
    const response = await submitExternalPost(props.organizationId, {
      platform: platform.value,
      post_url: postUrl.value,
      caption: caption.value || undefined,
      creator_profile_id: creatorProfileId.value ? parseInt(creatorProfileId.value) : undefined,
      campaign_id: campaignId.value ? parseInt(campaignId.value) : undefined,
      clip_id: props.clipId,
      view_count: viewCount.value,
      like_count: likeCount.value,
      notes: notes.value || undefined,
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
