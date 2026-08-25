<template>
  <PageLayout
    title="Find Clippers"
    description="Discover and recruit talented clippers for your team"
    :show-header="true"
    :icon="Search"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Find Clippers' }]"
  >
    <template #firstBreadcrumb>
      <OrganizationBreadcrumb />
    </template>
    <template #actions>
      <div class="view-toggle">
        <button
          @click="activeView = 'directory'"
          class="view-toggle__btn"
          :class="{ 'view-toggle__btn--active': activeView === 'directory' }"
        >
          <Users class="view-toggle__icon" />
          Directory
        </button>
        <button
          @click="activeView = 'leaderboard'"
          class="view-toggle__btn"
          :class="{ 'view-toggle__btn--active': activeView === 'leaderboard' }"
        >
          <Trophy class="view-toggle__icon" />
          Leaderboard
        </button>
      </div>
    </template>

    <OrganizationClippersComponent :active-view="activeView" :organization-id="organizationId" />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useRoute } from 'vue-router';
  import { Search, Users, Trophy } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import OrganizationClippersComponent from '@/components/organization/OrganizationClippers.vue';

  const route = useRoute();
  const organizationId = route.params.id as string;
  const activeView = ref<'directory' | 'leaderboard'>('directory');
</script>

<style scoped>
  .view-toggle {
    display: flex;
    gap: 0.5rem;
  }

  .view-toggle__btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    background-color: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .view-toggle__btn:hover:not(.view-toggle__btn--active) {
    background-color: var(--sidebar-hover);
    border-color: rgba(255, 255, 255, 0.15);
    color: var(--sidebar-text);
  }

  .view-toggle__btn--active {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border-color: var(--sidebar-accent);
  }

  .view-toggle__btn--active:hover {
    opacity: 0.9;
  }

  .view-toggle__icon {
    width: 14px;
    height: 14px;
  }
</style>
