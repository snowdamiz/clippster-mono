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
                  <div class="flex items-center justify-between">
                    <p v-if="hashtagCount > 30" class="text-xs text-red-400">Too many hashtags ({{ hashtagCount }}/30)</p>
                    <p class="text-xs text-zinc-500 text-right ml-auto">{{ caption.length }} / 2,200</p>
                  </div>
                </div>

                <!-- Schedule Toggle -->
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <label class="block text-xs sm:text-sm font-medium text-zinc-300">Schedule for later</label>
                    <button
                      type="button"
                      @click="isScheduled = !isScheduled"
                      :class="[
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        isScheduled ? 'bg-pink-600' : 'bg-zinc-700'
                      ]"
                      :disabled="publishing"
                    >
                      <span
                        :class="[
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                          isScheduled ? 'translate-x-6' : 'translate-x-1'
                        ]"
                      />
                    </button>
                  </div>

                  <!-- Date/Time Picker -->
                  <div v-if="isScheduled" class="space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                      <div class="space-y-1.5">
                        <label for="scheduleDate" class="block text-xs font-medium text-zinc-400">Date</label>
                        <input
                          id="scheduleDate"
                          type="date"
                          v-model="scheduleDate"
                          :min="minDate"
                          :disabled="publishing"
                          class="w-full px-3 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                        />
                      </div>
                      <div class="flex-1">
                        <label for="scheduleTime" class="block text-xs font-medium text-zinc-400">Time</label>
                        <CustomTimePicker
                          v-model="scheduleTime"
                          :disabled="publishing"
                        />
                      </div>
                    </div>
                    <p v-if="scheduledDateTime" class="text-xs text-zinc-400 flex items-center gap-1.5">
                      <Calendar class="h-3.5 w-3.5" />
                      Will be published {{ formatScheduleTime(scheduledDateTime) }}
                    </p>
                    <p v-if="scheduleError" class="text-xs text-red-400">{{ scheduleError }}</p>
                  </div>
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
                      {{ isScheduled ? 'Scheduling...' : 'Publishing...' }}
                    </span>
                    <span v-else class="relative flex items-center justify-center">
                      <Calendar v-if="isScheduled" class="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      <Instagram v-else class="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      {{ isScheduled ? 'Schedule' : 'Publish Now' }}
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
  import { Instagram, FileVideo, Upload, Loader2, Calendar } from 'lucide-vue-next';
  import CustomTimePicker from '@/components/CustomTimePicker.vue';
  import { useToast } from '@/composables/useToast';
  import { publishToUserInstagram, type UserInstagramAccount } from '@/services/userInstagramApi';
  import { schedulePost } from '@/services/schedulingApi';

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

  // Scheduling state
  const isScheduled = ref(false);
  const scheduleDate = ref('');
  const scheduleTime = ref('');
  const scheduleError = ref<string | null>(null);

  // Compute hashtag count
  const hashtagCount = computed(() => {
    const matches = caption.value.match(/#\w+/g);
    return matches ? matches.length : 0;
  });

  // Compute minimum date (today)
  const minDate = computed(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Compute scheduled datetime
  const scheduledDateTime = computed(() => {
    if (!scheduleDate.value || !scheduleTime.value) return null;
    const dateTime = new Date(`${scheduleDate.value}T${scheduleTime.value}`);
    return isNaN(dateTime.getTime()) ? null : dateTime;
  });

  // Validate schedule time
  watch([scheduleDate, scheduleTime], () => {
    if (!isScheduled.value || !scheduledDateTime.value) {
      scheduleError.value = null;
      return;
    }

    const now = new Date();
    const minTime = new Date(now.getTime() + 5 * 60 * 1000);

    if (scheduledDateTime.value < minTime) {
      scheduleError.value = 'Schedule time must be at least 5 minutes in the future';
    } else {
      scheduleError.value = null;
    }
  });

  // Format schedule time for display
  function formatScheduleTime(date: Date): string {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    let relative = '';
    if (diffMins < 60) relative = `in ${diffMins} minutes`;
    else if (diffHours < 24) relative = `in ${diffHours} hours`;
    else relative = `in ${diffDays} days`;

    const formatted = date.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    return `${relative} (${formatted})`;
  }

  const canPublish = computed(() => {
    const hasMedia = !!mediaUrl.value;
    const notPublishing = !publishing.value;
    const hashtagsValid = hashtagCount.value <= 30;
    const scheduleValid = !isScheduled.value || (scheduledDateTime.value && !scheduleError.value);

    return hasMedia && notPublishing && hashtagsValid && scheduleValid;
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
      let response;

      if (isScheduled.value && scheduledDateTime.value) {
        // Schedule the post for later
        response = await schedulePost({
          platform: 'instagram',
          media_url: mediaUrl.value,
          caption: caption.value,
          media_type: 'reel',
          scheduled_at: scheduledDateTime.value.toISOString(),
          user_social_account_id: props.account.id,
        });

        if (response.success) {
          toast({ title: 'Success', description: `Post scheduled for ${formatScheduleTime(scheduledDateTime.value)}`, category: 'social' });
          emit('published');
          emit('close');
          resetForm();
        } else {
          error.value = response.error || 'Failed to schedule';
          toast({ title: 'Error', description: response.error || 'Failed to schedule', category: 'social' });
        }
      } else {
        // Publish immediately
        response = await publishToUserInstagram({
          account_id: props.account.id,
          media_url: mediaUrl.value,
          caption: caption.value,
          media_type: 'reel',
        });

        if (response.success) {
          toast({ title: 'Success', description: 'Post is being published to Instagram', category: 'social' });
          emit('published');
          emit('close');
          resetForm();
        } else {
          error.value = response.error || 'Failed to publish';
          toast({ title: 'Error', description: response.error || 'Failed to publish', category: 'social' });
        }
      }
    } catch (err) {
      console.error('Failed to publish:', err);
      error.value = 'Failed to publish post. Please try again.';
      toast({ title: 'Error', description: 'Failed to publish', category: 'social' });
    } finally {
      publishing.value = false;
    }
  };

  function resetForm() {
    mediaUrl.value = '';
    caption.value = '';
    selectedFile.value = null;
    isScheduled.value = false;
    scheduleDate.value = '';
    scheduleTime.value = '';
    scheduleError.value = null;
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
</style>
