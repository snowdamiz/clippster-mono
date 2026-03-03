<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="twitter-dialog__overlay" @click.self="$emit('close')">
        <Transition name="dialog" appear>
          <div v-if="open" class="twitter-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="twitter-dialog__accent"></div>

            <!-- Header -->
            <div class="twitter-dialog__header">
              <button
                class="twitter-dialog__close"
                @click="$emit('close')"
                :disabled="publishing"
                title="Close"
              >
                <X :size="18" />
              </button>
              <div class="twitter-dialog__icon">
                <XLogo :size="24" />
              </div>
              <h2 class="twitter-dialog__title">Publish to X</h2>
              <p class="twitter-dialog__subtitle">Share this clip to your connected X (Twitter) account</p>
            </div>

            <!-- Content -->
            <div class="twitter-dialog__content">
              <form @submit.prevent="publish" class="twitter-dialog__form">
                <!-- Media Preview -->
                <div class="twitter-dialog__field">
                  <label class="twitter-dialog__label">Media Preview</label>
                  <div class="twitter-dialog__preview">
                    <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="Media preview" class="twitter-dialog__preview-img" />
                    <div v-else class="twitter-dialog__preview-empty">
                      <FileVideo :size="32" />
                    </div>
                    <div class="twitter-dialog__preview-badge">
                      {{ mediaType || 'Video' }}
                    </div>
                  </div>
                </div>

                <!-- X Account -->
                <div class="twitter-dialog__field">
                  <label class="twitter-dialog__label">X Account *</label>
                  <div class="relative">
                    <button
                      type="button"
                      @click="showAccountDropdown = !showAccountDropdown"
                      class="twitter-dialog__input twitter-dialog__dropdown-trigger"
                      :disabled="publishing || loadingAccounts"
                    >
                      <span class="truncate">
                        {{ selectedAccountLabel || 'Select an account...' }}
                      </span>
                      <ChevronDown
                        class="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform"
                        :class="{ 'rotate-180': showAccountDropdown }"
                      />
                    </button>
                    <div v-if="showAccountDropdown" class="twitter-dialog__dropdown">
                      <template v-if="orgAccounts.length > 0">
                        <div class="twitter-dialog__dropdown-group">{{ currentOrgName }} Accounts</div>
                        <button
                          v-for="account in orgAccounts"
                          :key="`org-${account.id}`"
                          type="button"
                          @click="selectAccount(`org:${account.id}`, `@${account.username}`)"
                          class="twitter-dialog__dropdown-item"
                          :class="{ 'twitter-dialog__dropdown-item--selected': selectedAccountValue === `org:${account.id}` }"
                        >
                          @{{ account.username }}
                        </button>
                      </template>
                      <template v-if="showPersonalAccounts && personalAccounts.length > 0">
                        <div class="twitter-dialog__dropdown-group">My Personal Accounts</div>
                        <button
                          v-for="account in personalAccounts"
                          :key="`user-${account.id}`"
                          type="button"
                          @click="selectAccount(`user:${account.id}`, `@${account.username}`)"
                          class="twitter-dialog__dropdown-item"
                          :class="{ 'twitter-dialog__dropdown-item--selected': selectedAccountValue === `user:${account.id}` }"
                        >
                          @{{ account.username }}
                        </button>
                      </template>
                    </div>
                  </div>
                  <p v-if="allAccounts.length === 0 && !loadingAccounts" class="twitter-dialog__field-hint twitter-dialog__field-hint--warning">
                    No X accounts available. Connect a personal account or ask an admin to assign you an organization account.
                  </p>
                </div>

                <!-- Creator Profile -->
                <div v-if="creatorProfiles.length > 0" class="twitter-dialog__field">
                  <label class="twitter-dialog__label">
                    Creator Profile
                    <span class="twitter-dialog__label-hint">(optional)</span>
                  </label>
                  <div class="relative">
                    <button
                      type="button"
                      @click="showCreatorDropdown = !showCreatorDropdown"
                      class="twitter-dialog__input twitter-dialog__dropdown-trigger"
                      :disabled="publishing"
                    >
                      <span class="truncate">
                        {{ selectedCreatorLabel || 'None' }}
                      </span>
                      <ChevronDown
                        class="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform"
                        :class="{ 'rotate-180': showCreatorDropdown }"
                      />
                    </button>
                    <div v-if="showCreatorDropdown" class="twitter-dialog__dropdown">
                      <button
                        type="button"
                        @click="selectCreator('', 'None')"
                        class="twitter-dialog__dropdown-item"
                        :class="{ 'twitter-dialog__dropdown-item--selected': selectedCreatorProfileId === '' }"
                      >
                        None
                      </button>
                      <button
                        v-for="profile in creatorProfiles"
                        :key="profile.id"
                        type="button"
                        @click="selectCreator(String(profile.id), profile.name)"
                        class="twitter-dialog__dropdown-item"
                        :class="{ 'twitter-dialog__dropdown-item--selected': selectedCreatorProfileId === String(profile.id) }"
                      >
                        {{ profile.name }}
                      </button>
                    </div>
                  </div>
                  <p class="twitter-dialog__field-hint">Associate this post with a creator profile for tracking</p>
                </div>

                <!-- Tweet Text -->
                <div class="twitter-dialog__field">
                  <label for="tw-caption" class="twitter-dialog__label">Tweet Text</label>
                  <textarea
                    id="tw-caption"
                    v-model="caption"
                    :disabled="publishing"
                    rows="3"
                    maxlength="280"
                    placeholder="What's happening?"
                    class="twitter-dialog__input twitter-dialog__textarea"
                  ></textarea>
                  <div class="twitter-dialog__caption-info">
                    <p v-if="caption.length > 280" class="twitter-dialog__field-hint twitter-dialog__field-hint--error">
                      Tweet exceeds 280 characters
                    </p>
                    <p :class="['twitter-dialog__field-hint', { 'twitter-dialog__field-hint--error': caption.length > 280 }]" style="margin-left: auto">
                      {{ caption.length }} / 280
                    </p>
                  </div>
                </div>

                <!-- Scheduling -->
                <div v-if="schedulingEnabled" class="twitter-dialog__field">
                  <div class="twitter-dialog__toggle-row">
                    <label class="twitter-dialog__label">Schedule for later</label>
                    <button
                      type="button"
                      @click="isScheduled = !isScheduled"
                      :class="['twitter-dialog__toggle', { 'twitter-dialog__toggle--active': isScheduled }]"
                      :disabled="publishing"
                    >
                      <span :class="['twitter-dialog__toggle-thumb', { 'twitter-dialog__toggle-thumb--active': isScheduled }]" />
                    </button>
                  </div>

                  <div v-if="isScheduled" class="twitter-dialog__schedule-fields">
                    <div class="twitter-dialog__schedule-row">
                      <div class="twitter-dialog__field" style="flex: 1">
                        <label for="tw-scheduleDate" class="twitter-dialog__label-sm">Date</label>
                        <input
                          id="tw-scheduleDate"
                          type="date"
                          v-model="scheduleDate"
                          :min="minDate"
                          :disabled="publishing"
                          class="twitter-dialog__input"
                        />
                      </div>
                      <div class="twitter-dialog__field" style="flex: 1">
                        <label for="tw-scheduleTime" class="twitter-dialog__label-sm">Time</label>
                        <input
                          id="tw-scheduleTime"
                          type="time"
                          v-model="scheduleTime"
                          :disabled="publishing"
                          class="twitter-dialog__input"
                        />
                      </div>
                    </div>
                    <p v-if="scheduledDateTime" class="twitter-dialog__field-hint" style="display: flex; align-items: center; gap: 0.375rem">
                      <Calendar :size="14" />
                      Will be published {{ formatScheduleTime(scheduledDateTime) }}
                    </p>
                    <p v-if="scheduleError" class="twitter-dialog__field-hint twitter-dialog__field-hint--error">
                      {{ scheduleError }}
                    </p>
                  </div>
                </div>

                <!-- Error Display -->
                <div v-if="error" class="twitter-dialog__alert twitter-dialog__alert--error">
                  <AlertCircle :size="16" />
                  <p class="twitter-dialog__alert-text">{{ error }}</p>
                </div>
              </form>
            </div>

            <!-- Footer -->
            <div class="twitter-dialog__footer">
              <button
                @click="$emit('close')"
                :disabled="publishing"
                class="twitter-dialog__btn twitter-dialog__btn--secondary"
              >
                Cancel
              </button>
              <button
                @click="publish"
                :disabled="!canPublish || publishing"
                class="twitter-dialog__btn twitter-dialog__btn--primary"
              >
                <Loader2 v-if="publishing" :size="16" class="twitter-dialog__spinner" />
                <Calendar v-else-if="isScheduled" :size="16" />
                <XLogo v-else :size="16" />
                {{ publishing ? (isScheduled ? 'Scheduling...' : 'Publishing...') : (isScheduled ? 'Schedule' : 'Post Now') }}
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
  import XLogo from '@/components/icons/XLogo.vue';
  import { useToast } from '@/composables/useToast';
  import { getMyAssignedAccounts, listSocialAccounts, publishPost, type SocialAccount } from '@/services/socialAccountsApi';
  import { listUserTwitterAccounts, publishToUserTwitter, type UserTwitterAccount } from '@/services/userTwitterApi';
  import { schedulePost } from '@/services/schedulingApi';
  import api from '@/services/api';

  interface CreatorProfile {
    id: number;
    name: string;
  }

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

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'published', post: any): void;
  }>();

  const { showToast } = useToast();

  const loadingAccounts = ref(true);
  const orgAccounts = ref<SocialAccount[]>([]);
  const personalAccounts = ref<UserTwitterAccount[]>([]);
  const allowPersonalTwitter = ref(true);
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
  const showPersonalAccounts = computed(() => !props.organizationId || allowPersonalTwitter.value);
  const allAccounts = computed(() => [...orgAccounts.value, ...(showPersonalAccounts.value ? personalAccounts.value : [])]);
  const selectedAccountType = computed(() => (selectedAccountValue.value ? (selectedAccountValue.value.split(':')[0] as 'org' | 'user') : null));
  const selectedAccountId = computed(() => (selectedAccountValue.value ? parseInt(selectedAccountValue.value.split(':')[1]) : null));
  const minDate = computed(() => new Date().toISOString().split('T')[0]);
  const scheduledDateTime = computed(() => {
    if (!scheduleDate.value || !scheduleTime.value) return null;
    const dt = new Date(`${scheduleDate.value}T${scheduleTime.value}`);
    return isNaN(dt.getTime()) ? null : dt;
  });
  const canPublish = computed(
    () =>
      !!selectedAccountValue.value &&
      !!props.mediaUrl &&
      caption.value.length <= 280 &&
      (!isScheduled.value || (scheduledDateTime.value && !scheduleError.value))
  );

  watch([scheduleDate, scheduleTime], () => {
    if (!isScheduled.value || !scheduledDateTime.value) {
      scheduleError.value = null;
      return;
    }
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

  onMounted(() => {
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });

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
    loadingAccounts.value = true;
    try {
      if (props.organizationId) {
        try {
          const orgRes = await api.get(`/organizations/${props.organizationId}`);
          if (orgRes.data.success) {
            allowPersonalTwitter.value = orgRes.data.organization.allow_personal_instagram ?? true;
          }
        } catch {}
        const res = props.isAdmin ? await listSocialAccounts(props.organizationId) : await getMyAssignedAccounts(props.organizationId);
        if (res.success) {
          orgAccounts.value = res.accounts.filter((a) => a.is_active && (a.platform === 'twitter' || a.platform === 'x'));
        }
      }
      const pRes = await listUserTwitterAccounts();
      if (pRes.success) {
        personalAccounts.value = pRes.accounts.filter((a) => a.is_active);
      }
      if (orgAccounts.value.length > 0) {
        selectAccount(`org:${orgAccounts.value[0].id}`, `@${orgAccounts.value[0].username}`);
      } else if (showPersonalAccounts.value && personalAccounts.value.length > 0) {
        selectAccount(`user:${personalAccounts.value[0].id}`, `@${personalAccounts.value[0].username}`);
      }
    } finally {
      loadingAccounts.value = false;
    }
  }

  async function publish() {
    if (!canPublish.value || !selectedAccountId.value) return;
    publishing.value = true;
    error.value = null;
    try {
      let response;
      if (isScheduled.value && scheduledDateTime.value) {
        const data: any = {
          platform: 'twitter',
          media_url: props.mediaUrl,
          caption: caption.value,
          media_type: props.mediaType || 'video',
          thumbnail_url: props.thumbnailUrl,
          scheduled_at: scheduledDateTime.value.toISOString(),
          clip_id: props.clipId,
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
          emit('published', response.post);
          emit('close');
          resetForm();
        } else {
          error.value = response.error || 'Failed to schedule';
          showToast(response.error || 'Failed to schedule', 'error', 'social');
        }
      } else {
        if (selectedAccountType.value === 'org' && props.organizationId) {
          response = await publishPost(props.organizationId, {
            social_account_id: selectedAccountId.value,
            creator_profile_id: selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined,
            media_url: props.mediaUrl,
            caption: caption.value,
            media_type: props.mediaType || 'video',
            thumbnail_url: props.thumbnailUrl,
          });
        } else {
          response = await publishToUserTwitter({
            account_id: selectedAccountId.value,
            media_url: props.mediaUrl,
            caption: caption.value,
            media_type: props.mediaType || 'video',
            thumbnail_url: props.thumbnailUrl,
            creator_profile_id: selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined,
            campaign_id: props.campaignId,
          });
        }
        if (response.success) {
          showToast('Post is being published to X', 'success', 'social');
          emit('published', response.post);
          emit('close');
          resetForm();
        } else {
          error.value = response.error || 'Failed to publish';
          showToast(response.error || 'Failed to publish', 'error', 'social');
        }
      }
    } catch (err) {
      console.error('Failed to publish:', err);
      error.value = 'Failed to publish post. Please try again.';
      showToast('Failed to publish', 'error', 'social');
    } finally {
      publishing.value = false;
    }
  }

  function resetForm() {
    selectedAccountValue.value = '';
    selectedAccountLabel.value = '';
    selectedCreatorProfileId.value = '';
    selectedCreatorLabel.value = '';
    showAccountDropdown.value = false;
    showCreatorDropdown.value = false;
    caption.value = '';
    isScheduled.value = false;
    scheduleDate.value = '';
    scheduleTime.value = '';
    scheduleError.value = null;
  }
</script>

<style scoped>
  /* ===== Overlay ===== */
  .twitter-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  /* ===== Dialog Container ===== */
  .twitter-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 520px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Accent Bar ===== */
  .twitter-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, #1a1a2e, #16213e);
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .twitter-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .twitter-dialog__close {
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

  .twitter-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .twitter-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .twitter-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background-color: rgba(29, 155, 240, 0.15);
    color: #1d9bf0;
    margin-bottom: 0.875rem;
  }

  .twitter-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .twitter-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .twitter-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .twitter-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .twitter-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .twitter-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Form ===== */
  .twitter-dialog__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ===== Form Field ===== */
  .twitter-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .twitter-dialog__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .twitter-dialog__label-sm {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
  }

  .twitter-dialog__label-hint {
    color: var(--sidebar-text-muted);
    font-weight: 400;
    font-size: 0.8125rem;
  }

  .twitter-dialog__field-hint {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    opacity: 0.8;
  }

  .twitter-dialog__field-hint--warning {
    color: #fbbf24;
    opacity: 1;
  }

  .twitter-dialog__field-hint--error {
    color: #f87171;
    opacity: 1;
  }

  .twitter-dialog__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .twitter-dialog__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .twitter-dialog__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .twitter-dialog__textarea {
    resize: none;
    min-height: 80px;
  }

  /* ===== Preview ===== */
  .twitter-dialog__preview {
    position: relative;
    width: 100%;
    max-height: 400px;
    border-radius: 8px;
    overflow: hidden;
    background-color: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--sidebar-border);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .twitter-dialog__preview-img {
    max-width: 100%;
    max-height: 400px;
    width: auto;
    height: auto;
    object-fit: contain;
  }

  .twitter-dialog__preview-empty {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sidebar-text-muted);
    opacity: 0.3;
  }

  .twitter-dialog__preview-badge {
    position: absolute;
    bottom: 0.5rem;
    right: 0.5rem;
    padding: 0.25rem 0.5rem;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    color: white;
  }

  /* ===== Custom Dropdown ===== */
  .twitter-dialog__dropdown-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  .twitter-dialog__dropdown-trigger:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .twitter-dialog__dropdown-trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .twitter-dialog__dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    right: 0;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    overflow: hidden;
    z-index: 10;
    max-height: 12rem;
    overflow-y: auto;
  }

  .twitter-dialog__dropdown::-webkit-scrollbar {
    width: 6px;
  }

  .twitter-dialog__dropdown::-webkit-scrollbar-track {
    background: transparent;
  }

  .twitter-dialog__dropdown::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .twitter-dialog__dropdown-group {
    padding: 0.5rem 0.75rem 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .twitter-dialog__dropdown-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.625rem 0.75rem;
    border-radius: 5px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    transition: background-color 150ms ease;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .twitter-dialog__dropdown-item:hover {
    background-color: var(--sidebar-hover);
  }

  .twitter-dialog__dropdown-item--selected {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  /* ===== Caption Info ===== */
  .twitter-dialog__caption-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  /* ===== Toggle ===== */
  .twitter-dialog__toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .twitter-dialog__toggle {
    position: relative;
    display: inline-flex;
    height: 24px;
    width: 44px;
    align-items: center;
    border-radius: 9999px;
    background-color: rgba(255, 255, 255, 0.1);
    border: 1px solid var(--sidebar-border);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .twitter-dialog__toggle:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.15);
  }

  .twitter-dialog__toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .twitter-dialog__toggle--active {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
  }

  .twitter-dialog__toggle-thumb {
    display: inline-block;
    height: 16px;
    width: 16px;
    border-radius: 9999px;
    background-color: white;
    transform: translateX(4px);
    transition: transform 150ms ease;
  }

  .twitter-dialog__toggle-thumb--active {
    transform: translateX(24px);
  }

  /* ===== Schedule Fields ===== */
  .twitter-dialog__schedule-fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.5rem;
  }

  .twitter-dialog__schedule-row {
    display: flex;
    gap: 0.75rem;
  }

  /* ===== Alert Box ===== */
  .twitter-dialog__alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 8px;
  }

  .twitter-dialog__alert--error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .twitter-dialog__alert-text {
    font-size: 0.8125rem;
    line-height: 1.5;
    margin: 0;
  }

  /* ===== Footer ===== */
  .twitter-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .twitter-dialog__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .twitter-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .twitter-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .twitter-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .twitter-dialog__btn--primary {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: white;
  }

  .twitter-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .twitter-dialog__spinner {
    animation: tw-spin 0.8s linear infinite;
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  @keyframes tw-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
