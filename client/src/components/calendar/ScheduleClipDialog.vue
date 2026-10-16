<template>
  <PublishDialogShell
    :open="open"
    title="Schedule clip"
    description="Schedule this clip to your social media platforms"
    :icon="CalendarClock"
    size="lg"
    :busy="scheduling"
    :can-submit="canSchedule"
    :submit-label="selectedPlatforms.length > 0 ? `Schedule (${selectedPlatforms.length})` : 'Schedule'"
    busy-label="Scheduling…"
    :submit-icon="CalendarClock"
    :cancel-label="successCount > 0 ? 'Close' : 'Cancel'"
    :error="error"
    @close="handleClose"
    @submit="handleSchedule"
  >
    <PublishMediaSummary
      :thumbnail-url="thumbnailUrl"
      :title="clipName"
      :meta="[projectName, duration ? formatDuration(duration) : null]"
    />

    <PublishContextPicker
      v-model:context="postingContext"
      v-model:org-profile-id="selectedOrgProfileId"
      v-model:campaign-id="selectedCampaignId"
      v-model:campaign-profile-id="selectedCampaignProfileId"
      :disabled="scheduling"
      :loading-org-profiles="loadingOrgProfiles"
      :org-profiles="orgCreatorProfiles"
      :loading-campaigns="loadingCampaigns"
      :campaigns="availableCampaigns"
      :campaign-profiles="campaignProfiles"
    />

    <Field label="Scheduled date">
      <div
        class="flex h-[var(--control-md)] items-center gap-2 rounded-[var(--radius-control)] border border-line-subtle bg-surface px-2.5 text-sm text-fg"
      >
        <CalendarDays class="size-4 shrink-0 text-fg-subtle" />
        {{ formatSelectedDate(selectedDate) }}
      </div>
    </Field>

    <Field label="Platforms" required :hint="selectedPlatforms.length === 0 ? 'Select at least one platform' : undefined">
      <PublishPlatformPicker
        :platforms="availablePlatforms"
        :selected="selectedPlatforms"
        :disabled="scheduling"
        @toggle="toggleSelectedPlatform"
      />
    </Field>

    <!-- Time mode -->
    <label
      v-if="selectedPlatforms.length > 1"
      for="schedule-same-time"
      class="flex cursor-pointer items-center justify-between gap-3"
    >
      <span class="text-sm font-medium text-fg">Same time for all platforms</span>
      <Switch id="schedule-same-time" v-model="sameTimeForAll" :disabled="scheduling" />
    </label>

    <!-- Single time (same time for all) -->
    <Field
      v-if="sameTimeForAll || selectedPlatforms.length === 1"
      label="Time"
      required
      :error="globalTime && !isValidTime(globalTime) ? 'Time must be at least 5 minutes in the future' : null"
    >
      <CustomTimePicker v-model="globalTime" :disabled="scheduling" />
    </Field>

    <!-- Per-platform time + account -->
    <Field v-else label="Platform settings">
      <div class="flex flex-col gap-2">
        <PublishPlatformRow
          v-for="platformId in selectedPlatforms"
          :key="platformId"
          :platform="platformId"
          :label="getPlatformLabel(platformId)"
        >
          <div class="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-2">
            <CustomTimePicker v-model="platformTimes[platformId]" :disabled="scheduling" />
            <PublishAccountSelect
              :model-value="platformAccounts[platformId]"
              :groups="accountGroupsFor(platformId)"
              :loading="loadingAccounts"
              :disabled="scheduling"
              @update:model-value="(v) => selectAccount(platformId, v)"
            />
          </div>
        </PublishPlatformRow>
      </div>
    </Field>

    <!-- Accounts (same time for all) -->
    <Field v-if="sameTimeForAll && selectedPlatforms.length > 0" label="Accounts" required>
      <div class="flex flex-col gap-2">
        <PublishPlatformRow
          v-for="platformId in selectedPlatforms"
          :key="platformId"
          :platform="platformId"
          :label="getPlatformLabel(platformId)"
        >
          <PublishAccountSelect
            :model-value="platformAccounts[platformId]"
            :groups="accountGroupsFor(platformId)"
            :loading="loadingAccounts"
            :disabled="scheduling"
            :empty-text="`No ${getPlatformLabel(platformId)} accounts connected`"
            @update:model-value="(v) => selectAccount(platformId, v)"
          />
        </PublishPlatformRow>
      </div>
    </Field>

    <PublishCaptionField v-model="caption" :maxlength="maxCaptionLength" :disabled="scheduling" />

    <Alert v-if="successCount > 0 && !scheduling" variant="success">
      <CheckCircle2 />
      <AlertDescription>Successfully scheduled {{ successCount }} post{{ successCount !== 1 ? 's' : '' }}!</AlertDescription>
    </Alert>
  </PublishDialogShell>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { CalendarClock, CalendarDays, CheckCircle2, Instagram, Youtube } from 'lucide-vue-next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import PublishDialogShell from '@/components/publish/PublishDialogShell.vue';
import PublishMediaSummary from '@/components/publish/PublishMediaSummary.vue';
import PublishContextPicker from '@/components/publish/PublishContextPicker.vue';
import PublishPlatformPicker from '@/components/publish/PublishPlatformPicker.vue';
import PublishPlatformRow from '@/components/publish/PublishPlatformRow.vue';
import PublishAccountSelect from '@/components/publish/PublishAccountSelect.vue';
import type { PublishAccountGroup } from '@/components/publish/types';
import PublishCaptionField from '@/components/publish/PublishCaptionField.vue';
import XLogo from '@/components/icons/XLogo.vue';
import TiktokLogo from '@/components/icons/TiktokLogo.vue';
import TokendLogo from '@/components/icons/TokendLogo.vue';
import CustomTimePicker from '@/components/CustomTimePicker.vue';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/auth';
import { listSocialAccounts, uploadMediaForPost, publishPost, type SocialAccount } from '@/services/socialAccountsApi';
import { listSocialAccounts as listPostForMeAccounts, type ClipperSocialAccount } from '@/services/clipperProfileApi';
import { publishToUserTwitter } from '@/services/userTwitterApi';
import { publishToUserTiktok } from '@/services/userTiktokApi';
import { publishToUserInstagram, uploadUserMediaForPost } from '@/services/userInstagramApi';
import { publishToUserYoutube } from '@/services/userYoutubeApi';
import { schedulePost, updateScheduledPostMedia } from '@/services/schedulingApi';
import { invoke } from '@tauri-apps/api/core';
import { listOrganizationCreatorProfiles, type ServerOrganizationCreatorProfile } from '@/services/organizationProfilesApi';
import { listMyCampaigns, filterCampaignsOpenForPosting, type Campaign } from '@/services/campaignApi';
import { fetchTokendCapabilities } from '@/services/tokend';
import { canAccessTokend } from '@/utils/tokendAccess';

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
const allPlatforms = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'twitter', label: 'X (Twitter)', icon: XLogo },
  { id: 'tiktok', label: 'TikTok', icon: TiktokLogo },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'tokend', label: 'Tokend', icon: TokendLogo },
];

const tokendScheduleEnabled = ref(false);
const availablePlatforms = computed(() =>
  allPlatforms.filter(
    (p) => p.id !== 'tokend' || (tokendScheduleEnabled.value && canAccessTokend(authStore.user))
  )
);

// State
const loadingAccounts = ref(true);
const orgAccounts = ref<SocialAccount[]>([]);
const personalAccounts = ref<ClipperSocialAccount[]>([]);
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

// Posting context
type PostingContext = 'org' | 'campaign';
const postingContext = ref<PostingContext>('org');

// Org creator profiles
const loadingOrgProfiles = ref(false);
const orgCreatorProfiles = ref<ServerOrganizationCreatorProfile[]>([]);
const selectedOrgProfileId = ref<number | null>(null);

// Campaigns
const loadingCampaigns = ref(false);
const availableCampaigns = ref<Campaign[]>([]);
const selectedCampaignId = ref<number | null>(null);
const selectedCampaignProfileId = ref<number | null>(null);

const selectedCampaign = computed(() =>
  availableCampaigns.value.find(c => c.id === selectedCampaignId.value) ?? null
);

const campaignProfiles = computed(() => {
  const c = selectedCampaign.value;
  if (!c) return [];
  const profiles: Array<{ id: number; name: string; profile_image_url: string | null; isGlobal: boolean }> = [];
  if (c.branding_profile) {
    profiles.push({ ...c.branding_profile, isGlobal: true });
  }
  if (c.creator_profiles && c.creator_profiles.length > 0) {
    for (const p of c.creator_profiles) {
      if (!profiles.find(x => x.id === p.id)) {
        profiles.push({ ...p, isGlobal: false });
      }
    }
  }
  return profiles;
});

const showOrgProfileDropdown = computed(() => orgCreatorProfiles.value.length > 1);
const showCampaignProfileDropdown = computed(() => campaignProfiles.value.length > 1);


const orgName = computed(() => 'Organization');
const orgId = computed(() => authStore.user?.owned_organization_id);

// Max caption length (use Twitter's 280 as default)
const maxCaptionLength = computed(() => {
  if (selectedPlatforms.value.includes('twitter')) return 280;
  return 2200; // Instagram's limit
});

// Helper functions
function getPlatformLabel(platformId: string) {
  return allPlatforms.find(p => p.id === platformId)?.label || platformId;
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
  return personalAccounts.value.filter(a => {
    const accountPlatform = a.platform.toLowerCase();
    // Handle Twitter/X naming
    if (platformId === 'twitter') {
      return accountPlatform === 'twitter' || accountPlatform === 'x';
    }
    return accountPlatform === platformId;
  });
}

function toggleSelectedPlatform(platformId: string) {
  // Assign a new array (like a checkbox v-model) so the selectedPlatforms watcher runs.
  selectedPlatforms.value = selectedPlatforms.value.includes(platformId)
    ? selectedPlatforms.value.filter((id) => id !== platformId)
    : [...selectedPlatforms.value, platformId];
}

function accountGroupsFor(platformId: string): PublishAccountGroup[] {
  return [
    { label: `${orgName.value} accounts`, prefix: 'org', accounts: getOrgAccountsForPlatform(platformId) },
    { label: 'Personal accounts', prefix: 'user', accounts: getPersonalAccountsForPlatform(platformId) },
  ];
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
    const account = personalAccounts.value.find(a => a.id === Number(id));
    return account && account.username ? `@${account.username}` : 'Select account';
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

// Load org creator profiles
async function loadOrgCreatorProfiles() {
  if (!orgId.value) return;
  loadingOrgProfiles.value = true;
  try {
    const res = await listOrganizationCreatorProfiles(orgId.value);
    if (res.success) {
      orgCreatorProfiles.value = res.profiles.filter(p => !p.disabled);
      if (orgCreatorProfiles.value.length === 1) {
        selectedOrgProfileId.value = orgCreatorProfiles.value[0].id;
      } else {
        selectedOrgProfileId.value = null;
      }
    }
  } catch (err) {
    console.error('[ScheduleClipDialog] Failed to load org profiles:', err);
  } finally {
    loadingOrgProfiles.value = false;
  }
}

// Load campaigns the user has joined
async function loadCampaigns() {
  loadingCampaigns.value = true;
  try {
    const res = await listMyCampaigns('active');
    if (res.success) {
      availableCampaigns.value = filterCampaignsOpenForPosting(res.campaigns);
      if (availableCampaigns.value.length === 0 && postingContext.value === 'campaign') {
        postingContext.value = 'org';
        selectedCampaignId.value = null;
        selectedCampaignProfileId.value = null;
      } else if (availableCampaigns.value.length === 1) {
        selectedCampaignId.value = availableCampaigns.value[0].id;
        autoSelectCampaignProfile();
      } else {
        selectedCampaignId.value = null;
        selectedCampaignProfileId.value = null;
      }
    }
  } catch (err) {
    console.error('[ScheduleClipDialog] Failed to load campaigns:', err);
  } finally {
    loadingCampaigns.value = false;
  }
}

function autoSelectCampaignProfile() {
  const profiles = campaignProfiles.value;
  if (profiles.length === 1) {
    selectedCampaignProfileId.value = profiles[0].id;
  } else if (profiles.length === 0) {
    selectedCampaignProfileId.value = null;
  }
}

watch(selectedCampaignId, () => {
  autoSelectCampaignProfile();
});

watch(postingContext, () => {
  selectedOrgProfileId.value = null;
  selectedCampaignId.value = null;
  selectedCampaignProfileId.value = null;
  if (postingContext.value === 'org') {
    if (orgCreatorProfiles.value.length === 1) selectedOrgProfileId.value = orgCreatorProfiles.value[0].id;
  } else {
    if (availableCampaigns.value.length === 1) {
      selectedCampaignId.value = availableCampaigns.value[0].id;
      autoSelectCampaignProfile();
    }
  }
});

// Load accounts
async function loadAccounts() {
  loadingAccounts.value = true;
  console.log('[ScheduleClipDialog] Loading accounts, orgId:', orgId.value);
  try {
    const [, tokendCaps] = await Promise.all([
      (async () => {
        // Load org accounts
        if (orgId.value) {
          const response = await listSocialAccounts(Number(orgId.value));
          console.log('[ScheduleClipDialog] Org accounts response:', response);
          if (response.success) {
            orgAccounts.value = response.accounts;
            console.log('[ScheduleClipDialog] Org accounts loaded:', orgAccounts.value);
          }
        }
        
        // Load PostForMe personal accounts
        const postForMeResponse = await listPostForMeAccounts();
        console.log('[ScheduleClipDialog] PostForMe accounts response:', postForMeResponse);
        if (postForMeResponse.success) {
          personalAccounts.value = postForMeResponse.social_accounts;
          console.log('[ScheduleClipDialog] Personal accounts loaded:', personalAccounts.value);
        }
      })(),
      fetchTokendCapabilities().catch(() => null),
    ]);
    tokendScheduleEnabled.value = tokendCaps?.schedule === true;
  } catch (err) {
    console.error('[ScheduleClipDialog] Failed to load accounts:', err);
  } finally {
    loadingAccounts.value = false;
    console.log('[ScheduleClipDialog] Accounts loading complete. Org:', orgAccounts.value.length, 'Personal:', personalAccounts.value.length);
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
      const time = sameTimeForAll.value || selectedPlatforms.value.length === 1
        ? globalTime.value
        : platformTimes.value[platformId];
      
      if (!time) continue;
      
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledDateTime = new Date(props.selectedDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);
      
      // Create schedule data with local path (will be updated with R2 URL after upload)
      const scheduleData: any = {
        platform: platformId as 'instagram' | 'tiktok' | 'twitter' | 'youtube' | 'tokend',
        media_url: props.mediaUrl,
        thumbnail_url: props.thumbnailUrl,
        caption: caption.value || undefined,
        scheduled_at: scheduledDateTime.toISOString(),
        media_type: 'video',
        clip_id: props.clipId,
      };

      if (postingContext.value === 'org' && selectedOrgProfileId.value) {
        scheduleData.creator_profile_id = selectedOrgProfileId.value;
      } else if (postingContext.value === 'campaign') {
        if (selectedCampaignId.value) scheduleData.campaign_id = selectedCampaignId.value;
        if (selectedCampaignProfileId.value) scheduleData.creator_profile_id = selectedCampaignProfileId.value;
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
      showToast(`Successfully scheduled ${successful} post${successful !== 1 ? 's' : ''}`, 'success');
      
      emit('scheduled');
      
      if (failed === 0) {
        emit('close');
        
        // Background upload: wait for R2 upload to complete, then update post media URLs
        if (scheduledPostIds.length > 0) {
          console.log('[ScheduleClipDialog] Starting background upload for', scheduledPostIds.length, 'posts');
          startBackgroundUpload(scheduledPostIds).catch(err => {
            console.error('[ScheduleClipDialog] Background upload failed:', err);
            showToast('Upload failed - posts may not publish', 'error');
          });
        }
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
    postingContext.value = 'org';
    selectedOrgProfileId.value = null;
    selectedCampaignId.value = null;
    selectedCampaignProfileId.value = null;
    initializeDefaultTime();
    loadAccounts();
    loadOrgCreatorProfiles();
    loadCampaigns();
  }
}, { immediate: true });

onMounted(() => {
  console.log('[ScheduleClipDialog] Component mounted, open:', props.open);
  initializeDefaultTime();
  if (props.open) {
    loadAccounts();
    loadOrgCreatorProfiles();
    loadCampaigns();
  }
});
</script>
