<template>
  <PageLayout
    title="Creator profiles"
    description="Manage your content creators and their streaming configurations"
    :icon="Users"
  >
    <template #actions>
      <Button
        variant="ghost"
        size="sm"
        :loading="syncingPersonal"
        title="Sync personal profiles and branding to the cloud"
        @click="syncPersonalToCloud"
      >
        <Cloud v-if="!syncingPersonal" />
        {{ syncingPersonal ? 'Loading…' : syncPersonalLabel || 'Sync to cloud' }}
      </Button>
      <Button variant="primary" size="sm" data-tour-id="tour-add-creator" @click="openCreateDialog">
        <Plus />
        {{ activeTab === 'global' ? 'Add global profile' : 'Add creator' }}
      </Button>
    </template>

    <template #toolbar>
      <div class="@container flex min-w-0 flex-1 items-center gap-3">
        <span data-tour-id="tour-streamer-tab" class="inline-flex shrink-0">
          <SegmentedControl v-model="activeTab" :options="tabOptions" />
        </span>
        <div
          v-if="creators.length > 0"
          class="hidden min-w-0 items-center gap-3 overflow-hidden text-xs text-fg-muted @min-[50rem]:flex"
        >
          <span class="whitespace-nowrap">
            <span class="tabular font-medium text-fg">{{ creators.length }}</span>
            {{ creators.length === 1 ? 'creator' : 'creators' }}
          </span>
          <span class="flex items-center gap-1.5 whitespace-nowrap">
            <span class="size-1.5 rounded-full" :class="liveCreatorsCount > 0 ? 'bg-live' : 'bg-fg-disabled'" />
            <span class="tabular font-medium text-fg">{{ liveCreatorsCount }}</span>
            live
          </span>
          <span class="flex items-center gap-1.5 whitespace-nowrap">
            <Activity class="size-3.5 text-fg-subtle" />
            <span class="tabular font-medium text-fg">{{ monitoringCreatorsCount }}</span>
            monitoring
          </span>
        </div>
        <SearchField v-model="searchQuery" placeholder="Search creators…" class="ml-auto w-52 min-w-0 shrink" />
      </div>
    </template>

    <div class="flex flex-1 flex-col px-5 py-4" data-tour-id="tour-creators-list">
      <slot name="notice" />
      <!-- Not authenticated -->
      <EmptyState
        v-if="!authStore.isAuthenticated && creators.length === 0"
        :icon="Users"
        title="Sign in to manage creators"
        description="Access your creator profiles and streaming configurations."
      />

      <!-- First load only: reloads after save/delete keep the current cards -->
      <div v-else-if="loading && creators.length === 0 && campaigns.length === 0" class="skeleton-group card-grid">
        <div v-for="i in 6" :key="i" class="flex flex-col gap-3 rounded-xl border border-line-subtle bg-surface p-3.5">
          <div class="flex items-center gap-3">
            <div class="skeleton size-9 shrink-0 rounded-full" />
            <div class="flex flex-1 flex-col gap-1.5">
              <div class="skeleton h-3.5 w-2/3" />
              <div class="skeleton h-3 w-1/2" />
            </div>
          </div>
          <div class="flex gap-1">
            <div class="skeleton size-5" />
            <div class="skeleton size-5" />
          </div>
        </div>
      </div>

      <!-- Lists -->
      <div v-else-if="creators.length > 0 || campaigns.length > 0" class="flex flex-col gap-6">
        <section v-if="campaigns.length > 0" class="flex animate-enter flex-col gap-2.5">
          <SectionHeader title="Campaigns" :icon="Trophy" :count="campaigns.length" />
          <div class="card-grid items-start">
            <AssignedCampaignCard
              v-for="campaign in campaigns"
              :key="campaign.id"
              :campaign="campaign"
              :expanded="isCampaignExpanded(campaign.id)"
              :image-for="getCreatorProfileImage"
              @toggle="toggleCampaignExpansion(campaign.id)"
            />
          </div>
        </section>

        <!-- Tab panel: keyed so switching tabs eases in -->
        <div :key="activeTab" class="flex animate-enter flex-col gap-6 empty:hidden">
          <section v-for="group in profileSections" :key="group.key" class="flex flex-col gap-2.5">
            <SectionHeader :title="group.title" :icon="group.icon" :count="group.items.length" />
            <div class="card-grid">
              <CreatorCard
                v-for="creator in group.items"
                :key="creator.id"
                :creator="creator"
                :image-url="getCreatorProfileImage(creator)"
                :live="getCardLiveState(creator)"
                @view-vods="viewCreatorVods(creator)"
                @download="openDownloadDialog(creator)"
                @edit="openEditDialog(creator)"
                @submit-post="openPostSubmitDialog(creator)"
                @toggle-auto-dvr="toggleCreatorAutoDvr(creator)"
                @toggle-disabled="toggleProfileDisabled(creator)"
                @delete="confirmDeleteCreator(creator)"
                @record="onCreatorRecordClick(creator)"
                @auto-detect="onCreatorAutoDetectClick(creator)"
                @stop="stopCreatorMonitoring(creator)"
                @watch="watchCreator(creator)"
              />
            </div>
          </section>

          <!-- No search results -->
          <EmptyState
            v-if="filteredCreators.length === 0 && searchQuery"
            :icon="Search"
            size="sm"
            title="No creators found"
            :description="`No results for “${searchQuery}”.`"
          />
          <!-- Nothing in this tab -->
          <EmptyState
            v-else-if="filteredCreators.length === 0 && !searchQuery && creators.length > 0"
            :icon="activeTab === 'global' ? Paintbrush : Users"
            size="sm"
            :title="activeTab === 'global' ? 'No global branding profiles' : 'No streamer profiles'"
            :description="
              activeTab === 'global'
                ? 'Create a global branding profile to apply universal branding across all your content.'
                : 'Add a streamer profile to start managing their VODs and live monitoring.'
            "
          />
        </div>
      </div>

      <!-- Empty -->
      <EmptyState
        v-else
        :icon="Users"
        title="No creators yet"
        description="Add your first content creator to start managing their VODs, assets, and live monitoring."
      >
        <Button variant="secondary" @click="openCreateDialog">
          <Plus />
          Add creator
        </Button>
      </EmptyState>
    </div>
  </PageLayout>
</template>
<script lang="ts">
  import { defineComponent, markRaw } from 'vue';
  import { creatorProfilesPresentation } from '@/lib/sharedViewPresentation';
  import PageLayout from '@/components/PageLayout.vue';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { SearchField } from '@/components/ui/search-field';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import CreatorCard from '@/components/creators/CreatorCard.vue';
  import AssignedCampaignCard from '@/components/creators/AssignedCampaignCard.vue';
  import { Activity, Cloud, Paintbrush, Plus, Search, Trophy, Users } from 'lucide-vue-next';
  export default defineComponent({
    components: {
      PageLayout,
      Button,
      EmptyState,
      SearchField,
      SectionHeader,
      SegmentedControl,
      CreatorCard,
      AssignedCampaignCard,
      Activity,
      Cloud,
      Paintbrush,
      Plus,
      Search,
      Trophy,
      Users,
    },
    props: { model: { type: Object, required: true } },
    setup(props): Record<string, any> {
      return Object.assign(props.model, creatorProfilesPresentation(props.model), {
        PageLayout: markRaw(PageLayout),
        Button: markRaw(Button),
        EmptyState: markRaw(EmptyState),
        SearchField: markRaw(SearchField),
        SectionHeader: markRaw(SectionHeader),
        SegmentedControl: markRaw(SegmentedControl),
        CreatorCard: markRaw(CreatorCard),
        AssignedCampaignCard: markRaw(AssignedCampaignCard),
        Activity: markRaw(Activity),
        Cloud: markRaw(Cloud),
        Paintbrush: markRaw(Paintbrush),
        Plus: markRaw(Plus),
        Search: markRaw(Search),
        Trophy: markRaw(Trophy),
        Users: markRaw(Users),
      });
    },
  });
</script>
