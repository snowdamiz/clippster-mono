<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="schedule-dialog__overlay" @click.self="handleClose">
        <Transition name="dialog" appear>
          <div v-if="open" class="schedule-dialog" role="dialog" aria-modal="true" aria-labelledby="schedule-dialog-title">
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
              <h2 id="schedule-dialog-title" class="schedule-dialog__title">Schedule Clip</h2>
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

                <!-- Posting Context -->
                <div class="schedule-dialog__field">
                  <label class="schedule-dialog__label">Post For</label>
                  <div class="schedule-dialog__context-tabs">
                    <button
                      type="button"
                      :class="['schedule-dialog__context-tab', { 'schedule-dialog__context-tab--active': postingContext === 'org' }]"
                      @click="postingContext = 'org'"
                    >
                      <Building2 :size="14" />
                      <span>Organization</span>
                    </button>
                    <button
                      type="button"
                      :class="['schedule-dialog__context-tab', { 'schedule-dialog__context-tab--active': postingContext === 'campaign' }]"
                      @click="postingContext = 'campaign'"
                    >
                      <Trophy :size="14" />
                      <span>Campaign</span>
                    </button>
                  </div>

                  <!-- Org: creator profile dropdown (only if >1) -->
                  <div v-if="postingContext === 'org'" class="schedule-dialog__context-detail">
                    <div v-if="loadingOrgProfiles" class="schedule-dialog__field-hint">Loading profiles...</div>
                    <template v-else-if="orgCreatorProfiles.length > 0">
                      <div v-if="showOrgProfileDropdown" class="schedule-dialog__dropdown-wrapper">
                        <label class="schedule-dialog__label-sm">Creator Profile</label>
                        <button
                          type="button"
                          @click="toggleDropdown('org-profile')"
                          :disabled="scheduling"
                          class="schedule-dialog__dropdown-trigger"
                        >
                          <span class="truncate">
                            <template v-if="selectedOrgProfileId">
                              {{ orgCreatorProfiles.find(p => p.id === selectedOrgProfileId)?.name }}
                            </template>
                            <template v-else>Select creator profile</template>
                          </span>
                          <ChevronDown
                            class="schedule-dialog__dropdown-chevron"
                            :class="{ 'schedule-dialog__dropdown-chevron--open': openDropdown === 'org-profile' }"
                            :size="16"
                          />
                        </button>
                        <div v-if="openDropdown === 'org-profile'" class="schedule-dialog__dropdown">
                          <button
                            v-for="profile in orgCreatorProfiles"
                            :key="profile.id"
                            type="button"
                            @click="selectedOrgProfileId = profile.id; openDropdown = null"
                            class="schedule-dialog__dropdown-item"
                            :class="{ 'schedule-dialog__dropdown-item--selected': selectedOrgProfileId === profile.id }"
                          >
                            <div class="schedule-dialog__profile-item">
                              <div class="schedule-dialog__profile-avatar">
                                <img v-if="profile.profile_image_url" :src="profile.profile_image_url" />
                                <User v-else :size="12" />
                              </div>
                              <span>{{ profile.name }}</span>
                              <span v-if="profile.scope === 'global'" class="schedule-dialog__profile-badge">Global</span>
                            </div>
                          </button>
                        </div>
                      </div>
                      <div v-else class="schedule-dialog__context-auto">
                        <User :size="14" />
                        <span>Posting as: <strong>{{ orgCreatorProfiles[0]?.name }}</strong></span>
                      </div>
                    </template>
                    <p v-else class="schedule-dialog__field-hint">No creator profiles found for this organization</p>
                  </div>

                  <!-- Campaign: campaign dropdown + optional profile dropdown -->
                  <div v-else-if="postingContext === 'campaign'" class="schedule-dialog__context-detail">
                    <div v-if="loadingCampaigns" class="schedule-dialog__field-hint">Loading campaigns...</div>
                    <template v-else-if="availableCampaigns.length > 0">
                      <!-- Campaign selector -->
                      <div class="schedule-dialog__dropdown-wrapper">
                        <label class="schedule-dialog__label-sm">Campaign</label>
                        <button
                          type="button"
                          @click="toggleDropdown('campaign')"
                          :disabled="scheduling"
                          class="schedule-dialog__dropdown-trigger"
                        >
                          <span class="truncate">
                            {{ selectedCampaign?.title ?? 'Select campaign' }}
                          </span>
                          <ChevronDown
                            class="schedule-dialog__dropdown-chevron"
                            :class="{ 'schedule-dialog__dropdown-chevron--open': openDropdown === 'campaign' }"
                            :size="16"
                          />
                        </button>
                        <div v-if="openDropdown === 'campaign'" class="schedule-dialog__dropdown">
                          <button
                            v-for="campaign in availableCampaigns"
                            :key="campaign.id"
                            type="button"
                            @click="selectedCampaignId = campaign.id; openDropdown = null"
                            class="schedule-dialog__dropdown-item"
                            :class="{ 'schedule-dialog__dropdown-item--selected': selectedCampaignId === campaign.id }"
                          >
                            <div class="schedule-dialog__profile-item">
                              <div class="schedule-dialog__profile-avatar schedule-dialog__profile-avatar--campaign">
                                <img v-if="campaign.cover_image_url" :src="campaign.cover_image_url" />
                                <Trophy v-else :size="12" />
                              </div>
                              <span>{{ campaign.title }}</span>
                              <span v-if="campaign.organization" class="schedule-dialog__profile-badge">{{ campaign.organization.name }}</span>
                            </div>
                          </button>
                        </div>
                      </div>

                      <!-- Campaign branding profile (only if >1 profile) -->
                      <div v-if="selectedCampaignId && showCampaignProfileDropdown" class="schedule-dialog__dropdown-wrapper" style="margin-top: 0.5rem">
                        <label class="schedule-dialog__label-sm">Branding Profile</label>
                        <button
                          type="button"
                          @click="toggleDropdown('campaign-profile')"
                          :disabled="scheduling"
                          class="schedule-dialog__dropdown-trigger"
                        >
                          <span class="truncate">
                            <template v-if="selectedCampaignProfileId">
                              {{ campaignProfiles.find(p => p.id === selectedCampaignProfileId)?.name }}
                            </template>
                            <template v-else>Select branding profile</template>
                          </span>
                          <ChevronDown
                            class="schedule-dialog__dropdown-chevron"
                            :class="{ 'schedule-dialog__dropdown-chevron--open': openDropdown === 'campaign-profile' }"
                            :size="16"
                          />
                        </button>
                        <div v-if="openDropdown === 'campaign-profile'" class="schedule-dialog__dropdown">
                          <button
                            v-for="profile in campaignProfiles"
                            :key="profile.id"
                            type="button"
                            @click="selectedCampaignProfileId = profile.id; openDropdown = null"
                            class="schedule-dialog__dropdown-item"
                            :class="{ 'schedule-dialog__dropdown-item--selected': selectedCampaignProfileId === profile.id }"
                          >
                            <div class="schedule-dialog__profile-item">
                              <div class="schedule-dialog__profile-avatar">
                                <img v-if="profile.profile_image_url" :src="profile.profile_image_url" />
                                <User v-else :size="12" />
                              </div>
                              <span>{{ profile.name }}</span>
                              <span v-if="profile.isGlobal" class="schedule-dialog__profile-badge schedule-dialog__profile-badge--global">Global</span>
                            </div>
                          </button>
                        </div>
                      </div>
                      <!-- Auto-selected single profile indicator -->
                      <div v-else-if="selectedCampaignId && !showCampaignProfileDropdown && campaignProfiles.length === 1" class="schedule-dialog__context-auto" style="margin-top: 0.5rem">
                        <User :size="14" />
                        <span>Branding: <strong>{{ campaignProfiles[0]?.name }}</strong></span>
                      </div>
                    </template>
                    <p v-else class="schedule-dialog__field-hint">No active campaigns found. Join a campaign first.</p>
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
                  <CustomTimePicker
                    v-model="globalTime"
                    :disabled="scheduling"
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
import { X, Calendar, CalendarDays, FileVideo, Loader2, AlertCircle, CheckCircle2, Instagram, Youtube, ChevronDown, Share2, Building2, Trophy, User } from 'lucide-vue-next';
import XLogo from '@/components/icons/XLogo.vue';
import TiktokLogo from '@/components/icons/TiktokLogo.vue';
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
import { listMyCampaigns, type Campaign } from '@/services/campaignApi';

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
  { id: 'tiktok', label: 'TikTok', icon: TiktokLogo },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
];

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
  return personalAccounts.value.filter(a => {
    const accountPlatform = a.platform.toLowerCase();
    // Handle Twitter/X naming
    if (platformId === 'twitter') {
      return accountPlatform === 'twitter' || accountPlatform === 'x';
    }
    return accountPlatform === platformId;
  });
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
      availableCampaigns.value = res.campaigns;
      if (availableCampaigns.value.length === 1) {
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
        platform: platformId as 'instagram' | 'tiktok' | 'twitter' | 'youtube',
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

<style scoped>
/* ===== Overlay ===== */
.schedule-dialog__overlay {
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
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
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

/* ===== Posting Context ===== */
.schedule-dialog__context-tabs {
  display: flex;
  gap: 0.375rem;
  padding: 0.25rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
}

.schedule-dialog__context-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--sidebar-text-muted);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 150ms ease;
}

.schedule-dialog__context-tab:hover:not(.schedule-dialog__context-tab--active) {
  color: var(--sidebar-text);
  background-color: rgba(255, 255, 255, 0.05);
}

.schedule-dialog__context-tab--active {
  background-color: var(--sidebar-surface);
  color: var(--sidebar-accent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.schedule-dialog__context-detail {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.schedule-dialog__context-auto {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background-color: rgba(6, 182, 212, 0.06);
  border: 1px solid rgba(6, 182, 212, 0.15);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
}

.schedule-dialog__context-auto strong {
  color: var(--sidebar-text);
  font-weight: 600;
}

.schedule-dialog__profile-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  overflow: hidden;
}

.schedule-dialog__profile-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--sidebar-text-muted);
}

.schedule-dialog__profile-avatar--campaign {
  border-radius: 6px;
}

.schedule-dialog__profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.schedule-dialog__profile-badge {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  border: 1px solid rgba(6, 182, 212, 0.25);
}

.schedule-dialog__profile-badge--global {
  background-color: rgba(34, 197, 94, 0.15);
  color: rgb(134, 239, 172);
  border-color: rgba(34, 197, 94, 0.25);
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
  color: white;
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
