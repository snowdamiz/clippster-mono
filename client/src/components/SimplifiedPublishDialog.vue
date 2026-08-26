<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="publish-dialog__overlay" @click.self="handleClose">
        <Transition name="dialog" appear>
          <div class="publish-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="publish-dialog__accent"></div>

            <!-- Header -->
            <div class="publish-dialog__header">
              <button class="publish-dialog__close" @click="handleClose" title="Close">
                <X :size="18" />
              </button>
              <div class="publish-dialog__icon">
                <Rocket :size="24" />
              </div>
              <h2 class="publish-dialog__title">Publish Clip</h2>
              <p class="publish-dialog__subtitle">{{ clip?.name || 'Clip' }} • {{ formatDuration(build.duration) }}</p>
              <!-- Badges -->
              <div class="publish-dialog__badges">
                <span class="publish-dialog__badge publish-dialog__badge--ratio">{{ parsedAspectRatio }}</span>
                <span v-if="brandingLabel" class="publish-dialog__badge publish-dialog__badge--branding">{{ brandingLabel }}</span>
              </div>
            </div>

            <!-- Content -->
            <div class="publish-dialog__content">
              <form class="publish-dialog__form" @submit.prevent="handlePublish">

                <!-- Post For -->
                <div class="publish-dialog__field">
                  <label class="publish-dialog__label">Post For</label>
                  <div class="publish-dialog__context-tabs">
                    <button
                      type="button"
                      :class="['publish-dialog__context-tab', { 'publish-dialog__context-tab--active': postingContext === 'org' }]"
                      @click="postingContext = 'org'"
                    >
                      <Building2 :size="14" />
                      <span>Organization</span>
                    </button>
                    <button
                      type="button"
                      :class="['publish-dialog__context-tab', { 'publish-dialog__context-tab--active': postingContext === 'campaign' }]"
                      @click="postingContext = 'campaign'"
                    >
                      <Trophy :size="14" />
                      <span>Campaign</span>
                    </button>
                  </div>

                  <!-- Org: creator profile dropdown (only if >1) -->
                  <div v-if="postingContext === 'org'" class="publish-dialog__context-detail">
                    <div v-if="loadingOrgProfiles" class="publish-dialog__hint">Loading profiles...</div>
                    <template v-else-if="orgCreatorProfiles.length > 0">
                      <div v-if="showOrgProfileDropdown" class="publish-dialog__select-wrap">
                        <label class="publish-dialog__label-sm">Creator Profile</label>
                        <button
                          type="button"
                          @click="showContextDropdown = showContextDropdown === 'org-profile' ? null : 'org-profile'"
                          class="publish-dialog__select"
                        >
                          <span class="publish-dialog__select-text">
                            {{ selectedOrgProfileId ? orgCreatorProfiles.find(p => p.id === selectedOrgProfileId)?.name : 'Select creator profile' }}
                          </span>
                          <ChevronDown :size="14" :class="{ 'publish-dialog__chevron--open': showContextDropdown === 'org-profile' }" class="publish-dialog__chevron" />
                        </button>
                        <div v-if="showContextDropdown === 'org-profile'" class="publish-dialog__dropdown">
                          <button
                            v-for="profile in orgCreatorProfiles"
                            :key="profile.id"
                            type="button"
                            @click="selectedOrgProfileId = profile.id; showContextDropdown = null"
                            class="publish-dialog__dropdown-item"
                            :class="{ 'publish-dialog__dropdown-item--selected': selectedOrgProfileId === profile.id }"
                          >
                            <div class="publish-dialog__profile-item">
                              <div class="publish-dialog__profile-avatar">
                                <img v-if="profile.profile_image_url" :src="profile.profile_image_url" />
                                <User v-else :size="12" />
                              </div>
                              <span>{{ profile.name }}</span>
                              <span v-if="profile.scope === 'global'" class="publish-dialog__profile-badge">Global</span>
                            </div>
                          </button>
                        </div>
                      </div>
                      <div v-else class="publish-dialog__context-auto">
                        <User :size="14" />
                        <span>Posting as: <strong>{{ orgCreatorProfiles[0]?.name }}</strong></span>
                      </div>
                    </template>
                    <p v-else class="publish-dialog__hint">No creator profiles found for this organization</p>
                  </div>

                  <!-- Campaign: campaign dropdown + optional branding profile dropdown -->
                  <div v-else-if="postingContext === 'campaign'" class="publish-dialog__context-detail">
                    <div v-if="loadingCampaigns" class="publish-dialog__hint">Loading campaigns...</div>
                    <template v-else-if="availableCampaigns.length > 0">
                      <div class="publish-dialog__select-wrap">
                        <label class="publish-dialog__label-sm">Campaign</label>
                        <button
                          type="button"
                          @click="showContextDropdown = showContextDropdown === 'campaign' ? null : 'campaign'"
                          class="publish-dialog__select"
                        >
                          <span class="publish-dialog__select-text">{{ selectedCampaign?.title ?? 'Select campaign' }}</span>
                          <ChevronDown :size="14" :class="{ 'publish-dialog__chevron--open': showContextDropdown === 'campaign' }" class="publish-dialog__chevron" />
                        </button>
                        <div v-if="showContextDropdown === 'campaign'" class="publish-dialog__dropdown">
                          <button
                            v-for="campaign in availableCampaigns"
                            :key="campaign.id"
                            type="button"
                            @click="selectedCampaignId = campaign.id; showContextDropdown = null"
                            class="publish-dialog__dropdown-item"
                            :class="{ 'publish-dialog__dropdown-item--selected': selectedCampaignId === campaign.id }"
                          >
                            <div class="publish-dialog__profile-item">
                              <div class="publish-dialog__profile-avatar publish-dialog__profile-avatar--campaign">
                                <img v-if="campaign.cover_image_url" :src="campaign.cover_image_url" />
                                <Trophy v-else :size="12" />
                              </div>
                              <span>{{ campaign.title }}</span>
                              <span v-if="campaign.organization" class="publish-dialog__profile-badge">{{ campaign.organization.name }}</span>
                            </div>
                          </button>
                        </div>
                      </div>

                      <!-- Branding profile (only if >1) -->
                      <div v-if="selectedCampaignId && showCampaignProfileDropdown" class="publish-dialog__select-wrap" style="margin-top: 0.5rem">
                        <label class="publish-dialog__label-sm">Branding Profile</label>
                        <button
                          type="button"
                          @click="showContextDropdown = showContextDropdown === 'campaign-profile' ? null : 'campaign-profile'"
                          class="publish-dialog__select"
                        >
                          <span class="publish-dialog__select-text">
                            {{ selectedCampaignProfileId ? campaignProfiles.find(p => p.id === selectedCampaignProfileId)?.name : 'Select branding profile' }}
                          </span>
                          <ChevronDown :size="14" :class="{ 'publish-dialog__chevron--open': showContextDropdown === 'campaign-profile' }" class="publish-dialog__chevron" />
                        </button>
                        <div v-if="showContextDropdown === 'campaign-profile'" class="publish-dialog__dropdown">
                          <button
                            v-for="profile in campaignProfiles"
                            :key="profile.id"
                            type="button"
                            @click="selectedCampaignProfileId = profile.id; showContextDropdown = null"
                            class="publish-dialog__dropdown-item"
                            :class="{ 'publish-dialog__dropdown-item--selected': selectedCampaignProfileId === profile.id }"
                          >
                            <div class="publish-dialog__profile-item">
                              <div class="publish-dialog__profile-avatar">
                                <img v-if="profile.profile_image_url" :src="profile.profile_image_url" />
                                <User v-else :size="12" />
                              </div>
                              <span>{{ profile.name }}</span>
                              <span v-if="profile.isGlobal" class="publish-dialog__profile-badge publish-dialog__profile-badge--global">Global</span>
                            </div>
                          </button>
                        </div>
                      </div>
                      <div v-else-if="selectedCampaignId && !showCampaignProfileDropdown && campaignProfiles.length === 1" class="publish-dialog__context-auto" style="margin-top: 0.5rem">
                        <User :size="14" />
                        <span>Branding: <strong>{{ campaignProfiles[0]?.name }}</strong></span>
                      </div>
                    </template>
                    <p v-else class="publish-dialog__hint">No active campaigns found. Join a campaign first.</p>
                  </div>
                </div>

                <!-- Platform Selection -->
                <div class="publish-dialog__field">
                  <label class="publish-dialog__label">Platforms *</label>
                  <div class="publish-dialog__platform-grid">
                    <label
                      v-for="platform in availablePlatforms"
                      :key="platform.id"
                      class="publish-dialog__platform-option"
                      :class="{ 'publish-dialog__platform-option--selected': isPlatformSelected(platform.id) }"
                    >
                      <input type="checkbox" :checked="isPlatformSelected(platform.id)" @change="togglePlatform(platform.id)" class="publish-dialog__checkbox" />
                      <component :is="platform.icon" :size="16" />
                      <span>{{ platform.label }}</span>
                    </label>
                  </div>
                  <p v-if="selectedPublishPlatforms.length === 0" class="publish-dialog__hint publish-dialog__hint--error">
                    Please select at least one platform
                  </p>
                </div>

                <!-- Account Selection -->
                <div v-if="selectedPublishPlatforms.length > 0" class="publish-dialog__field">
                  <label class="publish-dialog__label">Accounts *</label>
                  <div class="publish-dialog__account-configs">
                    <div v-for="platformId in selectedPublishPlatforms" :key="platformId" class="publish-dialog__account-config">
                      <div class="publish-dialog__account-label">
                        <component :is="getPlatformIcon(platformId)" :size="14" />
                        <span>{{ getPlatformLabel(platformId) }}</span>
                      </div>
                      <div class="publish-dialog__select-wrap">
                        <button
                          type="button"
                          @click="toggleAccountDropdown(platformId)"
                          class="publish-dialog__select"
                        >
                          <span class="publish-dialog__select-text">{{ getSelectedAccountLabel(platformId) || 'Select account...' }}</span>
                          <ChevronDown :size="14" :class="{ 'publish-dialog__chevron--open': activeAccountDropdown === platformId }" class="publish-dialog__chevron" />
                        </button>
                        <div v-if="activeAccountDropdown === platformId" class="publish-dialog__dropdown">
                          <button type="button" @click="selectAccount(platformId, '')" class="publish-dialog__dropdown-item" :class="{ 'publish-dialog__dropdown-item--selected': !platformConfigs[platformId]?.accountId }">
                            Select account...
                          </button>
                          <div v-if="loadingAccounts" class="publish-dialog__dropdown-item publish-dialog__dropdown-item--muted">
                            Loading accounts...
                          </div>
                          <template v-else-if="getPersonalAccountsForPlatform(platformId).length > 0">
                            <div class="publish-dialog__dropdown-group">Personal</div>
                            <button v-for="account in getPersonalAccountsForPlatform(platformId)" :key="`user-${account.id}`" type="button" @click="selectAccount(platformId, `user:${account.id}`)" class="publish-dialog__dropdown-item" :class="{ 'publish-dialog__dropdown-item--selected': platformConfigs[platformId]?.accountId === `user:${account.id}` }">
                              @{{ account.username }}
                            </button>
                          </template>
                          <template v-if="!loadingAccounts && getOrgAccountsForPlatform(platformId).length > 0">
                            <div class="publish-dialog__dropdown-group">Organization</div>
                            <button v-for="account in getOrgAccountsForPlatform(platformId)" :key="`org-${account.id}`" type="button" @click="selectAccount(platformId, `org:${account.id}`)" class="publish-dialog__dropdown-item" :class="{ 'publish-dialog__dropdown-item--selected': platformConfigs[platformId]?.accountId === `org:${account.id}` }">
                              @{{ account.username }}
                            </button>
                          </template>
                          <div
                            v-if="!loadingAccounts && getPersonalAccountsForPlatform(platformId).length === 0 && getOrgAccountsForPlatform(platformId).length === 0"
                            class="publish-dialog__dropdown-item publish-dialog__dropdown-item--muted"
                          >
                            No {{ getPlatformLabel(platformId) }} accounts connected. Connect one in Social / Profile settings.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Caption -->
                <div class="publish-dialog__field">
                  <label class="publish-dialog__label">Caption</label>
                  <textarea v-model="caption" rows="3" :maxlength="2200" placeholder="Add a caption for your post..." class="publish-dialog__textarea"></textarea>
                  <p class="publish-dialog__hint publish-dialog__hint--right">{{ caption.length }} / 2200</p>
                </div>

              </form>
            </div>

            <!-- Footer -->
            <div class="publish-dialog__footer">
              <button @click="handleClose" class="publish-dialog__btn publish-dialog__btn--secondary">
                Cancel
              </button>
              <button
                @click="handlePublish"
                :disabled="!canPublish || isPublishing"
                class="publish-dialog__btn publish-dialog__btn--primary"
              >
                <Loader2 v-if="isPublishing" :size="16" class="publish-dialog__spinner" />
                <Share2 v-else :size="16" />
                {{ isPublishing ? 'Publishing...' : `Publish (${selectedPublishPlatforms.length})` }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { X, Instagram, Youtube, ChevronDown, Rocket, Loader2, Share2, Building2, Trophy, User } from 'lucide-vue-next';
import XLogo from '@/components/icons/XLogo.vue';
import TiktokLogo from '@/components/icons/TiktokLogo.vue';
import TokendLogo from '@/components/icons/TokendLogo.vue';
import type { ClipBuild, Clip } from '@/services/database';
import { useBackgroundPublish } from '@/composables/useBackgroundPublish';
import { markBuildAsPublished } from '@/services/database/clip-build';
import { getMyAssignedAccounts, listSocialAccounts, type SocialAccount } from '@/services/socialAccountsApi';
import { listSocialAccounts as listUserSocialAccounts } from '@/services/clipperProfileApi';
import { listMyCampaigns, type Campaign } from '@/services/campaignApi';
import {
  getMyAssignedCreatorProfiles,
  listOrganizationCreatorProfiles,
  type ServerOrganizationCreatorProfile,
} from '@/services/organizationProfilesApi';
import { useAuthStore } from '@/stores/auth';
import { fetchTokendCapabilities } from '@/services/tokend';

type PersonalSocialAccount = {
  id: number;
  platform: string;
  provider?: string | null;
  username: string;
  is_active?: boolean;
};

type ClipWithBuilds = Clip & { builds: ClipBuild[] };

const props = defineProps<{
  modelValue: boolean;
  clip: ClipWithBuilds | null;
  build: ClipBuild;
  filePath: string;
  thumbnailUrl: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const backgroundPublish = useBackgroundPublish();
const authStore = useAuthStore();

function handleClose() {
  emit('update:modelValue', false);
  emit('close');
}

const parsedAspectRatio = computed(() => {
  const ar = props.build?.aspect_ratios;
  if (!ar) return '16:9';
  try {
    const parsed = JSON.parse(ar);
    if (Array.isArray(parsed)) return parsed[0] || '16:9';
    return parsed;
  } catch {
    return ar;
  }
});

const brandingLabel = computed(() => {
  if (props.build?.campaign_id) return props.build?.campaign_name || 'Campaign';
  if (props.build?.organization_id) return props.build?.organization_name || 'Organization';
  return null;
});

// Platform selection
const allPlatforms = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'twitter', label: 'X (Twitter)', icon: XLogo },
  { id: 'tiktok', label: 'TikTok', icon: TiktokLogo },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'tokend', label: 'Tokend', icon: TokendLogo },
];

const tokendPublishEnabled = ref(false);
const availablePlatforms = computed(() =>
  allPlatforms.filter((p) => p.id !== 'tokend' || tokendPublishEnabled.value)
);

const selectedPublishPlatforms = ref<string[]>([]);
const platformConfigs = ref<Record<string, { accountId?: string }>>({});
const caption = ref('');
const activeAccountDropdown = ref<string | null>(null);
const isPublishing = ref(false);

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
const showContextDropdown = ref<string | null>(null);

const selectedCampaign = computed(() =>
  availableCampaigns.value.find(c => c.id === selectedCampaignId.value) ?? null
);

const campaignProfiles = computed(() => {
  const c = selectedCampaign.value;
  if (!c) return [];
  const profiles: Array<{ id: number; name: string; profile_image_url: string | null; isGlobal: boolean }> = [];
  if (c.branding_profile) profiles.push({ ...c.branding_profile, isGlobal: true });
  if (c.creator_profiles) {
    for (const p of c.creator_profiles) {
      if (!profiles.find(x => x.id === p.id)) profiles.push({ ...p, isGlobal: false });
    }
  }
  return profiles;
});

const showOrgProfileDropdown = computed(() => orgCreatorProfiles.value.length > 1);
const showCampaignProfileDropdown = computed(() => campaignProfiles.value.length > 1);

function autoSelectCampaignProfile() {
  if (campaignProfiles.value.length === 1) {
    selectedCampaignProfileId.value = campaignProfiles.value[0].id;
  } else {
    selectedCampaignProfileId.value = null;
  }
}

watch(selectedCampaignId, () => autoSelectCampaignProfile());

watch(postingContext, () => {
  selectedOrgProfileId.value = null;
  selectedCampaignId.value = null;
  selectedCampaignProfileId.value = null;
  showContextDropdown.value = null;
  if (postingContext.value === 'org') {
    if (orgCreatorProfiles.value.length === 1) selectedOrgProfileId.value = orgCreatorProfiles.value[0].id;
  } else {
    if (availableCampaigns.value.length === 1) {
      selectedCampaignId.value = availableCampaigns.value[0].id;
      autoSelectCampaignProfile();
    }
  }
});

const trackingCampaignId = computed(() =>
  postingContext.value === 'campaign' ? selectedCampaignId.value : (props.build?.campaign_id ?? null)
);

const effectiveOrgId = computed((): number | null => {
  if (props.build?.organization_id) return Number(props.build.organization_id);
  if (authStore.user?.created_by_organization_id) {
    return Number(authStore.user.created_by_organization_id);
  }
  if (authStore.user?.owned_organization_id) {
    return Number(authStore.user.owned_organization_id);
  }
  return null;
});

const isOrgAdmin = ref(false);

// Load available social accounts
const loadingAccounts = ref(false);
const orgAccounts = ref<SocialAccount[]>([]);
const personalAccounts = ref<PersonalSocialAccount[]>([]);

function isPlatformSelected(platformId: string): boolean {
  return selectedPublishPlatforms.value.includes(platformId);
}

function togglePlatform(platformId: string) {
  const index = selectedPublishPlatforms.value.indexOf(platformId);
  if (index > -1) {
    selectedPublishPlatforms.value.splice(index, 1);
    delete platformConfigs.value[platformId];
  } else {
    selectedPublishPlatforms.value.push(platformId);
    platformConfigs.value[platformId] = {};
    autoSelectAccountIfOnlyOne(platformId);
  }
}

function getPlatformLabel(platformId: string): string {
  return allPlatforms.find(p => p.id === platformId)?.label || platformId;
}

function getPlatformIcon(platformId: string) {
  return allPlatforms.find(p => p.id === platformId)?.icon || Instagram;
}

function getPersonalAccountsForPlatform(platformId: string): PersonalSocialAccount[] {
  return personalAccounts.value.filter((account) => {
    if (account.is_active === false) return false;
    return matchesPlatformAccount(account.platform, platformId) ||
      (platformId === 'tokend' && account.provider === 'tokend');
  });
}

function autoSelectAccountIfOnlyOne(platformId: string) {
  if (platformConfigs.value[platformId]?.accountId) return;
  const personal = getPersonalAccountsForPlatform(platformId);
  const org = getOrgAccountsForPlatform(platformId);
  if (personal.length === 1 && org.length === 0) {
    platformConfigs.value[platformId] = { accountId: `user:${personal[0].id}` };
  } else if (org.length === 1 && personal.length === 0) {
    platformConfigs.value[platformId] = { accountId: `org:${org[0].id}` };
  }
}

function matchesPlatformAccount(accountPlatform: string, platformId: string): boolean {
  const platform = accountPlatform.toLowerCase();
  if (platformId === 'twitter') return platform === 'twitter' || platform === 'x';
  if (platformId === 'youtube') return platform === 'youtube' || platform === 'youtube_shorts';
  return platform === platformId;
}

function getOrgAccountsForPlatform(platformId: string): SocialAccount[] {
  return orgAccounts.value.filter(
    (a) => a.is_active && matchesPlatformAccount(a.platform, platformId)
  );
}

function getSelectedAccountLabel(platformId: string): string | null {
  const accountId = platformConfigs.value[platformId]?.accountId;
  if (!accountId) return null;
  
  const [type, id] = accountId.split(':');
  const idNum = Number(id);
  
  if (type === 'org') {
    const account = orgAccounts.value.find(a => a.id === idNum);
    return account ? `@${account.username}` : null;
  } else {
    const accounts = getPersonalAccountsForPlatform(platformId);
    const account = accounts.find(a => a.id === idNum);
    return account ? `@${account.username}` : null;
  }
}

function toggleAccountDropdown(platformId: string) {
  activeAccountDropdown.value = activeAccountDropdown.value === platformId ? null : platformId;
}

function selectAccount(platformId: string, accountId: string) {
  if (!platformConfigs.value[platformId]) {
    platformConfigs.value[platformId] = {};
  }
  platformConfigs.value[platformId].accountId = accountId || undefined;
  activeAccountDropdown.value = null;
}

const canPublish = computed(() => {
  if (selectedPublishPlatforms.value.length === 0) return false;
  
  for (const platformId of selectedPublishPlatforms.value) {
    if (!platformConfigs.value[platformId]?.accountId) return false;
  }
  
  return true;
});

async function resolveOrgAdmin(orgId: number) {
  const ownedOrgId = authStore.user?.owned_organization_id;
  if (ownedOrgId != null && Number(ownedOrgId) === orgId) {
    isOrgAdmin.value = true;
    return;
  }

  const orgsResult = await authStore.getOrganizations();
  if (orgsResult.success && orgsResult.organizations) {
    const membership = orgsResult.organizations.find((org: { id: number; role?: string }) => Number(org.id) === orgId);
    isOrgAdmin.value = membership?.role === 'owner' || membership?.role === 'admin';
    return;
  }

  isOrgAdmin.value = false;
}

async function loadOrgAccounts() {
  const orgId = effectiveOrgId.value;
  if (!orgId) {
    orgAccounts.value = [];
    return;
  }

  try {
    await resolveOrgAdmin(orgId);

    const orgResult = isOrgAdmin.value
      ? await listSocialAccounts(orgId)
      : await getMyAssignedAccounts(orgId);

    if (orgResult.success) {
      orgAccounts.value = (orgResult.accounts || []).filter((a) => a.is_active);
    } else {
      orgAccounts.value = [];
    }
  } catch (err) {
    console.error('[SimplifiedPublishDialog] Failed to load org accounts:', err);
    orgAccounts.value = [];
  }
}

async function loadOrgCreatorProfiles() {
  const orgId = effectiveOrgId.value;
  if (!orgId) return;
  loadingOrgProfiles.value = true;
  try {
    const res = isOrgAdmin.value
      ? await listOrganizationCreatorProfiles(orgId)
      : await getMyAssignedCreatorProfiles();

    if (res.success) {
      orgCreatorProfiles.value = res.profiles.filter((p) => {
        if ('disabled' in p && p.disabled) return false;
        if ('organization_id' in p && p.organization_id !== orgId) return false;
        return true;
      }) as ServerOrganizationCreatorProfile[];

      if (orgCreatorProfiles.value.length === 1) {
        selectedOrgProfileId.value = orgCreatorProfiles.value[0].id;
      }
    }
  } catch (err) {
    console.error('[SimplifiedPublishDialog] Failed to load org profiles:', err);
  } finally {
    loadingOrgProfiles.value = false;
  }
}

async function loadCampaigns() {
  loadingCampaigns.value = true;
  try {
    const res = await listMyCampaigns('active');
    if (res.success) {
      availableCampaigns.value = res.campaigns;
      if (availableCampaigns.value.length === 1) {
        selectedCampaignId.value = availableCampaigns.value[0].id;
        autoSelectCampaignProfile();
      }
    }
  } catch (err) {
    console.error('[SimplifiedPublishDialog] Failed to load campaigns:', err);
  } finally {
    loadingCampaigns.value = false;
  }
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function loadPersonalAccounts() {
  loadingAccounts.value = true;
  try {
    const res = await listUserSocialAccounts();
    if (res.success) {
      personalAccounts.value = (res.social_accounts || []).map((account) => ({
        id: account.id,
        platform: account.platform,
        provider: account.provider,
        username: account.username || account.display_name || `account-${account.id}`,
        is_active: account.is_active,
      }));
      for (const platformId of selectedPublishPlatforms.value) {
        autoSelectAccountIfOnlyOne(platformId);
      }
    } else {
      personalAccounts.value = [];
    }
  } catch (err) {
    console.error('[SimplifiedPublishDialog] Failed to load personal accounts:', err);
    personalAccounts.value = [];
  } finally {
    loadingAccounts.value = false;
  }
}

async function loadDialogData() {
  // Load accounts in parallel with profiles so Tokend (and other native providers)
  // appear even when org profile listing is slow.
  const [, tokendCaps] = await Promise.all([
    Promise.all([
      loadOrgAccounts().then(() =>
        Promise.all([loadOrgCreatorProfiles(), loadCampaigns()])
      ),
      loadPersonalAccounts(),
    ]),
    fetchTokendCapabilities().catch(() => null),
  ]);
  tokendPublishEnabled.value = tokendCaps?.publish === true;
  for (const platformId of selectedPublishPlatforms.value) {
    autoSelectAccountIfOnlyOne(platformId);
  }
}

onMounted(loadDialogData);

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) loadDialogData();
  }
);

async function handlePublish() {
  if (!canPublish.value || isPublishing.value) return;
  
  isPublishing.value = true;
  
  try {
    const aspectRatio = props.build?.aspect_ratios || '16:9';

    // Build publish targets and platformToRatioMap
    const publishTargets: any[] = [];
    const platformToRatioMap: Record<string, string> = {};

    for (const platformId of selectedPublishPlatforms.value) {
      const accountId = platformConfigs.value[platformId]?.accountId;
      if (!accountId) continue;
      
      const [accountType, accountIdStr] = accountId.split(':');
      publishTargets.push({
        platformId,
        accountType: accountType as 'org' | 'user',
        accountId: Number(accountIdStr),
      });

      // Map every platform to the build's aspect ratio
      platformToRatioMap[platformId] = aspectRatio;
    }

    // Start R2 upload of the already-built file first
    const aspectRatioOutputPaths: Record<string, string> = {
      [aspectRatio]: props.filePath,
    };

    const orgIdForPublish = effectiveOrgId.value;

    await backgroundPublish.startUpload(
      aspectRatioOutputPaths,
      props.thumbnailUrl || null,
      orgIdForPublish
    );

    const buildType = props.build?.branding_type === 'none' ? 'personal' : props.build?.branding_type;
    const metadata = {
      clipId: props.clip?.id,
      clipBuildId: props.build?.id,
      organizationId: orgIdForPublish ?? undefined,
      campaignId: props.build?.campaign_id || trackingCampaignId.value || undefined,
      creatorProfileId: postingContext.value === 'org'
        ? (selectedOrgProfileId.value ?? undefined)
        : (selectedCampaignProfileId.value ?? undefined),
      buildType: buildType as 'org' | 'campaign' | 'personal' | undefined,
      aspectRatio,
      platformToRatioMap,
    };
    
    backgroundPublish.queuePublish(
      publishTargets,
      caption.value,
      orgIdForPublish,
      props.thumbnailUrl || null,
      metadata
    );
    
    if (props.build?.id) {
      await markBuildAsPublished(props.build.id);
    }
    
    emit('update:modelValue', false);
    emit('close');
  } finally {
    isPublishing.value = false;
  }
}
</script>

<style scoped>
/* ===== Overlay ===== */
.publish-dialog__overlay {
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
.publish-dialog {
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
.publish-dialog__accent {
  height: 3px;
  background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  flex-shrink: 0;
}

/* ===== Header ===== */
.publish-dialog__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1.5rem 1rem;
  text-align: center;
}

.publish-dialog__close {
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
.publish-dialog__close:hover {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.publish-dialog__icon {
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

.publish-dialog__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.publish-dialog__subtitle {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0.25rem 0 0;
}

.publish-dialog__badges {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 0.75rem;
}

.publish-dialog__badge {
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid;
}

.publish-dialog__badge--ratio {
  background: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  border-color: rgba(6, 182, 212, 0.4);
}

.publish-dialog__badge--branding {
  background: rgba(255, 255, 255, 0.05);
  color: var(--sidebar-text-muted);
  border-color: var(--sidebar-border);
  font-weight: 500;
}

/* ===== Content Area ===== */
.publish-dialog__content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1.5rem 1.5rem;
}

.publish-dialog__content::-webkit-scrollbar { width: 6px; }
.publish-dialog__content::-webkit-scrollbar-track { background: transparent; }
.publish-dialog__content::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.15); border-radius: 3px; }

/* ===== Posting Context ===== */
.publish-dialog__context-tabs {
  display: flex;
  gap: 0.375rem;
  padding: 0.25rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
}

.publish-dialog__context-tab {
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

.publish-dialog__context-tab:hover:not(.publish-dialog__context-tab--active) {
  color: var(--sidebar-text);
  background-color: rgba(255, 255, 255, 0.05);
}

.publish-dialog__context-tab--active {
  background-color: var(--sidebar-surface);
  color: var(--sidebar-accent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.publish-dialog__context-detail {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.publish-dialog__context-auto {
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

.publish-dialog__context-auto strong {
  color: var(--sidebar-text);
  font-weight: 600;
}

.publish-dialog__label-sm {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--sidebar-text-muted);
}

.publish-dialog__profile-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  overflow: hidden;
}

.publish-dialog__profile-avatar {
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

.publish-dialog__profile-avatar--campaign {
  border-radius: 6px;
}

.publish-dialog__profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.publish-dialog__profile-badge {
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

.publish-dialog__profile-badge--global {
  background-color: rgba(34, 197, 94, 0.15);
  color: rgb(134, 239, 172);
  border-color: rgba(34, 197, 94, 0.25);
}

/* ===== Form ===== */
.publish-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.publish-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.publish-dialog__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.publish-dialog__hint {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}
.publish-dialog__hint--error { color: #ef4444; }
.publish-dialog__hint--right { text-align: right; }

/* ===== Platform Grid ===== */
.publish-dialog__platform-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.625rem;
}

.publish-dialog__platform-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.8125rem;
  color: var(--sidebar-text);
}
.publish-dialog__platform-option:hover { border-color: rgba(6, 182, 212, 0.3); }
.publish-dialog__platform-option--selected {
  border-color: var(--sidebar-accent);
  background-color: rgba(6, 182, 212, 0.1);
}
.publish-dialog__checkbox { display: none; }

/* ===== Account Configs ===== */
.publish-dialog__account-configs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.publish-dialog__account-config {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.publish-dialog__account-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 100px;
  font-size: 0.8125rem;
  color: var(--sidebar-text);
  flex-shrink: 0;
}

/* ===== Select / Dropdown ===== */
.publish-dialog__select-wrap {
  position: relative;
  flex: 1;
}

.publish-dialog__select {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  font-family: inherit;
  cursor: pointer;
  transition: all 150ms ease;
  text-align: left;
}
.publish-dialog__select:hover { border-color: rgba(255, 255, 255, 0.1); }
.publish-dialog__select:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

.publish-dialog__select-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.publish-dialog__chevron {
  flex-shrink: 0;
  color: var(--sidebar-text-muted);
  transition: transform 150ms ease;
}
.publish-dialog__chevron--open { transform: rotate(180deg); }

.publish-dialog__dropdown {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  max-height: 200px;
  overflow-y: auto;
  z-index: 10001;
}
.publish-dialog__dropdown::-webkit-scrollbar { width: 6px; }
.publish-dialog__dropdown::-webkit-scrollbar-track { background: transparent; }
.publish-dialog__dropdown::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.15); border-radius: 3px; }

.publish-dialog__dropdown-group {
  padding: 0.5rem 0.875rem 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.publish-dialog__dropdown-item {
  width: 100%;
  padding: 0.625rem 0.875rem;
  background: transparent;
  border: none;
  text-align: left;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  cursor: pointer;
  transition: background-color 150ms ease;
  display: block;
}
.publish-dialog__dropdown-item:hover { background-color: var(--sidebar-hover); }
.publish-dialog__dropdown-item--selected {
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  font-weight: 500;
}
.publish-dialog__dropdown-item--muted {
  opacity: 0.65;
  cursor: default;
  white-space: normal;
  line-height: 1.35;
  pointer-events: none;
}

/* ===== Textarea ===== */
.publish-dialog__textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  font-family: inherit;
  transition: all 150ms ease;
  resize: vertical;
  min-height: 80px;
}
.publish-dialog__textarea:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}
.publish-dialog__textarea::placeholder { color: var(--sidebar-text-muted); opacity: 0.6; }

/* ===== Footer ===== */
.publish-dialog__footer {
  display: flex;
  gap: 0.625rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--sidebar-border);
}

/* ===== Buttons ===== */
.publish-dialog__btn {
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
.publish-dialog__btn:disabled { opacity: 0.5; cursor: not-allowed; }

.publish-dialog__btn--secondary {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
  border: 1px solid var(--sidebar-border);
}
.publish-dialog__btn--secondary:hover:not(:disabled) {
  background-color: var(--sidebar-active);
  border-color: rgba(255, 255, 255, 0.1);
}

.publish-dialog__btn--primary {
  background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
  color: white;
}
.publish-dialog__btn--primary:hover:not(:disabled) { opacity: 0.9; }

.publish-dialog__spinner {
  animation: spin 0.8s linear infinite;
}

/* ===== Transitions ===== */
.modal-enter-active, .modal-leave-active { transition: opacity 200ms ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

.dialog-enter-active { transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1); }
.dialog-leave-active { transition: all 150ms ease-in; }
.dialog-enter-from { opacity: 0; transform: scale(0.96) translateY(8px); }
.dialog-leave-to { opacity: 0; transform: scale(0.98); }

@keyframes spin { to { transform: rotate(360deg); } }
</style>
