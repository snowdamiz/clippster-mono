<template>
  <div class="h-full w-full">
    <PageLayout
      :title="organization?.name || 'Organization'"
      description="Manage your team and organization tools"
      :icon="Building2"
    >
      <template v-if="hasMultipleOrgs" #title>
        <OrganizationSelector :model-value="organizationId" />
      </template>
      <template #badge>
        <div v-if="loading" class="skeleton h-[18px] w-14" />
        <OrgRoleBadge v-else-if="role" :role="role" />
      </template>

      <template #actions>
        <Button v-if="isAdmin" variant="primary" size="sm" @click="showInviteDialog = true">
          <UserPlus />
          Add member
        </Button>
      </template>

      <div class="flex flex-1 flex-col px-5 py-4">
        <!-- Error -->
        <EmptyState
          v-if="error"
          :icon="AlertTriangle"
          tone="danger"
          title="Couldn't load organization"
          :description="error"
        >
          <Button variant="secondary" size="sm" @click="loadOrganization(true)">
            <RefreshCw />
            Try again
          </Button>
        </EmptyState>

        <!-- Loading -->
        <div v-else-if="loading" class="flex flex-col gap-6" aria-busy="true">
          <div class="skeleton h-[74px] rounded-[var(--radius-card)]" />
          <div v-for="s in 3" :key="s" class="flex flex-col gap-2.5">
            <div class="skeleton h-3 w-20" />
            <div class="skeleton h-[114px] rounded-[var(--radius-card)]" />
          </div>
        </div>

        <!-- Hub -->
        <div v-else class="flex animate-enter flex-col gap-6">
          <StatGrid :count="4">
            <StatCard
              label="Members"
              :value="members.length"
              :hint="hasActiveSubscription && totalSeats ? `${members.length} of ${totalSeats} seats used` : 'Active in organization'"
              :icon="Users"
            />
            <StatCard
              label="Creator profiles"
              :value="profilesLoaded ? profilesCount : '—'"
              :loading="!profilesLoaded"
              hint="Shared branding"
              :icon="UserCircle"
            />
            <StatCard
              label="Assets"
              :value="assetsLoaded ? assetsCount : '—'"
              :loading="!assetsLoaded"
              hint="Shared media files"
              :icon="Package"
            />
            <StatCard
              label="Credit pool"
              :value="`${formatAllocation(credits.hoursRemaining)} min`"
              hint="Available to allocate"
              :icon="Coins"
              tone="brand"
            />
          </StatGrid>

          <section v-for="section in sections" :key="section.id" class="flex flex-col gap-2.5">
            <SectionHeader :title="section.title" />
            <ListGroup :columns="2">
              <ListItem
                v-for="tool in section.tools"
                :key="tool.id"
                :title="tool.title"
                :description="tool.description"
                :icon="tool.icon"
                :to="tool.comingSoon ? undefined : tool.route"
                :disabled="tool.comingSoon"
              >
                <template v-if="tool.comingSoon" #trailing><Badge>Coming soon</Badge></template>
              </ListItem>
            </ListGroup>
          </section>
        </div>
      </div>
    </PageLayout>

    <!-- Invite Member Dialog -->
    <InviteMemberDialog
      v-model="showInviteDialog"
      :organization-id="organizationId ?? ''"
      @member-added="loadOrganization"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import {
    Building2,
    Users,
    UserCircle,
    UserPlus,
    MessageCircle,
    Target,
    Search,
    Share2,
    Link2,
    Send,
    Package,
    CreditCard,
    Settings,
    AlertTriangle,
    Briefcase,
    Coins,
    RefreshCw,
  } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { ListGroup, ListItem } from '@/components/ui/list-group';
  import { SectionHeader } from '@/components/ui/section-header';
  import { StatCard, StatGrid } from '@/components/ui/stat-card';
  import PageLayout from '@/components/PageLayout.vue';
  import OrgRoleBadge from './components/OrgRoleBadge.vue';
  import { useOrganization } from '@/composables/useOrganization';
  import InviteMemberDialog from '@/components/InviteMemberDialog.vue';
  import OrganizationSelector from '@/components/OrganizationSelector.vue';
  import { useOrganizationSelector } from '@/composables/useOrganizationSelector';

  const showInviteDialog = ref(false);
  const { hasMultipleOrgs } = useOrganizationSelector();

  const {
    loading,
    error,
    organization,
    organizationId,
    members,
    credits,
    role,
    isAdmin,
    loadOrganization,
    formatAllocation,
    creatorProfiles,
    profilesLoaded,
    loadCreatorProfiles,
    orgAssets,
    assetsLoaded,
    loadOrgAssets,
    hasActiveSubscription,
    totalSeats,
  } = useOrganization();
  // Load profile and asset counts for display
  const profilesCount = computed(() => creatorProfiles.value.length);
  const assetsCount = computed(() => orgAssets.value.length);

  interface Tool {
    id: string;
    title: string;
    description: string;
    icon: typeof Users;
    route: string;
    comingSoon?: boolean;
    navHidden?: boolean;
  }

  // Tool definitions (metrics are shown in the stat row above the sections)
  const teamTools = computed<Tool[]>(() => [
    {
      id: 'members',
      title: 'Members',
      description: 'Manage team, assign roles, and allocate credits',
      icon: Users,
      route: `/organization/${organizationId.value}/members`,
    },
    {
      id: 'creators',
      title: 'Creators',
      description: 'Manage creator profiles and platform links',
      icon: UserCircle,
      route: `/organization/${organizationId.value}/creators`,
    },
    {
      id: 'messages',
      title: 'Messages',
      description: 'Team communication and announcements',
      icon: MessageCircle,
      route: '/messages',
    },
    {
      id: 'hiring',
      title: 'Hiring',
      description: 'Create a hiring post to recruit clippers',
      icon: Briefcase,
      route: `/organization/${organizationId.value}/hiring`,
    },
  ]);

  const contentTools = computed<Tool[]>(() => [
    {
      id: 'campaigns',
      title: 'Campaigns',
      description: 'Run and track clipping campaigns',
      icon: Target,
      route: `/organization/${organizationId.value}/campaigns`,
      navHidden: true,
    },
    {
      id: 'clippers',
      title: 'Find clippers',
      description: 'Discover and recruit talented clippers',
      icon: Search,
      route: `/organization/${organizationId.value}/clippers`,
    },
    {
      id: 'shared',
      title: 'Shared content',
      description: 'Distribute clips and audio to team members',
      icon: Share2,
      route: `/organization/${organizationId.value}/shared`,
    },
    {
      id: 'social',
      title: 'Social accounts',
      description: 'Manage connected social platforms',
      icon: Link2,
      route: `/organization/${organizationId.value}/social`,
    },
    {
      id: 'posts',
      title: 'Post submissions',
      description: 'Review and approve member posts',
      icon: Send,
      route: `/organization/${organizationId.value}/posts`,
    },
  ]);

  const visibleContentTools = computed(() => contentTools.value.filter((tool) => !tool.navHidden));

  const managementTools = computed<Tool[]>(() => [
    {
      id: 'assets',
      title: 'Assets',
      description: 'Intros, outros, watermarks, and media',
      icon: Package,
      route: `/organization/${organizationId.value}/assets`,
    },
    {
      id: 'billing',
      title: 'Billing',
      description: 'Plan, credits and payment history',
      icon: CreditCard,
      route: `/organization/${organizationId.value}/billing`,
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'Organization profile and preferences',
      icon: Settings,
      route: `/organization/${organizationId.value}/settings`,
    },
  ]);

  const sections = computed(() => [
    { id: 'team', title: 'Team', tools: teamTools.value },
    { id: 'content', title: 'Content', tools: visibleContentTools.value },
    { id: 'management', title: 'Management', tools: managementTools.value },
  ]);

  onMounted(async () => {
    await loadOrganization();
    // Load counts for display (lazy load)
    if (!profilesLoaded.value) loadCreatorProfiles();
    if (!assetsLoaded.value) loadOrgAssets();
  });
</script>

