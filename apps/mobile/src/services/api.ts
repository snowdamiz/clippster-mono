import {
  createApiClient,
  createAuthApi,
  createClipsApi,
  createCreditsApi,
  createMediaApi,
  createSchedulingApi,
  createUserSocialApi,
  createUserPostsApi,
  createAnalyticsApi,
  createClipperProfilesApi,
  createCampaignApi,
  createSharedClipsApi,
  createOrganizationAssetsApi,
  createOrganizationProfilesApi,
  createOrganizationsApi,
  createCloudProjectsApi,
} from '@clippster/api-client';
import { getApiBaseUrl } from '@/lib/config';
import { clearAuthSession, getStoredToken } from './authStorage';

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

const apiClient = createApiClient({
  baseUrl: getApiBaseUrl(),
  getToken: getStoredToken,
  onUnauthorized: () => {
    unauthorizedHandler?.();
  },
  platform: 'mobile',
});

export const authApi = createAuthApi(apiClient);
export const mediaApi = createMediaApi(apiClient);
export const clipsApi = createClipsApi(apiClient);
export const creditsApi = createCreditsApi(apiClient);
export const schedulingApi = createSchedulingApi(apiClient);
export const userSocialApi = createUserSocialApi(apiClient);
export const userPostsApi = createUserPostsApi(apiClient);
export const analyticsApi = createAnalyticsApi(apiClient);
export const clipperProfilesApi = createClipperProfilesApi(apiClient);
export const campaignApi = createCampaignApi(apiClient);
export const sharedClipsApi = createSharedClipsApi(apiClient);
export const organizationAssetsApi = createOrganizationAssetsApi(apiClient);
export const organizationProfilesApi = createOrganizationProfilesApi(apiClient);
export const organizationsApi = createOrganizationsApi(apiClient);
export const cloudProjectsApi = createCloudProjectsApi(apiClient);
export { apiClient };
