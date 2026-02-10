import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/services/api';

export interface UserRestrictions {
  isRestricted: boolean;
  restrictingOrgId: number | null;
  
  // Effective settings
  allowAi: boolean;
  allowAssetUploads: boolean;
  allowCustomPrompts: boolean;
  allowClipperProfile: boolean;
  allowPersonalSocial: boolean;
  allowClipDeletion: boolean;
  allowHiringBrowse: boolean;
  forceOrgWatermark: boolean;
  requireClipApproval: boolean;
  
  // Assigned resources
  allowedCreatorIds: number[] | 'all';
}

export const usePermissionsStore = defineStore('permissions', () => {
  // State
  const restrictions = ref<UserRestrictions>({
    isRestricted: false,
    restrictingOrgId: null,
    allowAi: true,
    allowAssetUploads: true,
    allowCustomPrompts: true,
    allowClipperProfile: true,
    allowPersonalSocial: true,
    allowClipDeletion: true,
    allowHiringBrowse: true,
    forceOrgWatermark: false,
    requireClipApproval: false,
    allowedCreatorIds: 'all',
  });

  const loading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const isRestricted = computed(() => restrictions.value.isRestricted);
  const allowAi = computed(() => restrictions.value.allowAi);
  const allowAssetUploads = computed(() => restrictions.value.allowAssetUploads);
  const allowCustomPrompts = computed(() => restrictions.value.allowCustomPrompts);
  const allowClipperProfile = computed(() => restrictions.value.allowClipperProfile);
  const allowPersonalSocial = computed(() => restrictions.value.allowPersonalSocial);
  const allowClipDeletion = computed(() => restrictions.value.allowClipDeletion);
  const allowHiringBrowse = computed(() => restrictions.value.allowHiringBrowse);
  const forceOrgWatermark = computed(() => restrictions.value.forceOrgWatermark);
  const requireClipApproval = computed(() => restrictions.value.requireClipApproval);

  // Actions
  async function fetchRestrictions() {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.get('/user/restrictions');
      
      if (response.data.success) {
        const data = response.data;
        
        restrictions.value = {
          isRestricted: data.restricted || false,
          restrictingOrgId: data.restricting_org_id || null,
          allowAi: data.restrictions?.allow_ai ?? true,
          allowAssetUploads: data.restrictions?.allow_asset_uploads ?? true,
          allowCustomPrompts: data.restrictions?.allow_custom_prompts ?? true,
          allowClipperProfile: data.restrictions?.allow_clipper_profile ?? true,
          allowPersonalSocial: data.restrictions?.allow_personal_social ?? true,
          allowClipDeletion: data.restrictions?.allow_clip_deletion ?? true,
          allowHiringBrowse: data.restrictions?.allow_hiring_browse ?? true,
          forceOrgWatermark: data.restrictions?.force_org_watermark ?? false,
          requireClipApproval: data.restrictions?.require_clip_approval ?? false,
          allowedCreatorIds: data.allowed_creator_ids || 'all',
        };
      }
    } catch (err: any) {
      console.error('Failed to fetch restrictions:', err);
      error.value = err.message || 'Failed to fetch restrictions';
      
      // Set defaults on error
      restrictions.value = {
        isRestricted: false,
        restrictingOrgId: null,
        allowAi: true,
        allowAssetUploads: true,
        allowCustomPrompts: true,
        allowClipperProfile: true,
        allowPersonalSocial: true,
        allowClipDeletion: true,
        allowHiringBrowse: true,
        forceOrgWatermark: false,
        requireClipApproval: false,
        allowedCreatorIds: 'all',
      };
    } finally {
      loading.value = false;
    }
  }

  function canAccessCreator(creatorId: number): boolean {
    if (!restrictions.value.isRestricted) {
      return true;
    }

    if (restrictions.value.allowedCreatorIds === 'all') {
      return true;
    }

    return restrictions.value.allowedCreatorIds.includes(creatorId);
  }

  function reset() {
    restrictions.value = {
      isRestricted: false,
      restrictingOrgId: null,
      allowAi: true,
      allowAssetUploads: true,
      allowCustomPrompts: true,
      allowClipperProfile: true,
      allowPersonalSocial: true,
      allowClipDeletion: true,
      allowHiringBrowse: true,
      forceOrgWatermark: false,
      requireClipApproval: false,
      allowedCreatorIds: 'all',
    };
    error.value = null;
  }

  return {
    // State
    restrictions,
    loading,
    error,
    
    // Computed
    isRestricted,
    allowAi,
    allowAssetUploads,
    allowCustomPrompts,
    allowClipperProfile,
    allowPersonalSocial,
    allowClipDeletion,
    allowHiringBrowse,
    forceOrgWatermark,
    requireClipApproval,
    
    // Actions
    fetchRestrictions,
    canAccessCreator,
    reset,
  };
});
