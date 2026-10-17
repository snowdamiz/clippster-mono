<template>
  <div class="h-full w-full">
    <PageLayout
      title="Campaigns"
      description="Browse clipping campaigns and earn money by posting clips"
      :show-header="true"
      :icon="Megaphone"
    >
      <template v-if="!needsAuth" #toolbar>
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <p v-if="!loading || campaigns.length" class="truncate text-xs text-fg-muted">
            <span class="tabular font-medium text-fg">{{ filteredCampaigns.length }}</span>
            active {{ filteredCampaigns.length === 1 ? 'campaign' : 'campaigns' }}
          </p>
          <SearchField v-model="searchQuery" placeholder="Search campaigns…" class="ml-auto w-60 min-w-0 shrink" />
        </div>
      </template>

      <div class="flex flex-1 flex-col px-5 py-4">
        <!-- Loading (first load only; refetches keep the grid) -->
        <CampaignGridSkeleton v-if="loading && !campaigns.length" />

        <!-- Auth required -->
        <EmptyState
          v-else-if="needsAuth"
          :icon="Megaphone"
          title="Sign in to browse campaigns"
          description="Create an account or sign in to discover clipping campaigns and start earning."
        >
          <Button variant="primary" size="sm" @click="showAuthModal = true">Sign in</Button>
        </EmptyState>

        <!-- Empty -->
        <EmptyState
          v-else-if="filteredCampaigns.length === 0"
          :icon="Megaphone"
          title="No campaigns found"
          :description="searchQuery ? 'Try adjusting your search.' : 'Check back later for new clipping campaigns.'"
        >
          <Button v-if="searchQuery" variant="secondary" size="sm" @click="searchQuery = ''">Clear search</Button>
        </EmptyState>

        <!-- Grid -->
        <div v-else class="card-grid animate-fade-in [--card-grid-min:17.5rem]">
          <CampaignCard
            v-for="campaign in filteredCampaigns"
            :key="campaign.id"
            :campaign="campaign"
            :org-to="
              campaign.organization?.slug
                ? { path: `/orgs/${campaign.organization.slug}`, query: { from: $route.fullPath } }
                : null
            "
            @open="viewCampaign(campaign)"
          />
        </div>
      </div>
    </PageLayout>

    <!-- Campaign Detail Dialog -->
    <CampaignDetailDialog
      v-model:open="showDetailDialog"
      :campaign="selectedCampaign"
      @joined="onCampaignJoined"
      @require-auth="showAuthModal = true"
    />

    <!-- Authentication Modal -->
    <AuthModal v-model="showAuthModal" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import { Megaphone } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { SearchField } from '@/components/ui/search-field';
  import CampaignCard from '@/components/campaigns/CampaignCard.vue';
  import CampaignGridSkeleton from '@/components/campaigns/CampaignGridSkeleton.vue';
  import CampaignDetailDialog from '@/components/campaigns/CampaignDetailDialog.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import { listActiveCampaigns, type Campaign } from '@/services/campaignApi';
  import { useToast } from '@/composables/useToast';
  import { useAuthStore } from '@/stores/auth';

  const { toast } = useToast();
  const authStore = useAuthStore();

  const loading = ref(true);
  const campaigns = ref<Campaign[]>([]);
  const searchQuery = ref('');
  const showDetailDialog = ref(false);
  const selectedCampaign = ref<Campaign | null>(null);
  const showAuthModal = ref(false);
  const needsAuth = ref(false);

  const filteredCampaigns = computed(() => {
    if (!searchQuery.value) return campaigns.value;

    const query = searchQuery.value.toLowerCase();
    return campaigns.value.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.organization?.name.toLowerCase().includes(query)
    );
  });

  const viewCampaign = (campaign: Campaign) => {
    selectedCampaign.value = campaign;
    showDetailDialog.value = true;
  };

  const onCampaignJoined = () => {
    toast({
      title: 'Joined campaign',
      description: 'You can now submit clips to this campaign',
    });
    loadCampaigns();
  };

  const loadCampaigns = async () => {
    loading.value = true;
    try {
      const response = await listActiveCampaigns();
      if (response.success) {
        campaigns.value = response.campaigns ?? [];
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      toast({
        title: 'Error',
        description: 'Failed to load campaigns',
        type: 'error',
      });
    } finally {
      loading.value = false;
    }
  };

  // Watch for authentication changes to load campaigns after user logs in
  watch(
    () => authStore.isAuthenticated,
    (isAuth) => {
      if (isAuth && needsAuth.value) {
        needsAuth.value = false;
        loadCampaigns();
      }
    }
  );

  onMounted(() => {
    // Check if user is authenticated before loading campaigns
    if (!authStore.isAuthenticated) {
      needsAuth.value = true;
      loading.value = false;
    } else {
      loadCampaigns();
    }
  });
</script>
