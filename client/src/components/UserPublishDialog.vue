<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
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
                <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">Post to Instagram</h2>
                <p class="text-zinc-400 text-xs sm:text-sm mt-1">@{{ account.username }}</p>
              </div>

              <form @submit.prevent="publish" class="space-y-4 sm:space-y-5">
                <!-- Media Source Selection -->
                <div class="space-y-1.5 sm:space-y-2">
                  <label class="block text-xs sm:text-sm font-medium text-zinc-300">Media Source</label>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      @click="mediaSource = 'clip'"
                      :class="[
                        'p-3 rounded-lg border transition-all',
                        mediaSource === 'clip'
                          ? 'border-pink-500 bg-pink-500/10 text-white'
                          : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600',
                      ]"
                    >
                      <FileVideo class="h-5 w-5 mx-auto mb-1" />
                      <span class="text-xs font-medium">App Clips</span>
                    </button>
                    <button
                      type="button"
                      @click="mediaSource = 'upload'"
                      :class="[
                        'p-3 rounded-lg border transition-all',
                        mediaSource === 'upload'
                          ? 'border-pink-500 bg-pink-500/10 text-white'
                          : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600',
                      ]"
                    >
                      <Upload class="h-5 w-5 mx-auto mb-1" />
                      <span class="text-xs font-medium">Upload Video</span>
                    </button>
                  </div>
                </div>

                <!-- Media Selection based on source -->
                <div v-if="mediaSource === 'upload'" class="space-y-1.5 sm:space-y-2">
                  <label class="block text-xs sm:text-sm font-medium text-zinc-300">Select Video</label>
                  <input
                    type="file"
                    accept="video/*"
                    @change="handleFileSelect"
                    class="w-full px-3 py-2 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white text-sm"
                  />
                </div>

                <!-- Media Preview -->
                <div v-if="mediaUrl" class="space-y-1.5 sm:space-y-2">
                  <label class="block text-xs sm:text-sm font-medium text-zinc-300">Preview</label>
                  <div
                    class="relative aspect-video rounded-lg sm:rounded-xl overflow-hidden bg-zinc-800/50 border border-zinc-700/50"
                  >
                    <video v-if="mediaUrl" :src="mediaUrl" class="w-full h-full object-cover" controls />
                  </div>
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
  import { ref, computed } from 'vue';
  import { Instagram, FileVideo, Upload, Loader2 } from 'lucide-vue-next';
  import { useToast } from '@/composables/useToast';
  import { publishToUserInstagram, type UserInstagramAccount } from '@/services/userInstagramApi';

  const props = defineProps<{
    show: boolean;
    account: UserInstagramAccount;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'published'): void;
  }>();

  const { toast } = useToast();

  const mediaSource = ref<'clip' | 'upload'>('upload');
  const mediaUrl = ref('');
  const caption = ref('');
  const publishing = ref(false);
  const error = ref<string | null>(null);
  const selectedFile = ref<File | null>(null);

  const canPublish = computed(() => {
    return mediaUrl.value && !publishing.value;
  });

  const handleFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      selectedFile.value = file;
      mediaUrl.value = URL.createObjectURL(file);
    }
  };

  const publish = async () => {
    if (!canPublish.value) return;

    publishing.value = true;
    error.value = null;

    try {
      // For now, we'll assume the media is already uploaded
      // In a real implementation, you'd upload the file first
      const response = await publishToUserInstagram({
        account_id: props.account.id,
        media_url: mediaUrl.value,
        caption: caption.value,
        media_type: 'reel',
      });

      if (response.success) {
        toast({ title: 'Success', description: 'Post is being published to Instagram' });
        emit('published');
        emit('close');

        // Reset form
        mediaUrl.value = '';
        caption.value = '';
        selectedFile.value = null;
      } else {
        error.value = response.error || 'Failed to publish';
        toast({ title: 'Error', description: response.error || 'Failed to publish' });
      }
    } catch (err) {
      console.error('Failed to publish:', err);
      error.value = 'Failed to publish post. Please try again.';
      toast({ title: 'Error', description: 'Failed to publish' });
    } finally {
      publishing.value = false;
    }
  };
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
</style>
