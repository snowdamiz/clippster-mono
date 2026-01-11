<template>
  <div class="campaigns-page">
    <PageLayout
      title="Campaigns"
      description="Browse clipping campaigns and earn money by posting clips"
      :show-header="true"
      :icon="Megaphone"
    >
      <template #actions>
        <div class="relative w-[320px] shadow-sm group">
          <div
            class="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 pointer-events-none z-10"
          >
            <Search class="w-4 h-4 text-muted-foreground" />
          </div>
          <Input
            v-model="searchQuery"
            class="h-12 pl-11 pr-4 text-sm bg-background border-border/70 rounded-lg focus-visible:ring-primary/20 transition-all hover:border-primary/30 focus:border-primary/50 shadow-sm w-full"
            placeholder="Search campaigns..."
          />
        </div>
      </template>

      <div
        class="campaigns__content"
        :class="{ 'campaigns__content--empty': !loading && filteredCampaigns.length === 0 }"
      >
        <!-- Loading State -->
        <div v-if="loading" class="space-y-4 pt-4">
          <div v-for="i in 4" :key="i" class="bg-card border border-border/60 rounded-xl overflow-hidden animate-pulse">
            <div class="h-32 bg-muted/40"></div>
            <div class="p-4 space-y-3">
              <div class="h-5 bg-muted/40 rounded w-48"></div>
              <div class="h-4 bg-muted/30 rounded w-full"></div>
              <div class="flex gap-2">
                <div class="h-6 bg-muted/30 rounded-full w-20"></div>
                <div class="h-6 bg-muted/30 rounded-full w-16"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredCampaigns.length === 0" class="campaigns__empty">
          <div class="campaigns__empty-icon-wrapper">
            <Megaphone class="campaigns__empty-icon" />
          </div>
          <h3 class="campaigns__empty-title">No campaigns found</h3>
          <p class="campaigns__empty-description">
            {{ searchQuery ? 'Try adjusting your search' : 'Check back later for new campaigns' }}
          </p>
        </div>

        <!-- Campaigns Grid -->
        <div v-else class="pt-4">
          <div class="flex items-center justify-between px-1 text-[13px] text-muted-foreground mb-3">
            <span class="font-medium">Active Campaigns</span>
            <span class="tabular-nums">{{ filteredCampaigns.length }} campaigns</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="campaign in filteredCampaigns"
              :key="campaign.id"
              class="group bg-card rounded-xl border border-border/60 overflow-hidden hover:border-primary/30 transition-all cursor-pointer"
              @click="viewCampaign(campaign)"
            >
              <!-- Cover Image -->
              <div class="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5">
                <img
                  v-if="campaign.cover_image_url"
                  :src="campaign.cover_image_url"
                  class="w-full h-full object-cover"
                  @error="(e: Event) => ((e.target as HTMLImageElement).style.display = 'none')"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Megaphone class="w-10 h-10 text-primary/30" />
                </div>

                <!-- Organization Badge -->
                <div
                  v-if="campaign.organization"
                  class="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md"
                >
                  <img
                    v-if="campaign.organization.logo_url"
                    :src="campaign.organization.logo_url"
                    class="w-4 h-4 rounded-full"
                  />
                  <Building2 v-else class="w-3.5 h-3.5 text-white/80" />
                  <span class="text-[11px] font-medium text-white/90">{{ campaign.organization.name }}</span>
                </div>

                <!-- CPM Badge -->
                <div class="absolute top-2 right-2 px-2 py-1 bg-green-500/90 backdrop-blur-sm rounded-md">
                  <span class="text-[11px] font-bold text-white">${{ formatCpm(campaign.cpm) }}/1K</span>
                </div>
              </div>

              <!-- Content -->
              <div class="p-4 space-y-3">
                <div>
                  <h3
                    class="font-semibold text-[15px] text-foreground line-clamp-1 group-hover:text-primary transition-colors"
                  >
                    {{ campaign.title }}
                  </h3>
                  <p v-if="campaign.description" class="text-[13px] text-muted-foreground line-clamp-2 mt-1">
                    {{ campaign.description }}
                  </p>
                </div>

                <!-- Creator Profiles -->
                <div
                  v-if="campaign.creator_profiles && campaign.creator_profiles.length > 0"
                  class="flex items-center gap-1"
                >
                  <span class="text-[11px] text-muted-foreground mr-1">Creators:</span>
                  <div class="flex -space-x-1.5">
                    <div
                      v-for="(profile, idx) in campaign.creator_profiles.slice(0, 4)"
                      :key="profile.id"
                      class="w-6 h-6 rounded-full border-2 border-card overflow-hidden bg-muted"
                      :title="profile.name"
                    >
                      <img
                        v-if="profile.profile_image_url"
                        :src="profile.profile_image_url"
                        class="w-full h-full object-cover"
                      />
                      <div
                        v-else
                        class="w-full h-full flex items-center justify-center text-[10px] font-medium text-muted-foreground"
                      >
                        {{ profile.name?.charAt(0) }}
                      </div>
                    </div>
                    <div
                      v-if="campaign.creator_profiles.length > 4"
                      class="w-6 h-6 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground"
                    >
                      +{{ campaign.creator_profiles.length - 4 }}
                    </div>
                  </div>
                </div>

                <!-- Platforms -->
                <div class="flex flex-wrap gap-1.5">
                  <div
                    v-for="platform in campaign.allowed_platforms"
                    :key="platform"
                    class="inline-flex items-center gap-1 px-2 py-0.5 bg-muted/50 rounded-full text-[11px] font-medium text-muted-foreground"
                  >
                    <component :is="getPlatformIcon(platform)" class="w-3 h-3" />
                    {{ getPlatformDisplayName(platform) }}
                  </div>
                </div>

                <!-- Stats -->
                <div class="flex items-center justify-between pt-2 border-t border-border/40">
                  <div class="flex items-center gap-1 text-[12px] text-muted-foreground">
                    <Users class="w-3.5 h-3.5" />
                    <span>{{ campaign.participants_count || 0 }} clippers</span>
                  </div>
                  <div class="flex items-center gap-1 text-[12px] text-muted-foreground">
                    <DollarSign class="w-3.5 h-3.5" />
                    <span>${{ formatBudget(campaign.budget) }} budget</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>

    <!-- Campaign Detail Dialog -->
    <CampaignDetailDialog v-model:open="showDetailDialog" :campaign="selectedCampaign" @joined="onCampaignJoined" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import {
    Megaphone,
    Search,
    Building2,
    Users,
    DollarSign,
    Music2,
    Instagram,
    Twitter,
    Youtube,
    Globe,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Input } from '@/components/ui/input';
  import CampaignDetailDialog from '@/components/campaigns/CampaignDetailDialog.vue';
  import { listActiveCampaigns, type Campaign, getPlatformDisplayName } from '@/services/campaignApi';
  import { useToast } from '@/composables/useToast';

  const { toast } = useToast();

  const loading = ref(true);
  const campaigns = ref<Campaign[]>([]);
  const searchQuery = ref('');
  const showDetailDialog = ref(false);
  const selectedCampaign = ref<Campaign | null>(null);

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

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, typeof Music2> = {
      tiktok: Music2,
      instagram: Instagram,
      x: Twitter,
      youtube: Youtube,
    };
    return icons[platform] || Globe;
  };

  const formatCpm = (cpm: string | number) => {
    const value = typeof cpm === 'string' ? parseFloat(cpm) : cpm;
    return value.toFixed(2);
  };

  const formatBudget = (budget: string | number) => {
    const value = typeof budget === 'string' ? parseFloat(budget) : budget;
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  };

  const viewCampaign = (campaign: Campaign) => {
    selectedCampaign.value = campaign;
    showDetailDialog.value = true;
  };

  const onCampaignJoined = () => {
    toast({
      title: 'Joined Campaign',
      description: 'You can now submit clips to this campaign',
    });
    loadCampaigns();
  };

  const loadCampaigns = async () => {
    loading.value = true;
    try {
      const response = await listActiveCampaigns();
      if (response.success) {
        campaigns.value = response.campaigns;
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

  onMounted(() => {
    loadCampaigns();
  });
</script>

<style scoped>
  .campaigns-page {
    @apply h-full;
  }

  /* ===== Content Container ===== */
  .campaigns__content {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .campaigns__content--empty {
    justify-content: center;
    align-items: center;
  }

  /* ===== Empty State ===== */
  .campaigns__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .campaigns__empty-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: var(--sidebar-hover);
    border-radius: 16px;
    margin-bottom: 1.5rem;
  }

  .campaigns__empty-icon {
    width: 36px;
    height: 36px;
    color: var(--sidebar-text-muted);
  }

  .campaigns__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .campaigns__empty-description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 300px;
  }
</style>
