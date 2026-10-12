<script setup lang="ts">
  /**
   * Create-campaign wizard (8 steps) and edit-campaign form for organization
   * admins. Owns the form state and the create/update calls; emits `saved`
   * after a successful save so the list can reload.
   *
   *   formDialog.value?.openCreateDialog()
   *   formDialog.value?.editCampaign(campaign)
   */
  import { ref, reactive, computed } from 'vue';
  import { AlertTriangle, Calendar, Check, DollarSign, Film, Globe, Link2, Megaphone, Users } from 'lucide-vue-next';
  import { Modal } from '@/components/ui/modal';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Textarea } from '@/components/ui/textarea';
  import { Switch } from '@/components/ui/switch';
  import { SectionHeader } from '@/components/ui/section-header';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { InfoList, type InfoListItem } from '@/components/ui/info-list';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Avatar } from '@/components/ui/avatar';
  import { EmptyState } from '@/components/ui/empty-state';
  import CampaignResourcesEditor from '@/components/campaigns/CampaignResourcesEditor.vue';
  import { ToggleChips } from '@/components/ui/toggle-chips';
  import CampaignPricingFields from './CampaignPricingFields.vue';
  import CampaignScheduleFields from './CampaignScheduleFields.vue';
  import CampaignCoverField from './CampaignCoverField.vue';
  import CreatorProfileOption from './CreatorProfileOption.vue';
  import { formatBudget, formatCpm, formatDate, formatViews, type CampaignFormState } from './campaignForm';
  import {
    createCampaign,
    updateCampaign,
    uploadCampaignCoverImage,
    setCampaignCreatorProfiles,
    CAMPAIGN_CONTENT_VERTICALS,
    type Campaign,
    type CampaignResource,
    getPlatformDisplayName,
  } from '@/services/campaignApi';
  import {
    listOrganizationCreatorProfiles,
    type ServerOrganizationCreatorProfile,
  } from '@/services/organizationProfilesApi';
  import { listOrganizationAssets, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
  import { CLIPPER_PLATFORMS, PAYMENT_METHOD_TYPES } from '@/services/clipperProfileApi';
  import { useToast } from '@/composables/useToast';

  const props = defineProps<{
    organizationId: string;
  }>();

  const emit = defineEmits<{ saved: [] }>();

  const { toast } = useToast();

  const saving = ref(false);
  const error = ref<string | null>(null);
  const showCampaignDialog = ref(false);
  const editingCampaign = ref<Campaign | null>(null);
  const campaignResources = ref<CampaignResource[]>([]);

  // Cover image upload
  const coverImagePreview = ref('');
  const uploadingCoverImage = ref(false);

  const availablePlatforms = CLIPPER_PLATFORMS;
  const availablePaymentMethods = PAYMENT_METHOD_TYPES;

  // Creator profiles and assets for campaign assignment
  const availableCreatorProfiles = ref<ServerOrganizationCreatorProfile[]>([]);
  const availableAssets = ref<ServerOrganizationAsset[]>([]);
  const loadingProfiles = ref(false);
  const selectedCreatorProfileIds = ref<(number | null)[]>([]);
  const isGlobalBrandingSelected = ref(false);

  // Check if organization has global branding setup (has branding assets and at least one creator profile)
  const hasGlobalBranding = computed(() => {
    // Don't show global branding option while still loading
    if (loadingProfiles.value) {
      return false;
    }

    const brandingAssets = availableAssets.value.filter((asset) =>
      ['intro', 'outro', 'watermark'].includes(asset.asset_type)
    );
    const hasBrandingAssets = brandingAssets.length > 0;
    const hasProfiles = availableCreatorProfiles.value.length > 0;

    console.log('[Campaign Branding] hasGlobalBranding check:', {
      loading: loadingProfiles.value,
      totalAssets: availableAssets.value.length,
      brandingAssets: brandingAssets.map((a) => ({ id: a.id, type: a.asset_type, name: a.name })),
      hasBrandingAssets,
      profileCount: availableCreatorProfiles.value.length,
      hasProfiles,
      result: hasBrandingAssets && hasProfiles,
    });

    return hasBrandingAssets && hasProfiles;
  });

  // Options for global branding - only show profiles with scope='global'
  const globalBrandingProfileOptions = computed(() => {
    const globalProfiles = availableCreatorProfiles.value.filter((p) => p.scope === 'global');
    return globalProfiles.map((p) => ({ label: p.name, value: p.id }));
  });

  const campaignForm = reactive<CampaignFormState>({
    title: '',
    description: '',
    cpm: 0,
    cpm_views: 1000,
    budget: 0,
    min_views_for_payment: 1000,
    max_views: null,
    join_type: 'open',
    allowed_platforms: [],
    payment_methods: [],
    cover_image_url: '',
    starts_at: '',
    ends_at: '',
    // Payment model
    payment_model: 'cpm',
    per_clip_amount: 0,
    clips_per_profile: 5,
    // Creator and branding
    creator_profile_id: null,
    branding_profile_id: null,
    content_vertical: null,
    campaign_goal: '',
    content_style_tags: [],
  });

  const contentVerticalOptions = CAMPAIGN_CONTENT_VERTICALS.map((item) => ({
    value: item.value,
    label: item.label,
  }));

  // Wizard state
  const currentStep = ref(1);
  const totalSteps = 8;

  const wizardSteps = [
    { title: "Let's name your campaign", description: 'Give your campaign a title and description', icon: Megaphone },
    { title: 'Set your pricing', description: 'Configure payment model and budget', icon: DollarSign },
    { title: 'When will this run?', description: 'Set campaign duration and access type', icon: Calendar },
    { title: 'Where can clippers post?', description: 'Select platforms and payment methods', icon: Globe },
    { title: 'Campaign branding', description: 'Choose global branding or specific creator profiles', icon: Users },
    { title: 'Campaign assets', description: 'Add a cover image for your campaign', icon: Film },
    {
      title: 'Add source content',
      description: 'Share video, audio, or reference links clippers can open directly in Clippster',
      icon: Link2,
    },
    { title: 'Review your campaign', description: 'Make sure everything looks good', icon: Check },
  ];

  const stepInfo = computed(() => wizardSteps[currentStep.value - 1]);

  // Validation for each wizard step
  const canProceed = computed(() => {
    switch (currentStep.value) {
      case 1:
        // Basic Info - require title
        return campaignForm.title && campaignForm.title.trim().length >= 2;
      case 2:
        // Pricing & Budget - all optional, always allow proceed
        return true;
      case 3:
        // Schedule & Access - all optional
        return true;
      case 4:
        // Platforms & Payments - all optional
        return true;
      case 5:
        // Creator Profiles - optional
        return true;
      case 6:
        // Campaign Assets - all optional
        return true;
      case 7:
        // Source materials - optional
        return true;
      case 8:
        // Review - always allow proceed to create
        return true;
      default:
        return true;
    }
  });

  // Validation for edit form
  const canProceedEdit = computed(() => {
    // Require title with at least 2 characters
    return campaignForm.title && campaignForm.title.trim().length >= 2;
  });

  const nextStep = () => {
    if (canProceed.value && currentStep.value < totalSteps) {
      currentStep.value++;
    }
  };

  const prevStep = () => {
    if (currentStep.value > 1) {
      currentStep.value--;
    }
  };

  /** Review step summary rows. */
  const summaryRows = computed<InfoListItem[]>(() => {
    const rows: InfoListItem[] = [];
    if (campaignForm.payment_model === 'per_clip') {
      rows.push({
        label: 'Pricing',
        value: `$${formatCpm(campaignForm.per_clip_amount)} per clip · ${campaignForm.clips_per_profile} per profile`,
        strong: true,
      });
    } else {
      rows.push({
        label: 'Pricing',
        value: `$${formatCpm(campaignForm.cpm)} per ${formatViews(campaignForm.cpm_views)} views`,
        strong: true,
      });
    }
    rows.push({ label: 'Budget', value: `$${formatBudget(campaignForm.budget)}` });
    if (campaignForm.starts_at) rows.push({ label: 'Start', value: formatDate(campaignForm.starts_at) });
    if (campaignForm.ends_at) rows.push({ label: 'End', value: formatDate(campaignForm.ends_at) });
    if (campaignForm.allowed_platforms.length) {
      rows.push({
        label: 'Platforms',
        value: campaignForm.allowed_platforms.map((platform) => getPlatformDisplayName(platform)).join(', '),
      });
    }
    if (selectedCreatorProfileIds.value.length) {
      rows.push({ label: 'Creator profiles', value: `${selectedCreatorProfileIds.value.length} selected` });
    }
    return rows;
  });

  const handleCoverImageSelect = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image file' });
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      coverImagePreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Upload to server
    uploadingCoverImage.value = true;
    try {
      const response = await uploadCampaignCoverImage(Number(props.organizationId), file);
      if (response.success && response.url) {
        campaignForm.cover_image_url = response.url;
        toast({ title: 'Success', description: 'Cover image uploaded' });
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to upload image' });
        coverImagePreview.value = '';
      }
    } catch (error) {
      console.error('Failed to upload cover image:', error);
      toast({ title: 'Error', description: 'Failed to upload image' });
      coverImagePreview.value = '';
    } finally {
      uploadingCoverImage.value = false;
      // Reset input so same file can be selected again
      input.value = '';
    }
  };

  const clearCoverImage = () => {
    campaignForm.cover_image_url = '';
    coverImagePreview.value = '';
  };

  const togglePlatform = (platform: string) => {
    const idx = campaignForm.allowed_platforms.indexOf(platform);
    if (idx >= 0) {
      campaignForm.allowed_platforms.splice(idx, 1);
    } else {
      campaignForm.allowed_platforms.push(platform);
    }
  };

  const togglePaymentMethod = (method: string) => {
    const idx = campaignForm.payment_methods.indexOf(method);
    if (idx >= 0) {
      campaignForm.payment_methods.splice(idx, 1);
    } else {
      campaignForm.payment_methods.push(method);
    }
  };

  const loadCreatorProfilesAndAssets = async () => {
    if (!props.organizationId) return;

    loadingProfiles.value = true;
    try {
      const [profilesRes, assetsRes] = await Promise.all([
        listOrganizationCreatorProfiles(props.organizationId),
        listOrganizationAssets(props.organizationId),
      ]);

      if (profilesRes.success) {
        availableCreatorProfiles.value = profilesRes.profiles;
      }
      if (assetsRes.success) {
        availableAssets.value = assetsRes.assets;
        console.log(
          '[Campaign Branding] Loaded assets:',
          assetsRes.assets.map((a) => ({ id: a.id, type: a.asset_type, name: a.name }))
        );
      }
    } catch (error) {
      console.error('Failed to load creator profiles/assets:', error);
    } finally {
      loadingProfiles.value = false;
    }
  };

  const selectGlobalBranding = () => {
    isGlobalBrandingSelected.value = true;
    selectedCreatorProfileIds.value = [];
    // Clear creator_profile_id for global branding (null means any streamer)
    campaignForm.creator_profile_id = null;
    // Auto-select the only global profile if there's exactly one
    const globalProfiles = availableCreatorProfiles.value.filter((p) => p.scope === 'global');
    if (globalProfiles.length === 1) {
      campaignForm.branding_profile_id = globalProfiles[0].id;
    } else {
      campaignForm.branding_profile_id = globalProfiles[0]?.id || null;
    }
  };

  const handleGlobalBrandingToggle = () => {
    if (isGlobalBrandingSelected.value) {
      // Global branding enabled - clear specific profile selections
      selectedCreatorProfileIds.value = [];
      // Auto-select the only global profile if there's exactly one
      const globalProfiles = availableCreatorProfiles.value.filter((p) => p.scope === 'global');
      if (globalProfiles.length === 1) {
        campaignForm.branding_profile_id = globalProfiles[0].id;
      } else if (globalProfiles.length > 1) {
        // If multiple global profiles, keep current selection or default to first global
        const currentIsGlobal = globalProfiles.some((p) => p.id === campaignForm.branding_profile_id);
        if (!currentIsGlobal) {
          campaignForm.branding_profile_id = globalProfiles[0]?.id || null;
        }
      } else {
        campaignForm.branding_profile_id = null;
      }
    } else {
      // Global branding disabled - clear branding profile
      campaignForm.branding_profile_id = null;
    }
  };

  const toggleCreatorProfile = (profileId: number | null) => {
    // Don't allow toggling if global branding is selected
    if (isGlobalBrandingSelected.value) return;

    const idx = selectedCreatorProfileIds.value.indexOf(profileId);
    if (idx >= 0) {
      selectedCreatorProfileIds.value.splice(idx, 1);
    } else {
      selectedCreatorProfileIds.value.push(profileId);
    }
  };

  const openCreateDialog = async () => {
    editingCampaign.value = null;
    coverImagePreview.value = '';
    selectedCreatorProfileIds.value = [];
    isGlobalBrandingSelected.value = false;
    campaignResources.value = [];
    currentStep.value = 1;
    error.value = null;
    Object.assign(campaignForm, {
      title: '',
      description: '',
      cpm: 0,
      cpm_views: 1000,
      budget: 0,
      min_views_for_payment: 1000,
      join_type: 'open' as 'open' | 'application_required',
      allowed_platforms: [] as string[],
      payment_methods: [] as string[],
      cover_image_url: '',
      starts_at: '',
      ends_at: '',
      payment_model: 'cpm' as 'cpm' | 'per_clip',
      per_clip_amount: 0,
      clips_per_profile: 5,
      creator_profile_id: null,
      branding_profile_id: null,
      content_vertical: null,
      campaign_goal: '',
      content_style_tags: [],
    });
    showCampaignDialog.value = true;
    await loadCreatorProfilesAndAssets();
  };

  const editCampaign = async (campaign: Campaign) => {
    editingCampaign.value = campaign;
    coverImagePreview.value = '';
    selectedCreatorProfileIds.value = campaign.creator_profiles?.map((p) => p.id) || [];
    // Set global branding flag based on whether campaign has creator_profile_id null AND branding_profile_id set
    isGlobalBrandingSelected.value = campaign.creator_profile_id === null && campaign.branding_profile_id !== null;
    error.value = null;
    Object.assign(campaignForm, {
      title: campaign.title,
      description: campaign.description || '',
      cpm: parseFloat(campaign.cpm),
      cpm_views: campaign.cpm_views || 1000,
      budget: parseFloat(campaign.budget),
      min_views_for_payment: campaign.min_views_for_payment,
      join_type: campaign.join_type,
      allowed_platforms: [...campaign.allowed_platforms],
      payment_methods: [...campaign.payment_methods],
      cover_image_url: campaign.cover_image_url || '',
      starts_at: campaign.starts_at ? campaign.starts_at.slice(0, 16) : '',
      ends_at: campaign.ends_at ? campaign.ends_at.slice(0, 16) : '',
      payment_model: campaign.payment_model || 'cpm',
      per_clip_amount: campaign.per_clip_amount ? parseFloat(campaign.per_clip_amount) : 0,
      clips_per_profile: campaign.clips_per_profile || 5,
      creator_profile_id: campaign.creator_profile_id || null,
      branding_profile_id: campaign.branding_profile_id || null,
      content_vertical: campaign.content_vertical || null,
      campaign_goal: campaign.campaign_goal || '',
      content_style_tags: campaign.content_style_tags || [],
    });
    campaignResources.value = (campaign.resources || []).map(
      ({ id, campaign_id, inserted_at, updated_at, download_target, ...rest }) => rest
    );
    showCampaignDialog.value = true;
    await loadCreatorProfilesAndAssets();
  };

  const convertToISO8601 = (datetimeLocal: string): string | undefined => {
    if (!datetimeLocal) return undefined;
    // datetime-local format: "2024-03-06T21:15"
    // Convert to ISO 8601 with timezone: "2024-03-06T21:15:00Z"
    return `${datetimeLocal}:00Z`;
  };

  const saveCampaign = async () => {
    saving.value = true;
    error.value = null;
    try {
      const data = {
        title: campaignForm.title,
        description: campaignForm.description || undefined,
        cpm: campaignForm.cpm,
        cpm_views: campaignForm.cpm_views,
        budget: campaignForm.budget,
        min_views_for_payment: campaignForm.min_views_for_payment,
        join_type: campaignForm.join_type,
        allowed_platforms: campaignForm.allowed_platforms,
        payment_methods: campaignForm.payment_methods,
        cover_image_url: campaignForm.cover_image_url || undefined,
        starts_at: convertToISO8601(campaignForm.starts_at),
        ends_at: convertToISO8601(campaignForm.ends_at),
        payment_model: campaignForm.payment_model,
        per_clip_amount: campaignForm.payment_model === 'per_clip' ? campaignForm.per_clip_amount : undefined,
        clips_per_profile: campaignForm.payment_model === 'per_clip' ? campaignForm.clips_per_profile : undefined,
        // For global branding, explicitly send null for creator_profile_id
        creator_profile_id: isGlobalBrandingSelected.value ? null : campaignForm.creator_profile_id || undefined,
        branding_profile_id: campaignForm.branding_profile_id || undefined,
        content_vertical: campaignForm.content_vertical || undefined,
        campaign_goal: campaignForm.campaign_goal || undefined,
        content_style_tags: campaignForm.content_style_tags,
        resources: campaignResources.value,
      };

      console.log('[Campaign Save] About to save with:', {
        isGlobalBranding: isGlobalBrandingSelected.value,
        creator_profile_id: data.creator_profile_id,
        branding_profile_id: data.branding_profile_id,
        selectedCreatorProfileIds: selectedCreatorProfileIds.value,
      });

      let response;
      if (editingCampaign.value) {
        response = await updateCampaign(Number(props.organizationId), editingCampaign.value.id, data);
      } else {
        response = await createCampaign(Number(props.organizationId), data);
      }

      console.log('[Campaign Save] API response:', {
        success: response.success,
        campaign: response.campaign
          ? {
              id: response.campaign.id,
              creator_profile_id: response.campaign.creator_profile_id,
              branding_profile_id: response.campaign.branding_profile_id,
              creator_profiles: response.campaign.creator_profiles,
            }
          : null,
      });

      if (response.success && response.campaign) {
        // Save creator profiles assignment (only if NOT using global branding)
        if (!isGlobalBrandingSelected.value) {
          const profileIds = selectedCreatorProfileIds.value.filter((id): id is number => id !== null);
          if (profileIds.length > 0) {
            await setCampaignCreatorProfiles(Number(props.organizationId), response.campaign.id, profileIds);
          }
        } else {
          // For global branding, clear any existing creator profile assignments
          console.log('[Campaign Save] Clearing creator profiles for global branding campaign');
          await setCampaignCreatorProfiles(Number(props.organizationId), response.campaign.id, []);
          console.log('[Campaign Save] Creator profiles cleared');
        }

        toast({ title: 'Success', description: `Campaign ${editingCampaign.value ? 'updated' : 'created'}` });
        showCampaignDialog.value = false;
        emit('saved');
      } else {
        const errorMsg = response.error || 'Failed to save campaign';
        error.value = errorMsg;
        toast({ title: 'Error', description: errorMsg });
      }
    } catch (err) {
      console.error('Failed to save campaign:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to save campaign';
      error.value = errorMsg;
      toast({ title: 'Error', description: errorMsg });
    } finally {
      saving.value = false;
    }
  };

  function setOpen(value: boolean) {
    // Keep the dialog open while a save is in flight
    if (!value && saving.value) return;
    showCampaignDialog.value = value;
  }

  defineExpose({ openCreateDialog, editCampaign });
</script>

<template>
  <Modal
    :open="showCampaignDialog"
    :title="editingCampaign ? 'Edit campaign' : stepInfo.title"
    :description="editingCampaign ? 'Update your campaign details' : stepInfo.description"
    :icon="editingCampaign ? Megaphone : stepInfo.icon"
    :dismissible="!saving"
    size="lg"
    @update:open="setOpen"
  >
    <template v-if="!editingCampaign" #header-actions>
      <span class="tabular mt-1 shrink-0 text-xs text-fg-subtle">Step {{ currentStep }} of {{ totalSteps }}</span>
    </template>

    <!-- ── Create wizard ─────────────────────────────────────────── -->
    <template v-if="!editingCampaign">
      <div class="mb-5 flex gap-1" aria-hidden="true">
        <span
          v-for="step in totalSteps"
          :key="step"
          class="h-1 flex-1 rounded-full transition-colors"
          :class="step <= currentStep ? 'bg-brand' : 'bg-surface-active'"
        />
      </div>

      <!-- Steps: keyed so each step eases in -->
      <div :key="currentStep" class="animate-enter">
        <!-- Step 1: Basic info -->
        <div v-if="currentStep === 1" class="flex flex-col gap-4">
          <Field label="Campaign title">
            <Input v-model="campaignForm.title" type="text" placeholder="Enter campaign title" @keydown.enter="nextStep" />
          </Field>
          <Field label="Description (optional)" :hint="`${(campaignForm.description || '').length}/500 characters`">
            <Textarea v-model="campaignForm.description" rows="3" placeholder="Describe your campaign..." />
          </Field>
          <Field
            label="Campaign type"
            hint="Helps clippers understand the campaign. Works for streamers, musicians, podcasts, brands, and more."
          >
            <CustomDropdown
              v-model="campaignForm.content_vertical"
              :options="contentVerticalOptions"
              placeholder="Select campaign type"
            />
          </Field>
          <Field label="Campaign goal (optional)">
            <Input
              v-model="campaignForm.campaign_goal"
              type="text"
              placeholder="Promote new song, grow podcast audience, launch product..."
            />
          </Field>
        </div>

        <!-- Step 2: Pricing & budget -->
        <CampaignPricingFields v-else-if="currentStep === 2" :form="campaignForm" show-max-views />

        <!-- Step 3: Schedule & access -->
        <CampaignScheduleFields v-else-if="currentStep === 3" :form="campaignForm" />

        <!-- Step 4: Platforms & payments -->
        <div v-else-if="currentStep === 4" class="flex flex-col gap-5">
          <Field label="Allowed platforms" :hint="`${campaignForm.allowed_platforms.length} platform(s) selected`">
            <ToggleChips
              :options="availablePlatforms"
              :model-value="campaignForm.allowed_platforms"
              @toggle="togglePlatform"
            />
          </Field>
          <Field label="Payment methods" :hint="`${campaignForm.payment_methods.length} method(s) selected`">
            <ToggleChips
              :options="availablePaymentMethods"
              :model-value="campaignForm.payment_methods"
              @toggle="togglePaymentMethod"
            />
          </Field>
        </div>

        <!-- Step 5: Campaign branding -->
        <div v-else-if="currentStep === 5" class="flex flex-col gap-3">
          <div v-if="loadingProfiles && !availableCreatorProfiles.length" class="flex flex-col gap-2">
            <div v-for="i in 3" :key="i" class="skeleton h-[52px] w-full rounded-lg" />
          </div>
          <EmptyState
            v-else-if="availableCreatorProfiles.length === 0"
            size="sm"
            :icon="Users"
            title="No creator profiles available"
            description="Create profiles in the Creator Profiles tab first."
          />
          <div v-else class="flex flex-col gap-2">
            <!-- Global branding option (only if org has global branding set up) -->
            <template v-if="hasGlobalBranding">
              <CreatorProfileOption
                name="Global branding"
                description="Allow clippers to use any streamer with organization branding"
                :icon="Globe"
                :selected="isGlobalBrandingSelected"
                @click="selectGlobalBranding"
              />
              <div class="my-1 flex items-center gap-3 text-2xs text-fg-subtle">
                <span class="h-px flex-1 bg-line-subtle" />
                Or select specific creator profiles
                <span class="h-px flex-1 bg-line-subtle" />
              </div>
            </template>
            <CreatorProfileOption
              v-for="profile in availableCreatorProfiles"
              :key="profile.id"
              :name="profile.name"
              :description="profile.description"
              :image-url="profile.profile_image_url"
              :selected="selectedCreatorProfileIds.includes(profile.id)"
              :disabled="isGlobalBrandingSelected"
              @click="toggleCreatorProfile(profile.id)"
            />
          </div>
          <p class="text-xs text-fg-subtle">
            <template v-if="isGlobalBrandingSelected">
              Global branding selected. Clippers can use any streamer with your organization's branding.
            </template>
            <template v-else>
              {{ selectedCreatorProfileIds.length }} creator profile(s) selected. Each profile includes their
              watermarks, intro/outro videos.
            </template>
          </p>
        </div>

        <!-- Step 6: Campaign assets -->
        <CampaignCoverField
          v-else-if="currentStep === 6"
          :form="campaignForm"
          :preview="coverImagePreview"
          :uploading="uploadingCoverImage"
          @select="handleCoverImageSelect"
          @clear="clearCoverImage"
          @url-input="coverImagePreview = ''"
        />

        <!-- Step 7: Source content -->
        <CampaignResourcesEditor v-else-if="currentStep === 7" v-model="campaignResources" />

        <!-- Step 8: Review -->
        <div v-else-if="currentStep === 8" class="flex flex-col gap-2">
          <div class="flex items-center gap-3 border-b border-line-subtle pb-3">
            <Avatar
              :src="coverImagePreview || campaignForm.cover_image_url || null"
              :icon="Megaphone"
              size="lg"
              shape="square"
            />
            <div class="min-w-0 flex-1">
              <h3 class="truncate text-sm font-semibold text-fg">{{ campaignForm.title || 'Untitled campaign' }}</h3>
              <p v-if="campaignForm.description" class="mt-0.5 line-clamp-2 text-xs text-fg-muted">
                {{ campaignForm.description }}
              </p>
            </div>
          </div>
          <InfoList :rows="summaryRows" />
        </div>
      </div>

      <Alert v-if="error" variant="destructive" class="mt-4">
        <AlertTriangle />
        <AlertDescription class="text-fg">{{ error }}</AlertDescription>
      </Alert>
    </template>

    <!-- ── Edit form ─────────────────────────────────────────────── -->
    <div v-else class="flex flex-col gap-6">
      <section class="flex flex-col gap-3">
        <SectionHeader title="Basic information" variant="eyebrow" />
        <Field label="Campaign title">
          <Input v-model="campaignForm.title" type="text" placeholder="Enter campaign title" />
        </Field>
        <Field label="Description" :hint="`${(campaignForm.description || '').length}/500 characters`">
          <Textarea v-model="campaignForm.description" rows="3" placeholder="Describe your campaign..." />
        </Field>
        <CampaignCoverField
          :form="campaignForm"
          :preview="coverImagePreview"
          :uploading="uploadingCoverImage"
          @select="handleCoverImageSelect"
          @clear="clearCoverImage"
          @url-input="coverImagePreview = ''"
        />
      </section>

      <section class="flex flex-col gap-3">
        <SectionHeader title="Pricing & budget" variant="eyebrow" />
        <CampaignPricingFields :form="campaignForm" />
      </section>

      <section class="flex flex-col gap-3">
        <SectionHeader title="Platforms & payment methods" variant="eyebrow" />
        <Field label="Allowed platforms">
          <ToggleChips
            :options="availablePlatforms"
            :model-value="campaignForm.allowed_platforms"
            @toggle="togglePlatform"
          />
        </Field>
        <Field label="Payment methods">
          <ToggleChips
            :options="availablePaymentMethods"
            :model-value="campaignForm.payment_methods"
            @toggle="togglePaymentMethod"
          />
        </Field>
      </section>

      <section class="flex flex-col gap-3">
        <SectionHeader title="Campaign duration" variant="eyebrow" />
        <CampaignScheduleFields :form="campaignForm" />
      </section>

      <section class="flex flex-col gap-3">
        <SectionHeader title="Campaign branding" variant="eyebrow" />
        <!-- Global branding toggle (only if org has global branding) -->
        <Field
          v-if="hasGlobalBranding"
          label="Use global branding"
          hint="Allow clippers to use any streamer with your organization's branding (intro, outro, watermarks)"
          inline
        >
          <Switch v-model="isGlobalBrandingSelected" @update:model-value="handleGlobalBrandingToggle" />
        </Field>

        <Field
          :label="isGlobalBrandingSelected ? 'Creator profile (for global branding assets)' : 'Creator profiles'"
          :hint="
            isGlobalBrandingSelected
              ? 'Select which creator profile\'s assets (intro, outro, watermarks) to use for global branding'
              : 'Select one or more creator profiles that clippers can use for this campaign'
          "
        >
          <CustomDropdown
            v-if="isGlobalBrandingSelected"
            v-model="campaignForm.branding_profile_id"
            :options="globalBrandingProfileOptions"
            placeholder="Select branding profile"
          />
          <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
            <CreatorProfileOption
              v-for="profile in availableCreatorProfiles"
              :key="profile.id"
              :name="profile.name"
              :image-url="profile.profile_image_url"
              :selected="selectedCreatorProfileIds.includes(profile.id)"
              @click="toggleCreatorProfile(profile.id)"
            />
          </div>
        </Field>
      </section>
    </div>

    <template #footer>
      <template v-if="!editingCampaign">
        <Button
          v-if="currentStep >= 2 && currentStep <= 7"
          variant="ghost"
          class="mr-auto"
          :disabled="saving"
          @click="nextStep"
        >
          Skip for now
        </Button>
        <Button v-if="currentStep > 1" variant="ghost" :disabled="saving" @click="prevStep">Back</Button>
        <Button v-if="currentStep < totalSteps" variant="primary" :disabled="!canProceed || saving" @click="nextStep">
          Continue
        </Button>
        <Button
          v-if="currentStep === totalSteps"
          variant="primary"
          :disabled="!canProceed"
          :loading="saving"
          @click="saveCampaign"
        >
          {{ saving ? 'Creating…' : 'Create campaign' }}
        </Button>
      </template>
      <template v-else>
        <Button variant="ghost" :disabled="saving" @click="setOpen(false)">Cancel</Button>
        <Button variant="primary" :disabled="!canProceedEdit" :loading="saving" @click="saveCampaign">
          {{ saving ? 'Saving…' : 'Save changes' }}
        </Button>
      </template>
    </template>
  </Modal>
</template>
