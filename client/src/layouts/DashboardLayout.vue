<template>
  <div class="bg-background flex">
    <DashboardSidebar @show-auth-modal="showAuthModal = true" />
    <!-- Main content area with left margin to account for fixed sidebar -->
    <main class="flex-1 ml-64">
      <!-- <DashboardHeader /> -->
      <!-- Page content with top margin to account for fixed header -->
      <div class="px-6 pb-8 pt-8">
        <div class="max-w-7xl mx-auto">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in"><component :is="Component" /></transition>
          </router-view>
        </div>
      </div>
    </main>
    <!-- Authentication Modal -->
    <AuthModal v-model="showAuthModal" />
    <!-- Account Type Selection Dialog (shown for new users) -->
    <AccountTypeDialog v-model="showAccountTypeDialog" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue';
  import DashboardSidebar from '@/components/DashboardSidebar.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import AccountTypeDialog from '@/components/AccountTypeDialog.vue';
  import { useAuthStore } from '@/stores/auth';

  const authStore = useAuthStore();
  const showAuthModal = ref(false);
  const showAccountTypeDialog = ref(false);

  // Check if user needs to select account type
  const needsAccountTypeSelection = computed(() => {
    return (
      authStore.isAuthenticated &&
      authStore.user &&
      (authStore.user.account_type === null || authStore.user.account_type === undefined)
    );
  });

  // Show dialog when user is authenticated but hasn't selected account type
  watch(
    needsAccountTypeSelection,
    (needs) => {
      if (needs) {
        showAccountTypeDialog.value = true;
      }
    },
    { immediate: true }
  );

  onMounted(() => {
    if (needsAccountTypeSelection.value) {
      showAccountTypeDialog.value = true;
    }
  });
</script>

<style scoped>
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.1s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
</style>
