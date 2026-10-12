<template>
  <PublishDialogShell
    :open="modelValue"
    :title="isImageMedia ? 'Publish image' : 'Publish clip'"
    :icon="Share2"
    size="lg"
    :busy="isPublishing"
    :can-submit="canPublish"
    :submit-label="`Publish (${selectedPublishPlatforms.length})`"
    :submit-icon="Share2"
    @close="handleClose"
    @submit="handlePublish"
  >
    <PublishMediaSummary
      :thumbnail-url="thumbnailUrl"
      :title="isImageMedia ? title || clip?.name || 'Image' : clip?.name || title || 'Clip'"
      :meta="[isImageMedia ? 'Image' : formatDuration(build?.duration)]"
    >
      <Badge variant="outline">{{ parsedAspectRatio }}</Badge>
      <Badge v-if="brandingLabel" variant="neutral">{{ brandingLabel }}</Badge>
    </PublishMediaSummary>

    <PublishContextPicker
      v-model:context="postingContext"
      v-model:org-profile-id="selectedOrgProfileId"
      v-model:campaign-id="selectedCampaignId"
      v-model:campaign-profile-id="selectedCampaignProfileId"
      :loading-org-profiles="loadingOrgProfiles"
      :org-profiles="orgCreatorProfiles"
      :loading-campaigns="loadingCampaigns"
      :campaigns="availableCampaigns"
      :campaign-profiles="campaignProfiles"
    />

    <Field label="Platforms" required :hint="selectedPublishPlatforms.length === 0 ? 'Select at least one platform' : undefined">
      <PublishPlatformPicker :platforms="availablePlatforms" :selected="selectedPublishPlatforms" @toggle="togglePlatform" />
    </Field>

    <Field v-if="selectedPublishPlatforms.length > 0" label="Accounts" required>
      <div class="flex flex-col gap-2">
        <PublishPlatformRow
          v-for="platformId in selectedPublishPlatforms"
          :key="platformId"
          :platform="platformId"
          :label="getPlatformLabel(platformId)"
        >
          <PublishAccountSelect
            :model-value="platformConfigs[platformId]?.accountId"
            :groups="[
              { label: 'Personal', prefix: 'user', accounts: getPersonalAccountsForPlatform(platformId) },
              { label: 'Organization', prefix: 'org', accounts: getOrgAccountsForPlatform(platformId) },
            ]"
            :loading="loadingAccounts"
            :empty-text="`No ${getPlatformLabel(platformId)} accounts connected. Connect one in Social / Profile settings.`"
            @update:model-value="(v) => selectAccount(platformId, v)"
          />
        </PublishPlatformRow>
      </div>
    </Field>

    <PublishCaptionField v-model="caption" :maxlength="2200" />
  </PublishDialogShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Instagram, Youtube, Share2 } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import PublishDialogShell from '@/components/publish/PublishDialogShell.vue';
import PublishMediaSummary from '@/components/publish/PublishMediaSummary.vue';
import PublishContextPicker from '@/components/publish/PublishContextPicker.vue';
import PublishPlatformPicker from '@/components/publish/PublishPlatformPicker.vue';
import PublishPlatformRow from '@/components/publish/PublishPlatformRow.vue';
import PublishAccountSelect from '@/components/publish/PublishAccountSelect.vue';
import PublishCaptionField from '@/components/publish/PublishCaptionField.vue';
import XLogo from '@/components/icons/XLogo.vue';
import TiktokLogo from '@/components/icons/TiktokLogo.vue';
import TokendLogo from '@/components/icons/TokendLogo.vue';
import type { ClipBuild, Clip } from '@/services/database';
import { useBackgroundPublish } from '@/composables/useBackgroundPublish';
import { markBuildAsPublished } from '@/services/database/clip-build';
import { getMyAssignedAccounts, listSocialAccounts, type SocialAccount } from '@/services/socialAccountsApi';
import { listSocialAccounts as listUserSocialAccounts } from '@/services/clipperProfileApi';
import { listMyCampaigns, filterCampaignsOpenForPosting, type Campaign } from '@/services/campaignApi';
import {
  getMyAssignedCreatorProfiles,
  listOrganizationCreatorProfiles,
  type ServerOrganizationCreatorProfile,
} from '@/services/organizationProfilesApi';
import { useAuthStore } from '@/stores/auth';
import { fetchTokendCapabilities } from '@/services/tokend';
import { canAccessTokend } from '@/utils/tokendAccess';

type PersonalSocialAccount = {
  id: number;
  platform: string;
  provider?: string | null;
  username: string;
  is_active?: boolean;
};

type ClipWithBuilds = Clip & { builds: ClipBuild[] };

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    clip?: ClipWithBuilds | null;
    build?: ClipBuild | null;
    filePath: string;
    thumbnailUrl: string | null;
    /** Defaults to video (clip builds). Pass 'image' for Image Library publishing. */
    mediaType?: 'video' | 'image';
    /** Display title when publishing non-clip media (e.g. image name). */
    title?: string;
    /** Override aspect ratio when no build is provided. */
    aspectRatio?: string;
  }>(),
  {
    clip: null,
    build: null,
    mediaType: 'video',
    title: undefined,
    aspectRatio: undefined,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
  published: [];
}>();

const backgroundPublish = useBackgroundPublish();
const authStore = useAuthStore();

function handleClose() {
  emit('update:modelValue', false);
  emit('close');
}

const isImageMedia = computed(() => props.mediaType === 'image');

const dialogSubtitle = computed(() => {
  if (isImageMedia.value) {
    return props.title || props.clip?.name || 'Image';
  }
  const name = props.clip?.name || props.title || 'Clip';
  const duration = formatDuration(props.build?.duration);
  return duration ? `${name} • ${duration}` : name;
});

const parsedAspectRatio = computed(() => {
  if (props.aspectRatio) return props.aspectRatio;
  const ar = props.build?.aspect_ratios;
  if (!ar) return isImageMedia.value ? '1:1' : '16:9';
  try {
    const parsed = JSON.parse(ar);
    if (Array.isArray(parsed)) return parsed[0] || (isImageMedia.value ? '1:1' : '16:9');
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
  allPlatforms.filter(
    (p) => p.id !== 'tokend' || (tokendPublishEnabled.value && canAccessTokend(authStore.user))
  )
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
      availableCampaigns.value = filterCampaignsOpenForPosting(res.campaigns);
      if (availableCampaigns.value.length === 0 && postingContext.value === 'campaign') {
        postingContext.value = 'org';
        selectedCampaignId.value = null;
        selectedCampaignProfileId.value = null;
      } else if (availableCampaigns.value.length === 1) {
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
    const aspectRatio = parsedAspectRatio.value;

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

      // Map every platform to the media aspect ratio
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
      mediaType: (isImageMedia.value ? 'image' : 'video') as 'image' | 'video',
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

    emit('published');
    emit('update:modelValue', false);
    emit('close');
  } finally {
    isPublishing.value = false;
  }
}
</script>
