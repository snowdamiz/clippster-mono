<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="yt-dialog__overlay" @click.self="$emit('close')">
        <Transition name="dialog" appear>
          <div v-if="open" class="yt-dialog" role="dialog" aria-modal="true">
            <div class="yt-dialog__accent"></div>

            <div class="yt-dialog__header">
              <button class="yt-dialog__close" @click="$emit('close')" :disabled="publishing" title="Close">
                <X :size="18" />
              </button>
              <div class="yt-dialog__icon">
                <Youtube :size="24" />
              </div>
              <h2 class="yt-dialog__title">Publish to YouTube</h2>
              <p class="yt-dialog__subtitle">Share this clip to your connected YouTube account</p>
            </div>

            <div class="yt-dialog__content">
              <form @submit.prevent="publish" class="yt-dialog__form">
                <div class="yt-dialog__field">
                  <label class="yt-dialog__label">Media Preview</label>
                  <div class="yt-dialog__preview">
                    <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="Media preview" class="yt-dialog__preview-img" />
                    <div v-else class="yt-dialog__preview-empty"><FileVideo :size="32" /></div>
                    <div class="yt-dialog__preview-badge">{{ mediaType || 'Video' }}</div>
                  </div>
                </div>

                <div class="yt-dialog__field">
                  <label for="yt-account" class="yt-dialog__label">YouTube Account *</label>
                  <div class="yt-dialog__select-wrapper">
                    <select id="yt-account" v-model="selectedAccountValue" class="yt-dialog__select" :disabled="publishing || loadingAccounts">
                      <option value="" disabled>Select an account</option>
                      <optgroup v-if="orgAccounts.length > 0" :label="currentOrgName + ' Accounts'">
                        <option v-for="account in orgAccounts" :key="`org-${account.id}`" :value="`org:${account.id}`">@{{ account.username }}</option>
                      </optgroup>
                      <optgroup v-if="showPersonalAccounts && personalAccounts.length > 0" label="My Personal Accounts">
                        <option v-for="account in personalAccounts" :key="`user-${account.id}`" :value="`user:${account.id}`">@{{ account.username }}</option>
                      </optgroup>
                    </select>
                    <ChevronDown class="yt-dialog__select-icon" :size="16" />
                  </div>
                  <p v-if="allAccounts.length === 0 && !loadingAccounts" class="yt-dialog__field-hint yt-dialog__field-hint--warning">
                    No YouTube accounts available. Connect a personal account or ask an admin to assign you an organization account.
                  </p>
                </div>

                <div v-if="creatorProfiles.length > 0" class="yt-dialog__field">
                  <label for="yt-creator" class="yt-dialog__label">Creator Profile <span class="yt-dialog__label-hint">(optional)</span></label>
                  <div class="yt-dialog__select-wrapper">
                    <select id="yt-creator" v-model="selectedCreatorProfileId" class="yt-dialog__select" :disabled="publishing">
                      <option value="">None</option>
                      <option v-for="profile in creatorProfiles" :key="profile.id" :value="String(profile.id)">{{ profile.name }}</option>
                    </select>
                    <ChevronDown class="yt-dialog__select-icon" :size="16" />
                  </div>
                  <p class="yt-dialog__field-hint">Associate this post with a creator profile for tracking</p>
                </div>

                <div class="yt-dialog__field">
                  <label for="yt-caption" class="yt-dialog__label">Description</label>
                  <textarea id="yt-caption" v-model="caption" :disabled="publishing" rows="4" maxlength="5000" placeholder="Write a description for your YouTube Short..." class="yt-dialog__input yt-dialog__textarea"></textarea>
                  <div class="yt-dialog__caption-info">
                    <p class="yt-dialog__field-hint" style="margin-left: auto">{{ caption.length }} / 5,000</p>
                  </div>
                </div>

                <div v-if="schedulingEnabled" class="yt-dialog__field">
                  <div class="yt-dialog__toggle-row">
                    <label class="yt-dialog__label">Schedule for later</label>
                    <button type="button" @click="isScheduled = !isScheduled" :class="['yt-dialog__toggle', { 'yt-dialog__toggle--active': isScheduled }]" :disabled="publishing">
                      <span :class="['yt-dialog__toggle-thumb', { 'yt-dialog__toggle-thumb--active': isScheduled }]" />
                    </button>
                  </div>
                  <div v-if="isScheduled" class="yt-dialog__schedule-fields">
                    <div class="yt-dialog__schedule-row">
                      <div class="yt-dialog__field" style="flex: 1">
                        <label for="yt-scheduleDate" class="yt-dialog__label-sm">Date</label>
                        <input id="yt-scheduleDate" type="date" v-model="scheduleDate" :min="minDate" :disabled="publishing" class="yt-dialog__input" />
                      </div>
                      <div class="yt-dialog__field" style="flex: 1">
                        <label for="yt-scheduleTime" class="yt-dialog__label-sm">Time</label>
                        <input id="yt-scheduleTime" type="time" v-model="scheduleTime" :disabled="publishing" class="yt-dialog__input" />
                      </div>
                    </div>
                    <p v-if="scheduledDateTime" class="yt-dialog__field-hint" style="display: flex; align-items: center; gap: 0.375rem">
                      <Calendar :size="14" /> Will be published {{ formatScheduleTime(scheduledDateTime) }}
                    </p>
                    <p v-if="scheduleError" class="yt-dialog__field-hint yt-dialog__field-hint--error">{{ scheduleError }}</p>
                  </div>
                </div>

                <div v-if="error" class="yt-dialog__alert yt-dialog__alert--error">
                  <AlertCircle :size="16" />
                  <p class="yt-dialog__alert-text">{{ error }}</p>
                </div>
              </form>
            </div>

            <div class="yt-dialog__footer">
              <button @click="$emit('close')" :disabled="publishing" class="yt-dialog__btn yt-dialog__btn--secondary">Cancel</button>
              <button @click="publish" :disabled="!canPublish || publishing" class="yt-dialog__btn yt-dialog__btn--primary">
                <Loader2 v-if="publishing" :size="16" class="yt-dialog__spinner" />
                <Calendar v-else-if="isScheduled" :size="16" />
                <Youtube v-else :size="16" />
                {{ publishing ? (isScheduled ? 'Scheduling...' : 'Publishing...') : (isScheduled ? 'Schedule' : 'Publish Now') }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { Youtube, FileVideo, Loader2, ChevronDown, Calendar, X, AlertCircle } from 'lucide-vue-next';
  import { useToast } from '@/composables/useToast';
  import { getMyAssignedAccounts, listSocialAccounts, publishPost, type SocialAccount } from '@/services/socialAccountsApi';
  import { listUserYoutubeAccounts, publishToUserYoutube, type UserYoutubeAccount } from '@/services/userYoutubeApi';
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
  const personalAccounts = ref<UserYoutubeAccount[]>([]);
  const allowPersonal = ref(true);
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
  const showPersonalAccounts = computed(() => !props.organizationId || allowPersonal.value);
  const allAccounts = computed(() => [...orgAccounts.value, ...(showPersonalAccounts.value ? personalAccounts.value : [])]);
  const selectedAccountType = computed(() => (selectedAccountValue.value ? (selectedAccountValue.value.split(':')[0] as 'org' | 'user') : null));
  const selectedAccountId = computed(() => (selectedAccountValue.value ? parseInt(selectedAccountValue.value.split(':')[1]) : null));
  const minDate = computed(() => new Date().toISOString().split('T')[0]);
  const scheduledDateTime = computed(() => {
    if (!scheduleDate.value || !scheduleTime.value) return null;
    const dt = new Date(`${scheduleDate.value}T${scheduleTime.value}`);
    return isNaN(dt.getTime()) ? null : dt;
  });
  const canPublish = computed(() =>
    !!selectedAccountValue.value && !!props.mediaUrl &&
    (!isScheduled.value || (scheduledDateTime.value && !scheduleError.value))
  );

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

  watch(() => props.open, async (isOpen) => { if (isOpen) { await loadAccounts(); error.value = null; } }, { immediate: true });

  async function loadAccounts() {
    loadingAccounts.value = true;
    try {
      if (props.organizationId) {
        try {
          const orgRes = await api.get(`/organizations/${props.organizationId}`);
          if (orgRes.data.success) { allowPersonal.value = orgRes.data.organization.allow_personal_instagram ?? true; }
        } catch {}
        const res = props.isAdmin ? await listSocialAccounts(props.organizationId) : await getMyAssignedAccounts(props.organizationId);
        if (res.success) { orgAccounts.value = res.accounts.filter((a) => a.is_active && a.platform === 'youtube'); }
      }
      const pRes = await listUserYoutubeAccounts();
      if (pRes.success) { personalAccounts.value = pRes.accounts.filter((a) => a.is_active); }
      if (orgAccounts.value.length > 0) { selectedAccountValue.value = `org:${orgAccounts.value[0].id}`; }
      else if (showPersonalAccounts.value && personalAccounts.value.length > 0) { selectedAccountValue.value = `user:${personalAccounts.value[0].id}`; }
    } finally { loadingAccounts.value = false; }
  }

  async function publish() {
    if (!canPublish.value || !selectedAccountId.value) return;
    publishing.value = true;
    error.value = null;
    try {
      let response;
      if (isScheduled.value && scheduledDateTime.value) {
        const data: any = {
          platform: 'youtube', media_url: props.mediaUrl, caption: caption.value,
          media_type: props.mediaType || 'video', thumbnail_url: props.thumbnailUrl,
          scheduled_at: scheduledDateTime.value.toISOString(), clip_id: props.clipId,
        };
        if (selectedAccountType.value === 'org' && props.organizationId) {
          data.organization_id = Number(props.organizationId);
          data.social_account_id = selectedAccountId.value;
          data.creator_profile_id = selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined;
          data.campaign_id = props.campaignId;
        } else {
          data.user_social_account_id = selectedAccountId.value;
          data.creator_profile_id = selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined;
          data.campaign_id = props.campaignId;
        }
        response = await schedulePost(data);
        if (response.success) {
          showToast(`Post scheduled for ${formatScheduleTime(scheduledDateTime.value)}`, 'success', 'social');
          emit('published', response.post); emit('close'); resetForm();
        } else { error.value = response.error || 'Failed to schedule'; showToast(response.error || 'Failed to schedule', 'error', 'social'); }
      } else {
        if (selectedAccountType.value === 'org' && props.organizationId) {
          response = await publishPost(props.organizationId, {
            social_account_id: selectedAccountId.value,
            creator_profile_id: selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined,
            media_url: props.mediaUrl, caption: caption.value,
            media_type: props.mediaType || 'video', thumbnail_url: props.thumbnailUrl,
          });
        } else {
          response = await publishToUserYoutube({
            account_id: selectedAccountId.value, media_url: props.mediaUrl,
            caption: caption.value, media_type: props.mediaType || 'video', thumbnail_url: props.thumbnailUrl,
            creator_profile_id: selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined,
            campaign_id: props.campaignId,
          });
        }
        if (response.success) {
          showToast('Post is being published to YouTube', 'success', 'social');
          emit('published', response.post); emit('close'); resetForm();
        } else { error.value = response.error || 'Failed to publish'; showToast(response.error || 'Failed to publish', 'error', 'social'); }
      }
    } catch (err) {
      console.error('Failed to publish:', err);
      error.value = 'Failed to publish post. Please try again.';
      showToast('Failed to publish', 'error', 'social');
    } finally { publishing.value = false; }
  }

  function resetForm() {
    selectedAccountValue.value = ''; selectedCreatorProfileId.value = ''; caption.value = '';
    isScheduled.value = false; scheduleDate.value = ''; scheduleTime.value = ''; scheduleError.value = null;
  }
</script>

<style scoped>
  .yt-dialog__overlay { position: fixed; inset: 0; background-color: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 10000; }
  .yt-dialog { background-color: var(--sidebar-surface); border: 1px solid var(--sidebar-border); border-radius: 12px; width: 100%; max-width: 520px; margin: 1rem; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
  .yt-dialog__accent { height: 3px; background: linear-gradient(90deg, #ff0000, #cc0000); flex-shrink: 0; }
  .yt-dialog__header { position: relative; display: flex; flex-direction: column; align-items: center; padding: 1.5rem 1.5rem 1rem; text-align: center; }
  .yt-dialog__close { position: absolute; top: 1rem; right: 1rem; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 6px; color: var(--sidebar-text-muted); cursor: pointer; transition: all 150ms ease; }
  .yt-dialog__close:hover:not(:disabled) { background-color: var(--sidebar-hover); color: var(--sidebar-text); }
  .yt-dialog__close:disabled { opacity: 0.5; cursor: not-allowed; }
  .yt-dialog__icon { display: flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 12px; background-color: rgba(255, 0, 0, 0.15); color: #ff0000; margin-bottom: 0.875rem; }
  .yt-dialog__title { font-size: 1.25rem; font-weight: 700; color: var(--sidebar-text); margin: 0; letter-spacing: -0.02em; }
  .yt-dialog__subtitle { font-size: 0.8125rem; color: var(--sidebar-text-muted); margin: 0.25rem 0 0; }
  .yt-dialog__content { flex: 1; overflow-y: auto; padding: 0.5rem 1.5rem 1.5rem; }
  .yt-dialog__content::-webkit-scrollbar { width: 6px; }
  .yt-dialog__content::-webkit-scrollbar-track { background: transparent; }
  .yt-dialog__content::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.15); border-radius: 3px; }
  .yt-dialog__form { display: flex; flex-direction: column; gap: 1rem; }
  .yt-dialog__field { display: flex; flex-direction: column; gap: 0.5rem; }
  .yt-dialog__label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; font-weight: 500; color: var(--sidebar-text); }
  .yt-dialog__label-sm { font-size: 0.8125rem; font-weight: 500; color: var(--sidebar-text-muted); }
  .yt-dialog__label-hint { color: var(--sidebar-text-muted); font-weight: 400; font-size: 0.8125rem; }
  .yt-dialog__field-hint { font-size: 0.8125rem; color: var(--sidebar-text-muted); opacity: 0.8; }
  .yt-dialog__field-hint--warning { color: #fbbf24; opacity: 1; }
  .yt-dialog__field-hint--error { color: #f87171; opacity: 1; }
  .yt-dialog__input { width: 100%; padding: 0.75rem 1rem; font-size: 0.875rem; background-color: var(--sidebar-hover); border: 1px solid var(--sidebar-border); border-radius: 8px; color: var(--sidebar-text); transition: all 150ms ease; }
  .yt-dialog__input::placeholder { color: var(--sidebar-text-muted); opacity: 0.6; }
  .yt-dialog__input:focus { outline: none; border-color: var(--sidebar-accent); box-shadow: 0 0 0 2px rgba(6,182,212,0.15); }
  .yt-dialog__textarea { resize: none; min-height: 80px; }
  .yt-dialog__preview { position: relative; width: 100%; max-height: 400px; border-radius: 8px; overflow: hidden; background-color: rgba(0,0,0,0.3); border: 1px solid var(--sidebar-border); display: flex; align-items: center; justify-content: center; }
  .yt-dialog__preview-img { max-width: 100%; max-height: 400px; width: auto; height: auto; object-fit: contain; }
  .yt-dialog__preview-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--sidebar-text-muted); opacity: 0.3; }
  .yt-dialog__preview-badge { position: absolute; bottom: 0.5rem; right: 0.5rem; padding: 0.25rem 0.5rem; background-color: rgba(0,0,0,0.7); backdrop-filter: blur(4px); border-radius: 4px; font-size: 0.75rem; font-weight: 500; color: white; }
  .yt-dialog__select-wrapper { position: relative; }
  .yt-dialog__select { width: 100%; padding: 0.75rem 2.5rem 0.75rem 1rem; font-size: 0.875rem; background-color: var(--sidebar-hover); border: 1px solid var(--sidebar-border); border-radius: 8px; color: var(--sidebar-text); cursor: pointer; transition: all 150ms ease; appearance: none; }
  .yt-dialog__select:focus { outline: none; border-color: var(--sidebar-accent); box-shadow: 0 0 0 2px rgba(6,182,212,0.15); }
  .yt-dialog__select:disabled { opacity: 0.5; cursor: not-allowed; }
  .yt-dialog__select option { background-color: var(--sidebar-surface); color: var(--sidebar-text); }
  .yt-dialog__select-icon { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: var(--sidebar-text-muted); pointer-events: none; }
  .yt-dialog__caption-info { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .yt-dialog__toggle-row { display: flex; align-items: center; justify-content: space-between; }
  .yt-dialog__toggle { position: relative; display: inline-flex; height: 24px; width: 44px; align-items: center; border-radius: 9999px; background-color: rgba(255,255,255,0.1); border: 1px solid var(--sidebar-border); cursor: pointer; transition: all 150ms ease; }
  .yt-dialog__toggle:hover:not(:disabled) { background-color: rgba(255,255,255,0.15); }
  .yt-dialog__toggle:disabled { opacity: 0.5; cursor: not-allowed; }
  .yt-dialog__toggle--active { background-color: var(--sidebar-accent); border-color: var(--sidebar-accent); }
  .yt-dialog__toggle-thumb { display: inline-block; height: 16px; width: 16px; border-radius: 9999px; background-color: white; transform: translateX(4px); transition: transform 150ms ease; }
  .yt-dialog__toggle-thumb--active { transform: translateX(24px); }
  .yt-dialog__schedule-fields { display: flex; flex-direction: column; gap: 0.75rem; padding-top: 0.5rem; }
  .yt-dialog__schedule-row { display: flex; gap: 0.75rem; }
  .yt-dialog__alert { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.875rem; border-radius: 8px; }
  .yt-dialog__alert--error { background-color: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #f87171; }
  .yt-dialog__alert-text { font-size: 0.8125rem; line-height: 1.5; margin: 0; }
  .yt-dialog__footer { display: flex; gap: 0.625rem; padding: 1.25rem 1.5rem; border-top: 1px solid var(--sidebar-border); }
  .yt-dialog__btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem 1rem; font-size: 0.875rem; font-weight: 600; border-radius: 8px; border: none; cursor: pointer; transition: all 150ms ease; }
  .yt-dialog__btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .yt-dialog__btn--secondary { background-color: var(--sidebar-hover); color: var(--sidebar-text); border: 1px solid var(--sidebar-border); }
  .yt-dialog__btn--secondary:hover:not(:disabled) { background-color: var(--sidebar-active); border-color: rgba(255,255,255,0.1); }
  .yt-dialog__btn--primary { background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%); color: white; }
  .yt-dialog__btn--primary:hover:not(:disabled) { opacity: 0.9; }
  .yt-dialog__spinner { animation: yt-spin 0.8s linear infinite; }
  .modal-enter-active, .modal-leave-active { transition: opacity 200ms ease; }
  .modal-enter-from, .modal-leave-to { opacity: 0; }
  .dialog-enter-active { transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1); }
  .dialog-leave-active { transition: all 150ms ease-in; }
  .dialog-enter-from { opacity: 0; transform: scale(0.96) translateY(8px); }
  .dialog-leave-to { opacity: 0; transform: scale(0.98); }
  @keyframes yt-spin { to { transform: rotate(360deg); } }
</style>
