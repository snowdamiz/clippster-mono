<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="handleClose">
        <Transition name="dialog" appear>
          <div v-if="open" class="schedule-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="schedule-dialog__accent"></div>

            <!-- Header -->
            <div class="schedule-dialog__header">
              <button
                class="schedule-dialog__close"
                @click="handleClose"
                :disabled="scheduling"
                title="Close"
              >
                <X :size="18" />
              </button>
              <div class="schedule-dialog__icon">
                <Calendar :size="24" />
              </div>
              <h2 class="schedule-dialog__title">Schedule Clip</h2>
              <p class="schedule-dialog__subtitle">Schedule this clip to your social media platforms</p>
            </div>

            <!-- Content -->
            <div class="schedule-dialog__content">
              <form @submit.prevent="handleSchedule" class="schedule-dialog__form">
                <!-- Clip Preview -->
                <div class="schedule-dialog__field">
                  <label class="schedule-dialog__label">Clip Preview</label>
                  <div class="schedule-dialog__clip-preview">
                    <div class="schedule-dialog__clip-thumbnail">
                      <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="Clip thumbnail" />
                      <FileVideo v-else :size="32" class="text-zinc-600" />
                    </div>
                    <div class="schedule-dialog__clip-info">
                      <h3 class="schedule-dialog__clip-name">{{ clipName }}</h3>
                      <div class="schedule-dialog__clip-meta">
                        <span v-if="projectName">{{ projectName }}</span>
                        <span v-if="projectName && duration" class="schedule-dialog__clip-dot">•</span>
                        <span v-if="duration">{{ formatDuration(duration) }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Selected Date -->
                <div class="schedule-dialog__field">
                  <label class="schedule-dialog__label">Scheduled Date</label>
                  <div class="schedule-dialog__date-display">
                    <CalendarDays :size="16" />
                    <span>{{ formatSelectedDate(selectedDate) }}</span>
                  </div>
                </div>

                <!-- Platform Selection -->
                <div class="schedule-dialog__field">
                  <label class="schedule-dialog__label">Platforms *</label>
                  <div class="schedule-dialog__platforms">
                    <label
                      v-for="platform in availablePlatforms"
                      :key="platform.id"
                      class="schedule-dialog__platform-option"
                      :class="{ 'schedule-dialog__platform-option--selected': selectedPlatforms.includes(platform.id) }"
                    >
                      <input
                        type="checkbox"
                        :value="platform.id"
                        v-model="selectedPlatforms"
                        class="schedule-dialog__checkbox"
                      />
                      <component :is="platform.icon" :size="16" />
                      <span>{{ platform.label }}</span>
                    </label>
                  </div>
                  <p v-if="selectedPlatforms.length === 0" class="schedule-dialog__field-hint schedule-dialog__field-hint--error">
                    Please select at least one platform
                  </p>
                </div>

                <!-- Time Mode Toggle -->
                <div v-if="selectedPlatforms.length > 1" class="schedule-dialog__field">
                  <div class="schedule-dialog__toggle-row">
                    <label class="schedule-dialog__label">Same time for all platforms</label>
                    <button
                      type="button"
                      @click="sameTimeForAll = !sameTimeForAll"
                      :class="['schedule-dialog__toggle', { 'schedule-dialog__toggle--active': sameTimeForAll }]"
                      :disabled="scheduling"
                    >
                      <span :class="['schedule-dialog__toggle-thumb', { 'schedule-dialog__toggle-thumb--active': sameTimeForAll }]" />
                    </button>
                  </div>
                </div>

                <!-- Single Time Picker (Same time for all) -->
                <div v-if="sameTimeForAll || selectedPlatforms.length === 1" class="schedule-dialog__field">
                  <label class="schedule-dialog__label">Time *</label>
                  <input
                    type="time"
                    v-model="globalTime"
                    :disabled="scheduling"
                    class="schedule-dialog__input"
                  />
                  <p v-if="globalTime && !isValidTime(globalTime)" class="schedule-dialog__field-hint schedule-dialog__field-hint--error">
                    Time must be at least 5 minutes in the future
                  </p>
                </div>

                <!-- Per-Platform Configuration -->
                <div v-else class="schedule-dialog__field">
                  <label class="schedule-dialog__label">Platform Settings</label>
                  <div class="schedule-dialog__platform-configs">
                    <div
                      v-for="platformId in selectedPlatforms"
                      :key="platformId"
                      class="schedule-dialog__platform-config"
                    >
                      <div class="schedule-dialog__platform-config-header">
                        <component :is="getPlatformIcon(platformId)" :size="14" />
                        <span>{{ getPlatformLabel(platformId) }}</span>
                      </div>
                      
                      <div class="schedule-dialog__platform-config-fields">
                        <div class="schedule-dialog__field" style="flex: 1">
                          <label class="schedule-dialog__label-sm">Time</label>
                          <input
                            type="time"
                            v-model="platformTimes[platformId]"
                            :disabled="scheduling"
                            class="schedule-dialog__input"
                          />
                        </div>
                        
                        <div class="schedule-dialog__field" style="flex: 2">
                          <label class="schedule-dialog__label-sm">Account</label>
                          <select
                            v-model="platformAccounts[platformId]"
                            :disabled="scheduling || loadingAccounts"
                            class="schedule-dialog__select"
                          >
                            <option value="">Select account</option>
                            <optgroup v-if="getOrgAccountsForPlatform(platformId).length > 0" :label="orgName + ' Accounts'">
                              <option
                                v-for="account in getOrgAccountsForPlatform(platformId)"
                                :key="`org-${account.id}`"
                                :value="`org:${account.id}`"
                              >
                                @{{ account.username }}
                              </option>
                            </optgroup>
                            <optgroup v-if="getPersonalAccountsForPlatform(platformId).length > 0" label="Personal Accounts">
                              <option
                                v-for="account in getPersonalAccountsForPlatform(platformId)"
                                :key="`user-${account.id}`"
                                :value="`user:${account.id}`"
                              >
                                @{{ account.username }}
                              </option>
                            </optgroup>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Global Account Selection (when same time for all) -->
                <div v-if="sameTimeForAll && selectedPlatforms.length > 0" class="schedule-dialog__field">
                  <label class="schedule-dialog__label">Accounts *</label>
                  <div class="schedule-dialog__account-configs">
                    <div
                      v-for="platformId in selectedPlatforms"
                      :key="platformId"
                      class="schedule-dialog__account-config"
                    >
                      <div class="schedule-dialog__account-config-label">
                        <component :is="getPlatformIcon(platformId)" :size="14" />
                        <span>{{ getPlatformLabel(platformId) }}</span>
                      </div>
                      <select
                        v-model="platformAccounts[platformId]"
                        :disabled="scheduling || loadingAccounts"
                        class="schedule-dialog__select"
                      >
                        <option value="">Select account</option>
                        <optgroup v-if="getOrgAccountsForPlatform(platformId).length > 0" :label="orgName + ' Accounts'">
                          <option
                            v-for="account in getOrgAccountsForPlatform(platformId)"
                            :key="`org-${account.id}`"
                            :value="`org:${account.id}`"
                          >
                            @{{ account.username }}
                          </option>
                        </optgroup>
                        <optgroup v-if="getPersonalAccountsForPlatform(platformId).length > 0" label="Personal Accounts">
                          <option
                            v-for="account in getPersonalAccountsForPlatform(platformId)"
                            :key="`user-${account.id}`"
                            :value="`user:${account.id}`"
                          >
                            @{{ account.username }}
                          </option>
                        </optgroup>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- Caption -->
                <div class="schedule-dialog__field">
                  <label class="schedule-dialog__label">Caption</label>
                  <textarea
                    v-model="caption"
                    :disabled="scheduling"
                    rows="3"
                    :maxlength="maxCaptionLength"
                    placeholder="Add a caption for your post..."
                    class="schedule-dialog__input schedule-dialog__textarea"
                  ></textarea>
                  <div class="schedule-dialog__caption-info">
                    <p class="schedule-dialog__field-hint">
                      {{ caption.length }} / {{ maxCaptionLength }}
                    </p>
                  </div>
                </div>

                <!-- Error Display -->
                <div v-if="error" class="schedule-dialog__alert schedule-dialog__alert--error">
                  <AlertCircle :size="16" />
                  <p class="schedule-dialog__alert-text">{{ error }}</p>
                </div>

                <!-- Success Display -->
                <div v-if="successCount > 0 && !scheduling" class="schedule-dialog__alert schedule-dialog__alert--success">
                  <CheckCircle2 :size="16" />
                  <p class="schedule-dialog__alert-text">
                    Successfully scheduled {{ successCount }} post{{ successCount !== 1 ? 's' : '' }}!
                  </p>
                </div>
              </form>
            </div>

            <!-- Footer -->
            <div class="schedule-dialog__footer">
              <button
                @click="handleClose"
                :disabled="scheduling"
                class="schedule-dialog__btn schedule-dialog__btn--secondary"
              >
                {{ successCount > 0 ? 'Close' : 'Cancel' }}
              </button>
              <button
                @click="handleSchedule"
                :disabled="!canSchedule || scheduling"
                class="schedule-dialog__btn schedule-dialog__btn--primary"
              >
                <Loader2 v-if="scheduling" :size="16" class="schedule-dialog__spinner" />
                <Calendar v-else :size="16" />
                {{ scheduling ? 'Scheduling...' : `Schedule ${selectedPlatforms.length > 0 ? `(${selectedPlatforms.length})` : ''}` }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { X, Calendar, CalendarDays, FileVideo, Loader2, AlertCircle, CheckCircle2, Instagram, Youtube } from 'lucide-vue-next';
import XLogo from '@/components/icons/XLogo.vue';
import TikTokIcon from '@/components/icons/TikTokIcon.vue';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/auth';
import { listSocialAccounts, type SocialAccount } from '@/services/socialAccountsApi';
import { listUserTwitterAccounts, type UserTwitterAccount } from '@/services/userTwitterApi';
import { schedulePost } from '@/services/schedulingApi';

interface Props {
  open: boolean;
  clipId: string;
  clipName: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  projectName?: string;
  selectedDate: Date;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'scheduled'): void;
}>();

const { showToast } = useToast();
const authStore = useAuthStore();

// Platform definitions
const availablePlatforms = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'twitter', label: 'X (Twitter)', icon: XLogo },
  { id: 'tiktok', label: 'TikTok', icon: TikTokIcon },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
];

// State
const loadingAccounts = ref(true);
const orgAccounts = ref<SocialAccount[]>([]);
const personalTwitterAccounts = ref<UserTwitterAccount[]>([]);
const selectedPlatforms = ref<string[]>([]);
const sameTimeForAll = ref(true);
const globalTime = ref('');
const platformTimes = ref<Record<string, string>>({});
const platformAccounts = ref<Record<string, string>>({});
const caption = ref('');
const scheduling = ref(false);
const error = ref<string | null>(null);
const successCount = ref(0);

const orgName = computed(() => 'Organization');
const orgId = computed(() => authStore.user?.owned_organization_id);

// Max caption length (use Twitter's 280 as default)
const maxCaptionLength = computed(() => {
  if (selectedPlatforms.value.includes('twitter')) return 280;
  return 2200; // Instagram's limit
});

// Helper functions
function getPlatformIcon(platformId: string) {
  return availablePlatforms.find(p => p.id === platformId)?.icon || Calendar;
}

function getPlatformLabel(platformId: string) {
  return availablePlatforms.find(p => p.id === platformId)?.label || platformId;
}

function getOrgAccountsForPlatform(platformId: string) {
  const platform = platformId === 'twitter' ? 'twitter' : platformId;
  return orgAccounts.value.filter(a => a.platform.toLowerCase() === platform);
}

function getPersonalAccountsForPlatform(platformId: string) {
  if (platformId === 'twitter') return personalTwitterAccounts.value;
  return [];
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatSelectedDate(date: Date): string {
  return date.toLocaleDateString('default', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
}

function isValidTime(time: string): boolean {
  if (!time) return false;
  
  const [hours, minutes] = time.split(':').map(Number);
  const scheduledDateTime = new Date(props.selectedDate);
  scheduledDateTime.setHours(hours, minutes, 0, 0);
  
  const minTime = new Date();
  minTime.setMinutes(minTime.getMinutes() + 5);
  
  return scheduledDateTime >= minTime;
}

// Validation
const canSchedule = computed(() => {
  if (selectedPlatforms.value.length === 0) return false;
  if (scheduling.value) return false;
  
  // Check time validity
  if (sameTimeForAll.value || selectedPlatforms.value.length === 1) {
    if (!globalTime.value || !isValidTime(globalTime.value)) return false;
  } else {
    for (const platformId of selectedPlatforms.value) {
      const time = platformTimes.value[platformId];
      if (!time || !isValidTime(time)) return false;
    }
  }
  
  // Check accounts selected
  for (const platformId of selectedPlatforms.value) {
    if (!platformAccounts.value[platformId]) return false;
  }
  
  return true;
});

// Load accounts
async function loadAccounts() {
  loadingAccounts.value = true;
  try {
    // Load org accounts
    if (orgId.value) {
      const response = await listSocialAccounts(Number(orgId.value));
      if (response.success) {
        orgAccounts.value = response.accounts;
      }
    }
    
    // Load personal Twitter accounts
    try {
      const twitterResponse = await listUserTwitterAccounts();
      if (twitterResponse.success) {
        personalTwitterAccounts.value = twitterResponse.accounts;
      }
    } catch (err) {
      console.warn('[ScheduleClipDialog] Failed to load personal Twitter accounts:', err);
    }
  } catch (err) {
    console.error('[ScheduleClipDialog] Failed to load accounts:', err);
  } finally {
    loadingAccounts.value = false;
  }
}

// Schedule posts
async function handleSchedule() {
  error.value = null;
  successCount.value = 0;
  scheduling.value = true;
  
  try {
    const scheduledPosts: Promise<any>[] = [];
    
    for (const platformId of selectedPlatforms.value) {
      const accountValue = platformAccounts.value[platformId];
      if (!accountValue) continue;
      
      const [accountType, accountIdStr] = accountValue.split(':');
      const accountId = Number(accountIdStr);
      
      // Determine scheduled time
      const time = sameTimeForAll.value || selectedPlatforms.value.length === 1
        ? globalTime.value
        : platformTimes.value[platformId];
      
      if (!time) continue;
      
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledDateTime = new Date(props.selectedDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);
      
      // Create schedule data
      const scheduleData: any = {
        platform: platformId as 'instagram' | 'tiktok' | 'twitter' | 'youtube',
        media_url: props.mediaUrl,
        thumbnail_url: props.thumbnailUrl,
        caption: caption.value || undefined,
        scheduled_at: scheduledDateTime.toISOString(),
        media_type: 'video',
        clip_id: props.clipId,
      };
      
      // Add account info
      if (accountType === 'org') {
        scheduleData.organization_id = orgId.value;
        scheduleData.social_account_id = accountId;
      } else {
        scheduleData.user_social_account_id = accountId;
      }
      
      scheduledPosts.push(schedulePost(scheduleData));
    }
    
    const results = await Promise.allSettled(scheduledPosts);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    successCount.value = successful;
    
    if (successful > 0) {
      showToast(`Successfully scheduled ${successful} post${successful !== 1 ? 's' : ''}`, 'success');
      
      emit('scheduled');
      
      if (failed === 0) {
        // All succeeded, close after brief delay
        setTimeout(() => {
          handleClose();
        }, 1500);
      }
    }
    
    if (failed > 0) {
      error.value = `Failed to schedule ${failed} post${failed !== 1 ? 's' : ''}. Please try again.`;
      if (error.value) {
        showToast(error.value, 'error');
      }
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to schedule posts';
    if (error.value) {
      showToast(error.value, 'error');
    }
  } finally {
    scheduling.value = false;
  }
}

function handleClose() {
  if (scheduling.value) return;
  emit('close');
}

// Initialize default time (current time + 1 hour, rounded to next 15 min)
function initializeDefaultTime() {
  const now = new Date();
  now.setHours(now.getHours() + 1);
  const minutes = Math.ceil(now.getMinutes() / 15) * 15;
  now.setMinutes(minutes);
  
  const hours = now.getHours().toString().padStart(2, '0');
  const mins = now.getMinutes().toString().padStart(2, '0');
  globalTime.value = `${hours}:${mins}`;
}

// Watch for platform changes to initialize times
watch(selectedPlatforms, (newPlatforms) => {
  for (const platformId of newPlatforms) {
    if (!platformTimes.value[platformId]) {
      platformTimes.value[platformId] = globalTime.value;
    }
  }
});

// Reset state when dialog opens
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    selectedPlatforms.value = [];
    sameTimeForAll.value = true;
    platformTimes.value = {};
    platformAccounts.value = {};
    caption.value = '';
    error.value = null;
    successCount.value = 0;
    initializeDefaultTime();
    loadAccounts();
  }
});

onMounted(() => {
  initializeDefaultTime();
});
</script>

<style scoped>
.schedule-dialog {
  position: relative;
  width: 90vw;
  max-width: 600px;
  max-height: 90vh;
  background: #18181b;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.schedule-dialog__accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
}

.schedule-dialog__header {
  position: relative;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  text-align: center;
}

.schedule-dialog__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.2s;
}

.schedule-dialog__close:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #e4e4e7;
}

.schedule-dialog__close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.schedule-dialog__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 0.75rem;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-radius: 12px;
  color: white;
}

.schedule-dialog__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #e4e4e7;
  margin-bottom: 0.25rem;
}

.schedule-dialog__subtitle {
  font-size: 0.875rem;
  color: #71717a;
}

.schedule-dialog__content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.schedule-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.schedule-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.schedule-dialog__label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #e4e4e7;
}

.schedule-dialog__label-sm {
  font-size: 0.75rem;
  font-weight: 600;
  color: #a1a1aa;
}

.schedule-dialog__clip-preview {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.schedule-dialog__clip-thumbnail {
  width: 80px;
  height: 45px;
  flex-shrink: 0;
  background: #09090b;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.schedule-dialog__clip-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.schedule-dialog__clip-info {
  flex: 1;
  min-width: 0;
}

.schedule-dialog__clip-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #e4e4e7;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-dialog__clip-meta {
  font-size: 0.75rem;
  color: #71717a;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.schedule-dialog__clip-dot {
  color: #3f3f46;
}

.schedule-dialog__date-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  color: #93c5fd;
  font-size: 0.875rem;
  font-weight: 500;
}

.schedule-dialog__platforms {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.schedule-dialog__platform-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
  color: #a1a1aa;
}

.schedule-dialog__platform-option:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}

.schedule-dialog__platform-option--selected {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
  color: #93c5fd;
}

.schedule-dialog__checkbox {
  width: 16px;
  height: 16px;
  accent-color: #3b82f6;
}

.schedule-dialog__toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.schedule-dialog__toggle {
  position: relative;
  width: 44px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.schedule-dialog__toggle--active {
  background: #3b82f6;
  border-color: #3b82f6;
}

.schedule-dialog__toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.schedule-dialog__toggle-thumb--active {
  transform: translateX(20px);
}

.schedule-dialog__platform-configs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.schedule-dialog__platform-config {
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.schedule-dialog__platform-config-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #e4e4e7;
}

.schedule-dialog__platform-config-fields {
  display: flex;
  gap: 0.75rem;
}

.schedule-dialog__account-configs {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.schedule-dialog__account-config {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.schedule-dialog__account-config-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 120px;
  font-size: 0.875rem;
  color: #a1a1aa;
}

.schedule-dialog__input,
.schedule-dialog__select,
.schedule-dialog__textarea {
  width: 100%;
  padding: 0.625rem 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #e4e4e7;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.schedule-dialog__input:focus,
.schedule-dialog__select:focus,
.schedule-dialog__textarea:focus {
  outline: none;
  border-color: #3b82f6;
  background: rgba(255, 255, 255, 0.08);
}

.schedule-dialog__input:disabled,
.schedule-dialog__select:disabled,
.schedule-dialog__textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.schedule-dialog__textarea {
  resize: vertical;
  min-height: 80px;
}

.schedule-dialog__caption-info {
  display: flex;
  justify-content: flex-end;
}

.schedule-dialog__field-hint {
  font-size: 0.75rem;
  color: #71717a;
}

.schedule-dialog__field-hint--error {
  color: #f87171;
}

.schedule-dialog__alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.875rem;
}

.schedule-dialog__alert--error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.schedule-dialog__alert--success {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  color: #86efac;
}

.schedule-dialog__alert-text {
  flex: 1;
}

.schedule-dialog__footer {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.2);
}

.schedule-dialog__btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.schedule-dialog__btn--secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a1a1aa;
}

.schedule-dialog__btn--secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #e4e4e7;
}

.schedule-dialog__btn--primary {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border: none;
  color: white;
}

.schedule-dialog__btn--primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.schedule-dialog__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.schedule-dialog__spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.dialog-enter-active {
  transition: all 0.3s ease;
}

.dialog-leave-active {
  transition: all 0.2s ease;
}

.dialog-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-20px);
}

.dialog-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
