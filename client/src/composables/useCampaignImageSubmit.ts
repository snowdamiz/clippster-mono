/**
 * Composable for submitting images from the design studio to campaigns.
 * Handles uploading the image to the server and creating a submission.
 */

import { ref } from 'vue';
import api from '@/services/api';
import { submitClip, listMyCampaigns, type Campaign, type SubmissionResponse } from '@/services/campaignApi';

export function useCampaignImageSubmit() {
  const isSubmitting = ref(false);
  const availableCampaigns = ref<Campaign[]>([]);
  const isLoadingCampaigns = ref(false);

  /**
   * Load campaigns the user has joined (for submission target selection).
   */
  async function loadMyCampaigns(): Promise<void> {
    isLoadingCampaigns.value = true;
    try {
      const response = await listMyCampaigns('active');
      if (response.success) {
        availableCampaigns.value = response.campaigns;
      }
    } catch (error) {
      console.error('[useCampaignImageSubmit] Failed to load campaigns:', error);
    } finally {
      isLoadingCampaigns.value = false;
    }
  }

  /**
   * Upload an image blob to the server and submit it to a campaign.
   */
  async function submitImageToCampaign(
    campaignId: number,
    blob: Blob,
    filename: string,
    platform?: string,
  ): Promise<SubmissionResponse | null> {
    isSubmitting.value = true;
    try {
      // Upload image to server
      const formData = new FormData();
      formData.append('file', blob, filename);

      const uploadResponse = await api.post('/uploads/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!uploadResponse.data?.url) {
        console.error('[useCampaignImageSubmit] Upload failed, no URL returned');
        return null;
      }

      const imageUrl = uploadResponse.data.url;

      // Submit to campaign
      const result = await submitClip(campaignId, imageUrl, platform);
      return result;
    } catch (error) {
      console.error('[useCampaignImageSubmit] Failed to submit image:', error);
      return null;
    } finally {
      isSubmitting.value = false;
    }
  }

  return {
    isSubmitting,
    availableCampaigns,
    isLoadingCampaigns,
    loadMyCampaigns,
    submitImageToCampaign,
  };
}
