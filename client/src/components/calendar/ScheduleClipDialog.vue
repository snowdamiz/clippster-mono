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
                <Calendar v-if="!immediateMode" :size="24" />
                <Share2 v-else :size="24" />
              </div>
              <h2 class="schedule-dialog__title">{{ immediateMode ? 'Publish Clip' : 'Schedule Clip' }}</h2>
              <p class="schedule-dialog__subtitle">{{ immediateMode ? 'Publish this clip to your social media platforms' : 'Schedule this clip to your social media platforms' }}</p>
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

                <!-- Selected Date (hidden in immediate mode) -->
                <div v-if="!immediateMode" class="schedule-dialog__field">
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

                <!-- Time Mode Toggle (hidden in immediate mode) -->
                <div v-if="selectedPlatforms.length > 1 && !immediateMode" class="schedule-dialog__field">
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

                <!-- Single Time Picker (Same time for all, hidden in immediate mode) -->
                <div v-if="(sameTimeForAll || selectedPlatforms.length === 1) && !immediateMode" class="schedule-dialog__field">
                  <label class="schedule-dialog__label">Time *</label>
                  <CustomTimePicker
                    v-model="globalTime"
                    :disabled="scheduling"
                  />
                  <p v-if="globalTime && !isValidTime(globalTime)" class="schedule-dialog__field-hint schedule-dialog__field-hint--error">
                    Time must be at least 5 minutes in the future
                  </p>
                </div>

                <!-- Per-Platform Configuration (hidden in immediate mode) -->
                <div v-else-if="!immediateMode" class="schedule-dialog__field">
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
                          <CustomTimePicker
                            v-model="platformTimes[platformId]"
                            :disabled="scheduling"
                          />
                        </div>
                        
                        <div class="schedule-dialog__field" style="flex: 2">
                          <label class="schedule-dialog__label-sm">Account</label>
                          <div class="schedule-dialog__dropdown-wrapper">
                            <button
                              type="button"
                              @click="toggleDropdown(`config-${platformId}`)"
                              :disabled="scheduling"
                              class="schedule-dialog__dropdown-trigger schedule-dialog__dropdown-trigger--sm"
                            >
                              <span class="truncate">{{ getSelectedAccountLabel(platformId) }}</span>
                              <ChevronDown
                                class="schedule-dialog__dropdown-chevron"
                                :class="{ 'schedule-dialog__dropdown-chevron--open': openDropdown === `config-${platformId}` }"
                                :size="14"
                              />
                            </button>
                            
                            <div v-if="openDropdown === `config-${platformId}`" class="schedule-dialog__dropdown">
                              <button
                                type="button"
                                @click="selectAccount(platformId, ''); openDropdown = null"
                                class="schedule-dialog__dropdown-item"
                                :class="{ 'schedule-dialog__dropdown-item--selected': !platformAccounts[platformId] }"
                              >
                                Select account
                              </button>
                              
                              <template v-if="getOrgAccountsForPlatform(platformId).length > 0">
                                <div class="schedule-dialog__dropdown-group">{{ orgName }} Accounts</div>
                                <button
                                  v-for="account in getOrgAccountsForPlatform(platformId)"
                                  :key="`org-${account.id}`"
                                  type="button"
                                  @click="selectAccount(platformId, `org:${account.id}`); openDropdown = null"
                                  class="schedule-dialog__dropdown-item"
                                  :class="{ 'schedule-dialog__dropdown-item--selected': platformAccounts[platformId] === `org:${account.id}` }"
                                >
                                  @{{ account.username }}
                                </button>
                              </template>
                              
                              <template v-if="getPersonalAccountsForPlatform(platformId).length > 0">
                                <div class="schedule-dialog__dropdown-group">Personal Accounts</div>
                                <button
                                  v-for="account in getPersonalAccountsForPlatform(platformId)"
                                  :key="`user-${account.id}`"
                                  type="button"
                                  @click="selectAccount(platformId, `user:${account.id}`); openDropdown = null"
                                  class="schedule-dialog__dropdown-item"
                                  :class="{ 'schedule-dialog__dropdown-item--selected': platformAccounts[platformId] === `user:${account.id}` }"
                                >
                                  @{{ account.username }}
                                </button>
                              </template>
                            </div>
                          </div>
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
                      <div class="schedule-dialog__dropdown-wrapper">
                        <button
                          type="button"
                          @click="toggleDropdown(platformId)"
                          :disabled="scheduling"
                          class="schedule-dialog__dropdown-trigger"
                        >
                          <span class="truncate">{{ getSelectedAccountLabel(platformId) }}</span>
                          <ChevronDown
                            class="schedule-dialog__dropdown-chevron"
                            :class="{ 'schedule-dialog__dropdown-chevron--open': openDropdown === platformId }"
                            :size="16"
                          />
                        </button>
                        
                        <div v-if="openDropdown === platformId" class="schedule-dialog__dropdown">
                          <button
                            type="button"
                            @click="selectAccount(platformId, '')"
                            class="schedule-dialog__dropdown-item"
                            :class="{ 'schedule-dialog__dropdown-item--selected': !platformAccounts[platformId] }"
                          >
                            Select account
                          </button>
                          
                          <template v-if="getOrgAccountsForPlatform(platformId).length > 0">
                            <div class="schedule-dialog__dropdown-group">{{ orgName }} Accounts</div>
                            <button
                              v-for="account in getOrgAccountsForPlatform(platformId)"
                              :key="`org-${account.id}`"
                              type="button"
                              @click="selectAccount(platformId, `org:${account.id}`)"
                              class="schedule-dialog__dropdown-item"
                              :class="{ 'schedule-dialog__dropdown-item--selected': platformAccounts[platformId] === `org:${account.id}` }"
                            >
                              @{{ account.username }}
                            </button>
                          </template>
                          
                          <template v-if="getPersonalAccountsForPlatform(platformId).length > 0">
                            <div class="schedule-dialog__dropdown-group">Personal Accounts</div>
                            <button
                              v-for="account in getPersonalAccountsForPlatform(platformId)"
                              :key="`user-${account.id}`"
                              type="button"
                              @click="selectAccount(platformId, `user:${account.id}`)"
                              class="schedule-dialog__dropdown-item"
                              :class="{ 'schedule-dialog__dropdown-item--selected': platformAccounts[platformId] === `user:${account.id}` }"
                            >
                              @{{ account.username }}
                            </button>
                          </template>
                        </div>
                      </div>
                      <p v-if="!loadingAccounts && getOrgAccountsForPlatform(platformId).length === 0 && getPersonalAccountsForPlatform(platformId).length === 0" class="schedule-dialog__field-hint schedule-dialog__field-hint--error">
                        No {{ getPlatformLabel(platformId) }} accounts connected
                      </p>
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
                <template v-else>
                  <Share2 v-if="immediateMode" :size="16" />
                  <Calendar v-else :size="16" />
                </template>
                {{ scheduling ? (immediateMode ? 'Publishing...' : 'Scheduling...') : (immediateMode ? `Publish Now ${selectedPlatforms.length > 0 ? `(${selectedPlatforms.length})` : ''}` : `Schedule ${selectedPlatforms.length > 0 ? `(${selectedPlatforms.length})` : ''}`) }}
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
import { X, Calendar, CalendarDays, FileVideo, Loader2, AlertCircle, CheckCircle2, Instagram, Youtube, ChevronDown, Share2 } from 'lucide-vue-next';
import XLogo from '@/components/icons/XLogo.vue';
import TiktokLogo from '@/components/icons/TiktokLogo.vue';
import CustomTimePicker from '@/components/CustomTimePicker.vue';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/auth';
import { listSocialAccounts, uploadMediaForPost, type SocialAccount } from '@/services/socialAccountsApi';
import { listUserTwitterAccounts, type UserTwitterAccount } from '@/services/userTwitterApi';
import { uploadUserMediaForPost } from '@/services/userInstagramApi';
import { schedulePost, updateScheduledPostMedia } from '@/services/schedulingApi';
import { invoke } from '@tauri-apps/api/core';

interface Props {
  open: boolean;
  clipId: string;
  clipName: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  projectName?: string;
  selectedDate: Date;
  // When true, skips date/time picker and publishes immediately (scheduled_at = now + 2 min)
  immediateMode?: boolean;
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
  { id: 'tiktok', label: 'TikTok', icon: TiktokLogo },
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
const openDropdown = ref<string | null>(null);

// Background R2 upload promise (started when dialog opens in immediate mode)
let immediateUploadPromise: Promise<{ media_url: string; thumbnail_url?: string }> | null = null;

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
  return orgAccounts.value.filter(a => {
    const accountPlatform = a.platform.toLowerCase();
    // Handle Twitter/X naming
    if (platformId === 'twitter') {
      return (accountPlatform === 'twitter' || accountPlatform === 'x') && a.is_active;
    }
    return accountPlatform === platformId && a.is_active;
  });
}

function getPersonalAccountsForPlatform(platformId: string) {
  if (platformId === 'twitter') {
    return personalTwitterAccounts.value.filter(a => a.is_active);
  }
  return [];
}

function toggleDropdown(platformId: string) {
  if (openDropdown.value === platformId) {
    openDropdown.value = null;
  } else {
    openDropdown.value = platformId;
  }
}

function selectAccount(platformId: string, value: string) {
  platformAccounts.value[platformId] = value;
  openDropdown.value = null;
}

function getSelectedAccountLabel(platformId: string): string {
  const value = platformAccounts.value[platformId];
  if (!value) {
    return loadingAccounts.value ? 'Loading accounts...' : 'Select account';
  }
  
  const [type, id] = value.split(':');
  if (type === 'org') {
    const account = orgAccounts.value.find(a => a.id === Number(id));
    return account ? `@${account.username}` : 'Select account';
  } else if (type === 'user') {
    const account = personalTwitterAccounts.value.find(a => a.id === Number(id));
    return account ? `@${account.username}` : 'Select account';
  }
  return 'Select account';
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
  
  // In immediate mode, skip time validation
  if (!props.immediateMode) {
    // Check time validity
    if (sameTimeForAll.value || selectedPlatforms.value.length === 1) {
      if (!globalTime.value || !isValidTime(globalTime.value)) return false;
    } else {
      for (const platformId of selectedPlatforms.value) {
        const time = platformTimes.value[platformId];
        if (!time || !isValidTime(time)) return false;
      }
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
  console.log('[ScheduleClipDialog] Loading accounts, orgId:', orgId.value);
  try {
    // Load org accounts
    if (orgId.value) {
      const response = await listSocialAccounts(Number(orgId.value));
      console.log('[ScheduleClipDialog] Org accounts response:', response);
      if (response.success) {
        orgAccounts.value = response.accounts;
        console.log('[ScheduleClipDialog] Org accounts loaded:', orgAccounts.value);
      }
    }
    
    // Load personal Twitter accounts
    try {
      const twitterResponse = await listUserTwitterAccounts();
      console.log('[ScheduleClipDialog] Personal Twitter accounts response:', twitterResponse);
      if (twitterResponse.success) {
        personalTwitterAccounts.value = twitterResponse.accounts;
        console.log('[ScheduleClipDialog] Personal Twitter accounts loaded:', personalTwitterAccounts.value);
      }
    } catch (err) {
      console.warn('[ScheduleClipDialog] Failed to load personal Twitter accounts:', err);
    }
  } catch (err) {
    console.error('[ScheduleClipDialog] Failed to load accounts:', err);
  } finally {
    loadingAccounts.value = false;
    console.log('[ScheduleClipDialog] Accounts loading complete. Org:', orgAccounts.value.length, 'Personal Twitter:', personalTwitterAccounts.value.length);
  }
}

// Schedule posts
async function handleSchedule() {
  error.value = null;
  successCount.value = 0;
  scheduling.value = true;
  
  try {
    const scheduledPosts: Promise<any>[] = [];
    const scheduledPostIds: number[] = [];
    
    for (const platformId of selectedPlatforms.value) {
      const accountValue = platformAccounts.value[platformId];
      if (!accountValue) continue;
      
      const [accountType, accountIdStr] = accountValue.split(':');
      const accountId = Number(accountIdStr);
      
      // Determine scheduled time
      let scheduledDateTime: Date;
      if (props.immediateMode) {
        // Immediate mode: schedule now — server skips 5-min check when immediate=true
        // Media will be uploaded in background and updated via update-media endpoint
        scheduledDateTime = new Date();
      } else {
        const time = sameTimeForAll.value || selectedPlatforms.value.length === 1
          ? globalTime.value
          : platformTimes.value[platformId];
        
        if (!time) continue;
        
        const [hours, minutes] = time.split(':').map(Number);
        scheduledDateTime = new Date(props.selectedDate);
        scheduledDateTime.setHours(hours, minutes, 0, 0);
      }
      
      // Create schedule data with local path (will be updated with R2 URL after upload)
      const scheduleData: any = {
        platform: platformId as 'instagram' | 'tiktok' | 'twitter' | 'youtube',
        media_url: props.mediaUrl,
        thumbnail_url: props.thumbnailUrl,
        caption: caption.value || undefined,
        scheduled_at: scheduledDateTime.toISOString(),
        media_type: 'video',
        clip_id: props.clipId,
      };

      // Flag for server to skip 5-min validation
      if (props.immediateMode) {
        scheduleData.immediate = true;
      }
      
      // Add account info
      if (accountType === 'org') {
        scheduleData.organization_id = orgId.value;
        scheduleData.social_account_id = accountId;
      } else {
        scheduleData.user_social_account_id = accountId;
      }
      
      console.log('[ScheduleClipDialog] Scheduling post:', scheduleData);
      scheduledPosts.push(
        schedulePost(scheduleData).then(result => {
          if (result.success && result.post?.id) {
            scheduledPostIds.push(result.post.id);
          }
          return result;
        })
      );
    }
    
    const results = await Promise.allSettled(scheduledPosts);
    console.log('[ScheduleClipDialog] Schedule results:', results);
    
    // Check actual API success, not just promise fulfillment
    const successful = results.filter(r => 
      r.status === 'fulfilled' && r.value?.success
    ).length;
    const failed = results.filter(r => 
      r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.success)
    ).length;
    
    console.log('[ScheduleClipDialog] Successful:', successful, 'Failed:', failed);
    
    successCount.value = successful;
    
    if (successful > 0) {
      const verb = props.immediateMode ? 'queued for publishing' : 'scheduled';
      showToast(`Successfully ${verb} ${successful} post${successful !== 1 ? 's' : ''}`, 'success');
      
      emit('scheduled');
      
      console.log('[ScheduleClipDialog] Checking if should close - failed count:', failed);
      if (failed === 0) {
        // All succeeded, close immediately (bypass handleClose guard since scheduling is still true)
        console.log('[ScheduleClipDialog] All succeeded, closing dialog');
        emit('close');
        
        // Background upload: wait for R2 upload to complete, then update post media URLs
        if (scheduledPostIds.length > 0) {
          if (props.immediateMode && immediateUploadPromise) {
            // In immediate mode, await the upload that started when dialog opened
            console.log('[ScheduleClipDialog] Waiting for background R2 upload to finish for', scheduledPostIds.length, 'posts');
            immediateUploadPromise.then(async (result) => {
              console.log('[ScheduleClipDialog] Background upload complete, updating posts with R2 URL:', result.media_url);
              const updateResult = await updateScheduledPostMedia(
                scheduledPostIds,
                result.media_url,
                result.thumbnail_url
              );
              if (updateResult.success) {
                console.log(`[ScheduleClipDialog] Updated ${updateResult.updated} post(s) with R2 URL`);
                showToast('Upload complete - publishing now!', 'success');
              } else {
                console.error('[ScheduleClipDialog] Failed to update posts:', updateResult.error);
                showToast('Upload done but failed to update posts', 'error');
              }
            }).catch(err => {
              console.error('[ScheduleClipDialog] Background R2 upload failed:', err);
              showToast('Upload failed - post may not publish', 'error');
            });
          } else {
            // Normal scheduled mode: start background upload now
            console.log('[ScheduleClipDialog] Starting background upload for', scheduledPostIds.length, 'posts');
            startBackgroundUpload(scheduledPostIds).catch(err => {
              console.error('[ScheduleClipDialog] Background upload failed:', err);
              showToast('Upload failed - posts may not publish', 'error');
            });
          }
        }
      } else {
        console.log('[ScheduleClipDialog] NOT closing - some posts failed');
      }
    } else {
      console.log('[ScheduleClipDialog] NOT closing - no successful posts');
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

// Start background upload task for scheduled posts
async function startBackgroundUpload(postIds: number[]) {
  console.log('[ScheduleClipDialog] Starting background upload for posts:', postIds);
  
  try {
    // Read video file as data URL using Tauri
    const videoDataUrl = await invoke<string>('read_file_as_data_url', { filePath: props.mediaUrl });
    const fileName = props.mediaUrl.split(/[/\\]/).pop() || 'video.mp4';
    const videoFile = dataUrlToFile(videoDataUrl, fileName);

    // Read thumbnail if it's a local path or convert data URL
    let thumbnailFile: File | undefined;
    if (props.thumbnailUrl) {
      try {
        const thumbPath = props.thumbnailUrl.startsWith('file://') 
          ? props.thumbnailUrl.replace('file://', '') 
          : props.thumbnailUrl;
        
        if (thumbPath.startsWith('data:')) {
          // Already a data URL - convert directly to File
          thumbnailFile = dataUrlToFile(thumbPath, 'thumbnail.jpg');
        } else if (!thumbPath.startsWith('http')) {
          // Local file path - read as data URL then convert
          const thumbDataUrl = await invoke<string>('read_file_as_data_url', { filePath: thumbPath });
          thumbnailFile = dataUrlToFile(thumbDataUrl, 'thumbnail.jpg');
        }
        // If it's already an http(s) URL, skip (already uploaded)
      } catch (thumbError) {
        console.warn('[ScheduleClipDialog] Could not read thumbnail:', thumbError);
      }
    }

    // Upload via org endpoint if org context exists, otherwise personal
    let uploadResult;
    if (orgId.value) {
      uploadResult = await uploadMediaForPost(orgId.value, videoFile, thumbnailFile);
    } else {
      uploadResult = await uploadUserMediaForPost(videoFile, thumbnailFile);
    }

    if (!uploadResult.success || !uploadResult.media_url) {
      throw new Error(uploadResult.error || 'Failed to upload media');
    }

    console.log('[ScheduleClipDialog] Media uploaded to R2:', uploadResult.media_url);
    
    // Update all scheduled posts with the R2 URL
    const updateResult = await updateScheduledPostMedia(
      postIds,
      uploadResult.media_url,
      uploadResult.thumbnail_url
    );
    
    if (updateResult.success) {
      console.log(`[ScheduleClipDialog] Updated ${updateResult.updated} scheduled post(s) with R2 URL`);
      showToast('Upload complete - posts ready to publish', 'success');
    } else {
      console.error('[ScheduleClipDialog] Failed to update scheduled posts:', updateResult.error);
      showToast('Upload complete but failed to update posts', 'error');
    }
    
  } catch (err: any) {
    console.error('[ScheduleClipDialog] Background upload failed:', err);
    showToast('Upload failed - scheduled post may not publish', 'error');
  }
}

// Helper to convert data URL to File
function dataUrlToFile(dataUrl: string, fileName: string): File {
  const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Invalid data URL format');
  }
  const mimeType = base64Match[1];
  const base64Data = base64Match[2];

  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new File([bytes], fileName, { type: mimeType });
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

// Start R2 upload in background for immediate mode
function startImmediateUpload() {
  console.log('[ScheduleClipDialog] Starting background R2 upload for immediate publish...');
  immediateUploadPromise = (async () => {
    const videoDataUrl = await invoke<string>('read_file_as_data_url', { filePath: props.mediaUrl });
    const fileName = props.mediaUrl.split(/[/\\]/).pop() || 'video.mp4';
    const videoFile = dataUrlToFile(videoDataUrl, fileName);

    let thumbnailFile: File | undefined;
    if (props.thumbnailUrl) {
      try {
        const thumbPath = props.thumbnailUrl.startsWith('file://') 
          ? props.thumbnailUrl.replace('file://', '') 
          : props.thumbnailUrl;
        if (thumbPath.startsWith('data:')) {
          thumbnailFile = dataUrlToFile(thumbPath, 'thumbnail.jpg');
        } else if (!thumbPath.startsWith('http')) {
          const thumbDataUrl = await invoke<string>('read_file_as_data_url', { filePath: thumbPath });
          thumbnailFile = dataUrlToFile(thumbDataUrl, 'thumbnail.jpg');
        }
      } catch (thumbErr) {
        console.warn('[ScheduleClipDialog] Could not read thumbnail:', thumbErr);
      }
    }

    let uploadResult;
    if (orgId.value) {
      uploadResult = await uploadMediaForPost(orgId.value, videoFile, thumbnailFile);
    } else {
      uploadResult = await uploadUserMediaForPost(videoFile, thumbnailFile);
    }

    if (!uploadResult.success || !uploadResult.media_url) {
      throw new Error(uploadResult.error || 'Upload failed');
    }

    console.log('[ScheduleClipDialog] Background R2 upload complete:', uploadResult.media_url);
    return { media_url: uploadResult.media_url, thumbnail_url: uploadResult.thumbnail_url };
  })();
}

// Reset state when dialog opens
watch(() => props.open, (isOpen) => {
  console.log('[ScheduleClipDialog] Watch triggered, isOpen:', isOpen);
  if (isOpen) {
    selectedPlatforms.value = [];
    sameTimeForAll.value = true;
    platformTimes.value = {};
    platformAccounts.value = {};
    caption.value = '';
    error.value = null;
    successCount.value = 0;
    immediateUploadPromise = null;
    initializeDefaultTime();
    loadAccounts();

    // In immediate mode, start R2 upload right away while user fills in the form
    if (props.immediateMode) {
      startImmediateUpload();
    }
  }
}, { immediate: true });

onMounted(() => {
  console.log('[ScheduleClipDialog] Component mounted, open:', props.open);
  initializeDefaultTime();
  // Also load accounts on mount if dialog is already open
  if (props.open) {
    loadAccounts();
  }
});
</script>

<style scoped>
/* ===== Overlay ===== */
.fixed {
  position: fixed;
}

.inset-0 {
  inset: 0;
}

.z-50 {
  z-index: 10000;
}

.flex {
  display: flex;
}

.items-center {
  align-items: center;
}

.justify-center {
  justify-content: center;
}

.bg-black\/60 {
  background-color: rgba(0, 0, 0, 0.7);
}

.backdrop-blur-sm {
  backdrop-filter: blur(4px);
}

/* ===== Dialog Container ===== */
.schedule-dialog {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  margin: 1rem;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ===== Accent Bar ===== */
.schedule-dialog__accent {
  height: 3px;
  background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  flex-shrink: 0;
}

/* ===== Header ===== */
.schedule-dialog__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1.5rem 1rem;
  text-align: center;
}

.schedule-dialog__close {
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

.schedule-dialog__close:hover:not(:disabled) {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.schedule-dialog__close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.schedule-dialog__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  margin-bottom: 0.875rem;
}

.schedule-dialog__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.schedule-dialog__subtitle {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0.25rem 0 0;
}

/* ===== Content Area ===== */
.schedule-dialog__content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1.5rem 1.5rem;
}

.schedule-dialog__content::-webkit-scrollbar {
  width: 6px;
}

.schedule-dialog__content::-webkit-scrollbar-track {
  background: transparent;
}

.schedule-dialog__content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.schedule-dialog__form {
  display: flex;
  flex-direction: column;
}

/* ===== Form Field ===== */
.schedule-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.schedule-dialog__label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.schedule-dialog__label-sm {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--sidebar-text-muted);
}

/* ===== Inputs ===== */
.schedule-dialog__input,
.schedule-dialog__select,
.schedule-dialog__textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  transition: all 150ms ease;
}

.schedule-dialog__input::placeholder,
.schedule-dialog__textarea::placeholder {
  color: var(--sidebar-text-muted);
  opacity: 0.6;
}

.schedule-dialog__input:focus,
.schedule-dialog__select:focus,
.schedule-dialog__textarea:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

.schedule-dialog__input:disabled,
.schedule-dialog__select:disabled,
.schedule-dialog__textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.schedule-dialog__select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.5rem;
}

.schedule-dialog__select option {
  background-color: var(--sidebar-surface);
  color: var(--sidebar-text);
  padding: 0.5rem;
}

.schedule-dialog__select optgroup {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text-muted);
  font-weight: 600;
}

.schedule-dialog__textarea {
  resize: vertical;
  min-height: 80px;
}

/* ===== Clip Preview ===== */
.schedule-dialog__clip-preview {
  display: flex;
  gap: 0.75rem;
  padding: 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
}

.schedule-dialog__clip-thumbnail {
  width: 80px;
  height: 45px;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--sidebar-text-muted);
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
  color: var(--sidebar-text);
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-dialog__clip-meta {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.schedule-dialog__clip-dot {
  opacity: 0.5;
}

/* ===== Date Display ===== */
.schedule-dialog__date-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem;
  background-color: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.15);
  border-radius: 8px;
  color: var(--sidebar-accent);
  font-size: 0.875rem;
  font-weight: 500;
}

/* ===== Platforms ===== */
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
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.875rem;
  color: var(--sidebar-text);
}

.schedule-dialog__platform-option:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.schedule-dialog__platform-option--selected {
  background-color: rgba(6, 182, 212, 0.15);
  border-color: rgba(6, 182, 212, 0.3);
  color: var(--sidebar-accent);
}

.schedule-dialog__checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--sidebar-accent);
}

/* ===== Toggle ===== */
.schedule-dialog__toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.schedule-dialog__toggle {
  position: relative;
  display: inline-flex;
  height: 24px;
  width: 44px;
  flex-shrink: 0;
  cursor: pointer;
  border-radius: 9999px;
  border: 2px solid transparent;
  background-color: var(--sidebar-hover);
  transition: background-color 200ms ease-in-out;
}

.schedule-dialog__toggle:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--sidebar-accent);
}

.schedule-dialog__toggle--active {
  background-color: var(--sidebar-accent);
}

.schedule-dialog__toggle-thumb {
  pointer-events: none;
  display: inline-block;
  height: 20px;
  width: 20px;
  transform: translateX(0);
  border-radius: 9999px;
  background-color: white;
  transition: transform 200ms ease-in-out;
}

.schedule-dialog__toggle-thumb--active {
  transform: translateX(20px);
}

/* ===== Platform Configs ===== */
.schedule-dialog__platform-configs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.schedule-dialog__platform-config {
  padding: 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
}

.schedule-dialog__platform-config-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-text);
}

.schedule-dialog__platform-config-fields {
  display: flex;
  gap: 0.75rem;
}

/* ===== Account Configs ===== */
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
  color: var(--sidebar-text-muted);
}

/* ===== Custom Dropdown ===== */
.schedule-dialog__dropdown-wrapper {
  position: relative;
  flex: 1;
}

.schedule-dialog__dropdown-trigger {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  transition: all 150ms ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  text-align: left;
}

.schedule-dialog__dropdown-trigger:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.1);
}

.schedule-dialog__dropdown-trigger:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

.schedule-dialog__dropdown-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.schedule-dialog__dropdown-trigger--sm {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
}

.schedule-dialog__dropdown-chevron {
  flex-shrink: 0;
  transition: transform 150ms ease;
  color: var(--sidebar-text-muted);
}

.schedule-dialog__dropdown-chevron--open {
  transform: rotate(180deg);
}

.schedule-dialog__dropdown {
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

.schedule-dialog__dropdown::-webkit-scrollbar {
  width: 6px;
}

.schedule-dialog__dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.schedule-dialog__dropdown::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.schedule-dialog__dropdown-group {
  padding: 0.5rem 0.75rem 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.schedule-dialog__dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  transition: background-color 150ms ease;
  border: none;
  background: transparent;
  cursor: pointer;
}

.schedule-dialog__dropdown-item:hover {
  background-color: var(--sidebar-hover);
}

.schedule-dialog__dropdown-item--selected {
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== Caption Info ===== */
.schedule-dialog__caption-info {
  display: flex;
  justify-content: flex-end;
}

.schedule-dialog__field-hint {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.schedule-dialog__field-hint--error {
  color: #f87171;
}

/* ===== Alert Box ===== */
.schedule-dialog__alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.schedule-dialog__alert--error {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.schedule-dialog__alert--success {
  background-color: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  color: #86efac;
}

.schedule-dialog__alert-text {
  flex: 1;
}

/* ===== Footer ===== */
.schedule-dialog__footer {
  display: flex;
  gap: 0.625rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--sidebar-border);
}

/* ===== Buttons ===== */
.schedule-dialog__btn {
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

.schedule-dialog__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.schedule-dialog__btn--secondary {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
  border: 1px solid var(--sidebar-border);
}

.schedule-dialog__btn--secondary:hover:not(:disabled) {
  background-color: var(--sidebar-active);
  border-color: rgba(255, 255, 255, 0.1);
}

.schedule-dialog__btn--primary {
  background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
  color: #000;
}

.schedule-dialog__btn--primary:hover:not(:disabled) {
  opacity: 0.9;
}

.schedule-dialog__spinner {
  animation: spin 0.8s linear infinite;
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
