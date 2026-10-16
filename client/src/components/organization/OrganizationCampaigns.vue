<template>
  <div class="flex flex-1 flex-col gap-6 px-5 py-4">
    <!-- Loading (first load only; reloads after an action keep the grid) -->
    <CampaignGridSkeleton v-if="loading && !campaigns.length" />

    <!-- Empty -->
    <EmptyState
      v-else-if="campaigns.length === 0"
      :icon="Megaphone"
      title="No campaigns yet"
      description="Create your first campaign to start working with clippers"
    />

    <div v-else class="flex animate-fade-in flex-col gap-6">
      <!-- Active & draft -->
      <section v-if="activeCampaigns.length > 0" class="flex flex-col gap-3">
        <SectionHeader title="Active & draft" :count="activeCampaigns.length" />
        <div :class="gridClass">
          <OrgCampaignCard
            v-for="campaign in activeCampaigns"
            :key="campaign.id"
            :campaign="campaign"
            :is-admin="isAdmin"
            @view="viewCampaign(campaign)"
            @edit="editCampaign(campaign)"
            @activate="activateCampaignAction(campaign)"
            @pause="pauseCampaignAction(campaign)"
            @complete="completeCampaignAction(campaign)"
            @delete="confirmDeleteCampaign(campaign)"
          />
        </div>
      </section>

      <!-- Completed -->
      <section v-if="completedCampaigns.length > 0" class="flex flex-col gap-3">
        <SectionHeader title="Completed" :count="completedCampaigns.length" />
        <div :class="gridClass">
          <OrgCampaignCard
            v-for="campaign in completedCampaigns"
            :key="campaign.id"
            :campaign="campaign"
            :is-admin="isAdmin"
            @view="viewCampaign(campaign)"
            @edit="editCampaign(campaign)"
            @activate="activateCampaignAction(campaign)"
            @pause="pauseCampaignAction(campaign)"
            @complete="completeCampaignAction(campaign)"
            @delete="confirmDeleteCampaign(campaign)"
          />
        </div>
      </section>
    </div>

    <!-- Create / edit -->
    <CampaignFormDialog ref="formDialog" :organization-id="organizationId" @saved="loadCampaigns" />

    <!-- Delete confirmation -->
    <Modal
      :open="showDeleteDialog"
      title="Delete campaign"
      description="This action cannot be undone"
      :icon="Trash2"
      tone="danger"
      size="sm"
      :dismissible="!deleting"
      @update:open="(value: boolean) => (value || !deleting) && (showDeleteDialog = value)"
    >
      <p class="text-sm text-fg-muted">
        <span class="font-medium text-fg">{{ campaignToDelete?.title }}</span> will be permanently deleted.
      </p>
      <template #footer>
        <Button variant="ghost" :disabled="deleting" @click="showDeleteDialog = false">Cancel</Button>
        <Button variant="destructive" :loading="deleting" @click="deleteCampaignAction">
          {{ deleting ? 'Deleting…' : 'Delete campaign' }}
        </Button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { Megaphone, Trash2 } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import CampaignGridSkeleton from '@/components/campaigns/CampaignGridSkeleton.vue';
  import OrgCampaignCard from '@/components/organization/campaigns/OrgCampaignCard.vue';
  import CampaignFormDialog from '@/components/organization/campaigns/CampaignFormDialog.vue';
  import {
    listOrganizationCampaigns,
    deleteCampaign,
    pauseCampaign,
    activateCampaign,
    completeCampaign,
    type Campaign,
  } from '@/services/campaignApi';
  import { useToast } from '@/composables/useToast';

  const props = defineProps<{
    organizationId: string;
    isAdmin: boolean;
  }>();

  const router = useRouter();
  const { toast } = useToast();

  // Campaign cards carry more text than media tiles, so they get a wider minimum
  const gridClass = 'card-grid [--card-grid-min:17.5rem]';

  const loading = ref(true);
  const deleting = ref(false);
  const campaigns = ref<Campaign[]>([]);

  const formDialog = ref<InstanceType<typeof CampaignFormDialog> | null>(null);

  const showDeleteDialog = ref(false);

  const campaignToDelete = ref<Campaign | null>(null);

  // Filtered campaigns based on status
  const activeCampaigns = computed(() => {
    return campaigns.value.filter((c) => c.status !== 'completed');
  });

  const completedCampaigns = computed(() => {
    return campaigns.value.filter((c) => c.status === 'completed');
  });

  const loadCampaigns = async () => {
    if (!props.organizationId) return;

    loading.value = true;
    try {
      const response = await listOrganizationCampaigns(Number(props.organizationId));
      if (response.success) {
        campaigns.value = response.campaigns;
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      toast({ title: 'Error', description: 'Failed to load campaigns' });
    } finally {
      loading.value = false;
    }
  };

  const openCreateDialog = async () => {
    await formDialog.value?.openCreateDialog();
  };

  const editCampaign = async (campaign: Campaign) => {
    await formDialog.value?.editCampaign(campaign);
  };

  const viewCampaign = async (campaign: Campaign) => {
    router.push(`/organization/${props.organizationId}/campaigns/${campaign.id}`);
  };

  const confirmDeleteCampaign = (campaign: Campaign) => {
    campaignToDelete.value = campaign;
    showDeleteDialog.value = true;
  };

  const deleteCampaignAction = async () => {
    if (!campaignToDelete.value) return;

    deleting.value = true;
    try {
      const response = await deleteCampaign(Number(props.organizationId), campaignToDelete.value.id);
      if (response.success) {
        toast({ title: 'Deleted', description: 'Campaign deleted successfully' });
        showDeleteDialog.value = false;
        await loadCampaigns();
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to delete campaign' });
      }
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      toast({ title: 'Error', description: 'Failed to delete campaign' });
    } finally {
      deleting.value = false;
    }
  };

  const pauseCampaignAction = async (campaign: Campaign) => {
    try {
      const response = await pauseCampaign(Number(props.organizationId), campaign.id);
      if (response.success) {
        toast({ title: 'Success', description: 'Campaign paused' });
        await loadCampaigns();
      }
    } catch (error) {
      console.error('Failed to pause campaign:', error);
      toast({ title: 'Error', description: 'Failed to pause campaign' });
    }
  };

  const activateCampaignAction = async (campaign: Campaign) => {
    try {
      const response = await activateCampaign(Number(props.organizationId), campaign.id);
      if (response.success) {
        toast({ title: 'Success', description: 'Campaign activated' });
        await loadCampaigns();
      }
    } catch (error) {
      console.error('Failed to activate campaign:', error);
      toast({ title: 'Error', description: 'Failed to activate campaign' });
    }
  };

  const completeCampaignAction = async (campaign: Campaign) => {
    try {
      const response = await completeCampaign(Number(props.organizationId), campaign.id);
      if (response.success) {
        toast({ title: 'Success', description: 'Campaign completed' });
        await loadCampaigns();
      }
    } catch (error) {
      console.error('Failed to complete campaign:', error);
      toast({ title: 'Error', description: 'Failed to complete campaign' });
    }
  };

  watch(
    () => props.organizationId,
    () => {
      if (props.organizationId) {
        loadCampaigns();
      }
    },
    { immediate: true }
  );

  onMounted(() => {
    if (props.organizationId) {
      loadCampaigns();
    }
  });

  defineExpose({ openCreateDialog });
</script>
