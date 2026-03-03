<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="tk-dialog__overlay" @click.self="$emit('close')">
        <Transition name="dialog" appear>
          <div v-if="open" class="tk-dialog" role="dialog" aria-modal="true">
            <div class="tk-dialog__accent"></div>

            <div class="tk-dialog__header">
              <button class="tk-dialog__close" @click="$emit('close')" :disabled="publishing" title="Close">
                <X :size="18" />
              </button>
              <div class="tk-dialog__icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.01a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.44z"/></svg>
              </div>
              <h2 class="tk-dialog__title">Publish to TikTok</h2>
              <p class="tk-dialog__subtitle">Share this clip to your connected TikTok account</p>
            </div>

            <div class="tk-dialog__content">
              <form @submit.prevent="publish" class="tk-dialog__form">
                <div class="tk-dialog__field">
                  <label class="tk-dialog__label">Media Preview</label>
                  <div class="tk-dialog__preview">
                    <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="Media preview" class="tk-dialog__preview-img" />
                    <div v-else class="tk-dialog__preview-empty"><FileVideo :size="32" /></div>
                    <div class="tk-dialog__preview-badge">{{ mediaType || 'Video' }}</div>
                  </div>
                </div>

                <div class="tk-dialog__field">
                  <label class="tk-dialog__label">TikTok Account *</label>
                  <div class="relative">
                    <button type="button" @click="showAccountDropdown = !showAccountDropdown" class="tk-dialog__input tk-dialog__dropdown-trigger" :disabled="publishing || loadingAccounts">
                      <span class="truncate">{{ selectedAccountLabel || 'Select an account...' }}</span>
                      <ChevronDown class="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform" :class="{ 'rotate-180': showAccountDropdown }" />
                    </button>
                    <div v-if="showAccountDropdown" class="tk-dialog__dropdown">
                      <template v-if="orgAccounts.length > 0">
                        <div class="tk-dialog__dropdown-group">{{ currentOrgName }} Accounts</div>
                        <button v-for="account in orgAccounts" :key="`org-${account.id}`" type="button" @click="selectAccount(`org:${account.id}`, `@${account.username}`)" class="tk-dialog__dropdown-item" :class="{ 'tk-dialog__dropdown-item--selected': selectedAccountValue === `org:${account.id}` }">
                          @{{ account.username }}
                        </button>
                      </template>
                      <template v-if="showPersonalAccounts && personalAccounts.length > 0">
                        <div class="tk-dialog__dropdown-group">My Personal Accounts</div>
                        <button v-for="account in personalAccounts" :key="`user-${account.id}`" type="button" @click="selectAccount(`user:${account.id}`, `@${account.username}`)" class="tk-dialog__dropdown-item" :class="{ 'tk-dialog__dropdown-item--selected': selectedAccountValue === `user:${account.id}` }">
                          @{{ account.username }}
                        </button>
                      </template>
                    </div>
                  </div>
                  <p v-if="allAccounts.length === 0 && !loadingAccounts" class="tk-dialog__field-hint tk-dialog__field-hint--warning">
                    No TikTok accounts available. Connect a personal account or ask an admin to assign you an organization account.
                  </p>
                </div>

                <div v-if="creatorProfiles.length > 0" class="tk-dialog__field">
                  <label class="tk-dialog__label">Creator Profile <span class="tk-dialog__label-hint">(optional)</span></label>
                  <div class="relative">
                    <button type="button" @click="showCreatorDropdown = !showCreatorDropdown" class="tk-dialog__input tk-dialog__dropdown-trigger" :disabled="publishing">
                      <span class="truncate">{{ selectedCreatorLabel || 'None' }}</span>
                      <ChevronDown class="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform" :class="{ 'rotate-180': showCreatorDropdown }" />
                    </button>
                    <div v-if="showCreatorDropdown" class="tk-dialog__dropdown">
                      <button type="button" @click="selectCreator('', 'None')" class="tk-dialog__dropdown-item" :class="{ 'tk-dialog__dropdown-item--selected': selectedCreatorProfileId === '' }">None</button>
                      <button v-for="profile in creatorProfiles" :key="profile.id" type="button" @click="selectCreator(String(profile.id), profile.name)" class="tk-dialog__dropdown-item" :class="{ 'tk-dialog__dropdown-item--selected': selectedCreatorProfileId === String(profile.id) }">{{ profile.name }}</button>
                    </div>
                  </div>
                  <p class="tk-dialog__field-hint">Associate this post with a creator profile for tracking</p>
                </div>

                <div class="tk-dialog__field">
                  <label for="tk-caption" class="tk-dialog__label">Caption</label>
                  <textarea id="tk-caption" v-model="caption" :disabled="publishing" rows="4" maxlength="2200" placeholder="Write a caption for your TikTok..." class="tk-dialog__input tk-dialog__textarea"></textarea>
                  <div class="tk-dialog__caption-info">
                    <p v-if="hashtagCount > 30" class="tk-dialog__field-hint tk-dialog__field-hint--error">Too many hashtags ({{ hashtagCount }}/30)</p>
                    <p class="tk-dialog__field-hint" style="margin-left: auto">{{ caption.length }} / 2,200</p>
                  </div>
                </div>

                <div v-if="schedulingEnabled" class="tk-dialog__field">
                  <div class="tk-dialog__toggle-row">
                    <label class="tk-dialog__label">Schedule for later</label>
                    <button type="button" @click="isScheduled = !isScheduled" :class="['tk-dialog__toggle', { 'tk-dialog__toggle--active': isScheduled }]" :disabled="publishing">
                      <span :class="['tk-dialog__toggle-thumb', { 'tk-dialog__toggle-thumb--active': isScheduled }]" />
                    </button>
                  </div>
                  <div v-if="isScheduled" class="tk-dialog__schedule-fields">
                    <div class="tk-dialog__schedule-row">
                      <div class="tk-dialog__field" style="flex: 1">
                        <label for="tk-scheduleDate" class="tk-dialog__label-sm">Date</label>
                        <input id="tk-scheduleDate" type="date" v-model="scheduleDate" :min="minDate" :disabled="publishing" class="tk-dialog__input" />
                      </div>
                      <div class="tk-dialog__field" style="flex: 1">
                        <label for="tk-scheduleTime" class="tk-dialog__label-sm">Time</label>
                        <input id="tk-scheduleTime" type="time" v-model="scheduleTime" :disabled="publishing" class="tk-dialog__input" />
                      </div>
                    </div>
                    <p v-if="scheduledDateTime" class="tk-dialog__field-hint" style="display: flex; align-items: center; gap: 0.375rem">
                      <Calendar :size="14" /> Will be published {{ formatScheduleTime(scheduledDateTime) }}
                    </p>
                    <p v-if="scheduleError" class="tk-dialog__field-hint tk-dialog__field-hint--error">{{ scheduleError }}</p>
                  </div>
                </div>

                <div v-if="error" class="tk-dialog__alert tk-dialog__alert--error">
                  <AlertCircle :size="16" />
                  <p class="tk-dialog__alert-text">{{ error }}</p>
                </div>
              </form>
            </div>

            <div class="tk-dialog__footer">
              <button @click="$emit('close')" :disabled="publishing" class="tk-dialog__btn tk-dialog__btn--secondary">Cancel</button>
              <button @click="publish" :disabled="!canPublish || publishing" class="tk-dialog__btn tk-dialog__btn--primary">
                <Loader2 v-if="publishing" :size="16" class="tk-dialog__spinner" />
                <Calendar v-else-if="isScheduled" :size="16" />
                <svg v-else viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.01a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.44z"/></svg>
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
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { FileVideo, Loader2, ChevronDown, Calendar, X, AlertCircle } from 'lucide-vue-next';
  import { useToast } from '@/composables/useToast';
  import { getMyAssignedAccounts, listSocialAccounts, publishPost, type SocialAccount } from '@/services/socialAccountsApi';
  import { listUserTiktokAccounts, publishToUserTiktok, type UserTiktokAccount } from '@/services/userTiktokApi';
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
  const personalAccounts = ref<UserTiktokAccount[]>([]);
  const allowPersonal = ref(true);
  const selectedAccountValue = ref('');
  const selectedAccountLabel = ref('');
  const selectedCreatorProfileId = ref('');
  const selectedCreatorLabel = ref('');
  const showAccountDropdown = ref(false);
  const showCreatorDropdown = ref(false);
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
  const hashtagCount = computed(() => (caption.value.match(/#\w+/g) || []).length);
  const minDate = computed(() => new Date().toISOString().split('T')[0]);
  const scheduledDateTime = computed(() => {
    if (!scheduleDate.value || !scheduleTime.value) return null;
    const dt = new Date(`${scheduleDate.value}T${scheduleTime.value}`);
    return isNaN(dt.getTime()) ? null : dt;
  });
  const canPublish = computed(() =>
    !!selectedAccountValue.value && !!props.mediaUrl && hashtagCount.value <= 30 &&
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

  function selectAccount(value: string, label: string) {
    selectedAccountValue.value = value;
    selectedAccountLabel.value = label;
    showAccountDropdown.value = false;
  }

  function selectCreator(value: string, label: string) {
    selectedCreatorProfileId.value = value;
    selectedCreatorLabel.value = label;
    showCreatorDropdown.value = false;
  }

  function handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      showAccountDropdown.value = false;
      showCreatorDropdown.value = false;
    }
  }

  onMounted(() => { document.addEventListener('click', handleClickOutside); });
  onUnmounted(() => { document.removeEventListener('click', handleClickOutside); });

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
        if (res.success) { orgAccounts.value = res.accounts.filter((a) => a.is_active && a.platform === 'tiktok'); }
      }
      const pRes = await listUserTiktokAccounts();
      if (pRes.success) { personalAccounts.value = pRes.accounts.filter((a) => a.is_active); }
      if (orgAccounts.value.length > 0) { selectAccount(`org:${orgAccounts.value[0].id}`, `@${orgAccounts.value[0].username}`); }
      else if (showPersonalAccounts.value && personalAccounts.value.length > 0) { selectAccount(`user:${personalAccounts.value[0].id}`, `@${personalAccounts.value[0].username}`); }
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
          platform: 'tiktok', media_url: props.mediaUrl, caption: caption.value,
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
          response = await publishToUserTiktok({
            account_id: selectedAccountId.value, media_url: props.mediaUrl,
            caption: caption.value, media_type: props.mediaType || 'video', thumbnail_url: props.thumbnailUrl,
            creator_profile_id: selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined,
            campaign_id: props.campaignId,
          });
        }
        if (response.success) {
          showToast('Post is being published to TikTok', 'success', 'social');
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
    selectedAccountValue.value = ''; selectedAccountLabel.value = ''; selectedCreatorProfileId.value = ''; selectedCreatorLabel.value = '';
    showAccountDropdown.value = false; showCreatorDropdown.value = false; caption.value = '';
    isScheduled.value = false; scheduleDate.value = ''; scheduleTime.value = ''; scheduleError.value = null;
  }
</script>

<style scoped>
  .tk-dialog__overlay { position: fixed; inset: 0; background-color: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 10000; }
  .tk-dialog { background-color: var(--sidebar-surface); border: 1px solid var(--sidebar-border); border-radius: 12px; width: 100%; max-width: 520px; margin: 1rem; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
  .tk-dialog__accent { height: 3px; background: linear-gradient(90deg, #00f2ea, #ff0050); flex-shrink: 0; }
  .tk-dialog__header { position: relative; display: flex; flex-direction: column; align-items: center; padding: 1.5rem 1.5rem 1rem; text-align: center; }
  .tk-dialog__close { position: absolute; top: 1rem; right: 1rem; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 6px; color: var(--sidebar-text-muted); cursor: pointer; transition: all 150ms ease; }
  .tk-dialog__close:hover:not(:disabled) { background-color: var(--sidebar-hover); color: var(--sidebar-text); }
  .tk-dialog__close:disabled { opacity: 0.5; cursor: not-allowed; }
  .tk-dialog__icon { display: flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 12px; background-color: rgba(0, 242, 234, 0.15); color: #00f2ea; margin-bottom: 0.875rem; }
  .tk-dialog__title { font-size: 1.25rem; font-weight: 700; color: var(--sidebar-text); margin: 0; letter-spacing: -0.02em; }
  .tk-dialog__subtitle { font-size: 0.8125rem; color: var(--sidebar-text-muted); margin: 0.25rem 0 0; }
  .tk-dialog__content { flex: 1; overflow-y: auto; padding: 0.5rem 1.5rem 1.5rem; }
  .tk-dialog__content::-webkit-scrollbar { width: 6px; }
  .tk-dialog__content::-webkit-scrollbar-track { background: transparent; }
  .tk-dialog__content::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.15); border-radius: 3px; }
  .tk-dialog__form { display: flex; flex-direction: column; gap: 1rem; }
  .tk-dialog__field { display: flex; flex-direction: column; gap: 0.5rem; }
  .tk-dialog__label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; font-weight: 500; color: var(--sidebar-text); }
  .tk-dialog__label-sm { font-size: 0.8125rem; font-weight: 500; color: var(--sidebar-text-muted); }
  .tk-dialog__label-hint { color: var(--sidebar-text-muted); font-weight: 400; font-size: 0.8125rem; }
  .tk-dialog__field-hint { font-size: 0.8125rem; color: var(--sidebar-text-muted); opacity: 0.8; }
  .tk-dialog__field-hint--warning { color: #fbbf24; opacity: 1; }
  .tk-dialog__field-hint--error { color: #f87171; opacity: 1; }
  .tk-dialog__input { width: 100%; padding: 0.75rem 1rem; font-size: 0.875rem; background-color: var(--sidebar-hover); border: 1px solid var(--sidebar-border); border-radius: 8px; color: var(--sidebar-text); transition: all 150ms ease; }
  .tk-dialog__input::placeholder { color: var(--sidebar-text-muted); opacity: 0.6; }
  .tk-dialog__input:focus { outline: none; border-color: var(--sidebar-accent); box-shadow: 0 0 0 2px rgba(6,182,212,0.15); }
  .tk-dialog__textarea { resize: none; min-height: 80px; }
  .tk-dialog__preview { position: relative; width: 100%; max-height: 400px; border-radius: 8px; overflow: hidden; background-color: rgba(0,0,0,0.3); border: 1px solid var(--sidebar-border); display: flex; align-items: center; justify-content: center; }
  .tk-dialog__preview-img { max-width: 100%; max-height: 400px; width: auto; height: auto; object-fit: contain; }
  .tk-dialog__preview-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--sidebar-text-muted); opacity: 0.3; }
  .tk-dialog__preview-badge { position: absolute; bottom: 0.5rem; right: 0.5rem; padding: 0.25rem 0.5rem; background-color: rgba(0,0,0,0.7); backdrop-filter: blur(4px); border-radius: 4px; font-size: 0.75rem; font-weight: 500; color: white; }
  .tk-dialog__dropdown-trigger { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
  .tk-dialog__dropdown-trigger:hover { border-color: rgba(255,255,255,0.1); }
  .tk-dialog__dropdown-trigger:disabled { opacity: 0.5; cursor: not-allowed; }
  .tk-dialog__dropdown { position: absolute; top: calc(100% + 0.5rem); left: 0; right: 0; background-color: var(--sidebar-surface); border: 1px solid var(--sidebar-border); border-radius: 8px; overflow: hidden; z-index: 10; max-height: 12rem; overflow-y: auto; }
  .tk-dialog__dropdown::-webkit-scrollbar { width: 6px; }
  .tk-dialog__dropdown::-webkit-scrollbar-track { background: transparent; }
  .tk-dialog__dropdown::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.15); border-radius: 3px; }
  .tk-dialog__dropdown-group { padding: 0.5rem 0.75rem 0.25rem; font-size: 0.75rem; font-weight: 600; color: var(--sidebar-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .tk-dialog__dropdown-item { display: block; width: 100%; text-align: left; padding: 0.625rem 0.75rem; border-radius: 5px; font-size: 0.875rem; color: var(--sidebar-text); transition: background-color 150ms ease; border: none; background: transparent; cursor: pointer; }
  .tk-dialog__dropdown-item:hover { background-color: var(--sidebar-hover); }
  .tk-dialog__dropdown-item--selected { background-color: rgba(6,182,212,0.15); color: var(--sidebar-accent); }
  .tk-dialog__caption-info { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .tk-dialog__toggle-row { display: flex; align-items: center; justify-content: space-between; }
  .tk-dialog__toggle { position: relative; display: inline-flex; height: 24px; width: 44px; align-items: center; border-radius: 9999px; background-color: rgba(255,255,255,0.1); border: 1px solid var(--sidebar-border); cursor: pointer; transition: all 150ms ease; }
  .tk-dialog__toggle:hover:not(:disabled) { background-color: rgba(255,255,255,0.15); }
  .tk-dialog__toggle:disabled { opacity: 0.5; cursor: not-allowed; }
  .tk-dialog__toggle--active { background-color: var(--sidebar-accent); border-color: var(--sidebar-accent); }
  .tk-dialog__toggle-thumb { display: inline-block; height: 16px; width: 16px; border-radius: 9999px; background-color: white; transform: translateX(4px); transition: transform 150ms ease; }
  .tk-dialog__toggle-thumb--active { transform: translateX(24px); }
  .tk-dialog__schedule-fields { display: flex; flex-direction: column; gap: 0.75rem; padding-top: 0.5rem; }
  .tk-dialog__schedule-row { display: flex; gap: 0.75rem; }
  .tk-dialog__alert { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.875rem; border-radius: 8px; }
  .tk-dialog__alert--error { background-color: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #f87171; }
  .tk-dialog__alert-text { font-size: 0.8125rem; line-height: 1.5; margin: 0; }
  .tk-dialog__footer { display: flex; gap: 0.625rem; padding: 1.25rem 1.5rem; border-top: 1px solid var(--sidebar-border); }
  .tk-dialog__btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem 1rem; font-size: 0.875rem; font-weight: 600; border-radius: 8px; border: none; cursor: pointer; transition: all 150ms ease; }
  .tk-dialog__btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .tk-dialog__btn--secondary { background-color: var(--sidebar-hover); color: var(--sidebar-text); border: 1px solid var(--sidebar-border); }
  .tk-dialog__btn--secondary:hover:not(:disabled) { background-color: var(--sidebar-active); border-color: rgba(255,255,255,0.1); }
  .tk-dialog__btn--primary { background: linear-gradient(135deg, #00f2ea 0%, #ff0050 100%); color: white; }
  .tk-dialog__btn--primary:hover:not(:disabled) { opacity: 0.9; }
  .tk-dialog__spinner { animation: tk-spin 0.8s linear infinite; }
  .modal-enter-active, .modal-leave-active { transition: opacity 200ms ease; }
  .modal-enter-from, .modal-leave-to { opacity: 0; }
  .dialog-enter-active { transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1); }
  .dialog-leave-active { transition: all 150ms ease-in; }
  .dialog-enter-from { opacity: 0; transform: scale(0.96) translateY(8px); }
  .dialog-leave-to { opacity: 0; transform: scale(0.98); }
  @keyframes tk-spin { to { transform: rotate(360deg); } }
</style>
