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
            <div class="h-1 w-full bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 flex-shrink-0" />

            <div class="p-5 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar">
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
                <div class="space-y-1.5 sm:space-y-2">
                  <label class="block text-xs sm:text-sm font-medium text-zinc-300">Media Preview</label>
                  <div class="relative aspect-video rounded-lg sm:rounded-xl overflow-hidden bg-zinc-800/50 border border-zinc-700/50">
                    <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="Media preview" class="w-full h-full object-cover" />
                    <div v-else class="w-full h-full flex items-center justify-center">
                      <FileVideo class="h-10 w-10 sm:h-12 sm:w-12 text-zinc-500" />
                    </div>
                    <div class="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md text-xs text-white font-medium">
                      {{ mediaType || 'Video' }}
                    </div>
                  </div>
                </div>

                <div class="space-y-1.5 sm:space-y-2">
                  <label for="account" class="block text-xs sm:text-sm font-medium text-zinc-300">Instagram Account *</label>
                  <div class="relative">
                    <select
                      id="account"
                      v-model="selectedAccountValue"
                      class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all pr-10"
                      :disabled="publishing || loadingAccounts"
                    >
                      <option value="" disabled>Select an account</option>
                      <optgroup v-if="orgAccounts.length > 0" :label="currentOrgName + ' Accounts'">
                        <option v-for="account in orgAccounts" :key="`org-${account.id}`" :value="`org:${account.id}`">
                          @{{ account.username }}
                        </option>
                      </optgroup>
                      <optgroup v-if="showPersonalAccounts && personalAccounts.length > 0" label="My Personal Accounts">
                        <option v-for="account in personalAccounts" :key="`user-${account.id}`" :value="`user:${account.id}`">
                          @{{ account.username }}
                        </option>
                      </optgroup>
                    </select>
                    <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                  </div>
                  <p v-if="allAccounts.length === 0 && !loadingAccounts" class="text-xs text-amber-400/80">
                    No Instagram accounts available. Ask an admin to assign you an account.
                  </p>
                </div>

                <div v-if="creatorProfiles.length > 0" class="space-y-1.5 sm:space-y-2">
                  <label for="creator" class="block text-xs sm:text-sm font-medium text-zinc-300">Creator Profile (Optional)</label>
                  <div class="relative">
                    <select
                      id="creator"
                      v-model="selectedCreatorProfileId"
                      class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all pr-10"
                      :disabled="publishing"
                    >
                      <option value="">None</option>
                      <option v-for="profile in creatorProfiles" :key="profile.id" :value="String(profile.id)">{{ profile.name }}</option>
                    </select>
                    <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                  </div>
                  <p class="text-xs text-zinc-500">Associate this post with a creator profile for tracking</p>
                </div>

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

                <div v-if="schedulingEnabled" class="space-y-3">
                  <div class="flex items-center justify-between">
                    <label class="block text-xs sm:text-sm font-medium text-zinc-300">Schedule for later</label>
                    <button
                      type="button"
                      @click="isScheduled = !isScheduled"
                      :class="['relative inline-flex h-6 w-11 items-center rounded-full transition-colors', isScheduled ? 'bg-pink-600' : 'bg-zinc-700']"
                      :disabled="publishing"
                    >
                      <span :class="['inline-block h-4 w-4 transform rounded-full bg-white transition-transform', isScheduled ? 'translate-x-6' : 'translate-x-1']" />
                    </button>
                  </div>
                  <div v-if="isScheduled" class="space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                      <div class="space-y-1.5">
                        <label for="scheduleDate" class="block text-xs font-medium text-zinc-400">Date</label>
                        <input id="scheduleDate" type="date" v-model="scheduleDate" :min="minDate" :disabled="publishing" class="w-full px-3 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all" />
                      </div>
                      <div class="space-y-1.5">
                        <label for="scheduleTime" class="block text-xs font-medium text-zinc-400">Time</label>
                        <input id="scheduleTime" type="time" v-model="scheduleTime" :disabled="publishing" class="w-full px-3 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all" />
                      </div>
                    </div>
                    <p v-if="scheduledDateTime" class="text-xs text-zinc-400 flex items-center gap-1.5">
                      <Calendar class="h-3.5 w-3.5" />
                      Will be published {{ formatScheduleTime(scheduledDateTime) }}
                    </p>
                    <p v-if="scheduleError" class="text-xs text-red-400">{{ scheduleError }}</p>
                  </div>
                </div>

                <div v-if="error" class="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-red-500/10 border border-red-500/30">
                  <p class="text-red-400 text-xs sm:text-sm">{{ error }}</p>
                </div>

                <div class="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button type="button" @click="$emit('close')" :disabled="publishing" class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                    Cancel
                  </button>
                  <button type="submit" :disabled="!canPublish || publishing" class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
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
  import { Instagram, FileVideo, Loader2, ChevronDown, Calendar } from 'lucide-vue-next';
  import { useToast } from '@/composables/useToast';
  import { getMyAssignedAccounts, listSocialAccounts, publishPost, type SocialAccount } from '@/services/socialAccountsApi';
  import { listUserInstagramAccounts, publishToUserInstagram, type UserInstagramAccount } from '@/services/userInstagramApi';
  import { schedulePost } from '@/services/schedulingApi';
  import api from '@/services/api';

  interface CreatorProfile { id: number; name: string; }

  const props = withDefaults(
    defineProps<{
      open: boolean;
      mediaUrl: string;
      thumbnailUrl?: string;
      mediaType?: 'image' | 'video' | 'reel';
      clipId?: string;
      schedulingEnabled?: boolean;
      organizationId?: string | number;
      organizationName?: string;
      isAdmin?: boolean;
      creatorProfiles?: CreatorProfile[];
      campaignId?: number;
    }>(),
    { isAdmin: false, schedulingEnabled: true, creatorProfiles: () => [] }
  );

  const emit = defineEmits<{ (e: 'close'): void; (e: 'published', post: any): void; }>();
  const { showToast } = useToast();

  const loadingAccounts = ref(true);
  const orgAccounts = ref<SocialAccount[]>([]);
  const personalAccounts = ref<UserInstagramAccount[]>([]);
  const allowPersonalInstagram = ref(true);
  const selectedAccountValue = ref('');
  const selectedCreatorProfileId = ref('');
  const caption = ref('');
  const publishing = ref(false);
  const error = ref<string | null>(null);
  const isScheduled = ref(false);
  const scheduleDate = ref('');
  const scheduleTime = ref('');
  const scheduleError = ref<string | null>(null);

  const currentOrgName = computed(() => props.organizationName || 'Organization');
  const showPersonalAccounts = computed(() => !props.organizationId || allowPersonalInstagram.value);
  const allAccounts = computed(() => [...orgAccounts.value, ...(showPersonalAccounts.value ? personalAccounts.value : [])]);
  const selectedAccountType = computed(() => selectedAccountValue.value ? selectedAccountValue.value.split(':')[0] as 'org' | 'user' : null);
  const selectedAccountId = computed(() => selectedAccountValue.value ? parseInt(selectedAccountValue.value.split(':')[1]) : null);
  const hashtagCount = computed(() => (caption.value.match(/#\w+/g) || []).length);
  const minDate = computed(() => new Date().toISOString().split('T')[0]);
  const scheduledDateTime = computed(() => {
    if (!scheduleDate.value || !scheduleTime.value) return null;
    const dt = new Date(`${scheduleDate.value}T${scheduleTime.value}`);
    return isNaN(dt.getTime()) ? null : dt;
  });
  const canPublish = computed(() => !!selectedAccountValue.value && !!props.mediaUrl && hashtagCount.value <= 30 && (!isScheduled.value || (scheduledDateTime.value && !scheduleError.value)));

  watch([scheduleDate, scheduleTime], () => {
    if (!isScheduled.value || !scheduledDateTime.value) { scheduleError.value = null; return; }
    const minTime = new Date(Date.now() + 5 * 60 * 1000);
    scheduleError.value = scheduledDateTime.value < minTime ? 'Schedule time must be at least 5 minutes in the future' : null;
  });

  function formatScheduleTime(date: Date): string {
    const diffMs = date.getTime() - Date.now();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);
    let relative = diffMins < 60 ? `in ${diffMins} minutes` : diffHours < 24 ? `in ${diffHours} hours` : `in ${diffDays} days`;
    return `${relative} (${date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })})`;
  }

  watch(() => props.open, async (isOpen) => {
    if (isOpen) { await loadAccounts(); error.value = null; }
  }, { immediate: true });

  async function loadAccounts() {
    loadingAccounts.value = true;
    try {
      if (props.organizationId) {
        try {
          const orgRes = await api.get(`/organizations/${props.organizationId}`);
          if (orgRes.data.success) allowPersonalInstagram.value = orgRes.data.organization.allow_personal_instagram ?? true;
        } catch {}
        const res = props.isAdmin ? await listSocialAccounts(props.organizationId) : await getMyAssignedAccounts(props.organizationId);
        if (res.success) orgAccounts.value = res.accounts.filter(a => a.is_active && a.platform === 'instagram');
      }
      const pRes = await listUserInstagramAccounts();
      if (pRes.success) personalAccounts.value = pRes.accounts.filter(a => a.is_active);
      if (orgAccounts.value.length > 0) selectedAccountValue.value = `org:${orgAccounts.value[0].id}`;
      else if (showPersonalAccounts.value && personalAccounts.value.length > 0) selectedAccountValue.value = `user:${personalAccounts.value[0].id}`;
    } finally { loadingAccounts.value = false; }
  }

  async function publish() {
    if (!canPublish.value || !selectedAccountId.value) return;
    publishing.value = true;
    error.value = null;
    try {
      let response;
      if (isScheduled.value && scheduledDateTime.value) {
        const data: any = { platform: 'instagram', media_url: props.mediaUrl, caption: caption.value, media_type: props.mediaType || 'reel', thumbnail_url: props.thumbnailUrl, scheduled_at: scheduledDateTime.value.toISOString(), clip_id: props.clipId };
        if (selectedAccountType.value === 'org' && props.organizationId) {
          data.organization_id = Number(props.organizationId);
          data.social_account_id = selectedAccountId.value;
          data.creator_profile_id = selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined;
          data.campaign_id = props.campaignId;
        } else { data.user_social_account_id = selectedAccountId.value; }
        response = await schedulePost(data);
        if (response.success) { showToast(`Post scheduled for ${formatScheduleTime(scheduledDateTime.value)}`, 'success'); emit('published', response.post); emit('close'); resetForm(); }
        else { error.value = response.error || 'Failed to schedule'; showToast(response.error || 'Failed to schedule', 'error'); }
      } else {
        if (selectedAccountType.value === 'org' && props.organizationId) {
          response = await publishPost(props.organizationId, { social_account_id: selectedAccountId.value, creator_profile_id: selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined, media_url: props.mediaUrl, caption: caption.value, media_type: props.mediaType || 'reel', thumbnail_url: props.thumbnailUrl });
        } else {
          response = await publishToUserInstagram({ account_id: selectedAccountId.value, media_url: props.mediaUrl, caption: caption.value, media_type: props.mediaType || 'reel', thumbnail_url: props.thumbnailUrl });
        }
        if (response.success) { showToast('Post is being published to Instagram', 'success'); emit('published', response.post); emit('close'); resetForm(); }
        else { error.value = response.error || 'Failed to publish'; showToast(response.error || 'Failed to publish', 'error'); }
      }
    } catch (err) { console.error('Failed to publish:', err); error.value = 'Failed to publish post. Please try again.'; showToast('Failed to publish', 'error'); }
    finally { publishing.value = false; }
  }

  function resetForm() { selectedAccountValue.value = ''; selectedCreatorProfileId.value = ''; caption.value = ''; isScheduled.value = false; scheduleDate.value = ''; scheduleTime.value = ''; scheduleError.value = null; }
</script>

<style scoped>
  .modal-enter-active, .modal-leave-active { transition: opacity 0.3s ease; }
  .modal-enter-from, .modal-leave-to { opacity: 0; }
  .dialog-enter-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
  .dialog-leave-active { transition: all 0.2s ease-in; }
  .dialog-enter-from { opacity: 0; transform: scale(0.95) translateY(10px); }
  .dialog-leave-to { opacity: 0; transform: scale(0.98); }
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgb(63 63 70); border-radius: 3px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgb(82 82 91); }
  select option { background: rgb(24 24 27); color: white; padding: 8px; }
</style>
