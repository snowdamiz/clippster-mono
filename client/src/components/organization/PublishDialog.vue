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
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md sm:max-w-lg w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 flex-shrink-0" />

            <div class="p-5 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar">
              <!-- Header -->
              <div class="mb-4 sm:mb-6 text-center">
                <div
                  class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-pink-500/30 mb-3 sm:mb-4"
                >
                  <Instagram class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-pink-400" />
                </div>
                <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">Publish to Instagram</h2>
                <p class="text-zinc-400 text-xs sm:text-sm mt-1">Share this clip to your connected Instagram account</p>
              </div>

              <form @submit.prevent="publish" class="space-y-4 sm:space-y-5">
                <!-- Media Preview -->
                <div class="space-y-1.5 sm:space-y-2">
                  <label class="block text-xs sm:text-sm font-medium text-zinc-300">Media Preview</label>
                  <div
                    class="relative aspect-video rounded-lg sm:rounded-xl overflow-hidden bg-zinc-800/50 border border-zinc-700/50"
                  >
                    <img
                      v-if="thumbnailUrl"
                      :src="thumbnailUrl"
                      alt="Media preview"
                      class="w-full h-full object-cover"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center">
                      <FileVideo class="h-10 w-10 sm:h-12 sm:w-12 text-zinc-500" />
                    </div>
                    <div
                      class="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md text-xs text-white font-medium"
                    >
                      {{ mediaType || 'Video' }}
                    </div>
                  </div>
                </div>

                <!-- Account Selection -->
                <div class="space-y-1.5 sm:space-y-2">
                  <label for="account" class="block text-xs sm:text-sm font-medium text-zinc-300">
                    Instagram Account *
                  </label>
                  <div class="relative">
                    <select
                      id="account"
                      v-model="selectedAccountId"
                      class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all pr-10"
                      :disabled="publishing"
                    >
                      <option value="" disabled>Select an account</option>
                      <option v-for="account in availableAccounts" :key="account.id" :value="String(account.id)">
                        @{{ account.username }}
                      </option>
                    </select>
                    <ChevronDown
                      class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none"
                    />
                  </div>
                  <p v-if="availableAccounts.length === 0" class="text-xs text-amber-400/80">
                    No Instagram accounts available. Ask an admin to assign you an account.
                  </p>
                </div>

                <!-- Creator Profile Selection (optional) -->
                <div v-if="creatorProfiles.length > 0" class="space-y-1.5 sm:space-y-2">
                  <label for="creator" class="block text-xs sm:text-sm font-medium text-zinc-300">
                    Creator Profile (Optional)
                  </label>
                  <div class="relative">
                    <select
                      id="creator"
                      v-model="selectedCreatorProfileId"
                      class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all pr-10"
                      :disabled="publishing"
                    >
                      <option value="">None</option>
                      <option v-for="profile in creatorProfiles" :key="profile.id" :value="String(profile.id)">
                        {{ profile.name }}
                      </option>
                    </select>
                    <ChevronDown
                      class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none"
                    />
                  </div>
                  <p class="text-xs text-zinc-500">Associate this post with a creator profile for tracking</p>
                </div>

                <!-- Caption -->
                <div class="space-y-1.5 sm:space-y-2">
                  <label for="caption" class="block text-xs sm:text-sm font-medium text-zinc-300">Caption</label>
                  <textarea
                    id="caption"
                    v-model="caption"
                    :disabled="publishing"
                    rows="4"
                    maxlength="2200"
                    class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all resize-y min-h-[100px]"
                    placeholder="Write a caption for your post..."
                  ></textarea>
                  <p class="text-xs text-zinc-500 text-right">{{ caption.length }} / 2,200</p>
                </div>

                <!-- Error Display -->
                <div v-if="error" class="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-red-500/10 border border-red-500/30">
                  <p class="text-red-400 text-xs sm:text-sm">{{ error }}</p>
                </div>

                <!-- Actions -->
                <div class="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button
                    type="button"
                    @click="$emit('close')"
                    :disabled="publishing"
                    class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    :disabled="!canPublish || publishing"
                    class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <div
                      class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                    />
                    <span v-if="publishing" class="relative flex items-center justify-center">
                      <Loader2 class="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin" />
                      Publishing...
                    </span>
                    <span v-else class="relative flex items-center justify-center">
                      <Instagram class="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Publish
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
  import { Instagram, FileVideo, Loader2, ChevronDown } from 'lucide-vue-next';
  import { useToast } from '@/composables/useToast';
  import {
    getMyAssignedAccounts,
    listSocialAccounts,
    publishPost,
    type SocialAccount,
  } from '@/services/socialAccountsApi';

  interface CreatorProfile {
    id: number;
    name: string;
  }

  const props = defineProps<{
    open: boolean;
    organizationId: string | number;
    mediaUrl: string;
    thumbnailUrl?: string;
    mediaType?: 'image' | 'video' | 'reel';
    isAdmin: boolean;
    creatorProfiles: CreatorProfile[];
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'published', post: any): void;
  }>();

  const { showToast } = useToast();

  const availableAccounts = ref<SocialAccount[]>([]);
  const selectedAccountId = ref('');
  const selectedCreatorProfileId = ref('');
  const caption = ref('');
  const postType = ref<'reel'>('reel');
  const publishing = ref(false);
  const loading = ref(true);
  const error = ref<string | null>(null);

  const canPublish = computed(() => {
    return selectedAccountId.value && props.mediaUrl;
  });

  // Load available accounts when dialog opens
  watch(
    () => props.open,
    async (isOpen) => {
      if (isOpen) {
        await loadAccounts();
        error.value = null;
      }
    },
    { immediate: true }
  );

  async function loadAccounts() {
    loading.value = true;
    try {
      // If admin, get all accounts; otherwise get assigned accounts
      const response = props.isAdmin
        ? await listSocialAccounts(props.organizationId)
        : await getMyAssignedAccounts(props.organizationId);

      if (response.success) {
        availableAccounts.value = response.accounts.filter((a) => a.is_active && a.platform === 'instagram');

        // Auto-select if only one account
        if (availableAccounts.value.length === 1) {
          selectedAccountId.value = String(availableAccounts.value[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      loading.value = false;
    }
  }

  async function publish() {
    if (!canPublish.value) return;

    publishing.value = true;
    error.value = null;

    try {
      const response = await publishPost(props.organizationId, {
        social_account_id: parseInt(selectedAccountId.value),
        creator_profile_id:
          selectedCreatorProfileId.value && selectedCreatorProfileId.value !== 'none'
            ? parseInt(selectedCreatorProfileId.value)
            : undefined,
        media_url: props.mediaUrl,
        caption: caption.value,
        media_type: postType.value,
        thumbnail_url: props.thumbnailUrl,
      });

      if (response.success) {
        showToast('Post is being published to Instagram', 'success');
        emit('published', response.post);
        emit('close');

        // Reset form
        selectedAccountId.value = '';
        selectedCreatorProfileId.value = '';
        caption.value = '';
        postType.value = 'reel';
      } else {
        error.value = response.error || 'Failed to publish';
        showToast(response.error || 'Failed to publish', 'error');
      }
    } catch (err) {
      console.error('Failed to publish:', err);
      error.value = 'Failed to publish post. Please try again.';
      showToast('Failed to publish', 'error');
    } finally {
      publishing.value = false;
    }
  }
</script>

<style scoped>
  /* Modal backdrop transition */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  /* Dialog transition */
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

  /* Custom scrollbar */
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

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgb(82 82 91);
  }

  /* Style native select dropdown arrow area */
  select option {
    background: rgb(24 24 27);
    color: white;
    padding: 8px;
  }
</style>
