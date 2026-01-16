<template>
  <div class="dashboard-container flex h-full">
    <DashboardSidebar @show-auth-modal="showAuthModal = true" />
    <!-- Main content area with left margin to account for fixed sidebar -->
    <main
      class="flex-1 flex flex-col transition-[margin-left] duration-200 ease-out dashboard-container"
      :class="isCollapsed ? 'ml-16' : 'ml-60'"
    >
      <!-- <DashboardHeader /> -->
      <!-- Page content -->
      <div class="flex-1 min-h-0 dashboard-container">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in"><component :is="Component" class="h-full" /></transition>
        </router-view>
      </div>
    </main>
    <!-- Authentication Modal -->
    <AuthModal v-model="showAuthModal" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import DashboardSidebar from '@/components/DashboardSidebar.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import { useAuthStore } from '@/stores/auth';
  import { useSidebarState } from '@/composables/useSidebarState';

  const authStore = useAuthStore();
  const { isCollapsed } = useSidebarState();
  const showAuthModal = ref(false);

  // Check if user needs to select account type
  const needsAccountTypeSelection = computed(() => {
    // Not authenticated - no need to show
    if (!authStore.isAuthenticated || !authStore.user) {
      return false;
    }

    // Already has account_type set - no need to show
    if (authStore.user.account_type) {
      return false;
    }

    // Already owns an organization - definitely an org account, no need to show
    if (authStore.user.owned_organization_id) {
      return false;
    }

    // User is authenticated but has no account_type and doesn't own an org
    return true;
  });

  // Automatically set account type to personal for new users
  watch(
    needsAccountTypeSelection,
    async (needs) => {
      if (needs) {
        await authStore.setAccountType('personal');
      }
    },
    { immediate: true }
  );
</script>

<style scoped>
  .dashboard-container {
    background-color: var(--sidebar-bg);
  }

  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.1s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
</style>
